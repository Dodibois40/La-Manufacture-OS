import { query } from '../db/connection.js';

export default async function emailRoutes(fastify) {
  // Webhook pour recevoir emails (à configurer avec service email comme SendGrid/Mailgun)
  fastify.post('/inbound', async (request, reply) => {
    // Validate webhook secret
    const webhookSecret = request.headers['x-webhook-secret'];
    if (!process.env.EMAIL_WEBHOOK_SECRET) {
      fastify.log.warn('EMAIL_WEBHOOK_SECRET not configured - endpoint disabled');
      return reply.status(503).send({ error: 'Email webhook not configured' });
    }
    if (webhookSecret !== process.env.EMAIL_WEBHOOK_SECRET) {
      fastify.log.warn('Invalid webhook secret attempt');
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { from, subject, text, html } = request.body;

    try {
      // Extract email address
      const emailMatch = from.match(/<?([^<>]+@[^<>]+)>?/);
      const fromEmail = emailMatch ? emailMatch[1] : from;

      // Find user by email
      const userResult = await query('SELECT id FROM users WHERE email = $1', [fromEmail]);

      if (userResult.rows.length === 0) {
        fastify.log.warn(`Email from unknown user: ${fromEmail}`);
        return { success: false, error: 'Unknown user' };
      }

      const userId = userResult.rows[0].id;

      // Store email in inbox
      await query(
        'INSERT INTO email_inbox (user_id, from_email, subject, body, processed) VALUES ($1, $2, $3, $4, $5)',
        [userId, fromEmail, subject, text || html, false]
      );

      // Auto-create task from email
      const taskText = subject || text.substring(0, 200);
      const today = new Date().toISOString().split('T')[0];

      // Get user's default owner
      const settingsResult = await query('SELECT owners FROM settings WHERE user_id = $1', [
        userId,
      ]);
      const defaultOwner = settingsResult.rows[0]?.owners?.[0] || 'Thibaud';

      const taskResult = await query(
        `INSERT INTO tasks (user_id, text, date, owner, status, done)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [userId, taskText, today, defaultOwner, 'open', false]
      );

      const task = taskResult.rows[0];

      // Mark email as processed
      await query(
        'UPDATE email_inbox SET processed = TRUE, task_id = $1 WHERE user_id = $2 AND from_email = $3 AND subject = $4',
        [task.id, userId, fromEmail, subject]
      );

      fastify.log.info(`Created task from email: ${taskText}`);

      return { success: true, task };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Email processing failed' });
    }
  });

  // Get unprocessed emails
  fastify.get('/inbox', { preHandler: [fastify.authenticate] }, async request => {
    const { userId } = request.user;

    const result = await query(
      'SELECT * FROM email_inbox WHERE user_id = $1 AND processed = FALSE ORDER BY created_at DESC',
      [userId]
    );

    return { emails: result.rows };
  });

  // Process email manually
  fastify.post(
    '/inbox/:id/process',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;
      const { id } = request.params;
      const { taskText, date } = request.body;

      try {
        // Get email
        const emailResult = await query(
          'SELECT * FROM email_inbox WHERE id = $1 AND user_id = $2',
          [id, userId]
        );

        if (emailResult.rows.length === 0) {
          return reply.status(404).send({ error: 'Email not found' });
        }

        // Get user's default owner
        const settingsResult = await query('SELECT owners FROM settings WHERE user_id = $1', [
          userId,
        ]);
        const defaultOwner = settingsResult.rows[0]?.owners?.[0] || 'Thibaud';

        // Create task
        const taskResult = await query(
          `INSERT INTO tasks (user_id, text, date, owner, status, done)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
          [userId, taskText, date, defaultOwner, 'open', false]
        );

        const task = taskResult.rows[0];

        // Mark email as processed
        await query('UPDATE email_inbox SET processed = TRUE, task_id = $1 WHERE id = $2', [
          task.id,
          id,
        ]);

        return { success: true, task };
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Email processing failed' });
      }
    }
  );
}
