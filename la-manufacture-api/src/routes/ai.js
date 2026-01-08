import Anthropic from '@anthropic-ai/sdk';
import { query } from '../db/connection.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export default async function aiRoutes(fastify) {
  // Focus Mode - AI decides next task
  fastify.post('/focus-mode', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;

    try {
      // Get today's open tasks
      const today = new Date().toISOString().split('T')[0];
      const tasksResult = await query(
        'SELECT * FROM tasks WHERE user_id = $1 AND date = $2 AND done = FALSE ORDER BY urgent DESC',
        [userId, today]
      );

      const tasks = tasksResult.rows;

      if (tasks.length === 0) {
        return { message: 'Aucune tâche pour aujourd\'hui ! 🎉', task: null };
      }

      // Prepare prompt for Claude
      const prompt = `Tu es un assistant de productivité. Voici les tâches d'aujourd'hui :

${tasks.map((t, i) => `${i + 1}. ${t.text} ${t.urgent ? '(URGENT)' : ''} - ${t.owner}`).join('\n')}

Quelle est LA tâche la plus importante à faire maintenant ? Réponds avec :
1. Le numéro de la tâche
2. Une phrase de motivation courte (max 15 mots) pour convaincre l'utilisateur de la faire MAINTENANT

Format : "[Numéro] | [Motivation]"`;

      const message = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const responseText = message.content[0].text;
      const [taskNumber, motivation] = responseText.split('|').map(s => s.trim());

      const selectedTask = tasks[parseInt(taskNumber) - 1] || tasks[0];

      // Log AI interaction
      await query(
        'INSERT INTO ai_interactions (user_id, type, prompt, response, tokens_used) VALUES ($1, $2, $3, $4, $5)',
        [userId, 'focus_mode', prompt, responseText, message.usage.output_tokens]
      );

      return {
        task: selectedTask,
        motivation: motivation || 'Fais ça maintenant !',
        allTasks: tasks.length
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Focus mode failed' });
    }
  });

  // AI Coach - Morning briefing
  fastify.get('/coach/morning', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;

    try {
      const today = new Date().toISOString().split('T')[0];

      // Get today's tasks
      const todayTasks = await query(
        'SELECT * FROM tasks WHERE user_id = $1 AND date = $2 ORDER BY urgent DESC',
        [userId, today]
      );

      // Get late tasks
      const lateTasks = await query(
        'SELECT * FROM tasks WHERE user_id = $1 AND date < $2 AND done = FALSE',
        [userId, today]
      );

      const prompt = `Tu es un coach de productivité bienveillant. Prépare un briefing du matin.

Tâches du jour (${todayTasks.rows.length}) :
${todayTasks.rows.map(t => `- ${t.text} ${t.urgent ? '(URGENT)' : ''}`).join('\n')}

Tâches en retard (${lateTasks.rows.length}) :
${lateTasks.rows.map(t => `- ${t.text} (depuis ${t.date})`).join('\n')}

Donne un briefing motivant en 3-4 phrases courtes :
1. Constat positif ou neutre
2. Priorité du jour
3. Conseil tactique
4. Motivation finale

Ton: direct, pro, encourageant. Max 100 mots.`;

      const message = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const briefing = message.content[0].text;

      // Log AI interaction
      await query(
        'INSERT INTO ai_interactions (user_id, type, prompt, response, tokens_used) VALUES ($1, $2, $3, $4, $5)',
        [userId, 'coach', prompt, briefing, message.usage.output_tokens]
      );

      return {
        briefing,
        stats: {
          today: todayTasks.rows.length,
          late: lateTasks.rows.length,
          urgent: todayTasks.rows.filter(t => t.urgent).length
        }
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Coach briefing failed' });
    }
  });

  // Parse text dump into tasks
  fastify.post('/parse-dump', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { text } = request.body;

    if (!text) {
      return reply.status(400).send({ error: 'Missing text' });
    }

    try {
      const prompt = `Tu es un assistant de parsing de tâches. L'utilisateur a tapé rapidement ses tâches.
Extrait chaque tâche avec :
- text: le texte de la tâche
- urgent: true/false
- date: YYYY-MM-DD (aujourd'hui par défaut, ou si mention de "demain", "lundi", etc.)
- owner: nom si mentionné (format "Nom: tâche"), sinon null

Texte brut :
${text}

Réponds UNIQUEMENT avec un JSON array, rien d'autre :
[{"text":"...", "urgent":false, "date":"2026-01-06", "owner":null}, ...]`;

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const responseText = message.content[0].text;

      // Safe JSON parse
      let tasks;
      try {
        tasks = JSON.parse(responseText);
      } catch (parseError) {
        fastify.log.error('AI response JSON parse failed:', parseError);
        fastify.log.error('Raw response:', responseText);
        return reply.status(500).send({ error: 'AI response parsing failed' });
      }

      // Log AI interaction
      await query(
        'INSERT INTO ai_interactions (user_id, type, prompt, response, tokens_used) VALUES ($1, $2, $3, $4, $5)',
        [userId, 'parser', prompt, responseText, message.usage.output_tokens]
      );

      return { tasks };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Parse failed' });
    }
  });
}
