# Plan d'Internationalisation - La Manufacture

**Objectif** : Rendre l'application compatible App Store / Google Play avec support multi-langue (FR/EN) et multi-timezone.

**Score actuel i18n** : 2.5/10
**Score cible** : 10/10

---

## 1. Vue d'ensemble

### 1.1 État actuel

| Composant | État | Problème |
|-----------|------|----------|
| Frontend (la-manufacture-os) | 🔴 Français hardcodé | Tous les textes en FR |
| API (la-manufacture-api) | 🔴 Français hardcodé | Prompt IA 693 lignes FR |
| Database | 🟡 Neutre | Pas de champ locale/timezone |
| Prompt IA | 🔴 FR uniquement | Keywords, examples, logic tout en FR |

### 1.2 Architecture cible

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │  Détection  │───▶│   i18n      │───▶│   Render    │         │
│  │  locale     │    │   Provider  │    │   (React/   │         │
│  │  (browser)  │    │   (context) │    │   vanilla)  │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│        │                   │                                     │
│        └───────────────────┼─────────────────────────────────────┤
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Headers: X-User-Locale: en-US, X-User-Timezone: US/Eastern ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                           API                                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │  Middleware │───▶│   i18n      │───▶│   Route     │         │
│  │  locale     │    │   Config    │    │   Handler   │         │
│  │  extraction │    │   Loader    │    │             │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│                            │                                     │
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Prompt Generator (locale-aware)                            ││
│  │  ├── system-prompt-fr.js                                    ││
│  │  └── system-prompt-en.js                                    ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DATABASE                                  │
├─────────────────────────────────────────────────────────────────┤
│  users                                                           │
│  ├── locale VARCHAR(10) DEFAULT 'fr'                            │
│  └── timezone VARCHAR(50) DEFAULT 'Europe/Paris'                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Phases d'implémentation

### Phase 1 : Infrastructure i18n (Fondations)
**Durée estimée** : 4-6 heures
**Priorité** : P0 - BLOQUANT

#### 2.1.1 Créer la structure de fichiers API

```
la-manufacture-api/
├── src/
│   ├── i18n/
│   │   ├── index.js              # Export principal
│   │   ├── config.js             # Configuration par défaut
│   │   ├── middleware.js         # Extraction locale des headers
│   │   └── locales/
│   │       ├── fr/
│   │       │   ├── messages.json # Messages UI/erreurs
│   │       │   ├── keywords.json # Keywords détection IA
│   │       │   └── times.json    # Horaires nommés
│   │       └── en/
│   │           ├── messages.json
│   │           ├── keywords.json
│   │           └── times.json
│   └── prompts/
│       ├── index.js              # Factory prompt
│       ├── system-prompt-fr.js   # Prompt FR (actuel)
│       └── system-prompt-en.js   # Prompt EN (à créer)
```

#### 2.1.2 Fichier i18n/config.js

```javascript
// la-manufacture-api/src/i18n/config.js

export const SUPPORTED_LOCALES = ['fr', 'en'];
export const DEFAULT_LOCALE = 'fr';

export const SUPPORTED_TIMEZONES = [
  'Europe/Paris',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney'
];
export const DEFAULT_TIMEZONE = 'Europe/Paris';

// Mapping locale -> timezone par défaut
export const LOCALE_TIMEZONE_DEFAULTS = {
  'fr': 'Europe/Paris',
  'fr-FR': 'Europe/Paris',
  'fr-CA': 'America/Montreal',
  'en': 'America/New_York',
  'en-US': 'America/New_York',
  'en-GB': 'Europe/London',
  'en-AU': 'Australia/Sydney'
};

// Business hours par région
export const BUSINESS_HOURS = {
  'Europe/Paris': { start: 9, end: 18, lunchStart: 12, lunchEnd: 14 },
  'Europe/London': { start: 9, end: 17, lunchStart: 12, lunchEnd: 13 },
  'America/New_York': { start: 9, end: 17, lunchStart: 12, lunchEnd: 13 },
  'America/Los_Angeles': { start: 8, end: 17, lunchStart: 12, lunchEnd: 13 },
  'Asia/Tokyo': { start: 9, end: 18, lunchStart: 12, lunchEnd: 13 }
};

// Durées événements par culture
export const EVENT_DURATIONS = {
  'fr': {
    meeting: 60,
    call: 30,
    lunch: 90,
    dinner: 120,
    coffee: 45,
    visit: 120,
    training: 240,
    conference: 480
  },
  'en': {
    meeting: 60,
    call: 30,
    lunch: 45,
    dinner: 90,
    coffee: 30,
    visit: 60,
    training: 180,
    conference: 480
  }
};
```

#### 2.1.3 Fichier i18n/locales/fr/keywords.json

```json
{
  "event_triggers": {
    "explicit_time": ["à", "vers", "pour"],
    "meeting_words": ["RDV", "rendez-vous", "réunion", "meeting", "call", "visio"],
    "meal_words": ["déjeuner", "dîner", "petit-déjeuner", "brunch"],
    "social_words": ["café", "drink", "apéro", "verre"],
    "travel_words": ["visite", "aller à", "se rendre", "déplacement"]
  },
  "note_triggers": {
    "prefixes": ["Note:", "Idée:", "Info:", "À retenir:", "!"],
    "information_words": ["budget", "préfère", "veut", "aime"]
  },
  "task_triggers": {
    "action_verbs": ["appeler", "envoyer", "faire", "préparer", "vérifier", "acheter", "contacter", "relancer", "finaliser"],
    "obligation_words": ["il faut", "je dois", "à faire", "faut que"]
  },
  "urgency": {
    "urgent": ["URGENT", "ASAP", "immédiatement", "tout de suite", "!!!", "critique", "en panne", "down", "bloqué"],
    "important": ["important", "crucial", "essentiel", "clé", "prioritaire"]
  },
  "time_expressions": {
    "relative_days": {
      "aujourd'hui": 0,
      "ce soir": 0,
      "demain": 1,
      "après-demain": 2,
      "ce week-end": "next_saturday"
    },
    "named_times": {
      "tôt le matin": "08:00",
      "matin": "09:00",
      "midi": "12:00",
      "après-midi": "14:00",
      "fin d'après-midi": "17:00",
      "soir": "18:00"
    },
    "separators": ["et puis", "aussi", "sinon", "ah et", "d'ailleurs", "au fait", "tiens", "j'oubliais"]
  },
  "day_names": ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"],
  "month_names": ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
}
```

