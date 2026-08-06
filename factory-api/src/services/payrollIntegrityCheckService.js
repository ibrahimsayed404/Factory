const pool = require('../db/pool');
const payrollRepository = require('../repositories/payrollRepository');
const { computeLivePayrollFigures } = require('./payrollService');
const { getAttendancePayrollPolicy } = require('../utils/policySettings');

const round2 = (n) => Number(Number(n || 0).toFixed(2));

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

/**
 * Daily Standing Health Check — Reconciles stored payroll net_salary against
 * live computeLivePayrollFigures() across all historical weeks.
 * Any detected mismatch is logged into payroll_integrity_alerts table.
 */
const runPayrollIntegrityCheck = async (client = pool) => {
  const policy = await getPayrollPolicy();
  const supportsWeekendDays = await payrollRepository.hasWeekendDaysColumn();

  const weeksRes = await client.query(`
    SELECT DISTINCT week_start
    FROM payroll
    WHERE week_start IS NOT NULL
    ORDER BY week_start ASC
  `);

  const weeks = weeksRes.rows.map((r) => r.week_start);
  let totalAudited = 0;
  let newAlertsCount = 0;
  const detectedAlerts = [];

  for (const weekStart of weeks) {
    const rowsRes = await client.query(`
      SELECT p.*, e.name AS employee_name
      FROM payroll p
      JOIN employees e ON p.employee_id = e.id
      WHERE p.week_start = $1::date
      ORDER BY p.employee_id ASC
    `, [weekStart]);

    for (const row of rowsRes.rows) {
      totalAudited += 1;
      const employee = await payrollRepository.getEmployeeForPayroll(row.employee_id, supportsWeekendDays);
      const computed = await computeLivePayrollFigures(row, employee, policy);

      const storedNet = round2(row.net_salary);
      const recomputedNet = round2(computed.recomputedNet);
      const diff = round2(recomputedNet - storedNet);

      if (Math.abs(diff) >= 0.01) {
        // Insert alert into payroll_integrity_alerts if not already logged as unresolved
        const existingAlert = await client.query(`
          SELECT id FROM payroll_integrity_alerts
          WHERE payroll_id = $1 AND stored_net = $2 AND recomputed_net = $3 AND status = 'unresolved'
        `, [row.id, storedNet, recomputedNet]);

        if (existingAlert.rows.length === 0) {
          const alertRes = await client.query(`
            INSERT INTO payroll_integrity_alerts (
              week_start, payroll_id, employee_id, employee_name, stored_net, recomputed_net, difference, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
          `, [
            weekStart,
            row.id,
            row.employee_id,
            row.employee_name,
            storedNet,
            recomputedNet,
            diff,
            row.notes || 'Automated reconciliation drift alert'
          ]);
          newAlertsCount += 1;
          detectedAlerts.push(alertRes.rows[0]);
        }
      }
    }
  }

  return {
    auditedWeeks: weeks.length,
    totalAudited,
    newAlertsCount,
    detectedAlerts
  };
};

module.exports = {
  runPayrollIntegrityCheck
};
