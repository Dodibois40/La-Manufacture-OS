import { google } from 'googleapis';
import { query } from '../db/connection.js';

// Helper function for internal sync (called from ai.js for auto-sync)
export async function syncEventToGoogleInternal(fastify, userId, task) {
  try {
    // Check if Google connected
    const tokensResult = await query(
      'SELECT access_token, refresh_token, token_expiry, calendar_id FROM google_tokens WHERE user_id = $1',
      [userId]
    );
    if (tokensResult.rows.length === 0) {
      return { success: false, reason: 'not_connected' };
    }

    const tokens = tokensResult.rows[0];
    const calendar_id = tokens.calendar_id || 'primary';

    // Setup OAuth client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: new Date(tokens.token_expiry).getTime()
    });

    // Refresh token if expired
    if (new Date(tokens.token_expiry) < new Date()) {
      fastify.log.info({ userId }, 'Auto-sync: Refreshing Google token...');
      const { credentials } = await oauth2Client.refreshAccessToken();
      await query(
        'UPDATE google_tokens SET access_token = $1, token_expiry = $2, updated_at = CURRENT_TIMESTAMP WHERE user_id = $3',
        [credentials.access_token, new Date(credentials.expiry_date), userId]
      );
      oauth2Client.setCredentials(credentials);
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Format time to HH:MM
    const formatTime = (t) => {
      if (!t) return null;
      const match = String(t).match(/^(\d{1,2})[:h](\d{2})/i);
      return match ? `${match[1].padStart(2, '0')}:${match[2]}` : null;
    };

    const startHM = formatTime(task.start_time);
    if (!startHM) {
      fastify.log.warn({ taskId: task.id, start_time: task.start_time }, 'Auto-sync: Invalid start_time format');
      return { success: false, reason: 'invalid_time' };
    }

    let endHM = formatTime(task.end_time);
    if (!endHM) {
      // Default: 30 min after start
      const [h, m] = startHM.split(':').map(Number);
      const endD = new Date(2000, 0, 1, h, m + 30);
      endHM = `${String(endD.getHours()).padStart(2, '0')}:${String(endD.getMinutes()).padStart(2, '0')}`;
    }

    // Ensure date is only YYYY-MM-DD
    const cleanDate = typeof task.date === 'string' ? task.date.split('T')[0] : new Date(task.date).toISOString().split('T')[0];

    const event = {
      summary: task.text,
      description: 'Synchronisé depuis FLOW',
      location: task.location || undefined,
      start: {
        dateTime: `${cleanDate}T${startHM}:00`,
        timeZone: 'Europe/Paris',
      },
      end: {
        dateTime: `${cleanDate}T${endHM}:00`,
        timeZone: 'Europe/Paris',
      },
    };

    fastify.log.info({ taskId: task.id, summary: event.summary, start: event.start.dateTime }, 'Auto-sync: Creating Google event');

    const result = await calendar.events.insert({
      calendarId: calendar_id,
      resource: event,
    });

    fastify.log.info({ taskId: task.id, googleEventId: result.data.id }, 'Auto-sync: Success');
    return { success: true, eventId: result.data.id };

  } catch (error) {
    fastify.log.error({ userId, taskId: task.id, error: error.message }, 'Auto-sync: Failed');
    return { success: false, reason: 'api_error', error: error.message };
  }
}

// OAuth2 client getter to ensure env vars are loaded
let _oauth2Client = null;
function getOAuth2Client() {
  if (!_oauth2Client) {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new Error('Google Calendar configuration missing');
    }
    _oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }
  return _oauth2Client;
}

// Scopes for Google Calendar
const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

