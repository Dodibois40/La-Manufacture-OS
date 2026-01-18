import { isoLocal } from './utils.js';

const DOW = {
  lundi: 1,
  lun: 1,
  mardi: 2,
  mar: 2,
  mercredi: 3,
  mer: 3,
  jeudi: 4,
  jeu: 4,
  vendredi: 5,
  ven: 5,
  samedi: 6,
  sam: 6,
  dimanche: 0,
  dim: 0,
};

const nextDow = (fromISO, dow) => {
  const d = new Date(fromISO + 'T00:00:00');
  const cur = d.getDay();
  let diff = (dow - cur + 7) % 7;
  if (diff === 0) diff = 7;
  d.setDate(d.getDate() + diff);
  return isoLocal(d);
};

// Keywords that indicate urgency
const URGENT_KEYWORDS = [
  'urgent',
  'asap',
  'important',
  'priorité',
  'priorite',
  'critique',
  'deadline',
  'rush',
  'vite',
  'rapidement',
  'immédiat',
  'immediat',
];

// Recurrence patterns
const RECURRENCE_PATTERNS = {
  'tous les jours': 'daily',
  'chaque jour': 'daily',
  quotidien: 'daily',
  'tous les lundis': 'weekly_1',
  'tous les mardis': 'weekly_2',
  'tous les mercredis': 'weekly_3',
  'tous les jeudis': 'weekly_4',
  'tous les vendredis': 'weekly_5',
  'tous les samedis': 'weekly_6',
  'tous les dimanches': 'weekly_0',
  'chaque lundi': 'weekly_1',
  'chaque mardi': 'weekly_2',
  'chaque mercredi': 'weekly_3',
  'chaque jeudi': 'weekly_4',
  'chaque vendredi': 'weekly_5',
  'chaque samedi': 'weekly_6',
  'chaque dimanche': 'weekly_0',
  'toutes les semaines': 'weekly',
  'chaque semaine': 'weekly',
  hebdomadaire: 'weekly',
  'tous les mois': 'monthly',
  'chaque mois': 'monthly',
  mensuel: 'monthly',
};

// Smart parse: extracts date from ANYWHERE in the text (not just prefix)
export const smartParseDate = (raw, baseToday) => {
  const s = String(raw || '').toLowerCase();

  // Check for "aujourd'hui" anywhere
  if (/aujourd['']?hui/i.test(s)) return baseToday;

  // Check for "demain" anywhere
  if (/\bdemain\b/i.test(s)) {
    const d = new Date(baseToday + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    return isoLocal(d);
  }

  // Check for "après-demain" anywhere
  if (/apr[eè]s[- ]?demain/i.test(s)) {
    const d = new Date(baseToday + 'T00:00:00');
    d.setDate(d.getDate() + 2);
    return isoLocal(d);
  }

  // Check for "cette semaine" / "fin de semaine"
  if (/cette\s+semaine|fin\s+de\s+semaine/i.test(s)) {
    const d = new Date(baseToday + 'T00:00:00');
    const dayOfWeek = d.getDay();
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
    d.setDate(d.getDate() + daysUntilFriday);
    return isoLocal(d);
  }

  // Check for "semaine prochaine"
  if (/semaine\s+prochaine/i.test(s)) {
    const d = new Date(baseToday + 'T00:00:00');
    const dayOfWeek = d.getDay();
    const daysUntilNextMonday = (8 - dayOfWeek) % 7 || 7;
    d.setDate(d.getDate() + daysUntilNextMonday);
    return isoLocal(d);
  }

  // Check for day of week ANYWHERE in text
  for (const [word, dow] of Object.entries(DOW)) {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(s)) {
      return nextDow(baseToday, dow);
    }
  }

  // Check for date format DD/MM or DD/MM/YYYY anywhere
  const dateMatch = s.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (dateMatch) {
    const dd = ('0' + dateMatch[1]).slice(-2);
    const mm = ('0' + dateMatch[2]).slice(-2);
    let yy = dateMatch[3] || baseToday.slice(0, 4);
    if (yy.length === 2) yy = '20' + yy;
    return `${yy}-${mm}-${dd}`;
  }

  // No date found → default to today
  return baseToday;
};

