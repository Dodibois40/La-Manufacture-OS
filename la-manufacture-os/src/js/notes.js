// Idées Page
import { api } from './api-client.js';
import { toast } from './utils.js';

// Global State
const state = {
  notes: [],
  tags: [],
  projects: [],
  tasks: [],
  teamMembers: [],
  filters: {
    search: '',
    pinned: false,
    tagId: null,
    projectId: null
  },
  currentNote: null,
  searchTimeout: null
};

// =====================================================
// INITIALIZATION
// =====================================================

async function init() {
  try {
    // Load data
    await Promise.all([
      loadNotes(),
      loadTags(),
      loadProjects(),
      loadTeamMembers()
    ]);

    // Setup event listeners
    setupEventListeners();
  } catch (error) {
    console.error('Init error:', error);
    toast('Erreur lors du chargement', 'danger');
  }
}

// =====================================================
// DATA LOADING
// =====================================================

async function loadNotes() {
  try {
    const params = new URLSearchParams();

    if (state.filters.search) params.append('q', state.filters.search);
    if (state.filters.pinned) params.append('is_pinned', 'true');
    if (state.filters.tagId) params.append('tag_id', state.filters.tagId);
    if (state.filters.projectId) params.append('project_id', state.filters.projectId);

    // Use search endpoint if search query
    const endpoint = state.filters.search
      ? `/api/notes/search?${params}`
      : `/api/notes?${params}`;

    const response = await api.request(endpoint);
    state.notes = response.notes || [];
    renderNotes();
  } catch (error) {
    console.error('Load notes error:', error);
    toast('Erreur lors du chargement des notes', 'danger');
  }
}

async function loadTags() {
  try {
    const response = await api.notes.tags.list();
    state.tags = response.tags || [];
    renderTagsBar();
    updateTagSelects();
  } catch (error) {
    console.error('Load tags error:', error);
  }
}

async function loadProjects() {
  try {
    const response = await api.request('/api/projects');
    state.projects = response.projects || [];
    updateProjectSelects();
  } catch (error) {
    console.error('Load projects error:', error);
  }
}

async function loadTeamMembers() {
  try {
    const response = await api.request('/api/team/members');
    state.teamMembers = response.members || [];
    updateMemberSelects();
  } catch (error) {
    console.error('Load team members error:', error);
  }
}

// =====================================================
// RENDERING
// =====================================================

function renderNotes() {
  const container = document.getElementById('notesContainer');
  const emptyState = document.getElementById('emptyState');

  if (state.notes.length === 0) {
    container.style.display = 'none';
    emptyState.style.display = 'flex';
    return;
  }

  container.style.display = 'block';
  emptyState.style.display = 'none';

  // Separate pinned and unpinned notes
  const pinnedNotes = state.notes.filter(n => n.is_pinned);
  const otherNotes = state.notes.filter(n => !n.is_pinned);

  let html = '';

  // Pinned section
  if (pinnedNotes.length > 0) {
    html += `
      <div class="notes-section">
        <div class="notes-section-title">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
          </svg>
          Épinglées
        </div>
        <div class="notes-grid">
          ${pinnedNotes.map(note => renderNoteCard(note)).join('')}
        </div>
      </div>
    `;
  }

  // Other notes section
  if (otherNotes.length > 0) {
    html += `
      <div class="notes-section">
        ${pinnedNotes.length > 0 ? '<div class="notes-section-title">Autres</div>' : ''}
        <div class="notes-grid">
          ${otherNotes.map(note => renderNoteCard(note)).join('')}
        </div>
      </div>
    `;
  }

  container.innerHTML = html;

  // Add event listeners
  container.querySelectorAll('.note-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Don't open modal if clicking action buttons
      if (e.target.closest('.note-action-btn')) return;

      const noteId = card.dataset.noteId;
      const note = state.notes.find(n => n.id === noteId);
      if (note) openNoteModal(note);
    });
  });

  // Pin button listeners
  container.querySelectorAll('.pin-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const noteId = btn.closest('.note-card').dataset.noteId;
      await togglePin(noteId);
    });
  });

  // Delete button listeners
  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const noteId = btn.closest('.note-card').dataset.noteId;
      await quickDelete(noteId);
    });
  });
}

