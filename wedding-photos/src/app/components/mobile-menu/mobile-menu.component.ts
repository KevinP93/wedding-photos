import { Component, EventEmitter, HostListener, Input, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { buildAvatarUrl } from '../../utils/avatar';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-mobile-menu',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './mobile-menu.component.html',
  styleUrl: './mobile-menu.component.scss'
})
export class MobileMenuComponent implements OnDestroy {
  @Input() currentGuest = '';
  @Input() currentUsername = '';
  @Input() currentAvatarUrl = '';
  @Input() showAdd = false;
  @Input() showProfile = true;
  @Input() unreadCount = 0;

  @Output() addRequested = new EventEmitter<void>();
  @Output() profileRequested = new EventEmitter<void>();
  @Output() logoutRequested = new EventEmitter<void>();

  isOpen = false;

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    this.closeMenu();
  }

  ngOnDestroy(): void {
    this.unlockScroll();
  }

  toggleMenu(): void {
    this.isOpen = !this.isOpen;

    if (this.isOpen) {
      this.lockScroll();
      return;
    }

    this.unlockScroll();
  }

  closeMenu(): void {
    this.isOpen = false;
    this.unlockScroll();
  }

  openProfile(): void {
    this.closeMenu();
    this.profileRequested.emit();
  }

  openAdd(): void {
    this.closeMenu();
    this.addRequested.emit();
  }

  logout(): void {
    this.closeMenu();
    this.logoutRequested.emit();
  }

  get avatarUrl(): string {
    return buildAvatarUrl(this.currentAvatarUrl, this.currentGuest, this.currentUsername);
  }

  constructor(public i18n: I18nService) {}

  private lockScroll(): void {
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
  }

  private unlockScroll(): void {
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
  }
}
