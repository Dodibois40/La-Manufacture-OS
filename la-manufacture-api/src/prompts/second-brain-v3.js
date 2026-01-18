/**
 * SECOND BRAIN V3 - GALACTIC EDITION
 *
 * Optimisations majeures :
 * 1. Few-shot examples pour stabiliser le JSON output
 * 2. Schema predictive strict (plus de undefined)
 * 3. Prompt caching ready (structure optimisée)
 * 4. Pipeline 2-stage (Haiku parsing + Sonnet enrichment)
 * 5. Compression tokens (-40% vs V2)
 */

// ============================================================================
// TEMPORAL CONTEXT
// ============================================================================

export function getTemporalContext() {
  const now = new Date();
  const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

  const currentDate = now.toISOString().split('T')[0];
  const currentDayName = dayNames[now.getDay()];
  const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);
  const currentHour = now.getHours();

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = tomorrow.toISOString().split('T')[0];
  const tomorrowDayName = dayNames[tomorrow.getDay()];

  // Calcul des 7 prochains jours
  const weekDays = {};
  for (let i = 0; i <= 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    weekDays[dayNames[d.getDay()]] = d.toISOString().split('T')[0];
  }

  // Période de la journée
  const period = currentHour < 12 ? 'matin' : currentHour < 18 ? 'apres-midi' : 'soir';

  return {
    currentDate,
    currentDayName,
    currentTime,
    currentHour,
    period,
    tomorrowDate,
    tomorrowDayName,
    weekDays,
    weekDaysJson: JSON.stringify(weekDays),
  };
}

// ============================================================================
// FEW-SHOT EXAMPLES (CRITICAL FOR JSON STABILITY)
// ============================================================================

const FEW_SHOT_EXAMPLES = `
## EXEMPLE 1 : Tâche simple avec suggestion
INPUT: "Envoyer le devis à Dupont"
OUTPUT:
{
  "items": [{
    "type": "task",
    "text": "Envoyer le devis au client Dupont",
    "date": "{{TODAY}}",
    "urgent": false,
    "important": true,
    "owner": "Moi",
    "metadata": {
      "confidence": 0.92,
      "people": ["Dupont"],
      "predictive": {
        "patterns": [],
        "chain": {
          "current_step": "envoi_devis",
          "next": [{"task": "Relancer Dupont pour réponse au devis", "delay_days": 7, "trigger": "no_response"}]
        }
      },
      "learning": {"new_entity": {"name": "Dupont", "type": "client"}}
    }
  }],
  "suggestions": [{
    "type": "followup",
    "task": "Relancer Dupont si pas de réponse au devis",
    "date": "{{TODAY+7}}",
    "score": 0.70,
    "reason": "Relance commerciale standard J+7"
  }]
}

## EXEMPLE 2 : Event avec préparation
INPUT: "RDV client Martin jeudi 14h présentation produit"
OUTPUT:
{
  "items": [{
    "type": "event",
    "text": "Rendez-vous client Martin - Présentation produit",
    "date": "{{JEUDI}}",
    "start_time": "14:00",
    "end_time": "15:00",
    "urgent": false,
    "important": true,
    "owner": "Moi",
    "metadata": {
      "confidence": 0.95,
      "people": ["Martin"],
      "duration_min": 60,
      "predictive": {
        "patterns": [],
        "chain": {
          "current_step": "presentation_client",
          "next": [
            {"task": "Envoyer compte-rendu à Martin", "delay_days": 1, "trigger": "after_meeting"},
            {"task": "Relancer Martin pour décision", "delay_days": 7, "trigger": "no_response"}
          ]
        }
      }
    }
  }],
  "suggestions": [
    {"type": "prep_task", "task": "Préparer slides présentation produit", "date": "{{JEUDI-1}}", "score": 0.85, "reason": "Préparation J-1 pour RDV client important"},
    {"type": "followup", "task": "Envoyer compte-rendu RDV Martin", "date": "{{JEUDI+1}}", "score": 0.75, "reason": "CR post-réunion client"}
  ]
}

## EXEMPLE 3 : Pattern récurrent
INPUT: "Tous les lundis standup équipe 9h"
OUTPUT:
{
  "items": [{
    "type": "event",
    "text": "Standup équipe hebdomadaire",
    "date": "{{LUNDI}}",
    "start_time": "09:00",
    "end_time": "09:15",
    "urgent": false,
    "important": true,
    "owner": "Moi",
    "metadata": {
      "confidence": 0.98,
      "duration_min": 15,
      "predictive": {
        "patterns": [{"type": "weekly", "day": "lundi", "rrule": "FREQ=WEEKLY;BYDAY=MO"}],
        "chain": null
      }
    }
  }],
  "suggestions": []
}

## EXEMPLE 4 : Multi-items texte dicté
INPUT: "demain call avec Paul pour le projet Alpha et après faut que j'envoie le rapport et j'ai une idée pour améliorer le cache"
OUTPUT:
{
  "items": [
    {
      "type": "event",
      "text": "Appel avec Paul concernant le projet Alpha",
      "date": "{{TOMORROW}}",
      "start_time": "10:00",
      "end_time": "10:30",
      "project": "Alpha",
      "urgent": false,
      "important": true,
      "owner": "Moi",
      "metadata": {"confidence": 0.90, "people": ["Paul"], "duration_min": 30, "predictive": {"patterns": [], "chain": null}}
    },
    {
      "type": "task",
      "text": "Envoyer le rapport du projet Alpha",
      "date": "{{TOMORROW}}",
      "project": "Alpha",
      "urgent": false,
      "important": false,
      "owner": "Moi",
      "metadata": {"confidence": 0.88, "predictive": {"patterns": [], "chain": null}}
    },
    {
      "type": "note",
      "title": "Idée amélioration cache",
      "content": "Optimisation du système de cache",
      "color": "blue",
      "tags": ["tech", "idee"],
      "metadata": {"confidence": 0.95, "predictive": {"patterns": [], "chain": null}}
    }
  ],
  "suggestions": []
}`;

