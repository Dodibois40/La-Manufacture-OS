# Claude Project Template

Guide pour demarrer un nouveau projet avec une structure `.claude` professionnelle.

---

## Quick Start

```bash
# 1. Creer le projet
mkdir mon-projet && cd mon-projet
git init

# 2. Creer la structure .claude
mkdir -p .claude/{agents,commands,rules,skills}

# 3. Copier les templates ci-dessous
```

---

## Structure recommandee

```
.claude/
├── agents/           # Personas specialises
│   ├── architect.md
│   ├── developer.md
│   ├── debugger.md
│   ├── code-reviewer.md
│   └── [stack]-expert.md
├── commands/         # Commandes rapides
│   ├── build.md
│   ├── test.md
│   ├── deploy.md
│   ├── lint.md
│   └── status.md
├── rules/            # Conventions du projet
│   ├── [framework]-conventions.md
│   ├── git-workflow.md
│   └── server-management.md
├── skills/           # Competences specifiques
│   └── [domain]/
│       └── SKILL.md
└── settings.local.json
```

---

## Templates

### 1. Agents

#### agents/architect.md

```markdown
# Architect Agent

Tu es l'architecte logiciel du projet [NOM_PROJET].

## Architecture globale

\`\`\`
[STRUCTURE_DOSSIERS]
\`\`\`

## Stack technique

- **Frontend**: [FRAMEWORK]
- **Backend**: [FRAMEWORK]
- **Database**: [DB]
- **Deploy**: [PLATFORM]

## Principes architecturaux

1. [PRINCIPE_1]
2. [PRINCIPE_2]
3. [PRINCIPE_3]

## Decisions architecturales

- [DECISION_1]: [RAISON]
- [DECISION_2]: [RAISON]
```

#### agents/developer.md

```markdown
# Developer Agent

Tu es un expert [STACK]. Tu developpes [PARTIE] de [NOM_PROJET].

## Stack

- **Runtime**: [RUNTIME]
- **Framework**: [FRAMEWORK]
- **Database**: [DB]

## Structure du projet

\`\`\`
[STRUCTURE]
\`\`\`

## Conventions

### [CONCEPT_1]

\`\`\`[LANG]
// Exemple de code
\`\`\`

### [CONCEPT_2]

\`\`\`[LANG]
// Exemple de code
\`\`\`
```

#### agents/debugger.md

```markdown
# Debugger Agent

Tu es un expert en debugging pour [NOM_PROJET].

## Methode de debugging

### 1. Reproduire le bug

- Identifier les etapes exactes
- Noter l'environnement
- Capturer les logs d'erreur

### 2. Isoler le probleme

- Frontend ou Backend?
- Quelle route/fonction?
- Quelles donnees?

### 3. Analyser

\`\`\`bash

# Commandes de debug

[COMMANDE_LOGS]
\`\`\`

### 4. Corriger et verifier

## Bugs courants

### [CATEGORIE_1]

- [BUG]: [SOLUTION]

### [CATEGORIE_2]

- [BUG]: [SOLUTION]
```

#### agents/code-reviewer.md

```markdown
# Code Reviewer Agent

Tu analyses le code pour garantir la qualite.

## Checklist de review

### Securite

- [ ] Pas d'injection (SQL, XSS, etc.)
- [ ] Auth verifiee sur routes protegees
- [ ] Secrets pas commites

### Performance

- [ ] Pas de requetes N+1
- [ ] Pas de boucles inutiles

### Maintenabilite

- [ ] Noms explicites
- [ ] Fonctions courtes
- [ ] Pas de code duplique
- [ ] Gestion des erreurs

### Standards

- [ ] Conventions respectees
- [ ] Pas de console.log en prod
```

#### agents/ci-cd.md