function renderNoteCard(note) {
  const tags = note.tags || [];
  const tagsHTML = tags.map(tag =>
    `<span class="note-tag">${tag.name}</span>`
  ).join('');

  const sharedBadge = note.is_shared
    ? `<span class="note-shared-badge">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
           <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
           <circle cx="9" cy="7" r="4"/>
           <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
         </svg>
         Partagée
       </span>`
    : '';

  const date = new Date(note.created_at).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short'
  });

  const preview = note.content ? note.content.substring(0, 150) : '';

  return `
    <div class="note-card" data-color="${note.color || ''}" data-note-id="${note.id}">
      <div class="note-actions">
        <button class="note-action-btn pin-btn ${note.is_pinned ? 'active' : ''}" title="${note.is_pinned ? 'Désépingler' : 'Épingler'}">
          <svg viewBox="0 0 24 24" fill="${note.is_pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
          </svg>
        </button>
        <button class="note-action-btn delete-btn" title="Supprimer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
      <div class="note-card-header">
        <h3 class="note-title">${note.title}</h3>
      </div>
      ${preview ? `<div class="note-content">${preview}</div>` : ''}
      ${tagsHTML ? `<div class="note-tags">${tagsHTML}</div>` : ''}
      <div class="note-footer">
        <span class="note-date">${date}</span>
        ${sharedBadge}
      </div>
    </div>
  `;
}

async function togglePin(noteId) {
  const note = state.notes.find(n => n.id === noteId);
  if (!note) return;

  try {
    await api.notes.update(noteId, { is_pinned: !note.is_pinned });
    note.is_pinned = !note.is_pinned;
    renderNotes();
    toast(note.is_pinned ? 'Note épinglée' : 'Note désépinglée', 'success');
  } catch (error) {
    console.error('Toggle pin error:', error);
    toast('Erreur lors de la mise à jour', 'danger');
  }
}

async function quickDelete(noteId) {
  if (!confirm('Supprimer cette note ?')) return;

  try {
    await api.notes.delete(noteId);
    state.notes = state.notes.filter(n => n.id !== noteId);
    renderNotes();
    toast('Note supprimée', 'success');
    await loadTags(); // Refresh tag counts
  } catch (error) {
    console.error('Quick delete error:', error);
    toast('Erreur lors de la suppression', 'danger');
  }
}

function renderTagsBar() {
  const tagsList = document.getElementById('popularTagsList');

  // Sort by note count (assuming backend returns count)
  const sortedTags = [...state.tags]
    .sort((a, b) => (b.note_count || 0) - (a.note_count || 0))
    .slice(0, 10); // Top 10 tags

  tagsList.innerHTML = sortedTags.map(tag => `
    <button class="tag-pill" data-tag-id="${tag.id}">
      ${tag.name}
      ${tag.note_count ? `<span class="count">${tag.note_count}</span>` : ''}
    </button>
  `).join('');

  // Add click listeners
  tagsList.querySelectorAll('.tag-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const tagId = pill.dataset.tagId;
      state.filters.tagId = state.filters.tagId === tagId ? null : tagId;
      document.getElementById('tagFilter').value = state.filters.tagId || '';
      loadNotes();
    });
  });
}

function updateTagSelects() {
  // Tag filter select
  const tagFilter = document.getElementById('tagFilter');
  tagFilter.innerHTML = '<option value="">Tous les tags</option>' +
    state.tags.map(tag => `<option value="${tag.id}">${tag.name}</option>`).join('');

  // Modal tag select
  const tagSelect = document.getElementById('tagSelect');
  tagSelect.innerHTML = '<option value="">+ Ajouter un tag</option>' +
    state.tags.map(tag => `<option value="${tag.id}">${tag.name}</option>`).join('');
}