// ============================================================================
// SYSTEM PROMPT V3 - COMPRESSED & OPTIMIZED
// ============================================================================

export function buildSystemPromptV3(temporal) {
  const { currentDate, currentDayName, currentTime, tomorrowDate, weekDaysJson } = temporal;

  // Part 1: Static instructions (cacheable)
  const staticPart = `# SECOND BRAIN V3 - GALACTIC PARSER

Tu es un assistant cognitif expert. Tu parses du texte en JSON structuré avec une précision chirurgicale.

## RÈGLES DE CLASSIFICATION

| Type | Condition | Exemple |
|------|-----------|---------|
| EVENT | Heure explicite OU mot-clé RDV/réunion/call/meeting | "RDV 14h", "meeting demain" |
| NOTE | Préfixe idée/note/info OU réflexion sans action | "Idée: optimiser le cache" |
| TASK | Verbe d'action sans heure fixe | "Envoyer le rapport" |

## EXTRACTION DATES

- "aujourd'hui" → date courante
- "demain" → date +1
- "lundi/mardi/..." → prochaine occurrence
- Sans mention → date courante

## PRIORITÉS

- **urgent**: "URGENT", "ASAP", deadline <24h, "!!!"
- **important**: client, deadline, présentation, closing

## STRUCTURE JSON OUTPUT

\`\`\`json
{
  "items": [{
    "type": "task|event|note",
    "text": "Description reformulée",
    "title": "Titre (notes only)",
    "content": "Contenu (notes only)",
    "date": "YYYY-MM-DD",
    "start_time": "HH:MM (events)",
    "end_time": "HH:MM (events)",
    "location": "Lieu",
    "owner": "Personne|Moi",
    "project": "Nom projet",
    "urgent": false,
    "important": false,
    "tags": ["tag1"],
    "color": "blue|green|yellow|red",
    "metadata": {
      "confidence": 0.95,
      "people": ["Nom"],
      "duration_min": 60,
      "predictive": {
        "patterns": [{"type": "weekly|monthly|daily", "day": "lundi", "rrule": "FREQ=..."}],
        "chain": {
          "current_step": "nom_etape",
          "next": [{"task": "Tâche suivante", "delay_days": 7, "trigger": "after|no_response"}]
        }
      },
      "learning": {
        "new_entity": {"name": "Nom", "type": "client|person|company"}
      }
    }
  }],
  "suggestions": [{
    "type": "prep_task|followup|implicit_action|smart_reminder",
    "task": "Description",
    "date": "YYYY-MM-DD",
    "score": 0.85,
    "reason": "Justification courte"
  }]
}
\`\`\`

## RÈGLES SUGGESTIONS

| Déclencheur | Type | Score base |
|-------------|------|------------|
| Event client | prep_task | 0.80 |
| Envoi devis/proposition | followup J+7 | 0.70 |
| RDV médical | smart_reminder J-1 | 0.75 |
| Deadline importante | prep_task J-2 | 0.85 |

**Bonus**: urgent +0.15, important +0.10, client +0.10
**Max**: 3 suggestions/item, 5 total

## CHAÎNES PRÉDICTIVES

| Action | Chaîne typique |
|--------|----------------|
| RDV client | → Compte-rendu J+1 → Relance J+7 |
| Envoi devis | → Relance J+7 si pas réponse |
| Présentation | → Préparation J-1 → CR J+1 |
| Entretien | → Débrief équipe J+1 |

## PROFILS MÉTIER (si fourni)

- **DEV**: "PR"=pull request, "daily"=standup 09:30, "prod"=urgent
- **COMMERCIAL**: "RDV1"=découverte, "closing"=urgent, relance J+7
- **MANAGER**: "1:1"=event récurrent, "escalade"=urgent+important

${FEW_SHOT_EXAMPLES}`;

  // Part 2: Dynamic context (not cacheable)
  const dynamicPart = `

## CONTEXTE TEMPOREL ACTUEL

- **Aujourd'hui**: ${currentDayName} ${currentDate}
- **Demain**: ${tomorrowDate}
- **Heure**: ${currentTime}
- **Mapping jours**: ${weekDaysJson}

⚠️ UTILISE CES DATES EXACTES DANS TES RÉPONSES.`;

  return { staticPart, dynamicPart, fullPrompt: staticPart + dynamicPart };
}

