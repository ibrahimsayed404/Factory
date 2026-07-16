require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../src/db/pool');

const baseSchema = path.join(__dirname, '..', 'src', 'db', 'schema.sql');
const migrationsDir = path.join(__dirname, '..', 'migrations');

const main = async () => {
  console.log('Connected to PostgreSQL database');

  // 1. Reset public schema
  console.log('Resetting database schema (dropping public)...');
  await pool.query('DROP SCHEMA public CASCADE');
  await pool.query('CREATE SCHEMA public');
  console.log('Public schema reset.');

  // 2. Initialize base schema
  console.log('Running base schema.sql...');
  const schemaSql = fs.readFileSync(baseSchema, 'utf8');
  await pool.query(schemaSql);
  console.log('Base schema initialized.');

  // 3. Get all migration files
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort((a, b) => {
      if (a.includes('production_tracking_phases') && b.includes('production_phase_analytics')) return -1;
      if (a.includes('production_phase_analytics') && b.includes('production_tracking_phases')) return 1;
      return a.localeCompare(b);
    });

  console.log(`Found ${files.length} migration files to apply.`);

  // 4. Run each migration in order
  for (const file of files) {
    console.log(`Applying migration: ${file}...`);
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    try {
      await pool.query(sql);
      console.log(`Successfully applied ${file}`);
    } catch (err) {
      console.error(`Migration ${file} failed:`, err.message);
      throw err;
    }
  }

  console.log('\nAll migrations applied successfully!');
};

main()
  .catch((err) => {
    console.error('Migration chain failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
