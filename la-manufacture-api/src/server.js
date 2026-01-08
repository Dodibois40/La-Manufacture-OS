import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
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

await fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'supersecret-change-in-production',
  sign: { expiresIn: '7d' },
  cookie: {
    cookieName: 'token',
    signed: false,
  },
});

// Auth decorator - supporte cookie ET header Authorization (pour mobile/Safari)
fastify.decorate('authenticate', async function (request, reply) {
  try {
    // Essayer d'abord le cookie
    await request.jwtVerify();
  } catch (cookieErr) {
    // Fallback: vérifier le header Authorization (Bearer token)
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = fastify.jwt.verify(token);
        request.user = decoded;
        return;
      } catch (tokenErr) {
        reply.status(401).send({ error: 'Unauthorized' });
        return;
      }
    }
    reply.status(401).send({ error: 'Unauthorized' });
  }
});

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
