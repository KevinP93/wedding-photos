import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AlbumService, Album, Photo } from '../../services/album.service';
import { CloudinaryService } from '../../services/cloudinary.service';
import { SupabaseService } from '../../services/supabase.service';
import { buildAvatarUrl } from '../../utils/avatar';
import { MobileMenuComponent } from '../mobile-menu/mobile-menu.component';

@Component({
  selector: 'app-album-detail',
  standalone: true,
  imports: [CommonModule, MobileMenuComponent],
  templateUrl: './album-detail.component.html',
  styleUrl: './album-detail.component.scss'
})
export class AlbumDetailComponent implements OnInit {
  album?: Album;
  currentUserId = '';
  currentGuest = '';
  currentUsername = '';
  currentAlbumId = '';
  currentAvatarUrl = '';
  isAdmin = false;
  adminMessage = '';
  selectedIndex = -1;
  private touchStartX = 0;
  private touchStartY = 0;

  constructor(
    private albumService: AlbumService,
    private router: Router,
    private route: ActivatedRoute,
    private cloudinaryService: CloudinaryService,
    private supabaseService: SupabaseService
  ) {}

  get selectedPhoto(): Photo | undefined {
    if (!this.album || this.selectedIndex < 0 || this.selectedIndex >= this.album.photos.length) {
      return undefined;
    }

    return this.album.photos[this.selectedIndex];
  }

