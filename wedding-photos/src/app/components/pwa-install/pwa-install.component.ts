import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PwaService } from '../../services/pwa.service';

type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

@Component({
  selector: 'app-pwa-install',
  standalone: true,
  imports: [CommonModule],
  template: `
    <aside *ngIf="showInstallPrompt" class="install-sheet" role="dialog" aria-label="Installer l'application">
      <div class="install-sheet__logo-wrap">
        <img class="install-sheet__logo" src="assets/icons/KG_logo.png" alt="Kevin et Gabriella" />
      </div>

      <div class="install-sheet__copy">
        <p class="install-sheet__eyebrow">Application</p>
        <h3>{{ isIosFlow ? 'Installer sur iPhone' : 'Installer l application' }}</h3>
        <p *ngIf="!isIosFlow">Ajoutez l app a votre ecran d accueil pour l utiliser comme une vraie app.</p>
        <p *ngIf="isIosFlow">Dans Safari, touchez Partager puis Sur l ecran d accueil.</p>
        <ol *ngIf="isIosFlow" class="install-sheet__steps">
          <li>Ouvrez le menu Partager de Safari</li>
          <li>Touchez Sur l ecran d accueil</li>
          <li>Ajoutez l app a votre iPhone</li>
        </ol>
      </div>

      <div class="install-sheet__actions">
        <button *ngIf="!isIosFlow" type="button" class="install-sheet__primary" (click)="installApp()">
          Installer
        </button>
        <button *ngIf="isIosFlow" type="button" class="install-sheet__primary" (click)="dismissPrompt()">
          Compris
        </button>
        <button type="button" class="install-sheet__secondary" (click)="dismissPrompt()">
          Plus tard
        </button>
      </div>
    </aside>
  `,
  styles: [`
    .install-sheet {
      position: fixed;
      right: 16px;
      bottom: calc(env(safe-area-inset-bottom) + 16px);
      left: 16px;
      z-index: 1400;
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
      .install-sheet {
        left: auto;
        width: min(24rem, calc(100vw - 32px));
      }
    }
  `]
})
export class PwaInstallComponent implements OnInit, OnDestroy {
  showInstallPrompt = false;
  isIosFlow = false;

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
  }

  async installApp(): Promise<void> {
    try {
      await this.pwaService.install();
      this.showInstallPrompt = false;
    } catch (error) {
      console.error('Erreur lors de l installation:', error);
    }
  }

  dismissPrompt(): void {
    this.pwaService.dismissInstallPrompt();
    this.showInstallPrompt = false;
  }

  private syncState(): void {
    if (this.pwaService.isStandalone() || this.pwaService.hasDismissedInstallPrompt()) {
      this.showInstallPrompt = false;
      return;
    }

    if (this.pwaService.canInstall()) {
      this.isIosFlow = false;
      this.showInstallPrompt = true;
      return;
    }

    if (this.pwaService.shouldShowIosInstallHint()) {
      this.isIosFlow = true;
      this.showInstallPrompt = true;
      return;
    }

    this.showInstallPrompt = false;
  }

  private handleBeforeInstallPrompt = (event: Event): void => {
    event.preventDefault();
    this.pwaService.setPromptEvent(event as DeferredInstallPrompt);
    this.syncState();
  };

  private handleAppInstalled = (): void => {
    this.showInstallPrompt = false;
  };

  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      this.syncState();
    }
  };
}
