const pool = require('../db/pool');

let hasWeekendDaysColumnCache = null;

const hasWeekendDaysColumn = async () => {
  if (hasWeekendDaysColumnCache === true) return true;
  const result = await pool.query(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'employees'
        AND column_name = 'weekend_days'
    ) AS exists`
  );
  hasWeekendDaysColumnCache = Boolean(result.rows[0]?.exists);
  return hasWeekendDaysColumnCache;
};

const getPayrollRecordsCount = async ({ weekStart, month, year, status, dateFrom, dateTo }) => {
  let countQuery = `
    SELECT COUNT(*)
    FROM payroll p
    JOIN employees e ON p.employee_id = e.id
    WHERE COALESCE(e.status, 'active') = 'active'
  `;
  const countParams = [];
  if (weekStart) { countParams.push(weekStart); countQuery += ` AND p.week_start = $${countParams.length}`; }
  if (month) { countParams.push(month); countQuery += ` AND p.month = $${countParams.length}`; }
  if (year) { countParams.push(year); countQuery += ` AND p.year = $${countParams.length}`; }
  if (status) { countParams.push(status); countQuery += ` AND p.status = $${countParams.length}`; }
  if (dateFrom) { countParams.push(dateFrom); countQuery += ` AND p.week_start >= $${countParams.length}::date`; }
  if (dateTo) { countParams.push(dateTo); countQuery += ` AND p.week_start <= $${countParams.length}::date`; }
  const countResult = await pool.query(countQuery, countParams);
  return Number.parseInt(countResult.rows[0].count, 10);
};

const getPayrollRecords = async ({ weekStart, month, year, status, dateFrom, dateTo, limit, offset, weekendDaysExpr, supportsWeekendDays }) => {
  const weekendSelect = supportsWeekendDays ? 'COALESCE(e.weekend_days, \'5\') AS weekend_days,' : '\'5\' AS weekend_days,';
  // week_start/week_end are cast to text (plain YYYY-MM-DD) so the JSON wire
  // format is timezone-stable — DATE columns would otherwise serialize as UTC
  // midnight ISO strings and shift a day on negative-UTC-offset clients.
  let query = `
    SELECT p.*, p.week_start::text AS week_start, p.week_end::text AS week_end,
      e.name AS employee_name, e.role, ${weekendSelect}
      d.name AS department_name,
      COALESCE(att.late_minutes, 0)::int AS late_minutes,
      COALESCE(att.late_weighted_minutes, 0)::float AS late_weighted_minutes,
      COALESCE(att.early_leave_minutes, 0)::int AS early_leave_minutes,
      COALESCE(att.overtime_minutes, 0)::int AS overtime_minutes,
      COALESCE(att.weekend_overtime_minutes, 0)::int AS weekend_overtime_minutes,
      COALESCE(att.absent_days, 0)::int AS absent_days,
      COALESCE(att.half_days, 0)::int AS half_days
    FROM payroll p
    JOIN employees e ON p.employee_id = e.id
    LEFT JOIN departments d ON e.department_id = d.id
    LEFT JOIN LATERAL (
      SELECT
        SUM(a.late_minutes)::int AS late_minutes,
        SUM(
          CASE
            WHEN COALESCE(a.late_minutes, 0) <= 10 THEN COALESCE(a.late_minutes, 0)::float
            ELSE COALESCE(a.late_minutes, 0)::float * 1.5
          END
        )::float AS late_weighted_minutes,
        SUM(a.early_leave_minutes)::int AS early_leave_minutes,
        SUM(a.overtime_minutes)::int AS overtime_minutes,
        SUM(CASE WHEN EXTRACT(DOW FROM a.date)::int = ANY(string_to_array(${weekendDaysExpr}, ',')::int[]) THEN a.overtime_minutes ELSE 0 END)::int AS weekend_overtime_minutes,
        SUM(CASE WHEN a.status='absent' THEN 1 ELSE 0 END)::int AS absent_days,
        SUM(CASE WHEN a.status='half-day' THEN 1 ELSE 0 END)::int AS half_days
      FROM attendance a
      WHERE a.employee_id = p.employee_id
        AND (
          (p.week_start IS NOT NULL AND a.date >= p.week_start AND a.date <= COALESCE(p.week_end, (p.week_start::date + INTERVAL '6 days')::date))
          OR
          (p.week_start IS NULL AND EXTRACT(MONTH FROM a.date) = p.month AND EXTRACT(YEAR FROM a.date) = p.year)
        )
    ) att ON true
    WHERE COALESCE(e.status, 'active') = 'active'
  `;
  const params = [];
  if (weekStart) { params.push(weekStart); query += ` AND p.week_start = $${params.length}`; }
  if (month) { params.push(month); query += ` AND p.month = $${params.length}`; }
  if (year) { params.push(year); query += ` AND p.year = $${params.length}`; }
  if (status) { params.push(status); query += ` AND p.status = $${params.length}`; }
  if (dateFrom) { params.push(dateFrom); query += ` AND p.week_start >= $${params.length}::date`; }
  if (dateTo) { params.push(dateTo); query += ` AND p.week_start <= $${params.length}::date`; }

  const dataParams = [...params, limit, offset];
  query += ` ORDER BY e.name LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`;
  const result = await pool.query(query, dataParams);
  return result.rows;
};

const getEmployeeForPayroll = async (employeeId, supportsWeekendDays) => {
  const emp = supportsWeekendDays
    ? await pool.query('SELECT id, salary, weekend_days, hire_date, termination_date, status FROM employees WHERE id = $1', [employeeId])
    : await pool.query('SELECT id, salary, hire_date, termination_date, status FROM employees WHERE id = $1', [employeeId]);
  return emp.rows[0] || null;
};

const getActiveEmployeesForPayroll = async (supportsWeekendDays) => {
  const query = supportsWeekendDays
    ? 'SELECT id, salary, weekend_days, hire_date, termination_date, status FROM employees WHERE COALESCE(status, \'active\') = \'active\' ORDER BY id'
    : 'SELECT id, salary, hire_date, termination_date, status FROM employees WHERE COALESCE(status, \'active\') = \'active\' ORDER BY id';
  const result = await pool.query(query);
  return result.rows;
};

const getApprovedLeavesForPayroll = async (employeeId, startDate, endDate) => {
  if (!employeeId || !startDate || !endDate) return [];
  const result = await pool.query(
    `SELECT leave_type, start_date::text AS start_date, end_date::text AS end_date
     FROM hr_leave_requests
     WHERE employee_id = $1
       AND status = 'approved'
       AND end_date >= $2::date
       AND start_date <= $3::date`,
    [employeeId, startDate, endDate]
  );
  return result.rows;
};

const getAttendanceForPayroll = async (employeeId, weekStart, weekEnd, effectiveMonth, effectiveYear) => {
  if (weekStart) {
    const result = await pool.query(
      `SELECT
         date::text AS date,
         COALESCE(late_minutes, 0)::int AS late_minutes,
         COALESCE(early_leave_minutes, 0)::int AS early_leave_minutes,
         COALESCE(overtime_minutes, 0)::int AS overtime_minutes,
         CASE WHEN status='absent' THEN 1 ELSE 0 END AS absent_days,
         CASE WHEN status='half-day' THEN 1 ELSE 0 END AS half_days
       FROM attendance
       WHERE employee_id = $1
         AND date >= $2::date
         AND date <= $3::date
       ORDER BY date ASC`,
      [employeeId, weekStart, weekEnd]
    );
    return result.rows;
  }
  
  const result = await pool.query(
    `SELECT
       date::text AS date,
       COALESCE(late_minutes, 0)::int AS late_minutes,
       COALESCE(early_leave_minutes, 0)::int AS early_leave_minutes,
       COALESCE(overtime_minutes, 0)::int AS overtime_minutes,
       CASE WHEN status='absent' THEN 1 ELSE 0 END AS absent_days,
       CASE WHEN status='half-day' THEN 1 ELSE 0 END AS half_days
     FROM attendance
     WHERE employee_id = $1
       AND EXTRACT(MONTH FROM date) = $2
       AND EXTRACT(YEAR FROM date) = $3
     ORDER BY date ASC`,
    [employeeId, effectiveMonth, effectiveYear]
  );
  return result.rows;
};

const upsertPayroll = async (data) => {
  const {
    employee_id, effectiveMonth, effectiveYear, weekStart, weekEnd, base_salary,
    finalBonus, finalDeductions, net_salary,
    loan_deduction = 0, manual_bonus = 0, manual_deductions = 0,
    auto_bonus = 0, auto_deductions = 0,
    hr_bonus = 0, hr_penalty = 0, hr_overtime = 0
  } = data;

  if (weekStart) {
    const existing = await pool.query(
      'SELECT id FROM payroll WHERE employee_id = $1 AND week_start = $2',
      [employee_id, weekStart]
    );
    if (existing.rows.length > 0) {
      const result = await pool.query(
        `UPDATE payroll SET 
          week_end = $1, month = $2, year = $3, bonus = $4, deductions = $5, net_salary = $6,
          loan_deduction = $7, manual_bonus = $8, manual_deductions = $9,
          auto_bonus = $10, auto_deductions = $11,
          hr_bonus = $12, hr_penalty = $13, hr_overtime = $14
         WHERE id = $15 RETURNING *`,
        [
          weekEnd, effectiveMonth, effectiveYear, finalBonus, finalDeductions, net_salary,
          loan_deduction, manual_bonus, manual_deductions,
          auto_bonus, auto_deductions,
          hr_bonus, hr_penalty, hr_overtime,
          existing.rows[0].id
        ]
      );
      return result.rows[0];
    } else {
      const result = await pool.query(
        `INSERT INTO payroll (
          employee_id, month, year, week_start, week_end, base_salary, bonus, deductions, net_salary,
          loan_deduction, manual_bonus, manual_deductions,
          auto_bonus, auto_deductions,
          hr_bonus, hr_penalty, hr_overtime
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
        [
          employee_id, effectiveMonth, effectiveYear, weekStart, weekEnd, base_salary, finalBonus, finalDeductions, net_salary,
          loan_deduction, manual_bonus, manual_deductions,
          auto_bonus, auto_deductions,
          hr_bonus, hr_penalty, hr_overtime
        ]
      );
      return result.rows[0];
    }
  }
  
  const existing = await pool.query(
    'SELECT id FROM payroll WHERE employee_id = $1 AND month = $2 AND year = $3 AND week_start IS NULL',
    [employee_id, effectiveMonth, effectiveYear]
  );
  if (existing.rows.length > 0) {
    const result = await pool.query(
      `UPDATE payroll SET 
        bonus=$1, deductions=$2, net_salary=$3,
        loan_deduction = $4, manual_bonus = $5, manual_deductions = $6,
        auto_bonus = $7, auto_deductions = $8,
        hr_bonus = $9, hr_penalty = $10, hr_overtime = $11
       WHERE id=$12 RETURNING *`,
      [
        finalBonus, finalDeductions, net_salary,
        loan_deduction, manual_bonus, manual_deductions,
        auto_bonus, auto_deductions,
        hr_bonus, hr_penalty, hr_overtime,
        existing.rows[0].id
      ]
    );
    return result.rows[0];
  } else {
    const result = await pool.query(
      `INSERT INTO payroll (
        employee_id, month, year, base_salary, bonus, deductions, net_salary,
        loan_deduction, manual_bonus, manual_deductions,
        auto_bonus, auto_deductions,
        hr_bonus, hr_penalty, hr_overtime
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [
        employee_id, effectiveMonth, effectiveYear, base_salary, finalBonus, finalDeductions, net_salary,
        loan_deduction, manual_bonus, manual_deductions,
        auto_bonus, auto_deductions,
        hr_bonus, hr_penalty, hr_overtime
      ]
    );
    return result.rows[0];
  }
};

const updatePayrollPaid = async (id) => {
  const result = await pool.query(
    `UPDATE payroll SET status='paid', paid_at=NOW() WHERE id=$1 RETURNING *`,
    [id]
  );
  return result.rows[0] || null;
};

const getPayrollById = async (id) => {
  const result = await pool.query(
    'SELECT p.*, p.week_start::text AS week_start, p.week_end::text AS week_end FROM payroll p WHERE p.id = $1',
    [id]
  );
  return result.rows[0] || null;
};

const updateManualAdjustments = async (id, {
  manualBonus,
  manualDeductions,
  autoBonus = null,
  autoDeductions = null,
  finalBonus,
  finalDeductions,
  netSalary,
}) => {
  const result = await pool.query(
    `UPDATE payroll SET
       manual_bonus = $2,
       manual_deductions = $3,
       auto_bonus = COALESCE($4, auto_bonus),
       auto_deductions = COALESCE($5, auto_deductions),
       bonus = $6,
       deductions = $7,
       net_salary = $8
     WHERE id = $1
     RETURNING *`,
    [id, manualBonus, manualDeductions, autoBonus, autoDeductions, finalBonus, finalDeductions, netSalary]
  );
  return result.rows[0] || null;
};

const getActiveLoansForPayroll = async (employeeId) => {
  const result = await pool.query(
    `SELECT id, remaining_amount, monthly_installment
     FROM hr_loans
     WHERE employee_id = $1
       AND status = 'active'
       AND remaining_amount > 0
     ORDER BY created_at ASC`,
    [employeeId]
  );

  return result.rows.map((loan) => ({
    id: loan.id,
    remaining_amount: Number(loan.remaining_amount || 0),
    monthly_installment: Number(loan.monthly_installment || 0),
  }));
};

const getPayrollIdByWeek = async (employeeId, weekStart) => {
  if (!employeeId || !weekStart) return null;
  const result = await pool.query(
    'SELECT id FROM payroll WHERE employee_id = $1 AND week_start = $2',
    [employeeId, weekStart]
  );
  return result.rows[0]?.id || null;
};

const getLoanDeductionsForPayroll = async (payrollId) => {
  if (!payrollId) return [];
  const result = await pool.query(
    'SELECT loan_id, amount FROM payroll_loan_deductions WHERE payroll_id = $1',
    [payrollId]
  );
  return result.rows.map((r) => ({ loan_id: Number(r.loan_id), amount: Number(r.amount || 0) }));
};

/**
 * Apply loan installments for a payroll record idempotently. The ledger's
 * UNIQUE(payroll_id, loan_id) constraint guarantees a loan is only ever debited
 * once per payroll record — a conflicting insert means it was already applied,
 * so the balance is left untouched.
 */
const applyLoanDeductions = async (payrollId, payments) => {
  if (!payrollId || !payments || !payments.length) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const payment of payments) {
      const inserted = await client.query(
        `INSERT INTO payroll_loan_deductions (payroll_id, loan_id, amount)
         VALUES ($1, $2, $3)
         ON CONFLICT (payroll_id, loan_id) DO NOTHING`,
        [payrollId, payment.id, payment.amount]
      );
      if (inserted.rowCount > 0) {
        await client.query(
          `UPDATE hr_loans
           SET remaining_amount = GREATEST(remaining_amount - $1, 0),
               status = CASE WHEN GREATEST(remaining_amount - $1, 0) = 0 THEN 'closed' ELSE status END,
               updated_at = NOW()
           WHERE id = $2`,
          [payment.amount, payment.id]
        );
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Reverse the exact loan amounts recorded in the ledger for each payroll record
 * and delete the records — atomically. Ledger rows cascade-delete with the
 * payroll rows. A reversed loan that had been closed is reopened to 'active'.
 */
const reverseLoanDeductionsAndDeleteRecords = async (payrollIds) => {
  if (!payrollIds || !payrollIds.length) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const payrollId of payrollIds) {
      const ledger = await client.query(
        'SELECT loan_id, amount FROM payroll_loan_deductions WHERE payroll_id = $1',
        [payrollId]
      );
      for (const row of ledger.rows) {
        await client.query(
          `UPDATE hr_loans
           SET remaining_amount = LEAST(remaining_amount + $1, principal_amount),
               status = CASE WHEN LEAST(remaining_amount + $1, principal_amount) > 0 THEN 'active' ELSE status END,
               updated_at = NOW()
           WHERE id = $2`,
          [Number(row.amount || 0), row.loan_id]
        );
      }
      await client.query('DELETE FROM payroll WHERE id = $1', [payrollId]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const getHrDataForWeeklyPayroll = async (employeeId, weekStart, weekEnd) => {
  const transactions = await pool.query(
    `SELECT transaction_type, SUM(amount) as total_amount
     FROM hr_transactions 
     WHERE employee_id = $1 
       AND transaction_date >= $2
       AND transaction_date <= $3
     GROUP BY transaction_type`,
    [employeeId, weekStart, weekEnd]
  );
  
  const loans = await getActiveLoansForPayroll(employeeId);

  return {
    transactions: transactions.rows,
    loans,
  };
};

const getPayrollRecordsForWeek = async (weekStart) => {
  const result = await pool.query(
    'SELECT p.*, p.week_start::text AS week_start, p.week_end::text AS week_end FROM payroll p WHERE p.week_start = $1',
    [weekStart]
  );
  return result.rows;
};

const deletePayrollRecord = async (id) => {
  await pool.query('DELETE FROM payroll WHERE id = $1', [id]);
};

module.exports = {
  hasWeekendDaysColumn,
  getPayrollRecordsCount,
  getPayrollRecords,
  getEmployeeForPayroll,
  getActiveEmployeesForPayroll,
  getApprovedLeavesForPayroll,
  getAttendanceForPayroll,
  getActiveLoansForPayroll,
  getPayrollIdByWeek,
  getLoanDeductionsForPayroll,
  applyLoanDeductions,
  reverseLoanDeductionsAndDeleteRecords,
  getHrDataForWeeklyPayroll,
  upsertPayroll,
  updatePayrollPaid,
  getPayrollById,
  updateManualAdjustments,
  getPayrollRecordsForWeek,
  deletePayrollRecord,
};
