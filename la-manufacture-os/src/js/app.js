import { toast } from './utils.js';
import { loadState, saveState, initStorageUI, loadStateFromApi } from './storage.js';
import { isApiMode, api } from './api-client.js';
import { renderDay, renderWeek, initAddTask, initEditMode, initPlanningControls } from './views.js';
import { renderInboxUI, initInboxControls, inboxCtx } from './inbox.js';
import { renderConfig, initConfig } from './config.js';
import { initCommandBar } from './commandbar.js';
import { runAutoCarryOver } from './carryover.js';
import { initMorningBriefing, initFocusTimer } from './morning.js';
import { initSpeechToText } from './speech.js';
import { initClerk, isSignedIn, signInWithEmail, signUpWithEmail, signOut, getClerkUser } from './clerk-auth.js';
import { initNotifications, startNotificationPolling, stopNotificationPolling } from './notifications.js';
import { initShareModal } from './share.js';
import { initTeam } from './team.js';
import { initGoogleCalendar } from './google-calendar.js';
import { initDailyReview } from './daily-review.js';

// Load state (local first, then sync from API)
let state = loadState();
window._debugState = state; // Expose for debugging
state.tasks = Array.isArray(state.tasks) ? state.tasks : [];
state.settings = state.settings && typeof state.settings === 'object' ? state.settings : { owners: ['Thibaud'] };
state.settings.owners = Array.isArray(state.settings.owners) && state.settings.owners.length ? state.settings.owners : ['Thibaud'];

// macOS Dock Magnification
const initDockMagnification = () => {
  const nav = document.querySelector('nav');
  if (!nav) return;

  const buttons = nav.querySelectorAll('button');

  buttons.forEach((btn, index) => {
    btn.addEventListener('mouseenter', () => {
      buttons.forEach((b, i) => {
        b.classList.remove('dock-neighbor-1', 'dock-neighbor-2');
        const distance = Math.abs(i - index);
        if (distance === 1) {
          b.classList.add('dock-neighbor-1');
        } else if (distance === 2) {
          b.classList.add('dock-neighbor-2');
        }
      });
    });

    btn.addEventListener('mouseleave', () => {
      // Small delay to allow transition to another button
      setTimeout(() => {
        const hoveredBtn = nav.querySelector('button:hover');
        if (!hoveredBtn) {
          buttons.forEach(b => {
            b.classList.remove('dock-neighbor-1', 'dock-neighbor-2');
          });
        }
      }, 50);
    });
  });

  // Clear all when leaving the nav entirely
  nav.addEventListener('mouseleave', () => {
    buttons.forEach(b => {
      b.classList.remove('dock-neighbor-1', 'dock-neighbor-2');
    });
  });
};

// Navigation
const views = ['day', 'week', 'inbox', 'config', 'auth'];
const setView = (name) => {
  const nav = document.querySelector('nav');

  if (name === 'auth') {
    if (nav) nav.style.display = 'none';
  } else {
    if (nav) nav.style.display = 'flex';
  }

  for (const v of views) {
    const el = document.getElementById('view-' + v);
    const nb = document.getElementById('nav-' + v);
    if (el) el.classList.toggle('active', v === name);
    if (nb) nb.classList.toggle('active', v === name);
  }

  if (name !== 'auth') render();
};

// Store setView globally for config.js to access
window._setViewCallback = setView;

// Master render
const render = () => {
  renderDay(state);
  renderWeek(state);
  renderInboxUI(state);
  renderConfig(state);
};

// Store render globally for views.js to access
window._renderCallback = render;

// Hide app loader
const hideLoader = () => {
  const loader = document.getElementById('appLoader');
  if (loader) loader.classList.add('hidden');
};

