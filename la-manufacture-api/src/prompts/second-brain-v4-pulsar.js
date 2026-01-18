/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║           🌟 SECOND BRAIN V4 - PULSAR EDITION 🌟                               ║
 * ║          Apple • Android • Samsung • Xiaomi • Universal                        ║
 * ╠═══════════════════════════════════════════════════════════════════════════════╣
 * ║  Features:                                                                     ║
 * ║  • Streaming responses for instant UI feedback                                 ║
 * ║  • Zod JSON Schema validation                                                  ║
 * ║  • Multi-language (FR/EN/ES/DE) auto-detection                                ║
 * ║  • Offline fallback parser (regex-based)                                       ║
 * ║  • Apple integrations (EventKit, Reminders, Siri)                             ║
 * ║  • Google integrations (Calendar API, Tasks API, Assistant)                   ║
 * ║  • Samsung integrations (Calendar, Reminder, Bixby)                           ║
 * ║  • Xiaomi HyperOS support (Intents, Voice)                                    ║
 * ║  • Universal iCal/ICS export (RFC 5545)                                       ║
 * ║  • Telemetry & quality metrics                                                 ║
 * ║  • Graceful error recovery                                                     ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

import { z } from 'zod';

// ============================================================================
// ZOD SCHEMAS - STRICT JSON VALIDATION
// ============================================================================

export const PredictiveSchema = z.object({
  patterns: z
    .array(
      z.object({
        type: z.enum(['daily', 'weekly', 'monthly', 'yearly', 'conditional']),
        day: z.string().optional(),
        date: z.number().optional(),
        rrule: z.string().optional(),
      })
    )
    .default([]),
  chain: z
    .object({
      current_step: z.string(),
      next: z.array(
        z.object({
          task: z.string(),
          delay_days: z.number(),
          trigger: z.enum(['after', 'no_response', 'on_complete', 'on_cancel']),
        })
      ),
    })
    .nullable()
    .default(null),
});

export const MetadataSchema = z.object({
  confidence: z.number().min(0).max(1),
  people: z.array(z.string()).default([]),
  duration_min: z.number().optional(),
  predictive: PredictiveSchema.default({ patterns: [], chain: null }),
  learning: z
    .object({
      new_entity: z
        .object({
          name: z.string(),
          type: z.enum(['client', 'person', 'company', 'project', 'location']),
        })
        .optional(),
    })
    .default({}),
  source_lang: z.enum(['fr', 'en', 'es', 'de']).optional(),
});

export const ItemSchema = z.object({
  type: z.enum(['task', 'event', 'note']),
  text: z.string().optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .default(null),
  end_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .default(null),
  location: z.string().nullable().default(null),
  owner: z.string().default('Moi'),
  project: z.string().nullable().default(null),
  urgent: z.boolean().default(false),
  important: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  color: z.enum(['blue', 'green', 'yellow', 'red', 'purple', 'orange']).nullable().default(null),
  metadata: MetadataSchema,
  // Apple-specific fields
  apple: z
    .object({
      reminder_id: z.string().optional(),
      calendar_id: z.string().optional(),
      eventkit_ready: z.boolean().default(true),
      siri_speakable: z.string().optional(),
    })
    .default({ eventkit_ready: true }),
});

export const SuggestionSchema = z.object({
  type: z.enum(['prep_task', 'followup', 'implicit_action', 'smart_reminder', 'optimization']),
  task: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  score: z.number().min(0).max(1),
  reason: z.string(),
  auto_create: z.boolean().default(false),
});

export const ParseResultSchema = z.object({
  items: z.array(ItemSchema),
  suggestions: z.array(SuggestionSchema).default([]),
  meta: z.object({
    detected_lang: z.enum(['fr', 'en', 'es', 'de']),
    parse_mode: z.enum(['ai', 'offline', 'hybrid']),
    tokens_used: z.number().optional(),
    latency_ms: z.number().optional(),
    confidence_avg: z.number().optional(),
  }),
});

// ============================================================================
// MULTI-LANGUAGE SUPPORT - ROBUST DETECTION
// ============================================================================

/**
 * Language detection markers with weighted scoring
 * Higher weight = more distinctive for that language
 */
