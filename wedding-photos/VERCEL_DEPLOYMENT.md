# 🚀 Guide de Déploiement Vercel

## Prérequis
- Compte Vercel (gratuit)
- Application Angular configurée
- Compte Cloudinary configuré

## Étapes de déploiement

### 1. Préparer l'application

1. **Configurer Cloudinary** :
   - Suivez le guide `CLOUDINARY_SETUP.md`
   - Mettez à jour `src/environments/environment.ts` et `environment.prod.ts`

2. **Tester localement** :
   ```bash
   ng build --configuration production
   ng serve --configuration production
   ```

### 2. Déploiement via Vercel CLI

1. **Installer Vercel CLI** :
   ```bash
   npm i -g vercel
   ```

2. **Se connecter à Vercel** :
   ```bash
   vercel login
   ```

3. **Déployer** :
   ```bash
   vercel
   ```

4. **Suivre les instructions** :
   - Framework : Angular
   - Build Command : `ng build --configuration production`
   - Output Directory : `dist/wedding-photos`
   - Install Command : `npm install`

### 3. Déploiement via GitHub (Recommandé)

1. **Pousser le code sur GitHub** :
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <votre-repo-github>
   git push -u origin main
   ```

2. **Connecter à Vercel** :
   - Allez sur [vercel.com](https://vercel.com)
   - Cliquez sur "New Project"
   - Importez votre repository GitHub
   - Configuration automatique détectée

3. **Variables d'environnement** (optionnel) :
   - Dans Vercel Dashboard > Settings > Environment Variables
   - Ajoutez vos clés Cloudinary si nécessaire

### 4. Configuration Vercel

Le fichier `vercel.json` est déjà configuré :

```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist/wedding-photos"
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

### 5. Domaine personnalisé (Optionnel)

1. **Dans Vercel Dashboard** :
   - Allez dans Settings > Domains
   - Ajoutez votre domaine personnalisé
   - Suivez les instructions DNS

### 6. Monitoring et Analytics

1. **Vercel Analytics** (gratuit) :
   - Activé automatiquement
   - Métriques de performance
   - Statistiques d'utilisation

2. **Logs** :
   - Disponibles dans Vercel Dashboard
   - Debug des erreurs de build
   - Monitoring des performances

## 🔧 Configuration avancée

### Variables d'environnement
Si vous voulez utiliser des variables d'environnement :

1. **Dans Vercel Dashboard** :
   - Settings > Environment Variables
   - Ajoutez :
     - `CLOUDINARY_CLOUD_NAME`
     - `CLOUDINARY_UPLOAD_PRESET`

2. **Mettre à jour le code** :
   ```typescript
   // Dans environment.ts
   cloudName: process.env['CLOUDINARY_CLOUD_NAME'] || 'YOUR_CLOUD_NAME',
   uploadPreset: process.env['CLOUDINARY_UPLOAD_PRESET'] || 'YOUR_UPLOAD_PRESET'
   ```

### Optimisations
1. **Images** : Cloudinary optimise automatiquement
2. **CDN** : Vercel utilise un CDN global
3. **Caching** : Configuration automatique
4. **Compression** : Gzip/Brotli automatique

## 📊 Limites Vercel (Plan gratuit)

- **Bande passante** : 100 GB/mois
- **Fonctions serverless** : 100 GB-heures/mois
- **Déploiements** : Illimités
- **Domaines** : 1 domaine personnalisé

## 🚨 Dépannage

### Erreurs communes

1. **Build failed** :
   - Vérifiez les dépendances dans `package.json`
   - Testez localement avec `ng build --configuration production`

2. **404 sur refresh** :
   - Le fichier `vercel.json` gère déjà cela
   - Vérifiez la configuration des routes

3. **Images ne s'affichent pas** :
   - Vérifiez la configuration Cloudinary
   - Testez l'upload localement

4. **CORS errors** :
   - Cloudinary gère CORS automatiquement
   - Vérifiez la configuration de l'upload preset

### Support
- [Documentation Vercel](https://vercel.com/docs)
- [Documentation Angular](https://angular.io/docs)
- [Documentation Cloudinary](https://cloudinary.com/documentation)

## 🎉 Félicitations !

Votre application de partage de photos de mariage est maintenant déployée et accessible au monde entier !

**URL de votre application** : `https://votre-projet.vercel.app`
