import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { CloudinaryService } from './cloudinary.service';

export interface Photo {
  id: string;
  url: string;
  gridUrl: string;
  viewerUrl: string;
  publicId: string;
  uploadedBy: string;
  uploadedByUsername: string;
  uploadedByAvatarUrl: string;
  uploadedAt: Date | string;
  type: 'image' | 'video';
  likes: string[];
  downloadCount: number;
}

export interface Album {
  id: string;
  name: string;
  ownerUsername: string;
  ownerRole: 'guest' | 'admin';
  avatarUrl: string;
  photos: Photo[];
  createdAt: Date | string;
}

@Injectable({
  providedIn: 'root'
})
export class AlbumService {
  private readonly albumsSubject = new BehaviorSubject<Album[]>([]);
  private initializationPromise: Promise<void> | null = null;

  public albums$ = this.albumsSubject.asObservable();

  constructor(
    private supabaseService: SupabaseService,
    private cloudinaryService: CloudinaryService
  ) {}

  async ready(forceRefresh = false): Promise<void> {
    if (forceRefresh || !this.initializationPromise) {
      this.initializationPromise = this.refreshSharedAlbums();
    }

    await this.initializationPromise;
  }

  async refreshSharedAlbums(): Promise<void> {
    const albums = await this.fetchAlbums();
    this.albumsSubject.next(albums);
  }

  async getCurrentUserAlbum(): Promise<Album> {
    const storedAlbumId = sessionStorage.getItem('currentAlbumId') || '';

    if (storedAlbumId) {
      const existingAlbum = this.getAlbum(storedAlbumId);
      if (existingAlbum) {
        return existingAlbum;
      }
    }

    await this.ready(true);

    const refreshedAlbumId = sessionStorage.getItem('currentAlbumId') || '';
    if (!refreshedAlbumId) {
      throw new Error('Album utilisateur introuvable.');
    }

    const album = this.getAlbum(refreshedAlbumId);
    if (!album) {
      throw new Error('Album utilisateur introuvable.');
    }

    return album;
  }

  getAlbum(id: string): Album | undefined {
    return this.albumsSubject.value.find(album => album.id === id);
  }

  async addPhotoToAlbum(albumId: string, photo: Photo): Promise<void> {
    const insertedPhoto = await this.supabaseService.insertPhoto({
      albumId,
      publicId: photo.publicId,
      url: photo.url,
      type: photo.type
    });

    const album = this.getAlbum(albumId);
    if (!album) {
      await this.refreshSharedAlbums();
      return;
    }

    this.upsertLocalAlbum({
      ...album,
      photos: [
        ...album.photos,
        this.hydratePhoto({
          ...photo,
          id: insertedPhoto.id,
          uploadedAt: insertedPhoto.created_at,
          downloadCount: insertedPhoto.download_count
        })
      ]
    });
  }

  async removePhotoFromAlbum(albumId: string, photoId: string): Promise<void> {
    await this.supabaseService.deletePhoto(photoId);

    const album = this.getAlbum(albumId);
    if (!album) {
      await this.refreshSharedAlbums();
      return;
    }

    this.upsertLocalAlbum({
      ...album,
      photos: album.photos.filter(photo => photo.id !== photoId)
    });
  }

  async deleteAlbum(albumId: string): Promise<void> {
    await this.supabaseService.deleteAlbum(albumId);
    this.albumsSubject.next(this.albumsSubject.value.filter(album => album.id !== albumId));
  }

  getAllAlbums(): Album[] {
    return this.albumsSubject.value;
  }

  getAlbumByUserName(userName: string): Album | undefined {
    const normalizedUserName = this.normalizeValue(userName);
    return this.albumsSubject.value.find(album =>
      this.normalizeValue(album.ownerUsername) === normalizedUserName ||
      this.normalizeValue(album.name) === normalizedUserName
    );
  }

  async toggleLike(albumId: string, photoId: string): Promise<boolean> {
    const { liked, userId } = await this.supabaseService.toggleLike(photoId);
    const album = this.getAlbum(albumId);

    if (!album) {
      await this.refreshSharedAlbums();
      return liked;
    }

    this.upsertLocalAlbum({
      ...album,
      photos: album.photos.map(photo => {
        if (photo.id !== photoId) {
          return photo;
        }

        const likes = liked
          ? [...photo.likes, userId]
          : photo.likes.filter(currentUserId => currentUserId !== userId);

        return {
          ...photo,
          likes
        };
      })
    });

    return liked;
  }

  async incrementDownloadCount(albumId: string, photoId: string): Promise<void> {
    const album = this.getAlbum(albumId);
    if (!album) {
      return;
    }

    const photo = album.photos.find(item => item.id === photoId);
    if (!photo) {
      return;
    }

    const nextCount = await this.supabaseService.incrementDownloadCount(photoId);

    this.upsertLocalAlbum({
      ...album,
      photos: album.photos.map(item =>
        item.id === photoId
          ? { ...item, downloadCount: nextCount }
          : item
      )
    });
  }

