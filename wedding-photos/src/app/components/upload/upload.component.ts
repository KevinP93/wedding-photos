import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CloudinaryService } from '../../services/cloudinary.service';
import { AlbumService, Photo } from '../../services/album.service';
import { SupabaseService, TaggableGuest } from '../../services/supabase.service';
import { NotificationService } from '../../services/notification.service';
import { I18nService } from '../../services/i18n.service';
import { MobileMenuComponent } from '../mobile-menu/mobile-menu.component';
import { LanguageSwitcherComponent } from '../language-switcher/language-switcher.component';
import { buildAvatarUrl } from '../../utils/avatar';

interface SelectedMedia {
  file: File;
  previewUrl: string;
  type: 'image' | 'video';
  taggedUserIds: string[];
  tagQuery: string;
  isTagPickerOpen: boolean;
}

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, MobileMenuComponent, LanguageSwitcherComponent],
  templateUrl: './upload.component.html',
  styleUrl: './upload.component.scss'
})
export class UploadComponent implements OnInit, OnDestroy {
  selectedFiles: SelectedMedia[] = [];
  isUploading = false;
  isDragging = false;
  uploadProgress = 0;
  selectionError = '';
  currentUserId = '';
  currentGuest = '';
  currentUsername = '';
  currentAlbumId = '';
  currentAvatarUrl = '';
  isAdmin = false;
  unreadNotificationCount = 0;
  taggableGuests: TaggableGuest[] = [];
  uploadResults: { success: number; error: number } = { success: 0, error: 0 };
  taggingWarningMessage = '';
  taggableGuestsError = '';
  private notificationSubscription?: Subscription;

  constructor(
    private cloudinaryService: CloudinaryService,
    private albumService: AlbumService,
    private supabaseService: SupabaseService,
    private notificationService: NotificationService,
    private router: Router,
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
      this.router.navigate(['/login']);
      return;
    }

    if (this.isAdmin) {
      this.router.navigate(['/gallery']);
      return;
    }

    await this.albumService.ready(true);
    await this.notificationService.ready();
    await this.loadTaggableGuests();

