import { toast } from './utils.js';
import { loadState, saveState, initStorageUI, loadAuth, authApi, isLoggedIn, loadStateFromApi, taskApi } from './storage.js';
import { renderDay, renderWeek, initAddTask, initEditMode } from './views.js';
import { renderInboxUI, initInboxControls, inboxCtx } from './inbox.js';
import { renderConfig, initConfig } from './config.js';
import { initCommandBar } from './commandbar.js';
import { runAutoCarryOver } from './carryover.js';
import { initMorningBriefing, initFocusTimer } from './morning.js';
import { initSpeechToText } from './speech.js';
import { isApiMode } from './api-client.js';

// DOM Elements
const authScreen = document.getElementById('authScreen');
const appContainer = document.getElementById('app');
const navElement = document.querySelector('nav');

// Auth form elements
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showRegisterLink = document.getElementById('showRegister');
const showLoginLink = document.getElementById('showLogin');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const loginError = document.getElementById('loginError');
const registerError = document.getElementById('registerError');

// State
let state = loadState();
window._debugState = state;

// Show error helper
const showError = (element, message) => {
  element.textContent = message;
  element.classList.add('show');
  setTimeout(() => element.classList.remove('show'), 5000);
};

// Initialize app after auth
const initApp = async () => {
  // Load state from API if logged in
  if (isApiMode && isLoggedIn()) {
    try {
      state = await loadStateFromApi();
      window._debugState = state;
    } catch (e) {
      console.error('Failed to load from API:', e);
    }
  }

  state.tasks = Array.isArray(state.tasks) ? state.tasks : [];
  state.settings = state.settings && typeof state.settings === 'object' ? state.settings : { owners: ['Thibaud'] };
  state.settings.owners = Array.isArray(state.settings.owners) && state.settings.owners.length ? state.settings.owners : ['Thibaud'];

  // Auto Carry-Over (Silent)
  runAutoCarryOver(state);

  // Init inbox context
  inboxCtx.owner = state.settings.owners[0] || 'Thibaud';

  // Storage UI
  initStorageUI();

  // Navigation
  const views = ['day', 'week', 'inbox', 'config'];
  const setView = (name) => {
    for (const v of views) {
      const el = document.getElementById('view-' + v);
      const nb = document.getElementById('nav-' + v);
      if (el) el.classList.toggle('active', v === name);
      if (nb) nb.classList.toggle('active', v === name);
    }
    render();
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

  // Navigation listeners
  document.getElementById('nav-day')?.addEventListener('click', () => setView('day'));
  document.getElementById('nav-week')?.addEventListener('click', () => setView('week'));
  document.getElementById('nav-inbox')?.addEventListener('click', () => setView('inbox'));
  document.getElementById('nav-config')?.addEventListener('click', () => setView('config'));

  // Init modules
  initInboxControls(state, render);
  initConfig(state, render);
  initEditMode(state, render);
  initCommandBar(state, render);
  initMorningBriefing(state);
  initFocusTimer();
  initSpeechToText();

  // Initial render
  render();
  toast('Prêt');
};

// Show app (hide auth)
const showApp = () => {
  authScreen.classList.add('hidden');
  appContainer.classList.remove('hidden');
  navElement.classList.remove('hidden');
  initApp();
};

// Show auth (hide app)
const showAuth = () => {
  authScreen.classList.remove('hidden');
  appContainer.classList.add('hidden');
  navElement.classList.add('hidden');
};

// Auth form switching
showRegisterLink?.addEventListener('click', (e) => {
  e.preventDefault();
  loginForm.classList.add('hidden');
  registerForm.classList.remove('hidden');
});

showLoginLink?.addEventListener('click', (e) => {
  e.preventDefault();
  registerForm.classList.add('hidden');
  loginForm.classList.remove('hidden');
});

// Login handler
loginBtn?.addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    showError(loginError, 'Veuillez remplir tous les champs');
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = 'Connexion...';

  try {
    await authApi.login(email, password);
    showApp();
  } catch (error) {
    showError(loginError, error.message || 'Erreur de connexion');
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Se connecter';
  }
});

// Register handler
registerBtn?.addEventListener('click', async () => {
  const name = document.getElementById('registerName').value.trim();
  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value;

  if (!name || !email || !password) {
    showError(registerError, 'Veuillez remplir tous les champs');
    return;
  }

  if (password.length < 6) {
    showError(registerError, 'Le mot de passe doit contenir au moins 6 caractères');
    return;
  }

  registerBtn.disabled = true;
  registerBtn.textContent = 'Inscription...';

  try {
    await authApi.register(email, password, name);
    showApp();
  } catch (error) {
    showError(registerError, error.message || 'Erreur d\'inscription');
  } finally {
    registerBtn.disabled = false;
    registerBtn.textContent = 'S\'inscrire';
  }
});

// Enter key on inputs
document.getElementById('loginPassword')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') loginBtn?.click();
});

document.getElementById('registerPassword')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') registerBtn?.click();
});

// Initial load
const init = async () => {
  // Check if API mode
  if (isApiMode) {
    console.log('🔧 Running in API mode');

    // Try to restore session
    loadAuth();

    if (isLoggedIn()) {
      // Verify session is still valid
      const isValid = await authApi.checkSession();
      if (isValid) {
        showApp();
        return;
      }
    }

    // Show auth screen
    showAuth();
  } else {
    console.log('🔧 Running in LOCAL mode');
    // Local mode - skip auth
    showApp();
  }
};

init();