function updateProjectSelects() {
  const projectFilter = document.getElementById('projectFilter');
  projectFilter.innerHTML = '<option value="">Tous les projets</option>' +
    state.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

  const noteProject = document.getElementById('noteProject');
  noteProject.innerHTML = '<option value="">Aucun projet</option>' +
    state.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
}

function updateMemberSelects() {
  const shareMember = document.getElementById('shareMember');
  shareMember.innerHTML = '<option value="">Sélectionner un membre</option>' +
    state.teamMembers.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
}

// =====================================================
// MODAL - CREATE/EDIT NOTE
// =====================================================

function openNoteModal(note = null) {
  state.currentNote = note;

  const modal = document.getElementById('noteModal');
  const title = document.getElementById('noteModalTitle');
  const deleteBtn = document.getElementById('deleteNoteBtn');

  // Reset form
  document.getElementById('noteId').value = note?.id || '';
  document.getElementById('noteTitle').value = note?.title || '';
  document.getElementById('noteContent').value = note?.content || '';
  document.getElementById('notePinned').checked = note?.is_pinned || false;
  document.getElementById('noteProject').value = note?.project_id || '';
  document.getElementById('noteTask').value = note?.task_id || '';

  // Color picker
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.color === (note?.color || ''));
  });

  // Tags
  renderSelectedTags(note?.tags || []);

  // Shares
  if (note) {
    loadNoteShares(note.id);
  } else {
    document.getElementById('sharesList').innerHTML = '';
  }

  // UI updates
  title.textContent = note ? 'Modifier la note' : 'Créer une note';
  deleteBtn.style.display = note ? 'block' : 'none';

  modal.classList.add('active');
}

function renderSelectedTags(tags) {
  const container = document.getElementById('tagsSelected');
  container.innerHTML = tags.map(tag => `
    <span class="tag-selected" data-tag-id="${tag.id}">
      ${tag.name}
      <svg class="tag-remove" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    </span>
  `).join('');

  // Remove tag click
  container.querySelectorAll('.tag-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tagSpan = btn.closest('.tag-selected');
      tagSpan.remove();
    });
  });
}

async function loadNoteShares(noteId) {
  try {
    const response = await api.notes.shares.list(noteId);
    const shares = response.shares || [];

    const container = document.getElementById('sharesList');
    container.innerHTML = shares.map(share => `
      <div class="share-item">
        <div class="share-info">
          <div class="share-name">${share.shared_with_name}</div>
          <div class="share-permission">${share.permission === 'edit' ? 'Édition' : 'Lecture seule'}</div>
        </div>
        <button class="share-remove" data-share-user-id="${share.shared_with_user_id}">
          Retirer
        </button>
      </div>
    `).join('');

    // Remove share listeners
    container.querySelectorAll('.share-remove').forEach(btn => {
      btn.addEventListener('click', async () => {
        const userId = btn.dataset.shareUserId;
        await removeShare(noteId, userId);
      });
    });
  } catch (error) {
    console.error('Load shares error:', error);
  }
}

async function saveNote() {
  try {
    const noteId = document.getElementById('noteId').value;
    const title = document.getElementById('noteTitle').value.trim();
    const content = document.getElementById('noteContent').value.trim();

    if (!title) {
      toast('Le titre est requis', 'warning');
      return;
    }

    const selectedColor = document.querySelector('.color-btn.active');
    const color = selectedColor ? selectedColor.dataset.color : null;

    // Get selected tags
    const tagIds = Array.from(document.querySelectorAll('.tag-selected'))
      .map(span => parseInt(span.dataset.tagId));

    const data = {
      title,
      content,
      color: color || null,
      is_pinned: document.getElementById('notePinned').checked,
      project_id: document.getElementById('noteProject').value || null,
      task_id: document.getElementById('noteTask').value || null,
      tag_ids: tagIds
    };

    if (noteId) {
      // Update
      await api.notes.update(noteId, data);
      toast('Note modifiée', 'success');
    } else {
      // Create
      await api.notes.create(data);
      toast('Note créée', 'success');
    }

    closeModal('noteModal');
    await loadNotes();
    await loadTags(); // Refresh tag counts
  } catch (error) {
    console.error('Save note error:', error);
    toast('Erreur lors de l\'enregistrement', 'danger');
  }
}

