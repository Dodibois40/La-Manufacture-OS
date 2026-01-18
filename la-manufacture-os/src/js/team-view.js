// Team View Module (SPA integration)
import { api } from './api-client.js';
import { toast } from './utils.js';

// Module state
let initialized = false;
let members = [];
let projects = [];
let files = [];
let invitations = [];

// =====================================================
// INITIALIZATION
// =====================================================

export async function initTeamView() {
  if (initialized) {
    // Just reload data on re-visit
    await Promise.all([loadMembers(), loadInvitations(), loadProjects(), loadFiles()]);
    return;
  }

  initialized = true;

  try {
    // Setup tab switching
    setupTabSwitching();

    // Load data
    await Promise.all([loadMembers(), loadInvitations(), loadProjects(), loadFiles()]);

    // Setup event listeners (only once)
    setupEventListeners();
  } catch (error) {
    console.error('[TeamView] Init error:', error);
    toast('Erreur lors du chargement', 'danger');
  }
}

// =====================================================
// TAB SWITCHING
// =====================================================

function setupTabSwitching() {
  const tabsContainer = document.querySelector('#view-team .tabs');
  if (!tabsContainer) return;

  const tabs = Array.from(document.querySelectorAll('#view-team .tab'));
  const tabPanes = Array.from(document.querySelectorAll('#view-team .tab-pane'));

  tabsContainer.addEventListener('click', e => {
    const tab = e.target.closest('.tab');
    if (!tab) return;

    const targetTab = tab.dataset.tab;
    const targetPane = document.getElementById('team-' + targetTab);
    if (!targetPane) return;

    // Update active states
    tabs.forEach(t => t.classList.remove('active'));
    tabPanes.forEach(p => p.classList.remove('active'));

    tab.classList.add('active');
    targetPane.classList.add('active');
  });
}

// ==========================================
// MEMBERS TAB
// ==========================================

async function loadMembers() {
  try {
    const response = await api.team.getMembers();
    members = response.members || [];
    renderMembers();
  } catch (error) {
    console.error('Error loading members:', error);
    toast('Erreur lors du chargement des membres', 'danger');
  }
}

function renderMembers() {
  const grid = document.getElementById('teamMembersGrid');
  if (!grid) return;

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

  grid.innerHTML = members
    .map(
      member => `
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
        <button class="btn btn-secondary btn-sm edit-member-btn" data-member-id="${member.id}">
          Modifier
        </button>
        <button class="btn btn-danger btn-sm delete-member-btn" data-member-id="${member.id}">
          Supprimer
        </button>
      </div>
    </div>
  `
    )
    .join('');

  // Add event listeners
  grid.querySelectorAll('.delete-member-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteMember(btn.dataset.memberId));
  });
}

async function deleteMember(memberId) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer ce membre ?')) return;

  try {
    await api.team.deleteMember(memberId);
    toast('Membre supprimé', 'success');
    await loadMembers();
  } catch (error) {
    console.error('Error deleting member:', error);
    toast('Erreur lors de la suppression', 'danger');
  }
}

// ==========================================
// PROJECTS TAB
// ==========================================

async function loadProjects() {
  try {
    const response = await api.projects.getAll();
    projects = response.projects || [];
    renderProjects();
  } catch (error) {
    console.error('Error loading projects:', error);
    toast('Erreur lors du chargement des projets', 'danger');
  }
}

