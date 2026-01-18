import pg from 'pg';
import dotenv from 'dotenv';

// Fix Date parsing to string
pg.types.setTypeParser(1082, function (stringValue) {
  return stringValue;
});

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Test connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', err => {
  console.error('❌ Unexpected error on idle client', err);
  // Ne pas crash le serveur - laisser le pool se reconnecter automatiquement
});

export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

export default pool;