async function deleteNote() {
  const noteId = document.getElementById('noteId').value;

  if (!confirm('Supprimer cette note définitivement ?')) return;

  try {
    await api.notes.delete(noteId);
    toast('Note supprimée', 'success');
    closeModal('noteModal');
    await loadNotes();
    await loadTags();
  } catch (error) {
    console.error('Delete note error:', error);
    toast('Erreur lors de la suppression', 'danger');
  }
}

// =====================================================
// MODAL - MANAGE TAGS
// =====================================================

function openTagsModal() {
  const modal = document.getElementById('tagsModal');
  renderTagsManageList();
  modal.classList.add('active');
}

function renderTagsManageList() {
  const container = document.getElementById('tagsManageList');

  container.innerHTML = state.tags.map(tag => `
    <div class="tag-manage-item">
      <div class="tag-manage-info">
        <div class="tag-color-dot" style="background: ${tag.color}"></div>
        <span class="tag-manage-name">${tag.name}</span>
        <span class="tag-manage-count">${tag.note_count || 0} note(s)</span>
      </div>
      <div class="tag-manage-actions">
        <button class="tag-delete-btn" data-tag-id="${tag.id}">Supprimer</button>
      </div>
    </div>
  `).join('');

  // Delete listeners
  container.querySelectorAll('.tag-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tagId = btn.dataset.tagId;
      await deleteTag(tagId);
    });
  });
}

async function createTag() {
  const name = document.getElementById('newTagName').value.trim().toLowerCase();
  const color = document.getElementById('newTagColor').value;

  if (!name) {
    toast('Le nom du tag est requis', 'warning');
    return;
  }

  try {
    await api.notes.tags.create({ name, color });
    toast('Tag créé', 'success');

    // Reset form
    document.getElementById('newTagName').value = '';
    document.getElementById('newTagColor').value = '#808080';

    await loadTags();
    renderTagsManageList();
  } catch (error) {
    console.error('Create tag error:', error);
    toast('Erreur lors de la création du tag', 'danger');
  }
}

async function deleteTag(tagId) {
  if (!confirm('Supprimer ce tag ? Il sera retiré de toutes les notes.')) return;

  try {
    await api.notes.tags.delete(tagId);
    toast('Tag supprimé', 'success');
    await loadTags();
    renderTagsManageList();
  } catch (error) {
    console.error('Delete tag error:', error);
    toast('Erreur lors de la suppression', 'danger');
  }
}

// =====================================================
// MODAL - SHARE NOTE
// =====================================================

function openShareModal() {
  const noteId = document.getElementById('noteId').value;
  if (!noteId) {
    toast('Enregistrez d\'abord la note', 'warning');
    return;
  }

  const modal = document.getElementById('shareModal');
  modal.classList.add('active');
}

async function shareNote() {
  const noteId = document.getElementById('noteId').value;
  const memberId = document.getElementById('shareMember').value;
  const permission = document.getElementById('sharePermission').value;

  if (!memberId) {
    toast('Sélectionnez un membre', 'warning');
    return;
  }

  try {
    await api.notes.shares.create(noteId, {
      target_user_id: parseInt(memberId),
      permission
    });

    toast('Note partagée', 'success');
    closeModal('shareModal');
    await loadNoteShares(noteId);
  } catch (error) {
    console.error('Share note error:', error);
    toast('Erreur lors du partage', 'danger');
  }
}

