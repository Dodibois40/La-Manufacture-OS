// API Client - Switch between local storage and API mode
import { getToken as getClerkToken } from './clerk-auth.js';

const MODE = import.meta.env.VITE_MODE || 'local';
const DEFAULT_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333';
// If we are on a different host (like a local IP), try to use the same host for the API if not explicitly set
const API_URL = import.meta.env.VITE_API_URL ||
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
  }
};

// Helper pour les requêtes API
async function apiRequest(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;

  // Get Clerk token for authentication
  const token = await getClerkToken();
  const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

  const headers = {
    ...authHeaders,
    ...options.headers,
  };

  // Ne mettre Content-Type que s'il y a un body ou si ce n'est pas un DELETE
  if (options.body || (options.method && options.method !== 'DELETE' && options.method !== 'GET')) {
    headers['Content-Type'] = 'application/json';
  }

  const defaultOptions = {
    credentials: 'include',
    headers
  };

  const response = await fetch(url, { ...defaultOptions, ...options });

  if (!response.ok) {
    let errorMessage = `API Error: ${response.status} ${response.statusText}`;
    try {
      const errorJson = await response.json();
      errorMessage = errorJson.error || errorJson.message || errorMessage;
    } catch (_) {
      // Not JSON or empty body
    }
    throw new Error(errorMessage);
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
      const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

      const response = await fetch(`${API_URL}/api/team/files`, {
        method: 'POST',
        credentials: 'include',
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

    async create(name, description, assigned_to, deadline) {
      return apiRequest('/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name, description, assigned_to, deadline }),
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
};

// Export mode for conditional logic
export const isLocalMode = MODE === 'local';
export const isApiMode = MODE === 'api';
