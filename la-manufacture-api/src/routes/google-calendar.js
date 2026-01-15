import { google } from 'googleapis';
import { query } from '../db/connection.js';

// OAuth2 client configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Scopes for Google Calendar
const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

export default async function googleCalendarRoutes(fastify) {
  // Get OAuth2 URL for authorization
  fastify.get('/auth-url', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return reply.status(500).send({ error: 'Google Calendar not configured' });
    }

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent', // Force to get refresh token
      state: String(userId), // Pass userId in state
    });

    return { authUrl };
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
      const { tokens } = await oauth2Client.getToken(code);

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

    if (!taskId || !title || !date || !startTime) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    // Check configuration
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      fastify.log.error('Google Calendar configuration missing in environment variables');
      return reply.status(500).send({ error: 'Google Calendar not configured on server' });
    }

    try {
      // Get user tokens
      const tokenResult = await query(
        'SELECT access_token, refresh_token, token_expiry, calendar_id FROM google_tokens WHERE user_id = $1',
        [userId]
      );

      if (tokenResult.rows.length === 0) {
        return reply.status(400).send({ error: 'Google Calendar not connected' });
      }

      const { access_token, refresh_token, token_expiry, calendar_id } = tokenResult.rows[0];

      // Set credentials
      oauth2Client.setCredentials({
        access_token,
        refresh_token,
        expiry_date: new Date(token_expiry).getTime()
      });

      // Refresh token if needed
      if (new Date(token_expiry) < new Date()) {
        const { credentials } = await oauth2Client.refreshAccessToken();
        await query(
          `UPDATE google_tokens SET access_token = $1, token_expiry = $2, updated_at = CURRENT_TIMESTAMP WHERE user_id = $3`,
          [credentials.access_token, new Date(credentials.expiry_date), userId]
        );
        oauth2Client.setCredentials(credentials);
      }

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      // Ensure date is only YYYY-MM-DD (remove any T00:00:00.000Z)
      const cleanDate = typeof date === 'string' ? date.split('T')[0] : new Date(date).toISOString().split('T')[0];

      // Format times to HH:MM if they have seconds or are irregular
      const formatTime = (t) => {
        if (!t) return null;
        const match = t.match(/^(\d{1,2}):(\d{2})/);
        return match ? `${match[1].padStart(2, '0')}:${match[2]}` : null;
      };

      const startHM = formatTime(startTime);
      const endHM = formatTime(endTime) || startHM;

      if (!startHM) {
        return reply.status(400).send({ error: 'Invalid startTime format. Expected HH:MM or HH:MM:SS' });
      }

      // Build event object
      const event = {
        summary: title,
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

      // If start and end are same, add 30 mins for safety if no end time was provided
      if (startHM === endHM && !endTime) {
        const [h, m] = startHM.split(':').map(Number);
        const endD = new Date(2000, 0, 1, h, m + 30);
        const endHM_fixed = `${String(endD.getHours()).padStart(2, '0')}:${String(endD.getMinutes()).padStart(2, '0')}`;
        event.end.dateTime = `${cleanDate}T${endHM_fixed}:00`;
      }

      fastify.log.info(`Syncing event to Google: ${event.summary} on ${event.start.dateTime}`);

      let result;
      if (googleEventId) {
        // Update existing event
        result = await calendar.events.update({
          calendarId: calendar_id || 'primary',
          eventId: googleEventId,
          resource: event,
        });
      } else {
        // Create new event
        result = await calendar.events.insert({
          calendarId: calendar_id || 'primary',
          resource: event,
        });
      }

      return {
        success: true,
        googleEventId: result.data.id,
        htmlLink: result.data.htmlLink
      };
    } catch (error) {
      fastify.log.error('Google Calendar sync error:', error);
      return reply.status(500).send({ error: 'Calendar sync failed', details: error.message });
    }
  });

  // Delete event from Google Calendar
  fastify.delete('/event/:googleEventId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { googleEventId } = request.params;

    try {
      // Get user tokens
      const tokenResult = await query(
        'SELECT access_token, refresh_token, token_expiry, calendar_id FROM google_tokens WHERE user_id = $1',
        [userId]
      );

      if (tokenResult.rows.length === 0) {
        return reply.status(400).send({ error: 'Google Calendar not connected' });
      }

      const { access_token, refresh_token, token_expiry, calendar_id } = tokenResult.rows[0];

      oauth2Client.setCredentials({
        access_token,
        refresh_token,
        expiry_date: new Date(token_expiry).getTime()
      });

      // Refresh if needed
      if (new Date(token_expiry) < new Date()) {
        const { credentials } = await oauth2Client.refreshAccessToken();
        await query(
          `UPDATE google_tokens SET access_token = $1, token_expiry = $2, updated_at = CURRENT_TIMESTAMP WHERE user_id = $3`,
          [credentials.access_token, new Date(credentials.expiry_date), userId]
        );
        oauth2Client.setCredentials(credentials);
      }

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      await calendar.events.delete({
        calendarId: calendar_id || 'primary',
        eventId: googleEventId,
      });

      return { success: true };
    } catch (error) {
      // Ignore 404 errors (event already deleted)
      if (error.code === 404) {
        return { success: true };
      }
      fastify.log.error('Google Calendar delete error:', error);
      return reply.status(500).send({ error: 'Delete failed', details: error.message });
    }
  });
}
