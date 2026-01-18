// API Client - Switch between local storage and API mode
import { getToken as getClerkToken } from './clerk-auth.js';

const MODE = import.meta.env.VITE_MODE || 'local';
// If we are on a different host (like a local IP), try to use the same host for the API if not explicitly set
const API_URL =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? `http://${window.location.hostname}:3333`
    : 'http://localhost:3333');

// Legacy token storage (kept for backward compatibility during migration)
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
  },
};

// Configuration retry et timeout
const DEFAULT_TIMEOUT = 30000; // 30 secondes
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // 1 seconde, exponential backoff

// Helper pour fetch avec timeout
async function fetchWithTimeout(url, options, timeout = DEFAULT_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Helper pour le délai exponentiel
function getRetryDelay(attempt) {
  return RETRY_DELAY_BASE * Math.pow(2, attempt) + Math.random() * 500;
}

// Helper pour déterminer si on doit retry
function shouldRetry(error, attempt) {
  if (attempt >= MAX_RETRIES) return false;
  // Retry sur erreurs réseau ou timeout
  if (error.name === 'AbortError') return true; // Timeout
  if (error.message?.includes('fetch')) return true; // Network error
  if (error.message?.includes('network')) return true;
  return false;
}

// Helper pour les requêtes API avec retry et timeout
async function apiRequest(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const timeout = options.timeout || DEFAULT_TIMEOUT;

  // Get Clerk token for authentication
  const token = await getClerkToken();
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const headers = {
    ...authHeaders,
    ...options.headers,
  };

  // Ne mettre Content-Type que s'il y a un body ou si ce n'est pas un DELETE
  if (options.body || (options.method && options.method !== 'DELETE' && options.method !== 'GET')) {
    headers['Content-Type'] = 'application/json';
  }

  const defaultOptions = {
    credentials: 'omit', // Changed from 'include' - fixes iOS Safari ITP blocking third-party cookies
    headers,
  };

  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(url, { ...defaultOptions, ...options }, timeout);

      if (!response.ok) {
        let errorMessage = `API Error: ${response.status} ${response.statusText}`;
        try {
          const errorJson = await response.json();
          errorMessage = errorJson.error || errorJson.message || errorMessage;
        } catch (_) {
          // Not JSON or empty body
        }
        // Ne pas retry sur les erreurs 4xx (sauf 429 rate limit)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw new Error(errorMessage);
        }
        lastError = new Error(errorMessage);
        lastError.status = response.status;
      } else {
        return response.json();
      }
    } catch (error) {
      lastError = error;
      if (error.name === 'AbortError') {
        lastError = new Error('Connexion timeout - le serveur met trop de temps à répondre');
      }
    }

    // Retry si possible
    if (shouldRetry(lastError, attempt)) {
      const delay = getRetryDelay(attempt);
      console.warn(
        `API retry ${attempt + 1}/${MAX_RETRIES} après ${Math.round(delay)}ms:`,
        endpoint
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    } else {
      break;
    }
  }

  throw lastError;
}

