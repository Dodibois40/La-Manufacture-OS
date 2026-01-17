// Clerk Authentication Module - Custom UI (Headless)
import { Clerk } from '@clerk/clerk-js';

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

let clerk = null;
let initialized = false;

// Initialize Clerk
export async function initClerk() {
  if (initialized && clerk) {
    return clerk;
  }

  if (!CLERK_PUBLISHABLE_KEY) {
    console.warn('Clerk publishable key not configured');
    return null;
  }

  clerk = new Clerk(CLERK_PUBLISHABLE_KEY);
  await clerk.load();

  initialized = true;
  return clerk;
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

// Get JWT token for API calls
export async function getToken() {
  if (!clerk?.session) {
    return null;
  }
  try {
    return await clerk.session.getToken();
  } catch (err) {
    console.error('Error getting Clerk token:', err);
    return null;
  }
}

// Sign in with email/password (custom UI)
export async function signInWithEmail(email, password) {
  if (!clerk) {
    throw new Error('Clerk not initialized');
  }

  try {
    const result = await clerk.client.signIn.create({
      identifier: email,
      password: password,
    });

    if (result.status === 'complete') {
      await clerk.setActive({ session: result.createdSessionId });
      return { success: true };
    } else {
      // Handle other statuses (e.g., needs_second_factor)
      return { success: false, status: result.status, error: 'Additional verification required' };
    }
  } catch (err) {
    console.error('Sign in error:', err);
    const message = err.errors?.[0]?.longMessage || err.errors?.[0]?.message || 'Sign in failed';
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
