require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const defaultMigration = path.join(__dirname, '..', 'migrations', '20260315_security_and_indexes.sql');
const baseSchema = path.join(__dirname, '..', 'src', 'db', 'schema.sql');
const targetMigration = process.argv[2]
  ? path.resolve(process.argv[2])
  : defaultMigration;

const main = async () => {
  if (!fs.existsSync(targetMigration)) {
    throw new Error(`Migration file not found: ${targetMigration}`);
  }

  const hasAttendance = await pool.query("SELECT to_regclass('public.attendance') AS name");
  if (!hasAttendance.rows[0].name) {
    const schemaSql = fs.readFileSync(baseSchema, 'utf8');
    await pool.query(schemaSql);
    console.log('Base schema initialized before migration.');
  }

  const sql = fs.readFileSync(targetMigration, 'utf8');
  await pool.query(sql);
  console.log(`Migration applied successfully: ${targetMigration}`);
};

main()
  .catch((err) => {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
