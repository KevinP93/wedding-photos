# Configuration Cloudinary

## Étapes pour configurer Cloudinary

### 1. Créer un compte Cloudinary
1. Allez sur [cloudinary.com](https://cloudinary.com)
2. Créez un compte gratuit
3. Une fois connecté, vous verrez votre **Cloud Name**, **API Key** et **API Secret** sur le dashboard

### 2. Configurer l'Upload Preset
1. Dans le dashboard Cloudinary, allez dans **Settings** > **Upload**
2. Créez un nouveau **Upload Preset** :
   - Nom : `wedding-photos-upload`
   - Signing Mode : **Unsigned** (pour permettre l'upload depuis le frontend)
   - Folder : `wedding-photos`
   - Transformation : Laissez par défaut

### 3. Mettre à jour le service Cloudinary
Remplacez les valeurs dans `src/app/services/cloudinary.service.ts` :

```typescript
this.cloudinary = new Cloudinary({
  cloud_name: 'dq8x5tkzw', // Remplacez par votre Cloud Name
  api_key: '448581242863136', // Remplacez par votre API Key
  api_secret: 'VyBrHjHiLpeQ8hziTkW2W3x0jas' // Remplacez par votre API Secret
});
```

Et dans la méthode `uploadFile` :
```typescript
formData.append('upload_preset', 'wedding-photos-upload'); // Votre preset name
```

### 4. Limites du plan gratuit
- **Stockage** : 25 GB
- **Bande passante** : 25 GB/mois
- **Transformations** : 25 000/mois
- **Uploads** : 500/mois

### 5. Sécurité
⚠️ **Important** : Pour la production, ne jamais exposer l'API Secret dans le code frontend. Utilisez un backend pour gérer les uploads sécurisés.

## Alternative : Firebase Storage

Si vous préférez Firebase Storage :

1. Créez un projet sur [Firebase Console](https://console.firebase.google.com)
2. Activez **Storage** dans votre projet
3. Installez Firebase : `npm install firebase`
4. Remplacez le service Cloudinary par Firebase Storage

### Configuration Firebase
```typescript
import { initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  // Votre configuration Firebase
};

const app = initializeApp(firebaseConfig);
export const storage = getStorage(app);
```
