# La Manufacture OS - Guidelines pour Claude

## Design Philosophy

**Style**: Apple/iOS Design Language - Dark Mode Premium
- Glassmorphism avec `backdrop-filter: blur()`
- Animations fluides avec `cubic-bezier` et springs
- Couleurs: fond noir (#000, #1c1c1e), accent bleu (#0A84FF), texte blanc avec opacités

## Règles CSS Strictes

### Alignement
- Les éléments d'une section doivent être alignés entre eux
- Utiliser `justify-content: space-between` pour espacer les éléments aux extrémités
- Vérifier que les boutons et contenus sont sur la même grille visuelle

### Boutons
- Style "lien" pour actions secondaires: `background: transparent; border: none;`
- Ne pas mettre de `box-shadow` sur les boutons texte
- Utiliser `width: auto` pour éviter l'étirement

### Spacing
- Padding standard: 16px, 20px, 24px
- Gap entre éléments: 8px, 12px, 16px
- Border-radius: 12px (petit), 16px (moyen), 24px (grand)

## Règles JS

### Pas de features inutiles
- Supprimer les hints/shortcuts visibles (ex: "Ctrl+K pour...")
- Pas de texte placeholder quand il n'apporte rien
- Les citations doivent être visibles en permanence, pas seulement quand vide

### État vide
- Message simple et discret
- Pas d'icônes/emojis moches
- Garder les éléments de navigation toujours visibles

## Structure des fichiers

```
src/
├── css/
│   ├── variables.css   # Variables CSS (couleurs, fonts, etc.)
│   ├── reset.css       # Reset navigateur
│   ├── components.css  # Composants réutilisables (tasks, badges, buttons)
│   ├── app.css         # Layout principal, navigation, vues
│   ├── commandbar.css  # Barre de commande Ctrl+K
│   ├── morning.css     # Morning briefing + Siri vortex
│   └── planning.css    # Vue calendrier/planning
├── js/
│   ├── app.js          # Point d'entrée, initialisation
│   ├── views.js        # Rendu des vues (Jour, Planning)
│   ├── commandbar.js   # Logique command bar
│   ├── morning.js      # Morning briefing
│   ├── storage.js      # Persistance localStorage/API
│   ├── utils.js        # Fonctions utilitaires
│   └── parser.js       # Smart parsing des tâches
└── assets/
    └── logo.png
```

## Morning Briefing - Règles importantes

### Rotation de la Terre
**IMPORTANT**: Pour que les continents tournent vers la DROITE (sens réaliste vu de l'espace):
- Le `background-position` doit aller vers des valeurs NÉGATIVES
- Animation correcte: `from { background-position: 0 0; } to { background-position: -100% 0; }`
- Ne JAMAIS utiliser `translateX` pour la rotation (cause des artefacts/rectangles noirs)

### Son de démarrage
- Style inspiré PS1: notes cristallines éthérées avec grande reverb
- Fichier: `src/js/startup-sound.js`
- Ne pas utiliser de "BOOM" style Hans Zimmer, trop agressif
- Notes recommandées: Do-Sol-Do (C5, G5, C6) avec harmoniques

### Test du briefing
- Ajouter `?forceBrief` à l'URL pour forcer l'affichage
- Le briefing ne s'affiche qu'une fois par jour sinon

---

## Checklist avant validation

- [ ] Les éléments sont alignés visuellement
- [ ] Pas de texte/hint inutile
- [ ] Les boutons ont le bon style (pas de shadow inutile)
- [ ] Les citations/infos importantes sont toujours visibles
- [ ] Le design est cohérent avec le reste de l'app
- [ ] Pas d'emojis laids ou mal placés

---

## Agent Clean Code

Avant chaque commit ou à la demande, effectuer une revue de code:

### 1. CSS - Vérifications
```
□ Pas de styles dupliqués entre fichiers
□ Pas de !important sauf nécessité absolue
□ Utiliser les variables CSS (--accent, --text-main, etc.)
□ Pas de valeurs magiques (utiliser les spacing standards)
□ Animations avec cubic-bezier ou var(--ease-spring)
□ Supprimer les styles morts/non utilisés
```

### 2. JS - Vérifications
```
□ Pas de console.log oubliés
□ Pas de code commenté inutile
□ Fonctions < 50 lignes (sinon découper)
□ Pas de duplication de logique
□ Event listeners nettoyés si nécessaire
□ Pas de variables non utilisées
```

### 3. HTML - Vérifications
```
□ Pas d'éléments vides ou inutiles
□ IDs uniques et cohérents
□ Classes avec naming cohérent (kebab-case)
□ Pas de styles inline (sauf exceptions dynamiques)
```

### 4. Performance
```
□ Pas de re-render inutiles
□ Images optimisées
□ Pas de listeners sur scroll/resize sans throttle
□ Lazy loading si nécessaire
```

### 5. UX
```
□ Feedback visuel sur les interactions (hover, active)
□ Transitions fluides (pas de changements brusques)
□ États de chargement si opération longue
□ Messages d'erreur clairs
```

### Commande de revue
Pour lancer une revue complète:
1. Lister tous les fichiers modifiés
2. Vérifier chaque point de la checklist
3. Corriger les problèmes trouvés
4. Reporter les corrections faites
