# PostgreSQL Conventions

## Nommage

```sql
-- Tables: pluriel, snake_case
CREATE TABLE tasks (...);
CREATE TABLE team_members (...);

-- Colonnes: snake_case
user_id, created_at, is_completed

-- Indexes: idx_[table]_[column]
CREATE INDEX idx_tasks_user_id ON tasks(user_id);

-- Foreign keys: fk_[table]_[ref_table]
CONSTRAINT fk_tasks_users FOREIGN KEY (user_id) REFERENCES users(id)
```

## Requetes

```sql
-- Toujours nommer les colonnes (pas de SELECT *)
SELECT id, title, due_date FROM tasks;

-- Utiliser des alias explicites
SELECT t.id, t.title, u.name as user_name
FROM tasks t
JOIN users u ON t.user_id = u.id;

-- Parametres prepares ($1, $2...)
SELECT * FROM tasks WHERE user_id = $1 AND status = $2;
```

## Timestamps

```sql
-- Toujours inclure created_at et updated_at
CREATE TABLE example (
  id SERIAL PRIMARY KEY,
  -- ... autres colonnes
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Transactions

```javascript
const client = await fastify.pg.connect();
try {
  await client.query('BEGIN');
  // ... operations
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```

## Indexes

```sql
-- Sur les foreign keys
CREATE INDEX idx_tasks_user_id ON tasks(user_id);

-- Sur les colonnes de filtrage frequentes
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_status ON tasks(status);
```
