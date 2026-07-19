// get-employee-list.js
// Get full employee list from Supabase for name matching

require('dotenv').config();
delete process.env.PGSSLMODE;

const pg = require('pg');

const cloudConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
};

const main = async () => {
  console.log('Connecting to cloud Supabase...');
  const cloudClient = new pg.Client(cloudConfig);
  await cloudClient.connect();

  try {
    console.log('\n' + '='.repeat(70));
    console.log('EMPLOYEE LIST FROM SUPABASE');
    console.log('='.repeat(70));

    const employees = await cloudClient.query('SELECT id, name FROM employees ORDER BY id');
    console.table(employees.rows);

    console.log(`\nTotal employees: ${employees.rows.length}`);

    // Also export as JSON for easier reference
    console.log('\n' + '='.repeat(70));
    console.log('JSON FORMAT FOR REFERENCE');
    console.log('='.repeat(70));
    console.log(JSON.stringify(employees.rows, null, 2));

  } catch (err) {
    console.error('\n❌ ERROR:', err.message);
    process.exit(1);
  } finally {
    await cloudClient.end();
  }
};

main();
