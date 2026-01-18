# Frontend Conventions (Vanilla JS)

## Structure des fichiers

```
src/js/
├── app.js           # Point d'entree, initialisation
├── api-client.js    # Toutes les requetes API
├── views.js         # Fonctions de rendu HTML
├── [feature].js     # Un fichier par feature
└── utils.js         # Fonctions utilitaires
```

## API Client

```javascript
// Toujours utiliser api-client.js
import { apiClient } from './api-client.js';

// GET
const tasks = await apiClient.get('/tasks');

// POST
const newTask = await apiClient.post('/tasks', { title: 'Test' });

// PUT
await apiClient.put(`/tasks/${id}`, { completed: true });

// DELETE
await apiClient.delete(`/tasks/${id}`);
```

## Rendu HTML

```javascript
// Template literals pour le HTML
function renderTask(task) {
  return `
    <div class="task-item" data-id="${task.id}">
      <span class="task-title">${escapeHtml(task.title)}</span>
    </div>
  `;
}

// Toujours echapper les donnees utilisateur
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
```

## Event Handling

```javascript
// Event delegation
document.querySelector('.task-list').addEventListener('click', e => {
  const taskItem = e.target.closest('.task-item');
  if (!taskItem) return;

  const taskId = taskItem.dataset.id;
  // Handle...
});
```

## CSS

```css
/* Variables globales dans :root */
:root {
  --bg-primary: #1c1c1e;
  --bg-secondary: #2c2c2e;
  --text-primary: #ffffff;
  --accent: #0a84ff;
}

/* Classes BEM-like */
.task-item {
}
.task-item--completed {
}
.task-item__title {
}
```
