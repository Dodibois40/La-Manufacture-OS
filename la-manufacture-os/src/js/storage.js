import { nowISO, storageOK } from './utils.js';
import { api, isApiMode } from './api-client.js';
import { isSignedIn } from './clerk-auth.js';

const STORE_KEY = 'lm_os_state_v65';
const AUTH_KEY = 'lm_os_auth';

export const okStorage = storageOK();

export const defaultState = () => ({
  tasks: [],
  settings: {},
  meta: {
    updatedAt: nowISO(),
    rev: 0,
    schema: 'v65',
  }
});

// Auth state
let currentUser = null;
let authToken = null;

// Load auth from localStorage
export const loadAuth = () => {
  if (!okStorage) return null;
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (raw) {
      const auth = JSON.parse(raw);
      currentUser = auth.user;
      authToken = auth.token;
      return auth;
    }
  } catch (_) { }
  return null;
};

// Save auth to localStorage
export const saveAuth = (user, token) => {
  currentUser = user;
  authToken = token;
  if (okStorage) {
    localStorage.setItem(AUTH_KEY, JSON.stringify({ user, token }));
  }
};

// Clear auth
export const clearAuth = () => {
  currentUser = null;
  authToken = null;
  if (okStorage) {
    localStorage.removeItem(AUTH_KEY);
  }
};

// Get current user
export const getCurrentUser = () => currentUser;
export const isLoggedIn = () => !!currentUser;

// API Auth functions
export const authApi = {
  async login(email, password) {
    const result = await api.auth.login(email, password);
    if (result.user && result.token) {
      saveAuth(result.user, result.token);
    }
    return result;
  },

  async register(email, password, name) {
    const result = await api.auth.register(email, password, name);
    if (result.user && result.token) {
      saveAuth(result.user, result.token);
    }
    return result;
  },

  async logout() {
    try {
      await api.auth.logout();
    } catch (_) { }
    clearAuth();
  },

  async checkSession() {
    try {
      const result = await api.auth.me();
      if (result.user) {
        currentUser = result.user;
        return true;
      }
    } catch (_) { }
    clearAuth();
    return false;
  }
};

// Load state - from API or localStorage
export const loadState = () => {
  // Always start with default state
  const state = defaultState();

  // Load from localStorage as fallback/cache
  if (okStorage) {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        state.tasks = Array.isArray(cached.tasks) ? cached.tasks : [];
        state.settings = cached.settings || state.settings;
        state.meta = cached.meta || state.meta;
      }
    } catch (_) { }
  }

  return state;
};

// Load state from API
export const loadStateFromApi = async () => {
  // Check both legacy auth (isLoggedIn) and Clerk auth (isSignedIn)
  const clerkSignedIn = isSignedIn();
  const legacyLoggedIn = isLoggedIn();
  const isAuthenticated = legacyLoggedIn || clerkSignedIn;
  console.log('[loadStateFromApi] isApiMode:', isApiMode, 'legacyLoggedIn:', legacyLoggedIn, 'clerkSignedIn:', clerkSignedIn, 'isAuthenticated:', isAuthenticated);
  if (!isApiMode || !isAuthenticated) {
    console.log('[loadStateFromApi] Falling back to local storage');
    return loadState();
  }

  try {
    const [tasksResult, settingsResult] = await Promise.all([
      api.tasks.getAll(),
      api.settings.get().catch(() => null)
    ]);

    const state = defaultState();
    state.tasks = Array.isArray(tasksResult.tasks) ? tasksResult.tasks : (Array.isArray(tasksResult) ? tasksResult : []);
    if (settingsResult) {
      state.settings = { ...state.settings, ...settingsResult };
    }

    // Cache in localStorage
    saveStateLocal(state);

    return state;
  } catch (error) {
    console.error('Failed to load from API:', error);
    return loadState(); // Fallback to local
  }
};

// Save state locally only
const saveStateLocal = (state) => {
  state.meta.updatedAt = nowISO();
  state.meta.rev = (state.meta.rev || 0) + 1;
  if (okStorage) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (_) { }
  }
};

// Save state - to API and localStorage
export const saveState = (state) => {
  saveStateLocal(state);
};

// Task API operations
export const taskApi = {
  async create(task) {
    const isAuthenticated = isLoggedIn() || isSignedIn();
    if (!isApiMode || !isAuthenticated) {
      return task;
    }
    try {
      const result = await api.tasks.create(task);
      return result.task || result;
    } catch (error) {
      console.error('Failed to create task:', error);
      throw error;
    }
  },

  async update(id, updates) {
    const isAuthenticated = isLoggedIn() || isSignedIn();
    if (!isApiMode || !isAuthenticated) {
      return updates;
    }
    try {
      const result = await api.tasks.update(id, updates);
      return result;
    } catch (error) {
      console.error('Failed to update task:', error);
      throw error;
    }
  },

  async delete(id) {
    const isAuthenticated = isLoggedIn() || isSignedIn();
    if (!isApiMode || !isAuthenticated) {
      return true;
    }
    try {
      await api.tasks.delete(id);
      return true;
    } catch (error) {
      console.error('Failed to delete task:', error);
      throw error;
    }
  },

  async toggle(id, done) {
    return this.update(id, { done });
  }
};

export function initStorageUI() {
  const storageBadge = document.getElementById('storageBadge');
  const storageWarn = document.getElementById('storageWarn');

  if (storageBadge) {
    if (isApiMode) {
      const isAuthenticated = isLoggedIn() || isSignedIn();
      storageBadge.textContent = isAuthenticated ? 'API Sync' : 'API Mode';
      storageBadge.classList.remove('bad');
      storageBadge.classList.add('good');
    } else {
      storageBadge.textContent = okStorage ? 'Local' : 'Storage BLOQUÉ';
      storageBadge.classList.remove('bad', 'good');
      storageBadge.classList.add(okStorage ? 'good' : 'bad');
    }
  }

  if (!okStorage && storageWarn && !isApiMode) {
    const w = document.createElement('div');
    w.className = 'warn';
    w.textContent = "Ton navigateur bloque le stockage local.";
    storageWarn.appendChild(w);
  }
}
