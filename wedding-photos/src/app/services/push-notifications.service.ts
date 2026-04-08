import { Injectable } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { I18nService } from './i18n.service';
import { SupabaseService } from './supabase.service';

export interface PushNotificationState {
  supported: boolean;
  enabled: boolean;
  permission: NotificationPermission | 'unsupported';
  loading: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PushNotificationsService {
  private readonly stateSubject = new BehaviorSubject<PushNotificationState>({
    supported: false,
    enabled: false,
    permission: this.getPermissionState(),
    loading: false
  });

  readonly state$ = this.stateSubject.asObservable();

  constructor(
    private swPush: SwPush,
    private supabaseService: SupabaseService,
    private router: Router,
    private i18n: I18nService
  ) {
    if (this.swPush.isEnabled) {
      this.swPush.notificationClicks.subscribe(({ notification }) => {
        const url = notification?.data?.url || '/profile';
        void this.router.navigateByUrl(url);
      });
    }
  }

  get snapshot(): PushNotificationState {
    return this.stateSubject.value;
  }

  async refreshState(): Promise<void> {
    const supported = this.isSupported();
    if (!supported) {
      this.stateSubject.next({
        supported: false,
        enabled: false,
        permission: 'unsupported',
        loading: false
      });
      return;
    }

    const subscription = await firstValueFrom(this.swPush.subscription);
    this.stateSubject.next({
      supported: true,
      enabled: Boolean(subscription),
      permission: this.getPermissionState(),
      loading: false
    });
  }

  async enablePushNotifications(): Promise<void> {
    if (this.requiresIosHomeScreenInstall()) {
      throw new Error(this.i18n.t('profile.pushIosHomeScreenRequired'));
    }

    if (!this.isSupported()) {
      throw new Error(this.i18n.t('profile.pushUnsupported'));
    }

    this.setLoading(true);

    try {
      const publicKey = await this.fetchPublicKey();
      const subscription = await this.swPush.requestSubscription({
        serverPublicKey: publicKey
      });

      const json = subscription.toJSON();
      const p256dh = json.keys?.['p256dh'] || '';
      const auth = json.keys?.['auth'] || '';

      if (!json.endpoint || !p256dh || !auth) {
        throw new Error(this.i18n.t('profile.pushEnableError'));
      }

      await this.supabaseService.upsertPushSubscription({
        endpoint: json.endpoint,
        p256dh,
        auth,
        userAgent: navigator.userAgent || ''
      });

      await this.refreshState();
    } catch (error) {
      this.setLoading(false);
      throw this.toFriendlyError(error);
    }
  }

  async disablePushNotifications(): Promise<void> {
    if (!this.isSupported()) {
      return;
    }

    this.setLoading(true);

    try {
      const subscription = await firstValueFrom(this.swPush.subscription);
      if (subscription) {
        await this.supabaseService.deletePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }

      await this.refreshState();
    } catch (error) {
      this.setLoading(false);
      throw this.toFriendlyError(error);
    }
  }

  private async fetchPublicKey(): Promise<string> {
    const response = await fetch('/api/push-public-key');
    const rawText = await response.text();
    let data: any = {};

    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch {
        data = {};
      }
    }

    if (!response.ok || !data?.publicKey) {
      throw new Error(data?.error?.message || this.i18n.t('profile.pushEnableError'));
    }

    return data.publicKey;
  }

  private isSupported(): boolean {
    return this.swPush.isEnabled
      && typeof window !== 'undefined'
      && typeof navigator !== 'undefined'
      && 'serviceWorker' in navigator
      && 'PushManager' in window
      && 'Notification' in window;
  }

  private requiresIosHomeScreenInstall(): boolean {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return false;
    }

    const userAgent = navigator.userAgent || '';
    const isIos = /iphone|ipad|ipod/i.test(userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (typeof (navigator as Navigator & { standalone?: boolean }).standalone === 'boolean'
        && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));

    return isIos && !isStandalone;
  }

  private getPermissionState(): NotificationPermission | 'unsupported' {
    if (typeof Notification === 'undefined') {
      return 'unsupported';
    }

    return Notification.permission;
  }

  private setLoading(loading: boolean): void {
    const current = this.stateSubject.value;
    this.stateSubject.next({
      ...current,
      loading
    });
  }

  private toFriendlyError(error: unknown): Error {
    if (error instanceof Error) {
      if (error.name === 'NotAllowedError' || this.getPermissionState() === 'denied') {
        return new Error(this.i18n.t('profile.pushPermissionDenied'));
      }

      return error;
    }

    return new Error(this.i18n.t('profile.pushEnableError'));
  }
}
