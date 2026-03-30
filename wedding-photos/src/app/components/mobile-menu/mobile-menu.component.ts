import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
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
export class MobileMenuComponent {
  @Input() currentGuest = '';
  @Input() currentUsername = '';
  @Input() currentAvatarUrl = '';
  @Input() showProfile = true;

  @Output() profileRequested = new EventEmitter<void>();
  @Output() logoutRequested = new EventEmitter<void>();

  isOpen = false;

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    this.closeMenu();
  }

  toggleMenu(): void {
    this.isOpen = !this.isOpen;
  }

  closeMenu(): void {
    this.isOpen = false;
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
}
