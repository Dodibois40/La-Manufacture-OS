import { api, isApiMode } from './api-client.js';
import { initClerk, isSignedIn } from './clerk-auth.js';

// Toast notification helper
function toast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `alert alert-${type}`;
  toast.style.position = 'fixed';
  toast.style.bottom = '20px';
  toast.style.right = '20px';
  toast.style.zIndex = '10000';
  toast.style.minWidth = '300px';
  toast.innerHTML = `
    <div class="alert-content">
      <div class="alert-message">${message}</div>
    </div>
  `;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Modal helpers
function openModal(modalId) {
  document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

window.closeModal = closeModal;

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const targetTab = tab.dataset.tab;

    // Update active states
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

    tab.classList.add('active');
    document.getElementById(targetTab).classList.add('active');
  });
});

// State
let members = [];
let projects = [];
let files = [];

// ==========================================
// MEMBERS TAB
// ==========================================

async function loadMembers() {
  try {
    if (!isApiMode || !isSignedIn()) return;

    const response = await api.team.getMembers();
    members = response.members || [];
    renderMembers();
  } catch (error) {
    console.error('Error loading members:', error);
    toast('Erreur lors du chargement des membres', 'danger');
  }
}

function renderMembers() {
  const grid = document.getElementById('membersGrid');

  if (members.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">👥</div>
        <div class="empty-state-title">Aucun membre</div>
        <div class="empty-state-message">Ajoutez votre premier membre d'équipe</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = members.map(member => `
    <div class="team-card">
      <div class="team-card-header">
        <div class="avatar" style="background: ${member.avatar_color};">
          ${member.name.charAt(0).toUpperCase()}
        </div>
        <div class="team-card-info">
          <div class="team-card-name">${member.name}</div>
          <div class="team-card-meta">Membre actif</div>
        </div>
      </div>
      <div class="team-card-actions">
        <button class="btn btn-secondary btn-sm" onclick="editMember('${member.id}')">
          Modifier
        </button>
        <button class="btn btn-danger btn-sm" onclick="deleteMember('${member.id}')">
          Supprimer
        </button>
      </div>
    </div>
  `).join('');
}

// Add member
document.getElementById('addMemberBtn').addEventListener('click', () => {
  document.getElementById('memberName').value = '';
  openModal('addMemberModal');
});

document.getElementById('saveMemberBtn').addEventListener('click', async () => {
  const name = document.getElementById('memberName').value.trim();

  if (!name) {
    toast('Le nom est requis', 'warning');
    return;
  }

  try {
    await api.team.addMember(name);
    toast('Membre ajouté avec succès', 'success');
    closeModal('addMemberModal');
    await loadMembers();
  } catch (error) {
    console.error('Error adding member:', error);
    toast('Erreur lors de l\'ajout du membre', 'danger');
  }
});

// Delete member
window.deleteMember = async (memberId) => {
  if (!confirm('Êtes-vous sûr de vouloir supprimer ce membre ?')) return;

  try {
    await api.team.deleteMember(memberId);
    toast('Membre supprimé', 'success');
    await loadMembers();
  } catch (error) {
    console.error('Error deleting member:', error);
    toast('Erreur lors de la suppression', 'danger');
  }
};

// ==========================================
// PROJECTS TAB
// ==========================================

async function loadProjects() {
  try {
    if (!isApiMode || !isSignedIn()) return;

    const response = await api.projects.getAll();
    projects = response.projects || [];
    renderProjects();
  } catch (error) {
    console.error('Error loading projects:', error);
    toast('Erreur lors du chargement des projets', 'danger');
  }
}

function renderProjects() {
  const grid = document.getElementById('projectsGrid');

  if (projects.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📁</div>
        <div class="empty-state-title">Aucun projet</div>
        <div class="empty-state-message">Créez votre premier projet pour commencer</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = projects.map(project => {
    const statusBadge = project.status === 'completed' ? 'badge-success' :
                        project.status === 'archived' ? 'badge-neutral' : 'badge-primary';

    // Format assigned members
    const assignedMembers = project.assigned_members || [];
    const membersText = assignedMembers.length > 0
      ? assignedMembers.map(m => m.name).join(', ')
      : 'Non assigné';

    return `
      <div class="team-card">
        <div class="team-card-header">
          <div class="team-card-info">
            <div class="team-card-name">${project.name}</div>
            <div class="team-card-meta">
              ${assignedMembers.length > 0 ? '👥 ' : ''}${membersText}
            </div>
          </div>
          <span class="badge ${statusBadge}">${project.status}</span>
        </div>
        ${project.description ? `<div class="team-card-desc">${project.description}</div>` : ''}
        ${project.deadline ? `
          <div class="team-card-meta" style="margin-top: 8px;">
            📅 ${new Date(project.deadline).toLocaleDateString('fr-FR')}
          </div>
        ` : ''}
        <div class="team-card-actions">
          <button class="btn btn-secondary btn-sm" onclick="editProject('${project.id}')">
            Modifier
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteProject('${project.id}')">
            Supprimer
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Helper function to populate member checkboxes
function populateMemberCheckboxes(selectedMemberIds = []) {
  const container = document.getElementById('projectMembersList');

  if (members.length === 0) {
    container.innerHTML = '<div class="checkbox-list-empty">Aucun membre disponible</div>';
    return;
  }

  container.innerHTML = members.map(member => `
    <div class="checkbox-item">
      <input
        type="checkbox"
        id="member-${member.id}"
        value="${member.id}"
        ${selectedMemberIds.includes(member.id) ? 'checked' : ''}
      >
      <div class="avatar" style="background: ${member.avatar_color};">
        ${member.name.charAt(0).toUpperCase()}
      </div>
      <label for="member-${member.id}">${member.name}</label>
    </div>
  `).join('');
}

// Helper function to get selected member IDs
function getSelectedMemberIds() {
  const checkboxes = document.querySelectorAll('#projectMembersList input[type="checkbox"]:checked');
  return Array.from(checkboxes).map(cb => parseInt(cb.value));
}

// Add project
document.getElementById('addProjectBtn').addEventListener('click', async () => {
  document.getElementById('projectModalTitle').textContent = 'Créer un projet';
  document.getElementById('projectId').value = '';
  document.getElementById('projectName').value = '';
  document.getElementById('projectDescription').value = '';
  document.getElementById('projectDeadline').value = '';
  document.getElementById('saveProjectBtn').textContent = 'Créer';

  // Populate member checkboxes (none selected)
  populateMemberCheckboxes([]);

  openModal('projectModal');
});

document.getElementById('saveProjectBtn').addEventListener('click', async () => {
  const id = document.getElementById('projectId').value;
  const name = document.getElementById('projectName').value.trim();
  const description = document.getElementById('projectDescription').value.trim();
  const member_ids = getSelectedMemberIds();
  const deadline = document.getElementById('projectDeadline').value || null;

  if (!name) {
    toast('Le nom du projet est requis', 'warning');
    return;
  }

  try {
    if (id) {
      // Update
      await api.projects.update(id, { name, description, member_ids, deadline });
      toast('Projet modifié', 'success');
    } else {
      // Create
      await api.projects.create(name, description, member_ids, deadline);
      toast('Projet créé', 'success');
    }
    closeModal('projectModal');
    await loadProjects();
  } catch (error) {
    console.error('Error saving project:', error);
    toast('Erreur lors de la sauvegarde', 'danger');
  }
});

// Edit project
window.editProject = async (projectId) => {
  const project = projects.find(p => p.id === projectId);
  if (!project) return;

  document.getElementById('projectModalTitle').textContent = 'Modifier le projet';
  document.getElementById('projectId').value = project.id;
  document.getElementById('projectName').value = project.name;
  document.getElementById('projectDescription').value = project.description || '';
  document.getElementById('projectDeadline').value = project.deadline || '';
  document.getElementById('saveProjectBtn').textContent = 'Modifier';

  // Populate member checkboxes with selected members
  const selectedMemberIds = (project.assigned_members || []).map(m => m.id);
  populateMemberCheckboxes(selectedMemberIds);

  openModal('projectModal');
};

// Delete project
window.deleteProject = async (projectId) => {
  if (!confirm('Êtes-vous sûr de vouloir supprimer ce projet ?')) return;

  try {
    await api.projects.delete(projectId);
    toast('Projet supprimé', 'success');
    await loadProjects();
  } catch (error) {
    console.error('Error deleting project:', error);
    toast('Erreur lors de la suppression', 'danger');
  }
};

// ==========================================
// DOCUMENTS TAB
// ==========================================

async function loadFiles() {
  try {
    if (!isApiMode || !isSignedIn()) return;

    const response = await api.team.getFiles();
    files = response.files || [];
    renderFiles();
  } catch (error) {
    console.error('Error loading files:', error);
    toast('Erreur lors du chargement des fichiers', 'danger');
  }
}

function renderFiles() {
  const list = document.getElementById('filesList');

  if (files.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📄</div>
        <div class="empty-state-title">Aucun document</div>
        <div class="empty-state-message">Téléchargez votre premier document</div>
      </div>
    `;
    return;
  }

  list.innerHTML = files.map(file => {
    const size = (file.size / 1024).toFixed(1) + ' KB';
    const date = new Date(file.created_at).toLocaleDateString('fr-FR');

    return `
      <div class="team-file-item">
        <div class="team-file-info">
          <div class="file-icon">📄</div>
          <div>
            <div class="team-file-name">${file.original_name}</div>
            <div class="team-file-meta">${size} • ${date}</div>
          </div>
        </div>
        <div class="team-file-actions">
          <button class="btn btn-secondary btn-sm" onclick="downloadFile('${file.filename}')">
            Télécharger
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteFile('${file.id}')">
            Supprimer
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Upload document
document.getElementById('uploadDocBtn').addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.team.uploadFile(formData);
      toast('Document téléchargé', 'success');
      await loadFiles();
    } catch (error) {
      console.error('Error uploading file:', error);
      toast('Erreur lors du téléchargement', 'danger');
    }
  };
  input.click();
});

