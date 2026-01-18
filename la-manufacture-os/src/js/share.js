// Share Modal - Gestion du partage de taches
import { api } from './api-client.js';

let currentTaskId = null;
let currentShares = [];
let allUsers = [];

// Ouvrir le modal de partage
export async function openShareModal(taskId, taskText) {
  currentTaskId = taskId;

  const modal = document.getElementById('shareModal');
  const taskTitle = document.getElementById('shareTaskTitle');
  const searchInput = document.getElementById('shareUserSearch');
  const resultsContainer = document.getElementById('shareSearchResults');
  const currentSharesContainer = document.getElementById('currentShares');

  if (!modal) {
    console.error('Share modal not found in DOM');
    return;
  }

  // Afficher le titre de la tache
  taskTitle.textContent = taskText.length > 50 ? taskText.substring(0, 50) + '...' : taskText;

  // Reset
  searchInput.value = '';
  resultsContainer.innerHTML = '';
  currentSharesContainer.innerHTML = '<p class="share-loading">Chargement...</p>';

  // Afficher le modal
  modal.classList.remove('hidden');
  searchInput.focus();

  // Charger les partages actuels et la liste des utilisateurs
  try {
    // Charger les utilisateurs d'abord (toujours necessaire)
    const usersResponse = await api.users.getAll();
    allUsers = usersResponse.users || [];

    // Puis charger les partages actuels
    const sharesResponse = await api.tasks.getShares(taskId);
    currentShares = sharesResponse.shares || [];

    renderCurrentShares();
  } catch (error) {
    console.error('Error loading share data:', error);

    // Afficher un message d'erreur plus detaille
    let errorMsg = 'Erreur de chargement';
    if (error.message.includes('Unauthorized')) {
      errorMsg = 'Session expiree - reconnectez-vous';
    } else if (error.message.includes('not found')) {
      errorMsg = 'Tache non trouvee';
    } else if (error.message.includes('403')) {
      errorMsg = 'Vous ne pouvez partager que vos propres taches';
    }

    currentSharesContainer.innerHTML = `<p class="share-error">${errorMsg}</p>`;

    // Si on a quand meme les utilisateurs, permettre la recherche
    if (allUsers.length > 0) {
      currentSharesContainer.innerHTML +=
        '<p class="share-empty">Recherchez un utilisateur ci-dessus</p>';
    }
  }
}

// Fermer le modal
export function closeShareModal() {
  const modal = document.getElementById('shareModal');
  if (modal) {
    modal.classList.add('hidden');
  }
  currentTaskId = null;
  currentShares = [];
}

// Afficher les partages actuels
function renderCurrentShares() {
  const container = document.getElementById('currentShares');

  if (currentShares.length === 0) {
    container.innerHTML = '<p class="share-empty">Cette tache n\'est partagee avec personne</p>';
    return;
  }

  container.innerHTML = currentShares
    .map(
      share => `
    <div class="share-user-item">
      <div class="share-user-info">
        <span class="share-user-avatar">${getInitials(share.name)}</span>
        <div class="share-user-details">
          <span class="share-user-name">${escapeHtml(share.name)}</span>
          <span class="share-user-email">${escapeHtml(share.email)}</span>
        </div>
      </div>
      <button class="share-remove-btn" data-user-id="${share.shared_with_user_id}" title="Retirer le partage">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `
    )
    .join('');

  // Event listeners pour les boutons de suppression
  container.querySelectorAll('.share-remove-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      const userId = parseInt(btn.dataset.userId);
      await removeShare(userId);
    });
  });
}

// Recherche d'utilisateurs
export function handleShareSearch(query) {
  const resultsContainer = document.getElementById('shareSearchResults');

  if (!query || query.length < 1) {
    resultsContainer.innerHTML = '';
    return;
  }

  // Filtrer les utilisateurs (exclure ceux deja partages)
  const sharedUserIds = new Set(currentShares.map(s => s.shared_with_user_id));
  const filtered = allUsers
    .filter(user => {
      if (sharedUserIds.has(user.id)) return false;
      const searchLower = query.toLowerCase();
      return (
        user.name.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower)
      );
    })
    .slice(0, 5);

  if (filtered.length === 0) {
    resultsContainer.innerHTML = '<p class="share-no-results">Aucun utilisateur trouve</p>';
    return;
  }

  resultsContainer.innerHTML = filtered
    .map(
      user => `
    <div class="share-search-result" data-user-id="${user.id}">
      <span class="share-user-avatar">${getInitials(user.name)}</span>
      <div class="share-user-details">
        <span class="share-user-name">${escapeHtml(user.name)}</span>
        <span class="share-user-email">${escapeHtml(user.email)}</span>
      </div>
    </div>
  `
    )
    .join('');

  // Event listeners pour ajouter un partage
  resultsContainer.querySelectorAll('.share-search-result').forEach(item => {
    item.addEventListener('click', async () => {
      const userId = parseInt(item.dataset.userId);
      await addShare(userId);
    });
  });
}

// Ajouter un partage
async function addShare(targetUserId) {
  if (!currentTaskId) return;

  const resultsContainer = document.getElementById('shareSearchResults');
  const searchInput = document.getElementById('shareUserSearch');

  try {
    const response = await api.tasks.share(currentTaskId, targetUserId, 'view');

    // Ajouter a la liste des partages actuels
    if (response.targetUser) {
      currentShares.push({
        shared_with_user_id: targetUserId,
        name: response.targetUser.name,
        email: response.targetUser.email,
      });
    }

    // Rafraichir l'affichage
    renderCurrentShares();
    searchInput.value = '';
    resultsContainer.innerHTML = '';
  } catch (error) {
    console.error('Error sharing task:', error);
    alert('Erreur lors du partage: ' + error.message);
  }
}

// Retirer un partage
async function removeShare(targetUserId) {
  if (!currentTaskId) return;

  try {
    await api.tasks.unshare(currentTaskId, targetUserId);

    // Retirer de la liste
    currentShares = currentShares.filter(s => s.shared_with_user_id !== targetUserId);

    // Rafraichir l'affichage
    renderCurrentShares();
  } catch (error) {
    console.error('Error removing share:', error);
    alert('Erreur lors de la suppression du partage: ' + error.message);
  }
}

// Helpers
function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialisation des event listeners
export function initShareModal() {
  const modal = document.getElementById('shareModal');
  const closeBtn = document.getElementById('shareModalClose');
  const searchInput = document.getElementById('shareUserSearch');

  if (!modal) return;

  // Fermer avec le bouton X
  if (closeBtn) {
    closeBtn.addEventListener('click', closeShareModal);
  }

  // Fermer en cliquant sur l'overlay
  modal.addEventListener('click', e => {
    if (e.target === modal) {
      closeShareModal();
    }
  });

  // Recherche en temps reel
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      handleShareSearch(e.target.value);
    });
  }

  // Fermer avec Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeShareModal();
    }
  });
}
