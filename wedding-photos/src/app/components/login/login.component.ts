import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AlbumService } from '../../services/album.service';
import { AppUser, SupabaseService } from '../../services/supabase.service';

type AuthMode = 'signin' | 'signup';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  mode: AuthMode = 'signin';
  displayName = '';
  username = '';
  password = '';
  confirmPassword = '';
  errorMessage = '';
  infoMessage = '';
  isLoading = false;

  constructor(
    private albumService: AlbumService,
    private supabaseService: SupabaseService,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    const currentUser = await this.supabaseService.getCurrentAppUser().catch(() => null);
    if (!currentUser) {
      this.clearSession();
      return;
    }

    this.storeSession(currentUser);
    await this.albumService.refreshSharedAlbums();
    this.router.navigate(['/gallery']);
  }

  async onSubmit(): Promise<void> {
    this.errorMessage = '';
    this.infoMessage = '';

    const trimmedUsername = this.username.trim();
    const trimmedDisplayName = this.displayName.trim();
    const trimmedPassword = this.password.trim();

    if (!trimmedUsername || !trimmedPassword) {
      this.errorMessage = 'Entrez votre nom utilisateur et votre mot de passe.';
      return;
    }

    if (this.mode === 'signup' && !trimmedDisplayName) {
      this.errorMessage = 'Entrez le nom qui sera affiche dans la galerie.';
      return;
    }

    if (this.mode === 'signup' && trimmedPassword !== this.confirmPassword.trim()) {
      this.errorMessage = 'Les mots de passe ne correspondent pas.';
      return;
    }

    this.isLoading = true;

    try {
      const currentUser = this.mode === 'signup'
        ? await this.supabaseService.signUpWithUsername({
            username: trimmedUsername,
            displayName: trimmedDisplayName,
            password: trimmedPassword
          })
        : await this.supabaseService.signInWithUsername(trimmedUsername, trimmedPassword);

      this.storeSession(currentUser);
      await this.albumService.refreshSharedAlbums();
      this.router.navigate(['/gallery']);
    } catch (error) {
      this.errorMessage = error instanceof Error
        ? error.message
        : 'Connexion impossible pour le moment.';
    } finally {
      this.isLoading = false;
    }
  }

  setMode(mode: AuthMode): void {
    if (this.mode === mode) {
      return;
    }

    this.mode = mode;
    this.errorMessage = '';
    this.infoMessage = '';
    this.password = '';
    this.confirmPassword = '';
  }

  get normalizedUsernamePreview(): string {
    const normalized = this.supabaseService.normalizeUsername(this.username);
    return normalized ? `@${normalized}` : '';
  }

  private storeSession(user: AppUser): void {
    sessionStorage.setItem('currentUserId', user.id);
    sessionStorage.setItem('currentGuest', user.displayName);
    sessionStorage.setItem('currentUsername', user.username);
    sessionStorage.setItem('currentAlbumId', user.albumId);
    sessionStorage.setItem('currentAvatarUrl', user.avatarUrl || '');
    sessionStorage.setItem('isAdmin', String(user.role === 'admin'));
  }

  private clearSession(): void {
    sessionStorage.removeItem('currentUserId');
    sessionStorage.removeItem('currentGuest');
    sessionStorage.removeItem('currentUsername');
    sessionStorage.removeItem('currentAlbumId');
    sessionStorage.removeItem('currentAvatarUrl');
    sessionStorage.removeItem('isAdmin');
    sessionStorage.removeItem('adminPassword');
  }
}
