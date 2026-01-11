import { api, isApiMode } from './api-client.js';

let notificationCount = 0;
let pollInterval = null;

// Format relative time
const timeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return 'A l\'instant';
  if (seconds < 3600) return `Il y a ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `Il y a ${Math.floor(seconds / 3600)}h`;
  return `Il y a ${Math.floor(seconds / 86400)}j`;
};

// Update badge count
const updateBadge = (count) => {
  const badge = document.getElementById('notificationBadge');
  if (!badge) return;

  notificationCount = count;
  badge.textContent = count > 99 ? '99+' : count;
  badge.classList.toggle('hidden', count === 0);
};

// Render notifications list
const renderNotifications = (notifications) => {
  const list = document.getElementById('notificationList');
  if (!list) return;

  if (notifications.length === 0) {
    list.innerHTML = '<div class="notification-empty">Aucune notification</div>';
    return;
  }

  list.innerHTML = notifications.map(n => `
    <div class="notification-item ${n.read ? '' : 'unread'}" data-id="${n.id}">
      <div class="notification-item-title">${n.title}</div>
      <div class="notification-item-message">${n.message || ''}</div>
      <div class="notification-item-time">${timeAgo(n.created_at)}</div>
    </div>
  `).join('');

  // Add click listeners to mark as read
  list.querySelectorAll('.notification-item').forEach(item => {
    item.addEventListener('click', async () => {
      const id = item.dataset.id;
      if (!item.classList.contains('unread')) return;

      try {
        await api.notifications.markRead(id);
        item.classList.remove('unread');
        updateBadge(notificationCount - 1);
      } catch (e) {
        console.error('Failed to mark notification as read:', e);
      }
    });
  });
};

// Load notifications
export const loadNotifications = async () => {
  if (!isApiMode) return;

  try {
    const [countResult, notifResult] = await Promise.all([
      api.notifications.getUnreadCount(),
      api.notifications.getAll()
    ]);

    updateBadge(countResult.count);
    renderNotifications(notifResult.notifications);
  } catch (e) {
    console.error('Failed to load notifications:', e);
  }
};

// Start polling (every 30s)
export const startNotificationPolling = () => {
  if (pollInterval) return;

  loadNotifications();
  pollInterval = setInterval(loadNotifications, 30000);
};

export const stopNotificationPolling = () => {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
};

// Initialize notifications UI
export const initNotifications = () => {
  const bell = document.getElementById('notificationBell');
  const dropdown = document.getElementById('notificationDropdown');
  const markAllBtn = document.getElementById('markAllReadBtn');

  if (!bell || !dropdown) return;

  // Toggle dropdown
  bell.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
    if (!dropdown.classList.contains('hidden')) {
      loadNotifications();
    }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== bell) {
      dropdown.classList.add('hidden');
    }
  });

  // Mark all as read
  if (markAllBtn) {
    markAllBtn.addEventListener('click', async () => {
      try {
        await api.notifications.markAllRead();
        updateBadge(0);
        document.querySelectorAll('.notification-item.unread').forEach(item => {
          item.classList.remove('unread');
        });
      } catch (e) {
        console.error('Failed to mark all as read:', e);
      }
    });
  }

  // Start polling if in API mode
  if (isApiMode) {
    startNotificationPolling();
  }
};
