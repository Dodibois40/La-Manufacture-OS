# /status

Affiche le statut du projet.

## Git

```bash
git status
git log --oneline -5
```

## Services

```bash
# Verifier si l'API tourne
curl -s http://localhost:3000/health || echo "API not running"

# Verifier si le frontend tourne
curl -s http://localhost:5173 || echo "Frontend not running"
```

## Database

```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM tasks;"
```

## Dependencies

```bash
# Verifier les outdated
cd la-manufacture-api && npm outdated
cd la-manufacture-os && npm outdated
```