  isLikedByUser(albumId: string, photoId: string, userId: string): boolean {
    const album = this.getAlbum(albumId);
    if (!album) {
      return false;
    }

    const photo = album.photos.find(item => item.id === photoId);
    return photo ? photo.likes.includes(userId) : false;
  }

  getPhotoStats(albumId: string, photoId: string): { likes: number; downloads: number } {
    const album = this.getAlbum(albumId);
    if (!album) {
      return { likes: 0, downloads: 0 };
    }

    const photo = album.photos.find(item => item.id === photoId);
    return photo ? { likes: photo.likes.length, downloads: photo.downloadCount } : { likes: 0, downloads: 0 };
  }

  private async fetchAlbums(): Promise<Album[]> {
    const rows = await this.supabaseService.fetchAlbums();

    return (rows ?? [])
      .map(row => this.mapAlbum(row))
      .sort((left, right) => this.getAlbumLastActivity(right).getTime() - this.getAlbumLastActivity(left).getTime());
  }

  private mapAlbum(row: any): Album {
    const owner = row.owner || {};

    return {
      id: row.id,
      name: owner.display_name || 'Invite',
      ownerUsername: owner.username || '',
      ownerRole: owner.role === 'admin' ? 'admin' : 'guest',
      avatarUrl: owner.avatar_url || '',
      createdAt: this.toDate(row.created_at).toISOString(),
      photos: (row.photos ?? [])
        .map((photo: any) => this.hydratePhoto({
          id: photo.id,
          url: photo.media_url,
          gridUrl: '',
          viewerUrl: '',
          publicId: photo.cloudinary_public_id,
          uploadedBy: photo.uploader?.display_name || owner.display_name || 'Invite',
          uploadedByUsername: photo.uploader?.username || '',
          uploadedByAvatarUrl: photo.uploader?.avatar_url || '',
          uploadedAt: this.toDate(photo.created_at).toISOString(),
          type: photo.media_type === 'video' ? 'video' : 'image',
          likes: Array.isArray(photo.photo_likes)
            ? photo.photo_likes
                .map((like: any) => String(like.user_id || ''))
                .filter(Boolean)
            : [],
          downloadCount: Number.isFinite(Number(photo.download_count))
            ? Number(photo.download_count)
            : 0
        }))
        .sort((left: Photo, right: Photo) => this.toDate(left.uploadedAt).getTime() - this.toDate(right.uploadedAt).getTime())
    };
  }

  private upsertLocalAlbum(album: Album): void {
    const updatedAlbum = this.hydrateAlbum(album);
    const nextAlbums = this.albumsSubject.value.filter(item => item.id !== updatedAlbum.id);
    nextAlbums.push(updatedAlbum);
    this.albumsSubject.next(
      nextAlbums.sort((left, right) => this.getAlbumLastActivity(right).getTime() - this.getAlbumLastActivity(left).getTime())
    );
  }

  private hydrateAlbum(album: Album): Album {
    return {
      ...album,
      name: album.name.trim(),
      ownerUsername: album.ownerUsername.trim(),
      ownerRole: album.ownerRole === 'admin' ? 'admin' : 'guest',
      avatarUrl: album.avatarUrl || '',
      createdAt: this.toDate(album.createdAt).toISOString(),
      photos: album.photos.map(photo => this.hydratePhoto(photo))
    };
  }

  private hydratePhoto(photo: Photo): Photo {
    return {
      id: photo.id,
      url: photo.url,
      gridUrl: this.buildGridUrl(photo.publicId || '', photo.type, photo.url),
      viewerUrl: this.buildViewerUrl(photo.publicId || '', photo.type, photo.url),
      publicId: photo.publicId || '',
      uploadedBy: photo.uploadedBy,
      uploadedByUsername: photo.uploadedByUsername || '',
      uploadedByAvatarUrl: photo.uploadedByAvatarUrl || '',
      uploadedAt: this.toDate(photo.uploadedAt).toISOString(),
      type: photo.type === 'video' ? 'video' : 'image',
      likes: Array.isArray(photo.likes)
        ? photo.likes.map(like => String(like)).filter(Boolean)
        : [],
      downloadCount: Number.isFinite(Number(photo.downloadCount))
        ? Number(photo.downloadCount)
        : 0
    };
  }

  private buildGridUrl(publicId: string, type: 'image' | 'video', fallbackUrl: string): string {
    return this.cloudinaryService.getGalleryMediaUrl(publicId, type, fallbackUrl);
  }

  private buildViewerUrl(publicId: string, type: 'image' | 'video', fallbackUrl: string): string {
    return this.cloudinaryService.getViewerMediaUrl(publicId, type, fallbackUrl);
  }

  private normalizeValue(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private getAlbumLastActivity(album: Album): Date {
    const latestPhoto = album.photos[album.photos.length - 1];
    return latestPhoto
      ? this.toDate(latestPhoto.uploadedAt)
      : this.toDate(album.createdAt);
  }

  private toDate(value: Date | string | undefined): Date {
    if (value instanceof Date) {
      return value;
    }

    const parsed = value ? new Date(value) : new Date();
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }
}
