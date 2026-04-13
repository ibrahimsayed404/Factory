require('dotenv').config();
const pool = require('../config/db');

const main = async () => {
  const result = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM employees) AS employees,
      (SELECT COUNT(*) FROM materials) AS materials,
      (SELECT COUNT(*) FROM production_orders) AS production_orders,
      (SELECT COUNT(*) FROM production_phases) AS production_phases,
      (SELECT COUNT(*) FROM payroll) AS payroll,
      (SELECT COUNT(*) FROM customers) AS customers,
      (SELECT COUNT(*) FROM sales_orders) AS sales_orders,
      (SELECT COUNT(*) FROM departments) AS departments
  `);

  console.log(result.rows[0]);
};

main()
  .catch((err) => {
    console.error('Failed to verify reset state:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
