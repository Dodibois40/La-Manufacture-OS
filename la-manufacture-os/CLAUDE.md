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

## Checklist avant validation

- [ ] Les éléments sont alignés visuellement
- [ ] Pas de texte/hint inutile
- [ ] Les boutons ont le bon style (pas de shadow inutile)
- [ ] Les citations/infos importantes sont toujours visibles
- [ ] Le design est cohérent avec le reste de l'app
- [ ] Pas d'emojis laids ou mal placés
