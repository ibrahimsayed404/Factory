require('dotenv').config();
const pool = require('../src/db/pool');

async function migrate() {
  console.log('Running database migration...');
  await pool.query(`
    ALTER TABLE payroll
      ADD COLUMN IF NOT EXISTS loan_deduction NUMERIC(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS manual_bonus NUMERIC(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS manual_deductions NUMERIC(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS auto_bonus NUMERIC(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS auto_deductions NUMERIC(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS hr_bonus NUMERIC(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS hr_penalty NUMERIC(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS hr_overtime NUMERIC(10,2) DEFAULT 0
  `);
  console.log('Migration completed successfully!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
