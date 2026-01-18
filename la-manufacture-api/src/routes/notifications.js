import { query } from '../db/connection.js';

export default async function notificationsRoutes(fastify) {
  // Get all notifications for current user
  fastify.get('/', { preHandler: [fastify.authenticate] }, async request => {
    const { userId } = request.user;

    const result = await query(
      `SELECT * FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );

    return { notifications: result.rows };
  });

  // Get unread count (for badge)
  fastify.get('/unread-count', { preHandler: [fastify.authenticate] }, async request => {
    const { userId } = request.user;

    const result = await query(
      `SELECT COUNT(*) as count FROM notifications
       WHERE user_id = $1 AND read = FALSE`,
      [userId]
    );

    return { count: parseInt(result.rows[0].count) };
  });

  // Mark notification as read
  fastify.patch('/:id/read', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { id } = request.params;

    const result = await query(
      `UPDATE notifications SET read = TRUE
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Notification not found' });
    }

    return { notification: result.rows[0] };
  });

  // Mark all as read
  fastify.post('/mark-all-read', { preHandler: [fastify.authenticate] }, async request => {
    const { userId } = request.user;

    await query(`UPDATE notifications SET read = TRUE WHERE user_id = $1`, [userId]);

    return { success: true };
  });

  // Delete a notification
  fastify.delete('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { id } = request.params;

    const result = await query(
      `DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Notification not found' });
    }

    return { success: true };
  });
}
