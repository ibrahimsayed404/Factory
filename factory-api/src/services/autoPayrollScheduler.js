const pool = require('../db/pool');
const payrollService = require('./payrollService');

const AUTO_PAYROLL_SETTING_KEY = 'payroll_last_auto_week_start';
const ONE_HOUR_MS = 60 * 60 * 1000;

const toIsoDate = (date) => date.toISOString().slice(0, 10);

const getCurrentSaturdayIso = () => {
  const now = new Date();
  const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const diffToSaturday = (utc.getUTCDay() - 6 + 7) % 7;
  utc.setUTCDate(utc.getUTCDate() - diffToSaturday);
  return toIsoDate(utc);
};

const isSaturdayUtc = () => new Date().getUTCDay() === 6;



const getLastAutoWeekStart = async () => {
  const result = await pool.query('SELECT value FROM app_settings WHERE key = $1', [AUTO_PAYROLL_SETTING_KEY]);
  return result.rows[0]?.value || null;
};

const setLastAutoWeekStart = async (weekStart) => {
  await pool.query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key)
     DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [AUTO_PAYROLL_SETTING_KEY, weekStart]
  );
};

const runAutoPayrollForCurrentWeek = async () => {
  if (!isSaturdayUtc()) return;

  const weekStart = getCurrentSaturdayIso();
  const lastRunWeek = await getLastAutoWeekStart();
  if (lastRunWeek === weekStart) return;

  const employees = await pool.query(
    "SELECT id FROM employees WHERE COALESCE(status, 'active') = 'active' ORDER BY id"
  );

  for (const employee of employees.rows) {
    try {
      await payrollService.generatePayroll({
        employee_id: employee.id,
        week_start: weekStart
      });
    } catch (err) {
      console.error(`[auto-payroll] Failed for employee ${employee.id}:`, err?.message || err);
    }
  }

  await setLastAutoWeekStart(weekStart);
  console.log(`[auto-payroll] Weekly payroll generated for week starting ${weekStart}.`);
};

const startAutoPayrollScheduler = () => {
  // Run once at startup, then check hourly.
  runAutoPayrollForCurrentWeek().catch((error) => {
    console.error('[auto-payroll] Initial run failed:', error?.message || error);
  });

  setInterval(() => {
    runAutoPayrollForCurrentWeek().catch((error) => {
      console.error('[auto-payroll] Scheduled run failed:', error?.message || error);
    });
  }, ONE_HOUR_MS);
};

module.exports = {
  startAutoPayrollScheduler,
  runAutoPayrollForCurrentWeek,
};