export default async function googleCalendarRoutes(fastify) {
  // Helper to get an authenticated client
  async function getAuthClient(userId) {
    const client = getOAuth2Client();
    // Clone or use a new instance to avoid singleton state issues
    const newClient = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const tokenResult = await query(
      'SELECT access_token, refresh_token, token_expiry FROM google_tokens WHERE user_id = $1',
      [userId]
    );

    if (tokenResult.rows.length === 0) {
      throw new Error('Google Calendar not connected');
    }

    const { access_token, refresh_token, token_expiry } = tokenResult.rows[0];

    newClient.setCredentials({
      access_token,
      refresh_token,
      expiry_date: new Date(token_expiry).getTime()
    });

    // Refresh if needed
    if (new Date(token_expiry) < new Date()) {
      fastify.log.info({ userId }, 'Refreshing Google access token...');
      const { credentials } = await newClient.refreshAccessToken();
      await query(
        `UPDATE google_tokens SET access_token = $1, token_expiry = $2, updated_at = CURRENT_TIMESTAMP WHERE user_id = $3`,
        [credentials.access_token, new Date(credentials.expiry_date), userId]
      );
      newClient.setCredentials(credentials);
      fastify.log.info({ userId }, 'Google access token refreshed');
    }

    return newClient;
  }

  // Get OAuth2 URL for authorization
  fastify.get('/auth-url', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;

    try {
      const authUrl = getOAuth2Client().generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent', // Force to get refresh token
        state: String(userId), // Pass userId in state
      });
      return { authUrl };
    } catch (error) {
      fastify.log.error('Failed to generate auth URL:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // OAuth2 callback - exchange code for tokens
  fastify.get('/callback', async (request, reply) => {
    const { code, state } = request.query;

    if (!code || !state) {
      return reply.status(400).send({ error: 'Missing code or state' });
    }

    const userId = parseInt(state);
    if (isNaN(userId)) {
      return reply.status(400).send({ error: 'Invalid state' });
    }

    try {
      // Exchange code for tokens
      const client = getOAuth2Client();
      const { tokens } = await client.getToken(code);

      // Calculate expiry timestamp
      const expiryDate = new Date(tokens.expiry_date);

      // Save tokens to database (upsert)
      await query(
        `INSERT INTO google_tokens (user_id, access_token, refresh_token, token_expiry)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id) DO UPDATE SET
           access_token = $2,
           refresh_token = COALESCE($3, google_tokens.refresh_token),
           token_expiry = $4,
           updated_at = CURRENT_TIMESTAMP`,
        [userId, tokens.access_token, tokens.refresh_token, expiryDate]
      );

      // Redirect to frontend with success
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return reply.redirect(`${frontendUrl}/#settings?google=connected`);
    } catch (error) {
      fastify.log.error('Google OAuth callback error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return reply.redirect(`${frontendUrl}/#settings?google=error`);
    }
  });

  // Get connection status
  fastify.get('/status', { preHandler: [fastify.authenticate] }, async (request) => {
    const { userId } = request.user;

    const result = await query(
      'SELECT id, calendar_id, token_expiry, created_at FROM google_tokens WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return { connected: false };
    }

    const token = result.rows[0];
    const isExpired = new Date(token.token_expiry) < new Date();

    return {
      connected: true,
      calendarId: token.calendar_id,
      connectedAt: token.created_at,
      needsRefresh: isExpired
    };
  });

  // Disconnect Google Calendar
  fastify.delete('/disconnect', { preHandler: [fastify.authenticate] }, async (request) => {
    const { userId } = request.user;

    await query('DELETE FROM google_tokens WHERE user_id = $1', [userId]);

    return { success: true };
  });

  // Sync event to Google Calendar
  fastify.post('/sync-event', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { taskId, title, date, startTime, endTime, location, googleEventId } = request.body;
    fastify.log.info({ taskId, title, date, startTime, googleEventId }, 'Incoming sync-event request');

    if (!taskId || !title || !date || !startTime) {
      fastify.log.warn('Missing required fields for sync-event');
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    // Check configuration
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      fastify.log.error('Google Calendar configuration missing in environment variables');
      return reply.status(500).send({ error: 'Google Calendar not configured on server' });
    }

    try {
      const client = await getAuthClient(userId);
      const calendar = google.calendar({ version: 'v3', auth: client });

      // Get calendar_id
      const userResult = await query('SELECT calendar_id FROM google_tokens WHERE user_id = $1', [userId]);
      const calendar_id = userResult.rows[0]?.calendar_id || 'primary';

      // Ensure date is only YYYY-MM-DD
      const cleanDate = typeof date === 'string' ? date.split('T')[0] : new Date(date).toISOString().split('T')[0];

      // Format times to HH:MM
      const formatTime = (t) => {
        if (!t) return null;
        const match = t.match(/^(\d{1,2})[:h](\d{2})/i); // Matches HH:MM or HHhMM
        return match ? `${match[1].padStart(2, '0')}:${match[2]}` : null;
      };

      const startHM = formatTime(startTime);
      const endHM = formatTime(endTime) || startHM;

      if (!startHM) {
        return reply.status(400).send({ error: `Invalid startTime format: "${startTime}". Expected HH:MM` });
      }

      // Build event object
      const event = {
        summary: title,
        description: 'Synchronisé depuis FLOW',
        location: location || undefined,
        start: {
          dateTime: `${cleanDate}T${startHM}:00`,
          timeZone: 'Europe/Paris',
        },
        end: {
          dateTime: `${cleanDate}T${endHM}:00`,
          timeZone: 'Europe/Paris',
        },
      };

      // Ensure end is after start (at least 30 mins)
      if (startHM === endHM && !endTime) {
        const [h, m] = startHM.split(':').map(Number);
        const endD = new Date(2000, 0, 1, h, m + 30);
        const endHM_fixed = `${String(endD.getHours()).padStart(2, '0')}:${String(endD.getMinutes()).padStart(2, '0')}`;
        event.end.dateTime = `${cleanDate}T${endHM_fixed}:00`;
      }

      fastify.log.info({ summary: event.summary, start: event.start.dateTime }, 'Syncing to Google');

      let result;
      if (googleEventId) {
        try {
          result = await calendar.events.update({
            calendarId: calendar_id,
            eventId: googleEventId,
            resource: event,
          });
        } catch (updateError) {
          if (updateError.code === 404) {
            // Event was deleted on Google, recreate it
            result = await calendar.events.insert({
              calendarId: calendar_id,
              resource: event,
            });
          } else {
            throw updateError;
          }
        }
      } else {
        result = await calendar.events.insert({
          calendarId: calendar_id,
          resource: event,
        });
      }

      fastify.log.info({ googleEventId: result.data.id }, 'Sync successful');

      return {
        success: true,
        googleEventId: result.data.id,
        htmlLink: result.data.htmlLink
      };
    } catch (error) {
      fastify.log.error(error, 'Google Calendar sync error');
      return reply.status(500).send({
        error: 'Calendar sync failed',
        details: error.message,
        code: error.code
      });
    }
  });

  // Delete event from Google Calendar
  fastify.delete('/event/:googleEventId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { googleEventId } = request.params;

    try {
      const client = await getAuthClient(userId);
      const calendar = google.calendar({ version: 'v3', auth: client });

      // Get calendar_id
      const userResult = await query('SELECT calendar_id FROM google_tokens WHERE user_id = $1', [userId]);
      const calendar_id = userResult.rows[0]?.calendar_id || 'primary';

      await calendar.events.delete({
        calendarId: calendar_id,
        eventId: googleEventId,
      });

      return { success: true };
    } catch (error) {
      // Ignore 404 errors (event already deleted)
      if (error.code === 404) {
        return { success: true };
      }
      fastify.log.error(error, 'Google Calendar delete error');
      return reply.status(500).send({ error: 'Delete failed', details: error.message });
    }
  });
}
