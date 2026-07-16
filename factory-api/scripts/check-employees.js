require('dotenv').config();
const pool = require('../src/db/pool');

async function main() {
  try {
    // Get departments
    const depts = await pool.query('SELECT id, name FROM departments ORDER BY id');
    console.log('=== DEPARTMENTS ===');
    for (const d of depts.rows) console.log(`  ${d.id}: ${d.name}`);

    // Get all employees with department
    const emps = await pool.query(`
      SELECT e.id, e.name, d.name as dept_name, e.department_id
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      ORDER BY d.name, e.id
    `);
    console.log('\n=== EMPLOYEES ===');
    let currentDept = '';
    for (const e of emps.rows) {
      if (e.dept_name !== currentDept) {
        currentDept = e.dept_name;
        console.log(`\n[${currentDept}]`);
      }
      console.log(`  ${e.id}: ${e.name}`);
    }

    // Check existing attendance dates
    const att = await pool.query('SELECT DISTINCT date FROM attendance ORDER BY date');
    console.log('\n=== EXISTING ATTENDANCE DATES ===');
    for (const a of att.rows) console.log(`  ${a.date}`);
    
    const attCount = await pool.query('SELECT count(*)::int as count FROM attendance');
    console.log(`\nTotal attendance records: ${attCount.rows[0].count}`);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

main();