#### 2.1.4 Fichier i18n/locales/en/keywords.json

```json
{
  "event_triggers": {
    "explicit_time": ["at", "around", "for"],
    "meeting_words": ["meeting", "appointment", "call", "video call", "sync", "standup", "1:1"],
    "meal_words": ["lunch", "dinner", "breakfast", "brunch"],
    "social_words": ["coffee", "drink", "drinks", "happy hour", "tea"],
    "travel_words": ["visit", "go to", "trip to", "travel to"]
  },
  "note_triggers": {
    "prefixes": ["Note:", "Idea:", "Info:", "Remember:", "!", "FYI:"],
    "information_words": ["budget", "prefers", "wants", "likes"]
  },
  "task_triggers": {
    "action_verbs": ["call", "send", "do", "prepare", "check", "buy", "contact", "follow up", "finalize", "review", "email"],
    "obligation_words": ["need to", "must", "have to", "should", "gotta"]
  },
  "urgency": {
    "urgent": ["URGENT", "ASAP", "immediately", "right now", "!!!", "critical", "down", "broken", "blocked", "emergency"],
    "important": ["important", "crucial", "essential", "key", "priority", "high priority"]
  },
  "time_expressions": {
    "relative_days": {
      "today": 0,
      "tonight": 0,
      "tomorrow": 1,
      "day after tomorrow": 2,
      "this weekend": "next_saturday"
    },
    "named_times": {
      "early morning": "07:00",
      "morning": "09:00",
      "noon": "12:00",
      "afternoon": "14:00",
      "late afternoon": "17:00",
      "evening": "18:00",
      "night": "20:00"
    },
    "separators": ["and then", "also", "plus", "oh and", "by the way", "oh right", "wait", "I forgot"]
  },
  "day_names": ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  "month_names": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
}
```

#### 2.1.5 Fichier i18n/middleware.js

```javascript
// la-manufacture-api/src/i18n/middleware.js

import { SUPPORTED_LOCALES, DEFAULT_LOCALE, LOCALE_TIMEZONE_DEFAULTS, DEFAULT_TIMEZONE } from './config.js';

export function extractLocaleFromRequest(request) {
  // 1. Check explicit header
  const headerLocale = request.headers['x-user-locale'];
  if (headerLocale && SUPPORTED_LOCALES.includes(headerLocale.split('-')[0])) {
    return headerLocale.split('-')[0]; // 'en-US' -> 'en'
  }

  // 2. Check Accept-Language header
  const acceptLanguage = request.headers['accept-language'];
  if (acceptLanguage) {
    const primaryLang = acceptLanguage.split(',')[0].split('-')[0];
    if (SUPPORTED_LOCALES.includes(primaryLang)) {
      return primaryLang;
    }
  }

  // 3. Check user profile in DB (if authenticated)
  // This would be done in the route handler with user data

  return DEFAULT_LOCALE;
}

export function extractTimezoneFromRequest(request, locale) {
  // 1. Check explicit header
  const headerTimezone = request.headers['x-user-timezone'];
  if (headerTimezone) {
    return headerTimezone;
  }

  // 2. Default based on locale
  const fullLocale = request.headers['x-user-locale'] || request.headers['accept-language']?.split(',')[0];
  if (fullLocale && LOCALE_TIMEZONE_DEFAULTS[fullLocale]) {
    return LOCALE_TIMEZONE_DEFAULTS[fullLocale];
  }

  return LOCALE_TIMEZONE_DEFAULTS[locale] || DEFAULT_TIMEZONE;
}

export function i18nMiddleware(request, reply, done) {
  const locale = extractLocaleFromRequest(request);
  const timezone = extractTimezoneFromRequest(request, locale);

  request.i18n = {
    locale,
    timezone,
    language: locale // alias
  };

  done();
}
```

#### 2.1.6 Fichier i18n/index.js

```javascript
// la-manufacture-api/src/i18n/index.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_LOCALE, BUSINESS_HOURS, EVENT_DURATIONS } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache loaded locales
const localeCache = {};

export function loadLocale(locale = DEFAULT_LOCALE) {
  if (localeCache[locale]) {
    return localeCache[locale];
  }

  const localePath = path.join(__dirname, 'locales', locale);

  try {
    const keywords = JSON.parse(fs.readFileSync(path.join(localePath, 'keywords.json'), 'utf-8'));
    const messages = JSON.parse(fs.readFileSync(path.join(localePath, 'messages.json'), 'utf-8'));
    const times = JSON.parse(fs.readFileSync(path.join(localePath, 'times.json'), 'utf-8'));

    localeCache[locale] = { keywords, messages, times };
    return localeCache[locale];
  } catch (error) {
    console.error(`Failed to load locale ${locale}:`, error);
    // Fallback to default locale
    if (locale !== DEFAULT_LOCALE) {
      return loadLocale(DEFAULT_LOCALE);
    }
    throw error;
  }
}

export function getI18nConfig(locale, timezone) {
  const localeData = loadLocale(locale);
  const businessHours = BUSINESS_HOURS[timezone] || BUSINESS_HOURS['Europe/Paris'];
  const eventDurations = EVENT_DURATIONS[locale] || EVENT_DURATIONS['fr'];

  return {
    locale,
    timezone,
    ...localeData,
    businessHours,
    eventDurations,

    // Helper functions
    getDayName: (dayIndex) => localeData.keywords.day_names[dayIndex],
    getMonthName: (monthIndex) => localeData.keywords.month_names[monthIndex],
    getNamedTime: (name) => localeData.keywords.time_expressions.named_times[name.toLowerCase()],
    getRelativeDay: (expression) => localeData.keywords.time_expressions.relative_days[expression.toLowerCase()]
  };
}

export { i18nMiddleware, extractLocaleFromRequest, extractTimezoneFromRequest } from './middleware.js';
export * from './config.js';
```

