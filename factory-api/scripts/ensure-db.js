require('dotenv').config();
const { Client } = require('pg');

const arg = process.argv[2];
const targetDb = arg === 'test'
  ? (process.env.TEST_DB_NAME || 'factory_test_db')
  : (process.env.DB_NAME || 'factory_db');
const adminDb = process.env.DB_ADMIN_DB || 'postgres';

const quoteIdent = (name) => `"${name.replace(/"/g, '""')}"`;

const main = async () => {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: adminDb,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  await client.connect();
  const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [targetDb]);

  if (exists.rowCount > 0) {
    console.log(`Database already exists: ${targetDb}`);
    await client.end();
    return;
  }

  await client.query(`CREATE DATABASE ${quoteIdent(targetDb)}`);
  await client.end();
  console.log(`Database created: ${targetDb}`);
};

main().catch((err) => {
  console.error('Could not ensure database exists:', err.message);
  process.exit(1);
});
