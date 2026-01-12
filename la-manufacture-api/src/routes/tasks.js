import { query } from '../db/connection.js';

export default async function tasksRoutes(fastify) {
  // Get all tasks for user (owned + shared with user)
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request) => {
    const { userId } = request.user;
    const { date, status } = request.query;

    // Query that includes both owned tasks and shared tasks
    let baseQuery = `
      WITH all_tasks AS (
        SELECT t.*,
               u.name as owner_user_name,
               NULL::text as shared_by_name,
               NULL::integer as shared_by_user_id,
               'owner' as access_type
        FROM tasks t
        JOIN users u ON t.user_id = u.id
        WHERE t.user_id = $1

        UNION ALL

        SELECT t.*,
               owner_u.name as owner_user_name,
               sharer_u.name as shared_by_name,
               ts.shared_by_user_id,
               ts.permission as access_type
        FROM tasks t
        JOIN task_sharing ts ON t.id = ts.task_id
        JOIN users owner_u ON t.user_id = owner_u.id
        JOIN users sharer_u ON ts.shared_by_user_id = sharer_u.id
        WHERE ts.shared_with_user_id = $1
      )
      SELECT * FROM all_tasks WHERE 1=1
    `;

    const params = [userId];

    if (date) {
      baseQuery += ` AND date = $${params.length + 1}`;
      params.push(date);
    }

    if (status) {
      baseQuery += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    baseQuery += ' ORDER BY date DESC, urgent DESC, created_at DESC';

    const result = await query(baseQuery, params);
    return { tasks: result.rows };
  });

  // Get tasks for today
  fastify.get('/today', { preHandler: [fastify.authenticate] }, async (request) => {
    const { userId } = request.user;
    const today = new Date().toISOString().split('T')[0];

    const result = await query(
      'SELECT * FROM tasks WHERE user_id = $1 AND date = $2 ORDER BY urgent DESC, done ASC',
      [userId, today]
    );

    return { tasks: result.rows };
  });

  // Get late tasks (carry-over candidates)
  fastify.get('/late', { preHandler: [fastify.authenticate] }, async (request) => {
    const { userId } = request.user;
    const today = new Date().toISOString().split('T')[0];

    const result = await query(
      'SELECT * FROM tasks WHERE user_id = $1 AND date < $2 AND done = FALSE ORDER BY date ASC',
      [userId, today]
    );

    return { tasks: result.rows };
  });

  // Carry-over late tasks
  fastify.post('/carry-over', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { mode } = request.body; // 'move' | 'duplicate'
    const today = new Date().toISOString().split('T')[0];

    try {
      const lateTasks = await query(
        'SELECT * FROM tasks WHERE user_id = $1 AND date < $2 AND done = FALSE',
        [userId, today]
      );

      if (lateTasks.rows.length === 0) {
        return { carriedOver: 0 };
      }

      if (mode === 'move') {
        // Move tasks to today
        await query(
          `UPDATE tasks
           SET date = $1, original_date = COALESCE(original_date, date), updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $2 AND date < $1 AND done = FALSE`,
          [today, userId]
        );

        // Log activity
        for (const task of lateTasks.rows) {
          await query(
            'INSERT INTO activity_log (user_id, task_id, action, metadata) VALUES ($1, $2, $3, $4)',
            [userId, task.id, 'carried_over', { mode: 'move', from: task.date, to: today }]
          );
        }
      } else if (mode === 'duplicate') {
        // Duplicate tasks
        for (const task of lateTasks.rows) {
          await query(
            `INSERT INTO tasks (user_id, text, date, original_date, owner, assignee, status, urgent, done, time_spent)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [userId, task.text, today, task.date, task.owner, task.assignee, 'open', task.urgent, false, 0]
          );
        }
      }

      return { carriedOver: lateTasks.rows.length };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Carry-over failed' });
    }
  });

  // Create task
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { text, date, owner, assignee, urgent, status, is_event, start_time, end_time, location } = request.body;

    if (!text || !date || !owner) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    try {
      const result = await query(
        `INSERT INTO tasks (user_id, text, date, owner, assignee, urgent, status, done, is_event, start_time, end_time, location)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [userId, text, date, owner, assignee || owner, urgent || false, status || 'open', false,
         is_event || false, start_time || null, end_time || null, location || null]
      );

      let task = result.rows[0];

      // If it's an event and Google Calendar is connected, sync it
      if (task.is_event && task.start_time) {
        try {
          const googleTokens = await query(
            'SELECT id FROM google_tokens WHERE user_id = $1',
            [userId]
          );

          if (googleTokens.rows.length > 0) {
            // Call the sync endpoint internally (we'll handle this in frontend instead)
            // Just flag that Google sync is available
            task.googleSyncAvailable = true;
          }
        } catch (syncError) {
          fastify.log.error('Google sync check error:', syncError);
        }
      }

      // Log activity
      await query(
        'INSERT INTO activity_log (user_id, task_id, action) VALUES ($1, $2, $3)',
        [userId, task.id, 'created']
      );

      return { task };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Task creation failed' });
    }
  });

  // Update task
  fastify.patch('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { id } = request.params;
    const updates = request.body;

    try {
      // Verify ownership
      const checkResult = await query('SELECT id FROM tasks WHERE id = $1 AND user_id = $2', [id, userId]);
      if (checkResult.rows.length === 0) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      // Build update query dynamically
      const fields = [];
      const values = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (['text', 'date', 'owner', 'assignee', 'status', 'urgent', 'done', 'time_spent',
             'is_event', 'start_time', 'end_time', 'location', 'google_event_id'].includes(key)) {
          fields.push(`${key} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      }

      if (fields.length === 0) {
        return reply.status(400).send({ error: 'No valid fields to update' });
      }

      values.push(id, userId);
      const queryText = `UPDATE tasks SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
                         WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1} RETURNING *`;

      const result = await query(queryText, values);

      // Log activity
      await query(
        'INSERT INTO activity_log (user_id, task_id, action, metadata) VALUES ($1, $2, $3, $4)',
        [userId, id, 'updated', updates]
      );

      return { task: result.rows[0] };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Task update failed' });
    }
  });

  // Delete task
  fastify.delete('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { id } = request.params;

    try {
      const result = await query('DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING *', [id, userId]);

      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      // Log activity
      await query(
        'INSERT INTO activity_log (user_id, task_id, action, metadata) VALUES ($1, $2, $3, $4)',
        [userId, id, 'deleted', { task: result.rows[0] }]
      );

      return { success: true };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Task deletion failed' });
    }
  });

  // Add time to task
  fastify.post('/:id/time', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { id } = request.params;
    const { minutes } = request.body;

    if (!minutes || minutes < 0) {
      return reply.status(400).send({ error: 'Invalid time value' });
    }

    try {
      const result = await query(
        'UPDATE tasks SET time_spent = time_spent + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3 RETURNING *',
        [minutes, id, userId]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'Task not found' });
      }

      return { task: result.rows[0] };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Time tracking failed' });
    }
  });

  // ========== SHARING ENDPOINTS ==========

  // Share a task with another user
  fastify.post('/:id/share', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { id } = request.params;
    const { targetUserId, permission = 'view' } = request.body;

    if (!targetUserId) {
      return reply.status(400).send({ error: 'targetUserId required' });
    }

    try {
      // Verify ownership
      const taskCheck = await query('SELECT id, text FROM tasks WHERE id = $1 AND user_id = $2', [id, userId]);
      if (taskCheck.rows.length === 0) {
        return reply.status(403).send({ error: 'Cannot share a task you do not own' });
      }

      // Verify target user exists
      const targetCheck = await query('SELECT id, name FROM users WHERE id = $1', [targetUserId]);
      if (targetCheck.rows.length === 0) {
        return reply.status(404).send({ error: 'Target user not found' });
      }

      // Create sharing (upsert)
      const result = await query(
        `INSERT INTO task_sharing (task_id, shared_with_user_id, shared_by_user_id, permission)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (task_id, shared_with_user_id) DO UPDATE SET permission = $4
         RETURNING *`,
        [id, targetUserId, userId, permission]
      );

      // Get sharer name for notification
      const sharerResult = await query('SELECT name FROM users WHERE id = $1', [userId]);
      const sharerName = sharerResult.rows[0]?.name || 'Quelqu\'un';

      // Create notification for target user
      const taskText = taskCheck.rows[0].text.substring(0, 50);
      await query(
        `INSERT INTO notifications (user_id, type, title, message, data)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          targetUserId,
          'task_shared',
          'Nouvelle tache partagee',
          `${sharerName} a partage une tache avec vous: "${taskText}"`,
          JSON.stringify({ task_id: id, shared_by_user_id: userId })
        ]
      );

      // Log activity
      await query(
        'INSERT INTO activity_log (user_id, task_id, action, metadata) VALUES ($1, $2, $3, $4)',
        [userId, id, 'shared', { with_user_id: targetUserId, permission }]
      );

      return {
        sharing: result.rows[0],
        targetUser: targetCheck.rows[0]
      };
    } catch (error) {
      fastify.log.error('Share error:', error);
      // Return more detailed error for debugging
      const errorMessage = error.message || 'Sharing failed';
      const isTableMissing = errorMessage.includes('does not exist');
      return reply.status(500).send({
        error: isTableMissing ? 'Database tables not initialized. Run migrations.' : errorMessage,
        details: error.message
      });
    }
  });

  // Get shares for a task
  fastify.get('/:id/shares', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { id } = request.params;

    try {
      // Verify ownership
      const taskCheck = await query('SELECT id FROM tasks WHERE id = $1 AND user_id = $2', [id, userId]);
      if (taskCheck.rows.length === 0) {
        return reply.status(403).send({ error: 'Task not found or not owned' });
      }

      const result = await query(
        `SELECT ts.*, u.name, u.email
         FROM task_sharing ts
         JOIN users u ON ts.shared_with_user_id = u.id
         WHERE ts.task_id = $1`,
        [id]
      );

      return { shares: result.rows };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to get shares' });
    }
  });

  // Remove a share
  fastify.delete('/:id/share/:targetUserId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { id, targetUserId } = request.params;

    try {
      // Verify ownership
      const taskCheck = await query('SELECT id FROM tasks WHERE id = $1 AND user_id = $2', [id, userId]);
      if (taskCheck.rows.length === 0) {
        return reply.status(403).send({ error: 'Cannot unshare a task you do not own' });
      }

      await query(
        `DELETE FROM task_sharing WHERE task_id = $1 AND shared_with_user_id = $2`,
        [id, targetUserId]
      );

      return { success: true };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Unsharing failed' });
    }
  });
}