---

### Phase 2 : Prompt Système Multi-langue
**Durée estimée** : 6-8 heures
**Priorité** : P0 - BLOQUANT

#### 2.2.1 Refactorer le prompt actuel (FR)

Créer `la-manufacture-api/src/prompts/system-prompt-fr.js` :

```javascript
// la-manufacture-api/src/prompts/system-prompt-fr.js

export function generateSystemPromptFR(config) {
  const {
    currentDate, currentDayName, currentTime,
    tomorrowDate, tomorrowDayName, afterTomorrowDate,
    activeProjects, existingTags, teamMembers,
    keywords, businessHours, eventDurations,
    weekDaysStr
  } = config;

  return `Tu es un SECOND BRAIN - un assistant cognitif de niveau supérieur...

[... Le prompt actuel de 693 lignes, avec les variables injectées ...]

═══════════════════════════════════════════════════════════════════════════════
SECTION 4 : DATES & HEURES (CALCUL PRÉCIS)
═══════════════════════════════════════════════════════════════════════════════

📅 CONTEXTE TEMPOREL ACTUEL :
   • Aujourd'hui : ${currentDayName} ${currentDate}
   • Demain : ${tomorrowDayName} ${tomorrowDate}
   • Après-demain : ${afterTomorrowDate}
   • Heure actuelle : ${currentTime}

[... etc ...]
`;
}

export function generateUserPromptFR(config) {
  const {
    text, currentDate, currentDayName, currentTime,
    tomorrowDate, tomorrowDayName, afterTomorrowDate,
    activeProjects, existingTags, teamMembers,
    weekDaysStr
  } = config;

  return `🧠 ACTIVATION SECOND BRAIN - Analyse complète requise

═══════════════════════════════════════════════════════════════════════════════
ENTRÉE INBOX À TRAITER
═══════════════════════════════════════════════════════════════════════════════

"""
${text}
"""

[... etc ...]
`;
}
```

#### 2.2.2 Créer le prompt EN

Créer `la-manufacture-api/src/prompts/system-prompt-en.js` :

```javascript
// la-manufacture-api/src/prompts/system-prompt-en.js

export function generateSystemPromptEN(config) {
  const {
    currentDate, currentDayName, currentTime,
    tomorrowDate, tomorrowDayName, afterTomorrowDate,
    activeProjects, existingTags, teamMembers,
    keywords, businessHours, eventDurations,
    weekDaysStr
  } = config;

  return `You are a SECOND BRAIN - a superior-level cognitive assistant. You don't just parse text: you UNDERSTAND, ANTICIPATE, VERIFY, and ENRICH.

╔═══════════════════════════════════════════════════════════════════════════════╗
║                    🧠 SECOND BRAIN PHILOSOPHY                                  ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║ 1. CAPTURE: Extract EVERYTHING of value, lose nothing                         ║
║ 2. ORGANIZE: Classify with surgical precision                                 ║
║ 3. ENRICH: Add context, links, useful metadata                               ║
║ 4. ANTICIPATE: Suggest what's missing, prevent oversights                    ║
║ 5. VERIFY: Self-validation, consistency, sanity checks                       ║
╚═══════════════════════════════════════════════════════════════════════════════╝

═══════════════════════════════════════════════════════════════════════════════
SECTION 1: 3-PASS PROCESSING
═══════════════════════════════════════════════════════════════════════════════

🔵 PASS 1 - RAW EXTRACTION
   └─ Identify ALL distinct items in the text
   └─ Classify each item (task/event/note)
   └─ Extract dates, times, people, locations

🟡 PASS 2 - VERIFICATION & VALIDATION
   └─ Temporal consistency: is the date logical?
   └─ Type consistency: an "appointment" must be an EVENT, not a TASK
   └─ Completeness: is critical info missing?
   └─ Potential duplicate: is this a rephrasing of another item?

🟢 PASS 3 - ENRICHMENT & ANTICIPATION
   └─ Preparatory tasks: does an appointment require preparation?
   └─ Suggested reminders: close deadline = D-1 reminder?
   └─ Contextual links: which project? which person?
   └─ Implicit actions: "client presentation" → prepare slides?