```markdown
# CI/CD Agent

Tu geres le deploiement de [NOM_PROJET].

## Architecture

\`\`\`
[DIAGRAMME_DEPLOY]
\`\`\`

## [PLATFORM_1] (Backend)

### Configuration

- Service: [NOM]
- Runtime: [RUNTIME]
- Deploy: [METHODE]

### Variables d'environnement

\`\`\`
[VARS]
\`\`\`

### Commandes

\`\`\`bash
[COMMANDES]
\`\`\`

## [PLATFORM_2] (Frontend)

### Configuration

- Site: [NOM]
- Build: [COMMANDE]
- Publish: [DOSSIER]

### Commandes

\`\`\`bash
[COMMANDES]
\`\`\`

## Rollback

[INSTRUCTIONS]
```

---

### 2. Commands

#### commands/build.md

```markdown
# /build

Build le projet pour la production.

## Frontend

\`\`\`bash
cd [FRONTEND_DIR] && npm run build
\`\`\`

## Backend

\`\`\`bash
cd [BACKEND_DIR] && [BUILD_CMD]
\`\`\`

## Verification

1. Verifier que [OUTPUT_DIR] est genere
2. Pas d'erreurs de syntaxe
3. Variables d'environnement OK
```

#### commands/test.md

```markdown
# /test

Lance les tests du projet.

## Tests unitaires

\`\`\`bash
npm test
\`\`\`

## Tests E2E

\`\`\`bash
npm run test:e2e
\`\`\`

## Coverage

\`\`\`bash
npm run test:coverage
\`\`\`
```

#### commands/deploy.md

```markdown
# /deploy

Deploiement du projet.

## Checklist pre-deploy

- [ ] Tests passent
- [ ] Build sans erreur
- [ ] Variables d'env a jour
- [ ] Migrations appliquees

## Commandes

\`\`\`bash
[DEPLOY_COMMANDS]
\`\`\`

## URLs

- **Frontend**: [URL]
- **API**: [URL]
```

#### commands/lint.md

```markdown
# /lint

Verification du code.

## Linter

\`\`\`bash
npm run lint
\`\`\`

## Format

\`\`\`bash
npm run format
\`\`\`

## Fix automatique

\`\`\`bash
npm run lint -- --fix
\`\`\`
```

#### commands/status.md

```markdown
# /status

Affiche le statut du projet.

## Git

\`\`\`bash
git status
git log --oneline -5
\`\`\`

## Services

\`\`\`bash

# Verifier les services

[HEALTH_CHECKS]
\`\`\`

## Dependencies

\`\`\`bash
npm outdated
\`\`\`
```

---

### 3. Rules

#### rules/git-workflow.md

```markdown
# Git Workflow

## Husky (si utilise)

\`\`\`bash

# .husky/pre-commit

npx lint-staged
\`\`\`

## Branches

\`\`\`
main # Production
feature/_ # Nouvelles features
fix/_ # Bug fixes
\`\`\`

## Commits

\`\`\`
type(scope): description

Types: feat, fix, refactor, test, docs, style, chore
\`\`\`

## Workflow

\`\`\`bash
git pull origin main
git checkout -b feature/ma-feature

# ... code ...

git add .
git commit -m "feat(scope): description"
git push origin feature/ma-feature

# Creer PR sur GitHub

\`\`\`
```

#### rules/[framework]-conventions.md

```markdown
# [Framework] Conventions

## Structure des fichiers

\`\`\`
[STRUCTURE]
\`\`\`

## [CONCEPT_1]

\`\`\`[LANG]
// Exemple
\`\`\`

## [CONCEPT_2]

\`\`\`[LANG]
// Exemple
\`\`\`

## [CONCEPT_3]

\`\`\`[LANG]
// Exemple
\`\`\`
```

#### rules/server-management.md

```markdown
# Server Management

## Environnements

### Development

\`\`\`bash
npm run dev
\`\`\`

### Production

- **API**: [PLATFORM]
- **Frontend**: [PLATFORM]
- **Database**: [PLATFORM]

## Variables d'environnement

\`\`\`
[VARS_LIST]
\`\`\`

## Health checks

\`\`\`bash
[COMMANDS]
\`\`\`

## Backup

\`\`\`bash
[BACKUP_COMMANDS]
\`\`\`
```

