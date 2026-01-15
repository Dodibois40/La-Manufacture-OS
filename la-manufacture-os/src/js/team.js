// Team Management - Gestion de l'equipe
import { api, isApiMode } from './api-client.js';
import { toast } from './utils.js';

let teamMembers = [];
let teamFiles = [];
let currentUserId = null;
let onMembersChangeCallbacks = [];

// Export team members for other modules (inbox)
export const getTeamMembers = () => teamMembers;

// Register callback when members list changes
export const onTeamMembersChange = (callback) => {
  onMembersChangeCallbacks.push(callback);
};

// Notify all callbacks
const notifyMembersChange = () => {
  onMembersChangeCallbacks.forEach(cb => cb(teamMembers));
};

// Helpers
function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ============================================
// RENDER
// ============================================

function renderMembers() {
  const list = document.getElementById('teamMembersList');
  const select = document.getElementById('teamMemberSelect');
  const fileSelect = document.getElementById('fileTargetMember');

  if (!list) return;

  if (teamMembers.length === 0) {
    list.innerHTML = '<div class="team-members-empty">Aucun membre. Cliquez sur "+ Ajouter"</div>';
  } else {
    list.innerHTML = teamMembers.map(member => `
      <div class="team-member-item" data-id="${member.id}">
        <div class="team-member-avatar" style="background-color: ${member.avatar_color}">${getInitials(member.name)}</div>
        <span class="team-member-name">${member.name}</span>
        <button class="team-member-delete" data-id="${member.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    `).join('');

    // Delete handlers
    list.querySelectorAll('.team-member-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        await deleteMember(id);
      });
    });
  }

  // Update selects
  const options = '<option value="">Selectionner un membre...</option>' +
    teamMembers.map(m => `<option value="${m.id}">${m.name}</option>`).join('');

  if (select) select.innerHTML = options;
  if (fileSelect) {
    fileSelect.innerHTML = '<option value="">Ou choisir un membre...</option>' +
      teamMembers.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
  }
}

function renderFiles() {
  const list = document.getElementById('teamFilesList');
  if (!list) return;

  if (teamFiles.length === 0) {
    list.innerHTML = '<div class="team-files-empty">Aucun document partage</div>';
    return;
  }

  list.innerHTML = teamFiles.map(file => {
    const isPdf = file.mime_type === 'application/pdf';
    const iconClass = isPdf ? '' : 'image';
    const memberName = file.member_name || 'Global';

    return `
      <div class="team-file-item" data-id="${file.id}">
        <div class="team-file-icon ${iconClass}">
          ${isPdf ? `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          ` : `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          `}
        </div>
        <div class="team-file-info">
          <div class="team-file-name">${file.original_name}</div>
          <div class="team-file-meta">${formatFileSize(file.size)} - ${memberName}</div>
        </div>
        <button class="team-file-delete" data-id="${file.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    `;
  }).join('');

  // Delete handlers
  list.querySelectorAll('.team-file-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      await deleteFile(id);
    });
  });
}

// ============================================
// API CALLS
// ============================================

async function loadMembers() {
  try {
    const response = await api.team.getMembers();
    teamMembers = response.members || [];
    renderMembers();
    notifyMembersChange();
  } catch (error) {
    console.error('Error loading team members:', error);
  }
}

async function loadFiles() {
  try {
    const response = await api.team.getFiles();
    teamFiles = response.files || [];
    renderFiles();
  } catch (error) {
    console.error('Error loading team files:', error);
  }
}

async function addMember(name) {
  try {
    const response = await api.team.addMember(name);
    teamMembers.push(response.member);
    renderMembers();
    notifyMembersChange();
    toast('Membre ajoute');
  } catch (error) {
    console.error('Error adding member:', error);
    toast('Erreur: ' + error.message);
  }
}

async function deleteMember(id) {
  if (!confirm('Supprimer ce membre ? Ses taches seront aussi supprimees.')) return;

  try {
    console.log(`Suppression du membre ${id}...`);
    await api.team.deleteMember(id);
    teamMembers = teamMembers.filter(m => String(m.id) !== String(id));
    renderMembers();
    notifyMembersChange();
    toast('Membre supprime');
  } catch (error) {
    console.error('Error deleting member:', error);
    toast('Erreur: ' + error.message, 'error');
  }
}