const LANG_MARKERS = {
  fr: {
    // Strong unique markers (weight 10) - ONLY exist in French
    unique: [
      "aujourd'hui",
      'demain',
      'rendez-vous',
      'réunion',
      'envoyer',
      'devis',
      'idée',
      'présenter',
      'prochain',
      'prochaine',
      'semaine',
      'mois',
      'année',
      'rappeler',
      'appeler',
      'nouveau',
      'nouvelle',
    ],
    // Articles & prepositions (weight 5) - Very French-specific
    grammar: [
      'le ',
      'la ',
      'les ',
      'un ',
      'une ',
      'des ',
      'du ',
      'au ',
      'aux ',
      'pour ',
      'avec ',
      'dans ',
      'sur ',
      'chez ',
      'vers ',
      ' et ',
      ' ou ',
      ' à ',
      ' de ',
      "l'",
      "d'",
      "j'",
      "qu'",
    ],
    // Days (weight 8)
    days: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'],
    // Common task words (weight 3)
    common: ['rdv', 'urgent', 'important', 'client', 'projet', 'call', 'meeting', 'note'],
  },
  en: {
    // Strong unique markers (weight 10) - ONLY exist in English
    unique: [
      'today',
      'tomorrow',
      'meeting',
      'appointment',
      'schedule',
      'deadline',
      'present',
      'send',
      'quote',
      'remember',
      'weekly',
      'monthly',
      'yearly',
      'week',
      'month',
      'year',
    ],
    // Articles & prepositions (weight 5) - Very English-specific
    grammar: [
      ' the ',
      ' a ',
      ' an ',
      ' to ',
      ' for ',
      ' with ',
      ' at ',
      ' on ',
      ' in ',
      ' from ',
      ' by ',
      ' and ',
      ' or ',
      ' of ',
    ],
    // Days (weight 8)
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    // Common task words (weight 3)
    common: ['urgent', 'important', 'client', 'project', 'call', 'note', 'idea'],
  },
  es: {
    // Strong unique markers (weight 10) - ONLY exist in Spanish
    unique: [
      'hoy',
      'mañana',
      'reunión',
      'cita',
      'enviar',
      'presupuesto',
      'presentar',
      'semana',
      'mes',
      'año',
      'llamar',
      'recordar',
      'nuevo',
      'nueva',
      'próximo',
      'próxima',
    ],
    // Articles & prepositions (weight 5) - Very Spanish-specific
    grammar: [
      ' el ',
      ' la ',
      ' los ',
      ' las ',
      ' un ',
      ' una ',
      ' unos ',
      ' unas ',
      ' del ',
      ' al ',
      ' para ',
      ' con ',
      ' en ',
      ' por ',
      ' y ',
      ' o ',
      ' de ',
      ' que ',
    ],
    // Days (weight 8)
    days: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'],
    // Common task words (weight 3)
    common: ['urgente', 'importante', 'cliente', 'proyecto', 'nota', 'idea'],
  },
  de: {
    // Strong unique markers (weight 10) - ONLY exist in German
    unique: [
      'heute',
      'morgen',
      'termin',
      'besprechung',
      'senden',
      'angebot',
      'präsentieren',
      'woche',
      'monat',
      'jahr',
      'anrufen',
      'erinnern',
      'neu',
      'neue',
      'nächste',
      'nächster',
    ],
    // Articles & prepositions (weight 5) - Very German-specific
    grammar: [
      ' der ',
      ' die ',
      ' das ',
      ' den ',
      ' dem ',
      ' ein ',
      ' eine ',
      ' einen ',
      ' einem ',
      ' einer ',
      ' für ',
      ' mit ',
      ' bei ',
      ' nach ',
      ' von ',
      ' zu ',
      ' und ',
      ' oder ',
      ' auf ',
      ' an ',
    ],
    // Days (weight 8)
    days: ['montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag', 'sonntag'],
    // Common task words (weight 3)
    common: ['dringend', 'wichtig', 'kunde', 'projekt', 'notiz', 'idee'],
  },
};

// Words that exist in multiple languages and should be ignored for detection
const AMBIGUOUS_WORDS = [
  'meeting',
  'call',
  'urgent',
  'client',
  'project',
  'note',
  'idea',
  'info',
  'martin',
  'dupont',
  'alpha',
  'web',
  'cache',
  'redis',
  'email',
  'mail',
];

export function detectLanguage(text) {
  const lower = ` ${text.toLowerCase()} `; // Add spaces for word boundary matching
  const scores = { fr: 0, en: 0, es: 0, de: 0 };

  for (const [lang, markers] of Object.entries(LANG_MARKERS)) {
    // Unique markers (weight 10)
    for (const word of markers.unique) {
      if (lower.includes(word.toLowerCase())) {
        scores[lang] += 10;
      }
    }

    // Grammar markers (weight 5)
    for (const pattern of markers.grammar) {
      const regex = new RegExp(pattern.toLowerCase(), 'g');
      const matches = lower.match(regex);
      if (matches) {
        scores[lang] += matches.length * 5;
      }
    }

    // Day names (weight 8)
    for (const day of markers.days) {
      if (lower.includes(day)) {
        scores[lang] += 8;
      }
    }

    // Common words (weight 3) - but only if not ambiguous
    for (const word of markers.common) {
      if (!AMBIGUOUS_WORDS.includes(word) && lower.includes(word)) {
        scores[lang] += 3;
      }
    }
  }

  // Find the language with highest score
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [bestLang, bestScore] = sorted[0];
  const [secondLang, secondScore] = sorted[1] || ['', 0];

  // Require a minimum score AND a clear winner (at least 1.5x the second place)
  if (bestScore >= 5 && bestScore >= secondScore * 1.3) {
    return bestLang;
  }

  // If no clear winner, use fallback detection based on character analysis
  return detectLanguageFallback(text);
}

/**
 * Fallback detection using character frequency and patterns
 */
function detectLanguageFallback(text) {
  const lower = text.toLowerCase();

  // Check for language-specific characters
  const hasAccentsFR = /[éèêëàâäùûüôîïç]/.test(lower);
  const hasAccentsES = /[áéíóúüñ¿¡]/.test(lower);
  const hasUmlautsDE = /[äöüß]/.test(lower);

  // Strong character indicators
  if (hasUmlautsDE) return 'de';
  if (lower.includes('ñ') || lower.includes('¿') || lower.includes('¡')) return 'es';
  if (hasAccentsFR && !hasAccentsES) return 'fr';
  if (hasAccentsES && !hasAccentsFR) return 'es';

  // Check common word endings
  const words = lower.split(/\s+/);
  let frCount = 0,
    enCount = 0,
    esCount = 0,
    deCount = 0;

  for (const word of words) {
    // French endings
    if (/(?:tion|ment|eur|euse|eux|ait|ais|aient|er|ez|ons)$/.test(word)) frCount++;
    // English endings
    if (/(?:ing|tion|ed|ly|ness|ment|er|est|ful|less)$/.test(word)) enCount++;
    // Spanish endings
    if (/(?:ción|mente|ado|ido|ar|er|ir|ando|iendo)$/.test(word)) esCount++;
    // German endings
    if (/(?:ung|heit|keit|lich|isch|chen|lein|bar|sam)$/.test(word)) deCount++;
  }

  const fallbackScores = { fr: frCount, en: enCount, es: esCount, de: deCount };
  const best = Object.entries(fallbackScores).sort((a, b) => b[1] - a[1])[0];

  return best[1] > 0 ? best[0] : 'fr'; // Default to French
}

