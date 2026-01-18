# Git Workflow

## Husky + Lint-Staged

Le projet utilise Husky pour les git hooks automatiques.

### Pre-commit hook

```bash
# .husky/pre-commit
npx lint-staged
```

Lint-staged formate automatiquement le code avant chaque commit.

## Branches

```
main          # Production, toujours stable
feature/*     # Nouvelles fonctionnalites
fix/*         # Corrections de bugs
```

## Commits

### Format

```
type(scope): description

feat(api): add task filtering
fix(ui): correct mobile layout
refactor(db): optimize queries
test(parser): add QUASAR tests
docs(readme): update setup instructions
```

### Types

- `feat` - Nouvelle fonctionnalite
- `fix` - Correction de bug
- `refactor` - Refactoring sans changement de comportement
- `test` - Ajout/modification de tests
- `docs` - Documentation
- `style` - Formatage (pas de changement de code)
- `chore` - Maintenance (deps, config)

## Workflow quotidien

```bash
# 1. Pull les derniers changements
git pull origin main

# 2. Creer une branche
git checkout -b feature/ma-feature

# 3. Coder...

# 4. Commit (lint-staged s'execute automatiquement)
git add .
git commit -m "feat(scope): description"

# 5. Push
git push origin feature/ma-feature

# 6. Creer une PR sur GitHub
```

## Commandes utiles

```bash
# Voir le statut
git status

# Voir les logs
git log --oneline -10

# Annuler les changements non commites
git checkout -- .

# Stash temporaire
git stash
git stash pop
```
