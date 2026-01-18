import { query } from '../db/connection.js';
import { randomUUID } from 'crypto';
import { createWriteStream, createReadStream, existsSync, mkdirSync, unlinkSync, statSync } from 'fs';
import { pipeline } from 'stream/promises';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Dossier uploads (relatif a la racine du projet)
const UPLOADS_DIR = join(__dirname, '../../uploads');

// S'assurer que le dossier existe
if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

export default async function teamFilesRoutes(fastify) {
  // ============================================
  // FILE UPLOAD (Manager only)
  // ============================================

  // POST /api/team/files - Upload un fichier
  fastify.post('/files', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;

    const data = await request.file();

    if (!data) {
      return reply.status(400).send({ error: 'Aucun fichier fourni' });
    }

    // Verifier le type de fichier (PDF, images principalement)
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp'
    ];

    if (!allowedMimes.includes(data.mimetype)) {
      return reply.status(400).send({
        error: 'Type de fichier non autorise. Formats acceptes: PDF, JPEG, PNG, GIF, WebP'
      });
    }

    // Limite de taille: 10MB
    const maxSize = 10 * 1024 * 1024;

    // Generer un nom unique pour le fichier
    const ext = extname(data.filename);
    const filename = `${randomUUID()}${ext}`;
    const filepath = join(UPLOADS_DIR, filename);

    try {
      // Sauvegarder le fichier
      await pipeline(data.file, createWriteStream(filepath));

      // Verifier la taille apres upload
      const stats = statSync(filepath);
      if (stats.size > maxSize) {
        unlinkSync(filepath);
        return reply.status(400).send({ error: 'Fichier trop volumineux (max 10MB)' });
      }

      // Recuperer team_member_id depuis les champs du formulaire (si present)
      const teamMemberId = data.fields.team_member_id?.value || null;

      // Verifier que le membre appartient a l'utilisateur (si specifie)
      if (teamMemberId) {
        const memberCheck = await query(
          'SELECT id FROM team_members WHERE id = $1 AND user_id = $2',
          [teamMemberId, userId]
        );
        if (memberCheck.rows.length === 0) {
          unlinkSync(filepath);
          return reply.status(404).send({ error: 'Membre non trouve' });
        }
      }

      // Enregistrer dans la base de donnees
      const result = await query(
        `INSERT INTO team_files (user_id, team_member_id, filename, original_name, mime_type, size)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [userId, teamMemberId, filename, data.filename, data.mimetype, stats.size]
      );

      return { file: result.rows[0] };
    } catch (error) {
      console.error('Error uploading file:', error);
      // Nettoyer le fichier si erreur
      if (existsSync(filepath)) {
        unlinkSync(filepath);
      }
      return reply.status(500).send({ error: 'Erreur lors de l\'upload' });
    }
  });

  // GET /api/team/files - Liste des fichiers (Manager)
  fastify.get('/files', { preHandler: [fastify.authenticate] }, async (request) => {
    const { userId } = request.user;
    const { member_id } = request.query;

    let sql = `
      SELECT f.*, m.name as member_name
      FROM team_files f
      LEFT JOIN team_members m ON f.team_member_id = m.id
      WHERE f.user_id = $1
    `;
    const params = [userId];

    if (member_id === 'global') {
      sql += ' AND f.team_member_id IS NULL';
    } else if (member_id) {
      sql += ' AND f.team_member_id = $2';
      params.push(member_id);
    }

    sql += ' ORDER BY f.created_at DESC';

    const result = await query(sql, params);
    return { files: result.rows };
  });

  // GET /api/team/files/:id/download - Telecharger un fichier
  fastify.get('/files/:id/download', async (request, reply) => {
    const { id } = request.params;

    const result = await query('SELECT * FROM team_files WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Fichier non trouve' });
    }

    const file = result.rows[0];
    const filepath = join(UPLOADS_DIR, file.filename);

    if (!existsSync(filepath)) {
      return reply.status(404).send({ error: 'Fichier physique non trouve' });
    }

    reply.header('Content-Type', file.mime_type);
    reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(file.original_name)}"`);

    return reply.send(createReadStream(filepath));
  });

  // GET /api/team/files/:id/view - Voir un fichier (pour affichage inline)
  fastify.get('/files/:id/view', async (request, reply) => {
    const { id } = request.params;

    const result = await query('SELECT * FROM team_files WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Fichier non trouve' });
    }

    const file = result.rows[0];
    const filepath = join(UPLOADS_DIR, file.filename);

    if (!existsSync(filepath)) {
      return reply.status(404).send({ error: 'Fichier physique non trouve' });
    }

    reply.header('Content-Type', file.mime_type);
    reply.header('Content-Disposition', `inline; filename="${encodeURIComponent(file.original_name)}"`);

    return reply.send(createReadStream(filepath));
  });

  // DELETE /api/team/files/:id - Supprimer un fichier
  fastify.delete('/files/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { id } = request.params;

    const result = await query(
      'DELETE FROM team_files WHERE id = $1 AND user_id = $2 RETURNING filename',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Fichier non trouve' });
    }

    // Supprimer le fichier physique
    const filepath = join(UPLOADS_DIR, result.rows[0].filename);
    if (existsSync(filepath)) {
      unlinkSync(filepath);
    }

    return { success: true };
  });

  // ============================================
  // ATELIER FILES (Public access)
  // ============================================

  // GET /api/team/atelier/:managerId/files - Fichiers pour l'atelier
  fastify.get('/atelier/:managerId/files', async (request, reply) => {
    const { managerId } = request.params;
    const { member_id } = request.query;

    // Verifier que le manager existe
    const managerCheck = await query('SELECT id FROM users WHERE id = $1', [managerId]);
    if (managerCheck.rows.length === 0) {
      return reply.status(404).send({ error: 'Compte non trouve' });
    }

    // Recuperer les fichiers globaux + ceux du membre si specifie
    let sql = `
      SELECT f.id, f.original_name, f.mime_type, f.size, f.created_at,
             CASE WHEN f.team_member_id IS NULL THEN 'global' ELSE 'member' END as scope
      FROM team_files f
      WHERE f.user_id = $1
        AND (f.team_member_id IS NULL`;

    const params = [managerId];

    if (member_id) {
      sql += ` OR f.team_member_id = $2`;
      params.push(member_id);
    }

    sql += `) ORDER BY f.created_at DESC`;

    const result = await query(sql, params);
    return { files: result.rows };
  });
}
