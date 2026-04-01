import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InstallDevice, PwaService } from '../../services/pwa.service';

type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

@Component({
  selector: 'app-pwa-install',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="showInstallPrompt" class="install-layer">
      <div class="install-layer__backdrop" (click)="dismissPrompt()" aria-hidden="true"></div>

      <aside class="install-sheet" role="dialog" aria-modal="true" aria-label="Installer l application">
        <div class="install-sheet__logo-wrap">
          <img class="install-sheet__logo" src="assets/icons/KG_logo.png" alt="Kevin et Gabriella" />
        </div>

        <div class="install-sheet__copy">
          <p class="install-sheet__eyebrow">Application</p>
          <p class="install-sheet__question">Quel appareil utilisez-vous ?</p>

          <div class="install-sheet__devices" role="group" aria-label="Type d appareil">
            <button
              type="button"
              class="install-sheet__device"
              [class.install-sheet__device--active]="selectedDevice === 'iphone'"
              (click)="selectDevice('iphone')"
            >
              iPhone
            </button>
            <button
              type="button"
              class="install-sheet__device"
              [class.install-sheet__device--active]="selectedDevice === 'samsung'"
              (click)="selectDevice('samsung')"
            >
              Samsung
            </button>
            <button
              type="button"
              class="install-sheet__device"
              [class.install-sheet__device--active]="selectedDevice === 'android'"
              (click)="selectDevice('android')"
            >
              Android
            </button>
            <button
              type="button"
              class="install-sheet__device"
              [class.install-sheet__device--active]="selectedDevice === 'other'"
              (click)="selectDevice('other')"
            >
              Autre
            </button>
          </div>

          <h3>{{ installTitle }}</h3>
          <p>{{ installMessage }}</p>

          <ol class="install-sheet__steps">
            <li *ngFor="let step of installSteps">{{ step }}</li>
          </ol>

          <p *ngIf="showPromptFallback" class="install-sheet__hint">
            Si rien ne s affiche, ouvrez le menu du navigateur puis ajoutez l app a l ecran d accueil.
          </p>
        </div>

        <div class="install-sheet__actions">
          <button *ngIf="showNativeInstallButton" type="button" class="install-sheet__primary" (click)="installApp()">
            Installer
          </button>
          <button *ngIf="!showNativeInstallButton" type="button" class="install-sheet__primary" (click)="dismissPrompt()">
            Compris
          </button>
          <button type="button" class="install-sheet__secondary" (click)="dismissPrompt()">
            Plus tard
          </button>
        </div>
      </aside>
    </div>
  `,
  styles: [`
    .install-layer {
      position: fixed;
      inset: 0;
      z-index: 1600;
      display: grid;
      align-items: end;
      padding: 16px;
      overscroll-behavior: contain;
    }

    .install-layer__backdrop {
      position: absolute;
      inset: 0;
      background: rgba(22, 14, 15, 0.42);
      backdrop-filter: blur(6px);
    }

    .install-sheet {
      position: relative;
      z-index: 1;
      width: min(100%, 28rem);
      margin: 0 auto;
      display: grid;
      gap: 14px;
      padding: 18px;
      border-radius: 24px;
      border: 1px solid rgba(126, 88, 78, 0.14);
      background: rgba(255, 251, 247, 0.96);
      box-shadow: 0 24px 54px rgba(55, 36, 39, 0.22);
      backdrop-filter: blur(16px);
    }

    .install-sheet__logo-wrap {
      display: flex;
      justify-content: center;
    }

    .install-sheet__logo {
      width: 5.5rem;
      height: auto;
      object-fit: contain;
    }

    .install-sheet__copy {
      text-align: center;
    }

    .install-sheet__eyebrow {
      margin: 0 0 8px;
      color: #bd7869;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.18rem;
      text-transform: uppercase;
    }

    .install-sheet__question {
      margin: 0 0 12px;
      color: #412d2f;
      font-size: 0.92rem;
      font-weight: 700;
    }

    .install-sheet__devices {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-bottom: 14px;
    }

    .install-sheet__device {
      border: 1px solid rgba(126, 88, 78, 0.16);
      border-radius: 999px;
      padding: 11px 12px;
      background: rgba(255, 255, 255, 0.76);
      color: #412d2f;
      font-size: 0.9rem;
      font-weight: 700;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
    }

    .install-sheet__device--active {
      background: rgba(130, 81, 86, 0.12);
      border-color: rgba(130, 81, 86, 0.28);
      box-shadow: 0 12px 24px rgba(130, 81, 86, 0.14);
    }

    .install-sheet__copy h3 {
      margin: 0;
      color: #412d2f;
      font-size: 1.25rem;
      line-height: 1.1;
    }

    .install-sheet__copy p {
      margin: 10px 0 0;
      color: #725a5c;
      font-size: 0.95rem;
      line-height: 1.6;
    }

    .install-sheet__steps {
      margin: 12px 0 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 8px;
    }

    .install-sheet__steps li {
      padding: 10px 12px;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.74);
      color: #412d2f;
      font-size: 0.9rem;
      font-weight: 600;
    }

    .install-sheet__hint {
      margin: 12px 0 0;
      font-size: 0.84rem;
      color: #725a5c;
    }

    .install-sheet__actions {
      display: grid;
      gap: 10px;
    }

    .install-sheet__primary,
    .install-sheet__secondary {
      border: 0;
      border-radius: 999px;
      padding: 14px 18px;
      font-size: 0.96rem;
      font-weight: 700;
      cursor: pointer;
    }

    .install-sheet__primary {
      color: #fff9f6;
      background: linear-gradient(135deg, #825156, #bd7869);
      box-shadow: 0 16px 32px rgba(130, 81, 86, 0.24);
    }

    .install-sheet__secondary {
      background: rgba(255, 255, 255, 0.78);
      color: #412d2f;
      border: 1px solid rgba(126, 88, 78, 0.14);
    }

    @media (min-width: 720px) {
      .install-layer {
        justify-items: end;
        padding: 24px;
      }

      .install-sheet {
        width: min(24rem, calc(100vw - 48px));
        margin: 0;
      }
    }
  `]
})
export class PwaInstallComponent implements OnInit, OnDestroy {
  showInstallPrompt = false;
  selectedDevice: InstallDevice = 'other';
  private hasChosenDevice = false;
  private scrollLockActive = false;
  private lockedScrollY = 0;
  private previousHtmlOverflow = '';
  private previousBodyOverflow = '';
  private previousBodyPosition = '';
  private previousBodyTop = '';
  private previousBodyWidth = '';
  private previousBodyLeft = '';
  private previousBodyRight = '';

  constructor(private pwaService: PwaService) {}

  ngOnInit(): void {
    window.addEventListener('beforeinstallprompt', this.handleBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', this.handleAppInstalled);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.syncState();
  }

  ngOnDestroy(): void {
    window.removeEventListener('beforeinstallprompt', this.handleBeforeInstallPrompt as EventListener);
    window.removeEventListener('appinstalled', this.handleAppInstalled);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.syncScrollLock();
  }

  async installApp(): Promise<void> {
    try {
      await this.pwaService.install();
      this.showInstallPrompt = false;
      this.syncScrollLock();
    } catch (error) {
      console.error('Erreur lors de l installation:', error);
    }
  }

  dismissPrompt(): void {
    this.pwaService.dismissInstallPrompt();
    this.showInstallPrompt = false;
    this.syncScrollLock();
  }

  selectDevice(device: InstallDevice): void {
    this.selectedDevice = device;
    this.hasChosenDevice = true;
  }

  get installTitle(): string {
    switch (this.selectedDevice) {
      case 'iphone':
        return 'Installer sur iPhone';
      case 'samsung':
        return 'Installer sur Samsung';
      case 'android':
        return 'Installer sur Android';
      default:
        return 'Installer l application';
    }
  }

  get installMessage(): string {
    switch (this.selectedDevice) {
      case 'iphone':
        return 'Ajoutez l app a votre ecran d accueil depuis Safari pour la lancer comme une vraie application.';
      case 'samsung':
        return this.showNativeInstallButton
          ? 'Utilisez le bouton Installer. Si votre navigateur ne propose rien, passez par le menu de Chrome ou Samsung Internet.'
          : 'Depuis Chrome ou Samsung Internet, ajoutez l app a votre ecran d accueil.';
      case 'android':
        return this.showNativeInstallButton
          ? 'Utilisez le bouton Installer pour ajouter l app a votre ecran d accueil.'
          : 'Depuis le menu du navigateur Android, ajoutez l app a votre ecran d accueil.';
      default:
        return 'Ajoutez l app a votre ecran d accueil pour l utiliser comme une vraie application mobile.';
    }
  }

  get installSteps(): string[] {
    switch (this.selectedDevice) {
      case 'iphone':
        return [
          'Ouvrez le menu Partager de Safari',
          'Touchez Sur l ecran d accueil',
          'Validez pour ajouter l app'
        ];
      case 'samsung':
        return this.showNativeInstallButton
          ? [
              'Touchez Installer ci-dessous',
              'Validez l ajout de l application',
              'Ouvrez ensuite l app depuis votre ecran d accueil'
            ]
          : [
              'Ouvrez le menu de Chrome ou Samsung Internet',
              'Touchez Installer l application ou Ajouter a l ecran d accueil',
              'Validez l ajout sur votre telephone'
            ];
      case 'android':
        return this.showNativeInstallButton
          ? [
              'Touchez Installer ci-dessous',
              'Confirmez l installation',
              'Lancez ensuite l app depuis votre ecran d accueil'
            ]
          : [
              'Ouvrez le menu du navigateur',
              'Touchez Ajouter a l ecran d accueil',
              'Validez l ajout sur votre telephone'
            ];
      default:
        return [
          'Ouvrez le menu de votre navigateur',
          'Choisissez Ajouter a l ecran d accueil ou Installer l application',
          'Validez pour retrouver l app sur votre telephone'
        ];
    }
  }

  get showNativeInstallButton(): boolean {
    return this.selectedDevice !== 'iphone' && this.pwaService.canInstall();
  }

  get showPromptFallback(): boolean {
    return this.selectedDevice !== 'iphone' && this.showNativeInstallButton;
  }

  private syncState(): void {
    if (this.pwaService.isStandalone() || this.pwaService.hasDismissedInstallPrompt()) {
      this.showInstallPrompt = false;
      this.syncScrollLock();
      return;
    }

    if (!this.hasChosenDevice) {
      this.selectedDevice = this.pwaService.detectInstallDevice();
    }

    if (this.pwaService.shouldShowInstallGuide() || this.pwaService.canInstall()) {
      this.showInstallPrompt = true;
      this.syncScrollLock();
      return;
    }

    this.showInstallPrompt = false;
    this.syncScrollLock();
  }

  private handleBeforeInstallPrompt = (event: Event): void => {
    event.preventDefault();
    this.pwaService.setPromptEvent(event as DeferredInstallPrompt);
    this.syncState();
  };

  private handleAppInstalled = (): void => {
    this.showInstallPrompt = false;
    this.syncScrollLock();
  };

  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      this.syncState();
    }
  };

  private syncScrollLock(): void {
    if (this.showInstallPrompt && !this.scrollLockActive) {
      this.lockedScrollY = window.scrollY;
      this.previousHtmlOverflow = document.documentElement.style.overflow;
      this.previousBodyOverflow = document.body.style.overflow;
      this.previousBodyPosition = document.body.style.position;
      this.previousBodyTop = document.body.style.top;
      this.previousBodyWidth = document.body.style.width;
      this.previousBodyLeft = document.body.style.left;
      this.previousBodyRight = document.body.style.right;

      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${this.lockedScrollY}px`;
      document.body.style.width = '100%';
      document.body.style.left = '0';
      document.body.style.right = '0';
      this.scrollLockActive = true;
      return;
    }

    if (!this.showInstallPrompt && this.scrollLockActive) {
      document.documentElement.style.overflow = this.previousHtmlOverflow;
      document.body.style.overflow = this.previousBodyOverflow;
      document.body.style.position = this.previousBodyPosition;
      document.body.style.top = this.previousBodyTop;
      document.body.style.width = this.previousBodyWidth;
      document.body.style.left = this.previousBodyLeft;
      document.body.style.right = this.previousBodyRight;
      window.scrollTo(0, this.lockedScrollY);
      this.scrollLockActive = false;
    }
  }
}