// Download file
window.downloadFile = (filename) => {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333';
  window.open(`${API_URL}/api/team/files/${filename}/download`, '_blank');
};

// Delete file
window.deleteFile = async (fileId) => {
  if (!confirm('Êtes-vous sûr de vouloir supprimer ce fichier ?')) return;

  try {
    await api.team.deleteFile(fileId);
    toast('Fichier supprimé', 'success');
    await loadFiles();
  } catch (error) {
    console.error('Error deleting file:', error);
    toast('Erreur lors de la suppression', 'danger');
  }
};

// ==========================================
// NAVIGATION
// ==========================================

document.getElementById('nav-day')?.addEventListener('click', () => {
  window.location.href = '/';
});

document.getElementById('nav-week')?.addEventListener('click', () => {
  window.location.href = '/';
});

document.getElementById('nav-inbox')?.addEventListener('click', () => {
  window.location.href = '/';
});

document.getElementById('nav-config')?.addEventListener('click', () => {
  window.location.href = '/';
});

// ==========================================
// INITIALIZATION
// ==========================================

async function init() {
  // Initialize Clerk first
  await initClerk();

  if (!isApiMode || !isSignedIn()) {
    toast('Vous devez être connecté pour accéder à cette page', 'warning');
    setTimeout(() => {
      window.location.href = '/';
    }, 2000);
    return;
  }

  await Promise.all([
    loadMembers(),
    loadProjects(),
    loadFiles()
  ]);
}

init();
