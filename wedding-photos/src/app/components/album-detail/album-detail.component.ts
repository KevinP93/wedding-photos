import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { AlbumService, Album, Photo } from '../../services/album.service';
import { CloudinaryService } from '../../services/cloudinary.service';
import { PwaService } from '../../services/pwa.service';
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
export class AlbumDetailComponent implements OnInit, OnDestroy {
  album?: Album;
  currentUserId = '';
  currentGuest = '';
  currentUsername = '';
  currentAlbumId = '';
  currentAvatarUrl = '';
  isAdmin = false;
  adminMessage = '';
  viewerHint = '';
  selectedIndex = -1;
  viewerHeartPhotoId = '';
  selectionMode = false;
  isDownloadingSelection = false;
  selectionMessage = '';
  selectionError = '';
  private readonly selectedPhotoIds = new Set<string>();
  private selectionDragActive = false;
  private selectionDragShouldSelect = false;
  private readonly selectionDragVisitedPhotoIds = new Set<string>();
  private touchStartX = 0;
  private touchStartY = 0;
  private lastTapTimestamp = 0;
  private lastTapPhotoId = '';
  private readonly preservedGridPhotoIds = new Set<string>();
  private albumSubscription?: Subscription;

  constructor(
    private albumService: AlbumService,
    private router: Router,
    private route: ActivatedRoute,
    private cloudinaryService: CloudinaryService,
    private pwaService: PwaService,
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
      return;
    }

