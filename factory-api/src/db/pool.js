const { Pool } = require('pg');

const sslMode = (process.env.PGSSLMODE || process.env.DB_SSL || '').toLowerCase();
const useSsl = ['require', 'true', '1'].includes(sslMode) || process.env.NODE_ENV === 'production';

// Vercel/serverless: tiny pools. Supabase Session mode only allows ~15 clients total.
// Prefer Transaction pooler (port 6543) in cloud; keep max low so instances don't exhaust it.
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const defaultMax = isServerless ? 1 : 5;
const max = Math.max(1, parseInt(process.env.DB_POOL_MAX || String(defaultMax), 10));

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'factory_db',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  max,
  idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_MS || '10000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECT_MS || '10000', 10),
  allowExitOnIdle: isServerless,
});

pool.on('connect', () => {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`Connected to PostgreSQL database (pool max=${max})`);
  }
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err.message);
  // Never exit the process on Vercel — that kills the function instance abruptly.
  if (!isServerless && process.env.NODE_ENV !== 'test') {
    process.exit(-1);
  }
});

module.exports = pool;
