// API Client - Switch between local storage and API mode

const MODE = import.meta.env.VITE_MODE || 'local';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333';

// Token storage helpers (fallback pour mobile/Safari)
const TOKEN_KEY = 'auth_token';

export const tokenStorage = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      console.warn('localStorage non disponible');
    }
  },
  remove() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore
    }
  }
};

// Helper pour les requêtes API
async function apiRequest(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;

  // Ajouter le token en header si disponible (fallback pour mobile)
  const token = tokenStorage.get();
  const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

  const defaultOptions = {
    credentials: 'include', // Pour les cookies JWT (desktop)
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options.headers,
    },
  };

  const response = await fetch(url, { ...defaultOptions, ...options });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API Error: ${response.status}`);
  }

  return response.json();
}

// API Client
export const api = {
  // Auth
  auth: {
    async register(email, password, name) {
      return apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      });
    },

    async login(email, password) {
      return apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
    },

    async logout() {
      return apiRequest('/api/auth/logout', { method: 'POST' });
    },

    async me() {
      return apiRequest('/api/auth/me');
    },
  },

  // Tasks
  tasks: {
    async getAll(filters = {}) {
      const params = new URLSearchParams(filters);
      return apiRequest(`/api/tasks?${params}`);
    },

    async getToday() {
      return apiRequest('/api/tasks/today');
    },

    async getLate() {
      return apiRequest('/api/tasks/late');
    },

    async create(task) {
      return apiRequest('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(task),
      });
    },

    async update(id, updates) {
      return apiRequest(`/api/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },

    async delete(id) {
      return apiRequest(`/api/tasks/${id}`, { method: 'DELETE' });
    },

    async carryOver(mode = 'move') {
      return apiRequest('/api/tasks/carry-over', {
        method: 'POST',
        body: JSON.stringify({ mode }),
      });
    },

    async addTime(id, minutes) {
      return apiRequest(`/api/tasks/${id}/time`, {
        method: 'POST',
        body: JSON.stringify({ minutes }),
      });
    },
  },

  // Settings
  settings: {
    async get() {
      return apiRequest('/api/settings');
    },

    async update(settings) {
      return apiRequest('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify(settings),
      });
    },
  },

  // AI
  ai: {
    async focusMode() {
      return apiRequest('/api/ai/focus-mode', { method: 'POST' });
    },

    async morningCoach() {
      return apiRequest('/api/ai/coach/morning');
    },

    async parseDump(text) {
      return apiRequest('/api/ai/parse-dump', {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
    },
  },

  // Email
  email: {
    async getInbox() {
      return apiRequest('/api/email/inbox');
    },

    async processEmail(id, taskText, date) {
      return apiRequest(`/api/email/inbox/${id}/process`, {
        method: 'POST',
        body: JSON.stringify({ taskText, date }),
      });
    },
  },
};

// Export mode for conditional logic
export const isLocalMode = MODE === 'local';
export const isApiMode = MODE === 'api';
