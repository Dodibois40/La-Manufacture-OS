import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import { clerkPlugin, getAuth } from '@clerk/fastify';
import { createClerkClient } from '@clerk/backend';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db/connection.js';

// Routes
import authRoutes from './routes/auth.js';
import tasksRoutes from './routes/tasks.js';
import settingsRoutes from './routes/settings.js';
import aiRoutes from './routes/ai.js';
import emailRoutes from './routes/email.js';
import usersRoutes from './routes/users.js';
import notificationsRoutes from './routes/notifications.js';
import teamRoutes from './routes/team.js';
import teamFilesRoutes from './routes/team-files.js';
import googleCalendarRoutes from './routes/google-calendar.js';

dotenv.config();

// Auto-run migrations on startup
const __dirname = path.dirname(fileURLToPath(import.meta.url));
async function runMigrations() {
  try {
    console.log('🔄 Running database migrations...');
    const schemaSQL = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
    await pool.query(schemaSQL);
    console.log('✅ Database migrations completed');
  } catch (error) {
    console.error('⚠️ Migration warning:', error.message);
  }
}
await runMigrations();

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: process.env.NODE_ENV !== 'production' ? {
      target: 'pino-pretty',
      options: { colorize: true }
    } : undefined,
  },
});

// Register plugins
const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').trim();
await fastify.register(cors, {
  origin: frontendUrl,
  credentials: true,
});

await fastify.register(cookie);

await fastify.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  }
});

// Clerk client for user management
const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY
});

// Register Clerk plugin
await fastify.register(clerkPlugin, {
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
  secretKey: process.env.CLERK_SECRET_KEY,
});

// Auth decorator using Clerk
fastify.decorate('authenticate', async function (request, reply) {
  const auth = getAuth(request);

  if (!auth.userId) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  // Get or create local user from Clerk
  const localUser = await pool.query(
    'SELECT id FROM users WHERE clerk_id = $1',
    [auth.userId]
  );

  if (localUser.rows.length > 0) {
    request.user = { userId: localUser.rows[0].id, clerkId: auth.userId };
  } else {
    // Auto-create local user on first auth
    try {
      const clerkUser = await clerkClient.users.getUser(auth.userId);
      const email = clerkUser.emailAddresses[0]?.emailAddress;
      const name = clerkUser.firstName || clerkUser.username || 'User';

      // Validate email
      if (!email) {
        fastify.log.error('Clerk user has no email address:', { userId: auth.userId, clerkUser });
        return reply.status(400).send({ error: 'User must have an email address' });
      }

      fastify.log.info('Creating user from Clerk:', { clerkId: auth.userId, email, name });

      const result = await pool.query(
        'INSERT INTO users (clerk_id, email, name) VALUES ($1, $2, $3) RETURNING id',
        [auth.userId, email, name]
      );
      request.user = { userId: result.rows[0].id, clerkId: auth.userId };

      fastify.log.info('User created successfully:', { userId: result.rows[0].id, clerkId: auth.userId });
    } catch (err) {
      fastify.log.error('Error creating user from Clerk:', {
        message: err.message,
        code: err.code,
        detail: err.detail,
        constraint: err.constraint,
        clerkId: auth.userId
      });

      // If user already exists (duplicate key), try to find and use existing user
      if (err.code === '23505') { // Unique violation
        fastify.log.info('User already exists, attempting to find existing user');
        const existingUser = await pool.query(
          'SELECT id FROM users WHERE clerk_id = $1 OR email = (SELECT email FROM users WHERE clerk_id = $1)',
          [auth.userId]
        );

        if (existingUser.rows.length > 0) {
          request.user = { userId: existingUser.rows[0].id, clerkId: auth.userId };
          fastify.log.info('Found existing user:', { userId: existingUser.rows[0].id });
          return;
        }
      }

      return reply.status(500).send({ error: 'Failed to create user', details: err.message });
    }
  }
});

// Export clerkClient for routes
fastify.decorate('clerkClient', clerkClient);

// Health check
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Register routes
await fastify.register(authRoutes, { prefix: '/api/auth' });
await fastify.register(tasksRoutes, { prefix: '/api/tasks' });
await fastify.register(settingsRoutes, { prefix: '/api/settings' });
await fastify.register(aiRoutes, { prefix: '/api/ai' });
await fastify.register(emailRoutes, { prefix: '/api/email' });
await fastify.register(usersRoutes, { prefix: '/api/users' });
await fastify.register(notificationsRoutes, { prefix: '/api/notifications' });
await fastify.register(teamRoutes, { prefix: '/api/team' });
await fastify.register(teamFilesRoutes, { prefix: '/api/team' });
await fastify.register(googleCalendarRoutes, { prefix: '/api/google' });

// Start server
const start = async () => {
  try {
    const port = process.env.PORT || 3333;
    // Always use 0.0.0.0 for cloud deployments (Railway, etc.)
    const host = '0.0.0.0';

    await fastify.listen({ port, host });
    console.log(`\n🚀 La Manufacture API running on http://${host}:${port}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
