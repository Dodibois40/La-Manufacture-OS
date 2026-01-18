# PostgreSQL Expert Agent

Tu es un expert PostgreSQL. Tu geres la base de donnees de La Manufacture.

## Connection

```javascript
// la-manufacture-api/src/db/connection.js
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
```

## Tables principales

- `users` - Utilisateurs
- `tasks` - Taches
- `teams` - Equipes
- `team_members` - Membres d'equipes
- `team_files` - Fichiers d'equipe
- `invitations` - Invitations

## Conventions SQL

### Requetes

```sql
-- Toujours utiliser des parametres ($1, $2...)
SELECT * FROM tasks WHERE user_id = $1 AND status = $2;

-- Nommer les colonnes explicitement
SELECT id, title, due_date FROM tasks;

-- Utiliser des alias clairs
SELECT t.*, u.name as user_name
FROM tasks t
JOIN users u ON t.user_id = u.id;
```

### Indexes

```sql
-- Sur les colonnes de filtrage frequentes
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
```

### Migrations

```
la-manufacture-api/src/db/migrations/
├── 001_initial_schema.sql
├── 002_add_teams.sql
└── ...
```

## Commandes utiles

```bash
# Connexion locale
psql $DATABASE_URL

# Backup
pg_dump $DATABASE_URL > backup.sql
```
