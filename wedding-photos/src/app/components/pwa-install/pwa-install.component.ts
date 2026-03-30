import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PwaService } from '../../services/pwa.service';

@Component({
  selector: 'app-pwa-install',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="showInstallPrompt" class="install-prompt">
      <div class="install-content">
        <div class="install-icon">📱</div>
        <div class="install-text">
          <h3>Installer l'app</h3>
          <p>Ajoutez cette app à votre écran d'accueil pour un accès rapide !</p>
        </div>
        <div class="install-buttons">
          <button class="install-btn" (click)="installApp()">Installer</button>
          <button class="dismiss-btn" (click)="dismissPrompt()">Plus tard</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .install-prompt {
      position: fixed;
      bottom: 20px;
      left: 20px;
      right: 20px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
      z-index: 1000;
      animation: slideUp 0.3s ease-out;
    }

    @keyframes slideUp {
      from {
        transform: translateY(100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    .install-content {
      display: flex;
      align-items: center;
      padding: 16px;
      gap: 12px;
    }

    .install-icon {
      font-size: 2rem;
      flex-shrink: 0;
    }

    .install-text {
      flex: 1;
    }

    .install-text h3 {
      margin: 0 0 4px 0;
      font-size: 1.1rem;
      color: #333;
    }

    .install-text p {
      margin: 0;
      font-size: 0.9rem;
      color: #666;
    }

    .install-buttons {
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }

    .install-btn, .dismiss-btn {
      padding: 8px 16px;
      border: none;
      border-radius: 8px;
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .install-btn {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .install-btn:hover {
      transform: translateY(-1px);
    }

    .dismiss-btn {
      background: #f5f5f5;
      color: #666;
    }

    .dismiss-btn:hover {
      background: #e5e5e5;
    }

    @media (max-width: 480px) {
      .install-content {
        flex-direction: column;
        text-align: center;
      }
      
      .install-buttons {
        width: 100%;
        justify-content: center;
      }
    }
  `]
})
export class PwaInstallComponent implements OnInit, OnDestroy {
  showInstallPrompt = false;
  private deferredPrompt: any;

  constructor(private pwaService: PwaService) {}

  ngOnInit(): void {
    // Écouter l'événement beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.pwaService.setPromptEvent(e);
      this.showInstallPrompt = true;
    });

    // Masquer le prompt si l'app est déjà installée
    window.addEventListener('appinstalled', () => {
      this.showInstallPrompt = false;
      this.deferredPrompt = null;
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('beforeinstallprompt', this.handleBeforeInstallPrompt);
    window.removeEventListener('appinstalled', this.handleAppInstalled);
  }

  installApp(): void {
    this.pwaService.install().then(() => {
      this.showInstallPrompt = false;
    }).catch((error) => {
      console.error('Erreur lors de l\'installation:', error);
    });
  }

  dismissPrompt(): void {
    this.showInstallPrompt = false;
    // Ne plus afficher le prompt pendant cette session
    localStorage.setItem('pwa-install-dismissed', 'true');
  }

  private handleBeforeInstallPrompt = (e: any) => {
    e.preventDefault();
    this.deferredPrompt = e;
    this.pwaService.setPromptEvent(e);
    this.showInstallPrompt = true;
  };

  private handleAppInstalled = () => {
    this.showInstallPrompt = false;
    this.deferredPrompt = null;
  };
}
