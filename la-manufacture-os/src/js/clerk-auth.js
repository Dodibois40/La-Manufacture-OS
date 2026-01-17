// Clerk Authentication Module - Custom UI (Headless)
// NOTE: Clerk is loaded LAZILY via dynamic import to not block page load on iOS

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

let Clerk = null; // Will be loaded dynamically
let clerk = null;
let initialized = false;
let clerkLoadPromise = null; // Cache the loading promise

// Token cache for performance (avoid refetching on every API call)
let cachedToken = null;
let tokenExpiry = 0;

// Helper: Promise with timeout (MUST be defined before initClerk uses it)
const withTimeout = (promise, ms, errorMsg) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms))
  ]);
};

// Load Clerk SDK lazily (dynamic import)
async function loadClerkSDK() {
  if (Clerk) return Clerk;

  if (clerkLoadPromise) return clerkLoadPromise;

  console.log('[Clerk] Loading SDK dynamically...');
  clerkLoadPromise = import('@clerk/clerk-js').then(module => {
    Clerk = module.Clerk;
    console.log('[Clerk] SDK loaded');
    return Clerk;
  });

  return clerkLoadPromise;
}

// Initialize Clerk with timeout for iOS
export async function initClerk() {
  console.log('[Clerk] initClerk called');

  if (initialized && clerk) {
    console.log('[Clerk] Already initialized');
    return clerk;
  }

  if (!CLERK_PUBLISHABLE_KEY) {
    console.warn('[Clerk] No publishable key!');
    throw new Error('CLERK_PUBLISHABLE_KEY manquant');
  }

  try {
    // Load SDK first (lazy)
    await withTimeout(loadClerkSDK(), 8000, 'Clerk SDK load timeout');

    console.log('[Clerk] Creating Clerk instance...');
    clerk = new Clerk(CLERK_PUBLISHABLE_KEY);
    console.log('[Clerk] Instance created, calling load()...');

    // Timeout after 10s (reduced from 12s for faster feedback)
    await withTimeout(
      clerk.load(),
      10000,
      'Clerk.load() timeout 10s'
    );

    console.log('[Clerk] load() complete');
    initialized = true;
    return clerk;
  } catch (err) {
    console.error('[Clerk] init failed:', err);
    initialized = false;
    clerk = null;
    throw err;
  }
}

// Check if user is signed in
export function isSignedIn() {
  return !!clerk?.user;
}

// Get current Clerk user
export function getClerkUser() {
  return clerk?.user || null;
}

// Get Clerk session
export function getSession() {
  return clerk?.session || null;
}

// Get JWT token for API calls (cached for 50s to avoid refetching)
export async function getToken() {
  if (!clerk?.session) {
    cachedToken = null;
    return null;
  }

  // Return cached token if still valid (with 10s buffer before expiry)
  const now = Date.now();
  if (cachedToken && tokenExpiry > now + 10000) {
    return cachedToken;
  }

  try {
    cachedToken = await clerk.session.getToken();
    tokenExpiry = now + 50000; // Cache for 50s (Clerk tokens expire at 60s)
    return cachedToken;
  } catch (err) {
    console.error('Error getting Clerk token:', err);
    cachedToken = null;
    return null;
  }
}

// Sign in with email/password (custom UI)
export async function signInWithEmail(email, password) {
  console.log('[Clerk] signInWithEmail called');

  // Auto-init Clerk if not ready (lazy initialization for iOS)
  if (!clerk || !initialized) {
    console.log('[Clerk] Not initialized, initializing now...');
    try {
      await initClerk();
    } catch (initErr) {
      console.error('[Clerk] Init failed during login:', initErr);
      return { success: false, error: 'Connexion serveur échouée. Réessaie.' };
    }
  }

  // Verify Clerk is ready
  if (!clerk?.client?.signIn) {
    console.log('[Clerk] ERROR: Clerk not ready after init');
    return { success: false, error: 'Service auth indisponible. Recharge la page.' };
  }

  try {
    console.log('[Clerk] Calling signIn.create...');

    const result = await withTimeout(
      clerk.client.signIn.create({
        identifier: email,
        password: password,
      }),
      15000,
      'Timeout - Vérifie ta connexion internet'
    );

    console.log('[Clerk] signIn.create returned:', result?.status);

    if (result.status === 'complete') {
      console.log('[Clerk] Status complete, setting active...');
      await withTimeout(
        clerk.setActive({ session: result.createdSessionId }),
        8000,
        'Session timeout'
      );
      console.log('[Clerk] Session set, returning success');
      return { success: true };
    } else {
      console.log('[Clerk] Unexpected status:', result.status);
      return { success: false, status: result.status, error: `Status: ${result.status}` };
    }
  } catch (err) {
    console.error('[Clerk] signIn error:', err);

    let message = 'Erreur de connexion';
    if (err.message) {
      message = err.message;
    } else if (err.errors && err.errors[0]) {
      message = err.errors[0].longMessage || err.errors[0].message || message;
    }

    return { success: false, error: message };
  }
}

