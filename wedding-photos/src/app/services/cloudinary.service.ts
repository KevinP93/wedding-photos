import { Injectable } from '@angular/core';

import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CloudinaryService {
  async uploadFile(file: File, folder: string = 'wedding-photos'): Promise<any> {
    if (!environment.cloudinary?.cloudName || !environment.cloudinary?.uploadPreset) {
      throw new Error('Configuration Cloudinary manquante. Verifiez vos variables d\'environnement.');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', environment.cloudinary.uploadPreset);
    formData.append('folder', folder);

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${environment.cloudinary.cloudName}/auto/upload`,
        {
          method: 'POST',
          body: formData
        }
      );

      const result = await response.json();

      if (!response.ok || result.error || !result.secure_url) {
        const message = result.error?.message || 'Upload Cloudinary echoue.';
        throw new Error(message);
      }

      return result;
    } catch (error) {
      throw error instanceof Error ? error : new Error('Erreur inconnue lors de l\'upload sur Cloudinary.');
    }
  }

  getImageUrl(publicId: string, transformations: any = {}): string {
    if (!environment.cloudinary?.cloudName || !publicId) {
      return '';
    }

    const transformationSegments = Object.entries(transformations)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${key}_${value}`)
      .join(',');

    const transformationPath = transformationSegments ? `${transformationSegments}/` : '';
    return `https://res.cloudinary.com/${environment.cloudinary.cloudName}/image/upload/${transformationPath}${this.buildPublicIdPath(publicId)}`;
  }

  getDownloadUrl(publicId: string, resourceType: 'image' | 'video' = 'image'): string {
    if (!environment.cloudinary?.cloudName || !publicId) {
      return '';
    }

    return `https://res.cloudinary.com/${environment.cloudinary.cloudName}/${resourceType}/upload/fl_attachment/${this.buildPublicIdPath(publicId)}`;
  }

  async deleteImage(publicId: string, resourceType: 'image' | 'video' = 'image'): Promise<any> {
    if (!environment.cloudinary?.cloudName) {
      throw new Error('Configuration Cloudinary manquante. Impossible de supprimer l\'image.');
    }

    try {
      const response = await fetch('/api/media', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          publicId,
          resourceType
        })
      });

      const result = await response.json();
      if (!response.ok || result.error) {
        const message = result.error?.message || 'Suppression Cloudinary echouee.';
        throw new Error(message);
      }

      return result;
    } catch (error) {
      throw error instanceof Error ? error : new Error('Erreur inconnue lors de la suppression sur Cloudinary.');
    }
  }

  private buildPublicIdPath(publicId: string): string {
    return publicId
      .split('/')
      .filter(Boolean)
      .map(segment => encodeURIComponent(segment))
      .join('/');
  }
}
