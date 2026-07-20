// check-max-date.js
// Check the most recent attendance date on both local and Supabase

require('dotenv').config();
delete process.env.PGSSLMODE;

const pg = require('pg');

const localConfig = {
  host: 'localhost',
  port: 5432,
  database: 'factory_db',
  user: 'postgres',
  password: process.env.LOCAL_DB_PASSWORD,
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
    console.log('CHECK: MAX attendance date on both databases');
    console.log('='.repeat(70));

    const localMax = await localClient.query('SELECT MAX(date) AS max_date FROM attendance');
    console.log(`Local factory_db MAX(date): ${localMax.rows[0].max_date}`);

    const cloudMax = await cloudClient.query('SELECT MAX(date) AS max_date FROM attendance');
    console.log(`Supabase MAX(date): ${cloudMax.rows[0].max_date}`);

    console.log('\n' + '='.repeat(70));
    console.log('CONCLUSION');
    console.log('='.repeat(70));
    if (localMax.rows[0].max_date === cloudMax.rows[0].max_date) {
      console.log(`✅ Both databases have the same MAX date: ${localMax.rows[0].max_date}`);
      if (localMax.rows[0].max_date === '2026-07-12') {
        console.log('⚠️  Most recent attendance data is from 2026-07-12');
        console.log('   This means entries for July 13–16 are NOT in the database.');
      } else if (localMax.rows[0].max_date > '2026-07-12') {
        console.log('✅ Data includes dates beyond July 12, 2026');
      }
    } else {
      console.log(`❌ Databases have different MAX dates:`);
      console.log(`   Local: ${localMax.rows[0].max_date}`);
      console.log(`   Supabase: ${cloudMax.rows[0].max_date}`);
    }

  } catch (err) {
    console.error('\n❌ ERROR:', err.message);
    process.exit(1);
  } finally {
    await localClient.end();
    await cloudClient.end();
  }
};

main();
