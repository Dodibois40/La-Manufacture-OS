import { nowISO, storageOK } from './utils.js';

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

export const loadState = () => {
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
        // Toast will be called from app.js
        return merged;
      }
    } catch (_) {}
  }
  return defaultState();
};

export const saveState = (state) => {
  state.meta.updatedAt = nowISO();
  state.meta.rev = (state.meta.rev || 0) + 1;
  if (okStorage) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (_) {}
  }
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