// Keep LANG_PATTERNS for offline parser compatibility
const LANG_PATTERNS = {
  fr: {
    today: ["aujourd'hui", 'auj', 'ce jour'],
    tomorrow: ['demain'],
    urgent: ['urgent', 'asap', 'immédiatement', 'tout de suite', '!!!'],
    important: ['important', 'crucial', 'prioritaire', 'critique'],
    meeting: ['réunion', 'rdv', 'rendez-vous', 'meeting', 'call', 'appel'],
    note: ['note:', 'idée:', 'info:', 'à retenir:', '!'],
    days: { lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6, dimanche: 0 },
  },
  en: {
    today: ['today'],
    tomorrow: ['tomorrow'],
    urgent: ['urgent', 'asap', 'immediately', 'right now', '!!!'],
    important: ['important', 'crucial', 'priority', 'critical'],
    meeting: ['meeting', 'appointment', 'call', 'video call'],
    note: ['note:', 'idea:', 'info:', 'remember:', '!'],
    days: { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 0 },
  },
  es: {
    today: ['hoy'],
    tomorrow: ['mañana'],
    urgent: ['urgente', 'asap', 'inmediatamente', '!!!'],
    important: ['importante', 'crucial', 'prioritario', 'crítico'],
    meeting: ['reunión', 'cita', 'llamada', 'videollamada'],
    note: ['nota:', 'idea:', 'info:', 'recordar:', '!'],
    days: { lunes: 1, martes: 2, miércoles: 3, jueves: 4, viernes: 5, sábado: 6, domingo: 0 },
  },
  de: {
    today: ['heute'],
    tomorrow: ['morgen'],
    urgent: ['dringend', 'asap', 'sofort', '!!!'],
    important: ['wichtig', 'kritisch', 'priorität'],
    meeting: ['besprechung', 'termin', 'meeting', 'anruf'],
    note: ['notiz:', 'idee:', 'info:', 'merken:', '!'],
    days: {
      montag: 1,
      dienstag: 2,
      mittwoch: 3,
      donnerstag: 4,
      freitag: 5,
      samstag: 6,
      sonntag: 0,
    },
  },
};

// ============================================================================
// TEMPORAL CONTEXT
// ============================================================================

export function getTemporalContext() {
  const now = new Date();
  const dayNames = {
    fr: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
    en: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    es: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
    de: ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag'],
  };

  const currentDate = now.toISOString().split('T')[0];
  const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = tomorrow.toISOString().split('T')[0];

  // Build week mapping for all languages
  const weekDays = {};
  for (const lang of Object.keys(dayNames)) {
    weekDays[lang] = {};
    for (let i = 0; i <= 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      weekDays[lang][dayNames[lang][d.getDay()]] = d.toISOString().split('T')[0];
    }
  }

  return {
    currentDate,
    currentTime,
    tomorrowDate,
    currentDayName: dayNames.fr[now.getDay()],
    weekDays,
    iso: now.toISOString(),
  };
}

// ============================================================================
// OFFLINE FALLBACK PARSER (REGEX-BASED)
// ============================================================================

export function parseOffline(text, lang = 'fr') {
  const temporal = getTemporalContext();
  const patterns = LANG_PATTERNS[lang];
  const items = [];
  const lower = text.toLowerCase();

  // Split by common separators
  const segments = text
    .split(/[+,;]|\bet\b|\band\b|\by\b|\bund\b/i)
    .map(s => s.trim())
    .filter(Boolean);

  for (const segment of segments) {
    const segLower = segment.toLowerCase();
    const item = {
      type: 'task',
      text: segment.charAt(0).toUpperCase() + segment.slice(1),
      date: temporal.currentDate,
      start_time: null,
      end_time: null,
      location: null,
      owner: 'Moi',
      project: null,
      urgent: false,
      important: false,
      tags: [],
      color: null,
      metadata: {
        confidence: 0.6,
        people: [],
        predictive: { patterns: [], chain: null },
        learning: {},
        source_lang: lang,
      },
      apple: { eventkit_ready: true },
    };

    // Detect type
    const hasTime = /\b(\d{1,2})[h:](\d{2})?\b/.test(segLower);
    const hasMeetingWord = patterns.meeting.some(w => segLower.includes(w));
    const hasNotePrefix = patterns.note.some(w => segLower.startsWith(w));

    if (hasNotePrefix || segLower.includes('idée') || segLower.includes('idea')) {
      item.type = 'note';
      item.title = item.text;
      item.content = '';
      item.color = 'blue';
    } else if (hasTime || hasMeetingWord) {
      item.type = 'event';
      // Extract time
      const timeMatch = segLower.match(/\b(\d{1,2})[h:](\d{2})?\b/);
      if (timeMatch) {
        const hours = timeMatch[1].padStart(2, '0');
        const mins = (timeMatch[2] || '00').padStart(2, '0');
        item.start_time = `${hours}:${mins}`;
        // Default duration
        item.end_time = `${String(parseInt(hours) + 1).padStart(2, '0')}:${mins}`;
      } else {
        item.start_time = '09:00';
        item.end_time = '10:00';
      }
    }

    // Detect date
    if (patterns.tomorrow.some(w => segLower.includes(w))) {
      item.date = temporal.tomorrowDate;
    } else {
      for (const [dayName, dayDate] of Object.entries(
        temporal.weekDays[lang] || temporal.weekDays.fr
      )) {
        if (segLower.includes(dayName)) {
          item.date = dayDate;
          break;
        }
      }
    }

    // Detect urgency/importance
    item.urgent = patterns.urgent.some(w => segLower.includes(w));
    item.important = patterns.important.some(w => segLower.includes(w)) || item.urgent;

    // Extract people (capitalized words)
    const peopleMatch = segment.match(/\b[A-Z][a-zà-ÿ]+\b/g);
    if (peopleMatch) {
      item.metadata.people = peopleMatch.filter(p => !['Moi', 'Je', 'I', 'Me'].includes(p));
    }

    items.push(item);
  }

  return {
    items,
    suggestions: [],
    meta: {
      detected_lang: lang,
      parse_mode: 'offline',
      confidence_avg: 0.6,
    },
  };
}

