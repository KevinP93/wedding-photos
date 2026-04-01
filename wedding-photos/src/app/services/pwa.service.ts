import { Injectable } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, map } from 'rxjs/operators';

type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export type InstallDevice = 'iphone' | 'samsung' | 'android' | 'other';

@Injectable({
  providedIn: 'root'
})
export class PwaService {
  private promptEvent: DeferredInstallPrompt | null = null;
  private readonly dismissStorageKey = 'pwa-install-dismissed';

  constructor(private swUpdate: SwUpdate) {
    if (swUpdate.isEnabled) {
      swUpdate.versionUpdates
        .pipe(
          filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'),
          map(evt => evt.latestVersion)
        )
        .subscribe(() => {
          if (confirm('Une nouvelle version est disponible. Voulez-vous la charger ?')) {
            window.location.reload();
          }
        });
    }
  }

  canInstall(): boolean {
    return this.promptEvent !== null;
  }

  isMobileDevice(): boolean {
    const userAgent = window.navigator.userAgent.toLowerCase();
    return /android|iphone|ipad|ipod/.test(userAgent)
      || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  }

  isStandalone(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches
      || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  }

  isIosSafari(): boolean {
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent)
      || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    const isSafari = userAgent.includes('safari')
      && !userAgent.includes('crios')
      && !userAgent.includes('fxios')
      && !userAgent.includes('edgios');

    return isIosDevice && isSafari;
  }

  hasDismissedInstallPrompt(): boolean {
    return localStorage.getItem(this.dismissStorageKey) === 'true';
  }

  shouldShowIosInstallHint(): boolean {
    return this.isIosSafari() && !this.isStandalone() && !this.hasDismissedInstallPrompt();
  }

  shouldShowInstallGuide(): boolean {
    return this.isMobileDevice() && !this.isStandalone() && !this.hasDismissedInstallPrompt();
  }

  detectInstallDevice(): InstallDevice {
    if (this.isIosSafari()) {
      return 'iphone';
    }

    const userAgent = window.navigator.userAgent.toLowerCase();
    if (/sm-[a-z0-9]+|samsung/.test(userAgent)) {
      return 'samsung';
    }

    if (userAgent.includes('android')) {
      return 'android';
    }

    return 'other';
  }

  dismissInstallPrompt(): void {
    localStorage.setItem(this.dismissStorageKey, 'true');
  }

  install(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.promptEvent) {
        reject('Installation non disponible');
        return;
      }

      this.promptEvent.prompt();
      void this.promptEvent.userChoice.then((choiceResult) => {
        this.promptEvent = null;

        if (choiceResult.outcome === 'accepted') {
          resolve();
          return;
        }

        reject();
      });
    });
  }

  setPromptEvent(event: DeferredInstallPrompt): void {
    this.promptEvent = event;
  }

  checkForUpdates(): void {
    if (this.swUpdate.isEnabled) {
      void this.swUpdate.checkForUpdate();
    }
  }
}