async function addTask(memberId, text, date, urgent) {
  try {
    await api.team.addTask(memberId, text, date, urgent);
    toast('Tache assignee');
    return true;
  } catch (error) {
    console.error('Error adding task:', error);
    toast('Erreur: ' + error.message);
    return false;
  }
}

async function uploadFile(file, memberId) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    if (memberId) {
      formData.append('team_member_id', memberId);
    }

    const response = await api.team.uploadFile(formData);
    teamFiles.unshift(response.file);
    renderFiles();
    toast('Fichier uploade');
  } catch (error) {
    console.error('Error uploading file:', error);
    toast('Erreur: ' + error.message);
  }
}

async function deleteFile(id) {
  if (!confirm('Supprimer ce fichier ?')) return;

  try {
    await api.team.deleteFile(id);
    teamFiles = teamFiles.filter(f => String(f.id) !== String(id));
    renderFiles();
    toast('Fichier supprime');
  } catch (error) {
    console.error('Error deleting file:', error);
    toast('Erreur: ' + error.message);
  }
}

// ============================================
// INIT
// ============================================

export async function initTeam(userId) {
  if (!isApiMode) return;

  currentUserId = userId;

  const teamSection = document.getElementById('teamSection');
  if (!teamSection) return;

  // Show team section
  teamSection.style.display = 'block';

  // Set atelier link
  const atelierLink = document.getElementById('atelierLink');
  if (atelierLink) {
    const baseUrl = window.location.origin;
    atelierLink.value = `${baseUrl}/atelier.html?team=${userId}`;
  }

  // Copy link button
  document.getElementById('copyLinkBtn')?.addEventListener('click', () => {
    const link = document.getElementById('atelierLink');
    if (link) {
      navigator.clipboard.writeText(link.value).then(() => {
        toast('Lien copie !');
      }).catch(() => {
        link.select();
        document.execCommand('copy');
        toast('Lien copie !');
      });
    }
  });

  // Add member button
  document.getElementById('addMemberBtn')?.addEventListener('click', () => {
    const name = prompt('Nom du nouveau membre:');
    if (name && name.trim()) {
      addMember(name.trim());
    }
  });

  // Add task button
  document.getElementById('addTeamTaskBtn')?.addEventListener('click', async () => {
    const memberId = document.getElementById('teamMemberSelect')?.value;
    const text = document.getElementById('teamTaskText')?.value;
    const date = document.getElementById('teamTaskDate')?.value;
    const urgent = document.getElementById('teamTaskUrgent')?.checked;

    if (!memberId) {
      toast('Selectionnez un membre');
      return;
    }
    if (!text || !text.trim()) {
      toast('Entrez une description');
      return;
    }
    if (!date) {
      toast('Selectionnez une date');
      return;
    }

    const success = await addTask(memberId, text.trim(), date, urgent);
    if (success) {
      document.getElementById('teamTaskText').value = '';
      document.getElementById('teamTaskUrgent').checked = false;
    }
  });

  // Set default date to today
  const dateInput = document.getElementById('teamTaskDate');
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  // File upload
  const fileInput = document.getElementById('teamFileInput');
  const uploadBtn = document.getElementById('uploadFileBtn');
  const fileGlobal = document.getElementById('fileGlobal');
  const fileTargetMember = document.getElementById('fileTargetMember');

  uploadBtn?.addEventListener('click', () => {
    fileInput?.click();
  });

  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isGlobal = fileGlobal?.checked;
    const memberId = isGlobal ? null : fileTargetMember?.value || null;

    await uploadFile(file, memberId);
    fileInput.value = '';
  });

  // Toggle file target member select
  const syncFileTargetState = () => {
    if (fileTargetMember && fileGlobal) {
      fileTargetMember.disabled = fileGlobal.checked;
      console.log('Syncing file target state:', fileGlobal.checked);
    }
  };

  fileGlobal?.addEventListener('change', syncFileTargetState);

  // Help user if they click disabled select
  fileTargetMember?.addEventListener('mousedown', (e) => {
    if (fileTargetMember.disabled) {
      toast("Décoche 'Global' pour choisir un membre", "info");
    }
  });

  // Initial sync
  syncFileTargetState();

  // Load data
  await Promise.all([loadMembers(), loadFiles()]);
}
