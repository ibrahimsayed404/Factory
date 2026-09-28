/* eslint-env jest */
require('dotenv').config();
require('./dbSafetyGuard');

const fs = require('node:fs');
const path = require('node:path');
const pool = require('../../src/db/pool');
const { runAutoCheckoutShiftBased } = require('../../src/modules/employees/autoAttendance.scheduler');

const schemaSql = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'db', 'schema.sql'), 'utf8');

// "Now" is Thu 2026-08-20 08:30 Cairo: today's 08:00-17:00 shift has not ended yet.
const NOW = new Date('2026-08-20T08:30:00+03:00');
let employeeId;

const openCheckIn = async (date) => {
  const res = await pool.query(
    "INSERT INTO attendance (employee_id, date, check_in, status) VALUES ($1, $2, '08:00', 'present') RETURNING id",
    [employeeId, date]
  );
  return res.rows[0].id;
};
const checkOutOf = async (id) => (await pool.query("SELECT TO_CHAR(check_out, 'HH24:MI') AS c FROM attendance WHERE id = $1", [id])).rows[0].c;

beforeAll(async () => {
  await pool.query(schemaSql);
  const emp = await pool.query(
    "INSERT INTO employees (name, email, salary, shift, shift_start, shift_end, weekend_days, hire_date) VALUES ('Auto Checkout Worker', 'auto-checkout@test.com', 3000, 'morning', '08:00', '17:00', '5', '2020-01-01') RETURNING id"
  );
  employeeId = emp.rows[0].id;
});

afterAll(async () => {
  await pool.query('DELETE FROM attendance WHERE employee_id = $1', [employeeId]);
  await pool.query('DELETE FROM payroll WHERE employee_id = $1', [employeeId]);
  await pool.query('DELETE FROM employees WHERE id = $1', [employeeId]);
  await pool.end();
});

test('closes past unpaid open check-ins, never paid weeks, old history, or today before shift end', async () => {
  const yesterday = await openCheckIn('2026-08-19'); // unpaid week -> close
  const paidDay = await openCheckIn('2026-08-10'); // inside a paid week -> keep
  const tooOld = await openCheckIn('2026-08-01'); // beyond the 14-day lookback -> keep
  const today = await openCheckIn('2026-08-20'); // shift not over -> keep

  await pool.query(
    "INSERT INTO payroll (employee_id, month, year, base_salary, net_salary, status, week_start, week_end) VALUES ($1, 8, 2026, 3000, 3000, 'paid', '2026-08-08', '2026-08-14')",
    [employeeId]
  );

  const closed = await runAutoCheckoutShiftBased(NOW);

  expect(closed).toBe(1);
  expect(await checkOutOf(yesterday)).toBe('17:00');
  expect(await checkOutOf(paidDay)).toBeNull();
  expect(await checkOutOf(tooOld)).toBeNull();
  expect(await checkOutOf(today)).toBeNull();
});
