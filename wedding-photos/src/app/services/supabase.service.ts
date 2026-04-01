import { Injectable } from '@angular/core';
import { SupabaseClient, User, createClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

export interface AppUser {
  id: string;
  username: string;
  displayName: string;
  role: 'guest' | 'admin';
  albumId: string;
  avatarUrl: string;
}

interface ProfileRow {
  id: string;
  username: string;
  display_name: string;
  role: 'guest' | 'admin';
  avatar_url: string | null;
}

interface AlbumRow {
  id: string;
}

const noOpLock = async <T>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<T>
): Promise<T> => await fn();

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private readonly client: SupabaseClient;
  private readonly loginEmailDomain = 'wedding-photos.example.com';
  private readonly legacyLoginEmailDomain = 'wedding.local';

  constructor() {
    this.client = createClient(
      environment.supabase.url,
      environment.supabase.publishableKey,
      {
        auth: {
          // This app is primarily used as a single-tab mobile PWA.
          // Disabling Web Locks avoids intermittent Supabase auth deadlocks
          // seen on some mobile browsers and installed PWAs.
          lock: noOpLock
        }
      }
    );
  }

  async signUpWithUsername(payload: {
    username: string;
    displayName: string;
    password: string;
  }): Promise<AppUser> {
    const normalizedUsername = this.normalizeUsername(payload.username);
    const displayName = payload.displayName.trim();

    if (!normalizedUsername) {
      throw new Error('Choisissez un nom utilisateur valide.');
    }

    if (!displayName) {
      throw new Error('Entrez un nom a afficher dans la galerie.');
    }

    const { data, error } = await this.client.auth.signUp({
      email: this.buildLoginEmail(normalizedUsername),
      password: payload.password,
      options: {
        data: {
          username: normalizedUsername,
          display_name: displayName
        }
      }
    });

    if (error) {
      throw this.toFriendlyError(error.message);
    }

    if (!data.session) {
      throw new Error(
        'La confirmation email Supabase doit etre desactivee pour cette application.'
      );
    }

    return this.getRequiredCurrentUser();
  }

  async signInWithUsername(username: string, password: string): Promise<AppUser> {
    const normalizedUsername = this.normalizeUsername(username);
    if (!normalizedUsername) {
      throw new Error('Entrez un nom utilisateur valide.');
    }

    let errorMessage = '';
    const loginEmails = [
      this.buildLoginEmail(normalizedUsername),
      this.buildLegacyLoginEmail(normalizedUsername)
    ];

    for (const email of loginEmails) {
      const { error } = await this.client.auth.signInWithPassword({
        email,
        password
      });

      if (!error) {
        return this.getRequiredCurrentUser();
      }

      errorMessage = error.message || errorMessage;

      if (!this.isInvalidCredentialsError(error.message)) {
        throw this.toFriendlyError(error.message);
      }
    }

    throw this.toFriendlyError(errorMessage);
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) {
      throw error;
    }
  }

  async updateCurrentProfile(payload: {
    displayName: string;
    username: string;
    avatarUrl?: string | null;
  }): Promise<AppUser> {
    const { data: authData, error: authError } = await this.client.auth.getUser();
    if (authError) {
      throw authError;
    }

    if (!authData.user) {
      throw new Error('Session utilisateur introuvable.');
    }

    const currentUser = await this.getRequiredCurrentUser();
    const normalizedUsername = this.normalizeUsername(payload.username);
    const displayName = payload.displayName.trim();
    const avatarUrl = payload.avatarUrl?.trim() || null;

    if (!normalizedUsername) {
      throw new Error('Choisissez un nom utilisateur valide.');
    }

    if (!displayName) {
      throw new Error('Entrez un nom a afficher.');
    }

    const attributes: {
      email?: string;
      data: {
        username: string;
        display_name: string;
        avatar_url: string | null;
      };
    } = {
      data: {
        username: normalizedUsername,
        display_name: displayName,
        avatar_url: avatarUrl
      }
    };

    const currentEmail = (authData.user.email || '').trim().toLowerCase();
    const shouldRefreshLoginEmail = normalizedUsername !== currentUser.username ||
      this.isLegacyLoginEmail(currentEmail);

    if (shouldRefreshLoginEmail) {
      attributes.email = this.buildLoginEmail(normalizedUsername);
    }

    const { error } = await this.client.auth.updateUser(attributes);
    if (error) {
      throw this.toFriendlyError(error.message);
    }

    return this.getRequiredCurrentUser();
  }

  async getCurrentAppUser(): Promise<AppUser | null> {
    const { data, error } = await this.client.auth.getUser();
    if (error) {
      throw error;
    }

    if (!data.user) {
      return null;
    }

    return this.loadUserContext(data.user);
  }

  async fetchAlbums(): Promise<any[]> {
    const { data, error } = await this.client
      .from('albums')
      .select(`
        id,
        title,
        created_at,
        owner_id,
        owner:profiles!albums_owner_id_fkey (
          id,
          username,
          display_name,
          role,
          avatar_url
        ),
        photos (
          id,
          cloudinary_public_id,
          media_url,
          media_type,
          uploaded_by,
          download_count,
          created_at,
          uploader:profiles!photos_uploaded_by_fkey (
            id,
            username,
            display_name,
            avatar_url
          ),
          photo_likes (
            user_id
          )
        )
      `);

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  async insertPhoto(payload: {
    albumId: string;
    publicId: string;
    url: string;
    type: 'image' | 'video';
  }): Promise<{ id: string; created_at: string; download_count: number }> {
    const userId = await this.requireUserId();

    const { data, error } = await this.client
      .from('photos')
      .insert({
        album_id: payload.albumId,
        cloudinary_public_id: payload.publicId,
        media_url: payload.url,
        media_type: payload.type,
        uploaded_by: userId
      })
      .select('id, created_at, download_count')
      .single();

    if (error) {
      throw error;
    }

    return {
      id: data.id,
      created_at: data.created_at,
      download_count: data.download_count
    };
  }

  async deletePhoto(photoId: string): Promise<void> {
    const { error } = await this.client
      .from('photos')
      .delete()
      .eq('id', photoId);

    if (error) {
      throw error;
    }
  }

  async deleteAlbum(albumId: string): Promise<void> {
    const { error } = await this.client
      .from('albums')
      .delete()
      .eq('id', albumId);

    if (error) {
      throw error;
    }
  }

  async toggleLike(photoId: string): Promise<{ liked: boolean; userId: string }> {
    const userId = await this.requireUserId();

    const { data, error } = await this.client
      .from('photo_likes')
      .select('photo_id')
      .eq('photo_id', photoId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      const { error: deleteError } = await this.client
        .from('photo_likes')
        .delete()
        .eq('photo_id', photoId)
        .eq('user_id', userId);

      if (deleteError) {
        throw deleteError;
      }

      return { liked: false, userId };
    }

    const { error: insertError } = await this.client
      .from('photo_likes')
      .insert({
        photo_id: photoId,
        user_id: userId
      });

    if (insertError) {
      throw insertError;
    }

    return { liked: true, userId };
  }

  async incrementDownloadCount(photoId: string): Promise<number> {
    const { data, error } = await this.client.rpc('increment_photo_download_count', {
      p_photo_id: photoId
    });

    if (error) {
      throw error;
    }

    return Number.isFinite(Number(data)) ? Number(data) : 0;
  }

  normalizeUsername(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private buildLoginEmail(username: string): string {
    return `${username}@${this.loginEmailDomain}`;
  }

  private buildLegacyLoginEmail(username: string): string {
    return `${username}@${this.legacyLoginEmailDomain}`;
  }

  private isLegacyLoginEmail(email: string): boolean {
    return email.endsWith(`@${this.legacyLoginEmailDomain}`);
  }

  private isInvalidCredentialsError(message: string): boolean {
    return message.toLowerCase().includes('invalid login credentials');
  }

  private async getRequiredCurrentUser(): Promise<AppUser> {
    const currentUser = await this.getCurrentAppUser();
    if (!currentUser) {
      throw new Error('Session utilisateur introuvable.');
    }

    return currentUser;
  }

  private async requireUserId(): Promise<string> {
    const { data, error } = await this.client.auth.getUser();
    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error('Connexion requise.');
    }

    return data.user.id;
  }

  private async loadUserContext(user: User): Promise<AppUser> {
    const profile = await this.waitForProfile(user.id);
    const album = await this.waitForAlbum(user.id);

    return {
      id: profile.id,
      username: profile.username,
      displayName: profile.display_name,
      role: profile.role,
      albumId: album.id,
      avatarUrl: profile.avatar_url || ''
    };
  }

  private async waitForProfile(userId: string): Promise<ProfileRow> {
    for (let attempt = 0; attempt < 6; attempt++) {
      const { data, error } = await this.client
        .from('profiles')
        .select('id, username, display_name, role, avatar_url')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data) {
        return data as ProfileRow;
      }

      await this.sleep(150);
    }

    throw new Error('Profil utilisateur introuvable.');
  }

  private async waitForAlbum(userId: string): Promise<AlbumRow> {
    for (let attempt = 0; attempt < 6; attempt++) {
      const { data, error } = await this.client
        .from('albums')
        .select('id')
        .eq('owner_id', userId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data) {
        return data as AlbumRow;
      }

      await this.sleep(150);
    }

    throw new Error('Album utilisateur introuvable.');
  }

  private toFriendlyError(message: string): Error {
    const normalized = message.toLowerCase();

    if (normalized.includes('user already registered')) {
      return new Error('Ce nom utilisateur existe deja.');
    }

    if (normalized.includes('email address already in use')) {
      return new Error('Ce nom utilisateur existe deja.');
    }

    if (normalized.includes('invalid login credentials')) {
      return new Error('Nom utilisateur ou mot de passe incorrect.');
    }

    if (normalized.includes('password should be at least')) {
      return new Error('Le mot de passe doit contenir au moins 6 caracteres.');
    }

    if (normalized.includes('signup is disabled')) {
      return new Error('Les inscriptions Supabase sont actuellement desactivees.');
    }

    return new Error(message || 'Operation Supabase impossible pour le moment.');
  }

  private sleep(durationMs: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, durationMs);
    });
  }
}
