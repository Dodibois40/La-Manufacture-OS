import { isoLocal } from './utils.js';

const DOW = {
  lundi: 1, lun: 1, mardi: 2, mar: 2, mercredi: 3, mer: 3,
  jeudi: 4, jeu: 4, vendredi: 5, ven: 5, samedi: 6, sam: 6,
  dimanche: 0, dim: 0
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
  'urgent', 'asap', 'important', 'priorité', 'priorite', 'critique',
  'deadline', 'rush', 'vite', 'rapidement', 'immédiat', 'immediat'
];

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
export const smartParseUrgent = (raw) => {
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
    .replace(/\b(lundi|lun|mardi|mar|mercredi|mer|jeudi|jeu|vendredi|ven|samedi|sam|dimanche|dim)\b/gi, '')
    .replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, '');

  // Remove urgent markers
  title = title
    .replace(/!!+/g, '')
    .replace(/\bURGENT\b/gi, '')
    .replace(/\bASAP\b/gi, '')
    .replace(/\bimportant\b/gi, '')
    .replace(/\bpriorit[ée]\b/gi, '')
    .replace(/\bcritique\b/gi, '');

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
  const s = String(raw || '').toLowerCase().trim();

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

export const stripPrefix = (raw) => {
  return String(raw || '')
    .replace(/^urgent\s*:?\s*/i, '')
    .replace(/^aujourd['']?hui\s*:?\s*/i, '')
    .replace(/^aujourd\s*:?\s*/i, '')
    .replace(/^demain\s*:?\s*/i, '')
    .replace(/^(lundi|lun|mardi|mar|mercredi|mer|jeudi|jeu|vendredi|ven|samedi|sam|dimanche|dim)\s*:?\s*/i, '')
    .trim();
};