═══════════════════════════════════════════════════════════════════════════════
SECTION 2: PRECISE CLASSIFICATION (HIERARCHICAL RULES)
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. EVENT (Calendar event) - MAXIMUM PRIORITY                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ ✓ Conditions (AT LEAST ONE):                                                │
│   • EXPLICIT time: "2pm", "10:30am", "at 9", "tomorrow 3pm"                │
│   • Appointment keyword: "appointment", "meeting", "call", "sync", "1:1"   │
│   • Planned meal: "lunch with", "dinner at", "breakfast with"              │
│   • Travel: "visit", "go to", "trip to"                                    │
│   • Informal gathering: "coffee with", "drinks with", "happy hour"         │
│                                                                              │
│ ✓ EVENT Examples:                                                           │
│   • "Call Marie tomorrow at 2pm" → EVENT (explicit time)                   │
│   • "Dentist appointment Thursday" → EVENT (keyword, default 09:00)        │
│   • "Budget meeting Monday 10am room B" → EVENT + location                 │
│   • "Team lunch Friday noon" → EVENT (12:00-13:30)                         │
│                                                                              │
│ ✗ NOT events:                                                               │
│   • "Call Marie tomorrow" → TASK (no specific time)                        │
│   • "Prepare for the meeting" → TASK (preparation ≠ event)                 │
│   • "Remember to book restaurant" → TASK (action, not the event)           │
│                                                                              │
│ ⚠️ SPECIAL CASE - CALLS:                                                    │
│   • "Call Marie 2pm" → EVENT (explicit time)                               │
│   • "Call Marie tomorrow" → TASK (no time = task to do)                    │
│   • "Scheduled call 2pm with Marie" → EVENT ("scheduled" + time)           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. NOTE (Information to remember) - PURE KNOWLEDGE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ ✓ Conditions:                                                               │
│   • Explicit prefix: "Note:", "Idea:", "Info:", "Remember:", "FYI:", "!"  │
│   • Factual info WITHOUT action: "The budget is 50k"                       │
│   • Preference/Observation: "Paul prefers morning meetings"                │
│   • Reference: URL, quote, "see article about X"                           │
│   • Insight/Reflection: "I realized that..."                               │
│                                                                              │
│ ✓ NOTE Examples:                                                            │
│   • "Idea: use Redis for caching" → NOTE (prefix + concept)                │
│   • "Client wants delivery before March" → NOTE (factual info)             │
│   • "2026 budget: 50k marketing" → NOTE (numerical data)                   │
│                                                                              │
│ ✗ NOT notes:                                                                │
│   • "Check the budget" → TASK (action verb)                                │
│   • "Ask Paul his preferences" → TASK (ask = action)                       │
│                                                                              │
│ ⚠️ PRIORITY RULE:                                                           │
│   Explicit prefix (Note:, Idea:, !, Remember:) ALWAYS takes precedence     │
│   over any action verb detected in the content.                            │
│   Ex: "! don't forget to sign" → NOTE (prefix "!" takes priority)          │
│   Ex: "Idea: think about automating" → NOTE (prefix "Idea:" takes priority)│
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. TASK (Action to do) - DEFAULT                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ ✓ Indicators:                                                               │
│   • Action verb: call, send, do, prepare, check, buy, review, email        │
│   • Implicit obligation: "need to", "must", "have to", "should"            │
│   • Action on object: "the report", "the presentation", "the quote"        │
│   • Assignment: "@Paul", "for Marie", "Marc needs to"                      │
│                                                                              │
│ ✓ MANDATORY REFORMULATION:                                                  │
│   • Transform into clear, concise action                                   │
│   • Start with infinitive verb when possible                               │
│   • "gotta do that thing" → "Do [specific thing]"                          │
└─────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
SECTION 3: MULTI-ITEM DETECTION (SPOKEN/DICTATED TEXT)
═══════════════════════════════════════════════════════════════════════════════

⚠️ CRITICAL: Text may be dictated WITHOUT punctuation or structure.
You must detect EACH distinct item in a continuous stream.

🔍 SEPARATION SIGNALS:

1. DATE CHANGE
   "...tomorrow... and Monday..." → 2+ items minimum
   "...this week... next week..." → separate items

2. TYPE CHANGE
   "I have an idea... and I need to..." → NOTE + TASK
   "appointment at 2pm and then I need to..." → EVENT + TASK

3. SUBJECT/PERSON CHANGE
   "...Marie... and Paul..." → potentially 2 items
   "...project X... and project Y..." → 2 items

4. EXPLICIT MARKERS
   " + ", " and then ", " also ", " plus ", comma, semicolon, "oh and"
   "first", "then", "finally", "one", "two"

5. IMPLICIT MARKERS (CRUCIAL for spoken text)
   "and Monday...", "and Tuesday...", "by the way...", "oh right..."
   "oh yeah", "I forgot", "another thing", "plus"

