import { Clerk } from '@clerk/clerk-js';
import { api } from './api-client.js';

// Initialize Clerk
const clerk = new Clerk(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
await clerk.load();

// Get token from URL
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

// DOM elements
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const inviteState = document.getElementById('inviteState');
const successState = document.getElementById('successState');
const errorMessage = document.getElementById('errorMessage');
const acceptBtn = document.getElementById('acceptBtn');

// Show error
function showError(message) {
  loadingState.classList.add('hidden');
  inviteState.classList.add('hidden');
  successState.classList.add('hidden');
  errorState.classList.remove('hidden');
  errorMessage.textContent = message;
}

// Show invite
function showInvite(invitation) {
  loadingState.classList.add('hidden');
  errorState.classList.add('hidden');
  successState.classList.add('hidden');
  inviteState.classList.remove('hidden');

  document.getElementById('managerName').textContent = invitation.manager_name;
  document.getElementById('inviteEmail').textContent = invitation.email;

  // Format expiration date
  const expiresAt = new Date(invitation.expires_at);
  document.getElementById('expiresAt').textContent = expiresAt.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// Show success
function showSuccess() {
  loadingState.classList.add('hidden');
  errorState.classList.add('hidden');
  inviteState.classList.add('hidden');
  successState.classList.remove('hidden');

  // Redirect after 2 seconds
  setTimeout(() => {
    window.location.href = '/member.html';
  }, 2000);
}

// Validate token
async function validateToken() {
  if (!token) {
    showError('Aucun token d\'invitation trouvé dans l\'URL.');
    return;
  }

  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/invitations/validate/${token}`);
    const data = await response.json();

    if (!response.ok || !data.valid) {
      showError(data.error || 'Invitation invalide');
      return;
    }

    // Show invitation details
    showInvite(data.invitation);
  } catch (error) {
    console.error('Error validating token:', error);
    showError('Erreur lors de la validation de l\'invitation.');
  }
}

// Accept invitation
async function acceptInvitation() {
  acceptBtn.disabled = true;
  acceptBtn.textContent = 'Acceptation en cours...';

  try {
    // Check if user is signed in
    if (!clerk.user) {
      // User not signed in, redirect to sign-in/sign-up
      const signInUrl = await clerk.buildSignInUrl({
        redirectUrl: window.location.href, // Return here after sign-in
      });
      window.location.href = signInUrl;
      return;
    }

    // User is signed in, accept invitation
    const result = await api.invitations.accept(token);

    if (result.success) {
      showSuccess();
    } else {
      showError('Erreur lors de l\'acceptation de l\'invitation.');
      acceptBtn.disabled = false;
      acceptBtn.textContent = 'Accepter l\'invitation';
    }
  } catch (error) {
    console.error('Error accepting invitation:', error);
    let errorMsg = 'Erreur lors de l\'acceptation de l\'invitation.';

    // Check if error response has details
    if (error.message) {
      errorMsg = error.message;
    }

    showError(errorMsg);
    acceptBtn.disabled = false;
    acceptBtn.textContent = 'Accepter l\'invitation';
  }
}

// Event listeners
acceptBtn.addEventListener('click', acceptInvitation);

// Initialize
validateToken();