// ============================================================================
// SYSTEM PROMPT V4 - PULSAR
// ============================================================================

export function buildSystemPromptV4(temporal, lang = 'fr') {
  const langInstructions = {
    fr: 'Réponds en français. Reformule clairement.',
    en: 'Respond in English. Rephrase clearly.',
    es: 'Responde en español. Reformula claramente.',
    de: 'Antworte auf Deutsch. Formuliere klar um.',
  };

  return `# SECOND BRAIN V4 - PULSAR
Expert cognitive parser. Extract items from text with surgical precision.

## OUTPUT SCHEMA (STRICT - VALIDATE WITH ZOD)
\`\`\`typescript
{
  items: Array<{
    type: "task" | "event" | "note",
    text?: string,           // For task/event
    title?: string,          // For note
    content?: string,        // For note
    date: "YYYY-MM-DD",
    start_time: "HH:MM" | null,  // Required for events
    end_time: "HH:MM" | null,
    location: string | null,
    owner: string,           // Default "Moi"
    project: string | null,
    urgent: boolean,
    important: boolean,
    tags: string[],
    color: "blue"|"green"|"yellow"|"red"|"purple"|"orange" | null,
    metadata: {
      confidence: number,    // 0.0-1.0
      people: string[],
      duration_min?: number,
      predictive: {
        patterns: Array<{type: "daily"|"weekly"|"monthly", day?: string, rrule?: string}>,
        chain: {current_step: string, next: Array<{task: string, delay_days: number, trigger: "after"|"no_response"}>} | null
      },
      learning: {new_entity?: {name: string, type: "client"|"person"|"company"}}
    },
    apple: {eventkit_ready: true, siri_speakable?: string}
  }>,
  suggestions: Array<{
    type: "prep_task"|"followup"|"implicit_action"|"smart_reminder",
    task: string,
    date: "YYYY-MM-DD",
    score: number,  // 0.0-1.0
    reason: string
  }>,
  meta: {detected_lang: "fr"|"en"|"es"|"de"}
}
\`\`\`

## CLASSIFICATION RULES
| Type | Condition | Example |
|------|-----------|---------|
| EVENT | Explicit time OR meeting keyword | "RDV 14h", "meeting tomorrow" |
| NOTE | idea/note/info prefix OR reflection | "Idea: optimize cache" |
| TASK | Action verb without fixed time | "Send report" |

## DATES (USE EXACTLY)
- today = ${temporal.currentDate}
- tomorrow = ${temporal.tomorrowDate}
- ${Object.entries(temporal.weekDays.fr)
    .map(([d, date]) => `${d} = ${date}`)
    .join(', ')}

## PREDICTIVE CHAINS
| Action | Chain |
|--------|-------|
| Client meeting | → Summary D+1 → Follow-up D+7 |
| Send quote | → Follow-up D+7 if no response |
| Presentation | → Prep D-1 → Summary D+1 |

## SUGGESTIONS (max 5, score >= 0.6)
| Trigger | Type | Base Score |
|---------|------|------------|
| Client event | prep_task | 0.80 |
| Send quote/proposal | followup D+7 | 0.70 |
| Medical appointment | smart_reminder D-1 | 0.75 |
| Important deadline | prep_task D-2 | 0.85 |

Bonus: urgent +0.15, important +0.10, client +0.10

## APPLE INTEGRATION
- Generate siri_speakable: short phrase for Siri ("Rappel RDV Martin 14h")
- eventkit_ready: true for all items

## LANGUAGE
${langInstructions[lang]}

## CRITICAL RULES
1. NEVER return undefined values - use null or empty arrays
2. ALWAYS include metadata.predictive (even if empty: {patterns: [], chain: null})
3. ALWAYS validate dates are ISO format YYYY-MM-DD
4. ALWAYS include meta.detected_lang

Respond ONLY with valid JSON.`;
}

// ============================================================================
// USER PROMPT V4
// ============================================================================

export function buildUserPromptV4(text, context = {}, lang = 'fr') {
  const {
    activeProjects = [],
    teamMembers = [],
    userProfile = null,
    memoryContext = null,
  } = context;

  let prompt = `## INPUT\n"${text}"\n`;

  if (activeProjects.length > 0) {
    prompt += `\n## PROJECTS: ${activeProjects.join(', ')}`;
  }
  if (teamMembers.length > 0) {
    prompt += `\n## TEAM: ${teamMembers.join(', ')}`;
  }

  if (userProfile?.vocabulary?.abbreviations) {
    prompt += `\n## ABBREVIATIONS: ${JSON.stringify(userProfile.vocabulary.abbreviations)}`;
  }
  if (userProfile?.vocabulary?.people_aliases) {
    prompt += `\n## ALIASES: ${JSON.stringify(userProfile.vocabulary.people_aliases)}`;
  }

  if (memoryContext?.corrections_history?.length > 0) {
    prompt += `\n## LEARNED CORRECTIONS:\n${memoryContext.corrections_history
      .slice(0, 3)
      .map(c => `- "${c.original_value}" → "${c.corrected_value}"`)
      .join('\n')}`;
  }

  prompt += `\n\nParse and return JSON.`;
  return prompt;
}

