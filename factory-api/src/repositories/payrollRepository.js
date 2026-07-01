const pool = require('../db/pool');

let hasWeekendDaysColumnCache = null;
let weeklyColumnsEnsured = false;

const ensureWeeklyPayrollColumns = async () => {
  if (weeklyColumnsEnsured) return;
  await pool.query(`
    ALTER TABLE payroll
      ADD COLUMN IF NOT EXISTS week_start DATE,
      ADD COLUMN IF NOT EXISTS week_end DATE
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'payroll_employee_id_week_start_key'
      ) THEN
        ALTER TABLE payroll
          ADD CONSTRAINT payroll_employee_id_week_start_key UNIQUE (employee_id, week_start);
      END IF;
    END $$;
  `);
  weeklyColumnsEnsured = true;
};

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

const getPayrollRecordsCount = async ({ weekStart, month, year, status }) => {
  let countQuery = 'SELECT COUNT(*) FROM payroll p WHERE 1=1';
  const countParams = [];
  if (weekStart) { countParams.push(weekStart); countQuery += ` AND p.week_start = $${countParams.length}`; }
  if (month) { countParams.push(month); countQuery += ` AND p.month = $${countParams.length}`; }
  if (year) { countParams.push(year); countQuery += ` AND p.year = $${countParams.length}`; }
  if (status) { countParams.push(status); countQuery += ` AND p.status = $${countParams.length}`; }
  const countResult = await pool.query(countQuery, countParams);
  return Number.parseInt(countResult.rows[0].count, 10);
};

const getPayrollRecords = async ({ weekStart, month, year, status, limit, offset, weekendDaysExpr }) => {
  let query = `
    SELECT p.*, e.name AS employee_name, e.role,
      COALESCE(att.late_minutes, 0)::int AS late_minutes,
      COALESCE(att.early_leave_minutes, 0)::int AS early_leave_minutes,
      COALESCE(att.overtime_minutes, 0)::int AS overtime_minutes,
      COALESCE(att.weekend_overtime_minutes, 0)::int AS weekend_overtime_minutes,
      COALESCE(att.absent_days, 0)::int AS absent_days,
      COALESCE(att.half_days, 0)::int AS half_days
    FROM payroll p
    JOIN employees e ON p.employee_id = e.id
    LEFT JOIN LATERAL (
      SELECT
        SUM(a.late_minutes)::int AS late_minutes,
        SUM(a.early_leave_minutes)::int AS early_leave_minutes,
        SUM(a.overtime_minutes)::int AS overtime_minutes,
        SUM(CASE WHEN EXTRACT(DOW FROM a.date)::int = ANY(string_to_array(${weekendDaysExpr}, ',')::int[]) THEN a.overtime_minutes ELSE 0 END)::int AS weekend_overtime_minutes,
        SUM(CASE WHEN a.status='absent' THEN 1 ELSE 0 END)::int AS absent_days,
        SUM(CASE WHEN a.status='half-day' THEN 1 ELSE 0 END)::int AS half_days
      FROM attendance a
      WHERE a.employee_id = p.employee_id
        AND (
          (p.week_start IS NOT NULL AND a.date >= p.week_start AND a.date <= COALESCE(p.week_end, p.week_start))
          OR
          (p.week_start IS NULL AND EXTRACT(MONTH FROM a.date) = p.month AND EXTRACT(YEAR FROM a.date) = p.year)
        )
    ) att ON true
    WHERE 1=1
  `;
  const params = [];
  if (weekStart) { params.push(weekStart); query += ` AND p.week_start = $${params.length}`; }
  if (month) { params.push(month); query += ` AND p.month = $${params.length}`; }
  if (year) { params.push(year); query += ` AND p.year = $${params.length}`; }
  if (status) { params.push(status); query += ` AND p.status = $${params.length}`; }
  
  const dataParams = [...params, limit, offset];
  query += ` ORDER BY e.name LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`;
  const result = await pool.query(query, dataParams);
  return result.rows;
};

const getEmployeeForPayroll = async (employeeId, supportsWeekendDays) => {
  const emp = supportsWeekendDays
    ? await pool.query('SELECT salary, weekend_days FROM employees WHERE id = $1', [employeeId])
    : await pool.query('SELECT salary FROM employees WHERE id = $1', [employeeId]);
  return emp.rows[0] || null;
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
  const { employee_id, effectiveMonth, effectiveYear, weekStart, weekEnd, base_salary, finalBonus, finalDeductions, net_salary } = data;
  if (weekStart) {
    const existing = await pool.query(
      'SELECT id FROM payroll WHERE employee_id = $1 AND week_start = $2',
      [employee_id, weekStart]
    );
    if (existing.rows.length > 0) {
      const result = await pool.query(
        `UPDATE payroll SET week_end = $1, month = $2, year = $3, bonus = $4, deductions = $5, net_salary = $6 WHERE id = $7 RETURNING *`,
        [weekEnd, effectiveMonth, effectiveYear, finalBonus, finalDeductions, net_salary, existing.rows[0].id]
      );
      return result.rows[0];
    } else {
      const result = await pool.query(
        `INSERT INTO payroll (employee_id, month, year, week_start, week_end, base_salary, bonus, deductions, net_salary)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [employee_id, effectiveMonth, effectiveYear, weekStart, weekEnd, base_salary, finalBonus, finalDeductions, net_salary]
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
      `UPDATE payroll SET bonus=$1, deductions=$2, net_salary=$3 WHERE id=$4 RETURNING *`,
      [finalBonus, finalDeductions, net_salary, existing.rows[0].id]
    );
    return result.rows[0];
  } else {
    const result = await pool.query(
      `INSERT INTO payroll (employee_id, month, year, base_salary, bonus, deductions, net_salary)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [employee_id, effectiveMonth, effectiveYear, base_salary, finalBonus, finalDeductions, net_salary]
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

const getHrDataForPayroll = async (employeeId, month, year) => {
  // Get transactions for the month
  const transactions = await pool.query(
    `SELECT transaction_type, SUM(amount) as total_amount
     FROM hr_transactions 
     WHERE employee_id = $1 
       AND EXTRACT(MONTH FROM transaction_date) = $2 
       AND EXTRACT(YEAR FROM transaction_date) = $3
     GROUP BY transaction_type`,
    [employeeId, month, year]
  );
  
  // Get active loans
  const loans = await pool.query(
    `SELECT SUM(monthly_installment) as total_installments
     FROM hr_loans
     WHERE employee_id = $1 AND status = 'active'`,
    [employeeId]
  );

  return {
    transactions: transactions.rows,
    loanDeduction: Number(loans.rows[0]?.total_installments || 0)
  };
};

module.exports = {
  ensureWeeklyPayrollColumns,
  hasWeekendDaysColumn,
  getPayrollRecordsCount,
  getPayrollRecords,
  getEmployeeForPayroll,
  getAttendanceForPayroll,
  getHrDataForPayroll,
  upsertPayroll,
  updatePayrollPaid,
};
