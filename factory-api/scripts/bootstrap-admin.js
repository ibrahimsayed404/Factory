require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const ADMIN_NAME = process.env.BOOTSTRAP_ADMIN_NAME;
const ADMIN_EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const FORCE = process.env.FORCE_BOOTSTRAP_ADMIN === 'true';

const main = async () => {
  if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('Missing bootstrap admin env vars. Required: BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD');
    process.exit(1);
  }

  if (ADMIN_PASSWORD.length < 8) {
    console.error('BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters.');
    process.exit(1);
  }

  const adminCountRes = await pool.query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'");
  const adminCount = adminCountRes.rows[0].count;

  if (adminCount > 0 && !FORCE) {
    console.error('Admin user already exists. Refusing bootstrap to keep this flow one-time. Set FORCE_BOOTSTRAP_ADMIN=true only if you intentionally need to override.');
    process.exit(1);
  }

  const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [ADMIN_EMAIL]);

  if (existing.rows.length) {
    const updated = await pool.query(
      `UPDATE users
       SET name = $1, password = $2, role = 'admin'
       WHERE email = $3
       RETURNING id, name, email, role`,
      [ADMIN_NAME, hash, ADMIN_EMAIL]
    );
    console.log('Admin bootstrap completed by upgrading existing user:', updated.rows[0]);
  } else {
    const inserted = await pool.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, 'admin')
       RETURNING id, name, email, role`,
      [ADMIN_NAME, ADMIN_EMAIL, hash]
    );
    console.log('Admin bootstrap completed with new admin user:', inserted.rows[0]);
  }
};

main()
  .catch((err) => {
    console.error('Admin bootstrap failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
