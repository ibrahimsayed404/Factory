require('dotenv').config();
const pool = require('../src/db/pool');

async function main() {
  try {
    const res = await pool.query(`
      SELECT id, employee_id, week_start, week_end, base_salary, bonus, deductions, net_salary
      FROM payroll
      LIMIT 10
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
