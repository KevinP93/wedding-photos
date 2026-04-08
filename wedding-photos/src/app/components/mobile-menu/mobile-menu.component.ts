import { Component, EventEmitter, HostListener, Input, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { buildAvatarUrl } from '../../utils/avatar';

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
  @Input() showProfile = true;
  @Input() unreadCount = 0;

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

  logout(): void {
    this.closeMenu();
    this.logoutRequested.emit();
  }

  get avatarUrl(): string {
    return buildAvatarUrl(this.currentAvatarUrl, this.currentGuest, this.currentUsername);
  }

  private lockScroll(): void {
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
  }

  private unlockScroll(): void {
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
  }
}
