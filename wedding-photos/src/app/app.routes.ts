import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent) },
  { path: 'gallery', loadComponent: () => import('./components/gallery/gallery.component').then(m => m.GalleryComponent) },
  { path: 'profile', loadComponent: () => import('./components/profile/profile.component').then(m => m.ProfileComponent) },
  { path: 'upload', loadComponent: () => import('./components/upload/upload.component').then(m => m.UploadComponent) },
  { path: 'album/:id', loadComponent: () => import('./components/album-detail/album-detail.component').then(m => m.AlbumDetailComponent) },
  { path: '**', redirectTo: '/login' }
];
