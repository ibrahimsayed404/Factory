const pool = require('../../config/db');

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

const round2 = (n) => Number(Number(n || 0).toFixed(2));

const weekendSetFrom = (weekendDays) => {
  const raw = String(weekendDays || process.env.PAYROLL_WEEKEND_DAYS || '0,6');
  return new Set(
    raw
      .split(',')
      .map((x) => Number(String(x).trim()))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
  );
};

const inferredAbsentDaysBetweenRecords = (records, weekendSet) => {
  if (!records.length) return 0;

  const sorted = [...records].sort((a, b) => new Date(a.date) - new Date(b.date));
  const start = new Date(`${sorted[0].date}T00:00:00Z`);
  const end = new Date(`${sorted[sorted.length - 1].date}T00:00:00Z`);
  const recorded = new Set(sorted.map((r) => String(r.date)));

  let inferred = 0;
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    const day = d.getUTCDay();
    if (weekendSet.has(day)) continue;
    if (!recorded.has(key)) inferred += 1;
  }
  return inferred;
};

const isWeekendAttendanceDate = (dateValue, weekendSet) => {
  const match = String(dateValue || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const day = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay();
  return weekendSet.has(day);
};

const getPayrollPolicy = () => ({
  workHoursPerDay: Number(process.env.PAYROLL_WORK_HOURS_PER_DAY || 8),
  workingDaysPerMonth: Number(process.env.PAYROLL_WORKING_DAYS_PER_MONTH || 30),
  overtimeMultiplier: Number(process.env.PAYROLL_OVERTIME_MULTIPLIER || 1.25),
});

// GET /api/payroll — list payroll records (filter by month/year)
const getAll = async (req, res, next) => {
  try {
    const { month, year, status } = req.query;
    const supportsWeekendDays = await hasWeekendDaysColumn();
    const weekendDaysExpr = supportsWeekendDays ? "COALESCE(e.weekend_days, '0,6')" : "'0,6'";
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
          AND EXTRACT(MONTH FROM a.date) = p.month
          AND EXTRACT(YEAR FROM a.date) = p.year
      ) att ON true
      WHERE 1=1
    `;
    const params = [];
    if (month) { params.push(month); query += ` AND p.month = $${params.length}`; }
    if (year) { params.push(year); query += ` AND p.year = $${params.length}`; }
    if (status) { params.push(status); query += ` AND p.status = $${params.length}`; }
    query += ' ORDER BY e.name';
    const result = await pool.query(query, params);

    const policy = getPayrollPolicy();
    const enriched = result.rows.map((row) => {
      const baseSalary = Number(row.base_salary || 0);
      const dailyRate = baseSalary / policy.workingDaysPerMonth;
      const minuteRate = dailyRate / (policy.workHoursPerDay * 60);

      const autoDeductions =
        ((Number(row.late_minutes) + Number(row.early_leave_minutes)) * minuteRate) +
        (Number(row.absent_days) * dailyRate) +
        (Number(row.half_days) * (dailyRate / 2));
      const autoBonus = Number(row.overtime_minutes) * minuteRate * policy.overtimeMultiplier;
      const weekendOvertimeMinutes = Number(row.weekend_overtime_minutes || 0);
      const regularOvertimeMinutes = Math.max(0, Number(row.overtime_minutes || 0) - weekendOvertimeMinutes);

      const finalBonus = Number(row.bonus || 0);
      const finalDeductions = Number(row.deductions || 0);

      return {
        ...row,
        payroll_breakdown: {
          manual_bonus: round2(finalBonus - autoBonus),
          manual_deductions: round2(finalDeductions - autoDeductions),
          auto_bonus: round2(autoBonus),
          auto_deductions: round2(autoDeductions),
          late_minutes: Number(row.late_minutes),
          early_leave_minutes: Number(row.early_leave_minutes),
          overtime_minutes: Number(row.overtime_minutes),
          regular_overtime_minutes: regularOvertimeMinutes,
          weekend_overtime_minutes: weekendOvertimeMinutes,
          absent_days: Number(row.absent_days),
          half_days: Number(row.half_days),
        },
      };
    });

    res.json(enriched);
  } catch (err) { next(err); }
};

// POST /api/payroll — generate payroll for an employee/month
const create = async (req, res, next) => {
  try {
    const { employee_id, month, year, bonus = 0, deductions = 0 } = req.body;
    const manualBonus = Number(bonus || 0);
    const manualDeductions = Number(deductions || 0);

    const supportsWeekendDays = await hasWeekendDaysColumn();
    const emp = supportsWeekendDays
      ? await pool.query('SELECT salary, weekend_days FROM employees WHERE id = $1', [employee_id])
      : await pool.query('SELECT salary FROM employees WHERE id = $1', [employee_id]);
    if (!emp.rows.length) return res.status(404).json({ error: 'Employee not found' });

    const base_salary = Number(emp.rows[0].salary || 0);
    const policy = getPayrollPolicy();
    const dailyRate = base_salary / policy.workingDaysPerMonth;
    const minuteRate = dailyRate / (policy.workHoursPerDay * 60);
    const weekendSet = weekendSetFrom(emp.rows[0].weekend_days);

    const attendance = await pool.query(
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
      [employee_id, month, year]
    );

    const totals = attendance.rows.reduce((acc, row) => ({
      late_minutes: acc.late_minutes + Number(row.late_minutes || 0),
      early_leave_minutes: acc.early_leave_minutes + Number(row.early_leave_minutes || 0),
      overtime_minutes: acc.overtime_minutes + Number(row.overtime_minutes || 0),
      weekend_overtime_minutes: acc.weekend_overtime_minutes + (isWeekendAttendanceDate(row.date, weekendSet) ? Number(row.overtime_minutes || 0) : 0),
      absent_days: acc.absent_days + Number(row.absent_days || 0),
      half_days: acc.half_days + Number(row.half_days || 0),
    }), {
      late_minutes: 0,
      early_leave_minutes: 0,
      overtime_minutes: 0,
      weekend_overtime_minutes: 0,
      absent_days: 0,
      half_days: 0,
    });

    const inferredAbsentDays = inferredAbsentDaysBetweenRecords(attendance.rows, weekendSet);

    const lateAndEarlyMinutes = totals.late_minutes + totals.early_leave_minutes;
    const overtimeMinutes = totals.overtime_minutes;
    const weekendOvertimeMinutes = totals.weekend_overtime_minutes;
    const regularOvertimeMinutes = Math.max(0, overtimeMinutes - weekendOvertimeMinutes);
    const absentDays = totals.absent_days + inferredAbsentDays;
    const halfDays = totals.half_days;

    const autoDeductions =
      (lateAndEarlyMinutes * minuteRate) +
      (absentDays * dailyRate) +
      (halfDays * (dailyRate / 2));
    const autoBonus = overtimeMinutes * minuteRate * policy.overtimeMultiplier;

    const finalBonus = round2(autoBonus + manualBonus);
    const finalDeductions = round2(autoDeductions + manualDeductions);
    const net_salary = round2(base_salary + finalBonus - finalDeductions);

    const result = await pool.query(
      `INSERT INTO payroll (employee_id, month, year, base_salary, bonus, deductions, net_salary)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (employee_id, month, year) DO UPDATE
       SET bonus=$5, deductions=$6, net_salary=$7
       RETURNING *`,
      [employee_id, month, year, base_salary, finalBonus, finalDeductions, net_salary]
    );
    res.status(201).json({
      ...result.rows[0],
      payroll_breakdown: {
        manual_bonus: round2(manualBonus),
        manual_deductions: round2(manualDeductions),
        auto_bonus: round2(autoBonus),
        auto_deductions: round2(autoDeductions),
        late_minutes: Number(totals.late_minutes),
        early_leave_minutes: Number(totals.early_leave_minutes),
        overtime_minutes: Number(totals.overtime_minutes),
        regular_overtime_minutes: regularOvertimeMinutes,
        weekend_overtime_minutes: weekendOvertimeMinutes,
        absent_days: absentDays,
        inferred_absent_days: inferredAbsentDays,
        half_days: halfDays,
      },
    });
  } catch (err) { next(err); }
};

// PUT /api/payroll/:id/pay — mark as paid
const markPaid = async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE payroll SET status='paid', paid_at=NOW() WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Record not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

module.exports = { getAll, create, markPaid };