// Sign up with email/password (custom UI)
export async function signUpWithEmail(email, password, firstName) {
  if (!clerk) {
    throw new Error('Clerk not initialized');
  }

  try {
    const result = await clerk.client.signUp.create({
      emailAddress: email,
      password: password,
      firstName: firstName,
    });

    if (result.status === 'complete') {
      await clerk.setActive({ session: result.createdSessionId });
      return { success: true };
    } else if (result.status === 'missing_requirements') {
      // Email verification needed
      await result.prepareEmailAddressVerification({ strategy: 'email_code' });
      return { success: false, status: 'needs_verification', signUp: result };
    } else {
      return { success: false, status: result.status, error: 'Additional steps required' };
    }
  } catch (err) {
    console.error('Sign up error:', err);
    const message = err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Sign up failed';
    return { success: false, error: message };
  }
}

// Verify email code during sign up
export async function verifyEmailCode(signUp, code) {
  try {
    const result = await signUp.attemptEmailAddressVerification({ code });

    if (result.status === 'complete') {
      await clerk.setActive({ session: result.createdSessionId });
      return { success: true };
    } else {
      return { success: false, error: 'Verification failed' };
    }
  } catch (err) {
    console.error('Verification error:', err);
    const message = err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Verification failed';
    return { success: false, error: message };
  }
}

// Forgot Password - Send reset code
export async function forgotPassword(email) {
  if (!clerk) {
    throw new Error('Clerk not initialized');
  }

  try {
    const result = await clerk.client.signIn.create({
      identifier: email,
      strategy: 'reset_password_email_code',
    });
    return { success: true, signIn: result };
  } catch (err) {
    console.error('Forgot password error:', err);
    const message = err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Failed to send reset code';
    return { success: false, error: message };
  }
}

// Reset Password - Complete the reset with code and new password
export async function resetPassword(signIn, code, newPassword) {
  try {
    const result = await signIn.attemptFirstFactor({
      strategy: 'reset_password_email_code',
      code,
      password: newPassword,
    });

    if (result.status === 'complete') {
      await clerk.setActive({ session: result.createdSessionId });
      return { success: true };
    } else {
      return { success: false, error: 'Reset incomplete', status: result.status };
    }
  } catch (err) {
    console.error('Reset password error:', err);
    const message = err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Reset failed';
    return { success: false, error: message };
  }
}

// Sign out
export async function signOut() {
  if (!clerk) return;
  cachedToken = null; // Clear token cache
  tokenExpiry = 0;
  await clerk.signOut();
  window.location.reload();
}

// Open Sign In modal (fallback)
export function openSignIn(options = {}) {
  if (!clerk) {
    console.error('Clerk not initialized');
    return;
  }
  clerk.openSignIn({
    redirectUrl: window.location.href,
    ...options,
  });
}

// Open Sign Up modal (fallback)
export function openSignUp(options = {}) {
  if (!clerk) {
    console.error('Clerk not initialized');
    return;
  }
  clerk.openSignUp({
    redirectUrl: window.location.href,
    ...options,
  });
}

// Open User Profile modal
export function openUserProfile() {
  if (!clerk) {
    console.error('Clerk not initialized');
    return;
  }
  clerk.openUserProfile();
}

// Listen for auth state changes
export function onAuthStateChange(callback) {
  if (!clerk) return () => {};

  // Initial callback
  callback(isSignedIn(), getClerkUser());

  // Listen for changes
  return clerk.addListener((event) => {
    callback(isSignedIn(), getClerkUser());
  });
}

// Get Clerk instance (for advanced use)
export function getClerk() {
  return clerk;
}
