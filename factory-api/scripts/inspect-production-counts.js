require('dotenv').config();
const pool = require('../src/db/pool');

const TABLES = [
  'users',
  'employees',
  'departments',
  'attendance',
  'payroll',
  'products',
  'materials',
  'inventory_transactions',
  'customers',
  'sales_orders',
  'production_orders',
];

const tableExists = async (table) => {
  const result = await pool.query(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    ) AS exists`,
    [table]
  );
  return result.rows[0].exists;
};

const main = async () => {
  const db = await pool.query('SELECT current_database() AS database, current_user AS user');
  console.log('database:', db.rows[0].database);
  console.log('db_user:', db.rows[0].user);

  for (const table of TABLES) {
    if (!(await tableExists(table))) {
      console.log(`${table}: missing`);
      continue;
    }
    const count = await pool.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
    console.log(`${table}: ${count.rows[0].count}`);
  }
};

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
