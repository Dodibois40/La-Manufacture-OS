import { isoLocal, ensureTask, nowISO, toast } from './utils.js';
import { saveState, taskApi, isLoggedIn } from './storage.js';
import { smartParseDate, smartParseUrgent, smartParseOwner, cleanTitle } from './parser.js';
import { isApiMode } from './api-client.js';

export const initCommandBar = (state, renderCallback) => {
  // Create Modal HTML with iOS style
  const modal = document.createElement('div');
  modal.id = 'cmdBarOverlay';
  modal.className = 'cmd-overlay';
  modal.innerHTML = `
    <div class="cmd-box">
      <div class="cmd-input-wrap">
        <span class="cmd-icon">⚡</span>
        <input type="text" id="cmdInput" placeholder="Nouveau rappel... (@Thibaud, urgent, lundi)" autocomplete="off">
      </div>
      <div class="cmd-preview" id="cmdPreview">
        <span class="cmd-tag placeholder">Tapez votre tâche...</span>
      </div>
      <div class="cmd-hints">
        <span><kbd>⏎</kbd> Créer</span>
        <span><kbd>Esc</kbd> Fermer</span>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const input = document.getElementById('cmdInput');
  const preview = document.getElementById('cmdPreview');
  const overlay = document.getElementById('cmdBarOverlay');

  const close = () => {
    overlay.classList.remove('active');
    input.value = '';
    preview.innerHTML = '<span class="cmd-tag placeholder">Tapez votre tâche...</span>';
  };

  const open = () => {
    overlay.classList.add('active');
    input.focus();
    updatePreview();
  };

  // Toggle Command Bar (Ctrl+K or Ctrl+Space)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === ' ')) {
      e.preventDefault();
      if (overlay.classList.contains('active')) close();
      else open();
    }
    if (e.key === 'Escape' && overlay.classList.contains('active')) {
      close();
    }
  });

  // Redirect "Add Task" button to command bar
  const addBtn = document.getElementById('addBtn');
  if (addBtn) {
    addBtn.addEventListener('click', (e) => {
      e.preventDefault();
      open();
    });
  }
  // Observer for dynamic changes if needed, but manual hook is fine for now

  // Live Parsing logic using unified Smart Parser
  const analyze = (text) => {
    const raw = String(text || '').trim();
    if (!raw) return null;

    const baseToday = isoLocal();
    const owners = (state.settings.owners || []).map(x => String(x || '').trim()).filter(Boolean);
    const safeOwners = owners.length ? owners : ['Thibaud'];
    const defaultOwner = safeOwners[0];

    // Use unified smart parsing
    const date = smartParseDate(raw, baseToday);
    const urgent = smartParseUrgent(raw);
    const owner = smartParseOwner(raw, safeOwners, defaultOwner);
    const title = cleanTitle(raw, safeOwners);

    return { title, owner, urgent, date };
  };

  const updatePreview = () => {
    const val = input.value;
    const meta = analyze(val);

    if (!meta || !meta.title) {
      preview.innerHTML = '<span class="cmd-tag placeholder">Tapez votre tâche...</span>';
      return;
    }

    let html = `
      <span class="cmd-tag owner">👤 ${meta.owner}</span>
      <span class="cmd-tag date">📅 ${meta.date === isoLocal() ? 'Aujourd\'hui' : meta.date}</span>
    `;

    if (meta.urgent) html += `<span class="cmd-tag urgent">🔥 Urgent</span>`;

    preview.innerHTML = html;
  };

  input.addEventListener('input', updatePreview);

  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const meta = analyze(input.value);
      if (!meta || !meta.title) return;

      const newTask = ensureTask({
        text: meta.title,
        owner: meta.owner,
        urgent: meta.urgent,
        date: meta.date,
        done: false,
        updatedAt: nowISO()
      }, state.settings.owners[0]);

      try {
        // Sync to API if in API mode
        if (isApiMode && isLoggedIn()) {
          const created = await taskApi.create(newTask);
          state.tasks.push(created);
        } else {
          state.tasks.push(newTask);
        }
      } catch (error) {
        console.error('Failed to create task:', error);
        state.tasks.push(newTask); // Fallback to local
      }

      saveState(state);
      renderCallback();
      toast('Tâche créée ⚡');
      close();
    }
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
};
