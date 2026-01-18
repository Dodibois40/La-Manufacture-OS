// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║                         PWA MANAGER                                          ║
// ║        Service Worker, Offline Status, Install Prompt                        ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import offlineDB from './offline-storage.js';

let deferredPrompt = null;
let offlineIndicator = null;
let syncBadge = null;

// ═══════════════════════════════════════════════════════════════
// SERVICE WORKER REGISTRATION
// ═══════════════════════════════════════════════════════════════

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[PWA] Service Workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    console.log('[PWA] Service Worker registered:', registration.scope);

    // Check for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      console.log('[PWA] New Service Worker installing...');

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New version available
          showUpdateAvailable(registration);
        }
      });
    });

    return registration;
  } catch (error) {
    console.error('[PWA] Service Worker registration failed:', error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// OFFLINE STATUS INDICATOR
// ═══════════════════════════════════════════════════════════════

export function initOfflineIndicator() {
  // Create indicator element
  offlineIndicator = document.createElement('div');
  offlineIndicator.className = 'offline-indicator';
  offlineIndicator.style.display = 'none';
  offlineIndicator.innerHTML = `
    <span class="dot"></span>
    <span class="text">Mode hors ligne</span>
  `;
  document.body.appendChild(offlineIndicator);

  // Create sync badge
  syncBadge = document.createElement('div');
  syncBadge.className = 'sync-badge';
  syncBadge.style.display = 'none';
  syncBadge.innerHTML = `
    <span class="spinner"></span>
    <span class="text">Synchronisation...</span>
  `;
  document.body.appendChild(syncBadge);

  // Listen for online/offline events
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Check initial state
  if (!navigator.onLine) {
    handleOffline();
  }
}

async function handleOffline() {
  console.log('[PWA] Gone offline');
  if (offlineIndicator) {
    offlineIndicator.style.display = 'flex';
    offlineIndicator.classList.remove('online', 'syncing');
    offlineIndicator.querySelector('.text').textContent = 'Mode hors ligne';
  }

  // Trigger haptic feedback on supported devices
  if ('vibrate' in navigator) {
    navigator.vibrate(50);
  }
}

async function handleOnline() {
  console.log('[PWA] Back online');

  if (offlineIndicator) {
    offlineIndicator.classList.add('syncing');
    offlineIndicator.querySelector('.text').textContent = 'Synchronisation...';
  }

  // Show sync badge
  if (syncBadge) {
    syncBadge.style.display = 'flex';
  }

  // Process sync queue
  try {
    const { api } = await import('./api-client.js');
    const result = await offlineDB.sync.process(api.request);

    console.log('[PWA] Sync complete:', result);

    if (offlineIndicator) {
      offlineIndicator.classList.remove('syncing');
      offlineIndicator.classList.add('online');
      offlineIndicator.querySelector('.text').textContent = `Synchronisé (${result.synced})`;

      // Hide after delay
      setTimeout(() => {
        offlineIndicator.style.display = 'none';
        offlineIndicator.classList.remove('online');
      }, 3000);
    }

    // Trigger haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 50, 50]);
    }

    // Refresh data
    window.dispatchEvent(new CustomEvent('sync-complete', { detail: result }));
  } catch (error) {
    console.error('[PWA] Sync failed:', error);
    if (offlineIndicator) {
      offlineIndicator.classList.remove('syncing');
      offlineIndicator.querySelector('.text').textContent = 'Erreur de sync';
    }
  } finally {
    if (syncBadge) {
      syncBadge.style.display = 'none';
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// PWA INSTALL PROMPT
// ═══════════════════════════════════════════════════════════════

export function initInstallPrompt() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;

    // Show custom install banner after 30 seconds
    setTimeout(() => {
      if (deferredPrompt && !isAppInstalled()) {
        showInstallBanner();
      }
    }, 30000);
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App was installed');
    deferredPrompt = null;
    hideInstallBanner();
  });
}

function isAppInstalled() {
  // Check if running in standalone mode (PWA)
  return (
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
  );
}

function showInstallBanner() {
  // Don't show if already installed or dismissed recently
  const dismissed = localStorage.getItem('pwa-install-dismissed');
  if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) {
    return;
  }

  const banner = document.createElement('div');
  banner.className = 'pwa-install-banner';
  banner.id = 'pwa-install-banner';
  banner.innerHTML = `
    <div class="icon">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
        <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm-1 14h2v2h-2v-2zm0-8h2v6h-2V8z"/>
      </svg>
    </div>
    <div class="content">
      <div class="title">Installer FLOW</div>
      <div class="subtitle">Accès rapide depuis ton écran d'accueil</div>
    </div>
    <button class="install-btn">Installer</button>
    <button class="close-btn">✕</button>
  `;

  document.body.appendChild(banner);

  banner.querySelector('.install-btn').addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('[PWA] Install prompt result:', outcome);
      deferredPrompt = null;
    }
    hideInstallBanner();
  });

  banner.querySelector('.close-btn').addEventListener('click', () => {
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    hideInstallBanner();
  });
}

