import { query } from '../db/connection.js';

/**
 * Middleware: Check if user is a manager (has their own team)
 * Managers can create team members, projects, and invitations
 */
export async function requireManager(request, reply) {
  const { userId } = request.user;

  try {
    // Check if user has role='manager' or role='admin'
    const result = await query('SELECT role FROM users WHERE id = $1', [userId]);

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Utilisateur non trouvé' });
    }

    const userRole = result.rows[0].role;
    if (userRole === 'member') {
      return reply.status(403).send({ error: 'Accès réservé aux managers' });
    }

    // User is manager or admin, allow access
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Erreur lors de la vérification des autorisations' });
  }
}

/**
 * Middleware: Check if user is a team member (invited user with assigned work)
 * Members can only access projects/tasks assigned to them
 */
export async function requireMember(request, reply) {
  const { userId } = request.user;

  try {
    // Check if user is linked as a team member
    const result = await query(
      'SELECT id, user_id, name, email FROM team_members WHERE invited_user_id = $1 AND active = TRUE',
      [userId]
    );

    if (result.rows.length === 0) {
      return reply.status(403).send({ error: "Accès réservé aux membres d'équipe" });
    }

    // Attach team member info to request for use in route handlers
    request.teamMember = result.rows[0];
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Erreur lors de la vérification du membre' });
  }
}

/**
 * Middleware: Load team member profile if user is a member (non-blocking)
 * This adds member profile to request if exists, but doesn't block access
 * Useful for routes that work for both managers and members
 */
export async function loadTeamMemberProfile(request, reply) {
  const { userId } = request.user;

  try {
    const result = await query(
      `SELECT tm.*, u.name as manager_name, u.email as manager_email
       FROM team_members tm
       JOIN users u ON tm.user_id = u.id
       WHERE tm.invited_user_id = $1 AND tm.active = TRUE`,
      [userId]
    );

    if (result.rows.length > 0) {
      request.teamMemberProfile = result.rows[0];
      request.isMember = true;
    } else {
      request.isMember = false;
    }
  } catch (error) {
    request.log.error(error);
    // Don't block request on error, just log it
    request.isMember = false;
  }
}

/**
 * Middleware: Check if user can access a specific project
 * User can access if they are:
 * - The project owner (user_id matches)
 * - Assigned as a team member to the project
 */
export async function canAccessProject(request, reply) {
  const { userId } = request.user;
  const { id: projectId } = request.params;

  try {
    // Check if user is project owner OR assigned as member
    const result = await query(
      `SELECT p.id, p.user_id,
              CASE
                WHEN p.user_id = $2 THEN 'owner'
                WHEN tm.invited_user_id IS NOT NULL THEN 'member'
                ELSE NULL
              END as access_type
       FROM projects p
       LEFT JOIN project_members pm ON p.id = pm.project_id
       LEFT JOIN team_members tm ON pm.team_member_id = tm.id AND tm.invited_user_id = $2
       WHERE p.id = $1 AND (p.user_id = $2 OR tm.invited_user_id = $2)
       LIMIT 1`,
      [projectId, userId]
    );

    if (result.rows.length === 0) {
      return reply.status(403).send({ error: 'Accès refusé à ce projet' });
    }

    // Attach project access info to request
    request.projectAccess = {
      projectId: result.rows[0].id,
      isOwner: result.rows[0].access_type === 'owner',
      isMember: result.rows[0].access_type === 'member',
    };
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: "Erreur lors de la vérification de l'accès au projet" });
  }
}

/**
 * Middleware: Check if user can access a specific task
 * User can access if they are:
 * - The task owner (user_id matches)
 * - The task is a team_task assigned to them
 */
export async function canAccessTask(request, reply) {
  const { userId } = request.user;
  const { id: taskId } = request.params;

  try {
    // Check if user owns the task or is assigned via team_task
    const result = await query(
      `SELECT
        tt.id as team_task_id,
        tt.user_id as manager_id,
        tm.invited_user_id
       FROM team_tasks tt
       JOIN team_members tm ON tt.team_member_id = tm.id
       WHERE tt.id = $1 AND (tt.user_id = $2 OR tm.invited_user_id = $2)
       LIMIT 1`,
      [taskId, userId]
    );

    if (result.rows.length === 0) {
      return reply.status(403).send({ error: 'Accès refusé à cette tâche' });
    }

    // Attach task access info to request
    const row = result.rows[0];
    request.taskAccess = {
      taskId: row.team_task_id,
      isOwner: row.manager_id === userId,
      isAssignee: row.invited_user_id === userId,
    };
  } catch (error) {
    request.log.error(error);
    return reply
      .status(500)
      .send({ error: "Erreur lors de la vérification de l'accès à la tâche" });
  }
}

/**
 * Helper function: Check if user owns a team member
 * @param {number} userId - User ID
 * @param {number} memberId - Team member ID
 * @returns {Promise<boolean>}
 */
export async function userOwnsTeamMember(userId, memberId) {
  try {
    const result = await query('SELECT id FROM team_members WHERE id = $1 AND user_id = $2', [
      memberId,
      userId,
    ]);
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking team member ownership:', error);
    return false;
  }
}

/**
 * Helper function: Check if user owns an invitation
 * @param {number} userId - User ID
 * @param {number} invitationId - Invitation ID
 * @returns {Promise<boolean>}
 */
export async function userOwnsInvitation(userId, invitationId) {
  try {
    const result = await query(
      'SELECT id FROM team_invitations WHERE id = $1 AND manager_id = $2',
      [invitationId, userId]
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking invitation ownership:', error);
    return false;
  }
}
