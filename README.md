Wedding Photos
Application Angular de partage de photos de mariage.
Chaque invite possede un compte, un album unique, peut ajouter ses photos, consulter celles des autres invites et les enregistrer sur son telephone. L'application est optimisee pour un usage mobile et peut etre installee en PWA.
Stack
Angular 17
Supabase Auth + Postgres
Cloudinary pour les photos
Vercel pour le deploiement
Fonctionnalites
inscription / connexion par `username + mot de passe`
`1 utilisateur = 1 album`
galerie partagee des albums invites
suppression de ses propres photos
admin capable de vider un album
photo de profil avec avatar par defaut
PWA installable sur iPhone et Android
enregistrement mobile via partage natif quand disponible
Important
les videos ne sont pas autorisees
les albums vides n'apparaissent pas aux autres invites
l'admin `vide` un album: les photos sont supprimees, mais l'album utilisateur reste cree
Installation locale
Prerequis:
Node.js 20+
npm
Installation:
```bash
npm install
npm start
```
Application disponible sur `http://localhost:4200`.
Configuration
Les cles frontend sont actuellement dans:
environment.ts
environment.prod.ts
Configuration utilisee:
`SUPABASE_URL`: `https://pipbutmzxzhcetlyxfxn.supabase.co`
`SUPABASE_PUBLISHABLE_KEY`: cle publishable Supabase
`CLOUDINARY_CLOUD_NAME`: `dq8x5tkzw`
`CLOUDINARY_UPLOAD_PRESET`: `wedding-photos-upload`
Base Supabase
Le schema SQL principal est dans:
wedding_photos_schema.sql
A executer dans `Supabase > SQL Editor`.
Creation de l'admin
Le script est dans:
create-admin.mjs
Commande:
```powershell
$env:SUPABASE_SERVICE_ROLE_KEY="TA_SERVICE_ROLE_KEY"
npm run create:admin
```
Par defaut, il cree:
`username`: `kevadmin`
`display_name`: `kevadmin`
`password`: `kevadmin`
Deploiement Vercel
Le projet est configure pour Vercel avec:
vercel.json
Reglages recommandes:
`Framework Preset`: `Angular` ou `Other`
`Root Directory`: `wedding-photos`
Variables d'environnement Vercel:
`CLOUDINARY_CLOUD_NAME`
`CLOUDINARY_API_KEY`
`CLOUDINARY_API_SECRET`
Si un override manuel est necessaire:
`Build Command`: `npm run vercel-build`
`Output Directory`: `dist/wedding-photos/browser`
Scripts utiles
```bash
npm start
npm run build
npm test
npm run create:admin
npm run migrate:login-emails
```
Notes techniques
Supabase Auth peut lever des erreurs de type `Navigator LockManager` sur certains navigateurs mobiles / PWA. Le client utilise ici un `no-op lock` car l'application est pensee principalement pour un usage mobile mono-onglet.
Les photos affichees dans la galerie et la visionneuse utilisent des URLs Cloudinary optimisees pour accelerer le chargement.
Le telechargement conserve la qualite d'origine.
Limites du mode PWA
une PWA ne peut pas garantir l'ecriture directe en pellicule comme une vraie app native
sur mobile, l'application utilise le meilleur flux disponible: partage natif si possible, sinon ouverture guidee de l'image
Verification
Build de reference:
```bash
npm run build
```
Le projet build correctement. Il reste un warning non bloquant sur le budget SCSS de l'ecran de detail d'album.