function hideInstallBanner() {
  const banner = document.getElementById('pwa-install-banner');
  if (banner) {
    banner.style.animation = 'slideUp 0.3s ease-out forwards';
    setTimeout(() => banner.remove(), 300);
  }
}

// ═══════════════════════════════════════════════════════════════
// UPDATE AVAILABLE NOTIFICATION
// ═══════════════════════════════════════════════════════════════

function showUpdateAvailable(registration) {
  const toast = document.createElement('div');
  toast.className = 'offline-indicator';
  toast.style.background = 'rgba(10, 132, 255, 0.95)';
  toast.innerHTML = `
    <span>🔄</span>
    <span>Nouvelle version disponible</span>
    <button style="background:white;color:#0A84FF;border:none;padding:4px 12px;border-radius:8px;font-weight:600;margin-left:8px;">
      Mettre à jour
    </button>
  `;

  document.body.appendChild(toast);

  toast.querySelector('button').addEventListener('click', () => {
    registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  });

  // Auto-dismiss after 10 seconds
  setTimeout(() => {
    toast.style.animation = 'slideUp 0.3s ease-out forwards';
    setTimeout(() => toast.remove(), 300);
  }, 10000);
}

// ═══════════════════════════════════════════════════════════════
// KEYBOARD HEIGHT DETECTION (iOS)
// ═══════════════════════════════════════════════════════════════

export function initKeyboardHandling() {
  if (!('visualViewport' in window)) return;

  const viewportHandler = () => {
    const viewport = window.visualViewport;
    const keyboardHeight = window.innerHeight - viewport.height;

    document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);

    if (keyboardHeight > 100) {
      document.body.classList.add('keyboard-open');
    } else {
      document.body.classList.remove('keyboard-open');
    }
  };

  window.visualViewport.addEventListener('resize', viewportHandler);
  window.visualViewport.addEventListener('scroll', viewportHandler);
}

// ═══════════════════════════════════════════════════════════════
// INITIALIZE ALL PWA FEATURES
// ═══════════════════════════════════════════════════════════════

export async function initPWA() {
  console.log('[PWA] Initializing...');

  // Initialize IndexedDB
  await offlineDB.init();

  // Register Service Worker
  await registerServiceWorker();

  // Setup offline indicator
  initOfflineIndicator();

  // Setup install prompt
  initInstallPrompt();

  // Setup keyboard handling
  initKeyboardHandling();

  // Clear expired cache periodically
  setInterval(
    () => {
      offlineDB.cache.clearExpired();
    },
    5 * 60 * 1000
  ); // Every 5 minutes

  console.log('[PWA] Initialization complete');
}

export default {
  init: initPWA,
  registerServiceWorker,
  initOfflineIndicator,
  initInstallPrompt,
  initKeyboardHandling,
  isAppInstalled,
};
