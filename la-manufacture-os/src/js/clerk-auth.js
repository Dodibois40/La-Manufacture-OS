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
    new Promise((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms)),
  ]);
};

// Load Clerk SDK lazily (dynamic import)
async function loadClerkSDK() {
  if (Clerk) return Clerk;

  if (clerkLoadPromise) return clerkLoadPromise;

  console.log('[Clerk] Loading SDK dynamically...');
  clerkLoadPromise = import('@clerk/clerk-js')
    .then(module => {
      // Handle both named export and default export
      Clerk = module.Clerk || module.default;
      if (!Clerk) {
        console.error('[Clerk] SDK module structure:', Object.keys(module));
        throw new Error('Clerk class not found in SDK module');
      }
      console.log('[Clerk] SDK loaded successfully');
      return Clerk;
    })
    .catch(err => {
      console.error('[Clerk] Failed to load SDK:', err);
      clerkLoadPromise = null; // Reset so we can retry
      throw err;
    });

  return clerkLoadPromise;
}

// Detect iOS Safari/WebKit (ITP issues with third-party cookies)
const isIOSWebKit = () => {
  const ua = navigator.userAgent;
  // Check for iOS devices or iPad on iOS 13+ (which reports as Mac)
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
};

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

    // Use shorter timeout on iOS since ITP can cause hangs
    const loadTimeout = isIOSWebKit() ? 6000 : 10000;

    await withTimeout(
      clerk.load({
        // Standardize browser behavior for consistent auth
        standardBrowser: true,
      }),
      loadTimeout,
      `Clerk.load() timeout ${loadTimeout / 1000}s`
    );

    console.log('[Clerk] load() complete, user:', clerk.user?.firstName || 'none');

    // Si déjà connecté après load(), rien à faire
    if (clerk.user) {
      console.log('[Clerk] Already signed in after load');
      initialized = true;
      return clerk;
    }

    // Vérifier si OAuth a créé une session qu'on doit activer
    const signUp = clerk.client?.signUp;
    const signIn = clerk.client?.signIn;

    // SignUp complete (nouveau user via Google)
    if (signUp?.status === 'complete' && signUp?.createdSessionId) {
      console.log('[Clerk] Activating signUp session...');
      await clerk.setActive({ session: signUp.createdSessionId });
    }
    // SignIn complete (user existant via Google)
    else if (signIn?.status === 'complete' && signIn?.createdSessionId) {
      console.log('[Clerk] Activating signIn session...');
      await clerk.setActive({ session: signIn.createdSessionId });
    }

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
  const iosDevice = isIOSWebKit();
  console.log('[Clerk] iOS device:', iosDevice);

  // Auto-init Clerk if not ready (lazy initialization for iOS)
  if (!clerk || !initialized) {
    console.log('[Clerk] Not initialized, initializing now...');
    try {
      await initClerk();
    } catch (initErr) {
      console.error('[Clerk] Init failed during login:', initErr);
      // More specific error for iOS
      if (iosDevice && initErr.message?.includes('timeout')) {
        return {
          success: false,
          error:
            'Timeout iOS - vérifie que Safari autorise les cookies. Paramètres > Safari > Bloquer les cookies = Autoriser.',
        };
      }
      return {
        success: false,
        error: 'Connexion serveur échouée: ' + (initErr.message || 'Réessaie.'),
      };
    }
  }

  // Verify Clerk is ready
  if (!clerk?.client?.signIn) {
    console.log('[Clerk] ERROR: Clerk not ready after init');
    return { success: false, error: 'Service auth indisponible. Recharge la page.' };
  }

  try {
    console.log('[Clerk] Calling signIn.create...');

    let result;
    try {
      result = await withTimeout(
        clerk.client.signIn.create({
          identifier: email,
          password: password,
        }),
        15000,
        'Timeout - Vérifie ta connexion internet'
      );
    } catch (createErr) {
      console.error('[Clerk] signIn.create error:', createErr);
      const errMsg =
        createErr.errors?.[0]?.longMessage ||
        createErr.errors?.[0]?.message ||
        createErr.message ||
        'Erreur login';
      return { success: false, error: errMsg };
    }

    console.log(
      '[Clerk] signIn.create returned:',
      result?.status,
      'firstFactorVerification:',
      result?.firstFactorVerification?.status
    );

    if (result.status === 'complete') {
      console.log('[Clerk] Status complete, setting active...');

      try {
        await withTimeout(
          clerk.setActive({ session: result.createdSessionId }),
          iosDevice ? 5000 : 8000, // Shorter timeout on iOS
          'Session timeout'
        );
        console.log('[Clerk] Session set, returning success');
        return { success: true };
      } catch (setActiveErr) {
        console.error('[Clerk] setActive failed:', setActiveErr);
        // On iOS, setActive might fail due to cookie restrictions
        // But if signIn.create succeeded, the session was created server-side
        // Try to reload Clerk to pick up the session
        if (iosDevice) {
          console.log('[Clerk] iOS fallback: reloading Clerk to sync session...');
          try {
            await withTimeout(clerk.load(), 5000, 'Clerk reload timeout');
            if (clerk.user) {
              console.log('[Clerk] iOS fallback success - user found after reload');
              return { success: true };
            }
          } catch (reloadErr) {
            console.error('[Clerk] iOS reload failed:', reloadErr);
          }
          // If we get here, login succeeded on server but local session failed
          return {
            success: false,
            error: 'Session créée mais sync iOS échouée. Recharge la page.',
          };
        }
        throw setActiveErr;
      }
    } else if (result.status === 'needs_second_factor') {
      console.log('[Clerk] 2FA required, available factors:', result.supportedSecondFactors);

      // Check what 2FA options are available
      const factors = result.supportedSecondFactors || [];
      const hasEmailCode = factors.some(f => f.strategy === 'email_code');
      const hasTotp = factors.some(f => f.strategy === 'totp');

      if (hasEmailCode) {
        // Send email code automatically
        console.log('[Clerk] Sending email verification code...');
        try {
          await result.prepareSecondFactor({ strategy: 'email_code' });
          return {
            success: false,
            status: 'needs_email_code',
            signIn: result,
            error: 'Code envoyé par email. Vérifie ta boîte mail.',
          };
        } catch (prepErr) {
          console.error('[Clerk] Failed to send email code:', prepErr);
          return {
            success: false,
            error: "Impossible d'envoyer le code email: " + (prepErr.message || 'erreur'),
          };
        }
      } else if (hasTotp) {
        return {
          success: false,
          status: 'needs_totp',
          signIn: result,
          error: '2FA TOTP requis. Désactive-le dans Clerk.',
        };
      } else {
        const factorTypes = factors.map(f => f.strategy).join(', ') || 'aucun';
        return {
          success: false,
          status: 'needs_second_factor',
          signIn: result,
          error: `2FA requis (types: ${factorTypes})`,
        };
      }
    } else {
      console.log('[Clerk] Unexpected status:', result.status);
      return { success: false, status: result.status, error: `Status inattendu: ${result.status}` };
    }
  } catch (err) {
    console.error('[Clerk] signIn error:', err);

    let message = 'Erreur de connexion';
    if (err.message) {
      message = err.message;
    } else if (err.errors && err.errors[0]) {
      message = err.errors[0].longMessage || err.errors[0].message || message;
    }

    // Add iOS-specific hint for common errors
    if (iosDevice && (message.includes('timeout') || message.includes('network'))) {
      message += ' (iOS: vérifie les cookies dans Paramètres > Safari)';
    }

    return { success: false, error: message };
  }
}