    this.albumSubscription = this.albumService.albums$.subscribe(albums => {
      const nextAlbum = albums.find(item => item.id === albumId);
      if (!nextAlbum) {
        this.router.navigate(['/gallery']);
        return;
      }

      const selectedPhotoId = this.selectedPhoto?.id || '';
      const availablePhotoIds = new Set(nextAlbum.photos.map(photo => photo.id));

      for (const photoId of Array.from(this.selectedPhotoIds)) {
        if (!availablePhotoIds.has(photoId)) {
          this.selectedPhotoIds.delete(photoId);
        }
      }

      this.album = nextAlbum;

      if (!nextAlbum.photos.length && this.selectionMode) {
        this.toggleSelectionMode();
      }

      if (!selectedPhotoId) {
        return;
      }

      const nextSelectedIndex = nextAlbum.photos.findIndex(photo => photo.id === selectedPhotoId);
      if (nextSelectedIndex === -1) {
        this.closeViewer();
        return;
      }

      this.selectedIndex = nextSelectedIndex;
    });
  }

  ngOnDestroy(): void {
    this.albumSubscription?.unsubscribe();
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

  @HostListener('document:pointerup')
  @HostListener('document:pointercancel')
  stopSelectionDrag(): void {
    this.selectionDragActive = false;
    this.selectionDragVisitedPhotoIds.clear();
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
      console.error('Erreur lors de la déconnexion:', error);
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

  hasPhotos(): boolean {
    return Boolean(this.album?.photos.length);
  }

  getSelectedPhotoCount(): number {
    return this.selectedPhotoIds.size;
  }

  isPhotoSelected(photo: Photo): boolean {
    return this.selectedPhotoIds.has(photo.id);
  }

  areAllPhotosSelected(): boolean {
    return Boolean(this.album?.photos.length) && this.selectedPhotoIds.size === this.album?.photos.length;
  }

  toggleSelectionMode(): void {
    this.selectionMode = !this.selectionMode;
    this.selectionMessage = '';
    this.selectionError = '';
    this.selectedPhotoIds.clear();
    this.stopSelectionDrag();

    if (this.selectionMode) {
      this.closeViewer();
    }
  }

  toggleSelectAllPhotos(): void {
    if (!this.album) {
      return;
    }

    if (this.areAllPhotosSelected()) {
      this.selectedPhotoIds.clear();
      return;
    }

    this.selectedPhotoIds.clear();
    this.album.photos.forEach(photo => this.selectedPhotoIds.add(photo.id));
  }

  onMediaCardClick(index: number, photo: Photo, event?: Event): void {
    if (this.selectionMode) {
      event?.preventDefault();
      event?.stopPropagation();
      return;
    }

    this.viewPhoto(index);
  }

  togglePhotoSelection(photo: Photo, event?: Event): void {
    event?.stopPropagation();

    if (!this.selectionMode) {
      return;
    }

    this.selectionMessage = '';
    this.selectionError = '';

    if (this.selectedPhotoIds.has(photo.id)) {
      this.selectedPhotoIds.delete(photo.id);
      return;
    }

    this.selectedPhotoIds.add(photo.id);
  }

  onSelectionPointerDown(photo: Photo, event: PointerEvent): void {
    if (!this.selectionMode) {
      return;
    }

    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    event.preventDefault();
    this.selectionMessage = '';
    this.selectionError = '';
    this.selectionDragActive = true;
    this.selectionDragShouldSelect = !this.isPhotoSelected(photo);
    this.selectionDragVisitedPhotoIds.clear();
    this.applySelectionDrag(photo);
  }

  onSelectionPointerMove(event: PointerEvent): void {
    if (!this.selectionMode || !this.selectionDragActive || !this.album) {
      return;
    }

    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-photo-id]');
    const photoId = target?.dataset['photoId'];

    if (!photoId) {
      return;
    }

    const photo = this.album.photos.find(item => item.id === photoId);
    if (!photo) {
      return;
    }

    this.applySelectionDrag(photo);
  }

  viewPhoto(index: number): void {
    this.viewerHint = '';
    this.viewerHeartPhotoId = '';
    this.selectedIndex = index;
  }

  onGridImageLoad(photoId: string, event: Event): void {
    const image = event.target as HTMLImageElement | null;
    if (!image?.naturalWidth || !image.naturalHeight) {
      return;
    }

    const aspectRatio = image.naturalWidth / image.naturalHeight;
    const shouldPreserve = aspectRatio <= 0.82 || aspectRatio >= 1.42;

    if (shouldPreserve) {
      this.preservedGridPhotoIds.add(photoId);
      return;
    }

    this.preservedGridPhotoIds.delete(photoId);
  }

  shouldPreserveGridPhoto(photo: Photo): boolean {
    return this.preservedGridPhotoIds.has(photo.id);
  }

  closeViewer(): void {
    this.viewerHint = '';
    this.viewerHeartPhotoId = '';
    this.lastTapTimestamp = 0;
    this.lastTapPhotoId = '';
    this.selectedIndex = -1;
  }

  showPrevious(): void {
    if (!this.album || this.album.photos.length < 2) {
      return;
    }

    this.viewerHint = '';
    this.viewerHeartPhotoId = '';
    this.lastTapTimestamp = 0;
    this.lastTapPhotoId = '';
    this.selectedIndex = (this.selectedIndex - 1 + this.album.photos.length) % this.album.photos.length;
  }

  showNext(): void {
    if (!this.album || this.album.photos.length < 2) {
      return;
    }

    this.viewerHint = '';
    this.viewerHeartPhotoId = '';
    this.lastTapTimestamp = 0;
    this.lastTapPhotoId = '';
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

  onViewerTouchEnd(event: TouchEvent, photo: Photo): void {
    const touch = event.changedTouches[0];
    if (!touch || !this.selectedPhoto) {
      return;
    }

    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;
    const horizontalDistance = Math.abs(deltaX);
    const verticalDistance = Math.abs(deltaY);

    if (horizontalDistance < 48 || horizontalDistance <= verticalDistance) {
      if (horizontalDistance <= 14 && verticalDistance <= 14) {
        this.handleViewerTap(photo);
      }
      return;
    }

    this.lastTapTimestamp = 0;
    this.lastTapPhotoId = '';

    if (deltaX < 0) {
      this.showNext();
      return;
    }

    this.showPrevious();
  }

  onViewerDoubleClick(photo: Photo): void {
    void this.likeFromViewerGesture(photo);
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

  async downloadSelectedPhotos(): Promise<void> {
    if (!this.album || this.selectedPhotoIds.size === 0) {
      return;
    }

    const selectedPhotos = this.album.photos.filter(photo => this.selectedPhotoIds.has(photo.id));
    if (selectedPhotos.length === 0) {
      return;
    }

    if (selectedPhotos.length === 1) {
      await this.downloadPhoto(selectedPhotos[0]);
      this.resetSelectionState();
      return;
    }

    this.isDownloadingSelection = true;
    this.selectionError = '';
    this.selectionMessage = '';

    try {
      const files = await Promise.all(selectedPhotos.map(photo => this.prepareDownloadFile(photo)));

      if (this.shouldUseNativeShareFiles(files)) {
        try {
          await navigator.share({
            files,
            title: `Photos de ${this.album.name}`
          });

          await this.recordSuccessfulDownloads(selectedPhotos);
          this.selectionMessage = this.getBulkShareHint();
          this.resetSelectionState();
          return;
        } catch (shareError) {
          if (shareError instanceof DOMException && shareError.name === 'AbortError') {
            return;
          }

          console.error('Partage multiple impossible, fallback zip.', shareError);
        }
      }

      await this.downloadPhotoArchive(files);
      await this.recordSuccessfulDownloads(selectedPhotos);
      this.selectionMessage = this.getBulkDownloadSuccessMessage(files.length);
      this.resetSelectionState();
    } catch (error) {
      console.error('Erreur lors du téléchargement multiple:', error);
      this.selectionError = 'Impossible de préparer cette sélection pour le moment.';
    } finally {
      this.isDownloadingSelection = false;
    }
  }

  async downloadPhoto(photo: Photo): Promise<void> {
    if (!this.album) {
      return;
    }

    this.viewerHint = '';

    try {
      const file = await this.prepareDownloadFile(photo);

      if (this.shouldUseNativeShareFiles([file])) {
        try {
          await navigator.share({
            files: [file],
            title: file.name
          });

          await this.recordSuccessfulDownload(photo);
          this.viewerHint = this.getNativeShareHint(photo.type);
          this.showDownloadAnimation(photo.id);
          return;
        } catch (shareError) {
          if (shareError instanceof DOMException && shareError.name === 'AbortError') {
            return;
          }

          console.error('Partage natif impossible, fallback mobile.', shareError);
        }
      }

      if (this.pwaService.isMobileDevice()) {
        this.viewerHint = this.getMobileFallbackHint(photo.type);
        window.open(photo.url, '_blank', 'noopener');
        return;
      }

      this.downloadBlob(file, file.name);
      await this.recordSuccessfulDownload(photo);
    } catch (error) {
      console.error('Téléchargement direct impossible, ouverture du média.', error);
      this.viewerHint = this.getMobileFallbackHint(photo.type);
      window.open(photo.url, '_blank', 'noopener');
      return;
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

  private async prepareDownloadFile(photo: Photo): Promise<File> {
    const downloadUrl = photo.publicId
      ? this.cloudinaryService.getDownloadUrl(photo.publicId, photo.type)
      : photo.url;
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error('Download failed');
    }

    const blob = await response.blob();
    const fileName = this.getDownloadName(photo, blob);
    return new File([blob], fileName, {
      type: blob.type || (photo.type === 'video' ? 'video/mp4' : 'image/jpeg')
    });
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

  getDownloadButtonLabel(): string {
    return this.pwaService.isMobileDevice() ? 'Enregistrer' : 'Telecharger';
  }

  getBulkDownloadButtonLabel(): string {
    if (this.isDownloadingSelection) {
      return 'Préparation...';
    }

    return 'Telecharger';
  }

  private shouldUseNativeShareFiles(files: File[]): boolean {
    const shareNavigator = navigator as Navigator & {
      canShare?: (data?: ShareData) => boolean;
    };

    if (!this.pwaService.isMobileDevice() || typeof navigator.share !== 'function') {
      return false;
    }

    return Boolean(shareNavigator.canShare?.({ files }));
  }

  private async recordSuccessfulDownload(photo: Photo): Promise<void> {
    if (!this.album) {
      return;
    }

    try {
      await this.recordDownloadCount(photo);
      this.refreshAlbum();
    } catch (error) {
      console.error('Erreur lors de la mise à jour du compteur de téléchargement:', error);
    }
  }

  private async recordSuccessfulDownloads(photos: Photo[]): Promise<void> {
    if (!this.album) {
      return;
    }

    try {
      await Promise.all(photos.map(photo => this.recordDownloadCount(photo)));
      this.refreshAlbum();
    } catch (error) {
      console.error('Erreur lors de la mise à jour des compteurs de téléchargement:', error);
    }
  }

  private async downloadPhotoArchive(files: File[]): Promise<void> {
    const JSZip = (await import('jszip')).default;
    const archive = new JSZip();

    files.forEach(file => {
      archive.file(file.name, file);
    });

    const blob = await archive.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    this.downloadBlob(blob, this.getArchiveName());
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }

  private getArchiveName(): string {
    const cleanAlbumName = (this.album?.name || 'selection')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();

    return `${cleanAlbumName || 'selection'}-photos.zip`;
  }

  private getNativeShareHint(type: 'image' | 'video'): string {
    if (this.isIosDevice()) {
      return type === 'video'
        ? 'Dans la feuille de partage iPhone, utilisez Enregistrer la vidéo.'
        : 'Dans la feuille de partage iPhone, utilisez Enregistrer l’image.';
    }

    if (this.isAndroidDevice()) {
      return type === 'video'
        ? 'Dans la feuille de partage Android, choisissez Enregistrer ou votre application vidéo.'
        : 'Dans la feuille de partage Android, choisissez Enregistrer ou votre application photo.';
    }

    return type === 'video'
      ? 'Utilisez la feuille de partage pour enregistrer la vidéo.'
      : 'Utilisez la feuille de partage pour enregistrer l’image.';
  }

  private getMobileFallbackHint(type: 'image' | 'video'): string {
    if (this.isIosDevice()) {
      return type === 'video'
        ? 'La vidéo va s’ouvrir. Ensuite utilisez Partager puis Enregistrer la vidéo.'
        : 'L’image va s’ouvrir. Ensuite utilisez Partager puis Enregistrer l’image.';
    }

    if (this.isAndroidDevice()) {
      return type === 'video'
        ? 'La vidéo va s’ouvrir. Ensuite utilisez le menu du navigateur ou Partager pour l’enregistrer.'
        : 'L’image va s’ouvrir. Ensuite utilisez le menu du navigateur ou Partager pour l’enregistrer.';
    }

    return type === 'video'
      ? 'Le fichier va s’ouvrir. Ensuite utilisez le menu du navigateur pour l’enregistrer.'
      : 'L’image va s’ouvrir. Ensuite utilisez le menu du navigateur pour l’enregistrer.';
  }

  private getBulkShareHint(): string {
    if (this.isIosDevice()) {
      return 'Dans la feuille de partage iPhone, enregistrez les photos sélectionnées.';
    }

    if (this.isAndroidDevice()) {
      return 'Dans la feuille de partage Android, enregistrez les photos sélectionnées.';
    }

    return 'Utilisez la feuille de partage pour enregistrer votre sélection.';
  }

  private getBulkDownloadSuccessMessage(count: number): string {
    if (this.pwaService.isMobileDevice()) {
      return `${count} photos ont été préparées ensemble.`;
    }

    return `${count} photos ont été téléchargées dans une archive.`;
  }

  private isIosDevice(): boolean {
    const userAgent = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent)
      || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  }

  private isAndroidDevice(): boolean {
    return window.navigator.userAgent.toLowerCase().includes('android');
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

  private handleViewerTap(photo: Photo): void {
    const now = Date.now();
    const isSamePhoto = this.lastTapPhotoId === photo.id;
    const isDoubleTap = isSamePhoto && now - this.lastTapTimestamp <= 280;

    this.lastTapTimestamp = now;
    this.lastTapPhotoId = photo.id;

    if (!isDoubleTap) {
      return;
    }

    this.lastTapTimestamp = 0;
    this.lastTapPhotoId = '';
    void this.likeFromViewerGesture(photo);
  }

  private async likeFromViewerGesture(photo: Photo): Promise<void> {
    if (this.isLiked(photo)) {
      this.showViewerHeart(photo.id);
      return;
    }

    await this.toggleLike(photo);
    this.showViewerHeart(photo.id);
  }

  private showViewerHeart(photoId: string): void {
    this.viewerHeartPhotoId = photoId;
    setTimeout(() => {
      if (this.viewerHeartPhotoId === photoId) {
        this.viewerHeartPhotoId = '';
      }
    }, 720);
  }

  private applySelectionDrag(photo: Photo): void {
    if (this.selectionDragVisitedPhotoIds.has(photo.id)) {
      return;
    }

    this.selectionDragVisitedPhotoIds.add(photo.id);

    if (this.selectionDragShouldSelect) {
      this.selectedPhotoIds.add(photo.id);
      return;
    }

    this.selectedPhotoIds.delete(photo.id);
  }

  private async recordDownloadCount(photo: Photo): Promise<void> {
    if (!this.album) {
      return;
    }

    await this.albumService.incrementDownloadCount(this.album.id, photo.id);
  }

  private resetSelectionState(): void {
    this.selectionMode = false;
    this.selectedPhotoIds.clear();
    this.stopSelectionDrag();
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