6. REPHRASING (don't create duplicates)
   "actually I mean", "no rather", "actually", "I mean"
   → Correct/clarify previous item, DO NOT create new item

📝 SPOKEN TEXT EXAMPLES:

INPUT: "I had an idea for the dashboard using graphql and Monday I need to call the Dupont client and Tuesday I have an appointment with the architect at 2pm at his office"
OUTPUT: 3 items
  1. NOTE: "Dashboard idea with GraphQL"
  2. TASK: "Call Dupont client" (date: Monday)
  3. EVENT: "Architect appointment" (date: Tuesday, 14:00, location: "his office")

🎯 GOLDEN RULE: WHEN IN DOUBT, SEPARATE. Better 2 items than 1 incomplete item.

═══════════════════════════════════════════════════════════════════════════════
SECTION 4: DATES & TIMES (PRECISE CALCULATION)
═══════════════════════════════════════════════════════════════════════════════

📅 CURRENT TEMPORAL CONTEXT:
   • Today: ${currentDayName} ${currentDate}
   • Tomorrow: ${tomorrowDayName} ${tomorrowDate}
   • Day after tomorrow: ${afterTomorrowDate}
   • Current time: ${currentTime}

🗓️ RELATIVE DATE CALCULATION:

┌────────────────────────┬────────────────────────────────────────────────────┐
│ Expression             │ ISO Date                                           │
├────────────────────────┼────────────────────────────────────────────────────┤
│ "today"                │ ${currentDate}                                     │
│ "tonight"              │ ${currentDate}                                     │
│ "tomorrow"             │ ${tomorrowDate}                                    │
│ "day after tomorrow"   │ ${afterTomorrowDate}                               │
│ "this weekend"         │ Next Saturday (calculate)                          │
│ "in 3 days"            │ ${currentDate} + 3 days (calculate)                │
│ "end of week"          │ Friday of this week                                │
│ "beginning of month"   │ 1st of next month if >15, else 1st of current      │
│ No mention             │ ${currentDate} (default)                           │
└────────────────────────┴────────────────────────────────────────────────────┘

⚠️ CRITICAL CLARIFICATION: "Monday" vs "next Monday" vs "this Monday"

┌────────────────────────┬────────────────────────────────────────────────────┐
│ Expression             │ Meaning                                             │
├────────────────────────┼────────────────────────────────────────────────────┤
│ "Monday"               │ The NEXT Monday coming (in 1-7 days)               │
│ "next Monday"          │ The Monday of NEXT WEEK (in 7-13 days)             │
│ "this Monday"          │ The Monday of THIS week (⚠️ may be past!)          │
└────────────────────────┴────────────────────────────────────────────────────┘

🌍 TIMEZONES:
   • Default: User's local timezone
   • If timezone mentioned explicitly, convert appropriately
   • Store original timezone in metadata.timezone_note when relevant

🕐 TIMES & DURATIONS:

┌────────────────────────┬───────────────┬──────────────────────────────────────┐
│ Expression             │ Time          │ Default Duration                     │
├────────────────────────┼───────────────┼──────────────────────────────────────┤
│ "2pm", "2:30pm"        │ 14:00, 14:30  │ -                                    │
│ "early morning"        │ 07:00         │ -                                    │
│ "morning"              │ 09:00         │ -                                    │
│ "noon"                 │ 12:00         │ -                                    │
│ "afternoon"            │ 14:00         │ -                                    │
│ "late afternoon"       │ 17:00         │ -                                    │
│ "evening"              │ 18:00         │ -                                    │
│ Appointment/Meeting    │ -             │ ${eventDurations.meeting} min        │
│ Call                   │ -             │ ${eventDurations.call} min           │
│ Lunch/Dinner           │ -             │ ${eventDurations.lunch} min          │
│ Coffee/Drinks          │ -             │ ${eventDurations.coffee} min         │
│ Visit/Trip             │ -             │ ${eventDurations.visit} min          │
│ Training/Workshop      │ -             │ ${eventDurations.training} min       │
│ Conference/Seminar     │ -             │ ${eventDurations.conference} min     │
└────────────────────────┴───────────────┴──────────────────────────────────────┘

[... Continue with remaining sections translated to English ...]

═══════════════════════════════════════════════════════════════════════════════
SECTION 11: STRICT JSON FORMAT (OUTPUT)
═══════════════════════════════════════════════════════════════════════════════

📋 GENERAL STRUCTURE:

{
  "items": [{
    "type": "task"|"event"|"note",
    "text": "Clear, actionable reformulated text",
    "title": "Note title (3-8 words)" | null,
    "content": "Structured note content" | null,
    "date": "YYYY-MM-DD",
    "start_time": "HH:MM" | null,
    "end_time": "HH:MM" | null,
    "location": "Precise location" | null,
    "owner": "Assigned person" | "Me",
    "project": "Exact project name if match" | null,
    "urgent": true|false,
    "important": true|false,
    "tags": ["tag1", "tag2"],
    "color": "blue"|"green"|"yellow"|"orange"|"red"|"purple"|null,
    "metadata": {
      "original_text": "raw text",
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
  "parsing_notes": "Observations about parsing if relevant"
}

═══════════════════════════════════════════════════════════════════════════════
FINAL REMINDER: YOU ARE A SECOND BRAIN
═══════════════════════════════════════════════════════════════════════════════

╔═════════════════════════════════════════════════════════════════════════════╗
║ 🧠 SECOND BRAIN PHILOSOPHY - 5 PILLARS                                      ║
╠═════════════════════════════════════════════════════════════════════════════╣
║ 1. CAPTURE    : Miss NOTHING, every distinct item matters                   ║
║ 2. ORGANIZE   : Precise classification, no ambiguity                        ║
║ 3. ENRICH     : Context, suggestions, useful metadata                       ║
║ 4. ANTICIPATE : Think of what the user might forget                         ║
║ 5. VERIFY     : Self-validation, flag any inconsistency                     ║
╚═════════════════════════════════════════════════════════════════════════════╝

🎯 QUALITY OBJECTIVE:
• Average confidence > 0.85
• Zero missed items in text
• Zero classification errors
• Relevant suggestions for important events
• Warnings for any detected anomaly

💡 REMINDER: The user should feel that you TRULY UNDERSTAND what they want to do,
not just that you're parsing text. You are their COGNITIVE EXTENSION.`;
}

export function generateUserPromptEN(config) {
  const {
    text, currentDate, currentDayName, currentTime,
    tomorrowDate, tomorrowDayName, afterTomorrowDate,
    activeProjects, existingTags, teamMembers,
    weekDaysStr
  } = config;

  return `🧠 SECOND BRAIN ACTIVATION - Complete analysis required

═══════════════════════════════════════════════════════════════════════════════
INBOX INPUT TO PROCESS
═══════════════════════════════════════════════════════════════════════════════

"""
${text}
"""

═══════════════════════════════════════════════════════════════════════════════
PRECISE TEMPORAL CONTEXT
═══════════════════════════════════════════════════════════════════════════════

📅 Today: ${currentDayName} ${currentDate}
📅 Tomorrow: ${tomorrowDayName} ${tomorrowDate}
📅 Day after tomorrow: ${afterTomorrowDate}
🕐 Current time: ${currentTime}

📆 Upcoming days (for "Monday", "Tuesday", etc. calculation):
${weekDaysStr}

═══════════════════════════════════════════════════════════════════════════════
USER CONTEXT
═══════════════════════════════════════════════════════════════════════════════

📁 Active projects (exact matching required):
${activeProjects.length > 0 ? '• ' + activeProjects.join('\\n• ') : '(No active projects)'}

🏷️ Existing tags (use in priority):
${existingTags.length > 0 ? existingTags.join(', ') : '(No existing tags)'}

👥 Team members (for assignment):
${teamMembers.length > 0 ? teamMembers.join(', ') : '(No registered members)'}

═══════════════════════════════════════════════════════════════════════════════
EXECUTION INSTRUCTIONS
═══════════════════════════════════════════════════════════════════════════════

1. PASS 1: Identify all distinct items (attention to spoken/dictated text)
2. PASS 2: Verify consistency (logical dates, correct types)
3. PASS 3: Enrich with suggestions and metadata

⚠️ CRITICAL REMINDER:
- "tomorrow" = ${tomorrowDate} (use this EXACT date, not a formula)
- Separate items if date/subject/type changes
- Event MUST have start_time (default 09:00 if not specified)
- Note MUST have distinct title AND content

═══════════════════════════════════════════════════════════════════════════════
RESPONSE FORMAT (STRICT JSON)
═══════════════════════════════════════════════════════════════════════════════

Respond ONLY with valid JSON (no markdown, no text before/after).
Structure: { "items": [...], "parsing_notes": "..." }`;
}
```

#### 2.2.3 Factory de prompts

Créer `la-manufacture-api/src/prompts/index.js` :

```javascript
// la-manufacture-api/src/prompts/index.js

import { generateSystemPromptFR, generateUserPromptFR } from './system-prompt-fr.js';
import { generateSystemPromptEN, generateUserPromptEN } from './system-prompt-en.js';
import { getI18nConfig } from '../i18n/index.js';

const promptGenerators = {
  fr: {
    system: generateSystemPromptFR,
    user: generateUserPromptFR
  },
  en: {
    system: generateSystemPromptEN,
    user: generateUserPromptEN
  }
};

export function generatePrompts(locale, config) {
  const generator = promptGenerators[locale] || promptGenerators['fr'];

  return {
    systemPrompt: generator.system(config),
    userPrompt: generator.user(config)
  };
}

export function buildPromptConfig(request, text, userData) {
  const { locale, timezone } = request.i18n;
  const i18nConfig = getI18nConfig(locale, timezone);

  const now = new Date();

  // Calculate dates in user's timezone
  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const dayFormatter = new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
    timeZone: timezone,
    weekday: 'long'
  });

  const timeFormatter = new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: locale !== 'fr'
  });

  const currentDate = dateFormatter.format(now);
  const currentDayName = dayFormatter.format(now);
  const currentTime = timeFormatter.format(now);

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = dateFormatter.format(tomorrow);
  const tomorrowDayName = dayFormatter.format(tomorrow);

  const afterTomorrow = new Date(now);
  afterTomorrow.setDate(afterTomorrow.getDate() + 2);
  const afterTomorrowDate = dateFormatter.format(afterTomorrow);

  // Calculate week days
  const weekDays = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    weekDays.push({
      name: dayFormatter.format(d),
      date: dateFormatter.format(d)
    });
  }
  const weekDaysStr = weekDays.map(d => `${d.name} → ${d.date}`).join(', ');

  return {
    text,
    locale,
    timezone,
    currentDate,
    currentDayName,
    currentTime,
    tomorrowDate,
    tomorrowDayName,
    afterTomorrowDate,
    weekDaysStr,
    activeProjects: userData.activeProjects || [],
    existingTags: userData.existingTags || [],
    teamMembers: userData.teamMembers || [],
    keywords: i18nConfig.keywords,
    businessHours: i18nConfig.businessHours,
    eventDurations: i18nConfig.eventDurations
  };
}
```

---

### Phase 3 : Modifications Database
**Durée estimée** : 1-2 heures
**Priorité** : P1

#### 2.3.1 Migration SQL

```sql
-- migration_add_i18n_fields.sql