  async ngOnInit(): Promise<void> {
    this.currentUserId = sessionStorage.getItem('currentUserId') || '';
    this.currentGuest = sessionStorage.getItem('currentGuest') || '';
    this.currentUsername = sessionStorage.getItem('currentUsername') || '';
    this.currentAlbumId = sessionStorage.getItem('currentAlbumId') || '';
    this.currentAvatarUrl = sessionStorage.getItem('currentAvatarUrl') || '';
    this.isAdmin = sessionStorage.getItem('isAdmin') === 'true';

    if (!this.currentUserId || !this.currentGuest || !this.currentUsername) {
      this.router.navigate(['/login']);
      return;
    }

    const albumId = this.route.snapshot.paramMap.get('id');
    if (!albumId) {
      this.router.navigate(['/gallery']);
      return;
    }

    await this.albumService.ready(true);
    this.album = this.albumService.getAlbum(albumId);
    if (!this.album) {
      this.router.navigate(['/gallery']);
    }
  }

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    if (this.selectedPhoto) {
      this.closeViewer();
    }
  }

  @HostListener('document:keydown.arrowleft')
  handlePreviousShortcut(): void {
    if (this.selectedPhoto) {
      this.showPrevious();
    }
  }

  @HostListener('document:keydown.arrowright')
  handleNextShortcut(): void {
    if (this.selectedPhoto) {
      this.showNext();
    }
  }

  goBack(): void {
    this.router.navigate(['/gallery']);
  }

  goToUpload(): void {
    this.router.navigate(['/upload']);
  }

  goToProfile(): void {
    this.router.navigate(['/gallery'], { queryParams: { profile: '1' } });
  }

  async logout(): Promise<void> {
    try {
      await this.supabaseService.signOut();
    } catch (error) {
      console.error('Erreur lors de la deconnexion:', error);
    } finally {
      this.clearSession();
      this.router.navigate(['/login']);
    }
  }

  getAvatarUrl(avatarUrl: string, displayName: string, username: string): string {
    return buildAvatarUrl(avatarUrl, displayName, username);
  }

  canUploadToCurrentAlbum(): boolean {
    return Boolean(
      !this.isAdmin &&
      this.album &&
      this.album.id === this.currentAlbumId
    );
  }

  canDeleteFromCurrentAlbum(): boolean {
    return Boolean(
      this.album &&
      (this.isAdmin || this.album.id === this.currentAlbumId)
    );
  }

  viewPhoto(index: number): void {
    this.selectedIndex = index;
  }

  closeViewer(): void {
    this.selectedIndex = -1;
  }

  showPrevious(): void {
    if (!this.album || this.album.photos.length < 2) {
      return;
    }

    this.selectedIndex = (this.selectedIndex - 1 + this.album.photos.length) % this.album.photos.length;
  }

  showNext(): void {
    if (!this.album || this.album.photos.length < 2) {
      return;
    }

    this.selectedIndex = (this.selectedIndex + 1) % this.album.photos.length;
  }

  onViewerBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeViewer();
    }
  }

  onViewerTouchStart(event: TouchEvent): void {
    const touch = event.changedTouches[0];
    if (!touch) {
      return;
    }

    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
  }

  onViewerTouchEnd(event: TouchEvent): void {
    const touch = event.changedTouches[0];
    if (!touch || !this.selectedPhoto) {
      return;
    }

    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;
    const horizontalDistance = Math.abs(deltaX);
    const verticalDistance = Math.abs(deltaY);

    if (horizontalDistance < 48 || horizontalDistance <= verticalDistance) {
      return;
    }

    if (deltaX < 0) {
      this.showNext();
      return;
    }

    this.showPrevious();
  }

  async deletePhoto(photo: Photo, event?: Event): Promise<void> {
    event?.stopPropagation();

    if (!this.album || !this.canDeleteFromCurrentAlbum()) {
      return;
    }

    const confirmed = confirm('Supprimer cette photo ?');
    if (!confirmed) {
      return;
    }

    try {
      if (photo.publicId) {
        try {
          await this.cloudinaryService.deleteImage(photo.publicId, photo.type);
        } catch (error) {
          console.error('Erreur lors de la suppression de la photo sur Cloudinary:', error);
        }
      }

      await this.albumService.removePhotoFromAlbum(this.album.id, photo.id);
      this.refreshAlbum();

      if (!this.album) {
        this.router.navigate(['/gallery']);
        return;
      }

      if (this.album.photos.length === 0) {
        this.closeViewer();
      } else if (this.selectedIndex >= this.album.photos.length) {
        this.selectedIndex = this.album.photos.length - 1;
      }

      this.adminMessage = 'Photo supprimee.';
    } catch (error) {
      console.error('Erreur lors de la suppression de la photo:', error);
      this.adminMessage = 'Impossible de supprimer cette photo pour le moment.';
    }
  }

  async toggleLike(photo: Photo): Promise<void> {
    if (!this.album) {
      return;
    }

    try {
      const isLiked = await this.albumService.toggleLike(this.album.id, photo.id);
      this.refreshAlbum();

      if (isLiked) {
        this.showLikeAnimation(photo.id);
      }
    } catch (error) {
      console.error('Erreur lors du like:', error);
    }
  }

  async downloadPhoto(photo: Photo): Promise<void> {
    if (!this.album) {
      return;
    }

    try {
      await this.albumService.incrementDownloadCount(this.album.id, photo.id);
      this.refreshAlbum();
    } catch (error) {
      console.error('Erreur lors de la mise a jour du compteur de telechargement:', error);
    }

    try {
      const downloadUrl = photo.publicId
        ? this.cloudinaryService.getDownloadUrl(photo.publicId, photo.type)
        : photo.url;
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = this.getDownloadName(photo, blob);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (error) {
      console.error('Telechargement direct impossible, ouverture du media.', error);
      window.open(photo.url, '_blank', 'noopener');
    }

    this.showDownloadAnimation(photo.id);
  }

  isLiked(photo: Photo): boolean {
    return this.album
      ? this.albumService.isLikedByUser(this.album.id, photo.id, this.currentUserId)
      : false;
  }

  getPhotoStats(photo: Photo): { likes: number; downloads: number } {
    return this.album
      ? this.albumService.getPhotoStats(this.album.id, photo.id)
      : { likes: 0, downloads: 0 };
  }

  trackByPhotoId(_: number, photo: Photo): string {
    return photo.id;
  }

  private refreshAlbum(): void {
    if (!this.album) {
      return;
    }

    this.album = this.albumService.getAlbum(this.album.id);
  }

  private getDownloadName(photo: Photo, blob?: Blob): string {
    const cleanUploader = (photo.uploadedBy || 'souvenir')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();

    return `${cleanUploader || 'souvenir'}-${photo.id}.${this.getFileExtension(photo, blob)}`;
  }

  private getFileExtension(photo: Photo, blob?: Blob): string {
    const blobType = blob?.type?.toLowerCase() || '';
    if (blobType) {
      const mimeToExtension: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/heic': 'heic',
        'image/heif': 'heif',
        'image/gif': 'gif',
        'video/mp4': 'mp4',
        'video/quicktime': 'mov',
        'video/webm': 'webm'
      };

      if (mimeToExtension[blobType]) {
        return mimeToExtension[blobType];
      }
    }

    try {
      const path = new URL(photo.url).pathname;
      const match = path.match(/\.([a-z0-9]+)$/i);
      if (match) {
        return match[1].toLowerCase();
      }
    } catch {
      // Ignore and use fallback extension.
    }

    return photo.type === 'video' ? 'mp4' : 'jpg';
  }

  private showLikeAnimation(photoId: string): void {
    const element = document.querySelector(`[data-photo-id="${photoId}"] .like-btn`);
    if (!element) {
      return;
    }

    element.classList.add('liked-animation');
    setTimeout(() => {
      element.classList.remove('liked-animation');
    }, 600);
  }

  private showDownloadAnimation(photoId: string): void {
    const element = document.querySelector(`[data-photo-id="${photoId}"] .download-btn`);
    if (!element) {
      return;
    }

    element.classList.add('download-animation');
    setTimeout(() => {
      element.classList.remove('download-animation');
    }, 600);
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
