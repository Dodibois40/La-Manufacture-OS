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
      // Get dynamic dates
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      // Get day names for context
      const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
      const todayName = dayNames[today.getDay()];

      const prompt = `Tu es un parser intelligent de tâches. REFORMULE le texte en tâches claires et concises.

RÈGLES IMPORTANTES :
1. REFORMULE toujours le texte - ne copie JAMAIS mot pour mot
2. Extrait l'ACTION principale (ex: "Finir les étagères du corps")
3. Détecte le OWNER : "pour X", "@X", "X doit", "X:" → owner = "X"
4. Détecte l'URGENCE : "urgent", "absolument", "impératif", "asap" → urgent = true
5. Détecte la DATE :
   - "aujourd'hui", "ce jour" → ${todayStr}
   - "demain" → ${tomorrowStr}
   - Nom de jour (ex: "lundi") → calcule la prochaine occurrence
   - Sans mention de date → ${todayStr}

Aujourd'hui : ${todayName} ${todayStr}

TEXTE À PARSER :
"${text}"

RÉPONDS UNIQUEMENT avec un JSON array valide :
[{"text":"Tâche reformulée courte et claire", "urgent":true/false, "date":"YYYY-MM-DD", "owner":"Nom" ou null}]`;

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

  // Detect if text is an event/RDV (for Google Calendar sync)
  fastify.post('/detect-event', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { text, date } = request.body;

    if (!text) {
      return reply.status(400).send({ error: 'Missing text' });
    }

    try {
      const prompt = `Tu analyses si un texte est un RDV/evenement ou une tache simple.

RDV = quelque chose avec une heure precise (reunion, rdv, dejeuner, deplacement, appel programme, rendez-vous)
Tache = action sans heure precise (appeler, faire, envoyer, preparer, finir)

Exemples RDV:
- "RDV dentiste 15h" → RDV, 15:00-16:00
- "Dejeuner avec Marc 12h30" → RDV, 12:30-14:00
- "Deplacement Paris 9h-18h" → RDV, 09:00-18:00
- "Reunion equipe 14h salle B" → RDV, 14:00-15:00, lieu: "salle B"
- "Appel client 10h" → RDV, 10:00-10:30
- "Visite chantier 8h30" → RDV, 08:30-10:00

Exemples Taches (PAS des RDV):
- "Appeler le client" → Tache (pas d'heure)
- "Preparer presentation" → Tache
- "Envoyer devis Dupont" → Tache
- "Faire les courses" → Tache

TEXTE: "${text}"

Si c'est un RDV, extrais:
- title: titre court et clair
- startTime: heure debut "HH:MM"
- endTime: heure fin "HH:MM" (si non precise: +1h pour rdv, +30min pour appel, +2h pour deplacement/repas)
- location: lieu si mentionne, sinon null

Reponds UNIQUEMENT en JSON:
{"isEvent":true/false,"title":"...","startTime":"HH:MM","endTime":"HH:MM","location":"..." ou null}`;

      const message = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const responseText = message.content[0].text;

      // Parse JSON response
      let result;
      try {
        // Extract JSON from response (in case there's extra text)
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found');
        }
      } catch (parseError) {
        fastify.log.error('Event detection JSON parse failed:', parseError);
        // Default to not an event
        result = { isEvent: false };
      }

      // Log AI interaction
      await query(
        'INSERT INTO ai_interactions (user_id, type, prompt, response, tokens_used) VALUES ($1, $2, $3, $4, $5)',
        [userId, 'detect_event', prompt, responseText, message.usage.output_tokens]
      );

      return result;
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Event detection failed' });
    }
  });

  // ============================================================
  // INBOX UNIVERSELLE - IA Processing (CŒUR DU SYSTÈME)
  // ============================================================
  // Analyse texte avec Claude Sonnet 4.5 et crée automatiquement :
  // - Tasks → table tasks
  // - Events → table tasks (is_event=true)
  // - Notes → table notes + auto-create tags
  fastify.post('/process-inbox', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;
    const { text } = request.body;
    const startTime = Date.now();

    if (!text || text.trim().length === 0) {
      return reply.status(400).send({ error: 'Missing text' });
    }

    try {
      // ===== 1. CONTEXTE DYNAMIQUE =====

      // Date actuelle
      const now = new Date();
      const currentDate = now.toISOString().split('T')[0];
      const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
      const currentDayName = dayNames[now.getDay()];
      const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);

      // Projets actifs
      const projectsResult = await query(
        "SELECT id, name FROM projects WHERE user_id = $1 AND status != 'archived' ORDER BY name",
        [userId]
      );
      const activeProjects = projectsResult.rows.map(p => p.name);

      // Tags existants
      const tagsResult = await query(
        'SELECT name FROM tags WHERE user_id = $1 ORDER BY name',
        [userId]
      );
      const existingTags = tagsResult.rows.map(t => t.name);

      // Membres d'équipe
      const membersResult = await query(
        'SELECT name FROM team_members WHERE user_id = $1 AND active = TRUE ORDER BY name',
        [userId]
      );
      const teamMembers = membersResult.rows.map(m => m.name);

      // ===== 2. SYSTEM PROMPT (Version Production - Exhaustive) =====

      const systemPrompt = `Tu es un assistant expert en productivité GTD (Getting Things Done) et méthode Second Brain. Tu analyses les entrées d'une inbox universelle et catégorises chaque élément avec une précision maximale.

═══════════════════════════════════════════════════════
RÈGLES DE CLASSIFICATION (par ordre de priorité)
═══════════════════════════════════════════════════════

1. EVENT (Événement/RDV) - Priorité HAUTE
   ✓ Conditions STRICTES (toutes requises) :
     - Heure EXPLICITE mentionnée : "14h", "10h30", "à 9h", "demain 15h"
     - OU mot-clé temporel : "rendez-vous", "RDV", "réunion", "meeting", "appel prévu"
   ✓ Exemples positifs :
     - "Appeler Marie demain 14h" → EVENT
     - "RDV dentiste jeudi" → EVENT (même sans heure, RDV = event)
     - "Réunion budget lundi 10h" → EVENT
   ✗ Contre-exemples :
     - "Appeler Marie demain" → TASK (pas d'heure = tâche)
     - "Préparer réunion" → TASK (préparation = action, pas l'event lui-même)

2. NOTE (Information/Connaissance)
   ✓ Conditions :
     - Commence par : "Note:", "Idée:", "Remarque:", "À retenir:", "!"
     - OU contient information factuelle sans action : "Paul préfère X", "Budget alloué: Y"
     - OU citation, lien, référence : "https://...", "Voir article sur X"
     - OU observation : "Le client a dit que..."
   ✓ Exemples positifs :
     - "Idée: utiliser React pour le dashboard" → NOTE
     - "Paul préfère les réunions le matin" → NOTE
     - "Budget 2026: 50k€ alloués au marketing" → NOTE
   ✗ Contre-exemples :
     - "Vérifier le budget" → TASK (action = verbe)
     - "Demander à Paul ses préférences" → TASK (demander = action)

3. TASK (Tâche/Action)
   ✓ Par défaut si pas EVENT ni NOTE
   ✓ Verbe d'action : appeler, envoyer, préparer, finaliser, vérifier, contacter, acheter, réserver
   ✓ Action implicite : "Marie pour discuter budget" (implicite: contacter Marie)

═══════════════════════════════════════════════════════
SÉPARATION MULTI-ITEMS (CRITIQUE)
═══════════════════════════════════════════════════════

Délimiteurs : " + ", " et " (items indépendants), " puis ", " aussi ", nouvelle ligne, numérotation

Exemples :
• "Appeler Marie 14h + Noter: budget OK" → 2 items (EVENT + NOTE)
• "RDV client lundi 10h, préparer présentation et envoyer facture" → 3 items (EVENT + 2 TASKS)

═══════════════════════════════════════════════════════
EXTRACTION DE DATES & HEURES
═══════════════════════════════════════════════════════

Dates relatives (base: ${currentDate} = ${currentDayName}) :
- "aujourd'hui" → ${currentDate}
- "demain" → ${currentDate} + 1 jour
- "lundi", "mardi" → prochain jour de la semaine
- "lundi prochain" → semaine suivante
- "dans X jours/semaines/mois"

Heures :
- "14h", "14h30", "9h" → formats standards
- "matin" → 09:00, "midi" → 12:00, "après-midi" → 14:00, "soir" → 18:00

Durée par défaut : RDV/Réunion = 30min, Appel = 15min

═══════════════════════════════════════════════════════
EXTRACTION ENTITÉS & MÉTADONNÉES
═══════════════════════════════════════════════════════

1. PERSONNES : Noms propres, rôles → metadata.people: ["Marie", "Paul"]
2. LIEUX : Adresses, lieux → location (events uniquement)
3. PROJETS : Match FUZZY dans ${JSON.stringify(activeProjects)} → project: "nom exact"
4. SUJETS : Thème principal → metadata.topic

═══════════════════════════════════════════════════════
URGENCE & PRIORITÉ
═══════════════════════════════════════════════════════

urgent: true SI : "URGENT", "ASAP", "immédiatement", "rapidement", "prioritaire", "!!!", deadline courte
important: true SI : "important", "crucial", "essentiel", "critique", impact business

═══════════════════════════════════════════════════════
TAGS AUTOMATIQUES (Max 5 tags, pertinents)
═══════════════════════════════════════════════════════

Catégories : priorité (urgent, important), type (idée, question), domaine (technique, marketing, finance), contexte (réunion, appel), technologies (react, postgresql, api)

Utiliser tags existants si dans ${JSON.stringify(existingTags)}, sinon créer nouveaux (minuscules, sans accents)

═══════════════════════════════════════════════════════
COULEURS NOTES
═══════════════════════════════════════════════════════

blue: technique/dev | green: idée/créativité | yellow: warning/attention | orange: urgent | red: critique | purple: stratégie | null: neutre

═══════════════════════════════════════════════════════
STRUCTURATION DU CONTENU (NOTES) - ÉVITER LE CHARABIA
═══════════════════════════════════════════════════════

**Objectif** : Notes PROPRES, STRUCTURÉES, FACILES À RELIRE. Pas de charabia, pas de duplication titre/contenu.

**Règle #1 - Titre pertinent** :
- Extraire le CONCEPT PRINCIPAL, pas juste "Idée" ou "Note"
- 3-8 mots maximum, descriptif
- ✓ Exemples bons : "Stack technique dashboard client", "Processus onboarding utilisateurs", "Optimisation cache Redis"
- ✗ Exemples mauvais : "Idée", "Note importante", "Chose à retenir"

**Règle #2 - Contenu structuré** :

A) **CONCEPT UNIQUE** (1 seule idée claire) :
   → Paragraphe cohérent, pas de bullet points

B) **CONCEPTS MULTIPLES** (plusieurs idées liées) :
   → Bullet points (•) pour clarté

C) **OBSERVATION FACTUELLE** :
   → Phrase claire, contexte si nécessaire

**Règle #3 - Éviter duplication** :
- Ne PAS répéter le titre dans le contenu
- Le contenu DÉVELOPPE le titre, ne le redit pas

**Règle #4 - Formatting** :
- Bullet points : Commencer par "• " (bullet Unicode + espace)
- Pas de numérotation (1., 2., 3.) → utiliser bullets
- Sauts de ligne : "\\n" entre bullets ou paragraphes
- Capitalisation : Première lettre en majuscule

**Règle #5 - Longueur** :
- Titre : 3-8 mots
- Contenu : 1-5 phrases (ou 2-5 bullets)
- Si trop long (>500 chars) : séparer en plusieurs notes

═══════════════════════════════════════════════════════
FORMAT JSON (STRICT)
═══════════════════════════════════════════════════════

{
  "items": [{
    "type": "task"|"event"|"note",
    "text": "Texte nettoyé",
    "title": "Titre court" | null,
    "content": "Contenu détaillé" | null,
    "date": "YYYY-MM-DD" | null,
    "start_time": "HH:MM" | null,
    "end_time": "HH:MM" | null,
    "location": "Lieu" | null,
    "project": "Nom projet exact" | null,
    "urgent": true|false,
    "important": true|false,
    "tags": ["tag1", "tag2"],
    "color": "blue"|"green"|"yellow"|"orange"|"red"|"purple"|null,
    "metadata": {
      "people": ["Marie"],
      "topic": "budget",
      "duration_minutes": 30,
      "original_text": "texte brut exact",
      "confidence": 0.95
    }
  }]
}

Règles : Tous champs présents (null si non applicable), dates ISO, heures 24h, échapper quotes, metadata.confidence (0-1)

═══════════════════════════════════════════════════════
GESTION AMBIGUÏTÉS
═══════════════════════════════════════════════════════

Si doute : Heure mentionnée ? → EVENT | Verbe action ? → TASK | Info factuelle ? → NOTE | Vraiment ambigu ? → TASK (safe)

Toujours inclure metadata.confidence : 1.0 = certain, 0.8-0.9 = très probable, 0.5-0.7 = probable, <0.5 = incertain

Objectif : ZÉRO ERREUR, MAXIMUM D'INTELLIGENCE.`;

      // ===== 3. USER PROMPT (avec contexte enrichi) =====

      const userPrompt = `Analyse cette entrée inbox et catégorise-la avec précision maximale :

═══════════════════════════════════════════════════════
TEXTE À ANALYSER
═══════════════════════════════════════════════════════

"""
${text}
"""

═══════════════════════════════════════════════════════
CONTEXTE UTILISATEUR
═══════════════════════════════════════════════════════

📅 Date actuelle : ${currentDate} (${currentDayName})
🕐 Heure actuelle : ${currentTime}

📁 Projets actifs (pour matching) :
${activeProjects.length > 0 ? activeProjects.join(', ') : 'Aucun projet'}

🏷️ Tags existants (priorité sur nouveaux) :
${existingTags.length > 0 ? existingTags.join(', ') : 'Aucun tag'}

👤 Membres d'équipe (pour extraction personnes) :
${teamMembers.length > 0 ? teamMembers.join(', ') : 'Aucun membre'}

═══════════════════════════════════════════════════════
FORMAT RÉPONSE
═══════════════════════════════════════════════════════

Réponds UNIQUEMENT avec JSON valide (pas de texte avant/après) : { "items": [...] }`;

      // ===== 4. APPEL CLAUDE API =====

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: userPrompt
        }]
      });

      const responseText = message.content[0].text;

      // ===== 5. PARSE RÉPONSE JSON =====

      let aiResponse;
      try {
        // Extract JSON from response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in response');
        }
        aiResponse = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        fastify.log.error('AI response JSON parse failed:', parseError);
        fastify.log.error('Raw response:', responseText);

        // Fallback: créer une task simple
        aiResponse = {
          items: [{
            type: 'task',
            text: text,
            title: null,
            content: null,
            date: currentDate,
            start_time: null,
            end_time: null,
            location: null,
            project: null,
            urgent: false,
            important: false,
            tags: [],
            color: null,
            metadata: {
              original_text: text,
              confidence: 0.5
            }
          }]
        };
      }

      // ===== 6. CRÉATION ITEMS EN BDD =====

      const itemsCreated = [];
      const items = aiResponse.items || [];

      for (const item of items) {
        try {
          if (item.type === 'task' || item.type === 'event') {
            // ===== CRÉATION TASK/EVENT =====

            const taskResult = await query(
              `INSERT INTO tasks (user_id, text, date, urgent, owner, is_event, start_time, end_time, location, done)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
               RETURNING *`,
              [
                userId,
                item.text,
                item.date || currentDate,
                item.urgent || false,
                item.metadata?.people?.[0] || 'Moi',
                item.type === 'event',
                item.start_time || null,
                item.end_time || null,
                item.location || null,
                false
              ]
            );

            const createdTask = taskResult.rows[0];

            // Auto-matching projet
            if (item.project) {
              const projectMatch = await query(
                'SELECT id FROM projects WHERE user_id = $1 AND name ILIKE $2 LIMIT 1',
                [userId, item.project]
              );

              if (projectMatch.rows.length > 0) {
                await query(
                  'UPDATE tasks SET project_id = $1 WHERE id = $2',
                  [projectMatch.rows[0].id, createdTask.id]
                );
                createdTask.project_id = projectMatch.rows[0].id;
              }
            }

            itemsCreated.push({
              type: item.type,
              id: createdTask.id,
              text: createdTask.text,
              date: createdTask.date
            });

          } else if (item.type === 'note') {
            // ===== CRÉATION NOTE =====

            const noteResult = await query(
              `INSERT INTO notes (user_id, title, content, color, is_pinned)
               VALUES ($1, $2, $3, $4, $5)
               RETURNING *`,
              [
                userId,
                item.title || 'Note',
                item.content || '',
                item.color || null,
                false
              ]
            );

            const createdNote = noteResult.rows[0];

            // Auto-création tags
            if (item.tags && item.tags.length > 0) {
              for (const tagName of item.tags) {
                // Créer tag si n'existe pas
                const tagResult = await query(
                  `INSERT INTO tags (user_id, name, color)
                   VALUES ($1, $2, $3)
                   ON CONFLICT (user_id, name) DO UPDATE SET color = EXCLUDED.color
                   RETURNING *`,
                  [userId, tagName.toLowerCase(), 'gray']
                );

                const tag = tagResult.rows[0];

                // Lier tag à note
                await query(
                  'INSERT INTO note_tags (note_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                  [createdNote.id, tag.id]
                );
              }
            }

            // Auto-matching projet
            if (item.project) {
              const projectMatch = await query(
                'SELECT id FROM projects WHERE user_id = $1 AND name ILIKE $2 LIMIT 1',
                [userId, item.project]
              );

              if (projectMatch.rows.length > 0) {
                await query(
                  'UPDATE notes SET project_id = $1 WHERE id = $2',
                  [projectMatch.rows[0].id, createdNote.id]
                );
                createdNote.project_id = projectMatch.rows[0].id;
              }
            }

            itemsCreated.push({
              type: 'note',
              id: createdNote.id,
              title: createdNote.title,
              tags: item.tags || []
            });
          }
        } catch (itemError) {
          fastify.log.error('Error creating item:', itemError);
          // Continue avec les autres items
        }
      }

      // ===== 7. TRACKING POUR AMÉLIORATION CONTINUE =====

      const processingTime = Date.now() - startTime;
      const confidenceAvg = items.reduce((sum, i) => sum + (i.metadata?.confidence || 0.5), 0) / items.length;

      await query(
        `INSERT INTO ai_inbox_decisions (user_id, input_text, ai_response, items_created, confidence_avg, processing_time_ms)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userId,
          text,
          JSON.stringify(aiResponse),
          JSON.stringify(itemsCreated),
          confidenceAvg,
          processingTime
        ]
      );

      // ===== 8. RETOUR RÉSULTAT =====

      return {
        success: true,
        items: itemsCreated,
        stats: {
          total: itemsCreated.length,
          tasks: itemsCreated.filter(i => i.type === 'task').length,
          events: itemsCreated.filter(i => i.type === 'event').length,
          notes: itemsCreated.filter(i => i.type === 'note').length
        },
        processing_time_ms: processingTime
      };

    } catch (error) {
      fastify.log.error('Process inbox error:', error);
      return reply.status(500).send({
        error: 'Inbox processing failed',
        details: error.message
      });
    }
  });
}