-- Add locale and timezone to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS locale VARCHAR(10) DEFAULT 'fr',
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Europe/Paris';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_locale ON users(locale);

-- Add supported locales enum (optional, for validation)
DO $$ BEGIN
    CREATE TYPE supported_locale AS ENUM ('fr', 'en');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Comment columns
COMMENT ON COLUMN users.locale IS 'User preferred language (fr, en)';
COMMENT ON COLUMN users.timezone IS 'User timezone (IANA format, e.g., Europe/Paris, America/New_York)';
```

#### 2.3.2 API endpoint pour màj préférences

```javascript
// Dans routes/users.js ou routes/settings.js

fastify.patch('/user/preferences', async (request, reply) => {
  const userId = request.user.id;
  const { locale, timezone } = request.body;

  // Validate
  if (locale && !SUPPORTED_LOCALES.includes(locale)) {
    return reply.status(400).send({ error: `Unsupported locale: ${locale}` });
  }

  if (timezone) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
    } catch (e) {
      return reply.status(400).send({ error: `Invalid timezone: ${timezone}` });
    }
  }

  const result = await query(
    `UPDATE users SET
      locale = COALESCE($2, locale),
      timezone = COALESCE($3, timezone)
     WHERE id = $1
     RETURNING locale, timezone`,
    [userId, locale, timezone]
  );

  return reply.send({
    success: true,
    preferences: result.rows[0]
  });
});
```

---

### Phase 4 : Modifications Frontend
**Durée estimée** : 4-6 heures
**Priorité** : P2

#### 2.4.1 Détection automatique locale

```javascript
// la-manufacture-os/src/js/i18n-detect.js

