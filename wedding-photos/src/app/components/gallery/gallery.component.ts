import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlbumService, Album, Photo } from '../../services/album.service';
import { CloudinaryService } from '../../services/cloudinary.service';
import { AppUser, SupabaseService } from '../../services/supabase.service';
import { buildAvatarUrl } from '../../utils/avatar';
import { MobileMenuComponent } from '../mobile-menu/mobile-menu.component';

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [CommonModule, FormsModule, MobileMenuComponent],
  templateUrl: './gallery.component.html',
  styleUrl: './gallery.component.scss'
})
export class GalleryComponent implements OnInit, OnDestroy {
  albums: Album[] = [];
  userAlbum?: Album;
  otherAlbums: Album[] = [];
  filteredOtherAlbums: Album[] = [];
  visibleOtherAlbums: Album[] = [];
  featuredAlbumId = '';
  searchQuery = '';
  currentPage = 1;
  totalPages = 1;
  pageSize = 6;
  currentUserId = '';
  currentGuest = '';
  currentUsername = '';
  currentAlbumId = '';
  currentAvatarUrl = '';
  isAdmin = false;
  adminMessage = '';
  isEditingProfile = false;
  isSavingProfile = false;
  profileDisplayName = '';
  profileAvatarUrl = '';
  profileMessage = '';
  profileErrorMessage = '';
  private selectedProfileImage: File | null = null;
  private profilePreviewObjectUrl = '';

  constructor(
    private albumService: AlbumService,
    private route: ActivatedRoute,
    private router: Router,
    private cloudinaryService: CloudinaryService,
    private supabaseService: SupabaseService
  ) {}

