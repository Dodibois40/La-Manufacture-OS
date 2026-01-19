/**
 * Invitations Routes - Team member invitation system
 *
 * Endpoints:
 * - POST /invitations              - Create and send invitation
 * - GET /invitations               - List invitations (manager only)
 * - DELETE /invitations/:id        - Revoke invitation
 * - POST /invitations/:id/resend   - Resend invitation email
 * - GET /invitations/validate/:token - Validate token (public)
 * - POST /invitations/:token/accept  - Accept invitation (auth)
 *
 * Flow:
 * 1. Manager creates invitation → email sent with token
 * 2. Invitee validates token → sees invitation details
 * 3. Invitee signs up/logs in → accepts invitation
 * 4. Team member profile created/linked
 *
 * @module routes/invitations
 */

import { query } from '../db/connection.js';
import { sendInvitationEmail } from '../services/email.js';
import { requireManager, userOwnsInvitation } from '../middleware/authorization.js';
import { randomBytes } from 'crypto';

/**
 * @typedef {import('../types.js').TeamInvitation} TeamInvitation
 * @typedef {import('../types.js').InvitationCreateInput} InvitationCreateInput
 */

/**
 * Generate cryptographically secure invitation token
 * @returns {string} 64-character hex token
 */
function generateInvitationToken() {
  return randomBytes(32).toString('hex');
}

/**
 * Register invitations routes
 * @param {import('fastify').FastifyInstance} fastify - Fastify instance
 */
