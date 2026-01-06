import { query } from '../db/connection.js';

export default async function settingsRoutes(fastify) {
  // Get settings
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request) => {
    const { userId } = request.user;

    const result = await query('SELECT * FROM settings WHERE user_id = $1', [userId]);

    if (result.rows.length === 0) {
      // Create default settings if missing
      const newSettings = await query(
        'INSERT INTO settings (user_id, owners, carry_over_mode, ai_enabled) VALUES ($1, $2, $3, $4) RETURNING *',
        [userId, ['Thibaud'], 'move', true]
      );
      return { settings: newSettings.rows[0] };
    }

    return { settings: result.rows[0] };
  });

  // Update settings
  fastify.patch('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { owners, carryOverMode, aiEnabled } = request.body;

    try {
      const fields = [];
      const values = [];
      let paramIndex = 1;

      if (owners !== undefined) {
        fields.push(`owners = $${paramIndex}`);
        values.push(owners);
        paramIndex++;
      }

      if (carryOverMode !== undefined) {
        fields.push(`carry_over_mode = $${paramIndex}`);
        values.push(carryOverMode);
        paramIndex++;
      }

      if (aiEnabled !== undefined) {
        fields.push(`ai_enabled = $${paramIndex}`);
        values.push(aiEnabled);
        paramIndex++;
      }

      if (fields.length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      values.push(userId);
      const queryText = `UPDATE settings SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
                         WHERE user_id = $${paramIndex} RETURNING *`;

      const result = await query(queryText, values);

      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'Settings not found' });
      }

      return { settings: result.rows[0] };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Settings update failed' });
    }
  });
}
