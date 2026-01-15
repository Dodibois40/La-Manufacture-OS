// Google Calendar Integration
import { api, isApiMode } from './api-client.js';
import { toast } from './utils.js';

let googleConnected = false;

export async function initGoogleCalendar() {
  if (!isApiMode) return;

  const section = document.getElementById('googleCalendarSection');
  if (!section) return;

  // Show section
  section.style.display = 'block';

  // Check URL params for OAuth callback result
  const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
  if (urlParams.get('google') === 'connected') {
    toast('Google Calendar connecte !');
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname + window.location.hash.split('?')[0]);
  } else if (urlParams.get('google') === 'error') {
    toast('Erreur de connexion Google');
    window.history.replaceState({}, '', window.location.pathname + window.location.hash.split('?')[0]);
  }

  await updateGoogleStatus();

  // Connect button
  document.getElementById('googleConnectBtn')?.addEventListener('click', connectGoogle);

  // Disconnect button
  document.getElementById('googleDisconnectBtn')?.addEventListener('click', disconnectGoogle);
}

async function updateGoogleStatus() {
  const statusContainer = document.getElementById('googleStatus');
  if (!statusContainer) return;

  try {
    const status = await api.google.getStatus();
    googleConnected = status.connected;

    const badge = document.getElementById('googleBadge');
    if (badge) {
      badge.classList.toggle('hidden', !googleConnected);
      badge.classList.add('good');
      badge.title = googleConnected ? 'Google Calendar connecté' : '';
    }

    if (status.connected) {
      const connectedDate = new Date(status.connectedAt).toLocaleDateString('fr-FR');
      statusContainer.innerHTML = `
        <div class="google-connected">
          <div class="google-connected-info">
            <svg class="google-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <div>
              <div class="google-connected-title">Google Calendar connecte</div>
              <div class="google-connected-date">Depuis le ${connectedDate}</div>
            </div>
          </div>
          <button id="googleDisconnectBtn" class="google-disconnect-btn">Deconnecter</button>
        </div>
      `;

      // Re-attach disconnect handler
      document.getElementById('googleDisconnectBtn')?.addEventListener('click', disconnectGoogle);
    } else {
      statusContainer.innerHTML = `
        <p class="google-description">Synchronisez automatiquement vos RDV vers Google Calendar</p>
        <button id="googleConnectBtn" class="google-connect-btn">
          <svg class="google-logo" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Connecter Google Calendar
        </button>
      `;

      // Re-attach connect handler
      document.getElementById('googleConnectBtn')?.addEventListener('click', connectGoogle);
    }
  } catch (error) {
    console.error('Error checking Google status:', error);
    statusContainer.innerHTML = `
      <p class="google-error">Impossible de verifier le statut Google Calendar</p>
      <button id="googleConnectBtn" class="google-connect-btn">Connecter Google Calendar</button>
    `;
    document.getElementById('googleConnectBtn')?.addEventListener('click', connectGoogle);
  }
}

async function connectGoogle() {
  try {
    const { authUrl } = await api.google.getAuthUrl();
    // Open in popup or redirect
    window.location.href = authUrl;
  } catch (error) {
    console.error('Error getting Google auth URL:', error);
    if (error.message.includes('not configured')) {
      toast('Google Calendar non configure sur le serveur');
    } else {
      toast('Erreur: ' + error.message);
    }
  }
}

async function disconnectGoogle() {
  if (!confirm('Deconnecter Google Calendar ? Vos RDV ne seront plus synchronises.')) {
    return;
  }

  try {
    await api.google.disconnect();
    googleConnected = false;
    toast('Google Calendar deconnecte');
    await updateGoogleStatus();
  } catch (error) {
    console.error('Error disconnecting Google:', error);
    toast('Erreur: ' + error.message);
  }
}

// Check if Google Calendar is connected
export function isGoogleConnected() {
  return googleConnected;
}

// Sync a task/event to Google Calendar
export async function syncTaskToGoogle(task) {
  if (!googleConnected || !task.is_event) {
    return null;
  }

  try {
    const result = await api.google.syncEvent(
      task.id,
      task.text,
      task.date,
      task.start_time,
      task.end_time,
      task.location,
      task.google_event_id
    );

    return result.googleEventId;
  } catch (error) {
    console.error('Google sync error:', error);
    toast('Erreur sync Google Calendar');
    return null;
  }
}

// Delete event from Google Calendar
export async function deleteGoogleEvent(googleEventId) {
  if (!googleConnected || !googleEventId) {
    return;
  }

  try {
    await api.google.deleteEvent(googleEventId);
  } catch (error) {
    console.error('Google delete error:', error);
  }
}