function renderProjects() {
  const grid = document.getElementById('teamProjectsGrid');
  if (!grid) return;

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

  grid.innerHTML = projects
    .map(project => {
      const statusBadge =
        project.status === 'completed'
          ? 'badge-success'
          : project.status === 'archived'
            ? 'badge-neutral'
            : 'badge-primary';

      // Format assigned members
      const assignedMembers = project.assigned_members || [];
      const membersText =
        assignedMembers.length > 0 ? assignedMembers.map(m => m.name).join(', ') : 'Non assigné';

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
        ${
          project.deadline
            ? `
          <div class="team-card-meta" style="margin-top: 8px;">
            📅 ${new Date(project.deadline).toLocaleDateString('fr-FR')}
          </div>
        `
            : ''
        }
        <div class="team-card-actions">
          <button class="btn btn-secondary btn-sm edit-project-btn" data-project-id="${project.id}">
            Modifier
          </button>
          <button class="btn btn-danger btn-sm delete-project-btn" data-project-id="${project.id}">
            Supprimer
          </button>
        </div>
      </div>
    `;
    })
    .join('');

  // Add event listeners
  grid.querySelectorAll('.edit-project-btn').forEach(btn => {
    btn.addEventListener('click', () => editProject(btn.dataset.projectId));
  });

  grid.querySelectorAll('.delete-project-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteProject(btn.dataset.projectId));
  });
}

function populateMemberCheckboxes(selectedMemberIds = []) {
  const container = document.getElementById('projectMembersList');
  if (!container) return;

  if (members.length === 0) {
    container.innerHTML = '<div class="checkbox-list-empty">Aucun membre disponible</div>';
    return;
  }

  container.innerHTML = members
    .map(
      member => `
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
  `
    )
    .join('');
}

function getSelectedMemberIds() {
  const checkboxes = document.querySelectorAll(
    '#projectMembersList input[type="checkbox"]:checked'
  );
  return Array.from(checkboxes).map(cb => parseInt(cb.value));
}

function openProjectModal(project = null) {
  const modal = document.getElementById('projectModal');
  if (!modal) return;

  document.getElementById('projectModalTitle').textContent = project
    ? 'Modifier le projet'
    : 'Créer un projet';
  document.getElementById('projectId').value = project?.id || '';
  document.getElementById('projectName').value = project?.name || '';
  document.getElementById('projectDescription').value = project?.description || '';
  document.getElementById('projectDeadline').value = project?.deadline || '';
  document.getElementById('saveProjectBtn').textContent = project ? 'Modifier' : 'Créer';

  // Populate member checkboxes
  const selectedMemberIds = project ? (project.assigned_members || []).map(m => m.id) : [];
  populateMemberCheckboxes(selectedMemberIds);

  modal.classList.add('active');
}

async function saveProject() {
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
    closeProjectModal();
    await loadProjects();
  } catch (error) {
    console.error('Error saving project:', error);
    toast('Erreur lors de la sauvegarde', 'danger');
  }
}

function editProject(projectId) {
  const project = projects.find(p => p.id === projectId);
  if (project) openProjectModal(project);
}

async function deleteProject(projectId) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer ce projet ?')) return;

  try {
    await api.projects.delete(projectId);
    toast('Projet supprimé', 'success');
    await loadProjects();
  } catch (error) {
    console.error('Error deleting project:', error);
    toast('Erreur lors de la suppression', 'danger');
  }
}

function closeProjectModal() {
  const modal = document.getElementById('projectModal');
  if (modal) modal.classList.remove('active');
}

// ==========================================
// DOCUMENTS TAB
// ==========================================

async function loadFiles() {
  try {
    const response = await api.team.getFiles();
    files = response.files || [];
    renderFiles();
  } catch (error) {
    console.error('Error loading files:', error);
    toast('Erreur lors du chargement des fichiers', 'danger');
  }
}

function renderFiles() {
  const list = document.getElementById('teamFilesList');
  if (!list) return;

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

  list.innerHTML = files
    .map(file => {
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
          <button class="btn btn-secondary btn-sm download-file-btn" data-filename="${file.filename}">
            Télécharger
          </button>
          <button class="btn btn-danger btn-sm delete-file-btn" data-file-id="${file.id}">
            Supprimer
          </button>
        </div>
      </div>
    `;
    })
    .join('');

  // Add event listeners
  list.querySelectorAll('.download-file-btn').forEach(btn => {
    btn.addEventListener('click', () => downloadFile(btn.dataset.filename));
  });

  list.querySelectorAll('.delete-file-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteFile(btn.dataset.fileId));
  });
}

function downloadFile(filename) {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333';
  window.open(`${API_URL}/api/team/files/${filename}/download`, '_blank');
}

async function deleteFile(fileId) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer ce fichier ?')) return;

  try {
    await api.team.deleteFile(fileId);
    toast('Fichier supprimé', 'success');
    await loadFiles();
  } catch (error) {
    console.error('Error deleting file:', error);
    toast('Erreur lors de la suppression', 'danger');
  }
}

async function uploadFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.onchange = async e => {
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
}

// ==========================================
// INVITATIONS TAB
// ==========================================

async function loadInvitations() {
  try {
    const response = await api.invitations.list();
    invitations = response.invitations || [];
    renderInvitations();
  } catch (error) {
    console.error('Error loading invitations:', error);
    toast('Erreur lors du chargement des invitations', 'danger');
  }
}