// ============================================================================
// STREAMING SUPPORT
// ============================================================================

export async function* streamParse(anthropic, text, context = {}) {
  const lang = detectLanguage(text);
  const temporal = getTemporalContext();
  const systemPrompt = buildSystemPromptV4(temporal, lang);
  const userPrompt = buildUserPromptV4(text, context, lang);

  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  let buffer = '';
  let partialItems = [];

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta?.text) {
      buffer += event.delta.text;

      // Try to extract partial items as they stream
      const itemMatches = buffer.match(
        /"type"\s*:\s*"(task|event|note)"[^}]*"text"\s*:\s*"([^"]+)"/g
      );
      if (itemMatches && itemMatches.length > partialItems.length) {
        const newItem = itemMatches[itemMatches.length - 1];
        const typeMatch = newItem.match(/"type"\s*:\s*"(task|event|note)"/);
        const textMatch = newItem.match(/"text"\s*:\s*"([^"]+)"/);
        if (typeMatch && textMatch) {
          partialItems.push({ type: typeMatch[1], text: textMatch[1] });
          yield { type: 'partial_item', item: partialItems[partialItems.length - 1] };
        }
      }
    }
  }

  // Final parse
  try {
    const jsonMatch = buffer.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      result.meta = result.meta || { detected_lang: lang, parse_mode: 'ai' };
      yield { type: 'complete', result };
    }
  } catch (e) {
    yield { type: 'error', error: e.message, fallback: parseOffline(text, lang) };
  }
}

// ============================================================================
// MAIN PARSE FUNCTION WITH FALLBACK
// ============================================================================

export async function parsePulsar(anthropic, text, context = {}, options = {}) {
  const { useStreaming = false, timeout = 30000 } = options;
  const startTime = Date.now();
  const lang = detectLanguage(text);
  const temporal = getTemporalContext();

  // Telemetry
  const telemetry = {
    input_length: text.length,
    detected_lang: lang,
    start_time: startTime,
  };

  try {
    if (useStreaming) {
      // Streaming mode - return async generator
      return streamParse(anthropic, text, context);
    }

    // Standard mode with timeout
    const systemPrompt = buildSystemPromptV4(temporal, lang);
    const userPrompt = buildUserPromptV4(text, context, lang);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    clearTimeout(timeoutId);

    const responseText = response.content[0].text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    let result = JSON.parse(jsonMatch[0]);

    // Validate with Zod
    try {
      result = ParseResultSchema.parse({
        ...result,
        meta: {
          detected_lang: lang,
          parse_mode: 'ai',
          tokens_used: response.usage.input_tokens + response.usage.output_tokens,
          latency_ms: Date.now() - startTime,
          confidence_avg:
            result.items?.reduce((sum, i) => sum + (i.metadata?.confidence || 0.8), 0) /
            (result.items?.length || 1),
        },
      });
    } catch (zodError) {
      // Zod validation failed - fix common issues
      console.warn('Zod validation warning:', zodError.message);
      result = fixCommonIssues(result, lang, temporal);
    }

    // Add telemetry
    telemetry.latency_ms = Date.now() - startTime;
    telemetry.tokens_used = response.usage.input_tokens + response.usage.output_tokens;
    telemetry.items_count = result.items?.length || 0;
    telemetry.suggestions_count = result.suggestions?.length || 0;

    return { result, telemetry };
  } catch (error) {
    // Fallback to offline parser
    console.warn('AI parsing failed, using offline fallback:', error.message);

    const fallbackResult = parseOffline(text, lang);
    telemetry.latency_ms = Date.now() - startTime;
    telemetry.fallback_used = true;
    telemetry.error = error.message;

    return { result: fallbackResult, telemetry };
  }
}

// ============================================================================
// FIX COMMON ISSUES (POST-PROCESSING)
// ============================================================================

function fixCommonIssues(result, lang, temporal) {
  const fixed = {
    items: (result.items || []).map(item => ({
      type: item.type || 'task',
      text: item.text || item.title || '',
      title: item.title || null,
      content: item.content || null,
      date: item.date || temporal.currentDate,
      start_time: item.start_time || null,
      end_time: item.end_time || null,
      location: item.location || null,
      owner: item.owner || 'Moi',
      project: item.project || null,
      urgent: item.urgent || false,
      important: item.important || false,
      tags: item.tags || [],
      color: item.color || null,
      metadata: {
        confidence: item.metadata?.confidence || 0.8,
        people: item.metadata?.people || [],
        duration_min: item.metadata?.duration_min,
        predictive: {
          patterns: item.metadata?.predictive?.patterns || [],
          chain: item.metadata?.predictive?.chain || null,
        },
        learning: item.metadata?.learning || {},
        source_lang: lang,
      },
      apple: {
        eventkit_ready: true,
        siri_speakable: item.apple?.siri_speakable || generateSiriPhrase(item),
      },
    })),
    suggestions: (result.suggestions || []).map(s => ({
      type: s.type || 'prep_task',
      task: s.task || '',
      date: s.date || temporal.currentDate,
      score: s.score || 0.7,
      reason: s.reason || '',
      auto_create: s.auto_create || false,
    })),
    meta: {
      detected_lang: lang,
      parse_mode: 'ai',
      confidence_avg: 0.8,
    },
  };

  return fixed;
}