export function detectUserLocale() {
  // 1. Check localStorage preference
  const savedLocale = localStorage.getItem('user_locale');
  if (savedLocale) return savedLocale;

  // 2. Check browser language
  const browserLang = navigator.language || navigator.userLanguage;
  const primaryLang = browserLang.split('-')[0];

  if (['fr', 'en'].includes(primaryLang)) {
    return primaryLang;
  }

  return 'fr'; // Default
}

export function detectUserTimezone() {
  // 1. Check localStorage preference
  const savedTimezone = localStorage.getItem('user_timezone');
  if (savedTimezone) return savedTimezone;

  // 2. Use browser API
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (e) {
    return 'Europe/Paris';
  }
}

export function saveUserPreferences(locale, timezone) {
  localStorage.setItem('user_locale', locale);
  localStorage.setItem('user_timezone', timezone);
}
```

#### 2.4.2 Injection headers API

```javascript
// la-manufacture-os/src/js/api-client.js

import { detectUserLocale, detectUserTimezone } from './i18n-detect.js';

// Dans la config fetch
const defaultHeaders = () => ({
  'Content-Type': 'application/json',
  'X-User-Locale': detectUserLocale(),
  'X-User-Timezone': detectUserTimezone(),
  // ... autres headers (auth, etc.)
});
```

#### 2.4.3 Structure fichiers i18n frontend

```
la-manufacture-os/
├── src/
│   └── i18n/
│       ├── index.js
│       └── locales/
│           ├── fr.json
│           └── en.json
```

#### 2.4.4 Fichier messages frontend

```json
// la-manufacture-os/src/i18n/locales/fr.json
{
  "common": {
    "today": "Aujourd'hui",
    "tomorrow": "Demain",
    "loading": "Chargement...",
    "error": "Erreur",
    "success": "Succès",
    "cancel": "Annuler",
    "save": "Enregistrer",
    "delete": "Supprimer",
    "edit": "Modifier"
  },
  "tasks": {
    "no_tasks_today": "Aucune tâche pour aujourd'hui ! 🎉",
    "add_task": "Ajouter une tâche",
    "task_created": "Tâche créée",
    "task_completed": "Tâche terminée"
  },
  "quick_dump": {
    "title": "Vide ta tête",
    "subtitle": "L'IA trie automatiquement : tâches, RDV au calendrier, et notes",
    "placeholder": "Ex: Appeler Marie demain → tâche\nEx: RDV dentiste vendredi 14h → calendrier...",
    "submit": "Ajouter les tâches",
    "processing": "Analyse en cours...",
    "mic_tooltip": "Dictée vocale",
    "mic_unsupported": "Dictée non supportée. Utilise Chrome ou Edge.",
    "listening": "Parle...",
    "created": "créé(s)!",
    "nothing_created": "Aucun élément créé"
  },
  "focus": {
    "title": "Mode Focus",
    "do_now": "Fais ça maintenant !",
    "complete": "Terminé",
    "skip": "Passer"
  },
  "errors": {
    "auth_required": "Connexion requise",
    "network_error": "Erreur réseau",
    "server_error": "Erreur serveur"
  }
}
```

```json
// la-manufacture-os/src/i18n/locales/en.json
{
  "common": {
    "today": "Today",
    "tomorrow": "Tomorrow",
    "loading": "Loading...",
    "error": "Error",
    "success": "Success",
    "cancel": "Cancel",
    "save": "Save",
    "delete": "Delete",
    "edit": "Edit"
  },
  "tasks": {
    "no_tasks_today": "No tasks for today! 🎉",
    "add_task": "Add task",
    "task_created": "Task created",
    "task_completed": "Task completed"
  },
  "quick_dump": {
    "title": "Brain dump",
    "subtitle": "AI automatically sorts: tasks, calendar events, and notes",
    "placeholder": "Ex: Call Marie tomorrow → task\nEx: Dentist appointment Friday 2pm → calendar...",
    "submit": "Add tasks",
    "processing": "Analyzing...",
    "mic_tooltip": "Voice dictation",
    "mic_unsupported": "Dictation not supported. Use Chrome or Edge.",
    "listening": "Speak...",
    "created": "created!",
    "nothing_created": "No items created"
  },
  "focus": {
    "title": "Focus Mode",
    "do_now": "Do this now!",
    "complete": "Done",
    "skip": "Skip"
  },
  "errors": {
    "auth_required": "Login required",
    "network_error": "Network error",
    "server_error": "Server error"
  }
}
```

---

### Phase 5 : Modification route /process-inbox
**Durée estimée** : 2-3 heures
**Priorité** : P0

#### 2.5.1 Refactoring de la route

```javascript
// la-manufacture-api/src/routes/ai.js (extrait modifié)

import { i18nMiddleware } from '../i18n/index.js';
import { generatePrompts, buildPromptConfig } from '../prompts/index.js';

export default async function aiRoutes(fastify) {
  // Apply i18n middleware to all routes in this file
  fastify.addHook('preHandler', i18nMiddleware);

  fastify.post('/process-inbox', async (request, reply) => {
    const { text } = request.body;

    if (!text?.trim()) {
      return reply.status(400).send({ error: 'Missing text' });
    }

    try {
      const userId = request.user.id;
      const { locale, timezone } = request.i18n;

      // Fetch user data (projects, tags, team members)
      const userData = await fetchUserData(userId);

      // Build prompt config with i18n awareness
      const promptConfig = buildPromptConfig(request, text.trim(), userData);

      // Generate prompts in user's language
      const { systemPrompt, userPrompt } = generatePrompts(locale, promptConfig);

      // Call Claude API
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      });

      // Parse and process response (unchanged logic)
      // ...

    } catch (error) {
      fastify.log.error('Process inbox error:', error);
      return reply.status(500).send({
        error: 'Inbox processing failed',
        details: error.message
      });
    }
  });
}
```

---

## 3. Tests et Validation

### 3.1 Tests unitaires i18n

```javascript
// tests/i18n.test.js

