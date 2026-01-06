import { nowISO, storageOK } from './utils.js';
import { api, isApiMode } from './api-client.js';

const STORE_KEY = 'lm_os_state_v65';
const LEGACY_KEYS = [
  'manu_os_v64_state',
  'manu_os_v63_state',
  'manu_os_v63_1_state'
];

export const okStorage = storageOK();

export const defaultState = () => ({
  tasks: [],
  settings: {
    owners: ['Thibaud'],
  },
  meta: {
    updatedAt: nowISO(),
    rev: 0,
    schema: 'v65',
  }
});

// Local storage helpers
const loadFromLocal = () => {
  if (!okStorage) return defaultState();

  // Current key
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}

  // Legacy keys
  for (const k of LEGACY_KEYS) {
    try {
      const raw = localStorage.getItem(k);
      if (raw) {
        const legacy = JSON.parse(raw);
        const merged = defaultState();
        merged.tasks = Array.isArray(legacy.tasks) ? legacy.tasks : [];
        merged.settings = legacy.settings && typeof legacy.settings === 'object' ? legacy.settings : merged.settings;
        merged.meta = legacy.meta && typeof legacy.meta === 'object' ? legacy.meta : merged.meta;
        merged.meta.schema = 'v65';
        return merged;
      }
    } catch (_) {}
  }
  return defaultState();
};

const saveToLocal = (state) => {
  state.meta.updatedAt = nowISO();
  state.meta.rev = (state.meta.rev || 0) + 1;
  if (okStorage) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (_) {}
  }
};

// API sync functions
export const syncFromAPI = async () => {
  if (!isApiMode) return null;
  try {
    const tasks = await api.tasks.getAll();
    const settings = await api.settings.get().catch(() => ({ owners: ['Thibaud'] }));
    return {
      tasks: Array.isArray(tasks) ? tasks : [],
      settings: settings || { owners: ['Thibaud'] },
      meta: { updatedAt: nowISO(), rev: 0, schema: 'v65' }
    };
  } catch (err) {
    console.warn('API sync failed, using local:', err.message);
    return null;
  }
};

export const syncTaskToAPI = async (task, action = 'create') => {
  if (!isApiMode) return;
  try {
    if (action === 'create') {
      const created = await api.tasks.create(task);
      return created;
    } else if (action === 'update') {
      await api.tasks.update(task.id, task);
    } else if (action === 'delete') {
      await api.tasks.delete(task.id);
    }
  } catch (err) {
    console.warn(`API ${action} failed:`, err.message);
  }
};

// Main exports (keep backward compatibility)
export const loadState = () => {
  return loadFromLocal();
};

export const saveState = (state) => {
  saveToLocal(state);
};

export function initStorageUI() {
  const storageBadge = document.getElementById('storageBadge');
  const storageWarn = document.getElementById('storageWarn');

  if (storageBadge) {
    storageBadge.textContent = okStorage ? 'Storage OK' : 'Storage BLOQUÉ';
    storageBadge.classList.remove('bad', 'good');
    storageBadge.classList.add(okStorage ? 'good' : 'bad');
  }

  if (!okStorage && storageWarn) {
    const w = document.createElement('div');
    w.className = 'warn';
    w.textContent = "Ton navigateur bloque le stockage local. L'OS marchera en session, mais rien ne sera sauvegardé. Essaie Chrome/Safari (pas un aperçu), et désactive les restrictions de stockage si besoin.";
    storageWarn.appendChild(w);
  }
}
