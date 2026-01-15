import { api, isApiMode } from './api-client.js';
import { isLoggedIn } from './clerk-auth.js';

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
    if (!isApiMode || !isLoggedIn()) return;

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
    <div class="member-card" onclick="openMemberDetails('${member.id}')">
      <div class="member-info">
        <div class="avatar avatar-md" style="background: ${member.avatar_color};">
          ${member.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style="font-weight: 600; color: var(--text-main);">${member.name}</div>
          <div style="font-size: 0.85rem; color: var(--text-sec);">Membre actif</div>
        </div>
      </div>
      <div style="display: flex; gap: 8px; margin-top: 12px;">
        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); editMember('${member.id}')">
          Modifier
        </button>
        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteMember('${member.id}')">
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
    if (!isApiMode || !isLoggedIn()) return;

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

    return `
      <div class="project-card" onclick="openProjectDetails('${project.id}')">
        <div class="project-header">
          <div class="project-name">${project.name}</div>
          <span class="badge ${statusBadge}">${project.status}</span>
        </div>
        ${project.description ? `<div class="project-description">${project.description}</div>` : ''}
        <div class="project-meta">
          ${project.assigned_to_name ? `
            <div style="display: flex; align-items: center; gap: 6px;">
              <div class="avatar avatar-sm" style="background: ${project.avatar_color};">
                ${project.assigned_to_name.charAt(0).toUpperCase()}
              </div>
              <span>${project.assigned_to_name}</span>
            </div>
          ` : '<span>Non assigné</span>'}
          ${project.deadline ? `<span>📅 ${new Date(project.deadline).toLocaleDateString('fr-FR')}</span>` : ''}
        </div>
        <div style="display: flex; gap: 8px; margin-top: 16px;">
          <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); editProject('${project.id}')">
            Modifier
          </button>
          <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteProject('${project.id}')">
            Supprimer
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Add project
document.getElementById('addProjectBtn').addEventListener('click', async () => {
  document.getElementById('projectModalTitle').textContent = 'Créer un projet';
  document.getElementById('projectId').value = '';
  document.getElementById('projectName').value = '';
  document.getElementById('projectDescription').value = '';
  document.getElementById('projectAssignedTo').value = '';
  document.getElementById('projectDeadline').value = '';
  document.getElementById('saveProjectBtn').textContent = 'Créer';

  // Populate members dropdown
  const select = document.getElementById('projectAssignedTo');
  select.innerHTML = '<option value="">Non assigné</option>' +
    members.map(m => `<option value="${m.id}">${m.name}</option>`).join('');

  openModal('projectModal');
});

document.getElementById('saveProjectBtn').addEventListener('click', async () => {
  const id = document.getElementById('projectId').value;
  const name = document.getElementById('projectName').value.trim();
  const description = document.getElementById('projectDescription').value.trim();
  const assigned_to = document.getElementById('projectAssignedTo').value || null;
  const deadline = document.getElementById('projectDeadline').value || null;

  if (!name) {
    toast('Le nom du projet est requis', 'warning');
    return;
  }

  try {
    if (id) {
      // Update
      await api.projects.update(id, { name, description, assigned_to, deadline });
      toast('Projet modifié', 'success');
    } else {
      // Create
      await api.projects.create(name, description, assigned_to, deadline);
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

  // Populate members dropdown
  const select = document.getElementById('projectAssignedTo');
  select.innerHTML = '<option value="">Non assigné</option>' +
    members.map(m => `<option value="${m.id}" ${m.id == project.assigned_to ? 'selected' : ''}>${m.name}</option>`).join('');

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
    if (!isApiMode || !isLoggedIn()) return;

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
      <li class="empty-state">
        <div class="empty-state-icon">📄</div>
        <div class="empty-state-title">Aucun document</div>
        <div class="empty-state-message">Téléchargez votre premier document</div>
      </li>
    `;
    return;
  }

  list.innerHTML = files.map(file => {
    const size = (file.size / 1024).toFixed(1) + ' KB';
    const date = new Date(file.created_at).toLocaleDateString('fr-FR');

    return `
      <li class="file-item">
        <div class="file-info">
          <div class="file-icon">📄</div>
          <div style="flex: 1;">
            <div class="file-name">${file.original_name}</div>
            <div class="file-meta">${size} • ${date}</div>
          </div>
        </div>
        <div class="file-actions">
          <button class="btn btn-secondary btn-sm" onclick="downloadFile('${file.filename}', '${file.original_name}')">
            Télécharger
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteFile('${file.id}')">
            Supprimer
          </button>
        </div>
      </li>
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
window.downloadFile = (filename, originalName) => {
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
// INITIALIZATION
// ==========================================

async function init() {
  if (!isApiMode || !isLoggedIn()) {
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