import { getI18nConfig, extractLocaleFromRequest } from '../src/i18n/index.js';

describe('i18n Configuration', () => {
  test('loads French locale correctly', () => {
    const config = getI18nConfig('fr', 'Europe/Paris');
    expect(config.keywords.day_names[0]).toBe('dimanche');
    expect(config.eventDurations.lunch).toBe(90);
  });

  test('loads English locale correctly', () => {
    const config = getI18nConfig('en', 'America/New_York');
    expect(config.keywords.day_names[0]).toBe('Sunday');
    expect(config.eventDurations.lunch).toBe(45);
  });

  test('extracts locale from X-User-Locale header', () => {
    const request = {
      headers: { 'x-user-locale': 'en-US' }
    };
    expect(extractLocaleFromRequest(request)).toBe('en');
  });

  test('falls back to default locale', () => {
    const request = {
      headers: {}
    };
    expect(extractLocaleFromRequest(request)).toBe('fr');
  });
});
```

### 3.2 Tests de parsing multi-langue

```javascript
// tests/prompt-parsing.test.js

describe('AI Prompt Parsing', () => {
  describe('French', () => {
    test('detects RDV as EVENT', async () => {
      const result = await processInbox('RDV dentiste jeudi 14h', 'fr');
      expect(result.items[0].type).toBe('event');
      expect(result.items[0].start_time).toBe('14:00');
    });

    test('detects déjeuner as EVENT', async () => {
      const result = await processInbox('déjeuner avec Marie vendredi', 'fr');
      expect(result.items[0].type).toBe('event');
    });
  });

  describe('English', () => {
    test('detects appointment as EVENT', async () => {
      const result = await processInbox('Dentist appointment Thursday 2pm', 'en');
      expect(result.items[0].type).toBe('event');
      expect(result.items[0].start_time).toBe('14:00');
    });

    test('detects lunch as EVENT', async () => {
      const result = await processInbox('lunch with Marie Friday', 'en');
      expect(result.items[0].type).toBe('event');
    });
  });
});
```

### 3.3 Matrice de tests timezone

| User Timezone | Input | Expected Date | Expected Time |
|---------------|-------|---------------|---------------|
| Europe/Paris | "demain 14h" | tomorrow +0 | 14:00 |
| America/New_York | "tomorrow 2pm" | tomorrow +0 | 14:00 |
| Asia/Tokyo | "明日 14時" | tomorrow +0 | 14:00 |
| America/Los_Angeles | "Monday 9am" | next Monday | 09:00 |

---

## 4. Checklist de déploiement

### 4.1 Pré-déploiement

- [ ] Migration DB exécutée (locale, timezone columns)
- [ ] Tests unitaires passent (FR + EN)
- [ ] Tests intégration passent
- [ ] Prompt EN validé manuellement (10 exemples)
- [ ] Prompt FR toujours fonctionnel (régression)
- [ ] Headers i18n fonctionnent (Postman/curl)

### 4.2 Déploiement staging

- [ ] Déployer API avec i18n
- [ ] Déployer frontend avec détection locale
- [ ] Tester Quick Dump en FR
- [ ] Tester Quick Dump en EN
- [ ] Tester timezone US (simuler headers)
- [ ] Vérifier logs/erreurs

### 4.3 Post-déploiement production

- [ ] Monitorer erreurs Claude API
- [ ] Vérifier métriques parsing (confidence moyenne)
- [ ] Collecter feedback utilisateurs EN
- [ ] Ajuster keywords si nécessaire

---

## 5. Estimation effort total

| Phase | Tâches | Durée |
|-------|--------|-------|
| **Phase 1** | Infrastructure i18n (fichiers, config, middleware) | 4-6h |
| **Phase 2** | Prompts système FR refactoré + EN complet | 6-8h |
| **Phase 3** | Database migration + API preferences | 1-2h |
| **Phase 4** | Frontend i18n (détection, messages, headers) | 4-6h |
| **Phase 5** | Modification route /process-inbox | 2-3h |
| **Tests** | Unitaires + intégration + manuels | 3-4h |
| **Buffer** | Imprévus, debugging, ajustements | 2-3h |

**Total estimé : 22-32 heures** (3-4 jours de travail concentré)

---

## 6. Risques et mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Régression prompt FR | Moyenne | Critique | Tests automatisés avant/après |
| Performance Claude avec 2 prompts | Faible | Moyen | Pas de changement (même format) |
| Timezone edge cases | Moyenne | Moyen | Tests exhaustifs DST/leap year |
| Keywords EN incomplets | Haute | Moyen | Itération rapide post-launch |
| UX confusion langue | Faible | Faible | Détection auto + option manuelle |

---

## 7. Évolutions futures

### 7.1 Court terme (après EN)
- Support Espagnol (ES) - marché LATAM
- Support Allemand (DE) - marché DACH

### 7.2 Moyen terme
- Détection automatique de langue dans le texte saisi
- Support mixte (input EN, UI FR)
- Amélioration continue keywords par ML

### 7.3 Long terme
- Multi-langue dans une même conversation IA
- Traduction automatique des tâches
- Support RTL (Arabe, Hébreu)

---

**Document créé le** : 2026-01-18
**Dernière mise à jour** : 2026-01-18
**Auteur** : Claude + User collaboration
