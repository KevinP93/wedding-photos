import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CloudinaryService } from '../../services/cloudinary.service';
import { AlbumService, Photo } from '../../services/album.service';
import { SupabaseService } from '../../services/supabase.service';
import { MobileMenuComponent } from '../mobile-menu/mobile-menu.component';

interface SelectedMedia {
  file: File;
  previewUrl: string;
  type: 'image' | 'video';
}

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, MobileMenuComponent],
  templateUrl: './upload.component.html',
  styleUrl: './upload.component.scss'
})
export class UploadComponent implements OnInit, OnDestroy {
  selectedFiles: SelectedMedia[] = [];
  isUploading = false;
  isDragging = false;
  uploadProgress = 0;
  currentUserId = '';
  currentGuest = '';
  currentUsername = '';
  currentAlbumId = '';
  currentAvatarUrl = '';
  isAdmin = false;
  uploadResults: { success: number; error: number } = { success: 0, error: 0 };

  constructor(
    private cloudinaryService: CloudinaryService,
    private albumService: AlbumService,
    private supabaseService: SupabaseService,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    this.currentUserId = sessionStorage.getItem('currentUserId') || '';
    this.currentGuest = sessionStorage.getItem('currentGuest') || '';
    this.currentUsername = sessionStorage.getItem('currentUsername') || '';
    this.currentAlbumId = sessionStorage.getItem('currentAlbumId') || '';
    this.currentAvatarUrl = sessionStorage.getItem('currentAvatarUrl') || '';
    this.isAdmin = sessionStorage.getItem('isAdmin') === 'true';

    if (!this.currentUserId || !this.currentGuest || !this.currentUsername) {
      this.router.navigate(['/login']);
      return;
    }

    if (this.isAdmin) {
      this.router.navigate(['/gallery']);
      return;
    }

    await this.albumService.ready(true);
  }

  ngOnDestroy(): void {
    this.clearSelectedFiles();
  }

  onFileSelected(event: Event | DragEvent): void {
    const files = this.extractFiles(event);
    if (files.length === 0) {
      return;
    }

    const nextEntries: SelectedMedia[] = files.map(file => ({
      file,
      previewUrl: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' : 'image'
    }));

    this.selectedFiles = [...this.selectedFiles, ...nextEntries];
    this.isDragging = false;

    if (event.target instanceof HTMLInputElement) {
      event.target.value = '';
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();

    const currentTarget = event.currentTarget as Node | null;
    const relatedTarget = event.relatedTarget as Node | null;
    if (currentTarget && relatedTarget && currentTarget.contains(relatedTarget)) {
      return;
    }

    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    this.onFileSelected(event);
  }

  removeFile(index: number): void {
    const [removedFile] = this.selectedFiles.splice(index, 1);
    if (removedFile) {
      URL.revokeObjectURL(removedFile.previewUrl);
    }

    this.selectedFiles = [...this.selectedFiles];
  }

  clearSelectedFiles(): void {
    for (const selectedFile of this.selectedFiles) {
      URL.revokeObjectURL(selectedFile.previewUrl);
    }

    this.selectedFiles = [];
  }

  async uploadFiles(): Promise<void> {
    if (this.selectedFiles.length === 0) {
      return;
    }

    this.isUploading = true;
    this.uploadProgress = 0;
    this.uploadResults = { success: 0, error: 0 };

    try {
      const totalFiles = this.selectedFiles.length;
      const userAlbum = await this.albumService.getCurrentUserAlbum();

      this.currentAlbumId = userAlbum.id;
      sessionStorage.setItem('currentAlbumId', userAlbum.id);

      for (let index = 0; index < this.selectedFiles.length; index++) {
        const selectedFile = this.selectedFiles[index];

        try {
          const result = await this.cloudinaryService.uploadFile(
            selectedFile.file,
            `wedding-photos/${userAlbum.id}`
          );

          const photo: Photo = {
            id: '',
            url: result.secure_url,
            publicId: result.public_id,
            uploadedBy: this.currentGuest,
            uploadedByUsername: this.currentUsername,
            uploadedByAvatarUrl: this.currentAvatarUrl,
            uploadedAt: new Date(),
            type: selectedFile.type,
            likes: [],
            downloadCount: 0
          };

          await this.albumService.addPhotoToAlbum(userAlbum.id, photo);
          this.uploadResults.success++;
        } catch (error) {
          console.error('Erreur lors de l\'upload:', error);
          this.uploadResults.error++;
        }

        this.uploadProgress = ((index + 1) / totalFiles) * 100;
      }
    } finally {
      this.isUploading = false;
    }

    if (this.uploadResults.success > 0) {
      this.clearSelectedFiles();
    }
  }

  goBack(): void {
    this.router.navigate(['/gallery']);
  }

  goToProfile(): void {
    this.router.navigate(['/gallery'], { queryParams: { profile: '1' } });
  }

  async logout(): Promise<void> {
    try {
      await this.supabaseService.signOut();
    } catch (error) {
      console.error('Erreur lors de la deconnexion:', error);
    } finally {
      this.clearSession();
      this.router.navigate(['/login']);
    }
  }

  getFileSize(bytes: number): string {
    if (bytes === 0) {
      return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, unitIndex);

    return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  getFileTypeLabel(selectedFile: SelectedMedia): string {
    return selectedFile.type === 'video' ? 'Video' : 'Photo';
  }

  private extractFiles(event: Event | DragEvent): File[] {
    if (event instanceof DragEvent && event.dataTransfer?.files?.length) {
      return Array.from(event.dataTransfer.files);
    }

    if (event.target instanceof HTMLInputElement && event.target.files?.length) {
      return Array.from(event.target.files);
    }

    return [];
  }

  private clearSession(): void {
    sessionStorage.removeItem('currentUserId');
    sessionStorage.removeItem('currentGuest');
    sessionStorage.removeItem('currentUsername');
    sessionStorage.removeItem('currentAlbumId');
    sessionStorage.removeItem('currentAvatarUrl');
    sessionStorage.removeItem('isAdmin');
    sessionStorage.removeItem('adminPassword');
  }
}
