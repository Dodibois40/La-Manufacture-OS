# /db

Commandes de gestion de la base de donnees PostgreSQL.

## Connexion

```bash
psql $DATABASE_URL
```

## Migrations

```bash
# Appliquer les migrations
cd la-manufacture-api
node src/db/migrations/run.js
```

## Backup

```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

## Reset (dev only)

```bash
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

## Tables

- `users` - Comptes utilisateurs
- `tasks` - Taches
- `teams` - Equipes
- `team_members` - Membres
- `team_files` - Fichiers
- `invitations` - Invitations en attente
