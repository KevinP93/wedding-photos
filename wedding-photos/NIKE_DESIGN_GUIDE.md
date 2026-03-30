# 🏃‍♂️ Design Nike - Guide de Style

## 🎨 Philosophie du Design

Le nouveau design s'inspire de l'application Nike avec un style **sportif, moderne et dynamique** caractérisé par :

- **Fond noir** (#000) pour un look premium et élégant
- **Couleurs vives** : Orange (#ff6b35) et Rouge (#ff1744) pour l'énergie
- **Typographie bold** : Police épaisse avec lettres espacées
- **Animations fluides** : Transitions cubic-bezier pour un mouvement naturel
- **Glassmorphism** : Effets de verre avec backdrop-filter

## 🎯 Palette de Couleurs

### **Couleurs Principales**
- **Noir** : `#000` - Fond principal
- **Orange Nike** : `#ff6b35` - Accents et boutons
- **Rouge Nike** : `#ff1744` - Hover et actions
- **Bleu** : `#3d5afe` - Accents secondaires

### **Couleurs de Texte**
- **Blanc** : `#fff` - Texte principal
- **Gris clair** : `rgba(255, 255, 255, 0.7)` - Texte secondaire
- **Gris foncé** : `rgba(255, 255, 255, 0.5)` - Texte tertiaire

### **Couleurs d'Overlay**
- **Glassmorphism** : `rgba(255, 255, 255, 0.05)` - Cartes
- **Bordure** : `rgba(255, 255, 255, 0.1)` - Bordures subtiles
- **Hover** : `rgba(255, 107, 53, 0.1)` - États de survol

## 🎨 Éléments de Design

### **Typographie**
- **Police** : Système (SF Pro, Roboto, etc.)
- **Poids** : 700-900 (Bold à Black)
- **Espacement** : Letter-spacing négatif pour les titres
- **Style** : Uppercase pour les boutons et labels
- **Tailles** : Hiérarchie claire (2.5rem → 0.8rem)

### **Formes et Bordures**
- **Border-radius** : 12px-50px selon l'élément
- **Boutons** : Forme pill (50px) pour les CTA
- **Cartes** : Coins arrondis (20px) avec bordures subtiles
- **Photos** : Coins arrondis (8px-16px) selon la taille

### **Ombres et Effets**
- **Box-shadow** : Ombres noires profondes (0 8px 32px rgba(0, 0, 0, 0.3))
- **Backdrop-filter** : Blur(20px) pour l'effet glassmorphism
- **Gradients** : Dégradés linéaires pour les boutons et accents
- **Animations** : Cubic-bezier(0.25, 0.46, 0.45, 0.94) pour le mouvement

## 🚀 Animations et Interactions

### **Animations d'Entrée**
- **Slide-in** : translateY + scale pour les cartes
- **Fade-in** : Opacity avec délais progressifs
- **Bounce** : Animation de rebond pour les icônes

### **Interactions Hover**
- **Scale** : 1.02-1.05 pour l'effet de grossissement
- **Translate** : Mouvement vertical (-3px à -8px)
- **Shadow** : Augmentation de l'ombre pour la profondeur
- **Color** : Changement de couleur des accents

### **Transitions**
- **Durée** : 0.3s-0.6s selon l'élément
- **Easing** : Cubic-bezier pour un mouvement naturel
- **Propriétés** : Transform, opacity, box-shadow

## 📱 Layout Mobile

### **Structure**
- **Container** : Max-width 400px pour mobile
- **Padding** : 16px-20px selon l'écran
- **Gap** : 12px-20px entre les éléments
- **Grid** : Auto-fill avec minmax pour les photos

### **Navigation**
- **Header** : Sticky avec backdrop-filter
- **Boutons** : Taille minimale 44px pour le touch
- **Z-index** : 100 pour les éléments flottants

## 🎯 Composants Spécifiques

### **Page de Connexion**
- **Fond** : Dégradé radial animé
- **Carte** : Glassmorphism avec bordures subtiles
- **Titre** : Gradient text avec glow effect
- **Input** : Fond transparent avec focus orange

### **Galerie**
- **Albums** : Cartes avec gradient border pour l'utilisateur actuel
- **Photos** : Grille 2fr 1fr 1fr avec photo principale
- **Hover** : Scale et shadow pour l'interactivité

### **Upload**
- **Drop-zone** : Bordure en pointillés avec animation
- **Progress** : Barre avec pattern animé
- **Files** : Liste avec hover effects

### **Détail Album**
- **Photos** : Grille responsive avec overlay
- **Overlay** : Gradient pour la lisibilité
- **Info** : Badges colorés pour type et date

## 🔧 Implémentation Technique

### **CSS Custom Properties**
```css
:root {
  --nike-orange: #ff6b35;
  --nike-red: #ff1744;
  --nike-blue: #3d5afe;
  --nike-black: #000;
  --nike-white: #fff;
}
```

### **Mixins SCSS**
```scss
@mixin nike-button {
  background: linear-gradient(135deg, var(--nike-orange), var(--nike-red));
  border-radius: 50px;
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 1px;
}

@mixin nike-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
}
```

### **Animations Keyframes**
```scss
@keyframes nike-slide-in {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
```

## 📊 Performance

### **Optimisations**
- **Transform** : Utilisation de transform au lieu de position
- **Will-change** : Propriété pour les animations
- **Backdrop-filter** : Utilisé avec parcimonie
- **Box-shadow** : Limité pour les performances

### **Responsive**
- **Breakpoints** : 480px pour mobile
- **Flexible** : Grid et flexbox pour l'adaptabilité
- **Touch** : Zones de touch optimisées

## 🎉 Résultat Final

L'application adopte maintenant un style **Nike authentique** avec :

✅ **Look premium** : Fond noir avec accents colorés
✅ **Interactions fluides** : Animations naturelles et engageantes
✅ **Typographie bold** : Style sportif et moderne
✅ **Glassmorphism** : Effets de verre élégants
✅ **Mobile-first** : Optimisé pour l'usage mobile
✅ **Performance** : Animations optimisées

Le design reflète parfaitement l'énergie et le dynamisme de la marque Nike ! 🏃‍♂️✨
