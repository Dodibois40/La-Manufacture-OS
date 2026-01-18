import Anthropic from '@anthropic-ai/sdk';
import { query } from '../db/connection.js';
import { syncEventToGoogleInternal } from './google-calendar.js';
import buildSecondBrainPrompt from '../prompts/second-brain-v2.js';
// QUASAR v5 - Pipeline optimisé 2-stage (Haiku fast + Sonnet enrichment)
import quasar from '../prompts/second-brain-v5-quasar.js';

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
        return { message: "Aucune tâche pour aujourd'hui ! 🎉", task: null };
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
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
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
        allTasks: tasks.length,
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
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
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
          urgent: todayTasks.rows.filter(t => t.urgent).length,
        },
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
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
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
    const { text } = request.body;

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
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
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

      // Dates relatives calculées (IMPORTANT: fournir explicitement à l'IA)
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowDate = tomorrow.toISOString().split('T')[0];
      const tomorrowDayName = dayNames[tomorrow.getDay()];

      const afterTomorrow = new Date(now);
      afterTomorrow.setDate(afterTomorrow.getDate() + 2);
      const afterTomorrowDate = afterTomorrow.toISOString().split('T')[0];

      // Projets actifs
      const projectsResult = await query(
        "SELECT id, name FROM projects WHERE user_id = $1 AND status != 'archived' ORDER BY name",
        [userId]
      );
      const activeProjects = projectsResult.rows.map(p => p.name);

      // Tags existants
      const tagsResult = await query('SELECT name FROM tags WHERE user_id = $1 ORDER BY name', [
        userId,
      ]);
      const existingTags = tagsResult.rows.map(t => t.name);

      // Membres d'équipe
      const membersResult = await query(
        'SELECT name FROM team_members WHERE user_id = $1 AND active = TRUE ORDER BY name',
        [userId]
      );
      const teamMembers = membersResult.rows.map(m => m.name);

      // ===== 2. SYSTEM PROMPT (Version SECOND BRAIN - Intelligence Maximale) =====

      const systemPrompt = `Tu es un SECOND BRAIN - un assistant cognitif de niveau supérieur. Tu ne te contentes pas de parser du texte : tu COMPRENDS, tu ANTICIPES, tu VÉRIFIES, et tu ENRICHIS.

╔═══════════════════════════════════════════════════════════════════════════════╗
║                    🧠 PHILOSOPHIE SECOND BRAIN                                 ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║ 1. CAPTURER : Extraire TOUT ce qui a de la valeur, ne rien perdre             ║
║ 2. ORGANISER : Classifier avec précision chirurgicale                          ║
║ 3. ENRICHIR : Ajouter contexte, liens, métadonnées utiles                     ║
║ 4. ANTICIPER : Suggérer ce qui manque, prévenir les oublis                    ║
║ 5. VÉRIFIER : Auto-validation, cohérence, sanity checks                        ║
╚═══════════════════════════════════════════════════════════════════════════════╝

═══════════════════════════════════════════════════════════════════════════════
SECTION 1 : PROCESSUS DE TRAITEMENT EN 3 PASSES
═══════════════════════════════════════════════════════════════════════════════

🔵 PASSE 1 - EXTRACTION BRUTE
   └─ Identifier TOUS les items distincts dans le texte
   └─ Classifier chaque item (task/event/note)
   └─ Extraire dates, heures, personnes, lieux

🟡 PASSE 2 - VÉRIFICATION & VALIDATION
   └─ Cohérence temporelle : la date est-elle logique ?
   └─ Cohérence type : un "RDV" doit être un EVENT, pas une TASK
   └─ Complétude : manque-t-il des infos critiques ?
   └─ Doublon potentiel : est-ce une reformulation d'un autre item ?

🟢 PASSE 3 - ENRICHISSEMENT & ANTICIPATION
   └─ Tâches préparatoires : un RDV nécessite-t-il une préparation ?
   └─ Rappels suggérés : deadline proche = rappel J-1 ?
   └─ Liens contextuels : quel projet ? quelle personne ?
   └─ Actions implicites : "présentation client" → préparer slides ?

═══════════════════════════════════════════════════════════════════════════════
SECTION 2 : CLASSIFICATION PRÉCISE (RÈGLES HIÉRARCHIQUES)
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. EVENT (Événement calendrier) - PRIORITÉ MAXIMALE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ ✓ Conditions (AU MOINS UNE) :                                                │
│   • Heure EXPLICITE : "14h", "10h30", "à 9h", "demain 15h"                  │
│   • Mot-clé RDV : "rendez-vous", "RDV", "réunion", "meeting", "call"        │
│   • Repas planifié : "déjeuner avec", "déjeuner Marie", "dîner chez"        │
│     (le "avec" peut être omis en langage parlé : "déjeuner Paul" = EVENT)   │
│   • Déplacement : "visite", "aller à", "se rendre"                          │
│   • Rencontre informelle : "café avec", "drink avec", "apéro avec"          │
│                                                                              │
│ ✓ Exemples EVENT :                                                           │
│   • "Appeler Marie demain 14h" → EVENT (heure explicite)                    │
│   • "RDV dentiste jeudi" → EVENT (mot-clé RDV, heure défaut 09:00)          │
│   • "Réunion budget lundi 10h salle B" → EVENT + location                   │
│   • "Déjeuner équipe vendredi midi" → EVENT (12:00-14:00)                   │
│                                                                              │
│ ✗ PAS des events :                                                           │
│   • "Appeler Marie demain" → TASK (pas d'heure précise)                     │
│   • "Préparer la réunion" → TASK (préparation ≠ événement)                  │
│   • "Penser à réserver restaurant" → TASK (action, pas l'event)             │
│                                                                              │
│ ⚠️ CAS SPÉCIAL APPELS :                                                      │
│   • "Appeler Marie 14h" → EVENT (heure explicite)                           │
│   • "Appeler Marie demain" → TASK (pas d'heure = tâche à faire)             │
│   • "Call prévu 14h avec Marie" → EVENT (mot-clé "prévu" + heure)           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. NOTE (Information à retenir) - CONNAISSANCE PURE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ ✓ Conditions :                                                               │
│   • Préfixe explicite : "Note:", "Idée:", "Info:", "À retenir:", "!"        │
│   • Information factuelle SANS action : "Le budget est de 50k€"             │
│   • Préférence/Observation : "Paul préfère les réunions le matin"           │
│   • Référence : URL, citation, "voir article sur X"                          │
│   • Insight/Réflexion : "J'ai réalisé que..."                               │
│                                                                              │
│ ✓ Exemples NOTE :                                                            │
│   • "Idée: utiliser Redis pour le cache" → NOTE (préfixe + concept)         │
│   • "Le client veut livraison avant mars" → NOTE (info factuelle)           │
│   • "Budget 2026: 50k€ marketing" → NOTE (donnée chiffrée)                  │
│                                                                              │
│ ✗ PAS des notes :                                                            │
│   • "Vérifier le budget" → TASK (verbe d'action)                            │
│   • "Demander à Paul ses préférences" → TASK (demander = action)            │
│                                                                              │
│ ⚠️ RÈGLE DE PRIORITÉ :                                                       │
│   Le préfixe explicite (Note:, Idée:, !, À retenir:) PRIME TOUJOURS         │
│   sur un verbe d'action détecté dans le contenu.                            │
│   Ex: "! ne pas oublier de signer" → NOTE (préfixe "!" prime)               │
│   Ex: "Idée: penser à automatiser" → NOTE (préfixe "Idée:" prime)           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. TASK (Action à faire) - PAR DÉFAUT                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ ✓ Indicateurs :                                                              │
│   • Verbe d'action : appeler, envoyer, faire, préparer, vérifier, acheter   │
│   • Obligation implicite : "il faut", "je dois", "à faire"                  │
│   • Action sur objet : "le rapport", "la présentation", "le devis"          │
│   • Assignation : "@Paul", "pour Marie", "Marc doit"                        │
│                                                                              │
│ ✓ REFORMULATION OBLIGATOIRE :                                                │
│   • Transformer en action claire et concise                                  │
│   • Commencer par un verbe à l'infinitif si possible                        │
│   • "faut que je fasse le truc" → "Faire [truc spécifique]"                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ ⚠️ CAS AMBIGUS (RÉSOLUTION OBLIGATOIRE)                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ Ces cas DOIVENT être résolus selon ces règles précises :                     │
│                                                                              │
│ • "Rappeler Marie pour confirmer le RDV"                                     │
│   → TASK (l'action est "rappeler", pas le RDV lui-même)                     │
│                                                                              │
│ • "Appeler Marie 14h pour le RDV de demain"                                  │
│   → EVENT (heure explicite 14h = événement calendrier)                      │
│                                                                              │
│ • "Préparer réunion 14h"                                                     │
│   → TASK uniquement (préparer = action, la réunion est le contexte)         │
│   → L'EVENT "Réunion 14h" existe peut-être déjà ailleurs                    │
│                                                                              │
│ • "Réunion budget puis préparer compte-rendu"                                │
│   → 2 items : EVENT (réunion) + TASK (préparer CR)                          │
│                                                                              │
│ • "RDV médecin, penser à amener les radios"                                  │
│   → 2 items : EVENT (RDV) + TASK (amener radios, date = date RDV)           │
│                                                                              │
│ • "Déjeuner avec Marie samedi"                                               │
│   → EVENT (repas planifié = événement, défaut 12:00-13:30)                  │
│   Même sans heure, "déjeuner/dîner avec X" = EVENT                          │
│                                                                              │
│ RÈGLE FINALE :                                                               │
│   • Heure explicite → EVENT                                                  │
│   • Mot-clé RDV/réunion/déjeuner/dîner + personne → EVENT                   │
│   • Sinon → TASK                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
SECTION 3 : DÉTECTION MULTI-ITEMS (TEXTE PARLÉ/DICTÉ)
═══════════════════════════════════════════════════════════════════════════════

⚠️ CRITIQUE : Le texte peut être dicté vocalement SANS ponctuation ni structure.
Tu dois détecter CHAQUE item distinct dans un flux continu.

🔍 SIGNAUX DE SÉPARATION :

1. CHANGEMENT DE DATE
   "...demain... et lundi..." → 2 items minimum
   "...cette semaine... la semaine prochaine..." → items séparés

2. CHANGEMENT DE TYPE
   "j'ai une idée... et je dois..." → NOTE + TASK
   "rdv à 14h et après faut que..." → EVENT + TASK

3. CHANGEMENT DE SUJET/PERSONNE
   "...Marie... et Paul..." → potentiellement 2 items
   "...le projet X... et le projet Y..." → 2 items

4. MARQUEURS EXPLICITES
   " + ", " et puis ", " aussi ", " sinon ", virgule, point-virgule, "ah et"
   "d'abord", "ensuite", "enfin", "premièrement", "deuxièmement"

5. MARQUEURS IMPLICITES (CRUCIAUX pour texte parlé)
   "et lundi...", "et mardi...", "d'ailleurs...", "au fait...", "tiens..."
   "ah oui", "j'oubliais", "autre chose", "sinon"

6. REFORMULATIONS (ne pas créer de doublons)
   "enfin je veux dire", "non plutôt", "en fait", "c'est-à-dire", "je veux dire"
   → Corriger/préciser l'item précédent, NE PAS créer un nouvel item

7. VALIDATION CROISÉE (éviter incohérences)
   • 2 events au même moment → Warning + vérifier si correct
   • Même tâche 2 fois → potential_duplicate: true

📝 EXEMPLES TEXTE PARLÉ :

ENTRÉE: "j'ai eu une idée pour le dashboard avec du graphql et lundi faut que j'appelle le client dupont et mardi j'ai rdv avec l'architecte à 14h à son bureau"
SORTIE: 3 items
  1. NOTE: "Idée dashboard avec GraphQL"
  2. TASK: "Appeler client Dupont" (date: lundi)
  3. EVENT: "RDV architecte" (date: mardi, 14:00, location: "son bureau")

ENTRÉE: "rappeler marie urgent et noter que le budget est validé et préparer présentation pour jeudi"
SORTIE: 3 items
  1. TASK: "Rappeler Marie" (urgent: true)
  2. NOTE: "Budget validé"
  3. TASK: "Préparer présentation" (date: jeudi)

🎯 RÈGLE D'OR : EN CAS DE DOUTE, SÉPARE. Mieux vaut 2 items que 1 item incomplet.

═══════════════════════════════════════════════════════════════════════════════
SECTION 4 : DATES & HEURES (CALCUL PRÉCIS)
═══════════════════════════════════════════════════════════════════════════════

📅 CONTEXTE TEMPOREL ACTUEL :
   • Aujourd'hui : ${currentDayName} ${currentDate}
   • Demain : ${tomorrowDayName} ${tomorrowDate}
   • Après-demain : ${afterTomorrowDate}
   • Heure actuelle : ${currentTime}

🗓️ CALCUL DATES RELATIVES :

┌────────────────────────┬────────────────────────────────────────────────────┐
│ Expression             │ Date ISO                                           │
├────────────────────────┼────────────────────────────────────────────────────┤
│ "aujourd'hui"          │ ${currentDate}                                     │
│ "ce soir"              │ ${currentDate}                                     │
│ "demain"               │ ${tomorrowDate}                                    │
│ "après-demain"         │ ${afterTomorrowDate}                               │
│ "ce week-end"          │ Prochain samedi (calculer)                         │
│ "dans 3 jours"         │ ${currentDate} + 3 jours (calculer)                │
│ "fin de semaine"       │ Vendredi de cette semaine                          │
│ "début de mois"        │ 1er du mois suivant si >15, sinon 1er du mois      │
│ Sans mention           │ ${currentDate} (défaut)                            │
└────────────────────────┴────────────────────────────────────────────────────┘

⚠️ CLARIFICATION CRITIQUE : "lundi" vs "lundi prochain" vs "ce lundi"

┌────────────────────────┬────────────────────────────────────────────────────┐
│ Expression             │ Signification                                       │
├────────────────────────┼────────────────────────────────────────────────────┤
│ "lundi"                │ Le PROCHAIN lundi à venir (dans 1-7 jours)         │
│ "lundi prochain"       │ Le lundi de la SEMAINE SUIVANTE (dans 7-13 jours)  │
│ "ce lundi"             │ Le lundi de CETTE semaine (⚠️ peut être passé!)    │
└────────────────────────┴────────────────────────────────────────────────────┘

Exemple concret si aujourd'hui = mercredi 15 janvier :
• "lundi" = lundi 20 janvier (prochain lundi, dans 5 jours)
• "lundi prochain" = lundi 27 janvier (semaine d'après, dans 12 jours)
• "ce lundi" = lundi 13 janvier (⚠️ PASSÉ! → metadata.warnings + date corrigée)

📅 DATES ABSOLUES :

┌────────────────────────┬────────────────────────────────────────────────────┐
│ Expression             │ Interprétation                                      │
├────────────────────────┼────────────────────────────────────────────────────┤
│ "le 15"                │ 15 du mois courant (ou suivant si déjà passé)      │
│ "le 15 janvier"        │ 15 janvier de l'année courante (ou suivante)       │
│ "fin janvier"          │ 31 janvier (ou dernier jour ouvrable)              │
│ "mi-février"           │ 15 février                                          │
│ "début mars"           │ 1er mars                                            │
│ "dans 2 semaines"      │ ${currentDate} + 14 jours                          │
│ "le mois prochain"     │ Même jour du mois suivant                          │
└────────────────────────┴────────────────────────────────────────────────────┘

⚠️ IMPORTANT : Utilise TOUJOURS les dates ISO calculées.
   "demain" = ${tomorrowDate}, PAS "currentDate + 1 jour".

🌍 FUSEAUX HORAIRES :
   • Par défaut : heure locale française (Europe/Paris)
   • Si mention "heure française", "heure locale", "heure de Paris" → utiliser telle quelle
   • Si mention "heure US", "EST", "PST" → convertir en heure française dans metadata
   • Ex: "call 18h heure française" → start_time: "18:00"
   • Ex: "call 9h EST" → start_time: "15:00" (+ metadata.timezone_note)

🕐 HEURES & DURÉES :

┌────────────────────────┬───────────────┬──────────────────────────────────────┐
│ Expression             │ Heure         │ Durée par défaut                     │
├────────────────────────┼───────────────┼──────────────────────────────────────┤
│ "14h", "14h30"         │ 14:00, 14:30  │ -                                    │
│ "tôt le matin"         │ 08:00         │ -                                    │
│ "matin"                │ 09:00         │ -                                    │
│ "midi"                 │ 12:00         │ -                                    │
│ "après-midi"           │ 14:00         │ -                                    │
│ "fin d'après-midi"     │ 17:00         │ -                                    │
│ "soir"                 │ 18:00         │ -                                    │
│ RDV/Réunion            │ -             │ 60 min                               │
│ Appel/Call             │ -             │ 30 min                               │
│ Déjeuner/Dîner         │ -             │ 90 min                               │
│ Café/Drink/Apéro       │ -             │ 45 min                               │
│ Visite/Déplacement     │ -             │ 120 min                              │
│ Formation/Atelier      │ -             │ 240 min (demi-journée)               │
│ Conférence/Séminaire   │ -             │ 480 min (journée complète)           │
└────────────────────────┴───────────────┴──────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
SECTION 5 : EXTRACTION D'ENTITÉS (INTELLIGENCE CONTEXTUELLE)
═══════════════════════════════════════════════════════════════════════════════

👥 PERSONNES (metadata.people)
   • Noms propres : "Marie", "Paul Dupont", "Dr. Martin"
   • Rôles : "le client", "mon boss", "l'équipe"
   • Assignation explicite : "@Marc", "pour Julie", "X doit faire"
   • RÈGLE : Si plusieurs personnes, metadata.people = ["Nom1", "Nom2"]
   • RÈGLE : owner = première personne assignée, ou "Moi" si aucune

   ⚠️ NORMALISATION DES NOMS :
   • "Dr. Martin" = "Docteur Martin" = "Martin" → Utiliser forme courte : "Martin"
   • "Marie-Claire" vs "Marie Claire" → Conserver tel quel (noms composés)
   • Titres (Dr., M., Mme) → Retirer dans metadata.people, garder dans text si pertinent

📍 LIEUX (location - events uniquement)
   • Adresses : "12 rue de la Paix", "Paris"
   • Points d'intérêt : "salle B", "bureau de Marc", "chez le client"
   • Mots-clés : "à", "chez", "au", "dans"

📁 PROJETS (matching intelligent)
   • Projets existants : ${JSON.stringify(activeProjects)}
   • Match EXACT d'abord, puis PARTIEL (contient le mot)
   • "dashboard client" match "Dashboard Client X" si existe
   • Si aucun match → project: null (ne PAS inventer)

🏷️ TAGS (max 5, pertinents uniquement)
   • Tags existants (priorité) : ${JSON.stringify(existingTags)}
   • Catégories auto : domaine (tech, marketing, finance), contexte (réunion, appel)
   • Format : minuscules, sans accents, sans espaces (utiliser tirets)

═══════════════════════════════════════════════════════════════════════════════
SECTION 6 : PRIORITÉ & URGENCE (DÉTECTION FINE)
═══════════════════════════════════════════════════════════════════════════════

🔴 urgent: true
   • Mots-clés : "URGENT", "ASAP", "immédiatement", "tout de suite", "!!!"
   • Contexte technique : "critique", "en panne", "down", "bloqué", "cassé"
   • Contexte temporel : deadline très proche (aujourd'hui/demain)
   • Ton : exclamation, majuscules

   ⚠️ RÈGLE : En contexte IT/technique, "critique" = URGENT (pas juste important)
   Ex: "critique: serveur en panne" → urgent:true (panne = urgence immédiate)

🟠 important: true (mais pas urgent)
   • Mots-clés : "important", "crucial", "essentiel", "critique", "clé"
   • Contexte : impact business, décision stratégique, client majeur

📊 MATRICE EISENHOWER (pour metadata) :
   • urgent + important → Faire MAINTENANT
   • important seul → Planifier
   • urgent seul → Déléguer si possible
   • ni l'un ni l'autre → À reconsidérer

═══════════════════════════════════════════════════════════════════════════════
SECTION 7 : NOTES - STRUCTURATION INTELLIGENTE
═══════════════════════════════════════════════════════════════════════════════

📝 TITRE (3-8 mots, descriptif)
   ✓ BON : "Architecture microservices projet Alpha", "Préférences client Dupont"
   ✗ MAUVAIS : "Idée", "Note", "À retenir", "Important"

📄 CONTENU (structuré, pas de charabia)
   • Concept unique → Paragraphe fluide
   • Plusieurs points → Bullets "• " (Unicode bullet + espace)
   • Ne PAS répéter le titre dans le contenu
   • Longueur : 1-5 phrases ou 2-5 bullets

🎨 COULEURS :
   • blue : technique, développement, API
   • green : idée, créativité, innovation
   • yellow : attention, warning, à vérifier
   • orange : urgent, deadline proche
   • red : critique, bloquant, risque
   • purple : stratégie, vision, long terme
   • null : neutre, informatif

═══════════════════════════════════════════════════════════════════════════════
SECTION 8 : ANTICIPATION INTELLIGENTE (SECOND BRAIN) - OBLIGATOIRE
═══════════════════════════════════════════════════════════════════════════════

⚠️ RÈGLE : Les suggestions sont OBLIGATOIRES pour certains types d'items.
   Tu DOIS remplir metadata.suggestions si les conditions sont remplies.

🔮 SUGGESTIONS OBLIGATOIRES :

┌─────────────────────────────────────┬────────────────────────────────────────┐
│ Condition                           │ Suggestion à ajouter                   │
├─────────────────────────────────────┼────────────────────────────────────────┤
│ EVENT avec "client" ou "important"  │ "Préparer dossier/documents avant"     │
│ EVENT avec "présentation"           │ "Finaliser slides la veille"           │
│ EVENT avec "entretien"              │ "Relire CV/portfolio avant"            │
│ TASK "envoyer devis/proposition"    │ "Relancer si pas de réponse sous 7j"   │
│ TASK deadline < 3 jours             │ "Définir rappel J-1"                   │
│ TASK avec dépendance détectée       │ "Attendre [condition] avant"           │
└─────────────────────────────────────┴────────────────────────────────────────┘

🔗 DÉTECTION DES DÉPENDANCES :

Mots-clés de dépendance → metadata.dependencies :
• "après validation", "une fois que", "quand X sera fait" → Dépendance explicite
• "Valider avec Marie" → Dépend disponibilité Marie
• "Attendre retour de" → Condition préalable

📝 EXEMPLES CONCRETS :

Entrée: "Présentation client Dupont vendredi important"
Sortie metadata:
{
  "suggestions": ["Préparer dossier client Dupont", "Finaliser slides jeudi soir"],
  "dependencies": [],
  "energy_level": "high",
  "context_required": ["ordinateur", "projecteur"]
}

Entrée: "Envoyer devis après validation du budget par Marc"
Sortie metadata:
{
  "suggestions": ["Relancer si pas de réponse sous 7j"],
  "dependencies": ["Validation budget par Marc"],
  "energy_level": "low"
}

═══════════════════════════════════════════════════════════════════════════════
SECTION 9 : VÉRIFICATION & VALIDATION AUTOMATIQUE - OBLIGATOIRE
═══════════════════════════════════════════════════════════════════════════════

⚠️ RÈGLE : Tu DOIS exécuter ces vérifications et signaler les anomalies.

🔍 CHECKS AUTOMATIQUES (avec exemples) :

1. COHÉRENCE TEMPORELLE
┌─────────────────────────────────────┬────────────────────────────────────────┐
│ Anomalie détectée                   │ Action requise                          │
├─────────────────────────────────────┼────────────────────────────────────────┤
│ Heure entre 00:00 et 06:00          │ warnings: ["Heure inhabituelle (03:00)"]│
│ Date dans le passé                  │ warnings: ["Date passée - corrigée"]   │
│                                     │ + corriger vers date future logique     │
│ RDV/Event sans date mentionnée      │ date: aujourd'hui + confidence: 0.7    │
│ "ce lundi" si lundi est passé       │ warnings: ["Référence passée"]         │
└─────────────────────────────────────┴────────────────────────────────────────┘

2. COHÉRENCE TYPE (auto-correction)
┌─────────────────────────────────────┬────────────────────────────────────────┐
│ Incohérence                         │ Correction automatique                  │
├─────────────────────────────────────┼────────────────────────────────────────┤
│ Mot "RDV" mais type: task           │ Corriger → type: event                 │
│ Préfixe "Idée:" mais type: task     │ Corriger → type: note                  │
│ Event sans start_time               │ Ajouter start_time: "09:00" par défaut │
│                                     │ + confidence réduit à 0.75              │
└─────────────────────────────────────┴────────────────────────────────────────┘

3. COMPLÉTUDE (champs obligatoires)
   ✓ Event : date + start_time + end_time (calculé si manquant)
   ✓ Task : text + date (défaut aujourd'hui)
   ✓ Note : title + content (distincts, pas de répétition)

4. DÉTECTION DOUBLONS
   • Même verbe + même personne + même date → potential_duplicate: true
   • Ex: "Appeler Marie" et "Rappeler Marie demain" si demain = même date

📝 EXEMPLE COMPLET AVEC WARNING :

Entrée: "rdv 3h du matin avec le plombier"

Sortie attendue:
{
  "type": "event",
  "text": "RDV plombier",
  "date": "${currentDate}",
  "start_time": "03:00",
  "end_time": "04:00",
  "metadata": {
    "confidence": 0.65,
    "warnings": ["Heure inhabituelle (03:00) - Vérifier si correct"],
    "suggestions": [],
    "people": ["plombier"]
  }
}

═══════════════════════════════════════════════════════════════════════════════
SECTION 10 : MÉTADONNÉES ENRICHIES
═══════════════════════════════════════════════════════════════════════════════

metadata: {
  // Standard
  "original_text": "texte brut exact de l'entrée",
  "confidence": 0.95,  // 0-1, calibré précisément
  "people": ["Marie", "Paul"],
  "topic": "budget Q1",

  // Enrichissement
  "estimated_duration_minutes": 30,  // Pour tasks
  "complexity": "low|medium|high",    // Estimation complexité
  "context_required": ["ordinateur", "téléphone", "déplacement"],  // Contexte nécessaire
  "energy_level": "low|medium|high",  // Énergie requise

  // Anticipation
  "suggestions": ["Préparer documents avant", "Confirmer présence"],
  "dependencies": ["Attendre validation budget"],
  "follow_up_date": "YYYY-MM-DD",  // Date de relance suggérée

  // Validation
  "warnings": ["Heure inhabituelle (3h)"],
  "potential_duplicate": false,
  "needs_clarification": false
}

═══════════════════════════════════════════════════════════════════════════════
SECTION 11 : FORMAT JSON STRICT (OUTPUT) - AVEC EXEMPLES COMPLETS
═══════════════════════════════════════════════════════════════════════════════

📋 STRUCTURE GÉNÉRALE :

{
  "items": [{
    "type": "task"|"event"|"note",
    "text": "Texte reformulé clair et actionnable",
    "title": "Titre note (3-8 mots)" | null,
    "content": "Contenu note structuré" | null,
    "date": "YYYY-MM-DD",
    "start_time": "HH:MM" | null,
    "end_time": "HH:MM" | null,
    "location": "Lieu précis" | null,
    "owner": "Personne assignée" | "Moi",
    "project": "Nom projet exact si match" | null,
    "urgent": true|false,
    "important": true|false,
    "tags": ["tag1", "tag2"],
    "color": "blue"|"green"|"yellow"|"orange"|"red"|"purple"|null,
    "metadata": {
      "original_text": "texte brut",
      "confidence": 0.95,
      "people": [],
      "topic": null,
      "estimated_duration_minutes": null,
      "complexity": "low"|"medium"|"high",
      "context_required": [],
      "energy_level": "low"|"medium"|"high",
      "suggestions": [],
      "dependencies": [],
      "warnings": [],
      "potential_duplicate": false
    }
  }],
  "parsing_notes": "Observations sur le parsing si pertinent"
}

📝 EXEMPLES COMPLETS PAR TYPE :

🔵 EXEMPLE TASK (avec suggestions) :
{
  "type": "task",
  "text": "Envoyer proposition commerciale client Dupont",
  "title": null,
  "content": null,
  "date": "${tomorrowDate}",
  "start_time": null,
  "end_time": null,
  "location": null,
  "project": null,
  "urgent": false,
  "important": true,
  "tags": ["commercial", "client"],
  "color": null,
  "metadata": {
    "original_text": "envoyer proposition dupont demain important",
    "confidence": 0.92,
    "people": ["Dupont"],
    "topic": "proposition commerciale",
    "estimated_duration_minutes": 45,
    "complexity": "medium",
    "context_required": ["ordinateur"],
    "energy_level": "medium",
    "suggestions": ["Relancer si pas de réponse sous 7j"],
    "dependencies": [],
    "warnings": [],
    "potential_duplicate": false
  }
}

🟢 EXEMPLE EVENT (avec warning) :
{
  "type": "event",
  "text": "RDV client Martin - présentation projet",
  "title": null,
  "content": null,
  "date": "${currentDate}",
  "start_time": "06:30",
  "end_time": "07:30",
  "location": "Bureau client",
  "project": null,
  "urgent": false,
  "important": true,
  "tags": ["client", "presentation"],
  "color": null,
  "metadata": {
    "original_text": "rdv martin 6h30 presentation bureau client",
    "confidence": 0.75,
    "people": ["Martin"],
    "topic": "présentation projet",
    "estimated_duration_minutes": 60,
    "complexity": "high",
    "context_required": ["ordinateur", "projecteur", "déplacement"],
    "energy_level": "high",
    "suggestions": ["Préparer slides la veille", "Confirmer RDV 1h avant"],
    "dependencies": [],
    "warnings": ["Heure matinale inhabituelle (06:30)"],
    "potential_duplicate": false
  }
}

🟡 EXEMPLE NOTE (structurée) :
{
  "type": "note",
  "text": null,
  "title": "Stack technique projet Dashboard",
  "content": "• Frontend: React + TypeScript\\n• Backend: Node.js + Express\\n• BDD: PostgreSQL\\n• Cache: Redis pour sessions",
  "date": "${currentDate}",
  "start_time": null,
  "end_time": null,
  "location": null,
  "project": "Dashboard Client",
  "urgent": false,
  "important": false,
  "tags": ["tech", "architecture", "react"],
  "color": "blue",
  "metadata": {
    "original_text": "idée pour le dashboard on pourrait utiliser react typescript node postgres et redis",
    "confidence": 0.88,
    "people": [],
    "topic": "architecture technique",
    "estimated_duration_minutes": null,
    "complexity": null,
    "context_required": [],
    "energy_level": null,
    "suggestions": [],
    "dependencies": [],
    "warnings": [],
    "potential_duplicate": false
  }
}

═══════════════════════════════════════════════════════════════════════════════
SECTION 12 : CALIBRATION CONFIDENCE
═══════════════════════════════════════════════════════════════════════════════

📊 ÉCHELLE PRÉCISE :

1.00 : Certitude absolue - Tout est explicite, aucune ambiguïté
0.90-0.99 : Très haute confiance - Interprétation évidente
0.80-0.89 : Haute confiance - Quelques inférences mineures
0.70-0.79 : Confiance moyenne - Inférences significatives mais logiques
0.60-0.69 : Confiance modérée - Ambiguïté notable, choix par défaut
0.50-0.59 : Confiance faible - Forte ambiguïté, interprétation risquée
<0.50 : Ne devrait pas arriver - Demander clarification

🎯 OBJECTIF : Moyenne confidence > 0.85 sur tous les items

═══════════════════════════════════════════════════════════════════════════════
SECTION 13 : ERREURS À ÉVITER (CRITIQUES)
═══════════════════════════════════════════════════════════════════════════════

❌ NE JAMAIS FAIRE :

1. FUSION D'ITEMS DISTINCTS
   ✗ "rdv marie et appeler paul" → 1 seul item
   ✓ Doit créer 2 items séparés

2. OUBLIER LES DATES CALCULÉES
   ✗ "demain" → date non fournie ou formule
   ✓ "demain" → ${tomorrowDate} (date ISO exacte)

3. IGNORER LES HEURES POUR LES EVENTS
   ✗ Event sans start_time
   ✓ Toujours fournir start_time (défaut 09:00)

4. RÉPÉTER TITRE DANS CONTENU (Notes)
   ✗ title: "Idée React", content: "Idée: utiliser React pour..."
   ✓ content développe le titre, ne le répète pas

5. CLASSIFICATIONS INCOHÉRENTES
   ✗ Mot "RDV" présent mais type: "task"
   ✓ "RDV" → TOUJOURS type: "event"

6. SUGGESTIONS MANQUANTES POUR EVENTS IMPORTANTS
   ✗ Event client sans suggestion de préparation
   ✓ Toujours suggérer préparation pour events clients/présentations

7. CONFIDENCE TROP HAUTE AVEC AMBIGUÏTÉ
   ✗ Texte ambigu avec confidence: 0.95
   ✓ Ambiguïté = confidence < 0.85

═══════════════════════════════════════════════════════════════════════════════
RAPPEL FINAL : TU ES UN SECOND BRAIN
═══════════════════════════════════════════════════════════════════════════════

╔═════════════════════════════════════════════════════════════════════════════╗
║ 🧠 PHILOSOPHIE SECOND BRAIN - 5 PILIERS                                     ║
╠═════════════════════════════════════════════════════════════════════════════╣
║ 1. CAPTURER    : Ne rate RIEN, chaque item distinct compte                  ║
║ 2. ORGANISER   : Classification précise, sans ambiguïté                     ║
║ 3. ENRICHIR    : Contexte, suggestions, métadonnées utiles                  ║
║ 4. ANTICIPER   : Pense à ce que l'utilisateur pourrait oublier              ║
║ 5. VÉRIFIER    : Auto-validation, signale toute incohérence                 ║
╚═════════════════════════════════════════════════════════════════════════════╝

🎯 OBJECTIF QUALITÉ :
• Confidence moyenne > 0.85
• Zéro item manqué dans le texte
• Zéro erreur de classification
• Suggestions pertinentes pour events importants
• Warnings pour toute anomalie détectée

💡 RAPPEL : L'utilisateur doit sentir que tu COMPRENDS vraiment ce qu'il veut faire,
pas juste que tu parses du texte. Tu es son EXTENSION COGNITIVE.`;

      // ===== 3. USER PROMPT (avec contexte enrichi) =====

      // Calculer les jours de la semaine prochaine pour référence
      const weekDays = [];
      for (let i = 1; i <= 7; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() + i);
        weekDays.push({
          name: dayNames[d.getDay()],
          date: d.toISOString().split('T')[0],
        });
      }
      const weekDaysStr = weekDays.map(d => `${d.name} → ${d.date}`).join(', ');

      const userPrompt = `🧠 ACTIVATION SECOND BRAIN - Analyse complète requise

═══════════════════════════════════════════════════════════════════════════════
ENTRÉE INBOX À TRAITER
═══════════════════════════════════════════════════════════════════════════════

"""
${text}
"""

═══════════════════════════════════════════════════════════════════════════════
CONTEXTE TEMPOREL PRÉCIS
═══════════════════════════════════════════════════════════════════════════════

📅 Aujourd'hui : ${currentDayName} ${currentDate}
📅 Demain : ${tomorrowDayName} ${tomorrowDate}
📅 Après-demain : ${afterTomorrowDate}
🕐 Heure actuelle : ${currentTime}

📆 Jours à venir (pour calcul "lundi", "mardi", etc.) :
${weekDaysStr}

═══════════════════════════════════════════════════════════════════════════════
CONTEXTE UTILISATEUR
═══════════════════════════════════════════════════════════════════════════════

📁 Projets actifs (matching exact requis) :
${activeProjects.length > 0 ? '• ' + activeProjects.join('\\n• ') : '(Aucun projet actif)'}

🏷️ Tags existants (utiliser en priorité) :
${existingTags.length > 0 ? existingTags.join(', ') : '(Aucun tag existant)'}

👥 Membres d'équipe (pour assignment) :
${teamMembers.length > 0 ? teamMembers.join(', ') : '(Aucun membre enregistré)'}

═══════════════════════════════════════════════════════════════════════════════
INSTRUCTIONS D'EXÉCUTION
═══════════════════════════════════════════════════════════════════════════════

1. PASSE 1 : Identifier tous les items distincts (attention texte parlé/dicté)
2. PASSE 2 : Vérifier cohérence (dates logiques, types corrects)
3. PASSE 3 : Enrichir avec suggestions et métadonnées

⚠️ RAPPEL CRITIQUE :
- "demain" = ${tomorrowDate} (utilise cette date EXACTE, pas une formule)
- Sépare les items si changement de date/sujet/type
- Event DOIT avoir start_time (défaut 09:00 si non précisé)
- Note DOIT avoir title ET content distincts

═══════════════════════════════════════════════════════════════════════════════
FORMAT RÉPONSE (JSON STRICT)
═══════════════════════════════════════════════════════════════════════════════

Réponds UNIQUEMENT avec JSON valide (pas de markdown, pas de texte avant/après).
Structure : { "items": [...], "parsing_notes": "..." }`;

      // ===== 4. APPEL CLAUDE API =====

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
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
          items: [
            {
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
                confidence: 0.5,
              },
            },
          ],
        };
      }

      // ===== 6. CRÉATION ITEMS EN BDD =====

      const itemsCreated = [];
      const items = aiResponse.items || [];

      for (const item of items) {
        try {
          if (item.type === 'task' || item.type === 'event') {
            // ===== CRÉATION TASK/EVENT =====

            // Extract just YYYY-MM-DD to avoid timezone issues
            const taskDate = item.date ? item.date.split('T')[0] : currentDate;

            const taskResult = await query(
              `INSERT INTO tasks (user_id, text, date, urgent, owner, is_event, start_time, end_time, location, done)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
               RETURNING *`,
              [
                userId,
                item.text,
                taskDate,
                item.urgent || false,
                item.metadata?.people?.[0] || 'Moi',
                item.type === 'event',
                item.start_time || null,
                item.end_time || null,
                item.location || null,
                false,
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
                await query('UPDATE tasks SET project_id = $1 WHERE id = $2', [
                  projectMatch.rows[0].id,
                  createdTask.id,
                ]);
                createdTask.project_id = projectMatch.rows[0].id;
              }
            }

            // Auto-sync to Google Calendar if event with start_time
            let syncResult = { success: false, reason: 'skipped' };
            if (item.type === 'event' && createdTask.start_time) {
              syncResult = await syncEventToGoogleInternal(fastify, userId, createdTask);
              if (syncResult.success && syncResult.eventId) {
                await query('UPDATE tasks SET google_event_id = $1 WHERE id = $2', [
                  syncResult.eventId,
                  createdTask.id,
                ]);
                createdTask.google_event_id = syncResult.eventId;
              }
            }

            itemsCreated.push({
              type: item.type,
              id: createdTask.id,
              text: createdTask.text,
              date: createdTask.date,
              google_synced: !!createdTask.google_event_id,
              google_sync_status: syncResult.reason || (syncResult.success ? 'success' : 'failed'),
            });
          } else if (item.type === 'note') {
            // ===== CRÉATION NOTE =====

            const noteResult = await query(
              `INSERT INTO notes (user_id, title, content, color, is_pinned)
               VALUES ($1, $2, $3, $4, $5)
               RETURNING *`,
              [userId, item.title || 'Note', item.content || '', item.color || null, false]
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
                await query('UPDATE notes SET project_id = $1 WHERE id = $2', [
                  projectMatch.rows[0].id,
                  createdNote.id,
                ]);
                createdNote.project_id = projectMatch.rows[0].id;
              }
            }

            itemsCreated.push({
              type: 'note',
              id: createdNote.id,
              title: createdNote.title,
              tags: item.tags || [],
            });
          }
        } catch (itemError) {
          fastify.log.error('Error creating item:', itemError);
          // Continue avec les autres items
        }
      }

      // ===== 7. TRACKING POUR AMÉLIORATION CONTINUE =====

      const processingTime = Date.now() - startTime;
      const confidenceAvg =
        items.reduce((sum, i) => sum + (i.metadata?.confidence || 0.5), 0) / items.length;

      await query(
        `INSERT INTO ai_inbox_decisions (user_id, input_text, ai_response, items_created, confidence_avg, processing_time_ms)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userId,
          text,
          JSON.stringify(aiResponse),
          JSON.stringify(itemsCreated),
          confidenceAvg,
          processingTime,
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
          notes: itemsCreated.filter(i => i.type === 'note').length,
        },
        processing_time_ms: processingTime,
      };
    } catch (error) {
      fastify.log.error('Process inbox error:', error);
      return reply.status(500).send({
        error: 'Inbox processing failed',
        details: error.message,
      });
    }
  });

  // ============================================================
  // INBOX V2 - Second Brain avec Intelligence Prédictive
  // ============================================================
  // Version améliorée avec :
  // - Section 14: Intelligence Prédictive (patterns, chaînes)
  // - Section 15: Profil Utilisateur Adaptatif
  // - Section 16: Suggestions Proactives
  // - Section 17: Mémoire Contextuelle
  fastify.post(
    '/process-inbox-v2',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;
      const { text } = request.body;
      const startTime = Date.now();

      if (!text || text.trim().length === 0) {
        return reply.status(400).send({ error: 'Missing text' });
      }

      try {
        // ===== 1. CHARGER CONTEXTE UTILISATEUR =====

        // Projets actifs
        const projectsResult = await query(
          "SELECT id, name FROM projects WHERE user_id = $1 AND status != 'archived' ORDER BY name",
          [userId]
        );
        const activeProjects = projectsResult.rows.map(p => p.name);

        // Tags existants
        const tagsResult = await query('SELECT name FROM tags WHERE user_id = $1 ORDER BY name', [
          userId,
        ]);
        const existingTags = tagsResult.rows.map(t => t.name);

        // Membres d'équipe
        const membersResult = await query(
          'SELECT name FROM team_members WHERE user_id = $1 AND active = TRUE ORDER BY name',
          [userId]
        );
        const teamMembers = membersResult.rows.map(m => m.name);

        // ===== 2. CHARGER PROFIL & MÉMOIRE (si tables existent) =====

        let userProfile = null;
        let memoryContext = null;

        try {
          // Profil utilisateur
          const profileResult = await query('SELECT * FROM user_profiles WHERE user_id = $1', [
            userId,
          ]);
          if (profileResult.rows.length > 0) {
            const p = profileResult.rows[0];
            userProfile = {
              profession: p.profession,
              domain: p.domain,
              role_level: p.role_level,
              communication_style: {
                formality: p.formality,
                verbosity: p.verbosity,
                tone: p.tone,
              },
              work_preferences: p.work_preferences,
              vocabulary: p.vocabulary,
            };
          }

          // Mémoire contextuelle (entités apprises, corrections récentes)
          const entitiesResult = await query(
            'SELECT entity_type, entity_name, entity_data FROM learned_entities WHERE user_id = $1 ORDER BY frequency DESC LIMIT 50',
            [userId]
          );

          const correctionsResult = await query(
            'SELECT corrected_field, original_value, corrected_value, learned_rule FROM ai_corrections WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
            [userId]
          );

          if (entitiesResult.rows.length > 0 || correctionsResult.rows.length > 0) {
            const learnedEntities = {};
            entitiesResult.rows.forEach(e => {
              if (!learnedEntities[e.entity_type]) learnedEntities[e.entity_type] = {};
              learnedEntities[e.entity_type][e.entity_name] = e.entity_data;
            });

            memoryContext = {
              learned_entities: learnedEntities,
              corrections_history: correctionsResult.rows,
            };
          }
        } catch {
          // Tables n'existent pas encore, continuer sans mémoire
          fastify.log.info('Memory tables not yet created, running without memory context');
        }

        // ===== 3. CONSTRUIRE PROMPT V2 =====

        const { systemPrompt, userPrompt, temporal } = buildSecondBrainPrompt(text, {
          activeProjects,
          existingTags,
          teamMembers,
          userProfile,
          memoryContext,
        });

        // ===== 4. APPEL CLAUDE API =====

        const message = await anthropic.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 3000, // Plus de tokens pour les suggestions
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        });

        const responseText = message.content[0].text;

        // ===== 5. PARSE RÉPONSE JSON =====

        let aiResponse;
        try {
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error('No JSON found');
          aiResponse = JSON.parse(jsonMatch[0]);
        } catch (parseError) {
          fastify.log.error('AI response JSON parse failed:', parseError);
          fastify.log.error('Raw response:', responseText);

          aiResponse = {
            items: [
              {
                type: 'task',
                text: text,
                date: temporal.currentDate,
                urgent: false,
                metadata: { confidence: 0.5 },
              },
            ],
            proactive_suggestions: [],
          };
        }

        // ===== 6. CRÉATION ITEMS EN BDD =====

        const itemsCreated = [];
        const items = aiResponse.items || [];

        for (const item of items) {
          try {
            if (item.type === 'task' || item.type === 'event') {
              const taskDate = item.date || temporal.currentDate;

              const taskResult = await query(
                `INSERT INTO tasks (user_id, text, date, urgent, owner, is_event, start_time, end_time, location, done)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
               RETURNING *`,
                [
                  userId,
                  item.text,
                  taskDate,
                  item.urgent || false,
                  item.metadata?.people?.[0] || 'Moi',
                  item.type === 'event',
                  item.start_time || null,
                  item.end_time || null,
                  item.location || null,
                  false,
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
                  await query('UPDATE tasks SET project_id = $1 WHERE id = $2', [
                    projectMatch.rows[0].id,
                    createdTask.id,
                  ]);
                }
              }

              // Auto-sync to Google Calendar if event
              let syncResult = { success: false, reason: 'skipped' };
              if (item.type === 'event' && createdTask.start_time) {
                syncResult = await syncEventToGoogleInternal(fastify, userId, createdTask);
                if (syncResult.success && syncResult.eventId) {
                  await query('UPDATE tasks SET google_event_id = $1 WHERE id = $2', [
                    syncResult.eventId,
                    createdTask.id,
                  ]);
                }
              }

              itemsCreated.push({
                type: item.type,
                id: createdTask.id,
                text: createdTask.text,
                date: createdTask.date,
                google_synced: !!syncResult.success,
                predictive: item.metadata?.predictive || null,
              });
            } else if (item.type === 'note') {
              const noteResult = await query(
                `INSERT INTO notes (user_id, title, content, color, is_pinned)
               VALUES ($1, $2, $3, $4, $5)
               RETURNING *`,
                [userId, item.title || 'Note', item.content || '', item.color || null, false]
              );

              const createdNote = noteResult.rows[0];

              // Auto-création tags
              if (item.tags && item.tags.length > 0) {
                for (const tagName of item.tags) {
                  const tagResult = await query(
                    `INSERT INTO tags (user_id, name, color)
                   VALUES ($1, $2, $3)
                   ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
                   RETURNING id`,
                    [userId, tagName.toLowerCase(), null]
                  );
                  await query(
                    `INSERT INTO note_tags (note_id, tag_id)
                   VALUES ($1, $2)
                   ON CONFLICT DO NOTHING`,
                    [createdNote.id, tagResult.rows[0].id]
                  );
                }
              }

              itemsCreated.push({
                type: 'note',
                id: createdNote.id,
                title: createdNote.title,
                tags: item.tags || [],
              });
            }
          } catch (itemError) {
            fastify.log.error('Error creating item:', itemError);
          }
        }

        // ===== 7. SAUVEGARDER SUGGESTIONS PROACTIVES =====

        const suggestions = aiResponse.proactive_suggestions || [];
        const savedSuggestions = [];

        try {
          for (const suggestion of suggestions.slice(0, 7)) {
            if (suggestion.priority_score >= 0.5) {
              const sugResult = await query(
                `INSERT INTO proactive_suggestions
               (user_id, source_item_id, source_item_type, suggestion_type, suggested_task, suggested_date, priority_score, reason, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
               RETURNING id`,
                [
                  userId,
                  itemsCreated[suggestion.trigger_item_index]?.id || null,
                  itemsCreated[suggestion.trigger_item_index]?.type || null,
                  suggestion.suggestion_type,
                  suggestion.suggested_task,
                  suggestion.suggested_date || null,
                  suggestion.priority_score,
                  suggestion.reason,
                ]
              );
              savedSuggestions.push({
                id: sugResult.rows[0].id,
                ...suggestion,
              });
            }
          }
        } catch {
          fastify.log.info('Proactive suggestions table not yet created');
        }

        // ===== 8. APPRENTISSAGE - Sauvegarder entités détectées =====

        try {
          for (const item of items) {
            const signals = item.metadata?.learning_signals;
            if (signals?.new_entity_detected) {
              const entity = signals.new_entity_detected;
              await query(
                `INSERT INTO learned_entities (user_id, entity_type, entity_name, entity_data)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (user_id, entity_type, entity_name)
               DO UPDATE SET frequency = learned_entities.frequency + 1, updated_at = NOW()`,
                [userId, 'person', entity.name, JSON.stringify(entity)]
              );
            }
          }
        } catch {
          fastify.log.info('Learning entities table not yet created');
        }

        // ===== 9. TRACKING =====

        const processingTime = Date.now() - startTime;
        const confidenceAvg =
          items.length > 0
            ? items.reduce((sum, i) => sum + (i.metadata?.confidence || 0.5), 0) / items.length
            : 0.5;

        await query(
          `INSERT INTO ai_inbox_decisions
         (user_id, input_text, ai_response, items_created, confidence_avg, processing_time_ms, suggestions_generated, patterns_detected)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            userId,
            text,
            JSON.stringify(aiResponse),
            JSON.stringify(itemsCreated),
            confidenceAvg,
            processingTime,
            JSON.stringify(savedSuggestions),
            JSON.stringify(
              items.filter(i => i.metadata?.predictive?.detected_patterns?.length > 0)
            ),
          ]
        );

        // ===== 10. RETOUR RÉSULTAT =====

        return {
          success: true,
          version: 'v2',
          items: itemsCreated,
          proactive_suggestions: savedSuggestions,
          stats: {
            total: itemsCreated.length,
            tasks: itemsCreated.filter(i => i.type === 'task').length,
            events: itemsCreated.filter(i => i.type === 'event').length,
            notes: itemsCreated.filter(i => i.type === 'note').length,
            suggestions: savedSuggestions.length,
          },
          processing_time_ms: processingTime,
          memory_used: !!memoryContext,
          profile_used: !!userProfile,
        };
      } catch (error) {
        fastify.log.error('Process inbox V2 error:', error);
        return reply.status(500).send({
          error: 'Inbox V2 processing failed',
          details: error.message,
        });
      }
    }
  );

  // ============================================================================
  // FEEDBACK LOOP - Système d'apprentissage continu (Tracker Record)
  // ============================================================================

  /**
   * POST /ai/feedback/:decisionId
   * Enregistre le feedback utilisateur sur une décision IA
   * Permet au système d'apprendre des corrections
   */
  fastify.post(
    '/feedback/:decisionId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;
      const { decisionId } = request.params;
      const {
        feedback, // 'correct' | 'incorrect' | 'partial'
        corrections, // Array of { field, original, corrected, comment }
        rating, // 1-5 satisfaction score
        comment, // Optional general comment
      } = request.body;

      try {
        // 1. Récupérer la décision originale
        const decisionResult = await query(
          `SELECT * FROM ai_inbox_decisions WHERE id = $1 AND user_id = $2`,
          [decisionId, userId]
        );

        if (decisionResult.rows.length === 0) {
          return reply.status(404).send({ error: 'Decision not found' });
        }

        const decision = decisionResult.rows[0];

        // 2. Mettre à jour la décision avec le feedback
        await query(
          `UPDATE ai_inbox_decisions
         SET user_feedback = $1,
             user_corrections = $2,
             learning_signals = COALESCE(learning_signals, '{}'::jsonb) || $3::jsonb
         WHERE id = $4`,
          [
            feedback,
            JSON.stringify(corrections || []),
            JSON.stringify({
              rating,
              comment,
              feedback_at: new Date().toISOString(),
            }),
            decisionId,
          ]
        );

        // 3. Si corrections, les enregistrer pour apprentissage
        const learnedRules = [];
        if (corrections && corrections.length > 0) {
          for (const correction of corrections) {
            // Générer une règle apprise via Claude
            const rulePrompt = `Analyse cette correction utilisateur et génère une règle d'apprentissage:

Input original: "${decision.input_text}"
Champ corrigé: ${correction.field}
Valeur IA: "${correction.original}"
Valeur correcte: "${correction.corrected}"
Commentaire: "${correction.comment || 'Aucun'}"

Génère une règle JSON avec:
- pattern: regex ou mots-clés qui déclenchent cette règle
- action: ce qu'il faut faire quand le pattern match
- confidence: niveau de confiance (0.7-1.0)
- scope: 'global' ou 'user_specific'

Réponds UNIQUEMENT en JSON valide.`;

            const ruleResponse = await anthropic.messages.create({
              model: 'claude-3-5-sonnet-20241022',
              max_tokens: 500,
              messages: [{ role: 'user', content: rulePrompt }],
            });

            let learnedRule = {};
            try {
              const ruleText = ruleResponse.content[0].text;
              const jsonMatch = ruleText.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                learnedRule = JSON.parse(jsonMatch[0]);
              }
            } catch (e) {
              learnedRule = {
                pattern: correction.original,
                action: `replace_with:${correction.corrected}`,
                confidence: 0.8,
                scope: 'user_specific',
              };
            }

            // Insérer dans ai_corrections
            const insertResult = await query(
              `INSERT INTO ai_corrections
             (user_id, original_input, ai_output, corrected_field, original_value, corrected_value, user_comment, learned_rule)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id`,
              [
                userId,
                decision.input_text,
                decision.ai_response,
                correction.field,
                correction.original,
                correction.corrected,
                correction.comment,
                JSON.stringify(learnedRule),
              ]
            );

            learnedRules.push({
              correction_id: insertResult.rows[0].id,
              field: correction.field,
              rule: learnedRule,
            });

            // 4. Si correction sur une entité, mettre à jour learned_entities
            if (
              correction.field === 'owner' ||
              correction.field === 'project' ||
              correction.field === 'tag'
            ) {
              await query(
                `INSERT INTO learned_entities (user_id, entity_type, canonical_name, aliases, frequency, last_used_at)
               VALUES ($1, $2, $3, $4, 1, NOW())
               ON CONFLICT (user_id, entity_type, canonical_name)
               DO UPDATE SET
                 aliases = array_cat(learned_entities.aliases, $4),
                 frequency = learned_entities.frequency + 1,
                 last_used_at = NOW()`,
                [
                  userId,
                  correction.field === 'owner' ? 'person' : correction.field,
                  correction.corrected,
                  [correction.original],
                ]
              );
            }
          }
        }

        // 5. Mettre à jour le profil utilisateur si pattern détecté
        if (feedback === 'correct' && decision.patterns_detected) {
          await query(
            `UPDATE user_profiles
           SET preferences = COALESCE(preferences, '{}'::jsonb) ||
               jsonb_build_object('validated_patterns',
                 COALESCE(preferences->'validated_patterns', '[]'::jsonb) || $1::jsonb
               ),
               updated_at = NOW()
           WHERE user_id = $2`,
            [JSON.stringify(decision.patterns_detected), userId]
          );
        }

        // 6. Log pour analytics
        await query(
          `INSERT INTO ai_interactions (user_id, type, prompt, response, tokens_used)
         VALUES ($1, 'feedback', $2, $3, 0)`,
          [
            userId,
            JSON.stringify({
              decision_id: decisionId,
              feedback,
              corrections_count: corrections?.length || 0,
            }),
            JSON.stringify({ rules_learned: learnedRules.length, rating }),
          ]
        );

        return {
          success: true,
          message:
            feedback === 'correct'
              ? 'Merci ! Cela renforce mon apprentissage.'
              : `${learnedRules.length} règle(s) apprises de vos corrections.`,
          rules_learned: learnedRules,
          stats: {
            total_corrections: learnedRules.length,
            feedback_recorded: true,
          },
        };
      } catch (error) {
        fastify.log.error('Feedback error:', error);
        return reply
          .status(500)
          .send({ error: 'Feedback recording failed', details: error.message });
      }
    }
  );

  /**
   * GET /ai/learning-stats
   * Statistiques d'apprentissage pour l'utilisateur
   */
  fastify.get('/learning-stats', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { userId } = request.user;

    try {
      const stats = await query(
        `
        SELECT
          (SELECT COUNT(*) FROM ai_corrections WHERE user_id = $1) as total_corrections,
          (SELECT COUNT(*) FROM ai_corrections WHERE user_id = $1 AND applied_count > 0) as rules_applied,
          (SELECT COUNT(*) FROM learned_entities WHERE user_id = $1) as entities_learned,
          (SELECT COUNT(*) FROM user_patterns WHERE user_id = $1 AND is_active = true) as active_patterns,
          (SELECT COUNT(*) FROM ai_inbox_decisions WHERE user_id = $1 AND user_feedback = 'correct') as correct_decisions,
          (SELECT COUNT(*) FROM ai_inbox_decisions WHERE user_id = $1 AND user_feedback IS NOT NULL) as total_feedback,
          (SELECT AVG(CASE user_feedback
            WHEN 'correct' THEN 1.0
            WHEN 'partial' THEN 0.5
            WHEN 'incorrect' THEN 0.0
          END) FROM ai_inbox_decisions WHERE user_id = $1 AND user_feedback IS NOT NULL) as accuracy_rate
        `,
        [userId]
      );

      const recentCorrections = await query(
        `
        SELECT corrected_field, original_value, corrected_value, learned_rule, created_at
        FROM ai_corrections
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 5
      `,
        [userId]
      );

      return {
        stats: stats.rows[0],
        recent_corrections: recentCorrections.rows,
        learning_health:
          stats.rows[0].accuracy_rate >= 0.8
            ? 'excellent'
            : stats.rows[0].accuracy_rate >= 0.6
              ? 'good'
              : 'learning',
      };
    } catch (error) {
      fastify.log.error('Learning stats error:', error);
      return reply.status(500).send({ error: 'Failed to get learning stats' });
    }
  });

  /**
   * POST /ai/suggestion-feedback/:suggestionId
   * Feedback sur une suggestion proactive
   */
  fastify.post(
    '/suggestion-feedback/:suggestionId',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;
      const { suggestionId } = request.params;
      const { action } = request.body; // 'accepted' | 'dismissed' | 'snoozed'

      try {
        await query(
          `UPDATE proactive_suggestions
         SET status = $1, acted_at = NOW()
         WHERE id = $2 AND user_id = $3`,
          [action, suggestionId, userId]
        );

        // Si accepté, augmenter le score des suggestions similaires
        if (action === 'accepted') {
          const suggestion = await query(
            `SELECT suggestion_type, trigger_context FROM proactive_suggestions WHERE id = $1`,
            [suggestionId]
          );

          if (suggestion.rows.length > 0) {
            // Enregistrer comme pattern positif
            await query(
              `INSERT INTO user_patterns (user_id, pattern_type, pattern_data, is_active, success_count)
             VALUES ($1, 'suggestion_preference', $2, true, 1)
             ON CONFLICT (user_id, pattern_type, pattern_data)
             DO UPDATE SET success_count = user_patterns.success_count + 1`,
              [userId, JSON.stringify({ type: suggestion.rows[0].suggestion_type })]
            );
          }
        }

        return { success: true, action };
      } catch (error) {
        fastify.log.error('Suggestion feedback error:', error);
        return reply.status(500).send({ error: 'Suggestion feedback failed' });
      }
    }
  );

  // ============================================================================
  // PROCESS STREAM - SSE Streaming avec QUASAR v5 (ULTRA RAPIDE)
  // ============================================================================
  // Endpoint optimisé pour feedback instantané:
  // 1. Stage 1 (Haiku): Preview rapide en ~300ms
  // 2. Stage 2 (Sonnet): Enrichissement si nécessaire
  // 3. DB Save: Sauvegarde et retour final
  fastify.post(
    '/process-stream',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;
      const { text } = request.body;
      const startTime = Date.now();

      if (!text || text.trim().length === 0) {
        return reply.status(400).send({ error: 'Missing text' });
      }

      // Setup SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      const sendEvent = (type, data) => {
        reply.raw.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
      };

      try {
        // ===== 1. CHARGER CONTEXTE =====
        const [projectsResult, tagsResult, membersResult] = await Promise.all([
          query("SELECT name FROM projects WHERE user_id = $1 AND status != 'archived'", [userId]),
          query('SELECT name FROM tags WHERE user_id = $1', [userId]),
          query('SELECT name FROM team_members WHERE user_id = $1 AND active = TRUE', [userId]),
        ]);

        const context = {
          activeProjects: projectsResult.rows.map(p => p.name),
          existingTags: tagsResult.rows.map(t => t.name),
          teamMembers: membersResult.rows.map(m => m.name),
        };

        // Charger profil/mémoire si disponible
        try {
          const profileResult = await query('SELECT * FROM user_profiles WHERE user_id = $1', [
            userId,
          ]);
          if (profileResult.rows.length > 0) {
            const p = profileResult.rows[0];
            context.userProfile = {
              profession: p.profession,
              domain: p.domain,
              vocabulary: p.vocabulary,
            };
          }

          const correctionsResult = await query(
            'SELECT corrected_field, original_value, corrected_value FROM ai_corrections WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5',
            [userId]
          );
          if (correctionsResult.rows.length > 0) {
            context.memoryContext = { corrections_history: correctionsResult.rows };
          }
        } catch {
          // Tables pas encore créées
        }

        // ===== 2. ROUTING INTELLIGENT =====
        const routing = quasar.routeToModel(text, context);
        sendEvent('routing', {
          model: routing.model,
          complexity: routing.complexity,
          reasons: routing.reasons,
        });

        // ===== 3. STAGE 1: FAST PARSE (Haiku) =====
        const temporal = quasar.getTemporalContextWithTimezone('Europe/Paris');

        const stage1Start = Date.now();
        const stage1Result = await quasar.stage1FastParse(anthropic, text, temporal, 'fr');
        const stage1Latency = Date.now() - stage1Start;

        // Envoyer preview immédiatement
        sendEvent('preview', {
          items: stage1Result.parsed?.items || [],
          latency_ms: stage1Latency,
        });

        let finalResult = stage1Result.parsed;

        // ===== 4. STAGE 2: ENRICHISSEMENT (Sonnet) si nécessaire =====
        if (routing.useEnrichment && stage1Result.parsed?.items?.length > 0) {
          const stage2Start = Date.now();
          const stage2Result = await quasar.stage2Enrich(
            anthropic,
            stage1Result.parsed.items,
            text,
            temporal,
            'fr',
            context
          );
          const stage2Latency = Date.now() - stage2Start;

          finalResult = stage2Result.enriched;

          sendEvent('enriched', {
            items: finalResult?.items || [],
            suggestions: finalResult?.suggestions || [],
            latency_ms: stage2Latency,
            cache_hit: stage2Result.cacheHit,
          });
        }

        // ===== 5. SAUVEGARDE EN BDD =====
        const itemsCreated = [];
        const items = finalResult?.items || [];

        for (const item of items) {
          try {
            if (item.type === 'task' || item.type === 'event') {
              const taskDate = item.date || temporal.currentDate;

              const taskResult = await query(
                `INSERT INTO tasks (user_id, text, date, urgent, owner, is_event, start_time, end_time, location, done)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                 RETURNING *`,
                [
                  userId,
                  item.text,
                  taskDate,
                  item.urgent || false,
                  item.owner || 'Moi',
                  item.type === 'event',
                  item.start_time || null,
                  item.end_time || null,
                  item.location || null,
                  false,
                ]
              );

              const created = taskResult.rows[0];

              // Auto-sync Google Calendar si event
              if (item.type === 'event' && created.start_time) {
                const syncResult = await syncEventToGoogleInternal(fastify, userId, created);
                if (syncResult.success && syncResult.eventId) {
                  await query('UPDATE tasks SET google_event_id = $1 WHERE id = $2', [
                    syncResult.eventId,
                    created.id,
                  ]);
                  created.google_event_id = syncResult.eventId;
                }
              }

              itemsCreated.push({
                type: item.type,
                id: created.id,
                text: created.text,
                date: created.date,
                start_time: created.start_time,
                end_time: created.end_time,
                urgent: created.urgent,
                google_synced: !!created.google_event_id,
              });
            } else if (item.type === 'note') {
              const noteResult = await query(
                `INSERT INTO notes (user_id, title, content, color, is_pinned)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING *`,
                [userId, item.title || 'Note', item.content || '', item.color || null, false]
              );

              itemsCreated.push({
                type: 'note',
                id: noteResult.rows[0].id,
                title: noteResult.rows[0].title,
              });
            }
          } catch (itemError) {
            fastify.log.error('Error creating item:', itemError);
          }
        }

        // ===== 6. SAUVEGARDER SUGGESTIONS PROACTIVES =====
        const suggestions = finalResult?.suggestions || [];
        const savedSuggestions = [];

        try {
          for (const suggestion of suggestions.slice(0, 5)) {
            if ((suggestion.score || 0) >= 0.6) {
              const sugResult = await query(
                `INSERT INTO proactive_suggestions
                 (user_id, suggestion_type, suggested_task, suggested_date, priority_score, reason, status)
                 VALUES ($1, $2, $3, $4, $5, $6, 'pending')
                 RETURNING id`,
                [
                  userId,
                  suggestion.type,
                  suggestion.task,
                  suggestion.date || null,
                  suggestion.score,
                  suggestion.reason,
                ]
              );
              savedSuggestions.push({
                id: sugResult.rows[0].id,
                ...suggestion,
              });
            }
          }
        } catch {
          // Table pas encore créée
        }

        // ===== 7. TRACKING =====
        const processingTime = Date.now() - startTime;

        await query(
          `INSERT INTO ai_inbox_decisions (user_id, input_text, ai_response, items_created, processing_time_ms)
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, text, JSON.stringify(finalResult), JSON.stringify(itemsCreated), processingTime]
        );

        // ===== 8. ENVOI FINAL =====
        sendEvent('complete', {
          items: itemsCreated,
          suggestions: savedSuggestions,
          stats: {
            total: itemsCreated.length,
            tasks: itemsCreated.filter(i => i.type === 'task').length,
            events: itemsCreated.filter(i => i.type === 'event').length,
            notes: itemsCreated.filter(i => i.type === 'note').length,
            suggestions: savedSuggestions.length,
          },
          processing_time_ms: processingTime,
          routing: {
            model: routing.model,
            complexity: routing.complexity,
          },
        });

        reply.raw.end();
      } catch (error) {
        fastify.log.error('Process stream error:', error);
        sendEvent('error', { message: error.message });
        reply.raw.end();
      }
    }
  );

  // ============================================================================
  // GET SUGGESTIONS - Récupérer les suggestions proactives en attente
  // ============================================================================
  fastify.get('/suggestions', { preHandler: [fastify.authenticate] }, async request => {
    const { userId } = request.user;

    const result = await query(
      `SELECT id, suggestion_type, suggested_task, suggested_date, priority_score, reason, created_at
       FROM proactive_suggestions
       WHERE user_id = $1 AND status = 'pending'
       ORDER BY priority_score DESC
       LIMIT 10`,
      [userId]
    );

    return { suggestions: result.rows };
  });
}