// Smart parse: detect urgency from keywords ANYWHERE
export const smartParseUrgent = raw => {
  const s = String(raw || '').toLowerCase();

  // Check for !!! or !!
  if (/!!+/.test(raw)) return true;

  // Check for urgent keywords
  for (const word of URGENT_KEYWORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(s)) return true;
  }

  return false;
};

// Smart parse: extract duration in minutes
export const smartParseDuration = raw => {
  const s = String(raw || '').toLowerCase();

  // Match patterns like "30min", "30 min", "1h", "1h30", "2 heures", "45 minutes"
  const patterns = [
    // "1h30" or "1h30min"
    { regex: /(\d+)\s*h\s*(\d+)\s*(?:min)?/i, calc: m => parseInt(m[1]) * 60 + parseInt(m[2]) },
    // "1h" or "2 heures"
    { regex: /(\d+)\s*(?:h|heure|heures)\b/i, calc: m => parseInt(m[1]) * 60 },
    // "30min" or "45 minutes"
    { regex: /(\d+)\s*(?:min|minute|minutes)\b/i, calc: m => parseInt(m[1]) },
    // "30m" (shorthand)
    { regex: /(\d+)\s*m\b/i, calc: m => parseInt(m[1]) },
  ];

  for (const { regex, calc } of patterns) {
    const match = s.match(regex);
    if (match) {
      return calc(match);
    }
  }

  return null;
};

// Smart parse: extract recurrence pattern
export const smartParseRecurrence = raw => {
  const s = String(raw || '').toLowerCase();

  for (const [pattern, value] of Object.entries(RECURRENCE_PATTERNS)) {
    if (s.includes(pattern)) {
      return value;
    }
  }

  return null;
};

