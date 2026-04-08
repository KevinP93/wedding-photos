import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AlbumService, Album } from '../../services/album.service';
import { CloudinaryService } from '../../services/cloudinary.service';
import { SupabaseService } from '../../services/supabase.service';
import { NotificationService } from '../../services/notification.service';
import { I18nService } from '../../services/i18n.service';
import { buildAvatarUrl } from '../../utils/avatar';
import { MobileMenuComponent } from '../mobile-menu/mobile-menu.component';
import { LanguageSwitcherComponent } from '../language-switcher/language-switcher.component';

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [CommonModule, FormsModule, MobileMenuComponent, LanguageSwitcherComponent],
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
  unreadNotificationCount = 0;
  private notificationSubscription?: Subscription;
  private albumsSubscription?: Subscription;

  constructor(
    private albumService: AlbumService,
    private router: Router,
    private cloudinaryService: CloudinaryService,
    private supabaseService: SupabaseService,
    private notificationService: NotificationService,
    public i18n: I18nService
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
    await this.notificationService.ready();
    this.pageSize = this.getPageSizeForViewport();

    this.notificationSubscription = this.notificationService.unreadCount$.subscribe(count => {
      this.unreadNotificationCount = count;
    });

    this.albumsSubscription = this.albumService.albums$.subscribe(albums => {
      this.albums = albums;
      this.refreshAlbumCollections();
    });
  }

  ngOnDestroy(): void {
    this.notificationSubscription?.unsubscribe();
    this.albumsSubscription?.unsubscribe();
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

  goToProfile(): void {
    this.router.navigate(['/profile']);
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

  getAlbumMomentLabel(album: Album): string {
    const sourceDate = album.photos.length
      ? album.photos[album.photos.length - 1].uploadedAt
      : album.createdAt;

    return new Intl.DateTimeFormat(this.i18n.currentLanguage === 'pt' ? 'pt-PT' : 'fr-FR', {
      day: 'numeric',
      month: 'long'
    }).format(this.toDate(sourceDate));
  }

  getPhotoCount(album: Album): number {
    return album.photos.length;
  }

  getPhotoCountLabel(album: Album): string {
    return this.i18n.tc('counts.photo', this.getPhotoCount(album));
  }

  getMemoryCountLabel(album: Album): string {
    return this.i18n.tc('counts.memory', this.getPhotoCount(album));
  }

  getTotalPhotoCount(): number {
    return this.albums.reduce((sum, album) => sum + album.photos.length, 0);
  }

  getRegisteredGuestCount(): number {
    return this.albums.filter(album => album.ownerRole !== 'admin').length;
  }

  getSearchResultLabel(): string {
    const count = this.filteredOtherAlbums.length;
    if (count === 0) {
      return this.searchQuery.trim()
        ? this.i18n.t('gallery.result.none')
        : this.i18n.t('gallery.result.noAlbum');
    }

    if (!this.searchQuery.trim()) {
      return this.i18n.tc('counts.album', count);
    }

    return this.i18n.tc('counts.result', count);
  }

  getAlbumKicker(album: Album, isOwnAlbum = false): string {
    if (this.isFeaturedAlbum(album)) {
      return this.i18n.t('gallery.featuredAlbum');
    }

    return isOwnAlbum
      ? this.i18n.t('gallery.personalAlbum')
      : this.i18n.t('gallery.guest');
  }

  getAlbumUpdatedLabel(album: Album, isOwnAlbum = false): string {
    return this.i18n.t(isOwnAlbum ? 'gallery.lastAddedOn' : 'gallery.updatedOn', {
      date: this.getAlbumMomentLabel(album)
    });
  }

  getPaginationLabel(): string {
    return this.i18n.t('gallery.page', {
      current: this.currentPage,
      total: this.totalPages
    });
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

  async deleteAlbum(album: Album, event: Event): Promise<void> {
    event.stopPropagation();
    this.adminMessage = '';

    if (!this.isAdmin) {
      return;
    }

    if (album.photos.length === 0) {
      this.adminMessage = this.i18n.t('gallery.admin.alreadyEmpty', { name: album.name });
      return;
    }

    const confirmed = confirm(this.i18n.t('gallery.admin.confirmEmpty', { name: album.name }));
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

      this.adminMessage = this.i18n.t('gallery.admin.emptied', { name: album.name });
    } catch (error) {
      console.error('Erreur lors du vidage de l\'album:', error);
      this.adminMessage = this.i18n.t('gallery.admin.emptyError');
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
