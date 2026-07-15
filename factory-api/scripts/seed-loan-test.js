require('dotenv').config();
const pool = require('../src/db/pool');

const main = async () => {
  try {
    // Create test employee with weekly salary of $1000
    const empRes = await pool.query(
      `INSERT INTO employees (name, email, role, shift, salary, hire_date)
       VALUES ('Test Employee', 'loan-test@test.com', 'Technician', 'morning', 1000, '2026-01-01')
       ON CONFLICT (email) DO UPDATE
       SET name = EXCLUDED.name, role = EXCLUDED.role, shift = EXCLUDED.shift, salary = EXCLUDED.salary
       RETURNING id, name, salary`
    );
    const employee = empRes.rows[0];
    console.log(`✓ Employee created: ${employee.name} (id=${employee.id}, weekly salary=$${employee.salary})`);

    // Create a loan: $1200 principal, $300/month installment
    const existingLoan = await pool.query(
      `SELECT id FROM hr_loans WHERE employee_id = $1`,
      [employee.id]
    );

    if (existingLoan.rows.length === 0) {
      const loanRes = await pool.query(
        `INSERT INTO hr_loans (employee_id, principal_amount, remaining_amount, monthly_installment, status)
         VALUES ($1, 1200, 1200, 300, 'active')
         RETURNING id, principal_amount, monthly_installment, remaining_amount`,
        [employee.id]
      );
      const loan = loanRes.rows[0];
      console.log(`✓ Loan created: $${loan.principal_amount} principal, $${loan.monthly_installment}/month installment, $${loan.remaining_amount} remaining`);
    } else {
      console.log(`✓ Loan already exists for employee`);
    }

    // Add attendance for the week 2026-06-26 to 2026-07-02 (Saturday to Friday)
    const attendanceRows = [
      { date: '2026-06-26', check_in: '09:00', check_out: '17:00', hours_worked: 8, overtime: 0, status: 'present' },
      { date: '2026-06-27', check_in: '09:00', check_out: '17:00', hours_worked: 8, overtime: 0, status: 'present' },
      { date: '2026-06-28', check_in: '09:00', check_out: '17:00', hours_worked: 8, overtime: 0, status: 'present' },
      { date: '2026-06-29', check_in: '09:00', check_out: '17:00', hours_worked: 8, overtime: 0, status: 'present' },
      { date: '2026-06-30', check_in: '09:00', check_out: '17:00', hours_worked: 8, overtime: 0, status: 'present' },
      { date: '2026-07-01', check_in: '09:00', check_out: '17:00', hours_worked: 8, overtime: 0, status: 'present' }, // weekend
      { date: '2026-07-02', check_in: '09:00', check_out: '17:00', hours_worked: 8, overtime: 0, status: 'present' },
    ];

    for (const row of attendanceRows) {
      await pool.query(
        `INSERT INTO attendance (employee_id, date, check_in, check_out, hours_worked, late_minutes, early_leave_minutes, overtime_minutes, status, notes)
         VALUES ($1, $2, $3, $4, $5, 0, 0, $6, $7, 'test data')
         ON CONFLICT (employee_id, date) DO UPDATE
         SET check_in = EXCLUDED.check_in, check_out = EXCLUDED.check_out, hours_worked = EXCLUDED.hours_worked, status = EXCLUDED.status`,
        [employee.id, row.date, row.check_in, row.check_out, row.hours_worked, row.overtime, row.status]
      );
    }
    console.log(`✓ Attendance records created for week 2026-06-26 to 2026-07-02`);

    console.log(`\n=== READY FOR PAYROLL TEST ===`);
    console.log(`Employee: ${employee.name} (ID ${employee.id})`);
    console.log(`Weekly salary: $${employee.salary} → Monthly equivalent: $${employee.salary * 4}`);
    console.log(`Loan: $300/month installment from $1200 principal`);
    console.log(`\nTo test, generate monthly payroll for July 2026 and you should see:`);
    console.log(`  - Base salary (monthly): $4000`);
    console.log(`  - Loan deduction: -$300`);
    console.log(`  - Net (if no other adjustments): $3700`);
    console.log(`\nAPI call:`);
    console.log(`  POST /api/payroll/monthly`);
    console.log(`  Body: {"employee_id": ${employee.id}, "month": 7, "year": 2026}`);
    console.log(`\nAfter payroll generated, loan remaining should update to $900`);

  } catch (err) {
    console.error('Failed to seed loan test data:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

main();
