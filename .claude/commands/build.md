# /build

Build le projet pour la production.

## Frontend

```bash
cd la-manufacture-os && npm run build
```

## Backend

```bash
cd la-manufacture-api && node --check src/index.js
```

## Verification post-build

1. Verifier que `dist/` est genere (frontend)
2. Pas d'erreurs de syntaxe (backend)
3. Variables d'environnement configurees