// Smart parse: extract project/context from #hashtag
export const smartParseProject = raw => {
  const s = String(raw || '');

  // Match #project or #project-name (alphanumeric + dashes)
  const match = s.match(/#([\w-]+)/);
  if (match) {
    return match[1];
  }

  return null;
};

// Smart parse: extract time (for events/meetings)
export const smartParseTime = raw => {
  const s = String(raw || '');

  // Match patterns like "à 14h", "14h30", "14:30", "à 9h"
  const patterns = [
    // "à 14h30" or "14h30"
    { regex: /(?:à\s*)?(\d{1,2})\s*h\s*(\d{2})/i, format: m => `${m[1].padStart(2, '0')}:${m[2]}` },
    // "à 14h" or "14h"
    { regex: /(?:à\s*)?(\d{1,2})\s*h\b/i, format: m => `${m[1].padStart(2, '0')}:00` },
    // "14:30"
    { regex: /(\d{1,2}):(\d{2})/i, format: m => `${m[1].padStart(2, '0')}:${m[2]}` },
  ];

  for (const { regex, format } of patterns) {
    const match = s.match(regex);
    if (match) {
      return format(match);
    }
  }

  return null;
};

// Smart parse: extract owner from @mention
export const smartParseOwner = (raw, owners, defaultOwner) => {
  const s = String(raw || '');

  // Look for @Owner pattern
  for (const owner of owners) {
    const regex = new RegExp(`@${owner}\\b`, 'i');
    if (regex.test(s)) return owner;
  }

  // Look for "Owner:" prefix pattern
  for (const owner of owners) {
    const regex = new RegExp(`^${owner}\\s*:\\s*`, 'i');
    if (regex.test(s)) return owner;
  }

  return defaultOwner;
};

// Clean up the title by removing parsed elements
export const cleanTitle = (raw, owners) => {
  let title = String(raw || '');

  // Remove date keywords
  title = title
    .replace(/\bdemain\b/gi, '')
    .replace(/\baujourd['']?hui\b/gi, '')
    .replace(/\bapr[eè]s[- ]?demain\b/gi, '')
    .replace(/\bcette\s+semaine\b/gi, '')
    .replace(/\bfin\s+de\s+semaine\b/gi, '')
    .replace(/\bsemaine\s+prochaine\b/gi, '')
    .replace(
      /\b(lundi|lun|mardi|mar|mercredi|mer|jeudi|jeu|vendredi|ven|samedi|sam|dimanche|dim)\b/gi,
      ''
    )
    .replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, '');

  // Remove urgent markers
  title = title
    .replace(/!!+/g, '')
    .replace(/\bURGENT\b/gi, '')
    .replace(/\bASAP\b/gi, '')
    .replace(/\bimportant\b/gi, '')
    .replace(/\bpriorit[ée]\b/gi, '')
    .replace(/\bcritique\b/gi, '');

  // Remove duration patterns
  title = title
    .replace(/\d+\s*h\s*\d+\s*(?:min)?\b/gi, '')
    .replace(/\d+\s*(?:h|heure|heures)\b/gi, '')
    .replace(/\d+\s*(?:min|minute|minutes)\b/gi, '')
    .replace(/\b\d+\s*m\b/gi, '');

  // Remove recurrence patterns
  title = title
    .replace(
      /\b(tous les|chaque|toutes les)\s+(jours?|lundis?|mardis?|mercredis?|jeudis?|vendredis?|samedis?|dimanches?|semaines?|mois)\b/gi,
      ''
    )
    .replace(/\b(quotidien|hebdomadaire|mensuel)\b/gi, '');

  // Remove time patterns
  title = title
    .replace(/(?:à\s*)?\d{1,2}\s*h\s*\d{2}/gi, '')
    .replace(/(?:à\s*)?\d{1,2}\s*h\b/gi, '')
    .replace(/\d{1,2}:\d{2}/g, '');

  // Remove #project tags (but keep the info for display)
  title = title.replace(/#[\w-]+/g, '');

  // Remove @owner mentions
  for (const owner of owners) {
    const regex = new RegExp(`@${owner}\\b`, 'gi');
    title = title.replace(regex, '');
  }

  // Remove "Owner:" prefix
  for (const owner of owners) {
    const regex = new RegExp(`^${owner}\\s*:\\s*`, 'i');
    title = title.replace(regex, '');
  }

  // Clean up extra spaces and punctuation
  title = title
    .replace(/\s+/g, ' ')
    .replace(/^[\s:,;.-]+/, '')
    .replace(/[\s:,;.-]+$/, '')
    .trim();

  return title;
};

// Legacy exports for backward compatibility
export const parseTarget = (raw, baseToday) => {
  const s = String(raw || '')
    .toLowerCase()
    .trim();

  if (s.startsWith('aujourd')) return baseToday;

  if (s.startsWith('demain')) {
    const d = new Date(baseToday + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    return isoLocal(d);
  }

  const m = s.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (m) {
    const dd = ('0' + m[1]).slice(-2);
    const mm = ('0' + m[2]).slice(-2);
    let yy = m[3] || baseToday.slice(0, 4);
    if (yy.length === 2) yy = '20' + yy;
    return `${yy}-${mm}-${dd}`;
  }

  const first = s.match(/^([a-zéûà]+)\b/);
  if (first && Object.prototype.hasOwnProperty.call(DOW, first[1])) {
    return nextDow(baseToday, DOW[first[1]]);
  }

  return null;
};

export const stripPrefix = raw => {
  return String(raw || '')
    .replace(/^urgent\s*:?\s*/i, '')
    .replace(/^aujourd['']?hui\s*:?\s*/i, '')
    .replace(/^aujourd\s*:?\s*/i, '')
    .replace(/^demain\s*:?\s*/i, '')
    .replace(
      /^(lundi|lun|mardi|mar|mercredi|mer|jeudi|jeu|vendredi|ven|samedi|sam|dimanche|dim)\s*:?\s*/i,
      ''
    )
    .trim();
};

// Parse task input (used by quick-dump)
export const parseTaskInput = (raw, owners = ['Moi']) => {
  const today = isoLocal(new Date());
  const defaultOwner = owners[0] || 'Moi';

  return {
    title: cleanTitle(raw, owners),
    date: smartParseDate(raw, today),
    urgent: smartParseUrgent(raw),
    owner: smartParseOwner(raw, owners, defaultOwner),
    estimated_duration: smartParseDuration(raw),
    recurrence: smartParseRecurrence(raw),
    project: smartParseProject(raw),
    start_time: smartParseTime(raw),
  };
};
