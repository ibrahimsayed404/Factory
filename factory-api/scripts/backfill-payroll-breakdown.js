/**
 * Backfill payroll.auto_bonus / auto_deductions (and related) from attendance,
 * for rows that still have the post-migration DEFAULT 0 values.
 */
require('dotenv').config();
const pool = require('../src/db/pool');
const { getAttendancePayrollPolicy } = require('../src/utils/policySettings');

const round2 = (n) => Number(Number(n || 0).toFixed(2));

const weightedLateMinutes = (lateMinutes) => {
  const total = Math.max(0, Number(lateMinutes || 0));
  if (total <= 10) return total;
  return total * 1.5;
};

const weekendSetFrom = (weekendDays) => {
  const raw = String(weekendDays || process.env.PAYROLL_WEEKEND_DAYS || '5');
  return new Set(
    raw
      .split(',')
      .map((x) => Number(String(x).trim()))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
  );
};

const getWeeklyWorkDays = (weekendSet) => {
  const weekDays = 7 - weekendSet.size;
  return weekDays > 0 ? weekDays : 5;
};

(async () => {
  const settings = await getAttendancePayrollPolicy();
  const policy = {
    workHoursPerDay: Number(process.env.PAYROLL_WORK_HOURS_PER_DAY || 8),
    workingDaysPerMonth: Number(process.env.PAYROLL_WORKING_DAYS_PER_MONTH || 30),
    overtimeMultiplier: Number(settings.payrollOvertimeMultiplier || 1.5),
    vacationOvertimeMultiplier: Number(settings.payrollVacationOvertimeMultiplier || 1),
    weeksPerMonth: Number(settings.payrollWeeksPerMonth || 4),
  };

  const hasWeekend = await pool.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'weekend_days'
    ) AS exists
  `);
  const supportsWeekendDays = Boolean(hasWeekend.rows[0]?.exists);
  const weekendDaysExpr = supportsWeekendDays ? "COALESCE(e.weekend_days, '5')" : "'5'";

  const { rows } = await pool.query(`
    SELECT p.id, p.base_salary, p.bonus, p.deductions, p.week_start,
           p.hr_bonus, p.hr_penalty, p.hr_overtime, p.loan_deduction,
           ${supportsWeekendDays ? "COALESCE(e.weekend_days, '5')" : "'5'"} AS weekend_days,
           COALESCE(att.late_minutes, 0)::int AS late_minutes,
           COALESCE(att.early_leave_minutes, 0)::int AS early_leave_minutes,
           COALESCE(att.overtime_minutes, 0)::int AS overtime_minutes,
           COALESCE(att.weekend_overtime_minutes, 0)::int AS weekend_overtime_minutes,
           COALESCE(att.absent_days, 0)::int AS absent_days,
           COALESCE(att.half_days, 0)::int AS half_days
    FROM payroll p
    JOIN employees e ON e.id = p.employee_id
    LEFT JOIN LATERAL (
      SELECT
        SUM(a.late_minutes)::int AS late_minutes,
        SUM(a.early_leave_minutes)::int AS early_leave_minutes,
        SUM(a.overtime_minutes)::int AS overtime_minutes,
        SUM(CASE WHEN EXTRACT(DOW FROM a.date)::int = ANY(string_to_array(${weekendDaysExpr}, ',')::int[])
          THEN a.overtime_minutes ELSE 0 END)::int AS weekend_overtime_minutes,
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
    WHERE COALESCE(p.auto_bonus, 0) = 0 AND COALESCE(p.auto_deductions, 0) = 0
  `);

  let updated = 0;
  for (const row of rows) {
    const baseSalary = Number(row.base_salary || 0);
    const weekendSet = weekendSetFrom(row.weekend_days);
    const useWeeklySalary = Boolean(row.week_start);
    const dailyRate = useWeeklySalary
      ? baseSalary / getWeeklyWorkDays(weekendSet)
      : baseSalary / policy.workingDaysPerMonth;
    const minuteRate = dailyRate / (policy.workHoursPerDay * 60);
    const lateWeighted = weightedLateMinutes(row.late_minutes);
    const weekendOvertimeMinutes = Number(row.weekend_overtime_minutes || 0);
    const regularOvertimeMinutes = Math.max(0, Number(row.overtime_minutes || 0) - weekendOvertimeMinutes);

    const autoDeductions = round2(
      ((lateWeighted + Number(row.early_leave_minutes)) * minuteRate) +
      (Number(row.absent_days) * dailyRate) +
      (Number(row.half_days) * (dailyRate / 2))
    );
    const autoBonus = round2(
      (regularOvertimeMinutes * minuteRate * policy.overtimeMultiplier) +
      (weekendOvertimeMinutes * minuteRate * policy.vacationOvertimeMultiplier)
    );

    const hrBonus = Number(row.hr_bonus || 0);
    const hrPenalty = Number(row.hr_penalty || 0);
    const hrOvertime = Number(row.hr_overtime || 0);
    const loanDeduction = Number(row.loan_deduction || 0);
    const finalBonus = Number(row.bonus || 0);
    const finalDeductions = Number(row.deductions || 0);
    const manualBonus = round2(Math.max(0, finalBonus - autoBonus - hrBonus - hrOvertime));
    const manualDeductions = round2(Math.max(0, finalDeductions - autoDeductions - hrPenalty - loanDeduction));

    if (autoBonus === 0 && autoDeductions === 0 && manualBonus === 0 && manualDeductions === 0) continue;

    await pool.query(
      `UPDATE payroll
       SET auto_bonus = $2, auto_deductions = $3, manual_bonus = $4, manual_deductions = $5
       WHERE id = $1`,
      [row.id, autoBonus, autoDeductions, manualBonus, manualDeductions]
    );
    updated += 1;
  }

  console.log(`Backfilled ${updated} of ${rows.length} payroll rows.`);
  await pool.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
