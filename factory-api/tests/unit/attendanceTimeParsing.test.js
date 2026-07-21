const { toMinutes, calculateWorkedMinutes, calculateShiftMetrics } = require('../../src/utils/attendanceMetrics');

describe('Attendance Time Parsing Unit Tests', () => {
  test('toMinutes handles 2-digit and 1-digit hours correctly', () => {
    expect(toMinutes('09:00')).toBe(540);
    expect(toMinutes('9:00')).toBe(540);
    expect(toMinutes('09:05:00')).toBe(545);
    expect(toMinutes('9:05:30')).toBe(545);
    expect(toMinutes(null)).toBeNull();
    expect(toMinutes('')).toBeNull();
    expect(toMinutes('invalid')).toBeNull();
  });

  test('calculateWorkedMinutes handles standard shifts and midnight crossover', () => {
    expect(calculateWorkedMinutes('09:00', '17:00')).toBe(480);
    expect(calculateWorkedMinutes('9:00', '17:00')).toBe(480);
    expect(calculateWorkedMinutes('22:00', '06:00')).toBe(480);
  });

  test('calculateShiftMetrics returns raw late minutes (no grace subtracted)', () => {
    const employee = { shift: 'morning', shift_start: '09:00', shift_end: '17:00' };
    
    // 5 mins late -> 5 late minutes (grace does NOT apply to late)
    const m1 = calculateShiftMetrics(employee, '09:05', '17:00');
    expect(m1.late_minutes).toBe(5);

    // 15 mins late -> 15 late minutes (grace does NOT apply to late)
    const m2 = calculateShiftMetrics(employee, '09:15', '17:00');
    expect(m2.late_minutes).toBe(15);

    // On time -> 0 late minutes
    const m3 = calculateShiftMetrics(employee, '09:00', '17:00');
    expect(m3.late_minutes).toBe(0);

    // Early -> 0 late minutes
    const m4 = calculateShiftMetrics(employee, '08:50', '17:00');
    expect(m4.late_minutes).toBe(0);
  });

  test('calculateShiftMetrics starts overtime after 15 minutes past shift end', () => {
    // Shift ending at 17:00 (5:00 PM)
    const emp5 = { shift_start: '09:00', shift_end: '17:00' };
    // Checkout at 5:15 PM -> 0 overtime minutes
    expect(calculateShiftMetrics(emp5, '09:00', '17:15', { overtimeGraceMinutes: 15 }).overtime_minutes).toBe(0);
    // Checkout at 5:20 PM -> ALL 20 overtime minutes count
    expect(calculateShiftMetrics(emp5, '09:00', '17:20', { overtimeGraceMinutes: 15 }).overtime_minutes).toBe(20);

    // Shift ending at 18:00 (6:00 PM)
    const emp6 = { shift_start: '10:00', shift_end: '18:00' };
    // Checkout at 6:15 PM -> 0 overtime minutes
    expect(calculateShiftMetrics(emp6, '10:00', '18:15', { overtimeGraceMinutes: 15 }).overtime_minutes).toBe(0);
    // Checkout at 6:20 PM -> ALL 20 overtime minutes count
    expect(calculateShiftMetrics(emp6, '10:00', '18:20', { overtimeGraceMinutes: 15 }).overtime_minutes).toBe(20);
  });
});