function generateSiriPhrase(item) {
  if (item.type === 'event') {
    const time = item.start_time ? ` à ${item.start_time.replace(':', 'h')}` : '';
    return `${item.text || item.title}${time}`;
  }
  return item.text || item.title || '';
}

// ============================================================================
// APPLE EVENTKIT EXPORT
// ============================================================================

export function toEventKitFormat(item) {
  if (item.type !== 'event') return null;

  const startDate = new Date(`${item.date}T${item.start_time || '09:00'}:00`);
  const endDate = item.end_time
    ? new Date(`${item.date}T${item.end_time}:00`)
    : new Date(startDate.getTime() + 60 * 60 * 1000);

  return {
    title: item.text || item.title,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    location: item.location,
    notes:
      item.metadata?.people?.length > 0 ? `Participants: ${item.metadata.people.join(', ')}` : null,
    alarms: item.important
      ? [{ relativeOffset: -60 * 60 }, { relativeOffset: -24 * 60 * 60 }]
      : [{ relativeOffset: -15 * 60 }],
    calendar: 'default',
  };
}

export function toRemindersFormat(item) {
  if (item.type !== 'task') return null;

  const dueDate = new Date(`${item.date}T23:59:59`);

  return {
    title: item.text,
    dueDate: dueDate.toISOString(),
    priority: item.urgent ? 1 : item.important ? 5 : 9,
    notes: item.project ? `Projet: ${item.project}` : null,
    flagged: item.urgent,
  };
}

// ============================================================================
// ANDROID / GOOGLE EXPORTS
// ============================================================================

/**
 * Google Calendar API v3 Event format
 * @see https://developers.google.com/calendar/api/v3/reference/events
 */
export function toGoogleCalendarFormat(item) {
  if (item.type !== 'event') return null;

  const startDateTime = `${item.date}T${item.start_time || '09:00'}:00`;
  const endDateTime = item.end_time
    ? `${item.date}T${item.end_time}:00`
    : `${item.date}T${item.start_time ? String(parseInt(item.start_time.split(':')[0]) + 1).padStart(2, '0') + ':' + item.start_time.split(':')[1] : '10:00'}:00`;

  return {
    summary: item.text || item.title,
    location: item.location || undefined,
    description: item.project ? `Projet: ${item.project}` : undefined,
    start: {
      dateTime: startDateTime,
      timeZone: 'Europe/Paris',
    },
    end: {
      dateTime: endDateTime,
      timeZone: 'Europe/Paris',
    },
    attendees: item.metadata?.people?.map(p => ({ displayName: p })) || undefined,
    reminders: {
      useDefault: false,
      overrides: item.important
        ? [
            { method: 'popup', minutes: 60 },
            { method: 'popup', minutes: 1440 },
          ]
        : [{ method: 'popup', minutes: 15 }],
    },
    colorId: item.urgent ? '11' : item.important ? '5' : undefined, // 11=red, 5=yellow
    status: 'confirmed',
    visibility: 'default',
  };
}

/**
 * Google Tasks API format
 * @see https://developers.google.com/tasks/reference/rest/v1/tasks
 */
export function toGoogleTasksFormat(item) {
  if (item.type !== 'task') return null;

  return {
    title: item.text,
    notes:
      [
        item.project ? `Projet: ${item.project}` : null,
        item.metadata?.people?.length > 0 ? `Avec: ${item.metadata.people.join(', ')}` : null,
        item.tags?.length > 0 ? `Tags: ${item.tags.join(', ')}` : null,
      ]
        .filter(Boolean)
        .join('\n') || undefined,
    due: `${item.date}T00:00:00.000Z`,
    status: 'needsAction',
    // Custom metadata in notes since Google Tasks API is limited
    metadata: {
      urgent: item.urgent,
      important: item.important,
      project: item.project,
      owner: item.owner,
    },
  };
}

/**
 * Android Intent extras format
 * For ACTION_INSERT calendar/tasks intents
 * @see https://developer.android.com/guide/topics/providers/calendar-provider
 */
export function toAndroidIntentFormat(item) {
  if (item.type === 'event') {
    const startMillis = new Date(`${item.date}T${item.start_time || '09:00'}:00`).getTime();
    const endMillis = item.end_time
      ? new Date(`${item.date}T${item.end_time}:00`).getTime()
      : startMillis + 60 * 60 * 1000;

    return {
      action: 'android.intent.action.INSERT',
      data: 'content://com.android.calendar/events',
      extras: {
        title: item.text || item.title,
        description: item.project ? `Projet: ${item.project}` : '',
        eventLocation: item.location || '',
        beginTime: startMillis,
        endTime: endMillis,
        allDay: false,
        // HyperOS/MIUI specific
        'com.miui.extra.START_TIME': startMillis,
        'com.miui.extra.END_TIME': endMillis,
        // Samsung specific
        'com.samsung.intent.extra.REMINDER_MINUTES': item.important ? 60 : 15,
      },
      type: 'vnd.android.cursor.item/event',
    };
  }

  if (item.type === 'task') {
    return {
      action: 'android.intent.action.INSERT',
      // Google Tasks deep link
      googleTasksUri: `https://tasks.google.com/add?title=${encodeURIComponent(item.text)}&due=${item.date}`,
      // Samsung Reminder intent
      samsungReminderExtras: {
        action: 'com.samsung.android.reminder.intent.action.ADD',
        extras: {
          title: item.text,
          dueDate: new Date(`${item.date}T23:59:59`).getTime(),
          priority: item.urgent ? 'HIGH' : item.important ? 'MEDIUM' : 'LOW',
          description: item.project || '',
        },
      },
      // Xiaomi HyperOS Tasks
      hyperOSExtras: {
        action: 'com.miui.tasks.intent.action.ADD',
        extras: {
          title: item.text,
          due_date: item.date,
          is_important: item.important || item.urgent,
          note: item.project || '',
        },
      },
      // Generic fallback
      extras: {
        title: item.text,
        description: item.project || '',
        dueDate: item.date,
      },
    };
  }

  // Note type
  return {
    action: 'android.intent.action.SEND',
    type: 'text/plain',
    extras: {
      'android.intent.extra.SUBJECT': item.title,
      'android.intent.extra.TEXT': item.content || item.title,
    },
    // Samsung Notes
    samsungNotesExtras: {
      action: 'com.samsung.android.app.notes.intent.action.NEW_NOTE',
      extras: {
        title: item.title,
        content: item.content || '',
      },
    },
    // Google Keep
    googleKeepUri: `https://keep.google.com/#create?title=${encodeURIComponent(item.title || '')}&text=${encodeURIComponent(item.content || '')}`,
  };
}

