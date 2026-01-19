/**
 * Database Migration Runner
 *
 * Executes SQL migrations in order, tracking which have been applied.
 * Migrations are stored in src/db/migrations/ with format: NNN_description.sql
 *
 * Usage:
 *   npm run db:migrate           - Run pending migrations
 *   npm run db:migrate:status    - Show migration status
 *   npm run db:migrate:rollback  - Rollback last migration (if down file exists)
 */

import fs from 'fs/promises';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * Ensure migrations tracking table exists
 */
async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      version VARCHAR(255) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      checksum VARCHAR(64)
    );
    CREATE INDEX IF NOT EXISTS idx_schema_migrations_version ON schema_migrations(version);
  `);
}

/**
 * Get list of applied migrations
 */
async function getAppliedMigrations() {
  const result = await pool.query(
    'SELECT version, name, applied_at FROM schema_migrations ORDER BY version'
  );
  return new Map(result.rows.map(row => [row.version, row]));
}

/**
 * Get list of migration files from disk
 */
async function getMigrationFiles() {
  try {
    const files = await fs.readdir(MIGRATIONS_DIR);
    return files
      .filter(f => f.endsWith('.sql') && !f.includes('.down.'))
      .sort()
      .map(filename => {
        const match = filename.match(/^(\d{3})_(.+)\.sql$/);
        if (!match) {
          console.warn(`⚠️  Skipping invalid migration filename: ${filename}`);
          return null;
        }
        return {
          version: match[1],
          name: match[2],
          filename,
          filepath: path.join(MIGRATIONS_DIR, filename),
        };
      })
      .filter(Boolean);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('📁 Creating migrations directory...');
      await fs.mkdir(MIGRATIONS_DIR, { recursive: true });
      return [];
    }
    throw error;
  }
}

/**
 * Calculate simple checksum for migration content
 */
function calculateChecksum(content) {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Run a single migration
 */
async function runMigration(migration, content) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Execute migration SQL
    await client.query(content);

    // Record migration
    const checksum = calculateChecksum(content);
    await client.query(
      'INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)',
      [migration.version, migration.name, checksum]
    );

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Run initial schema if no migrations exist (bootstrap mode)
 */
async function runInitialSchema() {
  const schemaPath = path.join(__dirname, 'schema.sql');

  if (!existsSync(schemaPath)) {
    console.log('⚠️  No schema.sql found - skipping initial schema');
    return false;
  }

  console.log('   🔧 Applying initial schema (schema.sql)...');
  const schemaSQL = readFileSync(schemaPath, 'utf8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(schemaSQL);
    await client.query(
      "INSERT INTO schema_migrations (version, name, checksum) VALUES ('000', 'initial_schema', $1)",
      [calculateChecksum(schemaSQL)]
    );
    await client.query('COMMIT');
    console.log('   ✅ Initial schema applied');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Main migration runner
 */
async function migrate() {
  console.log('🚀 Database Migration Runner\n');

  await ensureMigrationsTable();

  let appliedMigrations = await getAppliedMigrations();
  const migrationFiles = await getMigrationFiles();

  // Bootstrap: if no migrations applied, run schema.sql first
  if (appliedMigrations.size === 0) {
    try {
      await runInitialSchema();
      appliedMigrations = await getAppliedMigrations();
    } catch (error) {
      console.error('❌ Failed to apply initial schema:', error.message);
      process.exit(1);
    }
  }

  if (migrationFiles.length === 0) {
    console.log('📭 No migration files found in migrations/');
    console.log(`   Applied: ${appliedMigrations.size} migration(s)`);
    return;
  }

  const pendingMigrations = migrationFiles.filter(m => !appliedMigrations.has(m.version));

  if (pendingMigrations.length === 0) {
    console.log('✅ Database is up to date. No pending migrations.\n');
    console.log(`   Applied: ${appliedMigrations.size} migration(s)`);
    return;
  }

  console.log(`📋 Found ${pendingMigrations.length} pending migration(s):\n`);

  for (const migration of pendingMigrations) {
    console.log(`   ⏳ Running ${migration.version}_${migration.name}...`);

    try {
      const content = await fs.readFile(migration.filepath, 'utf-8');
      await runMigration(migration, content);
      console.log(`   ✅ ${migration.version}_${migration.name} applied successfully`);
    } catch (error) {
      console.error(`\n   ❌ Migration ${migration.version}_${migration.name} failed:`);
      console.error(`      ${error.message}\n`);
      process.exit(1);
    }
  }

  console.log(`\n✅ All migrations applied successfully!`);
}

/**
 * Show migration status
 */
async function status() {
  console.log('📊 Migration Status\n');

  await ensureMigrationsTable();

  const appliedMigrations = await getAppliedMigrations();
  const migrationFiles = await getMigrationFiles();

  // Include schema.sql as migration 000
  const allMigrations = [
    { version: '000', name: 'initial_schema', filename: 'schema.sql' },
    ...migrationFiles,
  ];

  if (allMigrations.length === 0 && appliedMigrations.size === 0) {
    console.log('📭 No migrations found.');
    return;
  }

  console.log('┌─────────┬────────────────────────────────┬─────────────────────┐');
  console.log('│ Version │ Name                           │ Status              │');
  console.log('├─────────┼────────────────────────────────┼─────────────────────┤');

  for (const migration of allMigrations) {
    const applied = appliedMigrations.get(migration.version);
    const status = applied
      ? `✅ ${new Date(applied.applied_at).toISOString().slice(0, 10)}`
      : '⏳ Pending';
    const name = migration.name.padEnd(30).slice(0, 30);
    console.log(`│ ${migration.version}     │ ${name} │ ${status.padEnd(19)} │`);
  }

  console.log('└─────────┴────────────────────────────────┴─────────────────────┘');

  const pending = allMigrations.filter(m => !appliedMigrations.has(m.version));
  console.log(`\n   Applied: ${appliedMigrations.size} | Pending: ${pending.length}`);
}

/**
 * Rollback last migration (if down file exists)
 */
async function rollback() {
  console.log('⏪ Rolling back last migration...\n');

  await ensureMigrationsTable();

  const result = await pool.query(
    "SELECT version, name FROM schema_migrations WHERE version != '000' ORDER BY version DESC LIMIT 1"
  );

  if (result.rows.length === 0) {
    console.log('📭 No migrations to rollback (only initial schema applied).');
    return;
  }

  const lastMigration = result.rows[0];
  const downFile = path.join(
    MIGRATIONS_DIR,
    `${lastMigration.version}_${lastMigration.name}.down.sql`
  );

  try {
    const downContent = await fs.readFile(downFile, 'utf-8');
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(downContent);
      await client.query('DELETE FROM schema_migrations WHERE version = $1', [
        lastMigration.version,
      ]);
      await client.query('COMMIT');

      console.log(`✅ Rolled back: ${lastMigration.version}_${lastMigration.name}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`❌ No down file found: ${downFile}`);
      console.log('   Create a .down.sql file to enable rollback for this migration.');
    } else {
      console.error('❌ Rollback failed:', error.message);
    }
    process.exit(1);
  }
}

// CLI handler
const command = process.argv[2];

switch (command) {
  case 'status':
    status()
      .then(() => process.exit(0))
      .catch(err => {
        console.error('Error:', err);
        process.exit(1);
      });
    break;

  case 'rollback':
    rollback()
      .then(() => process.exit(0))
      .catch(err => {
        console.error('Error:', err);
        process.exit(1);
      });
    break;

  default:
    migrate()
      .then(() => process.exit(0))
      .catch(err => {
        console.error('Error:', err);
        process.exit(1);
      });
}
