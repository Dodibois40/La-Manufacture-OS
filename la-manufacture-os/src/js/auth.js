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
      const { api } = await import('./api-client.js');
      const res = await api.auth.login(email, password);
      
      if (res.token) {
        // Success
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
      const { api } = await import('./api-client.js');
      const res = await api.auth.register(email, password, name);
      
      if (res.token) {
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

const handleAuthSuccess = (user, state, renderCallback) => {
  // Update local state owner if needed
  if (user && user.name) {
    // Si c'est la première connexion et qu'il n'y a pas d'owner défini ou que c'est le défaut
    if (!state.settings.owners.includes(user.name)) {
        // On pourrait ajouter l'user aux owners, ou juste le définir comme actif
        // Pour l'instant on ne touche pas trop aux settings locaux pour pas casser la synchro
    }
  }

  // Refresh page or trigger render
  // Le plus simple pour s'assurer que tout est propre est de recharger ou de lancer l'init
  // Mais ici on va juste cacher l'auth scren et lancer l'app
  
  const authView = document.getElementById('view-auth');
  if (authView) authView.classList.remove('active');
  
  // Re-trigger global app init handled by callback or implicit flow
  // Dans notre cas, initApp attend la fin de checkSession le plus souvent.
  // Si on est déclenché depuis le bouton login, on doit lancer la suite.
  
  window.location.reload(); // Force reload to ensure clean state init from server
};
