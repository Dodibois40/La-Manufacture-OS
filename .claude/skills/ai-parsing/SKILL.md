# AI Parsing Skill - QUASAR

Systeme de parsing intelligent Second Brain V5 - QUASAR Edition.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    QUASAR PIPELINE                       │
├─────────────────────────────────────────────────────────┤
│  Input Text                                              │
│       │                                                  │
│       ▼                                                  │
│  ┌─────────────┐     complexity < 3                     │
│  │   Router    │─────────────────────┐                  │
│  └──────┬──────┘                     │                  │
│         │ complexity >= 3            │                  │
│         ▼                            ▼                  │
│  ┌─────────────┐              ┌─────────────┐          │
│  │ Stage 1:    │              │ Haiku Only  │          │
│  │ Haiku Fast  │              │ (simple)    │          │
│  └──────┬──────┘              └──────┬──────┘          │
│         │                            │                  │
│         ▼                            │                  │
│  ┌─────────────┐                     │                  │
│  │ Stage 2:    │                     │                  │
│  │ Sonnet      │                     │                  │
│  │ Enrichment  │                     │                  │
│  └──────┬──────┘                     │                  │
│         │                            │                  │
│         └────────────┬───────────────┘                  │
│                      ▼                                  │
│               ┌─────────────┐                           │
│               │ Zod Valid.  │                           │
│               └──────┬──────┘                           │
│                      ▼                                  │
│                   Output                                │
└─────────────────────────────────────────────────────────┘
```

## Fichiers

```
la-manufacture-api/src/prompts/
├── second-brain-v5-quasar.js   # Version actuelle
├── second-brain-v4-pulsar.js   # Version precedente
├── second-brain-v3-stellar.js  # Archive
└── ...
```

## Modeles utilises

| Route     | Modele           | Usage                     |
| --------- | ---------------- | ------------------------- |
| Fast      | claude-3-haiku   | Inputs simples < 50 chars |
| Smart     | claude-3-haiku\* | Inputs complexes          |
| Reasoning | claude-3-haiku\* | Enrichissement            |

\*En prod avec acces API complet: Sonnet 3.5

## Routing intelligent

```javascript
// Criteres de complexite
let complexity = 0;
if (text.length > 50) complexity += 1;
if (hasComplexKeywords) complexity += 2;  // urgent, client, deadline...
if (hasMultipleItems) complexity += 2;    // +, et, and, ,
if (hasTime) complexity += 1;             // 14h, 9:30
if (userProfile) complexity += 1;
if (corrections_history) complexity += 1;

// Decision
complexity < 3  → Haiku only (fast path)
complexity >= 3 → 2-stage pipeline
complexity >= 4 → + enrichment
```

## Schema de sortie

```typescript
{
  items: Array<{
    type: "task" | "event" | "note",
    text: string,
    date: "YYYY-MM-DD",
    start_time: "HH:MM" | null,
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
        patterns: Array<{type, day?, rrule?}>,
        chain: {current_step, next[]} | null
      },
      learning: {new_entity?}
    }
  }>,
  suggestions: Array<{
    type: "prep_task"|"followup"|"implicit_action"|"smart_reminder",
    task: string,
    date: "YYYY-MM-DD",
    score: number,
    reason: string
  }>,
  meta: {
    detected_lang: "fr"|"en"|"es"|"de",
    parse_mode: "ai"
  }
}
```

## Chaines predictives

| Declencheur   | Actions generees                 |
| ------------- | -------------------------------- |
| RDV client    | → Compte-rendu J+1 → Relance J+7 |
| Envoyer devis | → Relance J+7 si pas de reponse  |
| Presentation  | → Preparation J-1 → Resume J+1   |
| RDV medical   | → Rappel J-1                     |

## Optimisations

### Prompt Caching

- 85% du prompt est statique (cacheable)
- Reduction de ~70% des couts

### Context Compression

- Sessions longues: garde les 10 items les plus importants
- Tri: urgent > important > recent

### Batch Processing

```javascript
// Traiter plusieurs inputs en parallele
const results = await parseQuasarBatch(anthropic, [
  'RDV client demain 14h',
  'Envoyer rapport vendredi',
  'Idee: nouveau design',
]);
```

## Utilisation

```javascript
import quasar from './prompts/second-brain-v5-quasar.js';

// Parse simple
const { result, telemetry } = await quasar.parse(anthropic, 'RDV client Martin jeudi 14h', {
  userProfile,
  memoryContext,
});

// Estimer le cout avant
const estimate = quasar.estimateCost(text);
console.log(`Estimated: $${estimate.estimated_cost}`);
```

## Tests

```bash
cd la-manufacture-api
node tests/test-parser-direct.js
```
