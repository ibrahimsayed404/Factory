require('dotenv').config();
const app = require('./app');
const pool = require('./db/pool');
const { startAutoPayrollScheduler } = require('./services/autoPayrollScheduler');

const PORT = process.env.PORT || 5000;

const ensureSalesSchema = async () => {
  // Non-destructive compatibility fix for older databases.
  // These ALTER TABLE statements only add missing columns and preserve all data.
  await pool.query(`
    ALTER TABLE IF EXISTS sales_order_items
      ADD COLUMN IF NOT EXISTS color VARCHAR(80);
    ALTER TABLE IF EXISTS products
      ADD COLUMN IF NOT EXISTS colors TEXT;
  `);
};

(async () => {
  try {
    await ensureSalesSchema();
    app.listen(PORT, () => {
      console.log(`Factory API running on http://localhost:${PORT}`);
      startAutoPayrollScheduler();
    });
  } catch (err) {
    console.error('Failed to initialize database compatibility columns:', err.message);
    process.exit(1);
  }
})();