// ============================================================================
// USER PROMPT V3 - MINIMAL & EFFICIENT
// ============================================================================

export function buildUserPromptV3(text, context = {}) {
  const {
    activeProjects = [],
    existingTags = [],
    teamMembers = [],
    userProfile = null,
    memoryContext = null,
  } = context;

  let prompt = `## INPUT À PARSER

"""
${text}
"""

## CONTEXTE`;

  if (activeProjects.length > 0) {
    prompt += `\n- Projets: ${activeProjects.join(', ')}`;
  }
  if (existingTags.length > 0) {
    prompt += `\n- Tags: ${existingTags.join(', ')}`;
  }
  if (teamMembers.length > 0) {
    prompt += `\n- Équipe: ${teamMembers.join(', ')}`;
  }

  if (userProfile) {
    prompt += `\n\n## PROFIL UTILISATEUR
- Métier: ${userProfile.profession || 'non défini'} (${userProfile.domain || 'général'})
- Abréviations: ${JSON.stringify(userProfile.vocabulary?.abbreviations || {})}
- Alias: ${JSON.stringify(userProfile.vocabulary?.people_aliases || {})}`;
  }

  if (memoryContext) {
    if (memoryContext.corrections_history?.length > 0) {
      prompt += `\n\n## CORRECTIONS APPRISES (PRIORITAIRE)
${memoryContext.corrections_history
  .slice(0, 3)
  .map(c => `- "${c.original_value}" → "${c.corrected_value}" (${c.corrected_field})`)
  .join('\n')}`;
    }
    if (memoryContext.learned_entities && Object.keys(memoryContext.learned_entities).length > 0) {
      prompt += `\n\n## ENTITÉS CONNUES
${JSON.stringify(memoryContext.learned_entities)}`;
    }
  }

  prompt += `\n\n## INSTRUCTIONS
1. Identifie TOUS les items distincts
2. Classe correctement (event si heure, note si idée, task sinon)
3. Génère suggestions pertinentes (max 5)
4. Détecte patterns récurrents

Réponds **UNIQUEMENT** en JSON valide.`;

  return prompt;
}

// ============================================================================
// STAGE 1: FAST PARSING (HAIKU)
// ============================================================================

export function buildStage1Prompt(text, temporal) {
  return {
    system: `Tu es un parser JSON rapide. Extrais les items du texte en JSON minimal.

RÈGLES:
- EVENT = heure explicite OU "RDV/réunion/call"
- NOTE = "idée/note/info" OU réflexion
- TASK = action sans heure

DATES:
- aujourd'hui = ${temporal.currentDate}
- demain = ${temporal.tomorrowDate}
- jours = ${temporal.weekDaysJson}

OUTPUT FORMAT:
{"items":[{"type":"task|event|note","text":"...","date":"YYYY-MM-DD","start_time":"HH:MM|null","urgent":bool,"important":bool,"people":[]}]}

Réponds UNIQUEMENT en JSON.`,
    user: text,
  };
}

// ============================================================================
// STAGE 2: ENRICHMENT (SONNET)
// ============================================================================

