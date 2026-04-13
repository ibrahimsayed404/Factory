const SHIFT_SCHEDULES = {
  morning: { start: '09:00', end: '17:00' },
  evening: { start: '14:00', end: '22:00' },
  night: { start: '22:00', end: '06:00' },
};

const getLateGraceMinutes = () => Math.max(0, Number(process.env.ATTENDANCE_LATE_GRACE_MINUTES || 10));

const toMinutes = (value) => {
  if (!value) return null;
  const [h, m] = String(value).slice(0, 5).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return (h * 60) + m;
};

const parseWeekendDays = (weekendDays) => new Set(
  String(weekendDays || '0,6')
    .split(',')
    .map((value) => Number(String(value).trim()))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
);

const calculateWorkedMinutes = (checkIn, checkOut) => {
  const inMin = toMinutes(checkIn);
  const outMin = toMinutes(checkOut);
  if (inMin === null || outMin === null) return null;

  let end = outMin;
  if (end < inMin) end += 24 * 60;
  return Math.max(0, end - inMin);
};

const isWeekendDate = (employee, dateValue) => {
  if (!dateValue) return false;
  const d = new Date(`${String(dateValue).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  return parseWeekendDays(employee?.weekend_days).has(d.getUTCDay());
};

const resolveShiftWindow = (employee) => {
  const schedule = SHIFT_SCHEDULES[employee?.shift] || SHIFT_SCHEDULES.morning;
  const shiftStart = toMinutes(employee?.shift_start || schedule.start);
  const shiftEnd = toMinutes(employee?.shift_end || schedule.end);
  const overnightShift = shiftStart !== null && shiftEnd !== null && shiftEnd <= shiftStart;
  return { shiftStart, shiftEnd, overnightShift };
};

const normalizeShiftMinute = (minuteValue, shiftStart, shiftEnd, overnightShift) => {
  if (minuteValue === null) return null;
  if (!overnightShift) return minuteValue;
  // For overnight shifts, times after midnight (before shift end) belong to next-day segment.
  if (minuteValue < shiftEnd) return minuteValue + (24 * 60);
  return minuteValue;
};

const calculateHoursWorked = (checkIn, checkOut, providedHours) => {
  if (!checkIn || !checkOut) return providedHours ?? null;

  const workedMinutes = calculateWorkedMinutes(checkIn, checkOut);
  if (workedMinutes === null) return providedHours ?? null;

  const hours = workedMinutes / 60;
  return Number(hours.toFixed(2));
};

const calculateLateMinutesOnly = (employee, checkIn, options = {}) => {
  const inMinRaw = toMinutes(checkIn);
  const { shiftStart, shiftEnd, overnightShift } = resolveShiftWindow(employee);
  if (inMinRaw === null || shiftStart === null || shiftEnd === null) return 0;

  const inMin = normalizeShiftMinute(inMinRaw, shiftStart, shiftEnd, overnightShift);
  const lateWithoutGrace = Math.max(0, inMin - shiftStart);
  const graceMinutes = Number.isFinite(Number(options.lateGraceMinutes))
    ? Number(options.lateGraceMinutes)
    : getLateGraceMinutes();
  return Math.max(0, lateWithoutGrace - Math.max(0, graceMinutes));
};

const calculateShiftMetrics = (employee, checkIn, checkOut, options = {}) => {
  const inMinRaw = toMinutes(checkIn);
  const outMinRaw = toMinutes(checkOut);
  const { shiftStart, shiftEnd, overnightShift } = resolveShiftWindow(employee);

  if (inMinRaw === null || outMinRaw === null || shiftStart === null || shiftEnd === null) {
    return { late_minutes: 0, early_leave_minutes: 0, overtime_minutes: 0 };
  }

  const normalizedShiftEnd = overnightShift ? shiftEnd + (24 * 60) : shiftEnd;
  let normalizedIn = normalizeShiftMinute(inMinRaw, shiftStart, shiftEnd, overnightShift);
  let normalizedOut = normalizeShiftMinute(outMinRaw, shiftStart, shiftEnd, overnightShift);
  if (normalizedOut < normalizedIn) normalizedOut += 24 * 60;

  const lateWithoutGrace = Math.max(0, normalizedIn - shiftStart);
  const graceMinutes = Number.isFinite(Number(options.lateGraceMinutes))
    ? Number(options.lateGraceMinutes)
    : getLateGraceMinutes();

  return {
    late_minutes: Math.max(0, lateWithoutGrace - Math.max(0, graceMinutes)),
    early_leave_minutes: Math.max(0, normalizedShiftEnd - normalizedOut),
    overtime_minutes: Math.max(0, normalizedOut - normalizedShiftEnd),
  };
};

module.exports = {
  SHIFT_SCHEDULES,
  toMinutes,
  parseWeekendDays,
  resolveShiftWindow,
  calculateWorkedMinutes,
  calculateHoursWorked,
  calculateLateMinutesOnly,
  calculateShiftMetrics,
  isWeekendDate,
};
