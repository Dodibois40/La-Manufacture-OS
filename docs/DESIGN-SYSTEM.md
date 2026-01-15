# 🎨 La Manufacture OS - Design System

Guide complet des composants réutilisables pour une cohérence visuelle sur toute l'application.

## 📋 Table des matières

1. [Buttons](#1-buttons)
2. [Cards](#2-cards)
3. [Inputs & Forms](#3-inputs--forms)
4. [Badges](#4-badges)
5. [Avatars](#5-avatars)
6. [Modals](#6-modals)
7. [Tabs](#7-tabs)
8. [Lists](#8-lists)
9. [Alerts](#9-alerts)
10. [Loading](#10-loading)
11. [Dividers](#11-dividers)
12. [Empty States](#12-empty-states)
13. [Tooltips](#13-tooltips)
14. [Utility Classes](#14-utility-classes)

---

## 1. Buttons

### Types de boutons

#### Primary Button (Action principale)
```html
<button class="btn btn-primary">Créer un projet</button>
```

#### Secondary Button (Action secondaire)
```html
<button class="btn btn-secondary">Annuler</button>
```

#### Danger Button (Action destructive)
```html
<button class="btn btn-danger">Supprimer</button>
```

#### Success Button (Validation)
```html
<button class="btn btn-success">Confirmer</button>
```

#### Ghost Button (Transparent)
```html
<button class="btn btn-ghost">En savoir plus</button>
```

### Tailles de boutons

```html
<!-- Small -->
<button class="btn btn-primary btn-sm">Petit</button>

<!-- Normal (défaut) -->
<button class="btn btn-primary">Normal</button>

<!-- Large -->
<button class="btn btn-primary btn-lg">Grand</button>

<!-- Full width -->
<button class="btn btn-primary btn-block">Pleine largeur</button>

<!-- Icon only -->
<button class="btn btn-primary btn-icon">⚙️</button>
```

### Avec icônes

```html
<button class="btn btn-primary">
  <svg>...</svg>
  Nouveau projet
</button>
```

---

## 2. Cards

### Card de base

```html
<div class="card">
  <div class="card-header">
    <h3 class="card-title">Titre de la carte</h3>
    <p class="card-subtitle">Sous-titre optionnel</p>
  </div>
  <div class="card-body">
    Contenu de la carte
  </div>
  <div class="card-footer">
    <button class="btn btn-secondary btn-sm">Action</button>
  </div>
</div>
```

### Card cliquable

```html
<div class="card card-clickable" onclick="handleClick()">
  <div class="card-body">
    Cliquez-moi !
  </div>
</div>
```

---

## 3. Inputs & Forms

### Input texte

```html
<div class="input-group">
  <label class="input-label">Nom du projet</label>
  <input type="text" class="input" placeholder="Entrez un nom...">
  <span class="input-hint">Conseil: Choisissez un nom descriptif</span>
</div>
```

### Input avec erreur

```html
<div class="input-group">
  <label class="input-label">Email</label>
  <input type="email" class="input input-error" value="invalid">
  <span class="input-error-message">Email invalide</span>
</div>
```

### Textarea

```html
<div class="input-group">
  <label class="input-label">Description</label>
  <textarea class="input textarea" placeholder="Décrivez le projet..."></textarea>
</div>
```

### Select

```html
<div class="input-group">
  <label class="input-label">Assigné à</label>
  <select class="input select">
    <option>Nicolas</option>
    <option>Esteban</option>
  </select>
</div>
```

### Checkbox custom

```html
<label class="checkbox-wrapper">
  <input type="checkbox" hidden>
  <span class="checkbox-custom"></span>
  <span>Urgent</span>
</label>
```

---

## 4. Badges

### Types de badges

```html
<!-- Primary -->
<span class="badge badge-primary">Nouveau</span>

<!-- Success -->
<span class="badge badge-success">Terminé</span>

<!-- Danger -->
<span class="badge badge-danger">Urgent</span>

<!-- Warning -->
<span class="badge badge-warning">En attente</span>

<!-- Neutral -->
<span class="badge badge-neutral">Brouillon</span>
```

### Badge avec icône

```html
<span class="badge badge-primary">
  <svg>...</svg>
  RDV
</span>
```

---

## 5. Avatars

### Tailles d'avatar

```html
<!-- Small -->
<div class="avatar avatar-sm">N</div>

<!-- Medium (défaut) -->
<div class="avatar avatar-md">N</div>

<!-- Large -->
<div class="avatar avatar-lg">N</div>
```

### Avatar avec image

```html
<div class="avatar avatar-md">
  <img src="/path/to/avatar.jpg" alt="Nicolas">
</div>
```

### Avatar avec couleur custom

```html
<div class="avatar avatar-md" style="background: #FF6B6B;">
  E
</div>
```

---

## 6. Modals

### Structure complète

```html
<div class="modal-overlay" id="myModal">
  <div class="modal">
    <div class="modal-header">
      <h2 class="modal-title">Créer un projet</h2>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <!-- Contenu du modal -->
      <div class="input-group">
        <label class="input-label">Nom du projet</label>
        <input type="text" class="input">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary">Créer</button>
    </div>
  </div>
</div>
```

### JavaScript pour ouvrir/fermer

```javascript
// Ouvrir
document.getElementById('myModal').classList.add('active');

// Fermer
document.getElementById('myModal').classList.remove('active');

// Fermer au clic sur l'overlay
overlay.addEventListener('click', (e) => {
  if (e.target === overlay) {
    overlay.classList.remove('active');
  }
});
```

---

## 7. Tabs

### Structure des onglets

```html
<div class="tabs">
  <button class="tab active" data-tab="tab1">Membres</button>
  <button class="tab" data-tab="tab2">Projets</button>
  <button class="tab" data-tab="tab3">Documents</button>
</div>

<div class="tab-content">
  <div class="tab-pane active" id="tab1">
    Contenu Membres
  </div>
  <div class="tab-pane" id="tab2">
    Contenu Projets
  </div>
  <div class="tab-pane" id="tab3">
    Contenu Documents
  </div>
</div>
```

### JavaScript pour les onglets

```javascript
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    // Retirer active de tous
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

    // Activer le cliqué
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
  });
});
```

---

## 8. Lists

### Liste simple

```html
<ul class="list">
  <li class="list-item">
    <span class="avatar avatar-sm">N</span>
    <span class="flex-1">Nicolas</span>
    <span class="badge badge-primary">3 projets</span>
  </li>
  <li class="list-item">
    <span class="avatar avatar-sm">E</span>
    <span class="flex-1">Esteban</span>
    <span class="badge badge-primary">1 projet</span>
  </li>
</ul>
```

### Liste cliquable

```html
<ul class="list">
  <li class="list-item list-item-clickable" onclick="handleClick()">
    Cliquez-moi
  </li>
</ul>
```

---

## 9. Alerts

### Types d'alertes

```html
<!-- Info -->
<div class="alert alert-info">
  <span class="alert-icon">ℹ️</span>
  <div class="alert-content">
    <div class="alert-title">Information</div>
    <div class="alert-message">Voici une information utile</div>
  </div>
</div>

<!-- Success -->
<div class="alert alert-success">
  <span class="alert-icon">✓</span>
  <div class="alert-content">
    <div class="alert-title">Succès</div>
    <div class="alert-message">L'action a été effectuée</div>
  </div>
</div>

<!-- Warning -->
<div class="alert alert-warning">
  <span class="alert-icon">⚠️</span>
  <div class="alert-content">
    <div class="alert-title">Attention</div>
    <div class="alert-message">Vérifiez les informations</div>
  </div>
</div>

<!-- Danger -->
<div class="alert alert-danger">
  <span class="alert-icon">✕</span>
  <div class="alert-content">
    <div class="alert-title">Erreur</div>
    <div class="alert-message">Une erreur est survenue</div>
  </div>
</div>
```

---

## 10. Loading

### Spinner

```html
<!-- Normal -->
<span class="spinner"></span>

<!-- Large -->
<span class="spinner spinner-lg"></span>
```

### Loading overlay (sur une card)

```html
<div class="card" style="position: relative;">
  <div class="card-body">
    Contenu de la carte
  </div>
  <div class="loading-overlay">
    <span class="spinner spinner-lg"></span>
  </div>
</div>
```

---

## 11. Dividers

### Divider simple

```html
<hr class="divider">
```

### Divider avec texte

```html
<div class="divider-text">
  OU
</div>
```

---

## 12. Empty States

### État vide

```html
<div class="empty-state">
  <div class="empty-state-icon">📁</div>
  <div class="empty-state-title">Aucun projet</div>
  <div class="empty-state-message">
    Créez votre premier projet pour commencer
  </div>
  <button class="btn btn-primary">Créer un projet</button>
</div>
```

---

## 13. Tooltips

### Tooltip simple

```html
<button class="btn btn-primary" data-tooltip="Cliquez pour créer">
  Créer
</button>
```

---

## 14. Utility Classes

### Spacing (marges et padding)

```html
<!-- Margins top -->
<div class="mt-0">margin-top: 0</div>
<div class="mt-1">margin-top: 8px</div>
<div class="mt-2">margin-top: 16px</div>
<div class="mt-3">margin-top: 24px</div>
<div class="mt-4">margin-top: 32px</div>

<!-- Margins bottom -->
<div class="mb-1">margin-bottom: 8px</div>

<!-- Padding -->
<div class="p-0">padding: 0</div>
<div class="p-1">padding: 8px</div>
<div class="p-2">padding: 16px</div>
```

### Display

```html
<div class="d-none">display: none</div>
<div class="d-block">display: block</div>
<div class="d-flex">display: flex</div>
<div class="d-inline-flex">display: inline-flex</div>
```

### Flexbox

```html
<div class="d-flex flex-column align-center justify-between gap-2">
  Flex container avec gap
</div>
```

### Text

```html
<p class="text-center">Centré</p>
<p class="text-primary">Couleur accent</p>
<p class="text-muted">Texte grisé</p>
<p class="text-sm">Petit texte</p>
<p class="text-lg font-bold">Grand et gras</p>
```

### Width

```html
<div class="w-full">Pleine largeur</div>
```

### Autres

```html
<div class="opacity-50">Opacité 50%</div>
<button class="cursor-pointer">Curseur pointer</button>
```

---

## 🎨 Variables CSS disponibles

Toutes les couleurs et valeurs sont définies dans `variables.css` :

### Couleurs principales
- `--accent` : Bleu iOS (#0A84FF)
- `--danger` : Rouge (#FF453A)
- `--success` : Vert (#30D158)
- `--warning` : Orange (#FF9F0A)

### Backgrounds
- `--bg-app` : Fond de l'app
- `--bg-card` : Fond des cartes
- `--bg-card-hover` : Fond des cartes au survol

### Texte
- `--text-main` : Texte principal
- `--text-sec` : Texte secondaire
- `--text-tert` : Texte tertiaire

### Border Radius
- `--radius-xs` : 6px
- `--radius-s` : 10px
- `--radius-m` : 12px
- `--radius-l` : 16px
- `--radius-xl` : 24px
- `--radius-full` : 99px

### Animations
- `--ease-spring` : Effet rebond
- `--ease-smooth` : Transition douce

---

## 📝 Best Practices

1. **Toujours utiliser les classes du design system** plutôt que créer du CSS custom
2. **Utiliser les variables CSS** pour les couleurs et espacements
3. **Respecter la hiérarchie des boutons** : Primary pour l'action principale, Secondary pour les actions secondaires
4. **Utiliser les utility classes** pour les petits ajustements plutôt que du CSS inline
5. **Tester sur mobile** : tous les composants sont responsive

---

## 🚀 Import dans votre page

Ajoutez le design system dans votre HTML :

```html
<link rel="stylesheet" href="/src/css/variables.css">
<link rel="stylesheet" href="/src/css/design-system.css">
```

Ou dans votre fichier CSS principal :

```css
@import './variables.css';
@import './design-system.css';
```

---

## 📞 Questions ?

Si un composant manque ou si vous avez besoin d'une variante spécifique, ajoutez-la dans `design-system.css` en suivant la même structure.
