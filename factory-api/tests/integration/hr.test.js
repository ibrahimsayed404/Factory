const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/db/pool');
const jwt = require('jsonwebtoken');
const fs = require('node:fs');
const path = require('node:path');

const schemaPath = path.join(__dirname, '..', '..', 'src', 'db', 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');

let server;
let adminToken;
let employeeId;

beforeAll(async () => {
  await pool.query(schemaSql);
  server = app.listen(0);

  const userRes = await pool.query(`
    INSERT INTO users (name, email, password, role)
    VALUES ('Admin', 'admin_hr_test@test.com', 'password', 'admin')
    RETURNING id
  `);
  const userId = userRes.rows[0].id;

  adminToken = jwt.sign({ id: userId, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  
  const empRes = await pool.query("INSERT INTO employees (name, email, salary) VALUES ('HR Test', 'hr@test.com', 5000) RETURNING id");
  employeeId = empRes.rows[0].id;
});

afterAll(async () => {
  await pool.query("DELETE FROM employees WHERE email = 'hr@test.com'");
  await pool.query("DELETE FROM users WHERE email = 'admin_hr_test@test.com'");
  await new Promise(resolve => server.close(resolve));
});

describe('HR & Monthly Payroll Integration Tests', () => {
  
  it('should generate monthly payroll correctly', async () => {
    // Give employee a bonus of 500 and penalty of 200 and a loan of 1000 with 100 installments
    await pool.query(
      "INSERT INTO hr_transactions (employee_id, transaction_type, amount, transaction_date) VALUES ($1, 'bonus', 500, '2023-08-15'), ($1, 'penalty', 200, '2023-08-20')", 
      [employeeId]
    );

    await pool.query(
      "INSERT INTO hr_loans (employee_id, principal_amount, remaining_amount, monthly_installment) VALUES ($1, 1000, 1000, 100)",
      [employeeId]
    );

    const generateRes = await request(server)
      .post('/api/payroll/monthly')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employee_id: employeeId, month: 8, year: 2023 });

    if (generateRes.status !== 201) console.log(generateRes.body);

    expect(generateRes.status).toBe(201);
    expect(generateRes.body.net_salary).toBe(5200); // 5000 + 500 (bonus) - 200 (penalty) - 100 (loan) = 5200
  });

});
