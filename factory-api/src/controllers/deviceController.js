const crypto = require('crypto');
const pool = require('../db/pool');
const {
  calculateHoursWorked,
  calculateWorkedMinutes,
  calculateLateMinutesOnly,
  calculateShiftMetrics,
  isWeekendDate,
  toMinutes,
  resolveShiftWindow,
} = require('../utils/attendanceMetrics');
const { getAttendancePayrollPolicy } = require('../utils/policySettings');

const WEEKEND_PRESENT_NOTE = 'present vacation';
const DUPLICATE_PUNCH_WINDOW_MINUTES = Number(process.env.ATTENDANCE_DUPLICATE_PUNCH_MINUTES || 3);

const normalizePunchTimestamp = (input) => {
  const raw = String(input || '').trim();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    const [, datePart, h, m, sec] = match;
    const hhmm = `${String(h).padStart(2, '0')}:${m}`;
    return {
      datePart,
      timePart: hhmm,
      timestamp: `${datePart} ${hhmm}:${sec || '00'}`,
    };
  }

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const iso = d.toISOString().slice(0, 19).replace('T', ' ');
  return {
    datePart: iso.slice(0, 10),
    timePart: iso.slice(11, 16),
    timestamp: iso,
  };
};

const previousDate = (datePart) => {
  const d = new Date(`${datePart}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

const resolveAttendanceDate = (employee, datePart, timePart) => {
  const { shiftStart, shiftEnd, overnightShift } = resolveShiftWindow(employee);
  if (!overnightShift || shiftStart === null || shiftEnd === null) {
    return datePart;
  }

  const minute = toMinutes(timePart);
  if (minute === null) return datePart;
  const inAfterMidnightSegment = minute < shiftEnd;
  if (!inAfterMidnightSegment) return datePart;
  return previousDate(datePart);
};

const buildExternalEventId = (event, employeeId) => {
  if (event.external_event_id) return String(event.external_event_id);
  const base = [
    event.device_id || 'unknown-device',
    event.device_user_id || 'unknown-user',
    employeeId,
    event.punched_at,
    event.direction || 'auto',
  ].join('|');
  return crypto.createHash('sha256').update(base).digest('hex').slice(0, 32);
};

const recalculateAttendanceFromEvents = async (client, employee, attendanceDate, policy) => {
  const punches = await client.query(
    `SELECT punched_at, TO_CHAR(punched_at, 'HH24:MI') AS punch_time
     FROM attendance_punch_events
     WHERE employee_id = $1 AND attendance_date = $2
     ORDER BY punched_at ASC`,
    [employee.id, attendanceDate]
  );

  if (!punches.rows.length) return null;

  const duplicateWindowMs = Math.max(0, DUPLICATE_PUNCH_WINDOW_MINUTES) * 60 * 1000;
  const dedupedPunches = [];
  for (const punch of punches.rows) {
    if (!dedupedPunches.length) {
      dedupedPunches.push(punch);
      continue;
    }
    const prevTime = new Date(dedupedPunches[dedupedPunches.length - 1].punched_at).getTime();
    const currTime = new Date(punch.punched_at).getTime();
    if (!Number.isNaN(prevTime) && !Number.isNaN(currTime) && (currTime - prevTime) < duplicateWindowMs) {
      continue;
    }
    dedupedPunches.push(punch);
  }

  const checkIn = dedupedPunches[0].punch_time;
  const hasCheckout = dedupedPunches.length > 1;
  const checkOut = hasCheckout ? dedupedPunches[dedupedPunches.length - 1].punch_time : null;
  const hoursWorked = hasCheckout ? calculateHoursWorked(checkIn, checkOut, null) : null;
  const weekendAttendance = isWeekendDate(employee, attendanceDate);
  const workedMinutes = hasCheckout ? calculateWorkedMinutes(checkIn, checkOut) : 0;

  const metrics = weekendAttendance
    ? {
      late_minutes: 0,
      early_leave_minutes: 0,
      overtime_minutes: workedMinutes || 0,
    }
    : hasCheckout
    ? calculateShiftMetrics(employee, checkIn, checkOut, {
      lateGraceMinutes: policy.attendanceLateGraceMinutes,
      overtimeGraceMinutes: policy.attendanceOvertimeGraceMinutes,
    })
    : {
      late_minutes: calculateLateMinutesOnly(employee, checkIn, { lateGraceMinutes: policy.attendanceLateGraceMinutes }),
      early_leave_minutes: 0,
      overtime_minutes: 0,
    };

  const status = weekendAttendance ? 'present' : (metrics.late_minutes > 0 ? 'late' : 'present');
  const notes = weekendAttendance ? WEEKEND_PRESENT_NOTE : 'auto-ingested-from-device';

  const upsert = await client.query(
    `INSERT INTO attendance (
      employee_id, date, check_in, check_out, hours_worked, status,
      late_minutes, early_leave_minutes, overtime_minutes, notes
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (employee_id, date) DO UPDATE
    SET check_in = EXCLUDED.check_in,
        check_out = EXCLUDED.check_out,
        hours_worked = EXCLUDED.hours_worked,
        status = EXCLUDED.status,
        late_minutes = EXCLUDED.late_minutes,
        early_leave_minutes = EXCLUDED.early_leave_minutes,
      overtime_minutes = EXCLUDED.overtime_minutes,
      notes = EXCLUDED.notes
    RETURNING *`,
    [
      employee.id,
      attendanceDate,
      checkIn,
      checkOut,
      hoursWorked,
      status,
      metrics.late_minutes,
      metrics.early_leave_minutes,
      metrics.overtime_minutes,
      notes,
    ]
  );

  return upsert.rows[0];
};

const ingestPunchEvents = async (req, res, next) => {
  const incoming = Array.isArray(req.body)
    ? req.body
    : Array.isArray(req.body?.events)
      ? req.body.events
      : [req.body];

  if (!incoming.length) {
    return res.status(400).json({ error: 'No events provided' });
  }

  let client;
  try {
    client = await pool.connect();
    // Pass the held client so policy lookup does not need a second pool connection
    // (Vercel uses DB_POOL_MAX=1 — pool.query while holding connect() deadlocks).
    const policy = await getAttendancePayrollPolicy(client);
    await client.query('BEGIN');

    // SECURITY & PERF: Pre-fetch employees to prevent N+1 queries
    const employeeIds = [...new Set(incoming.filter(e => e.employee_id).map(e => e.employee_id))];
    const deviceUserIds = [...new Set(incoming.filter(e => e.device_user_id && !e.employee_id).map(e => String(e.device_user_id)))];

    const employeeMap = new Map();

    if (employeeIds.length > 0) {
      const { rows } = await client.query('SELECT id, shift, shift_start, shift_end, weekend_days FROM employees WHERE id = ANY($1)', [employeeIds]);
      rows.forEach(r => employeeMap.set(`id:${r.id}`, r));
    }

    if (deviceUserIds.length > 0) {
      const { rows } = await client.query('SELECT id, shift, shift_start, shift_end, weekend_days, device_user_id FROM employees WHERE device_user_id = ANY($1)', [deviceUserIds]);
      rows.forEach(r => employeeMap.set(`dev:${r.device_user_id}`, r));
    }

    const results = [];

    for (const event of incoming) {
      const missing = [];
      if (!event?.punched_at) missing.push('punched_at');
      if (!event?.device_user_id && !event?.employee_id) missing.push('device_user_id or employee_id');

      if (missing.length) {
        results.push({ ok: false, error: `Missing required fields: ${missing.join(', ')}`, event });
        continue;
      }

      const employee = event.employee_id
        ? employeeMap.get(`id:${event.employee_id}`)
        : employeeMap.get(`dev:${String(event.device_user_id)}`);

      if (!employee) {
        results.push({ ok: false, error: 'Employee mapping not found', event });
        continue;
      }

      const normalized = normalizePunchTimestamp(event.punched_at);
      if (!normalized) {
        results.push({ ok: false, error: 'Invalid punched_at timestamp', event });
        continue;
      }

      const attendanceDate = resolveAttendanceDate(employee, normalized.datePart, normalized.timePart);
      const externalId = buildExternalEventId(event, employee.id);

      await client.query(
        `INSERT INTO attendance_punch_events (
          external_event_id, device_id, device_user_id, employee_id,
          punched_at, direction, source, payload, attendance_date, processed_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
        ON CONFLICT (external_event_id) DO NOTHING`,
        [
          externalId,
          event.device_id || null,
          event.device_user_id ? String(event.device_user_id) : null,
          employee.id,
          normalized.timestamp,
          event.direction || null,
          event.source || 'connector',
          event.payload ? JSON.stringify(event.payload) : JSON.stringify(event),
          attendanceDate,
        ]
      );

      const attendance = await recalculateAttendanceFromEvents(client, employee, attendanceDate, policy);
      results.push({ ok: true, external_event_id: externalId, employee_id: employee.id, attendance_date: attendanceDate, attendance });
    }

    await client.query('COMMIT');
    res.status(207).json({
      received: incoming.length,
      accepted: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    });
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) { /* ignore rollback errors */ }
    }
    next(err);
  } finally {
    if (client) client.release();
  }
};

module.exports = { ingestPunchEvents };
