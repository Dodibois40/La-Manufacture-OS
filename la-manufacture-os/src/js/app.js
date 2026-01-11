import { toast } from './utils.js';
import { loadState, saveState, initStorageUI, loadStateFromApi } from './storage.js';
import { isApiMode } from './api-client.js';
import { renderDay, renderWeek, initAddTask, initEditMode, initPlanningControls } from './views.js';
import { renderInboxUI, initInboxControls, inboxCtx } from './inbox.js';
import { renderConfig, initConfig } from './config.js';
import { initCommandBar } from './commandbar.js';
import { runAutoCarryOver } from './carryover.js';
import { initMorningBriefing, initFocusTimer } from './morning.js';
import { initSpeechToText } from './speech.js';
import { initAuth, checkSession } from './auth.js';

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

  // Init Auth UI (listeners)
  initAuth(state, render);

  // API Mode Logic
  if (isApiMode) {
    // 1. Check Session
    const user = await checkSession();

    if (!user) {
      // Not logged in -> Show Auth Screen
      hideLoader();
      setView('auth');
      return;
    }

    // 2. Logged in -> Sync Data
    toast('Synchronisation...');
    const apiState = await loadStateFromApi();
    if (apiState) {
      state.tasks = apiState.tasks;
      state.settings = apiState.settings || state.settings;
      state.settings.owners = Array.isArray(state.settings.owners) && state.settings.owners.length
        ? state.settings.owners
        : ['Thibaud'];
      saveState(state);
      toast('Synchronisé ✓');
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