    this.notificationSubscription = this.notificationService.unreadCount$.subscribe(count => {
      this.unreadNotificationCount = count;
    });
  }

  ngOnDestroy(): void {
    this.notificationSubscription?.unsubscribe();
    this.clearSelectedFiles();
  }

  onFileSelected(event: Event | DragEvent): void {
    const files = this.extractFiles(event);
    if (files.length === 0) {
      return;
    }

    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    const rejectedCount = files.length - imageFiles.length;

    this.selectionError = rejectedCount > 0
      ? this.i18n.t('upload.onlyPhotosAllowed')
      : '';

    if (imageFiles.length === 0) {
      if (event.target instanceof HTMLInputElement) {
        event.target.value = '';
      }
      return;
    }

    const nextEntries: SelectedMedia[] = imageFiles.map(file => ({
      file,
      previewUrl: URL.createObjectURL(file),
      type: 'image',
      taggedUserIds: [],
      tagQuery: '',
      isTagPickerOpen: false
    }));

    this.selectedFiles = [...this.selectedFiles, ...nextEntries];
    this.isDragging = false;

    if (event.target instanceof HTMLInputElement) {
      event.target.value = '';
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();

    const currentTarget = event.currentTarget as Node | null;
    const relatedTarget = event.relatedTarget as Node | null;
    if (currentTarget && relatedTarget && currentTarget.contains(relatedTarget)) {
      return;
    }

    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    this.onFileSelected(event);
  }

  removeFile(index: number): void {
    const [removedFile] = this.selectedFiles.splice(index, 1);
    if (removedFile) {
      URL.revokeObjectURL(removedFile.previewUrl);
    }

    this.selectedFiles = [...this.selectedFiles];
  }

  clearSelectedFiles(): void {
    for (const selectedFile of this.selectedFiles) {
      URL.revokeObjectURL(selectedFile.previewUrl);
    }

    this.selectedFiles = [];
    this.selectionError = '';
    this.taggingWarningMessage = '';
  }

  async uploadFiles(): Promise<void> {
    if (this.selectedFiles.length === 0) {
      return;
    }

    this.isUploading = true;
    this.uploadProgress = 0;
    this.uploadResults = { success: 0, error: 0 };
    this.taggingWarningMessage = '';
    let taggingFailures = 0;
    let targetAlbumId = '';

    try {
      const totalFiles = this.selectedFiles.length;
      const userAlbum = await this.albumService.getCurrentUserAlbum();

      this.currentAlbumId = userAlbum.id;
      targetAlbumId = userAlbum.id;
      sessionStorage.setItem('currentAlbumId', userAlbum.id);

      for (let index = 0; index < this.selectedFiles.length; index++) {
        const selectedFile = this.selectedFiles[index];

        try {
          const result = await this.cloudinaryService.uploadFile(
            selectedFile.file,
            `wedding-photos/${userAlbum.id}`
          );

          const photo: Photo = {
            id: '',
            url: result.secure_url,
            gridUrl: '',
            viewerUrl: '',
            publicId: result.public_id,
            uploadedBy: this.currentGuest,
            uploadedByUsername: this.currentUsername,
            uploadedByAvatarUrl: this.currentAvatarUrl,
            uploadedAt: new Date(),
            type: selectedFile.type,
            likes: [],
            taggedUsers: [],
            downloadCount: 0
          };

          const insertedPhoto = await this.albumService.addPhotoToAlbum(userAlbum.id, photo);

          if (selectedFile.taggedUserIds.length > 0) {
            try {
              await this.supabaseService.tagPhotoUsers(insertedPhoto.id, selectedFile.taggedUserIds);
              try {
                await this.supabaseService.dispatchTagPushNotification(
                  insertedPhoto.id,
                  selectedFile.taggedUserIds
                );
              } catch (pushError) {
                console.error('Impossible d\'envoyer la notification push :', pushError);
              }
            } catch (error) {
              taggingFailures++;
              console.error('Erreur lors de l’identification des invités :', error);
            }
          }

          this.uploadResults.success++;
        } catch (error) {
          console.error('Erreur lors de l\'upload:', error);
          this.uploadResults.error++;
        }

        this.uploadProgress = ((index + 1) / totalFiles) * 100;
      }
    } finally {
      this.isUploading = false;
    }

    if (this.uploadResults.success > 0) {
      await this.albumService.refreshSharedAlbums();
      this.clearSelectedFiles();
      await this.router.navigate(['/album', targetAlbumId || this.currentAlbumId]);
      return;
    }

    if (taggingFailures > 0) {
      this.taggingWarningMessage = this.i18n.t('upload.taggingSaveWarning');
    }
  }

  goBack(): void {
    this.router.navigate(['/gallery']);
  }

  goToProfile(): void {
    this.router.navigate(['/profile']);
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

  getFileSize(bytes: number): string {
    if (bytes === 0) {
      return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, unitIndex);

    return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  getFileTypeLabel(selectedFile: SelectedMedia): string {
    return selectedFile.type === 'video' ? 'Video' : this.i18n.t('upload.photoLabel');
  }

  openTagPicker(selectedFile: SelectedMedia): void {
    if (this.isUploading) {
      return;
    }

    this.selectedFiles.forEach(item => {
      if (item !== selectedFile) {
        item.isTagPickerOpen = false;
      }
    });
    selectedFile.isTagPickerOpen = true;
  }

  closeTagPicker(selectedFile: SelectedMedia): void {
    window.setTimeout(() => {
      selectedFile.isTagPickerOpen = false;
    }, 120);
  }

  onTagQueryChange(selectedFile: SelectedMedia, value: string): void {
    selectedFile.tagQuery = value;
    selectedFile.isTagPickerOpen = value.trim().length > 0;
  }

  selectTaggedGuest(selectedFile: SelectedMedia, guestId: string, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    if (!selectedFile.taggedUserIds.includes(guestId)) {
      selectedFile.taggedUserIds = [...selectedFile.taggedUserIds, guestId];
    }

    selectedFile.tagQuery = '';
    selectedFile.isTagPickerOpen = false;
  }

  removeTaggedGuest(selectedFile: SelectedMedia, guestId: string, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    if (!selectedFile.taggedUserIds.includes(guestId)) {
      return;
    }

    selectedFile.taggedUserIds = selectedFile.taggedUserIds.filter(id => id !== guestId);
  }

  getTaggedGuestCount(selectedFile: SelectedMedia): number {
    return selectedFile.taggedUserIds.length;
  }

  getTaggedGuests(selectedFile: SelectedMedia): TaggableGuest[] {
    return this.taggableGuests.filter(guest => selectedFile.taggedUserIds.includes(guest.id));
  }

  getMatchingGuests(selectedFile: SelectedMedia): TaggableGuest[] {
    const normalizedQuery = this.normalizeSearchValue(selectedFile.tagQuery);
    if (!normalizedQuery) {
      return [];
    }

    return this.taggableGuests
      .filter(guest => !selectedFile.taggedUserIds.includes(guest.id))
      .filter(guest =>
        this.normalizeSearchValue(guest.displayName).includes(normalizedQuery)
        || this.normalizeSearchValue(guest.username).includes(normalizedQuery)
      )
      .slice(0, 6);
  }

  getGuestAvatarUrl(guest: TaggableGuest): string {
    return buildAvatarUrl(guest.avatarUrl, guest.displayName, guest.username);
  }

  getSelectedCountLabel(): string {
    return this.i18n.tc('counts.item', this.selectedFiles.length);
  }

  getTaggedGuestsLabel(selectedFile: SelectedMedia): string {
    return this.i18n.t('upload.identifiedGuests', {
      count: this.getTaggedGuestCount(selectedFile)
    });
  }

  getProgressLabel(): string {
    return this.i18n.t('upload.progressAlbum', { name: this.currentGuest });
  }

  getSuccessLabel(): string {
    return this.i18n.t('upload.added', { count: this.uploadResults.success });
  }

  getErrorLabel(): string {
    return this.i18n.t('upload.errors', { count: this.uploadResults.error });
  }

  private extractFiles(event: Event | DragEvent): File[] {
    if (event instanceof DragEvent && event.dataTransfer?.files?.length) {
      return Array.from(event.dataTransfer.files);
    }

    if (event.target instanceof HTMLInputElement && event.target.files?.length) {
      return Array.from(event.target.files);
    }

    return [];
  }

  private async loadTaggableGuests(): Promise<void> {
    this.taggableGuestsError = '';

    try {
      this.taggableGuests = await this.supabaseService.fetchTaggableGuests(this.currentUserId);
    } catch (error) {
      console.error('Impossible de charger les invités à identifier :', error);
      this.taggableGuests = [];
      this.taggableGuestsError = this.i18n.t('upload.taggingLoadError');
    }
  }

  private normalizeSearchValue(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
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
