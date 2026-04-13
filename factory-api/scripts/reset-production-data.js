require('dotenv').config();
const pool = require('../config/db');

const TABLES_TO_CLEAR = [
  'production_phases',
  'production_materials',
  'production_orders',
  'sales_order_items',
  'sales_orders',
  'customer_payments',
  'business_expenses',
  'customers',
  'payroll',
  'attendance_punch_events',
  'attendance',
  'materials',
  'machines',
  'employees',
  'departments',
  'users',
  'app_settings',
];

const quoteIdent = (name) => `"${name.replace(/"/g, '""')}"`;

const main = async () => {
  const existingResult = await pool.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = ANY($1::text[])`,
    [TABLES_TO_CLEAR]
  );

  const existingSet = new Set(existingResult.rows.map((r) => r.table_name));
  const existingTables = TABLES_TO_CLEAR.filter((t) => existingSet.has(t));

  if (existingTables.length > 0) {
    const tableList = existingTables.map(quoteIdent).join(', ');
    await pool.query(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
  }

  await pool.query(`
    INSERT INTO departments (name) VALUES
      ('Cutting'),
      ('Sewing'),
      ('Quality Control'),
      ('Warehouse'),
      ('Administration')
    ON CONFLICT DO NOTHING
  `);

  console.log('Production database data cleared and baseline departments seeded.');
};

main()
  .catch((err) => {
    console.error('Failed to reset production data:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
