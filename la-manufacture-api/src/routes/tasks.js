import { query } from '../db/connection.js';

export default async function tasksRoutes(fastify) {
  // Get all tasks for user
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request) => {
    const { userId } = request.user;
    const { date, status } = request.query;

    let queryText = 'SELECT * FROM tasks WHERE user_id = $1';
    const params = [userId];

    if (date) {
      queryText += ` AND date = $${params.length + 1}`;
      params.push(date);
    }

    if (status) {
      queryText += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    queryText += ' ORDER BY date DESC, urgent DESC, created_at DESC';

    const result = await query(queryText, params);
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
    const { text, date, owner, assignee, urgent, status } = request.body;

    if (!text || !date || !owner) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    try {
      const result = await query(
        `INSERT INTO tasks (user_id, text, date, owner, assignee, urgent, status, done)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [userId, text, date, owner, assignee || owner, urgent || false, status || 'open', false]
      );

      const task = result.rows[0];

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
        if (['text', 'date', 'owner', 'assignee', 'status', 'urgent', 'done', 'time_spent'].includes(key)) {
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
}
