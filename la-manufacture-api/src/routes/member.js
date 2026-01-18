import { query } from '../db/connection.js';
import { requireMember, canAccessProject, canAccessTask } from '../middleware/authorization.js';

export default async function memberRoutes(fastify) {
  // GET /api/member/projects - Get projects assigned to member
  fastify.get('/projects', { preHandler: [fastify.authenticate, requireMember] }, async request => {
    const { userId } = request.user;
    const { status } = request.query;

    try {
      // Get team member ID
      const memberResult = await query(
        'SELECT id FROM team_members WHERE invited_user_id = $1 AND active = TRUE',
        [userId]
      );

      if (memberResult.rows.length === 0) {
        return { projects: [] };
      }

      const teamMemberId = memberResult.rows[0].id;

      // Get assigned projects
      let sql = `
        SELECT
          p.*,
          COALESCE(
            json_agg(
              json_build_object('id', tm.id, 'name', tm.name, 'avatar_color', tm.avatar_color)
              ORDER BY tm.name ASC
            ) FILTER (WHERE tm.id IS NOT NULL),
            '[]'::json
          ) as assigned_members
        FROM projects p
        JOIN project_members pm ON p.id = pm.project_id
        LEFT JOIN project_members pm2 ON p.id = pm2.project_id
        LEFT JOIN team_members tm ON pm2.team_member_id = tm.id
        WHERE pm.team_member_id = $1
      `;
      const params = [teamMemberId];
      let paramIndex = 2;

      if (status) {
        sql += ` AND p.status = $${paramIndex++}`;
        params.push(status);
      }

      sql += ' GROUP BY p.id ORDER BY p.deadline ASC NULLS LAST, p.created_at DESC';

      const result = await query(sql, params);

      return { projects: result.rows };
    } catch (error) {
      request.log.error(error);
      throw error;
    }
  });

  // GET /api/member/tasks - Get tasks assigned to member
  fastify.get('/tasks', { preHandler: [fastify.authenticate, requireMember] }, async request => {
    const { userId } = request.user;
    const { date, project_id } = request.query;

    try {
      // Get team member ID
      const memberResult = await query(
        'SELECT id FROM team_members WHERE invited_user_id = $1 AND active = TRUE',
        [userId]
      );

      if (memberResult.rows.length === 0) {
        return { tasks: [] };
      }

      const teamMemberId = memberResult.rows[0].id;

      // Build query to get assigned tasks
      let sql = `
        SELECT
          tt.*,
          COALESCE(
            (SELECT SUM(minutes) FROM task_time_logs WHERE team_task_id = tt.id),
            0
          ) as total_time_logged
        FROM team_tasks tt
        WHERE tt.team_member_id = $1
      `;
      const params = [teamMemberId];
      let paramIndex = 2;

      if (date) {
        sql += ` AND tt.date = $${paramIndex++}`;
        params.push(date);
      }

      // Filter by project if project_id is provided
      // Note: team_tasks don't have direct project_id, but we could add it if needed
      // For now, we'll skip this filter

      sql += ' ORDER BY tt.urgent DESC, tt.done ASC, tt.date ASC';

      const result = await query(sql, params);

      return { tasks: result.rows };
    } catch (error) {
      request.log.error(error);
      throw error;
    }
  });

  // PATCH /api/member/tasks/:id - Update task status/time
  fastify.patch(
    '/:id',
    { preHandler: [fastify.authenticate, requireMember, canAccessTask] },
    async (request, reply) => {
      const { userId } = request.user;
      const { id } = request.params;
      const { done, status, time_spent, urgent } = request.body;

      try {
        // Build update query
        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (done !== undefined) {
          updates.push(`done = $${paramIndex++}`);
          values.push(done);

          // Update done_at timestamp
          if (done) {
            updates.push(`done_at = CURRENT_TIMESTAMP`);
          } else {
            updates.push(`done_at = NULL`);
          }
        }

        if (status !== undefined) {
          updates.push(`status = $${paramIndex++}`);
          values.push(status);
        }

        if (time_spent !== undefined) {
          updates.push(`time_spent = $${paramIndex++}`);
          values.push(time_spent);
        }

        if (urgent !== undefined) {
          updates.push(`urgent = $${paramIndex++}`);
          values.push(urgent);
        }

        if (updates.length === 0) {
          return reply.status(400).send({ error: 'Aucune mise à jour fournie' });
        }

        // Add updated_at
        updates.push('updated_at = CURRENT_TIMESTAMP');

        // Add id parameter
        values.push(id);

        const result = await query(
          `UPDATE team_tasks SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
          values
        );

        if (result.rows.length === 0) {
          return reply.status(404).send({ error: 'Tâche non trouvée' });
        }

        return { task: result.rows[0] };
      } catch (error) {
        request.log.error(error);
        return reply
          .status(500)
          .send({ error: 'Erreur lors de la mise à jour de la tâche', details: error.message });
      }
    }
  );

  // POST /api/member/tasks/:id/time - Log time on task
  fastify.post(
    '/:id/time',
    { preHandler: [fastify.authenticate, requireMember, canAccessTask] },
    async (request, reply) => {
      const { userId } = request.user;
      const { id: taskId } = request.params;
      const { minutes, description, date } = request.body;

      if (!minutes || minutes <= 0) {
        return reply.status(400).send({ error: 'Temps invalide (doit être > 0)' });
      }

      try {
        // Get team member ID
        const memberResult = await query('SELECT id FROM team_members WHERE invited_user_id = $1', [
          userId,
        ]);
        const teamMemberId = memberResult.rows[0]?.id;

        // Create time log
        const logDate = date || new Date().toISOString().split('T')[0];

        const result = await query(
          `INSERT INTO task_time_logs (team_task_id, user_id, team_member_id, minutes, description, date)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
          [taskId, userId, teamMemberId, minutes, description || null, logDate]
        );

        // Update task time_spent
        await query('UPDATE team_tasks SET time_spent = time_spent + $1 WHERE id = $2', [
          minutes,
          taskId,
        ]);

        return { timeLog: result.rows[0] };
      } catch (error) {
        request.log.error(error);
        return reply
          .status(500)
          .send({ error: "Erreur lors de l'enregistrement du temps", details: error.message });
      }
    }
  );

  // POST /api/member/projects/:id/time - Log time on project
  fastify.post(
    '/projects/:id/time',
    { preHandler: [fastify.authenticate, requireMember, canAccessProject] },
    async (request, reply) => {
      const { userId } = request.user;
      const { id: projectId } = request.params;
      const { minutes, description, date } = request.body;

      if (!minutes || minutes <= 0) {
        return reply.status(400).send({ error: 'Temps invalide (doit être > 0)' });
      }

      try {
        // Get team member ID
        const memberResult = await query('SELECT id FROM team_members WHERE invited_user_id = $1', [
          userId,
        ]);
        const teamMemberId = memberResult.rows[0]?.id;

        // Create time log
        const logDate = date || new Date().toISOString().split('T')[0];

        const result = await query(
          `INSERT INTO project_time_logs (project_id, user_id, team_member_id, minutes, description, date)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
          [projectId, userId, teamMemberId, minutes, description || null, logDate]
        );

        return { timeLog: result.rows[0] };
      } catch (error) {
        request.log.error(error);
        return reply
          .status(500)
          .send({ error: "Erreur lors de l'enregistrement du temps", details: error.message });
      }
    }
  );

  // GET /api/member/time-logs - Get member's time logs
  fastify.get(
    '/time-logs',
    { preHandler: [fastify.authenticate, requireMember] },
    async request => {
      const { userId } = request.user;
      const { project_id, start_date, end_date } = request.query;

      try {
        // Get team member ID
        const memberResult = await query('SELECT id FROM team_members WHERE invited_user_id = $1', [
          userId,
        ]);
        const teamMemberId = memberResult.rows[0]?.id;

        if (!teamMemberId) {
          return { taskLogs: [], projectLogs: [], totalMinutes: 0 };
        }

        // Build queries for task and project logs
        let taskSql = `
        SELECT
          ttl.*,
          tt.text as task_text,
          tt.date as task_date
        FROM task_time_logs ttl
        JOIN team_tasks tt ON ttl.team_task_id = tt.id
        WHERE ttl.user_id = $1
      `;
        let projectSql = `
        SELECT
          ptl.*,
          p.name as project_name
        FROM project_time_logs ptl
        JOIN projects p ON ptl.project_id = p.id
        WHERE ptl.user_id = $1
      `;

        const taskParams = [userId];
        const projectParams = [userId];
        let paramIndex = 2;

        if (project_id) {
          projectSql += ` AND ptl.project_id = $${paramIndex}`;
          projectParams.push(project_id);
          paramIndex++;
        }

        if (start_date) {
          taskSql += ` AND ttl.date >= $${paramIndex}`;
          projectSql += ` AND ptl.date >= $${paramIndex}`;
          taskParams.push(start_date);
          projectParams.push(start_date);
          paramIndex++;
        }

        if (end_date) {
          taskSql += ` AND ttl.date <= $${paramIndex}`;
          projectSql += ` AND ptl.date <= $${paramIndex}`;
          taskParams.push(end_date);
          projectParams.push(end_date);
          paramIndex++;
        }

        taskSql += ' ORDER BY ttl.date DESC, ttl.logged_at DESC';
        projectSql += ' ORDER BY ptl.date DESC, ptl.logged_at DESC';

        const [taskLogs, projectLogs] = await Promise.all([
          query(taskSql, taskParams),
          query(projectSql, projectParams),
        ]);

        // Calculate total minutes
        const totalTaskMinutes = taskLogs.rows.reduce((sum, log) => sum + log.minutes, 0);
        const totalProjectMinutes = projectLogs.rows.reduce((sum, log) => sum + log.minutes, 0);
        const totalMinutes = totalTaskMinutes + totalProjectMinutes;

        return {
          taskLogs: taskLogs.rows,
          projectLogs: projectLogs.rows,
          totalMinutes,
          totalTaskMinutes,
          totalProjectMinutes,
        };
      } catch (error) {
        request.log.error(error);
        throw error;
      }
    }
  );

  // GET /api/member/profile - Get member profile
  fastify.get('/profile', { preHandler: [fastify.authenticate, requireMember] }, async request => {
    const { userId } = request.user;

    try {
      // Get team member profile with manager info
      const result = await query(
        `SELECT
          tm.*,
          u.name as manager_name,
          u.email as manager_email,
          (SELECT COUNT(*) FROM project_members pm WHERE pm.team_member_id = tm.id) as project_count,
          (SELECT COUNT(*) FROM team_tasks tt WHERE tt.team_member_id = tm.id AND tt.done = FALSE) as pending_tasks,
          (SELECT COUNT(*) FROM team_tasks tt WHERE tt.team_member_id = tm.id AND tt.done = TRUE) as completed_tasks,
          COALESCE((SELECT SUM(minutes) FROM task_time_logs ttl WHERE ttl.team_member_id = tm.id), 0) as total_task_time,
          COALESCE((SELECT SUM(minutes) FROM project_time_logs ptl WHERE ptl.team_member_id = tm.id), 0) as total_project_time
         FROM team_members tm
         JOIN users u ON tm.user_id = u.id
         WHERE tm.invited_user_id = $1 AND tm.active = TRUE`,
        [userId]
      );

      if (result.rows.length === 0) {
        return { error: 'Profil membre non trouvé' };
      }

      const profile = result.rows[0];

      return {
        member: {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          avatar_color: profile.avatar_color,
          role: profile.role,
          created_at: profile.created_at,
        },
        manager: {
          name: profile.manager_name,
          email: profile.manager_email,
        },
        stats: {
          project_count: parseInt(profile.project_count),
          pending_tasks: parseInt(profile.pending_tasks),
          completed_tasks: parseInt(profile.completed_tasks),
          total_time_minutes:
            parseInt(profile.total_task_time) + parseInt(profile.total_project_time),
          total_task_time_minutes: parseInt(profile.total_task_time),
          total_project_time_minutes: parseInt(profile.total_project_time),
        },
      };
    } catch (error) {
      request.log.error(error);
      throw error;
    }
  });
}
