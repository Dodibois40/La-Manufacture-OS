import { query } from '../db/connection.js';

export default async function usersRoutes(fastify) {
  // Get all users (except current user) - for sharing dropdown
  fastify.get('/', { preHandler: [fastify.authenticate] }, async request => {
    const { userId } = request.user;

    const result = await query(
      `SELECT id, name, email FROM users WHERE id != $1 ORDER BY name ASC`,
      [userId]
    );

    return { users: result.rows };
  });

  // Search users (autocomplete)
  fastify.get('/search', { preHandler: [fastify.authenticate] }, async request => {
    const { userId } = request.user;
    const { q } = request.query;

    if (!q || q.length < 2) {
      return { users: [] };
    }

    const result = await query(
      `SELECT id, name, email FROM users
       WHERE id != $1 AND (name ILIKE $2 OR email ILIKE $2)
       ORDER BY name ASC LIMIT 10`,
      [userId, `%${q}%`]
    );

    return { users: result.rows };
  });
}
