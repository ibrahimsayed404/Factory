const {
  countEmployedWorkDays,
  buildApprovedLeaveDatesSet,
} = require('../../src/services/payrollService');

describe('countEmployedWorkDays (base-salary proration)', () => {
  const fridayWeekend = new Set([5]); // Friday only

  test('fully employed week -> employed equals total working days', () => {
    // Sat 2026-07-04 .. Fri 2026-07-10, Friday weekend => 6 working days (Sat–Thu)
    const { employed, total } = countEmployedWorkDays('2026-07-04', '2026-07-10', fridayWeekend, { hire_date: '2020-01-01' });
    expect(total).toBe(6);
    expect(employed).toBe(6);
  });

  test('hired mid-week -> only working days on/after hire count as employed', () => {
    // Hired Tue 2026-07-07 -> Sat 04, Sun 05, Mon 06 are before hire (3 excluded)
    const { employed, total } = countEmployedWorkDays('2026-07-04', '2026-07-10', fridayWeekend, { hire_date: '2026-07-07' });
    expect(total).toBe(6);
    expect(employed).toBe(3); // Tue, Wed, Thu
  });

  test('terminated mid-week -> working days after termination excluded', () => {
    const { employed, total } = countEmployedWorkDays('2026-07-04', '2026-07-10', fridayWeekend, { hire_date: '2020-01-01', termination_date: '2026-07-06' });
    expect(total).toBe(6);
    expect(employed).toBe(3); // Sat, Sun, Mon
  });
});

describe('buildApprovedLeaveDatesSet (leave_type handling)', () => {
  test('paid leave dates are added to the exclusion set', () => {
    const set = buildApprovedLeaveDatesSet([
      { leave_type: 'vacation', start_date: '2026-07-06', end_date: '2026-07-07' },
    ]);
    expect(set.has('2026-07-06')).toBe(true);
    expect(set.has('2026-07-07')).toBe(true);
  });

  test('unpaid leave is NOT excluded (treated as absence)', () => {
    const set = buildApprovedLeaveDatesSet([
      { leave_type: 'unpaid', start_date: '2026-07-06', end_date: '2026-07-08' },
    ]);
    expect(set.has('2026-07-06')).toBe(false);
    expect(set.has('2026-07-07')).toBe(false);
    expect(set.size).toBe(0);
  });

  test('mixed paid and unpaid -> only paid dates excluded', () => {
    const set = buildApprovedLeaveDatesSet([
      { leave_type: 'sick', start_date: '2026-07-06', end_date: '2026-07-06' },
      { leave_type: 'unpaid', start_date: '2026-07-08', end_date: '2026-07-08' },
    ]);
    expect(set.has('2026-07-06')).toBe(true);
    expect(set.has('2026-07-08')).toBe(false);
  });
});
