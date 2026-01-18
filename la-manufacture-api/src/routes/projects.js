import { query } from '../db/connection.js';

export default async function projectsRoutes(fastify) {
  // GET /api/projects - Liste des projets
  fastify.get('/', { preHandler: [fastify.authenticate] }, async request => {
    const { userId } = request.user;
    const { status } = request.query;

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
      LEFT JOIN project_members pm ON p.id = pm.project_id
      LEFT JOIN team_members tm ON pm.team_member_id = tm.id
      WHERE p.user_id = $1
    `;
    const params = [userId];
    let paramIndex = 2;

    if (status) {
      sql += ` AND p.status = $${paramIndex++}`;
      params.push(status);
    }

    sql += ' GROUP BY p.id ORDER BY p.created_at DESC';

    const result = await query(sql, params);

    return { projects: result.rows };
  });

  // GET /api/projects/:id - Details d'un projet avec ses taches et fichiers
  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { id } = request.params;

    // Une seule requete pour recuperer projet, membres, taches et fichiers
    const result = await query(
      `WITH project_data AS (
        SELECT * FROM projects WHERE id = $1 AND user_id = $2
      ),
      members_data AS (
        SELECT
          pm.project_id,
          json_agg(
            json_build_object('id', tm.id, 'name', tm.name, 'avatar_color', tm.avatar_color)
            ORDER BY tm.name ASC
          ) as members
        FROM project_members pm
        JOIN team_members tm ON pm.team_member_id = tm.id
        WHERE pm.project_id = $1
        GROUP BY pm.project_id
      ),
      tasks_data AS (
        SELECT
          project_id,
          json_agg(
            json_build_object('id', id, 'text', text, 'date', date, 'urgent', urgent, 'done', done, 'status', status)
            ORDER BY urgent DESC, done ASC, date ASC
          ) as tasks
        FROM tasks
        WHERE project_id = $1 AND user_id = $2
        GROUP BY project_id
      ),
      files_data AS (
        SELECT
          project_id,
          json_agg(
            json_build_object('id', id, 'original_name', original_name, 'filename', filename, 'mime_type', mime_type, 'size', size, 'created_at', created_at)
            ORDER BY created_at DESC
          ) as files
        FROM team_files
        WHERE project_id = $1 AND user_id = $2
        GROUP BY project_id
      )
      SELECT
        p.*,
        COALESCE(m.members, '[]'::json) as assigned_members,
        COALESCE(t.tasks, '[]'::json) as tasks,
        COALESCE(f.files, '[]'::json) as files
      FROM project_data p
      LEFT JOIN members_data m ON p.id = m.project_id
      LEFT JOIN tasks_data t ON p.id = t.project_id
      LEFT JOIN files_data f ON p.id = f.project_id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Projet non trouve' });
    }

    const row = result.rows[0];

    return {
      project: {
        id: row.id,
        user_id: row.user_id,
        name: row.name,
        description: row.description,
        assigned_to: row.assigned_to,
        deadline: row.deadline,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        assigned_members: row.assigned_members,
      },
      tasks: row.tasks,
      files: row.files,
    };
  });

  // POST /api/projects - Creer un projet
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { name, description, member_ids, deadline } = request.body;

    if (!name || name.trim().length === 0) {
      return reply.status(400).send({ error: 'Le nom du projet est requis' });
    }

    // Si member_ids est fourni, verifier que les membres appartiennent a l'utilisateur
    if (member_ids && Array.isArray(member_ids) && member_ids.length > 0) {
      const memberCheck = await query(
        `SELECT id FROM team_members
         WHERE id = ANY($1::int[]) AND user_id = $2`,
        [member_ids, userId]
      );

      if (memberCheck.rows.length !== member_ids.length) {
        return reply.status(404).send({ error: 'Un ou plusieurs membres non trouves' });
      }
    }

    try {
      // Creer le projet
      const result = await query(
        `INSERT INTO projects (user_id, name, description, deadline)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId, name.trim(), description?.trim() || null, deadline || null]
      );

      const project = result.rows[0];

      // Assigner les membres
      if (member_ids && Array.isArray(member_ids) && member_ids.length > 0) {
        const insertValues = member_ids.map((memberId, index) => `($1, $${index + 2})`).join(', ');

        await query(
          `INSERT INTO project_members (project_id, team_member_id)
           VALUES ${insertValues}`,
          [project.id, ...member_ids]
        );
      }

      // Recuperer le projet avec les membres assignes
      const membersResult = await query(
        `SELECT tm.id, tm.name, tm.avatar_color
         FROM project_members pm
         JOIN team_members tm ON pm.team_member_id = tm.id
         WHERE pm.project_id = $1
         ORDER BY tm.name ASC`,
        [project.id]
      );

      return {
        project: {
          ...project,
          assigned_members: membersResult.rows,
        },
      };
    } catch (error) {
      fastify.log.error(error);
      return reply
        .status(500)
        .send({ error: 'Erreur lors de la creation du projet', details: error.message });
    }
  });

  // PATCH /api/projects/:id - Modifier un projet
  fastify.patch('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { id } = request.params;
    const { name, description, member_ids, deadline, status } = request.body;

    // Verifier que le projet appartient a l'utilisateur
    const check = await query('SELECT id FROM projects WHERE id = $1 AND user_id = $2', [
      id,
      userId,
    ]);

    if (check.rows.length === 0) {
      return reply.status(404).send({ error: 'Projet non trouve ou acces refuse' });
    }

    // Si member_ids est fourni, verifier que les membres appartiennent a l'utilisateur
    if (member_ids !== undefined && Array.isArray(member_ids) && member_ids.length > 0) {
      const memberCheck = await query(
        `SELECT id FROM team_members
         WHERE id = ANY($1::int[]) AND user_id = $2`,
        [member_ids, userId]
      );

      if (memberCheck.rows.length !== member_ids.length) {
        return reply.status(404).send({ error: 'Un ou plusieurs membres non trouves' });
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
      if (deadline !== undefined) {
        updates.push(`deadline = $${paramIndex++}`);
        values.push(deadline);
      }
      if (status !== undefined) {
        updates.push(`status = $${paramIndex++}`);
        values.push(status);
      }

      // Mettre a jour le projet si necessaire
      if (updates.length > 0) {
        values.push(id, userId);

        await query(
          `UPDATE projects SET ${updates.join(', ')}
           WHERE id = $${paramIndex++} AND user_id = $${paramIndex}`,
          values
        );
      }

      // Mettre a jour les membres assignes si fourni
      if (member_ids !== undefined) {
        // Supprimer les anciennes assignations
        await query('DELETE FROM project_members WHERE project_id = $1', [id]);

        // Ajouter les nouvelles assignations
        if (Array.isArray(member_ids) && member_ids.length > 0) {
          const insertValues = member_ids
            .map((memberId, index) => `($1, $${index + 2})`)
            .join(', ');

          await query(
            `INSERT INTO project_members (project_id, team_member_id)
             VALUES ${insertValues}`,
            [id, ...member_ids]
          );
        }
      }

      // Recuperer le projet mis a jour avec les membres assignes
      const projectResult = await query('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [
        id,
        userId,
      ]);

      const membersResult = await query(
        `SELECT tm.id, tm.name, tm.avatar_color
         FROM project_members pm
         JOIN team_members tm ON pm.team_member_id = tm.id
         WHERE pm.project_id = $1
         ORDER BY tm.name ASC`,
        [id]
      );

      return {
        project: {
          ...projectResult.rows[0],
          assigned_members: membersResult.rows,
        },
      };
    } catch (error) {
      reply.log.error(error);
      return reply
        .status(500)
        .send({ error: 'Erreur lors de la mise a jour du projet', details: error.message });
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
        return reply
          .status(404)
          .send({ error: 'Projet non trouve (deja supprime ou acces refuse)' });
      }

      return { success: true };
    } catch (error) {
      reply.log.error(error);
      return reply
        .status(500)
        .send({ error: 'Erreur lors de la suppression du projet', details: error.message });
    }
  });
}
