const pool = require('../../config/db');
const { getAttendancePayrollPolicy } = require('../utils/policySettings');

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

const round2 = (n) => Number(Number(n || 0).toFixed(2));

const weightedLateMinutes = (lateMinutes) => {
  const total = Math.max(0, Number(lateMinutes || 0));
  const firstBand = Math.min(15, total);
  const secondBand = Math.max(0, total - 15);
  return firstBand + (secondBand * 1.5);
};

const normalizeToUtcDate = (value) => {
  const text = String(value || '').slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
};

const toSaturdayUtc = (date) => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const diffToSaturday = (d.getUTCDay() - 6 + 7) % 7;
  d.setUTCDate(d.getUTCDate() - diffToSaturday);
  return d;
};

const currentWeekSaturdayUtc = () => toSaturdayUtc(new Date());

const toIsoDate = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

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
  const end = new Date(`${sorted.at(-1).date}T00:00:00Z`);
  const recorded = new Set(sorted.map((r) => String(r.date)));

  let inferred = 0;
  let cursor = new Date(start);
  while (cursor <= end) {
    const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}-${String(cursor.getUTCDate()).padStart(2, '0')}`;
    const day = cursor.getUTCDay();
    if (!weekendSet.has(day) && !recorded.has(key)) inferred += 1;
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate() + 1));
  }
  return inferred;
};

const isWeekendAttendanceDate = (dateValue, weekendSet) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue || '').slice(0, 10));
  if (!match) return false;
  const day = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay();
  return weekendSet.has(day);
};

const getPayrollPolicy = async () => {
  const settings = await getAttendancePayrollPolicy();
  return {
    workHoursPerDay: Number(process.env.PAYROLL_WORK_HOURS_PER_DAY || 8),
    workingDaysPerMonth: Number(process.env.PAYROLL_WORKING_DAYS_PER_MONTH || 30),
    overtimeMultiplier: Number(settings.payrollOvertimeMultiplier || 1.5),
    vacationOvertimeMultiplier: Number(settings.payrollVacationOvertimeMultiplier || 1),
    weeksPerMonth: Number(settings.payrollWeeksPerMonth || 4),
  };
};

// GET /api/payroll — list payroll records (filter by week_start or month/year)
const getAll = async (req, res, next) => {
  try {
    await ensureWeeklyPayrollColumns();
    const { week_start: weekStartInput, month, year, status, page, limit: limitParam } = req.query;
    const normalizedWeekStartDate = weekStartInput ? normalizeToUtcDate(weekStartInput) : null;
    if (weekStartInput && !normalizedWeekStartDate) {
      return res.status(400).json({ error: 'Invalid week_start date format' });
    }
    const weekStart = normalizedWeekStartDate ? toIsoDate(toSaturdayUtc(normalizedWeekStartDate)) : null;
    const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
    const pageSize = Math.min(1000, Math.max(1, Number.parseInt(limitParam, 10) || 50));
    const offset = (pageNum - 1) * pageSize;
    const supportsWeekendDays = await hasWeekendDaysColumn();
    const weekendDaysExpr = supportsWeekendDays ? "COALESCE(e.weekend_days, '0,6')" : "'0,6'";

    let countQuery = 'SELECT COUNT(*) FROM payroll p WHERE 1=1';
    const countParams = [];
    if (weekStart) { countParams.push(weekStart); countQuery += ` AND p.week_start = $${countParams.length}`; }
    if (month) { countParams.push(month); countQuery += ` AND p.month = $${countParams.length}`; }
    if (year) { countParams.push(year); countQuery += ` AND p.year = $${countParams.length}`; }
    if (status) { countParams.push(status); countQuery += ` AND p.status = $${countParams.length}`; }
    const countResult = await pool.query(countQuery, countParams);
    const total = Number.parseInt(countResult.rows[0].count, 10);

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
    const dataParams = [...params, pageSize, offset];
    query += ` ORDER BY e.name LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`;
    const result = await pool.query(query, dataParams);

    const policy = await getPayrollPolicy();
    const enriched = result.rows.map((row) => {
      const baseSalary = Number(row.base_salary || 0);
      const dailyRate = baseSalary / policy.workingDaysPerMonth;
      const minuteRate = dailyRate / (policy.workHoursPerDay * 60);
      const lateWeighted = weightedLateMinutes(row.late_minutes);

      const autoDeductions =
        ((lateWeighted + Number(row.early_leave_minutes)) * minuteRate) +
        (Number(row.absent_days) * dailyRate) +
        (Number(row.half_days) * (dailyRate / 2));
      const weekendOvertimeMinutes = Number(row.weekend_overtime_minutes || 0);
      const regularOvertimeMinutes = Math.max(0, Number(row.overtime_minutes || 0) - weekendOvertimeMinutes);
      const autoBonus =
        (regularOvertimeMinutes * minuteRate * policy.overtimeMultiplier) +
        (weekendOvertimeMinutes * minuteRate * policy.vacationOvertimeMultiplier);

      const finalBonus = Number(row.bonus || 0);
      const finalDeductions = Number(row.deductions || 0);
      const weeklyPaymentEstimate = Number(row.net_salary || 0) / Math.max(1, policy.weeksPerMonth);

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
          late_weighted_minutes: round2(lateWeighted),
          weekly_payment_estimate: round2(weeklyPaymentEstimate),
        },
      };
    });

    res.json({ data: enriched, total, page: pageNum, limit: pageSize });
  } catch (err) { next(err); }
};

// POST /api/payroll — generate payroll for an employee/week (or legacy month/year)
const create = async (req, res, next) => {
  try {
    await ensureWeeklyPayrollColumns();
    const { employee_id, week_start: weekStartInput, month: monthInput, year: yearInput, bonus = 0, deductions = 0 } = req.body;
    const manualBonus = Number(bonus || 0);
    const manualDeductions = Number(deductions || 0);

    const weekStartDate = weekStartInput ? normalizeToUtcDate(weekStartInput) : null;
    if (weekStartInput && !weekStartDate) {
      return res.status(400).json({ error: 'Invalid week_start date format' });
    }

    let effectiveMonth;
    let effectiveYear;
    let weekStart;
    let weekEnd;

    const hasLegacyMonthYear = monthInput !== undefined && yearInput !== undefined;
    const effectiveWeekStartDate = weekStartDate
      ? toSaturdayUtc(weekStartDate)
      : (!hasLegacyMonthYear ? currentWeekSaturdayUtc() : null);

    if (effectiveWeekStartDate) {
      weekStart = toIsoDate(effectiveWeekStartDate);
      const weekEndDate = new Date(effectiveWeekStartDate);
      weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6);
      weekEnd = toIsoDate(weekEndDate);
      effectiveMonth = effectiveWeekStartDate.getUTCMonth() + 1;
      effectiveYear = effectiveWeekStartDate.getUTCFullYear();
    } else {
      effectiveMonth = Number(monthInput);
      effectiveYear = Number(yearInput);
      weekStart = null;
      weekEnd = null;
    }

    const supportsWeekendDays = await hasWeekendDaysColumn();
    const emp = supportsWeekendDays
      ? await pool.query('SELECT salary, weekend_days FROM employees WHERE id = $1', [employee_id])
      : await pool.query('SELECT salary FROM employees WHERE id = $1', [employee_id]);
    if (!emp.rows.length) return res.status(404).json({ error: 'Employee not found' });

    const base_salary = Number(emp.rows[0].salary || 0);
    const policy = await getPayrollPolicy();
    const dailyRate = base_salary / policy.workingDaysPerMonth;
    const minuteRate = dailyRate / (policy.workHoursPerDay * 60);
    const weekendSet = weekendSetFrom(emp.rows[0].weekend_days);

    const attendance = weekStart
      ? await pool.query(
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
        [employee_id, weekStart, weekEnd]
      )
      : await pool.query(
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
        [employee_id, effectiveMonth, effectiveYear]
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

    const overtimeMinutes = totals.overtime_minutes;
    const weekendOvertimeMinutes = totals.weekend_overtime_minutes;
    const regularOvertimeMinutes = Math.max(0, overtimeMinutes - weekendOvertimeMinutes);
    const absentDays = totals.absent_days + inferredAbsentDays;
    const halfDays = totals.half_days;
    const lateWeighted = weightedLateMinutes(totals.late_minutes);

    const autoDeductions =
      ((lateWeighted + totals.early_leave_minutes) * minuteRate) +
      (absentDays * dailyRate) +
      (halfDays * (dailyRate / 2));
    const autoBonus =
      (regularOvertimeMinutes * minuteRate * policy.overtimeMultiplier) +
      (weekendOvertimeMinutes * minuteRate * policy.vacationOvertimeMultiplier);

    const finalBonus = round2(autoBonus + manualBonus);
    const finalDeductions = round2(autoDeductions + manualDeductions);
    const net_salary = round2(base_salary + finalBonus - finalDeductions);

    const result = weekStart
      ? await pool.query(
        `INSERT INTO payroll (employee_id, month, year, week_start, week_end, base_salary, bonus, deductions, net_salary)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (employee_id, week_start) DO UPDATE
         SET week_end = EXCLUDED.week_end,
             month = EXCLUDED.month,
             year = EXCLUDED.year,
             bonus = EXCLUDED.bonus,
             deductions = EXCLUDED.deductions,
             net_salary = EXCLUDED.net_salary
         RETURNING *`,
        [employee_id, effectiveMonth, effectiveYear, weekStart, weekEnd, base_salary, finalBonus, finalDeductions, net_salary]
      )
      : await pool.query(
        `INSERT INTO payroll (employee_id, month, year, base_salary, bonus, deductions, net_salary)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (employee_id, month, year) DO UPDATE
         SET bonus=$5, deductions=$6, net_salary=$7
         RETURNING *`,
        [employee_id, effectiveMonth, effectiveYear, base_salary, finalBonus, finalDeductions, net_salary]
      );
    res.status(201).json({
      ...result.rows[0],
      payroll_breakdown: {
        manual_bonus: round2(manualBonus),
        manual_deductions: round2(manualDeductions),
        auto_bonus: round2(autoBonus),
        auto_deductions: round2(autoDeductions),
        late_minutes: Number(totals.late_minutes),
        late_weighted_minutes: round2(lateWeighted),
        early_leave_minutes: Number(totals.early_leave_minutes),
        overtime_minutes: Number(totals.overtime_minutes),
        regular_overtime_minutes: regularOvertimeMinutes,
        weekend_overtime_minutes: weekendOvertimeMinutes,
        absent_days: absentDays,
        inferred_absent_days: inferredAbsentDays,
        half_days: halfDays,
        weekly_payment_estimate: round2(net_salary / Math.max(1, policy.weeksPerMonth)),
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