  async ngOnInit(): Promise<void> {
    this.currentUserId = sessionStorage.getItem('currentUserId') || '';
    this.currentGuest = sessionStorage.getItem('currentGuest') || '';
    this.currentUsername = sessionStorage.getItem('currentUsername') || '';
    this.currentAlbumId = sessionStorage.getItem('currentAlbumId') || '';
    this.currentAvatarUrl = sessionStorage.getItem('currentAvatarUrl') || '';
    this.isAdmin = sessionStorage.getItem('isAdmin') === 'true';

    if (!this.currentUserId || !this.currentGuest || !this.currentUsername) {
      this.clearSession();
      this.router.navigate(['/login']);
      return;
    }

    await this.albumService.ready(true);
    this.pageSize = this.getPageSizeForViewport();
    this.resetProfileForm();
    if (this.route.snapshot.queryParamMap.get('profile') === '1') {
      this.openProfileEditor();
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { profile: null },
        queryParamsHandling: 'merge',
        replaceUrl: true
      });
    }
    this.albumService.albums$.subscribe(albums => {
      this.albums = albums;
      this.refreshAlbumCollections();
    });
  }

  ngOnDestroy(): void {
    this.revokeProfilePreview();
  }

  @HostListener('window:resize')
  handleResize(): void {
    const nextPageSize = this.getPageSizeForViewport();
    if (nextPageSize === this.pageSize) {
      return;
    }

    this.pageSize = nextPageSize;
    this.currentPage = 1;
    this.refreshVisibleAlbums();
  }

  goToUpload(): void {
    this.router.navigate(['/upload']);
  }

  openProfileEditor(): void {
    this.isEditingProfile = true;
    this.profileMessage = '';
    this.profileErrorMessage = '';
    this.resetProfileForm();
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 0);
  }

  toggleProfileEditor(): void {
    this.isEditingProfile = !this.isEditingProfile;
    this.profileMessage = '';
    this.profileErrorMessage = '';

    if (this.isEditingProfile) {
      this.openProfileEditor();
      return;
    }

    this.revokeProfilePreview();
  }

  async saveProfile(): Promise<void> {
    this.profileErrorMessage = '';
    this.profileMessage = '';

    const displayName = this.profileDisplayName.trim();

    if (!displayName) {
      this.profileErrorMessage = 'Entrez votre nom.';
      return;
    }

    this.isSavingProfile = true;

    try {
      let avatarUrl = this.profileAvatarUrl || '';

      if (this.selectedProfileImage) {
        const result = await this.cloudinaryService.uploadFile(
          this.selectedProfileImage,
          `wedding-profiles/${this.currentUserId}`
        );
        avatarUrl = result.secure_url;
      }

      const updatedUser = await this.supabaseService.updateCurrentProfile({
        displayName,
        username: this.currentUsername,
        avatarUrl
      });

      this.applyCurrentUser(updatedUser);
      this.resetProfileForm();
      this.profileMessage = 'Profil mis à jour.';
      await this.albumService.refreshSharedAlbums();
    } catch (error) {
      this.profileErrorMessage = error instanceof Error
        ? error.message
        : 'Impossible de mettre à jour le profil.';
    } finally {
      this.isSavingProfile = false;
      this.revokeProfilePreview();
    }
  }

  onProfileImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.profileErrorMessage = 'Choisissez une image.';
      return;
    }

    this.profileErrorMessage = '';
    this.selectedProfileImage = file;
    this.revokeProfilePreview();
    this.profilePreviewObjectUrl = URL.createObjectURL(file);
    this.profileAvatarUrl = this.profilePreviewObjectUrl;
    if (input) {
      input.value = '';
    }
  }

  resetProfileImage(): void {
    this.selectedProfileImage = null;
    this.revokeProfilePreview();
    this.profileAvatarUrl = '';
  }

  getAvatarUrl(avatarUrl: string, displayName: string, username: string): string {
    return buildAvatarUrl(avatarUrl, displayName, username);
  }

  async logout(): Promise<void> {
    try {
      await this.supabaseService.signOut();
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    } finally {
      this.clearSession();
      this.router.navigate(['/login']);
    }
  }

  viewAlbum(album: Album): void {
    this.router.navigate(['/album', album.id]);
  }

  getPreviewPhotos(album: Album): Photo[] {
    return [...album.photos].slice(-3).reverse();
  }

  getAlbumMomentLabel(album: Album): string {
    const sourceDate = album.photos.length
      ? album.photos[album.photos.length - 1].uploadedAt
      : album.createdAt;

    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long'
    }).format(this.toDate(sourceDate));
  }

  getPhotoCount(album: Album): number {
    return album.photos.length;
  }

  getTotalPhotoCount(): number {
    return this.albums.reduce((sum, album) => sum + album.photos.length, 0);
  }

  getRegisteredGuestCount(): number {
    const guestAlbums = this.albums.filter(album => album.ownerRole !== 'admin');
    return guestAlbums.length;
  }

  getSearchResultLabel(): string {
    const count = this.filteredOtherAlbums.length;
    if (count === 0) {
      return this.searchQuery.trim() ? 'Aucun résultat' : 'Aucun album';
    }

    if (!this.searchQuery.trim()) {
      return `${count} album${count > 1 ? 's' : ''}`;
    }

    return `${count} résultat${count > 1 ? 's' : ''}`;
  }

  hasActiveSearch(): boolean {
    return this.searchQuery.trim().length > 0;
  }

  getAlbumLikeCount(album: Album): number {
    return album.photos.reduce((sum, photo) => sum + photo.likes.length, 0);
  }

  isFeaturedAlbum(album: Album): boolean {
    return album.id === this.featuredAlbumId && this.getAlbumLikeCount(album) > 0;
  }

  onSearchChange(): void {
    this.currentPage = 1;
    this.refreshVisibleAlbums();
  }

  goToPreviousPage(): void {
    if (this.currentPage <= 1) {
      return;
    }

    this.currentPage -= 1;
    this.refreshVisibleAlbums();
  }

  goToNextPage(): void {
    if (this.currentPage >= this.totalPages) {
      return;
    }

    this.currentPage += 1;
    this.refreshVisibleAlbums();
  }

  trackByAlbumId(_: number, album: Album): string {
    return album.id;
  }

  trackByPhotoId(_: number, photo: Photo): string {
    return photo.id;
  }

  async deleteAlbum(album: Album, event: Event): Promise<void> {
    event.stopPropagation();
    this.adminMessage = '';

    if (!this.isAdmin) {
      return;
    }

    if (album.photos.length === 0) {
      this.adminMessage = `L'album "${album.name}" est déjà vide.`;
      return;
    }

    const confirmed = confirm(`Vider l'album "${album.name}" ? Toutes les photos seront supprimées, mais l'album restera disponible pour l'utilisateur.`);
    if (!confirmed) {
      return;
    }

    try {
      for (const photo of [...album.photos]) {
        if (!photo.publicId) {
          await this.albumService.removePhotoFromAlbum(album.id, photo.id);
          continue;
        }

        try {
          await this.cloudinaryService.deleteImage(photo.publicId, photo.type);
        } catch (error) {
          console.error('Erreur lors de la suppression de la photo sur Cloudinary:', error);
        }

        await this.albumService.removePhotoFromAlbum(album.id, photo.id);
      }

      this.adminMessage = `L'album "${album.name}" a été vidé.`;
    } catch (error) {
      console.error('Erreur lors du vidage de l\'album:', error);
      this.adminMessage = 'Impossible de vider l\'album pour le moment.';
    }
  }

  private refreshAlbumCollections(): void {
    const sortedAlbums = [...this.albums]
      .sort((left, right) => this.compareAlbums(right, left));

    this.featuredAlbumId = this.getFeaturedAlbumId(sortedAlbums);

    if (this.isAdmin) {
      this.userAlbum = undefined;
      this.otherAlbums = sortedAlbums;
      this.refreshVisibleAlbums();
      return;
    }

    this.userAlbum = this.currentAlbumId
      ? sortedAlbums.find(album => album.id === this.currentAlbumId)
      : sortedAlbums.find(album => this.sameGuest(album.name, this.currentGuest));

    this.otherAlbums = sortedAlbums.filter(album =>
      album.id !== this.userAlbum?.id &&
      album.photos.length > 0
    );

    this.refreshVisibleAlbums();
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

  private applyCurrentUser(user: AppUser): void {
    this.currentGuest = user.displayName;
    this.currentUsername = user.username;
    this.currentAlbumId = user.albumId;
    this.currentAvatarUrl = user.avatarUrl || '';
    this.isAdmin = user.role === 'admin';
    sessionStorage.setItem('currentUserId', user.id);
    sessionStorage.setItem('currentGuest', user.displayName);
    sessionStorage.setItem('currentUsername', user.username);
    sessionStorage.setItem('currentAlbumId', user.albumId);
    sessionStorage.setItem('currentAvatarUrl', user.avatarUrl || '');
    sessionStorage.setItem('isAdmin', String(user.role === 'admin'));
  }

  private resetProfileForm(): void {
    this.selectedProfileImage = null;
    this.revokeProfilePreview();
    this.profileDisplayName = this.currentGuest;
    this.profileAvatarUrl = this.currentAvatarUrl;
  }

  private revokeProfilePreview(): void {
    if (!this.profilePreviewObjectUrl) {
      return;
    }

    URL.revokeObjectURL(this.profilePreviewObjectUrl);
    this.profilePreviewObjectUrl = '';
  }

  private sameGuest(left: string, right: string): boolean {
    return this.normalizeGuest(left) === this.normalizeGuest(right);
  }

  private normalizeGuest(name: string): string {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private getAlbumLastActivity(album: Album): Date {
    const latestPhoto = album.photos[album.photos.length - 1];
    return latestPhoto ? this.toDate(latestPhoto.uploadedAt) : this.toDate(album.createdAt);
  }

  private getFeaturedAlbumId(albums: Album[]): string {
    const featuredAlbum = albums
      .filter(album => album.ownerRole !== 'admin' && album.photos.length > 0)
      .sort((left, right) => this.compareAlbums(right, left))[0];

    return featuredAlbum?.id || '';
  }

  private compareAlbums(left: Album, right: Album): number {
    const likeGap = this.getAlbumLikeCount(left) - this.getAlbumLikeCount(right);
    if (likeGap !== 0) {
      return likeGap;
    }

    return this.getAlbumLastActivity(left).getTime() - this.getAlbumLastActivity(right).getTime();
  }

  private refreshVisibleAlbums(): void {
    const normalizedSearch = this.normalizeGuest(this.searchQuery);

    this.filteredOtherAlbums = this.otherAlbums.filter(album => {
      if (!normalizedSearch) {
        return true;
      }

      return this.normalizeGuest(album.name).includes(normalizedSearch)
        || this.normalizeGuest(album.ownerUsername).includes(normalizedSearch);
    });

    this.totalPages = Math.max(1, Math.ceil(this.filteredOtherAlbums.length / this.pageSize));
    this.currentPage = Math.min(this.currentPage, this.totalPages);

    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.visibleOtherAlbums = this.filteredOtherAlbums.slice(startIndex, startIndex + this.pageSize);
  }

  private getPageSizeForViewport(): number {
    if (window.innerWidth <= 700) {
      return 4;
    }

    if (window.innerWidth <= 1100) {
      return 6;
    }

    return 8;
  }

  private toDate(value: Date | string): Date {
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }
}
