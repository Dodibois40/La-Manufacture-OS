import { query } from '../db/connection.js';

export default async function authRoutes(fastify) {
  // Get current user - user is auto-created in authenticate middleware
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async request => {
    const { userId } = request.user;

    const result = await query(
      'SELECT id, email, name, clerk_id, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return { user: null };
    }

    const user = result.rows[0];

    // Ensure default settings exist
    const settingsCheck = await query('SELECT id FROM settings WHERE user_id = $1', [userId]);
    if (settingsCheck.rows.length === 0) {
      await query(
        'INSERT INTO settings (user_id, owners, carry_over_mode, ai_enabled) VALUES ($1, $2, $3, $4)',
        [userId, [user.name], 'move', true]
      );
    }

    return { user };
  });

  // Logout - clears any legacy cookies (Clerk handles actual signout)
  fastify.post('/logout', async (request, reply) => {
    reply.clearCookie('token', {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'none',
    });
    return { success: true };
  });
}
