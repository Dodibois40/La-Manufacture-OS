import { query } from '../db/connection.js';

export default async function notesRoutes(fastify) {
  // ==========================================
  // NOTES CRUD
  // ==========================================

  // GET /api/notes - Liste des notes de l'utilisateur (avec filtres)
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request) => {
    const { userId } = request.user;
    const { q, tag_id, project_id, task_id, is_pinned, archived, limit = 50, offset = 0 } = request.query;

    let sql = `
      SELECT
        n.*,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('id', t.id, 'name', t.name, 'color', t.color)
            ORDER BY jsonb_build_object('id', t.id, 'name', t.name, 'color', t.color)
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'::json
        ) as tags
      FROM notes n
      LEFT JOIN note_tags nt ON n.id = nt.note_id
      LEFT JOIN tags t ON nt.tag_id = t.id
      WHERE n.user_id = $1
    `;
    const params = [userId];
    let paramIndex = 2;

    // Filtre: notes archivées ou non
    if (archived === 'true') {
      sql += ` AND n.archived_at IS NOT NULL`;
    } else {
      sql += ` AND n.archived_at IS NULL`;
    }

    // Filtre: recherche texte (simple LIKE pour MVP, FTS via /search)
    if (q) {
      sql += ` AND (n.title ILIKE $${paramIndex} OR n.content ILIKE $${paramIndex})`;
      params.push(`%${q}%`);
      paramIndex++;
    }

    // Filtre: projet
    if (project_id) {
      sql += ` AND n.project_id = $${paramIndex++}`;
      params.push(project_id);
    }

    // Filtre: tâche
    if (task_id) {
      sql += ` AND n.task_id = $${paramIndex++}`;
      params.push(task_id);
    }

    // Filtre: épinglées
    if (is_pinned === 'true') {
      sql += ` AND n.is_pinned = TRUE`;
    }

    sql += ` GROUP BY n.id ORDER BY n.is_pinned DESC, n.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(sql, params);

    return { notes: result.rows };
  });

  // GET /api/notes/:id - Détails d'une note
  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { id } = request.params;

    const result = await query(
      `SELECT
        n.*,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('id', t.id, 'name', t.name, 'color', t.color)
            ORDER BY jsonb_build_object('id', t.id, 'name', t.name, 'color', t.color)
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'::json
        ) as tags
      FROM notes n
      LEFT JOIN note_tags nt ON n.id = nt.note_id
      LEFT JOIN tags t ON nt.tag_id = t.id
      WHERE n.id = $1 AND n.user_id = $2
      GROUP BY n.id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Note non trouvée' });
    }

    return { note: result.rows[0] };
  });

  // POST /api/notes - Créer une nouvelle note
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { title, content, color, is_pinned, project_id, task_id, tag_ids } = request.body;

    // Validation
    if (!title || title.trim() === '') {
      return reply.status(400).send({ error: 'Le titre est requis' });
    }

    try {
      // 1. Créer la note
      const noteResult = await query(
        `INSERT INTO notes (user_id, title, content, color, is_pinned, project_id, task_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [userId, title.trim(), content || '', color || null, is_pinned || false, project_id || null, task_id || null]
      );

      const note = noteResult.rows[0];

      // 2. Ajouter les tags si fournis
      if (tag_ids && Array.isArray(tag_ids) && tag_ids.length > 0) {
        const tagValues = tag_ids.map((tagId, i) => `($1, $${i + 2})`).join(', ');
        await query(
          `INSERT INTO note_tags (note_id, tag_id) VALUES ${tagValues}`,
          [note.id, ...tag_ids]
        );

        // Récupérer les tags associés
        const tagsResult = await query(
          `SELECT t.* FROM tags t
           JOIN note_tags nt ON t.id = nt.tag_id
           WHERE nt.note_id = $1`,
          [note.id]
        );
        note.tags = tagsResult.rows;
      } else {
        note.tags = [];
      }

      return { note };
    } catch (error) {
      fastify.log.error('Erreur création note:', error);
      return reply.status(500).send({ error: 'Erreur lors de la création de la note' });
    }
  });

  // PATCH /api/notes/:id - Modifier une note
  fastify.patch('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { id } = request.params;
    const { title, content, color, is_pinned, project_id, task_id } = request.body;

    // Vérifier ownership (ou permission edit si partagée)
    const ownershipResult = await query(
      `SELECT n.*, ns.permission
       FROM notes n
       LEFT JOIN note_shares ns ON n.id = ns.note_id AND ns.shared_with_user_id = $2
       WHERE n.id = $1 AND (n.user_id = $2 OR ns.permission = 'edit')`,
      [id, userId]
    );

    if (ownershipResult.rows.length === 0) {
      return reply.status(403).send({ error: 'Vous n\'avez pas la permission de modifier cette note' });
    }

    // Construire UPDATE dynamique
    const updates = [];
    const params = [id];
    let paramIndex = 2;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      params.push(title.trim());
    }
    if (content !== undefined) {
      updates.push(`content = $${paramIndex++}`);
      params.push(content);
    }
    if (color !== undefined) {
      updates.push(`color = $${paramIndex++}`);
      params.push(color);
    }
    if (is_pinned !== undefined) {
      updates.push(`is_pinned = $${paramIndex++}`);
      params.push(is_pinned);
    }
    if (project_id !== undefined) {
      updates.push(`project_id = $${paramIndex++}`);
      params.push(project_id);
    }
    if (task_id !== undefined) {
      updates.push(`task_id = $${paramIndex++}`);
      params.push(task_id);
    }

    if (updates.length === 0) {
      return reply.status(400).send({ error: 'Aucun champ à modifier' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    const result = await query(
      `UPDATE notes SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );

    // Récupérer tags
    const tagsResult = await query(
      `SELECT t.* FROM tags t
       JOIN note_tags nt ON t.id = nt.tag_id
       WHERE nt.note_id = $1`,
      [id]
    );
    const note = result.rows[0];
    note.tags = tagsResult.rows;

    return { note };
  });

  // DELETE /api/notes/:id - Supprimer une note (hard delete)
  fastify.delete('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { id } = request.params;

    // Vérifier ownership (seul le owner peut supprimer)
    const result = await query(
      'DELETE FROM notes WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return reply.status(403).send({ error: 'Note non trouvée ou vous n\'êtes pas autorisé à la supprimer' });
    }

    return { success: true };
  });

  // ==========================================
  // TAGS CRUD
  // ==========================================

  // GET /api/notes/tags/list - Liste des tags avec compteur
  fastify.get('/tags/list', { preHandler: [fastify.authenticate] }, async (request) => {
    const { userId } = request.user;

    const result = await query(
      `SELECT
        t.*,
        COUNT(nt.note_id) as note_count
      FROM tags t
      LEFT JOIN note_tags nt ON t.id = nt.tag_id
      WHERE t.user_id = $1
      GROUP BY t.id
      ORDER BY note_count DESC, t.name ASC`,
      [userId]
    );

    return { tags: result.rows };
  });

  // POST /api/notes/tags - Créer un nouveau tag
  fastify.post('/tags', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { name, color } = request.body;

    if (!name || name.trim() === '') {
      return reply.status(400).send({ error: 'Le nom du tag est requis' });
    }

    try {
      const result = await query(
        `INSERT INTO tags (user_id, name, color)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, name) DO UPDATE SET color = EXCLUDED.color
         RETURNING *`,
        [userId, name.trim().toLowerCase(), color || 'gray']
      );

      return { tag: result.rows[0] };
    } catch (error) {
      fastify.log.error('Erreur création tag:', error);
      return reply.status(500).send({ error: 'Erreur lors de la création du tag' });
    }
  });

  // PATCH /api/notes/tags/:id - Modifier un tag (nom/couleur)
  fastify.patch('/tags/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { id } = request.params;
    const { name, color } = request.body;

    // Construire UPDATE dynamique
    const updates = [];
    const params = [id, userId];
    let paramIndex = 3;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(name.trim().toLowerCase());
    }
    if (color !== undefined) {
      updates.push(`color = $${paramIndex++}`);
      params.push(color);
    }

    if (updates.length === 0) {
      return reply.status(400).send({ error: 'Aucun champ à modifier' });
    }

    try {
      const result = await query(
        `UPDATE tags SET ${updates.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING *`,
        params
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({ error: 'Tag non trouvé' });
      }

      return { tag: result.rows[0] };
    } catch (error) {
      fastify.log.error('Erreur modification tag:', error);
      return reply.status(500).send({ error: 'Erreur lors de la modification du tag' });
    }
  });

  // DELETE /api/notes/tags/:id - Supprimer un tag
  fastify.delete('/tags/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { id } = request.params;

    const result = await query(
      'DELETE FROM tags WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Tag non trouvé' });
    }

    return { success: true };
  });

  // ==========================================
  // NOTE-TAGS ASSOCIATION
  // ==========================================

  // POST /api/notes/:id/tags - Ajouter un tag à une note
  fastify.post('/:id/tags', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { id } = request.params;
    const { tag_id } = request.body;

    // Vérifier ownership de la note
    const noteCheck = await query(
      'SELECT id FROM notes WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (noteCheck.rows.length === 0) {
      return reply.status(403).send({ error: 'Note non trouvée' });
    }

    // Vérifier ownership du tag
    const tagCheck = await query(
      'SELECT id FROM tags WHERE id = $1 AND user_id = $2',
      [tag_id, userId]
    );

    if (tagCheck.rows.length === 0) {
      return reply.status(404).send({ error: 'Tag non trouvé' });
    }

    try {
      await query(
        'INSERT INTO note_tags (note_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [id, tag_id]
      );

      return { success: true };
    } catch (error) {
      fastify.log.error('Erreur ajout tag:', error);
      return reply.status(500).send({ error: 'Erreur lors de l\'ajout du tag' });
    }
  });

  // DELETE /api/notes/:id/tags/:tag_id - Retirer un tag d'une note
  fastify.delete('/:id/tags/:tag_id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { id, tag_id } = request.params;

    // Vérifier ownership de la note
    const noteCheck = await query(
      'SELECT id FROM notes WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (noteCheck.rows.length === 0) {
      return reply.status(403).send({ error: 'Note non trouvée' });
    }

    await query(
      'DELETE FROM note_tags WHERE note_id = $1 AND tag_id = $2',
      [id, tag_id]
    );

    return { success: true };
  });

  // ==========================================
  // FULL-TEXT SEARCH
  // ==========================================

  // GET /api/notes/search - Recherche FTS avec ranking
  fastify.get('/search', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { q, limit = 50 } = request.query;

    if (!q || q.trim() === '') {
      return reply.status(400).send({ error: 'Le paramètre "q" est requis' });
    }

    const result = await query(
      `SELECT
        n.*,
        ts_rank(n.content_search, plainto_tsquery('french', $2)) as rank,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('id', t.id, 'name', t.name, 'color', t.color)
            ORDER BY jsonb_build_object('id', t.id, 'name', t.name, 'color', t.color)
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'::json
        ) as tags
      FROM notes n
      LEFT JOIN note_tags nt ON n.id = nt.note_id
      LEFT JOIN tags t ON nt.tag_id = t.id
      WHERE n.user_id = $1
        AND n.archived_at IS NULL
        AND n.content_search @@ plainto_tsquery('french', $2)
      GROUP BY n.id, rank
      ORDER BY rank DESC, n.created_at DESC
      LIMIT $3`,
      [userId, q.trim(), parseInt(limit)]
    );

    return { notes: result.rows };
  });

  // ==========================================
  // NOTE SHARING
  // ==========================================

  // POST /api/notes/:id/share - Partager une note avec un utilisateur
  fastify.post('/:id/share', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { id } = request.params;
    const { targetUserId, permission } = request.body;

    if (!targetUserId || !permission) {
      return reply.status(400).send({ error: 'targetUserId et permission sont requis' });
    }

    if (!['view', 'edit'].includes(permission)) {
      return reply.status(400).send({ error: 'Permission doit être "view" ou "edit"' });
    }

    // Vérifier ownership
    const noteCheck = await query(
      'SELECT id FROM notes WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (noteCheck.rows.length === 0) {
      return reply.status(403).send({ error: 'Note non trouvée ou vous n\'êtes pas le propriétaire' });
    }

    try {
      await query(
        `INSERT INTO note_shares (note_id, shared_with_user_id, shared_by_user_id, permission)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (note_id, shared_with_user_id)
         DO UPDATE SET permission = EXCLUDED.permission`,
        [id, targetUserId, userId, permission]
      );

      return { success: true };
    } catch (error) {
      fastify.log.error('Erreur partage note:', error);
      return reply.status(500).send({ error: 'Erreur lors du partage de la note' });
    }
  });

  // GET /api/notes/:id/shares - Liste des partages d'une note
  fastify.get('/:id/shares', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { id } = request.params;

    // Vérifier ownership
    const noteCheck = await query(
      'SELECT id FROM notes WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (noteCheck.rows.length === 0) {
      return reply.status(403).send({ error: 'Note non trouvée' });
    }

    const result = await query(
      `SELECT
        ns.*,
        u.name as user_name,
        u.email as user_email
      FROM note_shares ns
      JOIN users u ON ns.shared_with_user_id = u.id
      WHERE ns.note_id = $1
      ORDER BY ns.created_at DESC`,
      [id]
    );

    return { shares: result.rows };
  });

  // DELETE /api/notes/:id/share/:targetUserId - Révoquer un partage
  fastify.delete('/:id/share/:targetUserId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { id, targetUserId } = request.params;

    // Vérifier ownership
    const noteCheck = await query(
      'SELECT id FROM notes WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (noteCheck.rows.length === 0) {
      return reply.status(403).send({ error: 'Note non trouvée' });
    }

    await query(
      'DELETE FROM note_shares WHERE note_id = $1 AND shared_with_user_id = $2',
      [id, targetUserId]
    );

    return { success: true };
  });
}
