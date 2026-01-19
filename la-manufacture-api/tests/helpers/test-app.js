/**
 * Test App Builder - Creates Fastify instance with mocked auth for testing
 *
 * Usage:
 *   const { app, mockUser } = await buildTestApp();
 *   const response = await app.inject({ method: 'GET', url: '/tasks' });
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';

// Import routes
import tasksRoutes from '../../src/routes/tasks.js';
import teamRoutes from '../../src/routes/team.js';
import invitationsRoutes from '../../src/routes/invitations.js';
import memberRoutes from '../../src/routes/member.js';
import authRoutes from '../../src/routes/auth.js';

// Import authorization middleware
import {
  requireManager,
  requireMember,
  loadTeamMemberProfile,
  canAccessProject,
  canAccessTask,
} from '../../src/middleware/authorization.js';

// Mock user for testing
export const MOCK_USER = {
  userId: 1,
  clerkId: 'test_clerk_id_123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'manager',
};

export const MOCK_MEMBER = {
  userId: 2,
  clerkId: 'test_clerk_member_456',
  email: 'member@example.com',
  name: 'Test Member',
  role: 'member',
  teamMemberId: 1,
};

/**
 * Build a test Fastify app with mocked authentication
 */
export async function buildTestApp(options = {}) {
  const { mockUser = MOCK_USER, skipAuth = false } = options;

  const fastify = Fastify({
    logger: false, // Disable logging in tests
  });

  // Register plugins
  await fastify.register(cors, { origin: true, credentials: true });
  await fastify.register(cookie);

  // Mock authenticate decorator
  fastify.decorate('authenticate', async function (request, reply) {
    if (skipAuth) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    request.user = { ...mockUser };
  });

  // Mock optionalAuth decorator
  fastify.decorate('optionalAuth', async function (request) {
    if (!skipAuth) {
      request.user = { ...mockUser };
    }
  });

  // Mock clerkClient
  fastify.decorate('clerkClient', {
    users: {
      getUser: async () => ({
        id: mockUser.clerkId,
        emailAddresses: [{ emailAddress: mockUser.email }],
        firstName: mockUser.name,
      }),
    },
  });

  // Decorate authorization middleware
  fastify.decorate('requireManager', requireManager);
  fastify.decorate('requireMember', requireMember);
  fastify.decorate('loadTeamMemberProfile', loadTeamMemberProfile);
  fastify.decorate('canAccessProject', canAccessProject);
  fastify.decorate('canAccessTask', canAccessTask);

  // Register routes
  await fastify.register(authRoutes, { prefix: '/auth' });
  await fastify.register(tasksRoutes, { prefix: '/tasks' });
  await fastify.register(teamRoutes, { prefix: '/team' });
  await fastify.register(invitationsRoutes, { prefix: '/invitations' });
  await fastify.register(memberRoutes, { prefix: '/member' });

  await fastify.ready();

  return {
    app: fastify,
    mockUser,
    close: () => fastify.close(),
  };
}

/**
 * Helper to make authenticated requests
 */
export function makeRequest(app, method, url, options = {}) {
  return app.inject({
    method,
    url,
    headers: {
      'content-type': 'application/json',
      ...options.headers,
    },
    payload: options.payload,
    query: options.query,
  });
}

/**
 * Assert helper for test results
 */
export function assertResponse(response, expectedStatus, message) {
  if (response.statusCode !== expectedStatus) {
    const body = JSON.parse(response.body || '{}');
    throw new Error(
      `${message}: Expected ${expectedStatus}, got ${response.statusCode}. Body: ${JSON.stringify(body)}`
    );
  }
  return JSON.parse(response.body || '{}');
}

export default buildTestApp;
