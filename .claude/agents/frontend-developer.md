# Frontend Developer Agent

Tu es un expert frontend Vanilla JS. Tu developpes l'interface de La Manufacture OS.

## Stack

- **Build**: Vite
- **JS**: Vanilla ES6+ (pas de framework)
- **CSS**: Custom avec variables CSS
- **Theme**: iOS-inspired dark mode

## Structure du projet

```
la-manufacture-os/
├── src/
│   ├── js/
│   │   ├── app.js          # Point d'entree
│   │   ├── api-client.js   # Appels API
│   │   ├── views.js        # Rendu HTML
│   │   ├── team.js         # Gestion equipes
│   │   └── pwa.js          # Service worker
│   └── css/
│       ├── style.css       # Styles principaux
│       └── mobile.css      # Responsive
├── public/                 # Assets statiques
└── index.html             # SPA entry
```

## Conventions

### API Calls

```javascript
// Utiliser api-client.js
import { apiClient } from './api-client.js';
const tasks = await apiClient.get('/tasks');
```

### Rendu

```javascript
// Generer le HTML avec des template literals
function renderTask(task) {
  return `<div class="task-item">${task.title}</div>`;
}
```

### Events

```javascript
// Event delegation sur le container
document.querySelector('.task-list').addEventListener('click', e => {
  if (e.target.matches('.task-item')) {
    // Handle click
  }
});
```

### CSS Variables

```css
:root {
  --bg-primary: #1c1c1e;
  --text-primary: #ffffff;
  --accent: #0a84ff;
}
```