export default async function invitationsRoutes(fastify) {
  // POST /api/invitations - Create invitation and send email
  fastify.post(
    '/',
    { preHandler: [fastify.authenticate, requireManager] },
    async (request, reply) => {
      const { userId } = request.user;
      const { email, name, avatar_color } = request.body;

      // Validate input
      if (!email || !email.trim()) {
        return reply.status(400).send({ error: 'Email requis' });
      }

      if (!name || !name.trim()) {
        return reply.status(400).send({ error: 'Nom requis' });
      }

      const emailLower = email.trim().toLowerCase();
      const nameTrimmed = name.trim();

      try {
        // Check if there's already a pending invitation for this email from this manager
        const existingInvitation = await query(
          `SELECT id, status, expires_at FROM team_invitations
         WHERE manager_id = $1 AND email = $2 AND status IN ('pending', 'accepted')`,
          [userId, emailLower]
        );

        if (existingInvitation.rows.length > 0) {
          const existing = existingInvitation.rows[0];
          if (existing.status === 'accepted') {
            return reply.status(400).send({ error: 'Cet email est déjà lié à un membre actif' });
          }
          if (existing.status === 'pending') {
            // Check if still valid
            if (new Date(existing.expires_at) > new Date()) {
              return reply
                .status(400)
                .send({ error: 'Une invitation est déjà en cours pour cet email' });
            }
          }
        }

        // Generate secure token
        const token = generateInvitationToken();

        // Set expiration to 7 days from now
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        // Get manager name for email
        const managerResult = await query('SELECT name FROM users WHERE id = $1', [userId]);
        const managerName = managerResult.rows[0]?.name || 'Un manager';

        // Create invitation in database
        const result = await query(
          `INSERT INTO team_invitations
         (manager_id, email, token, expires_at, metadata)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
          [
            userId,
            emailLower,
            token,
            expiresAt,
            JSON.stringify({ invited_name: nameTrimmed, avatar_color: avatar_color || '#3b82f6' }),
          ]
        );

        const invitation = result.rows[0];

        // Send invitation email
        const emailResult = await sendInvitationEmail(emailLower, token, managerName, nameTrimmed);

        return {
          invitation: {
            id: invitation.id,
            email: invitation.email,
            status: invitation.status,
            invited_at: invitation.invited_at,
            expires_at: invitation.expires_at,
            metadata: invitation.metadata,
          },
          emailSent: emailResult.success,
          emailError: emailResult.error,
        };
      } catch (error) {
        request.log.error(error);
        return reply
          .status(500)
          .send({ error: "Erreur lors de la création de l'invitation", details: error.message });
      }
    }
  );

  // GET /api/invitations - List invitations
  fastify.get('/', { preHandler: [fastify.authenticate, requireManager] }, async request => {
    const { userId } = request.user;
    const { status } = request.query;

    try {
      let sql = `
        SELECT
          ti.*,
          tm.id as team_member_id,
          tm.name as member_name,
          tm.invited_user_id
        FROM team_invitations ti
        LEFT JOIN team_members tm ON ti.team_member_id = tm.id
        WHERE ti.manager_id = $1
      `;
      const params = [userId];

      if (status) {
        sql += ' AND ti.status = $2';
        params.push(status);
      }

      sql += ' ORDER BY ti.created_at DESC';

      const result = await query(sql, params);

      return { invitations: result.rows };
    } catch (error) {
      request.log.error(error);
      throw error;
    }
  });

  // DELETE /api/invitations/:id - Revoke invitation
  fastify.delete(
    '/:id',
    { preHandler: [fastify.authenticate, requireManager] },
    async (request, reply) => {
      const { userId } = request.user;
      const { id } = request.params;

      try {
        // Verify ownership
        const owns = await userOwnsInvitation(userId, id);
        if (!owns) {
          return reply.status(404).send({ error: 'Invitation non trouvée' });
        }

        // Check current status
        const check = await query('SELECT status FROM team_invitations WHERE id = $1', [id]);

        if (check.rows.length === 0) {
          return reply.status(404).send({ error: 'Invitation non trouvée' });
        }

        const currentStatus = check.rows[0].status;
        if (currentStatus === 'accepted') {
          return reply
            .status(400)
            .send({ error: 'Impossible de révoquer une invitation acceptée' });
        }

        if (currentStatus === 'revoked') {
          return reply.status(400).send({ error: 'Invitation déjà révoquée' });
        }

        // Revoke invitation
        await query(
          'UPDATE team_invitations SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['revoked', id]
        );

        return { success: true };
      } catch (error) {
        request.log.error(error);
        return reply
          .status(500)
          .send({ error: 'Erreur lors de la révocation', details: error.message });
      }
    }
  );

  // POST /api/invitations/:id/resend - Resend invitation email
  fastify.post(
    '/:id/resend',
    { preHandler: [fastify.authenticate, requireManager] },
    async (request, reply) => {
      const { userId } = request.user;
      const { id } = request.params;

      try {
        // Verify ownership and get invitation
        const result = await query(
          'SELECT * FROM team_invitations WHERE id = $1 AND manager_id = $2',
          [id, userId]
        );

        if (result.rows.length === 0) {
          return reply.status(404).send({ error: 'Invitation non trouvée' });
        }

        const invitation = result.rows[0];

        if (invitation.status !== 'pending') {
          return reply
            .status(400)
            .send({ error: 'Seules les invitations en attente peuvent être renvoyées' });
        }

        // Get manager name
        const managerResult = await query('SELECT name FROM users WHERE id = $1', [userId]);
        const managerName = managerResult.rows[0]?.name || 'Un manager';

        // Parse metadata to get invited name
        const metadata = invitation.metadata || {};
        const invitedName = metadata.invited_name || 'Membre';

        // Resend email
        const emailResult = await sendInvitationEmail(
          invitation.email,
          invitation.token,
          managerName,
          invitedName
        );

        return {
          success: true,
          emailSent: emailResult.success,
          emailError: emailResult.error,
        };
      } catch (error) {
        request.log.error(error);
        return reply
          .status(500)
          .send({ error: "Erreur lors du renvoi de l'invitation", details: error.message });
      }
    }
  );

  // GET /api/invitations/validate/:token - Validate invitation token (PUBLIC)
  fastify.get('/validate/:token', async (request, reply) => {
    const { token } = request.params;

    try {
      const result = await query(
        `SELECT
          ti.id,
          ti.email,
          ti.status,
          ti.expires_at,
          ti.metadata,
          u.name as manager_name,
          u.email as manager_email
         FROM team_invitations ti
         JOIN users u ON ti.manager_id = u.id
         WHERE ti.token = $1`,
        [token]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'Invitation non trouvée', valid: false });
      }

      const invitation = result.rows[0];

      // Check status
      if (invitation.status === 'accepted') {
        return reply
          .status(400)
          .send({ error: 'Cette invitation a déjà été acceptée', valid: false });
      }

      if (invitation.status === 'revoked') {
        return reply.status(400).send({ error: 'Cette invitation a été révoquée', valid: false });
      }

      if (invitation.status === 'expired') {
        return reply.status(400).send({ error: 'Cette invitation a expiré', valid: false });
      }

      // Check expiration
      if (new Date(invitation.expires_at) < new Date()) {
        // Mark as expired
        await query('UPDATE team_invitations SET status = $1 WHERE id = $2', [
          'expired',
          invitation.id,
        ]);
        return reply.status(400).send({ error: 'Cette invitation a expiré', valid: false });
      }

      return {
        valid: true,
        invitation: {
          email: invitation.email,
          manager_name: invitation.manager_name,
          invited_name: invitation.metadata?.invited_name || 'Membre',
          expires_at: invitation.expires_at,
        },
      };
    } catch (error) {
      request.log.error(error);
      return reply
        .status(500)
        .send({ error: 'Erreur lors de la validation', details: error.message });
    }
  });

  // POST /api/invitations/:token/accept - Accept invitation (AUTHENTICATED)
  fastify.post('/:token/accept', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId, clerkId: _clerkId } = request.user;
    const { token } = request.params;

    try {
      // Get invitation
      const inviteResult = await query(
        `SELECT ti.*, u.email as user_email
         FROM team_invitations ti
         JOIN users u ON u.id = $1
         WHERE ti.token = $2`,
        [userId, token]
      );

      if (inviteResult.rows.length === 0) {
        return reply.status(404).send({ error: 'Invitation non trouvée' });
      }

      const invitation = inviteResult.rows[0];
      const userEmail = invitation.user_email.toLowerCase();
      const invitationEmail = invitation.email.toLowerCase();

      // Verify email matches
      if (userEmail !== invitationEmail) {
        return reply.status(403).send({
          error: "L'email de votre compte ne correspond pas à l'invitation",
          details: `Invitation pour: ${invitationEmail}, Votre email: ${userEmail}`,
        });
      }

      // Check status
      if (invitation.status === 'accepted') {
        return reply.status(400).send({ error: 'Cette invitation a déjà été acceptée' });
      }

      if (invitation.status === 'revoked') {
        return reply.status(400).send({ error: 'Cette invitation a été révoquée' });
      }

      if (invitation.status === 'expired' || new Date(invitation.expires_at) < new Date()) {
        return reply.status(400).send({ error: 'Cette invitation a expiré' });
      }

      // Parse metadata
      const metadata = invitation.metadata || {};
      const memberName = metadata.invited_name || 'Membre';
      const avatarColor = metadata.avatar_color || '#3b82f6';

      // Create or update team member
      let teamMemberId = invitation.team_member_id;

      if (teamMemberId) {
        // Update existing team member with user link
        await query(
          `UPDATE team_members
           SET invited_user_id = $1, email = $2, updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [userId, invitationEmail, teamMemberId]
        );
      } else {
        // Create new team member
        const memberResult = await query(
          `INSERT INTO team_members (user_id, name, email, avatar_color, invited_user_id)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [invitation.manager_id, memberName, invitationEmail, avatarColor, userId]
        );
        teamMemberId = memberResult.rows[0].id;
      }

      // Update invitation status
      await query(
        `UPDATE team_invitations
         SET status = $1, accepted_at = CURRENT_TIMESTAMP, team_member_id = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        ['accepted', teamMemberId, invitation.id]
      );

      // Update user role to 'member'
      await query('UPDATE users SET role = $1 WHERE id = $2', ['member', userId]);

      // Get the complete team member info
      const member = await query('SELECT * FROM team_members WHERE id = $1', [teamMemberId]);

      return {
        success: true,
        member: member.rows[0],
        team_member_id: teamMemberId,
      };
    } catch (error) {
      request.log.error(error);
      return reply
        .status(500)
        .send({ error: "Erreur lors de l'acceptation", details: error.message });
    }
  });
}