/**
 * Universal iCal/ICS format (RFC 5545)
 * Works with Google, Apple, Microsoft, Samsung, Xiaomi, etc.
 */
export function toICalFormat(item) {
  const uid = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}@lamanufacture.app`;
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  if (item.type === 'event') {
    const startTime = (item.start_time || '09:00').replace(':', '');
    const endTime = (item.end_time || '10:00').replace(':', '');
    const dateStr = item.date.replace(/-/g, '');

    let ical = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//La Manufacture//Second Brain V4 PULSAR//FR
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${now}
DTSTART:${dateStr}T${startTime}00
DTEND:${dateStr}T${endTime}00
SUMMARY:${escapeICalText(item.text || item.title)}`;

    if (item.location) {
      ical += `\nLOCATION:${escapeICalText(item.location)}`;
    }
    if (item.project) {
      ical += `\nDESCRIPTION:Projet: ${escapeICalText(item.project)}`;
    }
    if (item.metadata?.people?.length > 0) {
      for (const person of item.metadata.people) {
        ical += `\nATTENDEE;CN=${escapeICalText(person)}:MAILTO:`;
      }
    }
    if (item.important) {
      ical += `\nPRIORITY:1`;
    }
    if (item.urgent) {
      ical += `\nBEGIN:VALARM
ACTION:DISPLAY
TRIGGER:-PT1H
DESCRIPTION:Rappel urgent
END:VALARM`;
    }

    ical += `\nEND:VEVENT
END:VCALENDAR`;

    return ical;
  }

  if (item.type === 'task') {
    const dateStr = item.date.replace(/-/g, '');

    let ical = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//La Manufacture//Second Brain V4 PULSAR//FR
BEGIN:VTODO
UID:${uid}
DTSTAMP:${now}
DUE:${dateStr}T235959
SUMMARY:${escapeICalText(item.text)}
STATUS:NEEDS-ACTION`;

    if (item.project) {
      ical += `\nDESCRIPTION:Projet: ${escapeICalText(item.project)}`;
    }
    if (item.urgent) {
      ical += `\nPRIORITY:1`;
    } else if (item.important) {
      ical += `\nPRIORITY:5`;
    }

    ical += `\nEND:VTODO
END:VCALENDAR`;

    return ical;
  }

  // Note as VJOURNAL
  let ical = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//La Manufacture//Second Brain V4 PULSAR//FR
BEGIN:VJOURNAL
UID:${uid}
DTSTAMP:${now}
DTSTART:${item.date.replace(/-/g, '')}
SUMMARY:${escapeICalText(item.title || '')}
DESCRIPTION:${escapeICalText(item.content || '')}
END:VJOURNAL
END:VCALENDAR`;

  return ical;
}