// Initialize custom auth UI with Clerk
const initAuthUI = () => {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const showRegister = document.getElementById('showRegister');
  const showLogin = document.getElementById('showLogin');
  const loginError = document.getElementById('loginError');
  const registerError = document.getElementById('registerError');

  // Toggle between login and register
  showRegister?.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm?.classList.add('hidden');
    registerForm?.classList.remove('hidden');
  });

  showLogin?.addEventListener('click', (e) => {
    e.preventDefault();
    registerForm?.classList.add('hidden');
    loginForm?.classList.remove('hidden');
  });

  // Password visibility toggle
  document.querySelectorAll('.password-toggle-minimal').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (input) {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        btn.querySelector('.eye-open')?.classList.toggle('hidden', !isPassword);
        btn.querySelector('.eye-closed')?.classList.toggle('hidden', isPassword);
      }
    });
  });

  // Login handler
  loginBtn?.addEventListener('click', async () => {
    const email = document.getElementById('loginEmail')?.value?.trim();
    const password = document.getElementById('loginPassword')?.value;

    if (!email || !password) {
      if (loginError) loginError.textContent = 'Please fill in all fields';
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = 'Signing in...';
    if (loginError) loginError.textContent = '';

    const result = await signInWithEmail(email, password);

    if (result.success) {
      window.location.reload();
    } else {
      if (loginError) loginError.textContent = result.error || 'Sign in failed';
      loginBtn.disabled = false;
      loginBtn.textContent = 'Sign In';
    }
  });

  // Register handler
  registerBtn?.addEventListener('click', async () => {
    const name = document.getElementById('registerName')?.value?.trim();
    const email = document.getElementById('registerEmail')?.value?.trim();
    const password = document.getElementById('registerPassword')?.value;

    if (!name || !email || !password) {
      if (registerError) registerError.textContent = 'Please fill in all fields';
      return;
    }

    registerBtn.disabled = true;
    registerBtn.textContent = 'Creating account...';
    if (registerError) registerError.textContent = '';

    const result = await signUpWithEmail(email, password, name);

    if (result.success) {
      window.location.reload();
    } else if (result.status === 'needs_verification') {
      if (registerError) registerError.textContent = 'Check your email for verification code';
      registerBtn.disabled = false;
      registerBtn.textContent = 'Create Account';
    } else {
      if (registerError) registerError.textContent = result.error || 'Sign up failed';
      registerBtn.disabled = false;
      registerBtn.textContent = 'Create Account';
    }
  });

  // Enter key handlers
  document.getElementById('loginPassword')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loginBtn?.click();
  });

  document.getElementById('registerPassword')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') registerBtn?.click();
  });
};

// Init app
const initApp = async () => {
  // Fallback: enlever briefing-active apres 10s si toujours present
  setTimeout(() => {
    document.body.classList.remove('briefing-active');
  }, 10000);

  // Fallback: cacher le loader apres 8s max
  setTimeout(hideLoader, 8000);

  // Storage UI
  initStorageUI();

  // API Mode Logic
  if (isApiMode) {
    // 1. Initialize Clerk
    await initClerk();

    // 2. Check if signed in
    if (!isSignedIn()) {
      // Not logged in -> Show custom auth view
      hideLoader();
      initAuthUI();
      setView('auth');
      return;
    }

    // 3. Logged in -> Sync Data from API
    toast('Synchronisation...');
    try {
      // Call /me to sync local user and get userId
      const { user } = await api.auth.me();
      const apiState = await loadStateFromApi();
      if (apiState) {
        state.tasks = apiState.tasks;
        state.settings = apiState.settings || state.settings;
        state.settings.owners = Array.isArray(state.settings.owners) && state.settings.owners.length
          ? state.settings.owners
          : ['Thibaud'];
        saveState(state);
        toast('Synchronise');
      }

      // 4. Init Notifications & Share
      initNotifications();
      initShareModal();
      startNotificationPolling();

      // 5. Init Team Management & Google Calendar
      initTeam(user?.id);
      initGoogleCalendar();
    } catch (err) {
      console.error('Sync error:', err);
      toast('Erreur de synchronisation');
    }
  }

  // Auto Carry-Over (Silent)
  runAutoCarryOver(state);

  // Init inbox context
  inboxCtx.owner = state.settings.owners[0] || 'Thibaud';

  // Navigation listeners
  document.getElementById('nav-day')?.addEventListener('click', () => setView('day'));
  document.getElementById('nav-week')?.addEventListener('click', () => setView('week'));
  document.getElementById('nav-inbox')?.addEventListener('click', () => setView('inbox'));
  document.getElementById('nav-config')?.addEventListener('click', () => setView('config'));

  // macOS Dock Magnification Effect
  initDockMagnification();

  // Init modules
  initInboxControls(state, render);
  initConfig(state, render);
  initEditMode(state, render);
  initPlanningControls(state, render);
  initCommandBar(state, render);
  initMorningBriefing(state);
  initFocusTimer();
  initSpeechToText();
  initDailyReview(state, render);

  // Initial render
  if (isApiMode) {
    // If we are here, we are logged in
    hideLoader();
    setView('day');
  } else {
    // Local mode
    hideLoader();
    toast('Prêt (mode local)');
    setView('day');
  }
};

// Start app
initApp();
