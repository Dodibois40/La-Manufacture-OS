import { query } from '../db/connection.js';

export default async function notesRoutes(fastify) {
  // ==========================================
  // NOTES CRUD
  // ==========================================

  // GET /api/notes - Liste des notes de l'utilisateur (avec filtres)
  fastify.get('/', { preHandler: [fastify.authenticate] }, async request => {
    const { userId } = request.user;
    const { q, project_id, task_id, is_pinned, archived, limit = 50, offset = 0 } = request.query;

    let sql = `SELECT * FROM notes WHERE user_id = $1`;
    const params = [userId];
    let paramIndex = 2;

    // Filtre: notes archivées ou non
    if (archived === 'true') {
      sql += ` AND archived_at IS NOT NULL`;
    } else {
      sql += ` AND archived_at IS NULL`;
    }

    // Filtre: recherche texte (simple LIKE pour MVP, FTS via /search)
    if (q) {
      sql += ` AND (title ILIKE $${paramIndex} OR content ILIKE $${paramIndex})`;
      params.push(`%${q}%`);
      paramIndex++;
    }

    // Filtre: projet
    if (project_id) {
      sql += ` AND project_id = $${paramIndex++}`;
      params.push(project_id);
    }

    // Filtre: tâche
    if (task_id) {
      sql += ` AND task_id = $${paramIndex++}`;
      params.push(task_id);
    }

    // Filtre: épinglées
    if (is_pinned === 'true') {
      sql += ` AND is_pinned = TRUE`;
    }

    sql += ` ORDER BY is_pinned DESC, created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(sql, params);

    return { notes: result.rows };
  });

  // GET /api/notes/search - Recherche FTS avec ranking
  // IMPORTANT: Doit être AVANT /:id pour ne pas être capturé comme un ID
  fastify.get('/search', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { q, limit = 50 } = request.query;

    if (!q || q.trim() === '') {
      return reply.status(400).send({ error: 'Le paramètre "q" est requis' });
    }

    const result = await query(
      `SELECT *, ts_rank(content_search, plainto_tsquery('french', $2)) as rank
       FROM notes
       WHERE user_id = $1
         AND archived_at IS NULL
         AND content_search @@ plainto_tsquery('french', $2)
       ORDER BY rank DESC, created_at DESC
       LIMIT $3`,
      [userId, q.trim(), parseInt(limit)]
    );

    return { notes: result.rows };
  });

  // GET /api/notes/:id - Détails d'une note
  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { id } = request.params;

    const result = await query(`SELECT * FROM notes WHERE id = $1 AND user_id = $2`, [id, userId]);

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Note non trouvée' });
    }

    return { note: result.rows[0] };
  });

  // POST /api/notes - Créer une nouvelle note
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { title, content, color, is_pinned, project_id, task_id } = request.body;

    // Validation
    if (!title || title.trim() === '') {
      return reply.status(400).send({ error: 'Le titre est requis' });
    }

    try {
      const result = await query(
        `INSERT INTO notes (user_id, title, content, color, is_pinned, project_id, task_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          userId,
          title.trim(),
          content || '',
          color || null,
          is_pinned || false,
          project_id || null,
          task_id || null,
        ]
      );

      return { note: result.rows[0] };
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
      return reply
        .status(403)
        .send({ error: "Vous n'avez pas la permission de modifier cette note" });
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

    return { note: result.rows[0] };
  });

  // DELETE /api/notes/:id - Supprimer une note (hard delete)
  fastify.delete('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { id } = request.params;

    // Vérifier ownership (seul le owner peut supprimer)
    const result = await query('DELETE FROM notes WHERE id = $1 AND user_id = $2 RETURNING id', [
      id,
      userId,
    ]);

    if (result.rows.length === 0) {
      return reply
        .status(403)
        .send({ error: "Note non trouvée ou vous n'êtes pas autorisé à la supprimer" });
    }

    return { success: true };
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
    const noteCheck = await query('SELECT id FROM notes WHERE id = $1 AND user_id = $2', [
      id,
      userId,
    ]);

    if (noteCheck.rows.length === 0) {
      return reply
        .status(403)
        .send({ error: "Note non trouvée ou vous n'êtes pas le propriétaire" });
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
    const noteCheck = await query('SELECT id FROM notes WHERE id = $1 AND user_id = $2', [
      id,
      userId,
    ]);

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
  fastify.delete(
    '/:id/share/:targetUserId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;
      const { id, targetUserId } = request.params;

      // Vérifier ownership
      const noteCheck = await query('SELECT id FROM notes WHERE id = $1 AND user_id = $2', [
        id,
        userId,
      ]);

      if (noteCheck.rows.length === 0) {
        return reply.status(403).send({ error: 'Note non trouvée' });
      }

      await query('DELETE FROM note_shares WHERE note_id = $1 AND shared_with_user_id = $2', [
        id,
        targetUserId,
      ]);

      return { success: true };
    }
  );
}
