import { playSound } from './utils.js';

export const initAuth = (state, renderCallback) => {
  // Elements
  const authView = document.getElementById('view-auth');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');

  // Inputs Login
  const loginEmail = document.getElementById('loginEmail');
  const loginPass = document.getElementById('loginPassword');
  const loginBtn = document.getElementById('loginBtn');
  const loginError = document.getElementById('loginError');

  // Inputs Register
  const regName = document.getElementById('registerName');
  const regEmail = document.getElementById('registerEmail');
  const regPass = document.getElementById('registerPassword');
  const regBtn = document.getElementById('registerBtn');
  const regError = document.getElementById('registerError');

  // Password visibility toggles
  document.querySelectorAll('.password-toggle, .password-toggle-minimal').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      const eyeOpen = btn.querySelector('.eye-open');
      const eyeClosed = btn.querySelector('.eye-closed');

      if (input.type === 'password') {
        input.type = 'text';
        eyeOpen.classList.add('hidden');
        eyeClosed.classList.remove('hidden');
      } else {
        input.type = 'password';
        eyeOpen.classList.remove('hidden');
        eyeClosed.classList.add('hidden');
      }
    });
  });

  // Toggle links
  document.getElementById('showRegister')?.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
  });

  document.getElementById('showLogin')?.addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
  });

  // Login Logic
  loginBtn?.addEventListener('click', async () => {
    const email = loginEmail.value.trim();
    const password = loginPass.value.trim();

    if (!email || !password) {
      showError(loginError, 'Veuillez remplir tous les champs');
      return;
    }

    setLoading(loginBtn, true);
    try {
      const { api, tokenStorage } = await import('./api-client.js');
      const res = await api.auth.login(email, password);

      if (res.token) {
        // Sauvegarder le token en localStorage (fallback mobile/Safari)
        tokenStorage.set(res.token);
        handleAuthSuccess(res.user, state, renderCallback);
      } else {
        showError(loginError, 'Erreur de connexion');
      }
    } catch (e) {
      showError(loginError, 'Email ou mot de passe incorrect');
    } finally {
      setLoading(loginBtn, false);
    }
  });

  // Register Logic
  regBtn?.addEventListener('click', async () => {
    const name = regName.value.trim();
    const email = regEmail.value.trim();
    const password = regPass.value.trim();

    if (!name || !email || !password) {
      showError(regError, 'Veuillez remplir tous les champs');
      return;
    }

    setLoading(regBtn, true);
    try {
      const { api, tokenStorage } = await import('./api-client.js');
      const res = await api.auth.register(email, password, name);

      if (res.token) {
        // Sauvegarder le token en localStorage (fallback mobile/Safari)
        tokenStorage.set(res.token);
        handleAuthSuccess(res.user, state, renderCallback);
      }
    } catch (e) {
      showError(regError, 'Erreur lors de l\'inscription (Email déjà pris ?)');
    } finally {
      setLoading(regBtn, false);
    }
  });
};

// Check session on load
export const checkSession = async () => {
  // If logout was requested, force return null
  if (localStorage.getItem('force_logout') === 'true') {
    localStorage.removeItem('force_logout');
    return null;
  }

  try {
    const { api } = await import('./api-client.js');
    const res = await api.auth.me();
    return res.user;
  } catch (err) {
    return null;
  }
};

// Helpers
const showError = (el, msg) => {
  if (el) {
    el.textContent = msg;
    el.style.display = 'block';
  }
};

const setLoading = (btn, isLoading) => {
  if (btn) {
    btn.disabled = isLoading;
    btn.textContent = isLoading ? 'Chargement...' : (btn.dataset.originalText || btn.textContent);
    if (!btn.dataset.originalText) btn.dataset.originalText = btn.textContent;
  }
};

const handleAuthSuccess = async (user, state, renderCallback) => {
  // Reset morning briefing so it shows after login
  localStorage.removeItem('last_briefing');

  // Update local state owner with user's name
  if (user && user.name) {
    // Remplace le premier owner par le nom de l'utilisateur
    if (!state.settings.owners.includes(user.name)) {
      state.settings.owners = [user.name, ...state.settings.owners.filter(o => o !== 'Thibaud')];
    } else {
      // S'assurer que le nom de l'user est en premier
      state.settings.owners = [user.name, ...state.settings.owners.filter(o => o !== user.name)];
    }

    // Sauvegarder localement
    const { saveState } = await import('./storage.js');
    saveState(state);

    // Synchroniser avec l'API
    try {
      const { syncStateToApi } = await import('./storage.js');
      await syncStateToApi(state);
    } catch (e) {
      console.error('Failed to sync settings to API:', e);
    }
  }

  // Son de bienvenue style Tesla
  playSound('prout');

  // Refresh page to reload with personalized name (délai pour laisser le son jouer)
  setTimeout(() => window.location.reload(), 700);
};