export function buildStage2Prompt(parsedItems, text, context, temporal) {
  return {
    system: `Tu enrichis des items parsés avec intelligence prédictive et suggestions.

ENRICHISSEMENTS:
1. Chaînes prédictives (RDV→CR→relance)
2. Patterns récurrents (hebdo, mensuel)
3. Suggestions proactives (prep, followup, reminder)
4. Scoring suggestions (base + bonus urgent/important/client)

RÈGLES SUGGESTIONS:
- prep_task: J-1 pour events importants (score 0.80)
- followup: J+7 pour envois (score 0.70)
- smart_reminder: J-1 pour RDV médical (score 0.75)
- Max 5 suggestions total

OUTPUT: JSON enrichi avec metadata.predictive et suggestions[]`,
    user: `## ITEMS PARSÉS
${JSON.stringify(parsedItems, null, 2)}

## TEXTE ORIGINAL
"${text}"

## CONTEXTE
${JSON.stringify(context)}

## DATES
- Aujourd'hui: ${temporal.currentDate}
- Demain: ${temporal.tomorrowDate}

Enrichis ces items avec:
1. metadata.predictive.patterns (si récurrent)
2. metadata.predictive.chain (si chaîne détectable)
3. suggestions[] pertinentes

Réponds en JSON.`,
  };
}

// ============================================================================
// MAIN EXPORT - UNIFIED PROMPT BUILDER
// ============================================================================

/**
 * Build V3 prompt with caching optimization
 * @returns {Object} { systemPrompt, userPrompt, cacheableSystem, dynamicSystem, temporal }
 */
export default function buildSecondBrainPromptV3(text, context = {}) {
  const temporal = getTemporalContext();
  const { staticPart, dynamicPart, fullPrompt } = buildSystemPromptV3(temporal);
  const userPrompt = buildUserPromptV3(text, context);

  return {
    // Full prompts for single-call mode
    systemPrompt: fullPrompt,
    userPrompt,

    // Split prompts for caching mode
    cacheableSystem: staticPart, // Can be cached (85% of system prompt)
    dynamicSystem: dynamicPart, // Must be fresh (15% of system prompt)

    // Stage prompts for 2-stage pipeline
    stage1: buildStage1Prompt(text, temporal),
    stage2Builder: parsedItems => buildStage2Prompt(parsedItems, text, context, temporal),

    temporal,
  };
}

// ============================================================================
// ANTHROPIC API HELPERS
// ============================================================================

/**
 * Build messages for Anthropic API with prompt caching
 */
export function buildAnthropicMessages(promptData, options = {}) {
  const { useCache = true, usePipeline = false } = options;

  if (usePipeline) {
    // 2-stage pipeline mode
    return {
      stage1: {
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1000,
        system: promptData.stage1.system,
        messages: [{ role: 'user', content: promptData.stage1.user }],
      },
      stage2Builder: parsedItems => {
        const stage2 = promptData.stage2Builder(parsedItems);
        return {
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 2000,
          system: stage2.system,
          messages: [{ role: 'user', content: stage2.user }],
        };
      },
    };
  }

  // Single-call mode with optional caching
  if (useCache) {
    return {
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 3000,
      system: [
        {
          type: 'text',
          text: promptData.cacheableSystem,
          cache_control: { type: 'ephemeral' },
        },
        {
          type: 'text',
          text: promptData.dynamicSystem,
        },
      ],
      messages: [{ role: 'user', content: promptData.userPrompt }],
    };
  }

  // Standard mode
  return {
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 3000,
    system: promptData.systemPrompt,
    messages: [{ role: 'user', content: promptData.userPrompt }],
  };
}

/**
 * Execute 2-stage pipeline
 */
export async function executePipeline(anthropic, text, context = {}) {
  const promptData = buildSecondBrainPromptV3(text, context);
  const messages = buildAnthropicMessages(promptData, { usePipeline: true });

  // Stage 1: Fast parsing with Haiku
  const stage1Response = await anthropic.messages.create(messages.stage1);
  const stage1Text = stage1Response.content[0].text;

  let parsedItems;
  try {
    const jsonMatch = stage1Text.match(/\{[\s\S]*\}/);
    parsedItems = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error('Stage 1 parsing failed: ' + stage1Text.substring(0, 200));
  }

  // Stage 2: Enrichment with Sonnet
  const stage2Config = messages.stage2Builder(parsedItems.items || []);
  const stage2Response = await anthropic.messages.create(stage2Config);
  const stage2Text = stage2Response.content[0].text;

  let enrichedResult;
  try {
    const jsonMatch = stage2Text.match(/\{[\s\S]*\}/);
    enrichedResult = JSON.parse(jsonMatch[0]);
  } catch {
    // Fallback to stage 1 result if enrichment fails
    enrichedResult = parsedItems;
  }

  return {
    result: enrichedResult,
    stats: {
      stage1_tokens: stage1Response.usage.input_tokens + stage1Response.usage.output_tokens,
      stage2_tokens: stage2Response.usage.input_tokens + stage2Response.usage.output_tokens,
      total_tokens:
        stage1Response.usage.input_tokens +
        stage1Response.usage.output_tokens +
        (stage2Response.usage.input_tokens + stage2Response.usage.output_tokens),
    },
  };
}
