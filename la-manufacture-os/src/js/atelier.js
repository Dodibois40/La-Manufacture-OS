// FLOW Atelier - Interface simplifiee pour l'atelier

// Configuration API
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333';

// Recuperer le managerId depuis l'URL (ex: /atelier.html?team=123)
const urlParams = new URLSearchParams(window.location.search);
const managerId = urlParams.get('team');

// State
let currentMember = null;
let currentTasks = [];
let currentFiles = [];
let currentFileTab = 'global';

// Elements DOM
const views = {
  select: document.getElementById('view-select'),
  tasks: document.getElementById('view-tasks'),
  files: document.getElementById('view-files'),
};

// ============================================
// UTILS
// ============================================

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'atelier-toast visible' + (type === 'success' ? ' success' : '');

  setTimeout(() => {
    toast.classList.remove('visible');
  }, 3000);
}

function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

function formatDate(date) {
  const d = new Date(date);
  const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const months = [
    'janvier',
    'fevrier',
    'mars',
    'avril',
    'mai',
    'juin',
    'juillet',
    'aout',
    'septembre',
    'octobre',
    'novembre',
    'decembre',
  ];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function switchView(viewName) {
  Object.entries(views).forEach(([name, el]) => {
    el.classList.toggle('hidden', name !== viewName);
  });
}

// ============================================
// API CALLS
// ============================================

async function fetchMembers() {
  if (!managerId) {
    throw new Error("ID equipe manquant. Ajouter ?team=ID a l'URL");
  }

  const response = await fetch(`${API_URL}/api/team/atelier/${managerId}`);
  if (!response.ok) {
    throw new Error('Equipe non trouvee');
  }
  return response.json();
}

async function fetchMemberTasks(memberId) {
  const today = new Date().toISOString().split('T')[0];
  const response = await fetch(`${API_URL}/api/team/tasks/member/${memberId}?date=${today}`);
  if (!response.ok) {
    throw new Error('Erreur chargement taches');
  }
  return response.json();
}

async function toggleTaskDone(taskId, done) {
  const response = await fetch(`${API_URL}/api/team/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ done }),
  });
  if (!response.ok) {
    throw new Error('Erreur mise a jour');
  }
  return response.json();
}

async function fetchFiles(memberId) {
  const response = await fetch(
    `${API_URL}/api/team/atelier/${managerId}/files?member_id=${memberId || ''}`
  );
  if (!response.ok) {
    throw new Error('Erreur chargement fichiers');
  }
  return response.json();
}

// ============================================
// RENDER FUNCTIONS
// ============================================

function renderMembers(members) {
  const grid = document.getElementById('membersGrid');

  if (members.length === 0) {
    grid.innerHTML = '<div class="member-loading">Aucun membre dans l\'equipe</div>';
    return;
  }

  grid.innerHTML = members
    .map(
      member => `
    <div class="member-card" data-id="${member.id}">
      <div class="avatar" style="background-color: ${member.avatar_color}">${getInitials(member.name)}</div>
      <div class="name">${member.name}</div>
    </div>
  `
    )
    .join('');

  // Event listeners
  grid.querySelectorAll('.member-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      const member = members.find(m => String(m.id) === String(id));
      if (member) selectMember(id, member);
    });
  });
}

function renderTasks(tasks) {
  const list = document.getElementById('tasksList');

  if (tasks.length === 0) {
    list.innerHTML = '<div class="tasks-empty">Aucune tache pour aujourd\'hui</div>';
    updateProgress(0, 0);
    return;
  }

  // Trier: non terminees d'abord, urgentes en premier
  const sorted = [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.urgent !== b.urgent) return b.urgent ? 1 : -1;
    return 0;
  });

  list.innerHTML = sorted
    .map(
      task => `
    <div class="task-item ${task.done ? 'completed' : ''}" data-id="${task.id}">
      <div class="task-check">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <div class="task-content">
        <span class="task-text">${task.text}</span>
        ${task.urgent ? '<span class="task-urgent">URGENT</span>' : ''}
      </div>
    </div>
  `
    )
    .join('');

  // Event listeners
  list.querySelectorAll('.task-item').forEach(item => {
    item.addEventListener('click', async () => {
      const taskId = item.dataset.id;
      const task = currentTasks.find(t => String(t.id) === String(taskId));
      if (task) {
        await handleTaskToggle(taskId, !task.done, item);
      }
    });
  });

  updateProgress(tasks.filter(t => t.done).length, tasks.length);
}

function updateProgress(done, total) {
  const fill = document.getElementById('progressFill');
  const text = document.getElementById('progressText');

  const percent = total > 0 ? (done / total) * 100 : 0;
  fill.style.width = `${percent}%`;
  text.textContent = `${done}/${total}`;
}

function renderFiles(files) {
  const list = document.getElementById('filesList');

  // Filtrer selon l'onglet actif
  const filtered = files.filter(f => {
    if (currentFileTab === 'global') return true;
    return f.scope === 'member';
  });

  if (filtered.length === 0) {
    list.innerHTML = '<div class="files-empty">Aucun document</div>';
    return;
  }

  list.innerHTML = filtered
    .map(file => {
      const isPdf = file.mime_type === 'application/pdf';
      const iconClass = isPdf ? 'pdf' : 'image';

      return `
      <div class="file-item" data-id="${file.id}">
        <div class="file-icon ${iconClass}">
          ${
            isPdf
              ? `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          `
              : `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          `
          }
        </div>
        <div class="file-info">
          <div class="file-name">${file.original_name}</div>
          <div class="file-meta">${formatFileSize(file.size)} - ${file.scope === 'global' ? 'Global' : 'Personnel'}</div>
        </div>
        <div class="file-actions">
          <button class="file-action-btn" onclick="window.open('${API_URL}/api/team/files/${file.id}/view', '_blank')">Voir</button>
          <button class="file-action-btn primary" onclick="printFile(${file.id})">Imprimer</button>
        </div>
      </div>
    `;
    })
    .join('');
}

// ============================================
// HANDLERS
// ============================================

async function selectMember(memberId, member) {
  currentMember = member;

  // Mettre a jour l'interface
  document.getElementById('currentMemberAvatar').style.backgroundColor = member.avatar_color;
  document.getElementById('currentMemberAvatar').textContent = getInitials(member.name);
  document.getElementById('currentMemberName').textContent = member.name;
  document.getElementById('tasksDate').textContent = formatDate(new Date());

  // Charger les taches
  try {
    const data = await fetchMemberTasks(memberId);
    currentTasks = data.tasks;
    renderTasks(currentTasks);
    switchView('tasks');
  } catch (error) {
    console.error(error);
    showToast('Erreur: ' + error.message);
  }
}

async function handleTaskToggle(taskId, done, element) {
  try {
    // Animation immediate
    element.classList.toggle('completed', done);
    if (done) {
      element.classList.add('just-completed');
      setTimeout(() => element.classList.remove('just-completed'), 500);
    }

    // Appel API
    await toggleTaskDone(taskId, done);

    // Mettre a jour le state local
    const task = currentTasks.find(t => t.id === taskId);
    if (task) task.done = done;

    // Mettre a jour la progression
    updateProgress(currentTasks.filter(t => t.done).length, currentTasks.length);

    if (done) {
      showToast('Bien joue !', 'success');
    }
  } catch (error) {
    console.error(error);
    // Rollback visuel
    element.classList.toggle('completed', !done);
    showToast('Erreur: ' + error.message);
  }
}

async function showFiles() {
  try {
    const data = await fetchFiles(currentMember?.id);
    currentFiles = data.files;
    renderFiles(currentFiles);
    switchView('files');
  } catch (error) {
    console.error(error);
    showToast('Erreur: ' + error.message);
  }
}

// Fonction globale pour imprimer
window.printFile = function (fileId) {
  const printWindow = window.open(`${API_URL}/api/team/files/${fileId}/view`, '_blank');
  printWindow.onload = function () {
    printWindow.print();
  };
};

// ============================================
// INIT
// ============================================

async function init() {
  // Verifier qu'on a un managerId
  if (!managerId) {
    document.getElementById('membersGrid').innerHTML = `
      <div class="member-error">
        <p>Lien invalide</p>
        <p style="font-size: 0.9rem; margin-top: 10px;">Demandez le lien d'acces a votre responsable</p>
      </div>
    `;
    return;
  }

  try {
    const data = await fetchMembers();
    renderMembers(data.members);

    // Afficher le nom de l'equipe dans le header
    document.querySelector('.atelier-subtitle').textContent = `Equipe ${data.manager.name}`;
  } catch (error) {
    console.error(error);
    document.getElementById('membersGrid').innerHTML = `
      <div class="member-error">${error.message}</div>
    `;
  }

  // Event listeners
  document.getElementById('backBtn').addEventListener('click', () => {
    switchView('select');
    currentMember = null;
  });

  document.getElementById('filesBtn').addEventListener('click', showFiles);

  document.getElementById('backFromFilesBtn').addEventListener('click', () => {
    switchView('tasks');
  });

  // File tabs
  document.querySelectorAll('.file-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.file-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFileTab = tab.dataset.tab;
      renderFiles(currentFiles);
    });
  });
}

// Demarrer l'app
init();
