import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AlbumService, Album } from '../../services/album.service';
import { CloudinaryService } from '../../services/cloudinary.service';
import { NotificationService } from '../../services/notification.service';
import {
  PhotoTagNotification,
  SupabaseService,
  TaggableGuest
} from '../../services/supabase.service';
import {
  PushNotificationState,
  PushNotificationsService
} from '../../services/push-notifications.service';
import { I18nService } from '../../services/i18n.service';
import { buildAvatarUrl } from '../../utils/avatar';
import { MobileMenuComponent } from '../mobile-menu/mobile-menu.component';
import { LanguageSwitcherComponent } from '../language-switcher/language-switcher.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, MobileMenuComponent, LanguageSwitcherComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit, OnDestroy {
  currentUserId = '';
  currentGuest = '';
  currentUsername = '';
  currentAlbumId = '';
  currentAvatarUrl = '';
  isAdmin = false;
  unreadNotificationCount = 0;
  isSavingProfile = false;
  profileDisplayName = '';
  profileAvatarUrl = '';
  profileMessage = '';
  profileErrorMessage = '';
  currentAlbum?: Album;
  notifications: PhotoTagNotification[] = [];
  pushState: PushNotificationState = {
    supported: false,
    enabled: false,
    permission: 'unsupported',
    loading: false
  };
  pushMessage = '';
  pushErrorMessage = '';
  adminTaggableGuests: TaggableGuest[] = [];
  adminAnnouncementTitle = '';
  adminAnnouncementMessage = '';
  adminAudienceMode: 'all' | 'selected' = 'all';
  adminRecipientQuery = '';
  adminRecipientIds: string[] = [];
  isAdminSending = false;
  adminMessage = '';
  adminErrorMessage = '';
  private selectedProfileImage: File | null = null;
  private profilePreviewObjectUrl = '';
  private notificationsSubscription?: Subscription;
  private unreadCountSubscription?: Subscription;
  private pushStateSubscription?: Subscription;

  constructor(
    private albumService: AlbumService,
    private cloudinaryService: CloudinaryService,
    private supabaseService: SupabaseService,
    private notificationService: NotificationService,
    private pushNotificationsService: PushNotificationsService,
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
      this.clearSession();
      this.router.navigate(['/login']);
      return;
    }

    await this.albumService.ready(true);
    await this.notificationService.ready(true);
    await this.pushNotificationsService.refreshState();

    if (this.isAdmin) {
      await this.loadAdminTaggableGuests();
    }

    this.currentAlbum = this.currentAlbumId
      ? this.albumService.getAlbum(this.currentAlbumId)
      : undefined;
    this.resetProfileForm();

    this.notificationsSubscription = this.notificationService.notifications$.subscribe(notifications => {
      this.notifications = notifications;
    });

    this.unreadCountSubscription = this.notificationService.unreadCount$.subscribe(count => {
      this.unreadNotificationCount = count;
    });

    this.pushStateSubscription = this.pushNotificationsService.state$.subscribe(state => {
      this.pushState = state;
    });
  }

  ngOnDestroy(): void {
    this.notificationsSubscription?.unsubscribe();
    this.unreadCountSubscription?.unsubscribe();
    this.pushStateSubscription?.unsubscribe();
    this.revokeProfilePreview();
  }

  goBack(): void {
    this.router.navigate(['/gallery']);
  }

  goToAlbum(): void {
    if (!this.currentAlbumId) {
      return;
    }

    this.router.navigate(['/album', this.currentAlbumId]);
  }

  goToUpload(): void {
    if (this.isAdmin) {
      return;
    }

    this.router.navigate(['/upload']);
  }

  async logout(): Promise<void> {
    try {
      await this.supabaseService.signOut();
    } catch (error) {
      console.error('Erreur lors de la déconnexion :', error);
    } finally {
      this.clearSession();
      this.router.navigate(['/login']);
    }
  }

  getAvatarUrl(avatarUrl: string, displayName: string, username: string): string {
    return buildAvatarUrl(avatarUrl, displayName, username);
  }

  getOwnPhotoCount(): number {
    return this.currentAlbum?.photos.length || 0;
  }

  getOwnLikeCount(): number {
    return (this.currentAlbum?.photos || []).reduce((sum, photo) => sum + photo.likes.length, 0);
  }

  getNotificationThumbnailUrl(notification: PhotoTagNotification): string {
    if (!notification.photoPublicId || !notification.photoUrl) {
      return 'assets/icons/KG_logo-192x192.png';
    }

    return this.cloudinaryService.getGalleryMediaUrl(
      notification.photoPublicId,
      notification.photoType,
      notification.photoUrl
    );
  }

  getNotificationActorAvatarUrl(notification: PhotoTagNotification): string {
    return buildAvatarUrl(
      notification.actorAvatarUrl,
      notification.actorDisplayName,
      notification.actorUsername
    );
  }

  getNotificationsCountLabel(): string {
    return this.i18n.tc('counts.notification', this.unreadNotificationCount);
  }

  getUsernameReadonlyLabel(): string {
    return this.i18n.t('profile.usernameReadonly', { username: this.currentUsername });
  }

  getNotificationTitle(notification: PhotoTagNotification): string {
    if (notification.type === 'admin_announcement') {
      return notification.title || this.i18n.t('profile.adminAnnouncementTitleFallback');
    }

    return notification.actorDisplayName;
  }

  getNotificationText(notification: PhotoTagNotification): string {
    if (notification.type === 'admin_announcement') {
      return notification.message || '';
    }

    return this.i18n.t('profile.notificationTagged', { name: notification.actorDisplayName });
  }

  getNotificationMeta(notification: PhotoTagNotification): string {
    if (notification.type === 'admin_announcement') {
      return this.i18n.t('profile.notificationAdminMeta');
    }

    return notification.actorDisplayName;
  }

  getPushStatusText(): string {
    if (!this.pushState.supported) {
      return this.i18n.t('profile.pushUnsupported');
    }

    if (this.pushState.loading) {
      return this.i18n.t('profile.pushBusy');
    }

    if (this.pushState.permission === 'denied') {
      return this.i18n.t('profile.pushPermissionDenied');
    }

    return this.pushState.enabled
      ? this.i18n.t('profile.pushEnabled')
      : this.i18n.t('profile.pushDisabled');
  }

  getPushActionLabel(): string {
    return this.pushState.enabled
      ? this.i18n.t('profile.pushDisable')
      : this.i18n.t('profile.pushEnable');
  }

  getAdminSelectedGuests(): TaggableGuest[] {
    return this.adminTaggableGuests.filter(guest => this.adminRecipientIds.includes(guest.id));
  }

  getAdminMatchingGuests(): TaggableGuest[] {
    const normalizedQuery = this.normalizeSearchValue(this.adminRecipientQuery);
    if (!normalizedQuery) {
      return [];
    }

    return this.adminTaggableGuests
      .filter(guest => !this.adminRecipientIds.includes(guest.id))
      .filter(guest =>
        this.normalizeSearchValue(guest.displayName).includes(normalizedQuery)
        || this.normalizeSearchValue(guest.username).includes(normalizedQuery)
      )
      .slice(0, 6);
  }

  getGuestAvatarUrl(guest: TaggableGuest): string {
    return buildAvatarUrl(guest.avatarUrl, guest.displayName, guest.username);
  }

  isAdminAudienceSelected(): boolean {
    return this.adminAudienceMode === 'selected';
  }

  trackByNotificationId(_: number, notification: PhotoTagNotification): string {
    return notification.id;
  }

  onProfileImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.profileErrorMessage = this.i18n.t('profile.error.chooseImage');
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

  async togglePushNotifications(): Promise<void> {
    this.pushMessage = '';
    this.pushErrorMessage = '';

    try {
      if (this.pushState.enabled) {
        await this.pushNotificationsService.disablePushNotifications();
        this.pushMessage = this.i18n.t('profile.pushDisabledMessage');
      } else {
        await this.pushNotificationsService.enablePushNotifications();
        this.pushMessage = this.i18n.t('profile.pushEnabledMessage');
      }
    } catch (error) {
      this.pushErrorMessage = error instanceof Error
        ? error.message
        : this.i18n.t('profile.pushEnableError');
    }
  }

  setAdminAudienceMode(mode: 'all' | 'selected'): void {
    this.adminAudienceMode = mode;
    this.adminErrorMessage = '';

    if (mode === 'all') {
      this.adminRecipientIds = [];
      this.adminRecipientQuery = '';
    }
  }

  onAdminRecipientQueryChange(value: string): void {
    this.adminRecipientQuery = value;
  }

  selectAdminRecipient(guestId: string, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    if (!this.adminRecipientIds.includes(guestId)) {
      this.adminRecipientIds = [...this.adminRecipientIds, guestId];
    }

    this.adminRecipientQuery = '';
    this.adminErrorMessage = '';
  }

  removeAdminRecipient(guestId: string, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.adminRecipientIds = this.adminRecipientIds.filter(id => id !== guestId);
  }

  async sendAdminAnnouncement(): Promise<void> {
    this.adminMessage = '';
    this.adminErrorMessage = '';

    const title = this.adminAnnouncementTitle.trim();
    const message = this.adminAnnouncementMessage.trim();

    if (!title || !message) {
      this.adminErrorMessage = this.i18n.t('profile.adminValidation');
      return;
    }

    if (this.adminAudienceMode === 'selected' && this.adminRecipientIds.length === 0) {
      this.adminErrorMessage = this.i18n.t('profile.adminRecipientRequired');
      return;
    }

    this.isAdminSending = true;

    try {
      await this.supabaseService.sendAdminAnnouncement({
        title,
        message,
        recipientUserIds: this.adminAudienceMode === 'selected'
          ? this.adminRecipientIds
          : []
      });

      this.adminAnnouncementTitle = '';
      this.adminAnnouncementMessage = '';
      this.adminRecipientIds = [];
      this.adminRecipientQuery = '';
      this.adminMessage = this.adminAudienceMode === 'selected'
        ? this.i18n.t('profile.adminSentOne')
        : this.i18n.t('profile.adminSentAll');
    } catch (error) {
      this.adminErrorMessage = error instanceof Error
        ? error.message
        : this.i18n.t('profile.adminSendError');
    } finally {
      this.isAdminSending = false;
    }
  }

  async openNotification(notification: PhotoTagNotification): Promise<void> {
    try {
      if (!notification.isRead) {
        await this.notificationService.markNotificationRead(notification.id);
      }
    } catch (error) {
      console.error('Impossible de marquer la notification comme lue :', error);
    }

    if (notification.type === 'photo_tag' && notification.albumId && notification.photoId) {
      await this.router.navigate(['/album', notification.albumId], {
        queryParams: { photo: notification.photoId }
      });
    }
  }

  async markAllNotificationsRead(): Promise<void> {
    try {
      await this.notificationService.markAllAsRead();
    } catch (error) {
      console.error('Impossible de marquer les notifications comme lues :', error);
    }
  }

  async saveProfile(): Promise<void> {
    this.profileErrorMessage = '';
    this.profileMessage = '';

    const displayName = this.profileDisplayName.trim();
    if (!displayName) {
      this.profileErrorMessage = this.i18n.t('profile.error.enterName');
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

      this.currentGuest = updatedUser.displayName;
      this.currentUsername = updatedUser.username;
      this.currentAlbumId = updatedUser.albumId;
      this.currentAvatarUrl = updatedUser.avatarUrl || '';
      this.isAdmin = updatedUser.role === 'admin';

      sessionStorage.setItem('currentUserId', updatedUser.id);
      sessionStorage.setItem('currentGuest', updatedUser.displayName);
      sessionStorage.setItem('currentUsername', updatedUser.username);
      sessionStorage.setItem('currentAlbumId', updatedUser.albumId);
      sessionStorage.setItem('currentAvatarUrl', updatedUser.avatarUrl || '');
      sessionStorage.setItem('isAdmin', String(updatedUser.role === 'admin'));

      await this.albumService.refreshSharedAlbums();
      this.currentAlbum = this.currentAlbumId
        ? this.albumService.getAlbum(this.currentAlbumId)
        : undefined;
      this.resetProfileForm();
      this.profileMessage = this.i18n.t('profile.updated');
    } catch (error) {
      this.profileErrorMessage = error instanceof Error
        ? error.message
        : this.i18n.t('profile.error.updateFailed');
    } finally {
      this.isSavingProfile = false;
      this.revokeProfilePreview();
    }
  }

  private async loadAdminTaggableGuests(): Promise<void> {
    try {
      this.adminTaggableGuests = await this.supabaseService.fetchTaggableGuests(this.currentUserId);
    } catch (error) {
      console.error('Impossible de charger les invités ciblables :', error);
      this.adminTaggableGuests = [];
    }
  }

  private normalizeSearchValue(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
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