async function removeShare(noteId, userId) {
  try {
    await api.notes.shares.remove(noteId, userId);
    toast('Partage retiré', 'success');
    await loadNoteShares(noteId);
  } catch (error) {
    console.error('Remove share error:', error);
    toast('Erreur lors du retrait', 'danger');
  }
}

// =====================================================
// FILTERS & SEARCH
// =====================================================

function handleSearch(query) {
  state.filters.search = query;

  // Debounce
  clearTimeout(state.searchTimeout);
  state.searchTimeout = setTimeout(() => {
    loadNotes();
  }, 300);
}

function handleFilterChip(filter) {
  if (filter === 'all') {
    state.filters.pinned = false;
  } else if (filter === 'pinned') {
    state.filters.pinned = true;
  }

  // Update active state
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.filter === filter);
  });

  loadNotes();
}

// =====================================================
// EVENT LISTENERS
// =====================================================

function setupEventListeners() {
  // Search
  document.getElementById('searchInput').addEventListener('input', (e) => {
    handleSearch(e.target.value.trim());
  });

  // Filter chips
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      handleFilterChip(chip.dataset.filter);
    });
  });

  // Filter selects
  document.getElementById('tagFilter').addEventListener('change', (e) => {
    state.filters.tagId = e.target.value || null;
    loadNotes();
  });

  document.getElementById('projectFilter').addEventListener('change', (e) => {
    state.filters.projectId = e.target.value || null;
    loadNotes();
  });

  // Create note button
  document.getElementById('createNoteBtn').addEventListener('click', () => {
    openNoteModal();
  });

  // Manage tags button
  document.getElementById('manageTagsBtn').addEventListener('click', () => {
    openTagsModal();
  });

  // Note modal - color picker
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Note modal - tag select
  document.getElementById('tagSelect').addEventListener('change', (e) => {
    const tagId = e.target.value;
    if (!tagId) return;

    const tag = state.tags.find(t => t.id === parseInt(tagId));
    if (!tag) return;

    // Check if already selected
    const alreadySelected = Array.from(document.querySelectorAll('.tag-selected'))
      .some(span => span.dataset.tagId === tagId);

    if (alreadySelected) {
      toast('Tag déjà ajouté', 'warning');
      e.target.value = '';
      return;
    }

    // Add tag
    const container = document.getElementById('tagsSelected');
    const tagSpan = document.createElement('span');
    tagSpan.className = 'tag-selected';
    tagSpan.dataset.tagId = tag.id;
    tagSpan.innerHTML = `
      ${tag.name}
      <svg class="tag-remove" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    `;

    tagSpan.querySelector('.tag-remove').addEventListener('click', () => {
      tagSpan.remove();
    });

    container.appendChild(tagSpan);
    e.target.value = '';
  });

  // Note modal - save button
  document.getElementById('saveNoteBtn').addEventListener('click', saveNote);

  // Note modal - delete button
  document.getElementById('deleteNoteBtn').addEventListener('click', deleteNote);

  // Note modal - share button
  document.getElementById('shareNoteBtn').addEventListener('click', openShareModal);

  // Share modal - confirm button
  document.getElementById('confirmShareBtn').addEventListener('click', shareNote);

  // Tags modal - create button
  document.getElementById('createTagBtn').addEventListener('click', createTag);

  // Navigation dock
  document.getElementById('nav-day').addEventListener('click', () => {
    window.location.href = '/';
  });

  document.getElementById('nav-week').addEventListener('click', () => {
    window.location.href = '/?view=week';
  });

  document.getElementById('nav-inbox').addEventListener('click', () => {
    // Quick Dump handled in main.js
    window.location.href = '/';
  });

  document.getElementById('nav-team').addEventListener('click', () => {
    window.location.href = '/team.html';
  });

  document.getElementById('nav-config').addEventListener('click', () => {
    // Settings handled in main.js
    window.location.href = '/?settings=true';
  });
}

// Global modal close function
window.closeModal = function(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.remove('active');
};

// =====================================================
// START
// =====================================================

document.addEventListener('DOMContentLoaded', init);
