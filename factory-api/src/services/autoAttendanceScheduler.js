const pool = require('../db/pool');
const {
  resolveShiftWindow,
  calculateHoursWorked,
  calculateShiftMetrics,
  isWeekendDate,
  toMinutes,
} = require('../utils/attendanceMetrics');
const { getAttendancePayrollPolicy } = require('../utils/policySettings');

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

const getCairoDateAndMinutes = (overrideDate = null) => {
  const now = overrideDate ? new Date(overrideDate) : new Date();
  const dateStr = now.toLocaleDateString('sv-SE', { timeZone: 'Africa/Cairo' });
  const timeStr = now.toLocaleTimeString('en-GB', { timeZone: 'Africa/Cairo', hour12: false });
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const currentMinutes = (h * 60) + (Number.isNaN(m) ? 0 : m);
  return { dateStr, timeStr, h, m, currentMinutes };
};

const minutesToTimeString = (totalMinutes) => {
  if (totalMinutes === null || totalMinutes === undefined || Number.isNaN(totalMinutes)) return null;
  const normalized = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const runAutoCheckoutShiftBased = async (overrideDate = null) => {
  const { dateStr, currentMinutes } = getCairoDateAndMinutes(overrideDate);
  const policy = await getAttendancePayrollPolicy();

  const openRows = await pool.query(
    `SELECT 
       a.id, a.employee_id, a.date::text AS date, TO_CHAR(a.check_in, 'HH24:MI') AS check_in, a.notes,
       e.shift, TO_CHAR(e.shift_start, 'HH24:MI') AS shift_start, TO_CHAR(e.shift_end, 'HH24:MI') AS shift_end,
       e.weekend_days,
       TO_CHAR(s.start_time, 'HH24:MI') AS shift_start_time, TO_CHAR(s.end_time, 'HH24:MI') AS shift_end_time
     FROM attendance a
     JOIN employees e ON a.employee_id = e.id
     LEFT JOIN hr_shifts s ON e.shift_id = s.id
     WHERE a.date = $1::date
       AND a.check_in IS NOT NULL
       AND a.check_out IS NULL
       AND COALESCE(a.status, '') != 'absent'`,
    [dateStr]
  );

  let updatedCount = 0;

  for (const row of openRows.rows) {
    const empDetails = {
      shift: row.shift,
      shift_start: row.shift_start || row.shift_start_time,
      shift_end: row.shift_end || row.shift_end_time,
      weekend_days: row.weekend_days,
    };

    const { shiftStart, shiftEnd, overnightShift } = resolveShiftWindow(empDetails);

    if (shiftEnd === null || overnightShift) {
      // Skip incomplete or overnight shifts for default 1h-buffer checkout
      continue;
    }

    const autoCheckoutTriggerMin = shiftEnd + 60;

    if (currentMinutes >= autoCheckoutTriggerMin) {
      const shiftEndStr = minutesToTimeString(shiftEnd);
      const hoursWorked = calculateHoursWorked(row.check_in, shiftEndStr);
      const metrics = calculateShiftMetrics(empDetails, row.check_in, shiftEndStr, {
        lateGraceMinutes: policy.attendanceLateGraceMinutes,
        overtimeGraceMinutes: policy.attendanceOvertimeGraceMinutes,
      });

      const resolvedLateMinutes = metrics.late_minutes || 0;
      const resolvedEarlyLeaveMinutes = metrics.early_leave_minutes || 0;
      const resolvedOvertimeMinutes = metrics.overtime_minutes || 0;
      const resolvedStatus = resolvedLateMinutes > 0 ? 'late' : 'present';

      const existingNotes = row.notes ? String(row.notes).trim() : '';
      const autoNote = `Auto-checked out at shift end (${shiftEndStr})`;
      const combinedNotes = existingNotes
        ? (existingNotes.includes('Auto-checked out') ? existingNotes : `${existingNotes}; ${autoNote}`)
        : autoNote;

      const result = await pool.query(
        `UPDATE attendance
         SET check_out = $1::time,
             hours_worked = $2,
             late_minutes = $3,
             early_leave_minutes = $4,
             overtime_minutes = $5,
             status = $6,
             notes = $7
         WHERE id = $8 AND check_out IS NULL`,
        [
          shiftEndStr,
          hoursWorked,
          resolvedLateMinutes,
          resolvedEarlyLeaveMinutes,
          resolvedOvertimeMinutes,
          resolvedStatus,
          combinedNotes,
          row.id,
        ]
      );

      if (result.rowCount > 0) {
        updatedCount += 1;
      }
    }
  }

  if (updatedCount > 0) {
    console.log(`[auto-attendance] Auto-checked out ${updatedCount} employee(s) for ${dateStr}.`);
  }

  return updatedCount;
};

const runAutoAbsence12PM = async (overrideDate = null) => {
  const { dateStr, currentMinutes } = getCairoDateAndMinutes(overrideDate);

  // Trigger at or after 12:00 PM (720 minutes from midnight)
  if (currentMinutes < 720) {
    return 0;
  }

  const candidates = await pool.query(
    `SELECT 
       e.id, e.name, e.hire_date::text AS hire_date, e.termination_date::text AS termination_date,
       e.weekend_days, e.shift, TO_CHAR(e.shift_start, 'HH24:MI') AS shift_start, TO_CHAR(e.shift_end, 'HH24:MI') AS shift_end,
       TO_CHAR(s.start_time, 'HH24:MI') AS shift_start_time, TO_CHAR(s.end_time, 'HH24:MI') AS shift_end_time
     FROM employees e
     LEFT JOIN hr_shifts s ON e.shift_id = s.id
     WHERE COALESCE(e.status, 'active') = 'active'
       AND (e.hire_date IS NULL OR e.hire_date <= $1::date)
       AND (e.termination_date IS NULL OR e.termination_date >= $1::date)
       AND NOT EXISTS (
         SELECT 1 FROM attendance a WHERE a.employee_id = e.id AND a.date = $1::date
       )
       AND NOT EXISTS (
         SELECT 1 FROM hr_leave_requests l
         WHERE l.employee_id = e.id
           AND l.status = 'approved'
           AND l.start_date <= $1::date
           AND l.end_date >= $1::date
       )`,
    [dateStr]
  );

  const validEmpIds = candidates.rows
    .filter((emp) => {
      const empDetails = {
        shift: emp.shift,
        shift_start: emp.shift_start || emp.shift_start_time,
        shift_end: emp.shift_end || emp.shift_end_time,
        weekend_days: emp.weekend_days,
      };
      return !isWeekendDate(empDetails, dateStr);
    })
    .map((emp) => emp.id);

  let insertedCount = 0;

  if (validEmpIds.length > 0) {
    const result = await pool.query(
      `INSERT INTO attendance (
         employee_id, date, check_in, check_out, hours_worked,
         late_minutes, early_leave_minutes, overtime_minutes, status, notes
       )
       SELECT 
         emp_id, $1::date, NULL, NULL, 0, 0, 0, 0, 'absent', 'Auto-marked absent at 12:00 PM'
       FROM UNNEST($2::int[]) AS emp_id
       ON CONFLICT (employee_id, date) DO NOTHING`,
      [dateStr, validEmpIds]
    );
    insertedCount = result.rowCount || 0;
  }

  if (insertedCount > 0) {
    console.log(`[auto-attendance] Marked ${insertedCount} employee(s) absent for ${dateStr}.`);
  }

  return insertedCount;
};

let isRunning = false;

const runAutoAttendanceJobs = async (overrideDate = null) => {
  if (isRunning) return;
  isRunning = true;
  try {
    await runAutoCheckoutShiftBased(overrideDate);
    await runAutoAbsence12PM(overrideDate);
  } catch (error) {
    console.error('[auto-attendance] Execution error:', error?.message || error);
  } finally {
    isRunning = false;
  }
};

const startAutoAttendanceScheduler = () => {
  runAutoAttendanceJobs().catch((err) => {
    console.error('[auto-attendance] Initial execution failed:', err?.message || err);
  });

  setInterval(() => {
    runAutoAttendanceJobs().catch((err) => {
      console.error('[auto-attendance] Scheduled execution failed:', err?.message || err);
    });
  }, FIFTEEN_MINUTES_MS);
};

module.exports = {
  runAutoCheckoutShiftBased,
  runAutoAbsence12PM,
  runAutoAttendanceJobs,
  startAutoAttendanceScheduler,
  getCairoDateAndMinutes,
  minutesToTimeString,
};
