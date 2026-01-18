import { toast, confirmDialog } from './utils.js';
import { saveState, defaultState } from './storage.js';
import { isApiMode, api } from './api-client.js';
import { signOut } from './clerk-auth.js';

export const renderConfig = state => {
  // Configuration rendering - no owners to display anymore
};

export const initConfig = (state, renderCallback, setViewCallback) => {
  // Export (optional - removed from UI)
  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'wave-os-export.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('Export OK');
    });
  }

  // Import (optional - removed from UI)
  const importBtn = document.getElementById('importBtn');
  const importFile = document.getElementById('importFile');

  if (importBtn && importFile) {
    importBtn.addEventListener('click', () => {
      importFile.click();
    });

    importFile.addEventListener('change', e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const payload = JSON.parse(reader.result);
          if (payload && Array.isArray(payload.tasks) && payload.settings) {
            state.tasks = payload.tasks;
            state.settings = payload.settings;
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
  }

  // Wipe - avec confirmation FLOW style
  document.getElementById('wipeBtn').addEventListener('click', async () => {
    const confirmed = await confirmDialog({
      title: 'Delete all data?',
      message: 'This action cannot be undone. All your tasks will be permanently deleted.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      danger: true,
    });

    if (!confirmed) return;

    state.tasks = [];
    saveState(state);
    renderCallback();
    toast('Données supprimées', 'warning');
  });

  // Reset UI
  document.getElementById('resetUiBtn').addEventListener('click', () => {
    if (setViewCallback) setViewCallback('day');
    toast('UI reset');
  });

  // Logout
  const logoutBtn = document.getElementById('logoutBtn');
  const logoutSection = document.getElementById('logoutSection');

  // Only show logout in API mode
  if (logoutSection) {
    logoutSection.style.display = isApiMode ? 'block' : 'none';
  }

  logoutBtn?.addEventListener('click', async () => {
    const confirmed = await confirmDialog({
      title: 'Sign out?',
      message: 'You will be redirected to the login page.',
      confirmText: 'Sign Out',
      cancelText: 'Cancel',
      danger: false,
    });

    if (!confirmed) return;

    toast('Deconnexion...');

    // Use Clerk signOut (will reload page)
    await signOut();
  });
};