function escapeICalText(text) {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Google Assistant / Bixby / HyperOS Voice format
 * Ready for voice assistant integration
 */
export function toVoiceAssistantFormat(item, assistant = 'google') {
  const phrases = {
    google: {
      event: () => {
        const time = item.start_time ? ` at ${item.start_time.replace(':', ':')}` : '';
        const loc = item.location ? ` at ${item.location}` : '';
        return `Add calendar event "${item.text || item.title}"${time} on ${item.date}${loc}`;
      },
      task: () => {
        const priority = item.urgent ? ' with high priority' : '';
        return `Add task "${item.text}" due ${item.date}${priority}`;
      },
      note: () => `Take a note: ${item.title}. ${item.content || ''}`,
    },
    bixby: {
      event: () => {
        const time = item.start_time ? ` à ${item.start_time.replace(':', 'h')}` : '';
        return `Créer un événement "${item.text || item.title}"${time} le ${item.date}`;
      },
      task: () => `Créer un rappel "${item.text}" pour le ${item.date}`,
      note: () => `Prendre une note: ${item.title}`,
    },
    hyperos: {
      event: () => {
        const time = item.start_time ? ` ${item.start_time.replace(':', ':')}` : '';
        return `添加日程 "${item.text || item.title}"${time} ${item.date}`;
      },
      task: () => `添加任务 "${item.text}" 截止 ${item.date}`,
      note: () => `记笔记: ${item.title}`,
    },
    siri: {
      event: () => {
        const time = item.start_time ? ` à ${item.start_time.replace(':', 'h')}` : '';
        return `Ajouter un événement "${item.text || item.title}"${time} le ${item.date}`;
      },
      task: () => `Rappelle-moi de ${item.text} le ${item.date}`,
      note: () => `Note: ${item.title}`,
    },
  };

  const generator = phrases[assistant] || phrases.google;
  return generator[item.type]?.() || item.text || item.title;
}

// ============================================================================
// SAMSUNG SPECIFIC EXPORTS
// ============================================================================

/**
 * Samsung Reminder format
 * @see Samsung Reminder App SDK
 */
export function toSamsungReminderFormat(item) {
  if (item.type !== 'task') return null;

  return {
    title: item.text,
    description: item.project || '',
    dueDate: new Date(`${item.date}T23:59:59`).getTime(),
    priority: item.urgent ? 'HIGH' : item.important ? 'MEDIUM' : 'LOW',
    isCompleted: false,
    repeatType: item.metadata?.predictive?.patterns?.[0]?.type?.toUpperCase() || 'NONE',
    location: item.location || null,
    // Samsung-specific fields
    extraData: {
      project: item.project,
      tags: item.tags || [],
      people: item.metadata?.people || [],
      source: 'LaManufacture-PULSAR',
    },
  };
}

/**
 * Samsung Calendar format
 */
export function toSamsungCalendarFormat(item) {
  if (item.type !== 'event') return null;

  const startTime = new Date(`${item.date}T${item.start_time || '09:00'}:00`).getTime();
  const endTime = item.end_time
    ? new Date(`${item.date}T${item.end_time}:00`).getTime()
    : startTime + 60 * 60 * 1000;

  return {
    title: item.text || item.title,
    location: item.location || '',
    description: item.project ? `Projet: ${item.project}` : '',
    dtStart: startTime,
    dtEnd: endTime,
    eventTimezone: 'Europe/Paris',
    hasAlarm: true,
    alarmMinutes: item.important ? [60, 1440] : [15],
    // Samsung color IDs (different from Google)
    calendarColor: item.urgent ? '#FF0000' : item.important ? '#FFA500' : '#4285F4',
    availability: 'BUSY',
    accessLevel: 'DEFAULT',
    // Attendees
    attendees:
      item.metadata?.people?.map(p => ({
        name: p,
        email: '',
        status: 'TENTATIVE',
      })) || [],
  };
}

// ============================================================================
// CROSS-PLATFORM EXPORT HELPER
// ============================================================================

/**
 * Export to any platform format
 */
export function exportToPlatform(item, platform) {
  const exporters = {
    // Apple
    'apple-eventkit': toEventKitFormat,
    'apple-reminders': toRemindersFormat,
    siri: i => toVoiceAssistantFormat(i, 'siri'),

    // Google / Android
    'google-calendar': toGoogleCalendarFormat,
    'google-tasks': toGoogleTasksFormat,
    'google-assistant': i => toVoiceAssistantFormat(i, 'google'),
    'android-intent': toAndroidIntentFormat,

    // Samsung
    'samsung-reminder': toSamsungReminderFormat,
    'samsung-calendar': toSamsungCalendarFormat,
    bixby: i => toVoiceAssistantFormat(i, 'bixby'),

    // Xiaomi
    hyperos: toAndroidIntentFormat, // Uses Android intents with MIUI extras
    'hyperos-voice': i => toVoiceAssistantFormat(i, 'hyperos'),

    // Universal
    ical: toICalFormat,
  };

  const exporter = exporters[platform];
  if (!exporter) {
    throw new Error(
      `Unknown platform: ${platform}. Available: ${Object.keys(exporters).join(', ')}`
    );
  }

  return exporter(item);
}

/**
 * Export to all compatible platforms at once
 */
export function exportToAllPlatforms(item) {
  const result = {
    universal: {
      ical: toICalFormat(item),
    },
    apple: {},
    android: {},
    samsung: {},
    xiaomi: {},
    voice: {},
  };

  // Apple exports
  if (item.type === 'event') {
    result.apple.eventkit = toEventKitFormat(item);
  }
  if (item.type === 'task') {
    result.apple.reminders = toRemindersFormat(item);
  }
  result.voice.siri = toVoiceAssistantFormat(item, 'siri');

  // Google/Android exports
  if (item.type === 'event') {
    result.android.googleCalendar = toGoogleCalendarFormat(item);
  }
  if (item.type === 'task') {
    result.android.googleTasks = toGoogleTasksFormat(item);
  }
  result.android.intent = toAndroidIntentFormat(item);
  result.voice.googleAssistant = toVoiceAssistantFormat(item, 'google');

  // Samsung exports
  if (item.type === 'event') {
    result.samsung.calendar = toSamsungCalendarFormat(item);
  }
  if (item.type === 'task') {
    result.samsung.reminder = toSamsungReminderFormat(item);
  }
  result.voice.bixby = toVoiceAssistantFormat(item, 'bixby');

  // Xiaomi exports (uses Android intents with HyperOS extras)
  result.xiaomi.intent = toAndroidIntentFormat(item);
  result.voice.hyperos = toVoiceAssistantFormat(item, 'hyperos');

  return result;
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  // Core parsing
  parse: parsePulsar,
  parseOffline,
  streamParse,
  detectLanguage,
  getTemporalContext,
  buildSystemPromptV4,
  buildUserPromptV4,

  // Apple exports
  toEventKitFormat,
  toRemindersFormat,

  // Google/Android exports
  toGoogleCalendarFormat,
  toGoogleTasksFormat,
  toAndroidIntentFormat,

  // Samsung exports
  toSamsungReminderFormat,
  toSamsungCalendarFormat,

  // Universal exports
  toICalFormat,
  toVoiceAssistantFormat,

  // Cross-platform helpers
  exportToPlatform,
  exportToAllPlatforms,

  // Schemas
  schemas: {
    ParseResultSchema,
    ItemSchema,
    SuggestionSchema,
    MetadataSchema,
  },
};