// API Client
export const api = {
  // Generic request method (for custom endpoints)
  request: apiRequest,

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

    // Sharing
    async share(id, targetUserId, permission = 'view') {
      return apiRequest(`/api/tasks/${id}/share`, {
        method: 'POST',
        body: JSON.stringify({ targetUserId, permission }),
      });
    },

    async unshare(id, targetUserId) {
      return apiRequest(`/api/tasks/${id}/share/${targetUserId}`, { method: 'DELETE' });
    },

    async getShares(id) {
      return apiRequest(`/api/tasks/${id}/shares`);
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

    async detectEvent(text) {
      return apiRequest('/api/ai/detect-event', {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
    },

    async processInbox(text) {
      return apiRequest('/api/ai/process-inbox', {
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

  // Users
  users: {
    async getAll() {
      return apiRequest('/api/users');
    },

    async search(q) {
      return apiRequest(`/api/users/search?q=${encodeURIComponent(q)}`);
    },
  },

  // Notifications
  notifications: {
    async getAll() {
      return apiRequest('/api/notifications');
    },

    async getUnreadCount() {
      return apiRequest('/api/notifications/unread-count');
    },

    async markRead(id) {
      return apiRequest(`/api/notifications/${id}/read`, { method: 'PATCH' });
    },

    async markAllRead() {
      return apiRequest('/api/notifications/mark-all-read', { method: 'POST' });
    },

    async delete(id) {
      return apiRequest(`/api/notifications/${id}`, { method: 'DELETE' });
    },
  },

  // Team Management
  team: {
    async getMembers() {
      return apiRequest('/api/team/members');
    },

    async addMember(name, avatar_color) {
      return apiRequest('/api/team/members', {
        method: 'POST',
        body: JSON.stringify({ name, avatar_color }),
      });
    },

    async updateMember(id, updates) {
      return apiRequest(`/api/team/members/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },

    async deleteMember(id) {
      return apiRequest(`/api/team/members/${id}`, { method: 'DELETE' });
    },

    async getTasks(memberId, date) {
      const params = new URLSearchParams();
      if (memberId) params.set('member_id', memberId);
      if (date) params.set('date', date);
      return apiRequest(`/api/team/tasks?${params}`);
    },

    async addTask(memberId, text, date, urgent = false) {
      return apiRequest('/api/team/tasks', {
        method: 'POST',
        body: JSON.stringify({
          team_member_id: memberId,
          text,
          date,
          urgent,
        }),
      });
    },

    async updateTask(id, updates) {
      return apiRequest(`/api/team/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },

    async deleteTask(id) {
      return apiRequest(`/api/team/tasks/${id}`, { method: 'DELETE' });
    },

    async getFiles(memberId) {
      const params = memberId ? `?member_id=${memberId}` : '';
      return apiRequest(`/api/team/files${params}`);
    },

    async uploadFile(formData) {
      const token = await getClerkToken();
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await fetch(`${API_URL}/api/team/files`, {
        method: 'POST',
        credentials: 'omit', // Changed from 'include' - fixes iOS Safari ITP
        headers: authHeaders,
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(error.error || 'Upload failed');
      }

      return response.json();
    },

    async deleteFile(id) {
      return apiRequest(`/api/team/files/${id}`, { method: 'DELETE' });
    },
  },

  // Projects
  projects: {
    async getAll(status) {
      const params = status ? `?status=${status}` : '';
      return apiRequest(`/api/projects${params}`);
    },

    async getById(id) {
      return apiRequest(`/api/projects/${id}`);
    },

    async create(name, description, member_ids, deadline) {
      return apiRequest('/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name, description, member_ids, deadline }),
      });
    },

    async update(id, updates) {
      return apiRequest(`/api/projects/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },

    async delete(id) {
      return apiRequest(`/api/projects/${id}`, { method: 'DELETE' });
    },
  },

  // Google Calendar
  google: {
    async getAuthUrl() {
      return apiRequest('/api/google/auth-url');
    },

    async getStatus() {
      return apiRequest('/api/google/status');
    },

    async disconnect() {
      return apiRequest('/api/google/disconnect', { method: 'DELETE' });
    },

    async syncEvent(taskId, title, date, startTime, endTime, location, googleEventId) {
      return apiRequest('/api/google/sync-event', {
        method: 'POST',
        body: JSON.stringify({ taskId, title, date, startTime, endTime, location, googleEventId }),
      });
    },

    async deleteEvent(googleEventId) {
      return apiRequest(`/api/google/event/${googleEventId}`, { method: 'DELETE' });
    },
  },

  // Invitations
  invitations: {
    async create(email, name, avatar_color) {
      return apiRequest('/api/invitations', {
        method: 'POST',
        body: JSON.stringify({ email, name, avatar_color }),
      });
    },

    async list(status) {
      const query = status ? `?status=${status}` : '';
      return apiRequest(`/api/invitations${query}`);
    },

    async revoke(id) {
      return apiRequest(`/api/invitations/${id}`, { method: 'DELETE' });
    },

    async resend(id) {
      return apiRequest(`/api/invitations/${id}/resend`, { method: 'POST' });
    },

    async validate(token) {
      return apiRequest(`/api/invitations/validate/${token}`);
    },

    async accept(token) {
      return apiRequest(`/api/invitations/${token}/accept`, { method: 'POST' });
    },
  },

  // Member dashboard
  member: {
    async getProjects(status) {
      const query = status ? `?status=${status}` : '';
      return apiRequest(`/api/member/projects${query}`);
    },

    async getTasks(filters) {
      const query = new URLSearchParams(filters).toString();
      return apiRequest(`/api/member/tasks?${query}`);
    },

    async updateTask(id, updates) {
      return apiRequest(`/api/member/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },

    async logTaskTime(id, minutes, description, date) {
      return apiRequest(`/api/member/tasks/${id}/time`, {
        method: 'POST',
        body: JSON.stringify({ minutes, description, date }),
      });
    },

    async logProjectTime(id, minutes, description, date) {
      return apiRequest(`/api/member/projects/${id}/time`, {
        method: 'POST',
        body: JSON.stringify({ minutes, description, date }),
      });
    },

    async getTimeLogs(filters) {
      const query = new URLSearchParams(filters).toString();
      return apiRequest(`/api/member/time-logs?${query}`);
    },

    async getProfile() {
      return apiRequest('/api/member/profile');
    },
  },

  // Idées
  notes: {
    // Notes CRUD
    async list(filters = {}) {
      const query = new URLSearchParams(filters).toString();
      return apiRequest(`/api/notes?${query}`);
    },

    async get(id) {
      return apiRequest(`/api/notes/${id}`);
    },

    async create(data) {
      return apiRequest('/api/notes', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async update(id, data) {
      return apiRequest(`/api/notes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async delete(id) {
      return apiRequest(`/api/notes/${id}`, { method: 'DELETE' });
    },

    async search(query, limit = 50) {
      return apiRequest(`/api/notes/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    },

    // Shares management
    shares: {
      async list(noteId) {
        return apiRequest(`/api/notes/${noteId}/shares`);
      },

      async create(noteId, data) {
        return apiRequest(`/api/notes/${noteId}/share`, {
          method: 'POST',
          body: JSON.stringify(data),
        });
      },

      async remove(noteId, targetUserId) {
        return apiRequest(`/api/notes/${noteId}/share/${targetUserId}`, { method: 'DELETE' });
      },
    },
  },
};

// Export mode for conditional logic
export const isLocalMode = MODE === 'local';
export const isApiMode = MODE === 'api';
