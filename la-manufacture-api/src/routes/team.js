import { query } from '../db/connection.js';

export default async function teamRoutes(fastify) {
  // ============================================
  // TEAM MEMBERS
  // ============================================

  // GET /api/team/members - Liste des membres de l'equipe
  fastify.get('/members', { preHandler: [fastify.authenticate] }, async (request) => {
    const { userId } = request.user;

    const result = await query(
      `SELECT id, name, avatar_color, active, created_at
       FROM team_members
       WHERE user_id = $1
       ORDER BY name ASC`,
      [userId]
    );

    return { members: result.rows };
  });

  // POST /api/team/members - Ajouter un membre
  fastify.post('/members', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { name, avatar_color } = request.body;

    if (!name || name.trim().length === 0) {
      return reply.status(400).send({ error: 'Le nom est requis' });
    }

    // Couleurs par defaut pour les avatars
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
    const color = avatar_color || colors[Math.floor(Math.random() * colors.length)];

    const result = await query(
      `INSERT INTO team_members (user_id, name, avatar_color)
       VALUES ($1, $2, $3)
       RETURNING id, name, avatar_color, active, created_at`,
      [userId, name.trim(), color]
    );

    return { member: result.rows[0] };
  });

  // PATCH /api/team/members/:id - Modifier un membre
  fastify.patch('/members/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { id } = request.params;
    const { name, avatar_color, active } = request.body;

    // Verifier que le membre appartient a l'utilisateur
    const check = await query(
      'SELECT id FROM team_members WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (check.rows.length === 0) {
      return reply.status(404).send({ error: 'Membre non trouve' });
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }
    if (avatar_color !== undefined) {
      updates.push(`avatar_color = $${paramIndex++}`);
      values.push(avatar_color);
    }
    if (active !== undefined) {
      updates.push(`active = $${paramIndex++}`);
      values.push(active);
    }

    if (updates.length === 0) {
      return reply.status(400).send({ error: 'Rien a modifier' });
    }

    values.push(id, userId);

    const result = await query(
      `UPDATE team_members SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
       RETURNING id, name, avatar_color, active, created_at`,
      values
    );

    return { member: result.rows[0] };
  });

  // DELETE /api/team/members/:id - Supprimer un membre
  fastify.delete('/members/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { id } = request.params;

    const result = await query(
      'DELETE FROM team_members WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Membre non trouve' });
    }

    return { success: true };
  });

  // ============================================
  // TEAM TASKS
  // ============================================

  // GET /api/team/tasks - Liste des taches de l'equipe
  fastify.get('/tasks', { preHandler: [fastify.authenticate] }, async (request) => {
    const { userId } = request.user;
    const { member_id, date } = request.query;

    let sql = `
      SELECT t.*, m.name as member_name, m.avatar_color
      FROM team_tasks t
      JOIN team_members m ON t.team_member_id = m.id
      WHERE t.user_id = $1
    `;
    const params = [userId];
    let paramIndex = 2;

    if (member_id) {
      sql += ` AND t.team_member_id = $${paramIndex++}`;
      params.push(member_id);
    }

    if (date) {
      sql += ` AND t.date = $${paramIndex++}`;
      params.push(date);
    }

    sql += ' ORDER BY t.urgent DESC, t.done ASC, t.created_at DESC';

    const result = await query(sql, params);
    return { tasks: result.rows };
  });

  // GET /api/team/tasks/member/:memberId - Taches d'un membre specifique (pour l'atelier)
  fastify.get('/tasks/member/:memberId', async (request, reply) => {
    const { memberId } = request.params;
    const { date } = request.query;

    // Verifier que le membre existe
    const memberCheck = await query(
      'SELECT id, name, user_id FROM team_members WHERE id = $1 AND active = TRUE',
      [memberId]
    );

    if (memberCheck.rows.length === 0) {
      return reply.status(404).send({ error: 'Membre non trouve' });
    }

    let sql = `
      SELECT t.id, t.text, t.date, t.urgent, t.done, t.done_at
      FROM team_tasks t
      WHERE t.team_member_id = $1
    `;
    const params = [memberId];

    if (date) {
      sql += ' AND t.date = $2';
      params.push(date);
    } else {
      // Par defaut: aujourd'hui
      sql += ' AND t.date = CURRENT_DATE';
    }

    sql += ' ORDER BY t.urgent DESC, t.done ASC, t.created_at DESC';

    const result = await query(sql, params);
    return {
      member: memberCheck.rows[0],
      tasks: result.rows
    };
  });

  // POST /api/team/tasks - Ajouter une tache
  fastify.post('/tasks', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { team_member_id, text, date, urgent } = request.body;

    if (!team_member_id || !text || !date) {
      return reply.status(400).send({ error: 'team_member_id, text et date sont requis' });
    }

    // Verifier que le membre appartient a l'utilisateur
    const memberCheck = await query(
      'SELECT id FROM team_members WHERE id = $1 AND user_id = $2',
      [team_member_id, userId]
    );

    if (memberCheck.rows.length === 0) {
      return reply.status(404).send({ error: 'Membre non trouve' });
    }

    const result = await query(
      `INSERT INTO team_tasks (user_id, team_member_id, text, date, urgent)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, team_member_id, text.trim(), date, urgent || false]
    );

    return { task: result.rows[0] };
  });

  // PATCH /api/team/tasks/:id - Modifier une tache (completion depuis l'atelier)
  fastify.patch('/tasks/:id', async (request, reply) => {
    const { id } = request.params;
    const { done, text, urgent, date } = request.body;

    // Verifier que la tache existe
    const check = await query('SELECT id, done FROM team_tasks WHERE id = $1', [id]);

    if (check.rows.length === 0) {
      return reply.status(404).send({ error: 'Tache non trouvee' });
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (done !== undefined) {
      updates.push(`done = $${paramIndex++}`);
      values.push(done);

      // Si on complete la tache, enregistrer l'heure
      if (done && !check.rows[0].done) {
        updates.push(`done_at = CURRENT_TIMESTAMP`);
      } else if (!done) {
        updates.push(`done_at = NULL`);
      }
    }

    if (text !== undefined) {
      updates.push(`text = $${paramIndex++}`);
      values.push(text.trim());
    }

    if (urgent !== undefined) {
      updates.push(`urgent = $${paramIndex++}`);
      values.push(urgent);
    }

    if (date !== undefined) {
      updates.push(`date = $${paramIndex++}`);
      values.push(date);
    }

    if (updates.length === 0) {
      return reply.status(400).send({ error: 'Rien a modifier' });
    }

    values.push(id);

    const result = await query(
      `UPDATE team_tasks SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return { task: result.rows[0] };
  });

  // DELETE /api/team/tasks/:id - Supprimer une tache
  fastify.delete('/tasks/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { id } = request.params;

    const result = await query(
      'DELETE FROM team_tasks WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Tache non trouvee' });
    }

    return { success: true };
  });

  // ============================================
  // ATELIER PUBLIC ROUTES (sans auth)
  // ============================================

  // GET /api/team/atelier/:managerId - Liste des membres pour l'ecran atelier
  fastify.get('/atelier/:managerId', async (request, reply) => {
    const { managerId } = request.params;

    // Verifier que le manager existe
    const managerCheck = await query('SELECT id, name FROM users WHERE id = $1', [managerId]);

    if (managerCheck.rows.length === 0) {
      return reply.status(404).send({ error: 'Compte non trouve' });
    }

    const members = await query(
      `SELECT id, name, avatar_color
       FROM team_members
       WHERE user_id = $1 AND active = TRUE
       ORDER BY name ASC`,
      [managerId]
    );

    return {
      manager: { id: managerCheck.rows[0].id, name: managerCheck.rows[0].name },
      members: members.rows
    };
  });
}
