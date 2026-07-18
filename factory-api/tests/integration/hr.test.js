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

// A known Saturday and its Sat→Fri week.
const WEEK_START = '2023-08-05';
const WEEK_WORKDAYS = ['2023-08-05', '2023-08-06', '2023-08-07', '2023-08-08', '2023-08-09', '2023-08-10']; // Sat..Thu (Fri = weekend)

beforeAll(async () => {
  await pool.query(schemaSql);
  server = app.listen(0);

  const userRes = await pool.query(`
    INSERT INTO users (name, email, password, role)
    VALUES ('Admin', 'admin_hr_test@test.com', 'password', 'admin')
    ON CONFLICT (email) DO UPDATE SET role = 'admin'
    RETURNING id
  `);
  const userId = userRes.rows[0].id;
  adminToken = jwt.sign({ id: userId, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });

  const empRes = await pool.query(
    "INSERT INTO employees (name, email, salary, weekend_days, hire_date) VALUES ('HR Test', 'hr@test.com', 6000, '5', '2020-01-01') RETURNING id"
  );
  employeeId = empRes.rows[0].id;
});

afterAll(async () => {
  await pool.query('DELETE FROM payroll WHERE employee_id = $1', [employeeId]);
  await pool.query('DELETE FROM hr_loans WHERE employee_id = $1', [employeeId]);
  await pool.query('DELETE FROM hr_transactions WHERE employee_id = $1', [employeeId]);
  await pool.query('DELETE FROM attendance WHERE employee_id = $1', [employeeId]);
  await pool.query("DELETE FROM employees WHERE email = 'hr@test.com'");
  await pool.query("DELETE FROM users WHERE email = 'admin_hr_test@test.com'");
  await new Promise((resolve) => server.close(resolve));
});

describe('HR & Weekly Payroll Integration', () => {
  it('generates weekly payroll with HR bonus/penalty and a prorated loan installment', async () => {
    // Weekly salary 6000, 6 working days -> daily rate 1000.
    await pool.query(
      "INSERT INTO hr_transactions (employee_id, transaction_type, amount, transaction_date) VALUES ($1,'bonus',500,$2), ($1,'penalty',200,$3)",
      [employeeId, '2023-08-06', '2023-08-07']
    );
    // Monthly installment 100 -> weekly prorated = 100 / weeksPerMonth(4) = 25.
    await pool.query(
      'INSERT INTO hr_loans (employee_id, principal_amount, remaining_amount, monthly_installment) VALUES ($1,1000,1000,100)',
      [employeeId]
    );
    // Present every working day, no lateness/overtime.
    for (const d of WEEK_WORKDAYS) {
      await pool.query(
        "INSERT INTO attendance (employee_id, date, status, check_in, check_out) VALUES ($1,$2,'present','09:00','17:00') ON CONFLICT DO NOTHING",
        [employeeId, d]
      );
    }

    const res = await request(server)
      .post('/api/payroll')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employee_id: employeeId, week_start: WEEK_START });

    if (res.status !== 201) console.log(res.body);
    expect(res.status).toBe(201);
    // 6000 base + 500 bonus - 200 penalty - 25 loan = 6275
    expect(Number(res.body.net_salary)).toBe(6275);
    expect(Number(res.body.payroll_breakdown.loan_deduction)).toBe(25);

    const loan = await pool.query('SELECT remaining_amount FROM hr_loans WHERE employee_id = $1', [employeeId]);
    expect(Number(loan.rows[0].remaining_amount)).toBe(975); // 1000 - 25
  });

  it('does not double-deduct the loan when the same week is regenerated', async () => {
    const res = await request(server)
      .post('/api/payroll')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employee_id: employeeId, week_start: WEEK_START });

    expect(res.status).toBe(201);
    expect(Number(res.body.net_salary)).toBe(6275);

    // Remaining must be unchanged after re-running the same week.
    const loan = await pool.query('SELECT remaining_amount FROM hr_loans WHERE employee_id = $1', [employeeId]);
    expect(Number(loan.rows[0].remaining_amount)).toBe(975);
  });

  it('restores the exact loan amount when the week is deleted', async () => {
    const del = await request(server)
      .delete(`/api/payroll/week/${WEEK_START}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(200);

    const loan = await pool.query('SELECT remaining_amount, status FROM hr_loans WHERE employee_id = $1', [employeeId]);
    expect(Number(loan.rows[0].remaining_amount)).toBe(1000); // fully restored
    expect(loan.rows[0].status).toBe('active');
  });

  it('rejects the auto-run endpoint without authentication', async () => {
    const res = await request(server).get('/api/payroll/auto-run');
    expect(res.status).toBe(401);
  });
});
