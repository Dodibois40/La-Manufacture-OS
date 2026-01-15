import { query } from '../db/connection.js';

export default async function projectsRoutes(fastify) {
  // GET /api/projects - Liste des projets
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request) => {
    const { userId } = request.user;
    const { status } = request.query;

    let sql = `
      SELECT p.*, m.name as assigned_to_name, m.avatar_color
      FROM projects p
      LEFT JOIN team_members m ON p.assigned_to = m.id
      WHERE p.user_id = $1
    `;
    const params = [userId];
    let paramIndex = 2;

    if (status) {
      sql += ` AND p.status = $${paramIndex++}`;
      params.push(status);
    }

    sql += ' ORDER BY p.created_at DESC';

    const result = await query(sql, params);
    return { projects: result.rows };
  });

  // GET /api/projects/:id - Details d'un projet avec ses taches et fichiers
  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { id } = request.params;

    // Recuperer le projet
    const projectResult = await query(
      `SELECT p.*, m.name as assigned_to_name, m.avatar_color
       FROM projects p
       LEFT JOIN team_members m ON p.assigned_to = m.id
       WHERE p.id = $1 AND p.user_id = $2`,
      [id, userId]
    );

    if (projectResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Projet non trouve' });
    }

    const project = projectResult.rows[0];

    // Recuperer les taches liees au projet
    const tasksResult = await query(
      `SELECT id, text, date, urgent, done, status
       FROM tasks
       WHERE project_id = $1 AND user_id = $2
       ORDER BY urgent DESC, done ASC, date ASC`,
      [id, userId]
    );

    // Recuperer les fichiers lies au projet
    const filesResult = await query(
      `SELECT id, original_name, filename, mime_type, size, created_at
       FROM team_files
       WHERE project_id = $1 AND user_id = $2
       ORDER BY created_at DESC`,
      [id, userId]
    );

    return {
      project,
      tasks: tasksResult.rows,
      files: filesResult.rows
    };
  });

  // POST /api/projects - Creer un projet
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { name, description, assigned_to, deadline } = request.body;

    if (!name || name.trim().length === 0) {
      return reply.status(400).send({ error: 'Le nom du projet est requis' });
    }

    // Si assigned_to est fourni, verifier que le membre appartient a l'utilisateur
    if (assigned_to) {
      const memberCheck = await query(
        'SELECT id FROM team_members WHERE id = $1 AND user_id = $2',
        [assigned_to, userId]
      );

      if (memberCheck.rows.length === 0) {
        return reply.status(404).send({ error: 'Membre non trouve' });
      }
    }

    const result = await query(
      `INSERT INTO projects (user_id, name, description, assigned_to, deadline)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, name.trim(), description?.trim() || null, assigned_to || null, deadline || null]
    );

    return { project: result.rows[0] };
  });

  // PATCH /api/projects/:id - Modifier un projet
  fastify.patch('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { id } = request.params;
    const { name, description, assigned_to, deadline, status } = request.body;

    // Verifier que le projet appartient a l'utilisateur
    const check = await query(
      'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (check.rows.length === 0) {
      return reply.status(404).send({ error: 'Projet non trouve ou acces refuse' });
    }

    // Si assigned_to est fourni, verifier que le membre appartient a l'utilisateur
    if (assigned_to !== undefined && assigned_to !== null) {
      const memberCheck = await query(
        'SELECT id FROM team_members WHERE id = $1 AND user_id = $2',
        [assigned_to, userId]
      );

      if (memberCheck.rows.length === 0) {
        return reply.status(404).send({ error: 'Membre non trouve' });
      }
    }

    try {
      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(name.trim());
      }
      if (description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(description?.trim() || null);
      }
      if (assigned_to !== undefined) {
        updates.push(`assigned_to = $${paramIndex++}`);
        values.push(assigned_to);
      }
      if (deadline !== undefined) {
        updates.push(`deadline = $${paramIndex++}`);
        values.push(deadline);
      }
      if (status !== undefined) {
        updates.push(`status = $${paramIndex++}`);
        values.push(status);
      }

      if (updates.length === 0) {
        return reply.status(400).send({ error: 'Rien a modifier' });
      }

      values.push(id, userId);

      const result = await query(
        `UPDATE projects SET ${updates.join(', ')}
         WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
         RETURNING *`,
        values
      );

      return { project: result.rows[0] };
    } catch (error) {
      reply.log.error(error);
      return reply.status(500).send({ error: 'Erreur lors de la mise a jour du projet', details: error.message });
    }
  });

  // DELETE /api/projects/:id - Supprimer un projet
  fastify.delete('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { id } = request.params;

    try {
      const result = await query(
        'DELETE FROM projects WHERE id = $1 AND user_id = $2 RETURNING id',
        [id, userId]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'Projet non trouve (deja supprime ou acces refuse)' });
      }

      return { success: true };
    } catch (error) {
      reply.log.error(error);
      return reply.status(500).send({ error: 'Erreur lors de la suppression du projet', details: error.message });
    }
  });
}
