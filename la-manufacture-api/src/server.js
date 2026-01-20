import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import compress from '@fastify/compress';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
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
import projectsRoutes from './routes/projects.js';
import googleCalendarRoutes from './routes/google-calendar.js';
import invitationsRoutes from './routes/invitations.js';
import memberRoutes from './routes/member.js';
import notesRoutes from './routes/notes.js';

// Middleware
import {
  requireManager,
  requireMember,
  loadTeamMemberProfile,
  canAccessProject,
  canAccessTask,
} from './middleware/authorization.js';

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
    transport:
      process.env.NODE_ENV !== 'production'
        ? {
            target: 'pino-pretty',
            options: { colorize: true },
          }
        : undefined,
  },
});

// Register plugins
const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map(url => url.trim());
await fastify.register(cors, {
  origin: (origin, cb) => {
    // In development, allow any localhost or local IP origin
    if (
      !origin ||
      /localhost|127\.0\.0\.1|192\.168\./.test(origin) ||
      frontendUrl.includes(origin)
    ) {
      cb(null, true);
      return;
    }
    cb(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'PUT', 'POST', 'DELETE', 'PATCH', 'OPTIONS'],
});

await fastify.register(cookie);

// Security headers (CSP, X-Frame-Options, HSTS, etc.)
await fastify.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://challenges.cloudflare.com'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.clerk.com', 'https://*.clerk.accounts.dev'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      frameSrc: ["'self'", 'https://challenges.cloudflare.com'],
    },
  },
  crossOriginEmbedderPolicy: false, // Required for some third-party integrations
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
});

// Enable compression for responses (gzip/brotli)
await fastify.register(compress, {
  global: true,
  encodings: ['br', 'gzip', 'deflate'],
  threshold: 1024, // Only compress responses > 1KB
});

await fastify.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
});

// Rate limiting - protection contre les abus
await fastify.register(rateLimit, {
  max: 100, // 100 requêtes max
  timeWindow: '1 minute',
  // Limites spécifiques pour les routes sensibles
  keyGenerator: request => {
    return request.user?.userId || request.ip;
  },
  errorResponseBuilder: (_request, context) => {
    return {
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Trop de requêtes. Veuillez réessayer dans quelques instants.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: context.after,
    };
  },
});

// Clerk client for user management
const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
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
  const localUser = await pool.query('SELECT id FROM users WHERE clerk_id = $1', [auth.userId]);

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

      fastify.log.info('Creating/updating user from Clerk:', { clerkId: auth.userId, email, name });

      // Use UPSERT: insert or update if user already exists with this email
      const result = await pool.query(
        `INSERT INTO users (clerk_id, email, name)
         VALUES ($1, $2, $3)
         ON CONFLICT (email)
         DO UPDATE SET clerk_id = EXCLUDED.clerk_id, name = EXCLUDED.name, updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [auth.userId, email, name]
      );
      request.user = { userId: result.rows[0].id, clerkId: auth.userId };

      fastify.log.info('User created/updated successfully:', {
        userId: result.rows[0].id,
        clerkId: auth.userId,
      });
    } catch (err) {
      fastify.log.error('Error creating/updating user from Clerk:', {
        message: err.message,
        code: err.code,
        detail: err.detail,
        constraint: err.constraint,
        clerkId: auth.userId,
      });

      return reply.status(500).send({ error: 'Authentication failed' });
    }
  }
});

// Export clerkClient for routes
fastify.decorate('clerkClient', clerkClient);

// Optional auth decorator - ne bloque pas si pas authentifié, mais charge l'user si token présent
fastify.decorate('optionalAuth', async function (request) {
  try {
    const auth = getAuth(request);
    if (auth.userId) {
      const localUser = await pool.query('SELECT id FROM users WHERE clerk_id = $1', [auth.userId]);
      if (localUser.rows.length > 0) {
        request.user = { userId: localUser.rows[0].id, clerkId: auth.userId };
      }
    }
  } catch {
    // Silently ignore auth errors for optional auth
  }
});

// Decorate fastify with authorization middleware
fastify.decorate('requireManager', requireManager);
fastify.decorate('requireMember', requireMember);
fastify.decorate('loadTeamMemberProfile', loadTeamMemberProfile);
fastify.decorate('canAccessProject', canAccessProject);
fastify.decorate('canAccessTask', canAccessTask);

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
await fastify.register(projectsRoutes, { prefix: '/api/projects' });
await fastify.register(googleCalendarRoutes, { prefix: '/api/google' });
await fastify.register(invitationsRoutes, { prefix: '/api/invitations' });
await fastify.register(memberRoutes, { prefix: '/api/member' });
await fastify.register(notesRoutes, { prefix: '/api/notes' });

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
