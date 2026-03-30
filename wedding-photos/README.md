# 📸 Wedding Photos - Application de Partage de Photos de Mariage

Une application Angular moderne permettant aux invités d'un mariage de partager leurs photos et vidéos dans des albums personnalisés.

## ✨ Fonctionnalités

- **Authentification simple** : Les invités entrent simplement leur nom
- **Albums personnalisés** : Chaque invité a son propre album automatiquement créé
- **Upload de photos et vidéos** : Interface drag & drop intuitive
- **Galerie partagée** : Visualisation de tous les albums des invités
- **Stockage cloud** : Intégration avec Cloudinary pour le stockage des fichiers
- **Design responsive** : Interface moderne et adaptative

## 🚀 Démarrage rapide

### Prérequis
- Node.js (version 20.10.0 ou supérieure)
- npm ou yarn

### Installation
```bash
# Cloner le projet
git clone <votre-repo>
cd wedding-photos

# Installer les dépendances
npm install

# Configurer Cloudinary (voir CLOUDINARY_SETUP.md)
# Remplacer les clés dans src/app/services/cloudinary.service.ts

# Démarrer l'application
ng serve
```

L'application sera accessible sur `http://localhost:4200`

## 📱 Utilisation

1. **Connexion** : L'invité entre son nom
2. **Album automatique** : Un album est créé automatiquement pour cet invité
3. **Upload** : L'invité peut ajouter des photos/vidéos via drag & drop
4. **Galerie** : Tous les invités peuvent voir les albums de chacun

## 🛠️ Configuration

### Cloudinary (Recommandé)
- Plan gratuit : 25 GB de stockage + 25 GB de bande passante/mois
- Optimisation automatique des images
- CDN global pour des performances optimales

### Vercel (Déploiement)
- Déploiement gratuit pour les sites statiques
- 100 GB de bande passante/mois
- Déploiement automatique depuis Git

## 📁 Structure du projet

```
src/
├── app/
│   ├── components/
│   │   ├── login/          # Page de connexion
│   │   ├── gallery/        # Galerie des albums
│   │   └── upload/         # Interface d'upload
│   ├── services/
│   │   ├── cloudinary.service.ts  # Gestion des uploads
│   │   └── album.service.ts       # Gestion des albums
│   └── app.routes.ts       # Configuration des routes
```

## 🔧 Technologies utilisées

- **Angular 17** : Framework principal
- **TypeScript** : Langage de programmation
- **SCSS** : Préprocesseur CSS
- **Cloudinary** : Stockage et optimisation des médias
- **RxJS** : Gestion des observables
- **LocalStorage** : Persistance des données (temporaire)

## 📊 Limites et considérations

### Cloudinary (Plan gratuit)
- **Stockage** : 25 GB
- **Bande passante** : 25 GB/mois
- **Uploads** : 500/mois
- **Transformations** : 25 000/mois

### Vercel (Plan gratuit)
- **Bande passante** : 100 GB/mois
- **Fonctions serverless** : 100 GB-heures/mois

### Recommandations
- Pour un mariage avec ~50 invités et ~1000 photos : Cloudinary gratuit suffit
- Pour plus d'invités, considérez un plan payant Cloudinary
- Les données sont stockées localement (localStorage) - considérez une base de données pour la production

## 🚀 Déploiement sur Vercel

1. **Préparer l'application** :
```bash
ng build --configuration production
```

2. **Installer Vercel CLI** :
```bash
npm i -g vercel
```

3. **Déployer** :
```bash
vercel
```

4. **Configuration** :
   - Framework : Angular
   - Build Command : `ng build --configuration production`
   - Output Directory : `dist/wedding-photos`

## 🔒 Sécurité

⚠️ **Important** : Cette application est conçue pour un usage privé (mariage). Pour un usage public :
- Implémentez une authentification robuste
- Ajoutez une validation côté serveur
- Utilisez HTTPS
- Limitez la taille des fichiers uploadés

## 📝 Licence

Ce projet est sous licence MIT. Voir le fichier LICENSE pour plus de détails.

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.

## 📞 Support

Pour toute question ou problème, ouvrez une issue sur GitHub.