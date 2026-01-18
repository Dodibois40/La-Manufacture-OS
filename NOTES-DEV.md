# Notes de développement - La Manufacture

## Hébergement des services

| Service | Hébergeur | URL |
|---------|-----------|-----|
| **Frontend** | Netlify | (voir dashboard Netlify) |
| **API Backend** | Railway | https://lovely-exploration-production.up.railway.app |
| **Base de données** | Railway (PostgreSQL) | (via DATABASE_URL dans Railway) |
| **Auth** | Clerk | clerk.com |

**GitHub Repo** : `Dodibois40/La-Manufacture-OS`

---

## Problèmes résolus à ne pas reproduire

### 1. Timezone / Dates PostgreSQL (Janvier 2026)

**Problème** : Les tâches créées via l'IA n'apparaissaient pas dans le calendrier.

**Cause** :
- L'IA Claude retourne des dates en ISO avec timezone : `2026-01-19T00:00:00.000Z` (UTC)
- PostgreSQL stocke cette valeur telle quelle
- Le frontend requête avec une date simple : `date = '2026-01-19'`
- PostgreSQL interprète `'2026-01-19'` dans le fuseau local (UTC+1 pour la France)
- Résultat : `2026-01-19 00:00:00+00` (UTC) ≠ `2026-01-19` (interprété comme UTC+1) → PAS DE MATCH

**Solution** :
```javascript
// AVANT (bugué)
const taskDate = item.date || currentDate;

// APRÈS (corrigé)
const taskDate = item.date ? item.date.split('T')[0] : currentDate;
```

**Fichier concerné** : `la-manufacture-api/src/routes/ai.js` - endpoint `/process-inbox`

**Règle** : Toujours extraire uniquement `YYYY-MM-DD` des dates retournées par l'IA avant de les stocker en base.

---

### 2. Quick Dump - Parsing multi-items vocaux (Janvier 2026)

**Problème** : Quand l'utilisateur dicte plusieurs éléments d'un coup (idée + tâche + RDV), seul le premier était créé.

**Cause** : Le prompt IA ne détectait pas les délimiteurs implicites du texte parlé.

**Solution** : Ajout d'une section dans le prompt système pour détecter :
- Changements de contexte (nouvelle date, nouveau sujet)
- Marqueurs implicites : "et lundi...", "et mardi...", "aussi..."
- Règle d'or : "En cas de doute, SÉPARE les items"

**Fichier concerné** : `la-manufacture-api/src/routes/ai.js` - prompt de `/process-inbox`

---

### 3. Dates relatives non calculées dans le prompt (Janvier 2026)

**Problème** : Quand l'utilisateur dit "demain j'ai un rdv", la tâche/événement n'était pas créé avec la bonne date.

**Cause** : Le prompt disait `"demain" → ${currentDate} + 1 jour` au lieu de fournir la date calculée. Claude devait faire le calcul lui-même, ce qui causait des erreurs.

**Solution** : Calculer explicitement les dates relatives côté serveur et les fournir dans le prompt :
```javascript
// Avant (bugué)
// Le prompt disait: "demain" → 2026-01-18 + 1 jour

// Après (corrigé)
const tomorrow = new Date(now);
tomorrow.setDate(tomorrow.getDate() + 1);
const tomorrowDate = tomorrow.toISOString().split('T')[0];

// Le prompt dit maintenant: "demain" → 2026-01-19 (lundi)
```

**Fichier concerné** : `la-manufacture-api/src/routes/ai.js` - endpoint `/process-inbox`

**Règle** : Toujours fournir les dates calculées explicitement dans le prompt. Ne jamais demander à l'IA de faire des calculs de dates.

---
