// compare-attendance-data.js
// Diagnostic script to compare attendance data between local factory_db and Supabase
// Does NOT modify anything - only reads and reports

require('dotenv').config();
delete process.env.PGSSLMODE;

const pg = require('pg');
// Keep dates/timestamps as raw strings to prevent timezone shifting
pg.types.setTypeParser(1082, (val) => val); // DATE
pg.types.setTypeParser(1114, (val) => val); // TIMESTAMP
pg.types.setTypeParser(1184, (val) => val); // TIMESTAMPTZ

const localConfig = {
  host: 'localhost',
  port: 5432,
  database: 'factory_db',
  user: 'postgres',
  password: 'salma136',
};

const cloudConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
};

const main = async () => {
  console.log('Connecting to local factory_db...');
  const localClient = new pg.Client(localConfig);
  await localClient.connect();

  console.log('Connecting to cloud Supabase...');
  const cloudClient = new pg.Client(cloudConfig);
  await cloudClient.connect();

  try {
    console.log('\n' + '='.repeat(70));
    console.log('CHECK 1: Row counts on Supabase');
    console.log('='.repeat(70));

    const attendanceCount = await cloudClient.query('SELECT COUNT(*)::int AS count FROM attendance');
    console.log(`attendance: ${attendanceCount.rows[0].count} rows`);

    const payrollCount = await cloudClient.query('SELECT COUNT(*)::int AS count FROM payroll');
    console.log(`payroll: ${payrollCount.rows[0].count} rows`);

    console.log('\n' + '='.repeat(70));
    console.log('CHECK 2: First 5 rows from Supabase attendance (ORDER BY id ASC)');
    console.log('='.repeat(70));
    const cloudFirst5 = await cloudClient.query('SELECT * FROM attendance ORDER BY id ASC LIMIT 5');
    console.table(cloudFirst5.rows);

    console.log('\n' + '='.repeat(70));
    console.log('CHECK 3: Last 5 rows from Supabase attendance (ORDER BY id DESC)');
    console.log('='.repeat(70));
    const cloudLast5 = await cloudClient.query('SELECT * FROM attendance ORDER BY id DESC LIMIT 5');
    console.table(cloudLast5.rows);

    console.log('\n' + '='.repeat(70));
    console.log('CHECK 4: First 5 rows from local factory_db attendance (ORDER BY id ASC)');
    console.log('='.repeat(70));
    const localFirst5 = await localClient.query('SELECT * FROM attendance ORDER BY id ASC LIMIT 5');
    console.table(localFirst5.rows);

    console.log('\n' + '='.repeat(70));
    console.log('CHECK 5: Last 5 rows from local factory_db attendance (ORDER BY id DESC)');
    console.log('='.repeat(70));
    const localLast5 = await localClient.query('SELECT * FROM attendance ORDER BY id DESC LIMIT 5');
    console.table(localLast5.rows);

    console.log('\n' + '='.repeat(70));
    console.log('CHECK 6: Local factory_db attendance count');
    console.log('='.repeat(70));
    const localAttendanceCount = await localClient.query('SELECT COUNT(*)::int AS count FROM attendance');
    console.log(`attendance: ${localAttendanceCount.rows[0].count} rows`);

    console.log('\n' + '='.repeat(70));
    console.log('COMPARISON SUMMARY');
    console.log('='.repeat(70));
    console.log(`Supabase attendance count: ${attendanceCount.rows[0].count}`);
    console.log(`Local attendance count: ${localAttendanceCount.rows[0].count}`);
    console.log(`Supabase payroll count: ${payrollCount.rows[0].count}`);

    console.log('\n' + '='.repeat(70));
    console.log('CHECK 7: Comparing first row IDs');
    console.log('='.repeat(70));
    if (cloudFirst5.rows.length > 0 && localFirst5.rows.length > 0) {
      console.log(`Supabase first row ID: ${cloudFirst5.rows[0].id}`);
      console.log(`Local first row ID: ${localFirst5.rows[0].id}`);
      console.log(`Supabase first row date: ${cloudFirst5.rows[0].date}`);
      console.log(`Local first row date: ${localFirst5.rows[0].date}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('CHECK 8: Comparing last row IDs');
    console.log('='.repeat(70));
    if (cloudLast5.rows.length > 0 && localLast5.rows.length > 0) {
      console.log(`Supabase last row ID: ${cloudLast5.rows[0].id}`);
      console.log(`Local last row ID: ${localLast5.rows[0].id}`);
      console.log(`Supabase last row date: ${cloudLast5.rows[0].date}`);
      console.log(`Local last row date: ${localLast5.rows[0].date}`);
    }

    console.log('\n✅ Diagnostic complete. Review the output above.');

  } catch (err) {
    console.error('\n❌ ERROR:', err.message);
    process.exit(1);
  } finally {
    await localClient.end();
    await cloudClient.end();
  }
};

main();
