import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppLanguage, I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-language-switcher',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="language-switcher" [attr.aria-label]="i18n.t('language.selector')">
      <button
        type="button"
        class="language-switcher__btn"
        [class.language-switcher__btn--active]="i18n.currentLanguage === 'fr'"
        (click)="setLanguage('fr')"
      >
        {{ i18n.t('language.fr') }}
      </button>
      <button
        type="button"
        class="language-switcher__btn"
        [class.language-switcher__btn--active]="i18n.currentLanguage === 'pt'"
        (click)="setLanguage('pt')"
      >
        {{ i18n.t('language.pt') }}
      </button>
    </div>
  `,
  styles: [`
    .language-switcher {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.25rem;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.76);
      border: 1px solid rgba(126, 88, 78, 0.14);
      box-shadow: 0 10px 22px rgba(89, 62, 57, 0.08);
    }

    .language-switcher__btn {
      border: 0;
      border-radius: 999px;
      padding: 0.42rem 0.72rem;
      background: transparent;
      color: #6b5255;
      font-size: 0.82rem;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
    }

    .language-switcher__btn--active {
      background: rgba(130, 81, 86, 0.12);
      color: #412d2f;
    }

    .language-switcher__btn:hover {
      transform: translateY(-1px);
    }
  `]
})
export class LanguageSwitcherComponent {
  constructor(public i18n: I18nService) {}

  setLanguage(language: AppLanguage): void {
    this.i18n.setLanguage(language);
  }
}
