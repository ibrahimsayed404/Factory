const { calculateInferredAbsentDays } = require('../../src/services/payrollService');

describe('Inferred Absence Calculation Unit Tests', () => {
  const fridayWeekend = new Set([5]); // Friday = 5
  const satFriWeekend = new Set([0, 6]); // Sun=0, Sat=6

  test('1. Employee with zero attendance records for entire past period -> deducted full period minus weekends', () => {
    // Period: Sat 2026-03-14 to Thu 2026-03-19 (6 calendar days: Sat, Sun, Mon, Tue, Wed, Thu)
    // Friday is weekend (5). None of these 6 days are Friday.
    const records = [];
    const inferred = calculateInferredAbsentDays(records, fridayWeekend, '2026-03-14', '2026-03-19', {});
    expect(inferred).toBe(6);
  });

  test('2. Employee absent only first 3 workdays of the period, present afterward -> initial 3 workdays counted as inferred absent', () => {
    // Period: Sat 2026-03-14 to Thu 2026-03-19
    // Present on Tue 2026-03-17, Wed 2026-03-18, Thu 2026-03-19
    // Missing: Sat 2026-03-14, Sun 2026-03-15, Mon 2026-03-16 (3 days)
    const records = [
      { date: '2026-03-17', status: 'present' },
      { date: '2026-03-18', status: 'present' },
      { date: '2026-03-19', status: 'present' },
    ];
    const inferred = calculateInferredAbsentDays(records, fridayWeekend, '2026-03-14', '2026-03-19', {});
    expect(inferred).toBe(3);
  });

  test('3. Employee terminated mid-period -> days after termination_date should NOT count as absent', () => {
    // Period: Sat 2026-03-14 to Thu 2026-03-19
    // Terminated on Mon 2026-03-16.
    // Days evaluated: Sat 2026-03-14, Sun 2026-03-15, Mon 2026-03-16 (3 workdays).
    // Tue 2026-03-17, Wed 2026-03-18, Thu 2026-03-19 are after termination date -> skipped.
    const records = [];
    const employee = { termination_date: '2026-03-16', status: 'inactive' };
    const inferred = calculateInferredAbsentDays(records, fridayWeekend, '2026-03-14', '2026-03-19', employee);
    expect(inferred).toBe(3);
  });

  test('4. Employee hired mid-period -> days before hire_date should NOT count as absent', () => {
    // Period: Sat 2026-03-14 to Thu 2026-03-19
    // Hired on Tue 2026-03-17.
    // Sat 2026-03-14, Sun 2026-03-15, Mon 2026-03-16 are before hire date -> skipped.
    // Evaluated: Tue 2026-03-17, Wed 2026-03-18, Thu 2026-03-19 (3 workdays).
    const records = [];
    const employee = { hire_date: '2026-03-17' };
    const inferred = calculateInferredAbsentDays(records, fridayWeekend, '2026-03-14', '2026-03-19', employee);
    expect(inferred).toBe(3);
  });

  test('5. Multi-day approved leave handling -> approved leave dates should NOT count as absent', () => {
    // Period: Sat 2026-03-14 to Thu 2026-03-19 (6 workdays)
    // Approved leave range: Sun 2026-03-15 to Tue 2026-03-17 (3 days: 03-15, 03-16, 03-17)
    // Remaining unpunched workdays: Sat 2026-03-14, Wed 2026-03-18, Thu 2026-03-19 (3 days)
    const records = [];
    const approvedLeaveDates = new Set(['2026-03-15', '2026-03-16', '2026-03-17']);
    const inferred = calculateInferredAbsentDays(records, fridayWeekend, '2026-03-14', '2026-03-19', {}, approvedLeaveDates);
    expect(inferred).toBe(3);
  });

  test('6. Timezone-aware today capping -> future days in open period are NOT marked absent', () => {
    // Period: open period starting 2026-03-01 to 2026-03-31
    // Today: 2026-03-05 (capped at 2026-03-05)
    // Supposing hire_date 2026-03-01, friday weekend (Friday March 6 is out of cap).
    // Days 2026-03-01 (Sun) through 2026-03-05 (Thu) = 5 days.
    // Future days 2026-03-06 through 2026-03-31 must be skipped.
    const records = [];
    // We pass periodStart='2026-03-01', periodEnd='2026-03-05' to simulate capping at today 2026-03-05
    const inferred = calculateInferredAbsentDays(records, fridayWeekend, '2026-03-01', '2026-03-05', {});
    expect(inferred).toBe(5);
  });

  test('7. Explicit status = absent record -> skipped from inferred loop to avoid double-counting', () => {
    // Period: Sat 2026-03-14 to Thu 2026-03-19 (6 workdays)
    // Explicit absent record on Mon 2026-03-16
    // Inferred loop should skip 2026-03-16 -> inferred = 5.
    const records = [{ date: '2026-03-16', status: 'absent' }];
    const inferred = calculateInferredAbsentDays(records, fridayWeekend, '2026-03-14', '2026-03-19', {});
    expect(inferred).toBe(5);
  });

  test('8. Employee present every workday -> 0 inferred absent days', () => {
    // Period: Sat 2026-03-14 to Thu 2026-03-19 (6 workdays)
    const records = [
      { date: '2026-03-14', status: 'present' },
      { date: '2026-03-15', status: 'present' },
      { date: '2026-03-16', status: 'present' },
      { date: '2026-03-17', status: 'present' },
      { date: '2026-03-18', status: 'present' },
      { date: '2026-03-19', status: 'present' },
    ];
    const inferred = calculateInferredAbsentDays(records, fridayWeekend, '2026-03-14', '2026-03-19', {});
    expect(inferred).toBe(0);
  });
});