function renderInvitations() {
  const list = document.getElementById('teamInvitationsList');
  if (!list) return;

  if (invitations.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📧</div>
        <div class="empty-state-title">Aucune invitation</div>
        <div class="empty-state-message">Invitez des membres à rejoindre votre équipe</div>
      </div>
    `;
    return;
  }

  list.innerHTML = invitations
    .map(invite => {
      const metadata = invite.metadata || {};
      const statusBadge = getInvitationStatusBadge(invite.status);
      const expiresAt = new Date(invite.expires_at);
      const isExpired = expiresAt < new Date();

      return `
      <div class="invitation-card">
        <div class="invitation-header">
          <div>
            <h3 class="invitation-name">${metadata.invited_name || 'Membre'}</h3>
            <p class="invitation-email">${invite.email}</p>
          </div>
          ${statusBadge}
        </div>
        <div class="invitation-meta">
          <span>Envoyée: ${new Date(invite.invited_at).toLocaleDateString('fr-FR')}</span>
          <span>Expire: ${expiresAt.toLocaleDateString('fr-FR')}</span>
        </div>
        ${
          invite.status === 'pending' && !isExpired
            ? `
          <div class="invitation-actions">
            <button class="btn btn-sm btn-secondary resend-invite-btn" data-invite-id="${invite.id}">Renvoyer</button>
            <button class="btn btn-sm btn-danger revoke-invite-btn" data-invite-id="${invite.id}">Révoquer</button>
          </div>
        `
            : ''
        }
        ${
          invite.status === 'accepted' && invite.member_name
            ? `
          <div class="invitation-info">
            <span style="color: #10b981;">✓ Acceptée par ${invite.member_name}</span>
          </div>
        `
            : ''
        }
      </div>
    `;
    })
    .join('');

  // Add event listeners
  list.querySelectorAll('.resend-invite-btn').forEach(btn => {
    btn.addEventListener('click', () => resendInvitation(btn.dataset.inviteId));
  });

  list.querySelectorAll('.revoke-invite-btn').forEach(btn => {
    btn.addEventListener('click', () => revokeInvitation(btn.dataset.inviteId));
  });
}

function getInvitationStatusBadge(status) {
  const badges = {
    pending: '<span class="badge badge-warning">En attente</span>',
    accepted: '<span class="badge badge-success">Acceptée</span>',
    expired: '<span class="badge badge-danger">Expirée</span>',
    revoked: '<span class="badge badge-danger">Révoquée</span>',
  };
  return badges[status] || '<span class="badge">Inconnu</span>';
}

function openInviteModal() {
  const modal = document.getElementById('inviteMemberModal');
  if (modal) modal.classList.add('active');
}

async function sendInvitation() {
  const email = document.getElementById('inviteEmail').value.trim();
  const name = document.getElementById('inviteName').value.trim();
  const color = document.getElementById('inviteColor').value;

  if (!email || !name) {
    toast('Veuillez remplir tous les champs requis', 'warning');
    return;
  }

  try {
    const response = await api.invitations.create(email, name, color);

    if (response.emailSent) {
      toast(`Invitation envoyée à ${email} !`, 'success');
    } else {
      toast(`Invitation créée mais email non envoyé: ${response.emailError}`, 'warning');
    }

    closeInviteModal();
    document.getElementById('inviteEmail').value = '';
    document.getElementById('inviteName').value = '';
    document.getElementById('inviteColor').value = '#3b82f6';

    await loadInvitations();
  } catch (error) {
    console.error('Error sending invitation:', error);
    toast(error.message || "Erreur lors de l'envoi de l'invitation", 'danger');
  }
}

async function revokeInvitation(invitationId) {
  if (!confirm('Êtes-vous sûr de vouloir révoquer cette invitation ?')) return;

  try {
    await api.invitations.revoke(invitationId);
    toast('Invitation révoquée', 'success');
    await loadInvitations();
  } catch (error) {
    console.error('Error revoking invitation:', error);
    toast(error.message || 'Erreur lors de la révocation', 'danger');
  }
}

async function resendInvitation(invitationId) {
  try {
    const response = await api.invitations.resend(invitationId);

    if (response.emailSent) {
      toast('Invitation renvoyée !', 'success');
    } else {
      toast(`Erreur d'envoi: ${response.emailError}`, 'warning');
    }
  } catch (error) {
    console.error('Error resending invitation:', error);
    toast(error.message || 'Erreur lors du renvoi', 'danger');
  }
}

function closeInviteModal() {
  const modal = document.getElementById('inviteMemberModal');
  if (modal) modal.classList.remove('active');
}

// ==========================================
// EVENT LISTENERS
// ==========================================

function setupEventListeners() {
  // Add project button
  const addProjectBtn = document.getElementById('addProjectBtn');
  if (addProjectBtn) {
    addProjectBtn.addEventListener('click', () => openProjectModal());
  }

  // Save project button
  const saveProjectBtn = document.getElementById('saveProjectBtn');
  if (saveProjectBtn) {
    saveProjectBtn.addEventListener('click', saveProject);
  }

  // Upload document button
  const uploadDocBtn = document.getElementById('uploadDocBtn');
  if (uploadDocBtn) {
    uploadDocBtn.addEventListener('click', uploadFile);
  }

  // Invite member button
  const inviteMemberBtn = document.getElementById('inviteMemberBtn');
  if (inviteMemberBtn) {
    inviteMemberBtn.addEventListener('click', openInviteModal);
  }

  // Send invitation button
  const sendInviteBtn = document.getElementById('sendInviteBtn');
  if (sendInviteBtn) {
    sendInviteBtn.addEventListener('click', sendInvitation);
  }

  // Modal close buttons
  document
    .querySelectorAll('#projectModal .modal-close, #projectModal .btn-secondary')
    .forEach(btn => {
      btn.addEventListener('click', closeProjectModal);
    });

  document
    .querySelectorAll('#inviteMemberModal .modal-close, #inviteMemberModal .btn-secondary')
    .forEach(btn => {
      btn.addEventListener('click', closeInviteModal);
    });
}

// Export for app.js to close modals on view change
export function closeTeamModals() {
  closeProjectModal();
  closeInviteModal();
}
