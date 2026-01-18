# /lint

Verification du code avec ESLint et Prettier.

## Linter

```bash
# API
cd la-manufacture-api && npm run lint

# Frontend
cd la-manufacture-os && npm run lint
```

## Format

```bash
# Formatter tout le code
npx prettier --write "**/*.{js,css,json}"
```

## Fix automatique

```bash
npm run lint -- --fix
```

## Regles principales

- Pas de `console.log` en production
- Pas de variables non utilisees
- Indentation: 2 espaces
- Quotes: simples
- Semicolons: oui
