import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { PhotoTagNotification, SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly notificationsSubject = new BehaviorSubject<PhotoTagNotification[]>([]);
  private readonly unreadCountSubject = new BehaviorSubject<number>(0);
  private initialized = false;
  private currentUserId = '';
  private stopRealtimeSync: (() => void) | null = null;
  private refreshTimer: number | null = null;
  private fallbackRefreshInterval: number | null = null;
  private listenersBound = false;

  readonly notifications$ = this.notificationsSubject.asObservable();
  readonly unreadCount$ = this.unreadCountSubject.asObservable();

  constructor(private supabaseService: SupabaseService) {}

  async ready(forceRefresh = false): Promise<void> {
    const nextUserId = sessionStorage.getItem('currentUserId') || '';
    if (nextUserId !== this.currentUserId) {
      this.currentUserId = nextUserId;
      this.resetLiveSync();
    }

    this.startLiveSync();

    if (forceRefresh || !this.initialized) {
      this.initialized = true;
      await this.refresh();
    }
  }

  async refresh(): Promise<void> {
    const currentUserId = sessionStorage.getItem('currentUserId') || '';
    if (!currentUserId) {
      this.notificationsSubject.next([]);
      this.unreadCountSubject.next(0);
      return;
    }

    const notifications = await this.supabaseService.fetchNotifications(currentUserId);
    this.notificationsSubject.next(notifications);
    this.unreadCountSubject.next(notifications.filter(notification => !notification.isRead).length);
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    await this.supabaseService.markNotificationRead(notificationId);
    this.notificationsSubject.next(
      this.notificationsSubject.value.map(notification =>
        notification.id === notificationId
          ? { ...notification, isRead: true }
          : notification
      )
    );
    this.refreshUnreadCount();
  }

  async markAllAsRead(): Promise<void> {
    const currentUserId = sessionStorage.getItem('currentUserId') || '';
    if (!currentUserId) {
      return;
    }

    await this.supabaseService.markAllNotificationsRead(currentUserId);
    this.notificationsSubject.next(
      this.notificationsSubject.value.map(notification => ({
        ...notification,
        isRead: true
      }))
    );
    this.refreshUnreadCount();
  }

  private startLiveSync(): void {
    if (this.stopRealtimeSync || typeof window === 'undefined') {
      return;
    }

    if (!this.currentUserId) {
      return;
    }

    this.stopRealtimeSync = this.supabaseService.subscribeToNotificationChanges(this.currentUserId, () => {
      this.scheduleRefresh();
    });

    if (!this.listenersBound) {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
      window.addEventListener('focus', this.handleWindowFocus);
      this.listenersBound = true;
    }

    this.fallbackRefreshInterval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        this.scheduleRefresh();
      }
    }, 12000);
  }

  private readonly handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      this.scheduleRefresh();
    }
  };

  private readonly handleWindowFocus = (): void => {
    this.scheduleRefresh();
  };

  private scheduleRefresh(): void {
    if (this.refreshTimer) {
      window.clearTimeout(this.refreshTimer);
    }

    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      void this.refresh().catch(error => {
        console.error('Impossible de synchroniser les notifications :', error);
      });
    }, 250);
  }

  private refreshUnreadCount(): void {
    this.unreadCountSubject.next(
      this.notificationsSubject.value.filter(notification => !notification.isRead).length
    );
  }

  private resetLiveSync(): void {
    this.stopRealtimeSync?.();
    this.stopRealtimeSync = null;

    if (this.fallbackRefreshInterval) {
      window.clearInterval(this.fallbackRefreshInterval);
      this.fallbackRefreshInterval = null;
    }

    if (this.refreshTimer) {
      window.clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (this.listenersBound) {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      window.removeEventListener('focus', this.handleWindowFocus);
      this.listenersBound = false;
    }
  }
}
