import { toast } from './utils.js';
import { saveState, defaultState } from './storage.js';
import { inboxCtx } from './inbox.js';

export const renderConfig = (state) => {
  document.getElementById('owners').value = (state.settings.owners || []).join(', ');
};

export const initConfig = (state, renderCallback) => {
  const applyOwners = () => {
    const owners = (document.getElementById('owners').value || '')
      .split(',')
      .map(x => x.trim())
      .filter(Boolean);

    state.settings.owners = owners.length ? owners : ['Thibaud'];
    inboxCtx.owner = state.settings.owners[0];
    saveState(state);
    renderCallback();
    toast('Responsables enregistrés');
  };

  document.getElementById('owners').addEventListener('change', applyOwners);
  document.getElementById('owners').addEventListener('blur', applyOwners);

  // Export
  document.getElementById('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'la-manufacture-os-export.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('Export OK');
  });

  // Import
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });

  document.getElementById('importFile').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result);
        if (payload && Array.isArray(payload.tasks) && payload.settings) {
          state.tasks = payload.tasks;
          state.settings = payload.settings;
          state.settings.owners = Array.isArray(state.settings.owners) && state.settings.owners.length ? state.settings.owners : ['Thibaud'];
          state.meta = payload.meta || state.meta;
          saveState(state);
          renderCallback();
          toast('Import OK');
        } else {
          toast('Import: format invalide');
        }
      } catch (_) {
        toast('Import: JSON invalide');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  });

  // Wipe
  document.getElementById('wipeBtn').addEventListener('click', () => {
    if (!confirm('Supprimer toutes les tâches locales ?')) return;
    state.tasks = [];
    saveState(state);
    renderCallback();
    toast('Local vidé');
  });

  // Reset UI
  document.getElementById('resetUiBtn').addEventListener('click', () => {
    const setViewCallback = window._setViewCallback;
    if (setViewCallback) setViewCallback('day');
    toast('UI reset');
  });
};
