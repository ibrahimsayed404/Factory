const pool = require('../db/pool');

const DEFAULTS = {
  attendanceLateGraceMinutes: Number(process.env.ATTENDANCE_LATE_GRACE_MINUTES || 10),
  attendanceOvertimeGraceMinutes: Number(process.env.ATTENDANCE_OVERTIME_GRACE_MINUTES || 15),
  payrollOvertimeMultiplier: Number(process.env.PAYROLL_OVERTIME_MULTIPLIER || 1.5),
  payrollVacationOvertimeMultiplier: Number(process.env.PAYROLL_VACATION_OVERTIME_MULTIPLIER || 1),
  payrollWeeksPerMonth: Number(process.env.PAYROLL_WEEKS_PER_MONTH || 4),
};

const KEY_MAP = {
  attendance_late_grace_minutes: 'attendanceLateGraceMinutes',
  attendance_overtime_grace_minutes: 'attendanceOvertimeGraceMinutes',
  payroll_overtime_multiplier: 'payrollOvertimeMultiplier',
  payroll_vacation_overtime_multiplier: 'payrollVacationOvertimeMultiplier',
  payroll_weeks_per_month: 'payrollWeeksPerMonth',
};

let schemaEnsured = false;

const db = (client) => client || pool;

const ensureSettingsTable = async (client = null) => {
  if (schemaEnsured) return;

  await db(client).query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key VARCHAR(120) PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  schemaEnsured = true;
};

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getAttendancePayrollPolicy = async (client = null) => {
  await ensureSettingsTable(client);

  const rows = await db(client).query(
    `SELECT key, value
     FROM app_settings
     WHERE key = ANY($1::text[])`,
    [Object.keys(KEY_MAP)]
  );

  const policy = { ...DEFAULTS };

  for (const row of rows.rows) {
    const targetKey = KEY_MAP[row.key];
    if (!targetKey) continue;
    policy[targetKey] = toNumber(row.value, policy[targetKey]);
  }

  return policy;
};

const updateAttendancePayrollPolicy = async (updates, client = null) => {
  await ensureSettingsTable(client);

  const entries = [
    ['attendance_late_grace_minutes', updates.attendanceLateGraceMinutes],
    ['attendance_overtime_grace_minutes', updates.attendanceOvertimeGraceMinutes],
    ['payroll_overtime_multiplier', updates.payrollOvertimeMultiplier],
    ['payroll_vacation_overtime_multiplier', updates.payrollVacationOvertimeMultiplier],
    ['payroll_weeks_per_month', updates.payrollWeeksPerMonth],
  ].filter(([, value]) => value !== undefined && value !== null);

  for (const [key, value] of entries) {
    await db(client).query(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, String(value)]
    );
  }

  if (updates.attendanceLateGraceMinutes !== undefined) {
    process.env.ATTENDANCE_LATE_GRACE_MINUTES = String(updates.attendanceLateGraceMinutes);
  }
  if (updates.attendanceOvertimeGraceMinutes !== undefined) {
    process.env.ATTENDANCE_OVERTIME_GRACE_MINUTES = String(updates.attendanceOvertimeGraceMinutes);
  }
  if (updates.payrollOvertimeMultiplier !== undefined) {
    process.env.PAYROLL_OVERTIME_MULTIPLIER = String(updates.payrollOvertimeMultiplier);
  }
  if (updates.payrollVacationOvertimeMultiplier !== undefined) {
    process.env.PAYROLL_VACATION_OVERTIME_MULTIPLIER = String(updates.payrollVacationOvertimeMultiplier);
  }
  if (updates.payrollWeeksPerMonth !== undefined) {
    process.env.PAYROLL_WEEKS_PER_MONTH = String(updates.payrollWeeksPerMonth);
  }

  return getAttendancePayrollPolicy(client);
};

module.exports = {
  getAttendancePayrollPolicy,
  updateAttendancePayrollPolicy,
};
