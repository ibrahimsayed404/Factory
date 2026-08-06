require('dotenv').config();
const pool = require('../src/db/pool');
const { runAutoAttendanceJobs, runAutoAbsence12PM, runAutoCheckoutShiftBased } = require('../src/services/autoAttendanceScheduler');

(async () => {
  try {
    console.log('=== RUNNING LIVE ATTENDANCE AUTOMATION SANITY CHECK ===');

    // 1. Simulate 12:30 PM trigger for Rule 2 (Same-day absence)
    const simulated1230PM = new Date('2026-08-06T12:30:00+03:00');
    console.log(`\n1. Simulating 12:30 PM trigger for ${simulated1230PM.toISOString()}...`);
    const absenceCount = await runAutoAbsence12PM(simulated1230PM);
    console.log(`-> Auto-marked absent count: ${absenceCount}`);

    // 2. Query attendance records created for 2026-08-06
    const todayRes = await pool.query(`
      SELECT 
        a.id,
        a.employee_id,
        e.name AS employee_name,
        a.date::text AS date,
        TO_CHAR(a.check_in, 'HH24:MI') AS check_in,
        TO_CHAR(a.check_out, 'HH24:MI') AS check_out,
        a.hours_worked,
        a.late_minutes,
        a.early_leave_minutes,
        a.overtime_minutes,
        a.status,
        a.notes
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.date = '2026-08-06'::date
      ORDER BY a.status, e.id
    `);

    console.log(`\nFound ${todayRes.rows.length} attendance record(s) for 2026-08-06 in DB:`);
    console.table(todayRes.rows.slice(0, 10).map(r => ({
      ID: r.id,
      Employee: r.employee_name,
      CheckIn: r.check_in || '-',
      CheckOut: r.check_out || '-',
      Status: r.status,
      Notes: r.notes || '-'
    })));

    process.exit(0);
  } catch (err) {
    console.error('Sanity check error:', err);
    process.exit(1);
  }
})();
