import { toast } from './utils.js';
import { loadState, saveState, initStorageUI, loadStateFromApi } from './storage.js';
import { isApiMode, api } from './api-client.js';
import { appCallbacks } from './app-callbacks.js';
import { renderDay, renderWeek, initEditMode, initPlanningControls } from './views.js';
import { renderInboxUI, initInboxControls, inboxCtx } from './inbox.js';
import { renderConfig, initConfig } from './config.js';
import { initCommandBar } from './commandbar.js';
import { runAutoCarryOver } from './carryover.js';
import { initMorningBriefing, initFocusTimer } from './morning.js';
import { initSpeechToText } from './speech.js';
import { initClerk, isSignedIn, signInWithEmail, signUpWithEmail, verifyEmailCode } from './clerk-auth.js';
import { initNotifications, startNotificationPolling } from './notifications.js';
import { initShareModal } from './share.js';
import { initTeam } from './team.js';
import { initGoogleCalendar, isGoogleConnected, syncTaskToGoogle } from './google-calendar.js';
import { initDailyReview } from './daily-review.js';
import { openQuickDump, initQuickDumpShortcut } from './quick-dump.js';

// Load state (local first, then sync from API)
let state = loadState();
state.tasks = Array.isArray(state.tasks) ? state.tasks : [];
state.settings = state.settings && typeof state.settings === 'object' ? state.settings : {};

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
let currentView = 'day';

export const setView = (name) => {
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

  currentView = name;
  if (name !== 'auth') render(name);
};

// Master render - now only renders the active view for performance
export const render = (viewName = currentView) => {
  // Only render the currently active view to avoid unnecessary DOM operations
  switch (viewName) {
    case 'day':
      renderDay(state);
      break;
    case 'week':
      renderWeek(state);
      break;
    case 'inbox':
      renderInboxUI(state);
      break;
    case 'config':
      renderConfig(state);
      break;
    // No need to render auth view - it's static
  }
};

// Register callbacks for other modules
appCallbacks.render = render;
appCallbacks.setView = setView;

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
  let pendingSignUp = null;
  const verifyForm = document.getElementById('verifyForm');
  const verifyBtn = document.getElementById('verifyBtn');
  const verifyError = document.getElementById('verifyError');

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
      pendingSignUp = result.signUp;
      registerForm?.classList.add('hidden');
      verifyForm?.classList.remove('hidden');
      document.getElementById('verifyCode')?.focus();
      registerBtn.disabled = false;
      registerBtn.textContent = 'Create Account';
    } else {
      if (registerError) registerError.textContent = result.error || 'Sign up failed';
      registerBtn.disabled = false;
      registerBtn.textContent = 'Create Account';
    }
  });

  // Verify code handler
  verifyBtn?.addEventListener('click', async () => {
    const code = document.getElementById('verifyCode')?.value?.trim();
    if (!code || !pendingSignUp) {
      if (verifyError) verifyError.textContent = 'Please enter the code';
      return;
    }

    verifyBtn.disabled = true;
    verifyBtn.textContent = 'Verifying...';
    if (verifyError) verifyError.textContent = '';

    const result = await verifyEmailCode(pendingSignUp, code);

    if (result.success) {
      window.location.reload();
    } else {
      if (verifyError) verifyError.textContent = result.error || 'Verification failed';
      verifyBtn.disabled = false;
      verifyBtn.textContent = 'Verify';
    }
  });

  // Back to register
  document.getElementById('backToRegister')?.addEventListener('click', (e) => {
    e.preventDefault();
    verifyForm?.classList.add('hidden');
    registerForm?.classList.remove('hidden');
    pendingSignUp = null;
  });

  // Enter key handlers
  document.getElementById('loginPassword')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loginBtn?.click();
  });

  document.getElementById('registerPassword')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') registerBtn?.click();
  });

  document.getElementById('verifyCode')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') verifyBtn?.click();
  });
};

// Init app
const initApp = async () => {
  // Fallback: remove briefing-active after 10s if still present
  setTimeout(() => {
    document.body.classList.remove('briefing-active');
  }, 10000);

  // Fallback: hide loader after 8s max
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
        saveState(state);
        toast('Synchronise');
      }

      // 4. Init Notifications & Share
      initNotifications();
      initShareModal();
      startNotificationPolling();

      // 5. Init Team Management & Google Calendar
      initTeam(user?.id);
      await initGoogleCalendar();
    } catch (err) {
      console.error('Sync error:', err);
      toast('Erreur de synchronisation');
    }
  }

  // Auto Carry-Over (Silent)
  runAutoCarryOver(state);


  // Navigation listeners
  document.getElementById('nav-day')?.addEventListener('click', () => setView('day'));
  document.getElementById('nav-week')?.addEventListener('click', () => setView('week'));
  document.getElementById('nav-inbox')?.addEventListener('click', () => setView('inbox'));
  document.getElementById('nav-team')?.addEventListener('click', () => {
    window.location.href = '/team.html';
  });
  document.getElementById('nav-config')?.addEventListener('click', () => setView('config'));

  // macOS Dock Magnification Effect
  initDockMagnification();

  // Init modules
  initInboxControls(state, render);
  initConfig(state, render, setView);
  initEditMode(state, render);
  initPlanningControls(state, render);
  initCommandBar(state, render);
  initMorningBriefing(state);
  initFocusTimer();
  initSpeechToText();
  initDailyReview(state, render);
  // Render streak widget
  // Quick dump button
  const handleTasksAdded = async (tasks) => {
    if (isApiMode && isLoggedIn()) {
      for (const t of tasks) {
        try {
          const apiTask = await taskApi.create(t);
          state.tasks.push(apiTask);

          // Sync to Google Calendar if event and connected
          if (apiTask.is_event) {
            if (isGoogleConnected()) {
              try {
                const googleEventId = await syncTaskToGoogle(apiTask);
                if (googleEventId) {
                  await api.tasks.update(apiTask.id, { google_event_id: googleEventId });
                  apiTask.google_event_id = googleEventId;
                }
              } catch (syncError) {
                console.warn('Google sync failed:', syncError);
              }
            } else {
              toast('RDV créé, mais Google Calendar non connecté', 'info');
            }
          }
        } catch (e) {
          console.error('Error adding task from Quick Dump:', e);
          state.tasks.push(t); // Fallback
        }
      }
    } else {
      state.tasks.push(...tasks);
    }
    saveState(state);
    render();
  };

  const quickDumpBtn = document.getElementById('quickDumpBtn');
  if (quickDumpBtn) {
    quickDumpBtn.addEventListener('click', () => {
      openQuickDump(state, handleTasksAdded);
    });
  }

  initQuickDumpShortcut(state, handleTasksAdded);

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
