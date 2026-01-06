import bcrypt from 'bcrypt';
import { query } from '../db/connection.js';

export default async function authRoutes(fastify) {
  // Register
  fastify.post('/register', async (request, reply) => {
    const { email, password, name } = request.body;

    if (!email || !password || !name) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    try {
      // Check if user exists
      const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingUser.rows.length > 0) {
        return reply.status(409).send({ error: 'User already exists' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const result = await query(
        'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, created_at',
        [email, passwordHash, name]
      );

      const user = result.rows[0];

      // Create default settings
      await query(
        'INSERT INTO settings (user_id, owners, carry_over_mode, ai_enabled) VALUES ($1, $2, $3, $4)',
        [user.id, [name], 'move', true]
      );

      // Generate token
      const token = fastify.jwt.sign({ userId: user.id, email: user.email });

      reply.setCookie('token', token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });

      return { user, token };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Registration failed' });
    }
  });

  // Login
  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body;

    if (!email || !password) {
      return reply.status(400).send({ error: 'Missing email or password' });
    }

    try {
      const result = await query('SELECT id, email, password_hash, name FROM users WHERE email = $1', [email]);

      if (result.rows.length === 0) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const user = result.rows[0];
      const validPassword = await bcrypt.compare(password, user.password_hash);

      if (!validPassword) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const token = fastify.jwt.sign({ userId: user.id, email: user.email });

      reply.setCookie('token', token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
      });

      return {
        user: { id: user.id, email: user.email, name: user.name },
        token
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Login failed' });
    }
  });

  // Logout
  fastify.post('/logout', async (request, reply) => {
    reply.clearCookie('token', { path: '/' });
    return { success: true };
  });

  // Get current user
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request) => {
    const { userId } = request.user;

    const result = await query('SELECT id, email, name, created_at FROM users WHERE id = $1', [userId]);
    return { user: result.rows[0] };
  });
}
