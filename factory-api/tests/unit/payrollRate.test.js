const { getRates, resolveShiftHours } = require('../../src/services/payrollService');

describe('Payroll minuteRate calculation unit tests', () => {
  const policy = { workHoursPerDay: 8, workingDaysPerMonth: 30 };

  test('calculates minuteRate using 9-hour shift duration for employee with 9-hour shift', () => {
    // 6 working days per week (Friday weekend set)
    const weekendSet = new Set([5]);
    const baseSalary = 1000;
    const useWeeklySalary = true;

    // Employee with 9-hour shift (08:00 to 17:00)
    const employee9h = {
      id: 1,
      name: 'Test 9h Employee',
      shift_start: '08:00',
      shift_end: '17:00',
      weekend_days: '5',
    };

    const rates = getRates(baseSalary, weekendSet, policy, useWeeklySalary, employee9h);

    const expectedDailyRate = 1000 / 6; // 166.666...
    const expectedShiftHours = 9;
    const expectedMinuteRate = (1000 / 6) / (9 * 60); // 1000/6/(9*60)
    const incorrect8hMinuteRate = (1000 / 6) / (8 * 60); // 1000/6/(8*60)

    expect(rates.dailyRate).toBeCloseTo(expectedDailyRate, 5);
    expect(rates.shiftHours).toBe(expectedShiftHours);
    expect(rates.minuteRate).toBeCloseTo(expectedMinuteRate, 6);
    expect(rates.minuteRate).not.toBeCloseTo(incorrect8hMinuteRate, 5);
  });

  test('resolves shift hours from explicit shift_hours or work_hours_per_day property if present', () => {
    expect(resolveShiftHours({ shift_hours: 10 })).toBe(10);
    expect(resolveShiftHours({ work_hours_per_day: 7.5 })).toBe(7.5);
  });

  test('falls back to 8 hours default and logs warning if employee shift is missing/unresolvable', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const shiftHours = resolveShiftHours(null, 8);
    expect(shiftHours).toBe(8);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Payroll] Missing or unresolvable shift duration')
    );

    consoleSpy.mockRestore();
  });
});