---

### 4. Skills

#### skills/[domain]/SKILL.md

```markdown
# [Domain] Skill

[DESCRIPTION]

## Architecture

\`\`\`
[DIAGRAMME]
\`\`\`

## Fichiers

\`\`\`
[FICHIERS_CONCERNES]
\`\`\`

## Concepts cles

### [CONCEPT_1]

[EXPLICATION]

### [CONCEPT_2]

[EXPLICATION]

## Utilisation

\`\`\`[LANG]
// Exemple d'utilisation
\`\`\`

## Tests

\`\`\`bash
[TEST_COMMANDS]
\`\`\`
```

---

### 5. Settings

#### settings.local.json

```json
{
  "permissions": {
    "allow": [
      "Bash(npm install:*)",
      "Bash(npm run dev:*)",
      "Bash(npm run build:*)",
      "Bash(npm test:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git push:*)",
      "Bash(git status:*)",
      "Bash(git log:*)",
      "Bash(node:*)"
    ]
  }
}
```

---

## Stacks courantes

### Node.js + Express/Fastify + PostgreSQL

```
agents/
├── architect.md
├── express-developer.md  # ou fastify-developer.md
├── postgresql-expert.md
├── debugger.md
├── code-reviewer.md
└── ci-cd.md

rules/
├── express-conventions.md
├── postgresql-conventions.md
├── git-workflow.md
└── server-management.md
```

### React/Next.js + Node.js

```
agents/
├── architect.md
├── react-developer.md  # ou nextjs-developer.md
├── backend-developer.md
├── debugger.md
├── code-reviewer.md
└── ci-cd.md

rules/
├── react-conventions.md
├── backend-conventions.md
├── git-workflow.md
└── server-management.md
```

### Python + FastAPI + PostgreSQL

```
agents/
├── architect.md
├── fastapi-developer.md
├── postgresql-expert.md
├── debugger.md
├── code-reviewer.md
└── ci-cd.md

rules/
├── python-conventions.md
├── fastapi-conventions.md
├── postgresql-conventions.md
├── git-workflow.md
└── server-management.md
```

### Vue/Nuxt + Laravel

```
agents/
├── architect.md
├── vue-developer.md
├── laravel-developer.md
├── debugger.md
├── code-reviewer.md
└── ci-cd.md

rules/
├── vue-conventions.md
├── laravel-conventions.md
├── git-workflow.md
└── server-management.md
```

---

## Checklist nouveau projet

- [ ] Creer `.claude/agents/architect.md`
- [ ] Creer `.claude/agents/[stack]-developer.md`
- [ ] Creer `.claude/agents/debugger.md`
- [ ] Creer `.claude/agents/code-reviewer.md`
- [ ] Creer `.claude/agents/ci-cd.md`
- [ ] Creer `.claude/commands/build.md`
- [ ] Creer `.claude/commands/test.md`
- [ ] Creer `.claude/commands/deploy.md`
- [ ] Creer `.claude/commands/lint.md`
- [ ] Creer `.claude/commands/status.md`
- [ ] Creer `.claude/rules/[framework]-conventions.md`
- [ ] Creer `.claude/rules/git-workflow.md`
- [ ] Creer `.claude/rules/server-management.md`
- [ ] Creer `.claude/settings.local.json`
- [ ] Ajouter skills specifiques si necessaire

---

## Tips

1. **Adapter au stack**: Ne pas copier-coller betement, adapter chaque fichier au stack reel
2. **Exemples concrets**: Inclure des exemples de code du projet, pas generiques
3. **Maintenir a jour**: Mettre a jour quand le projet evolue
4. **Pas de sur-documentation**: Documenter ce qui est utile, pas tout
5. **Tester**: Verifier que les commandes fonctionnent

---

_Template cree pour La Manufacture OS - Janvier 2026_