// Sign in/up with Google OAuth - uses authenticateWithRedirect to bypass Turnstile
export async function signInWithGoogle() {
  console.log('[Clerk] signInWithGoogle called');

  if (!clerk || !initialized) {
    try {
      await initClerk();
    } catch (initErr) {
      return { success: false, error: 'Service auth indisponible' };
    }
  }

  try {
    // Use authenticateWithRedirect - bypasses Turnstile challenge
    await clerk.client.signIn.authenticateWithRedirect({
      strategy: 'oauth_google',
      redirectUrl: window.location.origin,
      redirectUrlComplete: window.location.origin,
    });
    // Browser redirects to Google - won't return here
    return { success: true };
  } catch (err) {
    console.error('[Clerk] Google sign-in error:', err);
    return {
      success: false,
      error: err.errors?.[0]?.message || 'Erreur Google Sign-in',
    };
  }
}

// Handle OAuth callback - simplified
export async function handleOAuthCallback() {
  if (!clerk) return { success: false, error: 'Clerk not ready' };
  if (clerk.user) return { success: true, user: clerk.user };
  return { success: false, error: 'No session' };
}

// Complete 2FA with email code
export async function completeEmailCode(signIn, code) {
  console.log('[Clerk] completeEmailCode called');
  const iosDevice = isIOSWebKit();

  try {
    const result = await withTimeout(
      signIn.attemptSecondFactor({
        strategy: 'email_code',
        code: code,
      }),
      10000,
      'Timeout vérification email'
    );

    console.log('[Clerk] Email code result:', result?.status);

    if (result.status === 'complete') {
      await withTimeout(
        clerk.setActive({ session: result.createdSessionId }),
        iosDevice ? 5000 : 8000,
        'Session timeout'
      );
      return { success: true };
    } else {
      return { success: false, error: `Status: ${result.status}` };
    }
  } catch (err) {
    console.error('[Clerk] Email code error:', err);
    const message =
      err.errors?.[0]?.longMessage || err.errors?.[0]?.message || err.message || 'Code invalide';
    return { success: false, error: message };
  }
}

// Complete 2FA with TOTP code
export async function complete2FA(signIn, code) {
  console.log('[Clerk] complete2FA called');
  const iosDevice = isIOSWebKit();

  try {
    const result = await withTimeout(
      signIn.attemptSecondFactor({
        strategy: 'totp',
        code: code,
      }),
      10000,
      'Timeout 2FA'
    );

    console.log('[Clerk] 2FA result:', result?.status);

    if (result.status === 'complete') {
      await withTimeout(
        clerk.setActive({ session: result.createdSessionId }),
        iosDevice ? 5000 : 8000,
        'Session timeout'
      );
      return { success: true };
    } else {
      return { success: false, error: `Status: ${result.status}` };
    }
  } catch (err) {
    console.error('[Clerk] 2FA error:', err);
    const message =
      err.errors?.[0]?.longMessage || err.errors?.[0]?.message || err.message || 'Code invalide';
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
    const message =
      err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Verification failed';
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
    const message =
      err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Failed to send reset code';
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
  return clerk.addListener(event => {
    callback(isSignedIn(), getClerkUser());
  });
}

// Get Clerk instance (for advanced use)
export function getClerk() {
  return clerk;
}
