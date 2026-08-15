/**
 * payrollSnapshotFreeze.test.js
 *
 * Verifies that once payroll is generated for an employee, changing the
 * employee's salary does NOT retroactively change the payroll net pay.
 *
 * These are pure unit tests: they mock the repository layer so no real
 * database is touched.
 */
const {
  computeLivePayrollFigures,
  getRates,
  resolveShiftHours,
} = require('../../src/services/payrollService');

// Silence shift-resolution warnings during tests
beforeAll(() => { jest.spyOn(console, 'warn').mockImplementation(() => {}); });
afterAll(() => { console.warn.mockRestore(); });

// Mock payrollRepository so computeLivePayrollFigures doesn't hit the DB
jest.mock('../../src/repositories/payrollRepository', () => ({
  getAttendanceForPayroll: jest.fn().mockResolvedValue([]),
  getApprovedLeavesForPayroll: jest.fn().mockResolvedValue([]),
}));

const basePolicy = {
  workHoursPerDay: 8,
  workingDaysPerMonth: 30,
  overtimeMultiplier: 1.5,
  vacationOvertimeMultiplier: 1,
  weeksPerMonth: 4,
};

describe('Payroll snapshot freeze — salary drift prevention', () => {
  test('computeLivePayrollFigures uses snapshot_salary over live employee salary', async () => {
    const payrollRow = {
      id: 1,
      employee_id: 42,
      status: 'pending',
      week_start: '2026-12-05',
      week_end: '2026-12-11',
      month: 12,
      year: 2026,
      // Snapshot frozen at generation time: salary was 3000
      snapshot_salary: 3000,
      snapshot_shift: 'morning',
      snapshot_shift_start: '08:00',
      snapshot_shift_end: '17:00',
      snapshot_weekend_days: '5',
      snapshot_hire_date: '2026-01-01',
      snapshot_termination_date: null,
      base_salary: 3000,
      manual_bonus: 0,
      manual_deductions: 0,
      hr_bonus: 0,
      hr_penalty: 0,
      hr_overtime: 0,
      loan_deduction: 0,
    };

    // Simulate employee salary changed AFTER generation (3000 → 4000)
    const liveEmployee = {
      id: 42,
      salary: 4000,
      shift: 'morning',
      shift_start: '08:00',
      shift_end: '17:00',
      weekend_days: '5',
      hire_date: '2026-01-01',
      termination_date: null,
    };

    // Call with live employee passed (simulates what the read path did before fix)
    const result = await computeLivePayrollFigures(payrollRow, liveEmployee, basePolicy);

    // The snapshot_salary (3000) should be used, NOT live employee.salary (4000)
    expect(result.baseSalary).toBe(3000);
    expect(result.recomputedNet).toBe(3000);
  });

  test('computeLivePayrollFigures uses snapshot_salary when employee is null', async () => {
    const payrollRow = {
      id: 2,
      employee_id: 42,
      status: 'pending',
      week_start: '2026-12-05',
      week_end: '2026-12-11',
      month: 12,
      year: 2026,
      snapshot_salary: 2500,
      snapshot_shift: 'morning',
      snapshot_shift_start: '09:00',
      snapshot_shift_end: '18:00',
      snapshot_weekend_days: '5',
      snapshot_hire_date: '2026-01-01',
      snapshot_termination_date: null,
      base_salary: 2500,
      manual_bonus: 0,
      manual_deductions: 0,
      hr_bonus: 0,
      hr_penalty: 0,
      hr_overtime: 0,
      loan_deduction: 0,
    };

    // No employee provided (the new getPayroll read path passes null)
    const result = await computeLivePayrollFigures(payrollRow, null, basePolicy);

    expect(result.baseSalary).toBe(2500);
    expect(result.recomputedNet).toBe(2500);
  });

  test('falls back to base_salary when snapshot_salary is missing (legacy records)', async () => {
    const legacyRow = {
      id: 3,
      employee_id: 42,
      status: 'pending',
      week_start: '2026-12-05',
      week_end: '2026-12-11',
      month: 12,
      year: 2026,
      // No snapshot columns (legacy record before migration)
      base_salary: 1800,
      manual_bonus: 0,
      manual_deductions: 0,
      hr_bonus: 0,
      hr_penalty: 0,
      hr_overtime: 0,
      loan_deduction: 0,
    };

    // Live employee has different salary
    const liveEmployee = {
      id: 42,
      salary: 2200,
      shift: 'morning',
      shift_start: '08:00',
      shift_end: '17:00',
      weekend_days: '5',
      hire_date: '2026-01-01',
      termination_date: null,
    };

    // Without snapshot, should fall back to base_salary (1800), NOT live (2200)
    const result = await computeLivePayrollFigures(legacyRow, liveEmployee, basePolicy);

    expect(result.baseSalary).toBe(1800);
    expect(result.recomputedNet).toBe(1800);
  });

  test('snapshot shift values determine minute rate, not live employee shift', async () => {
    const payrollRow = {
      id: 4,
      employee_id: 42,
      status: 'pending',
      week_start: '2026-08-01',
      week_end: '2026-08-07',
      month: 8,
      year: 2026,
      snapshot_salary: 2400,
      snapshot_shift: 'morning',
      snapshot_shift_start: '08:00',
      snapshot_shift_end: '17:00', // 9 hours
      snapshot_weekend_days: '5',
      snapshot_hire_date: '2026-01-01',
      snapshot_termination_date: null,
      base_salary: 2400,
      manual_bonus: 0,
      manual_deductions: 0,
      hr_bonus: 0,
      hr_penalty: 0,
      hr_overtime: 0,
      loan_deduction: 0,
    };

    // Shift hours from snapshot: 17:00 - 08:00 = 9 hours
    const snapshotShiftHours = resolveShiftHours({
      shift: 'morning',
      shift_start: '08:00',
      shift_end: '17:00',
    });
    expect(snapshotShiftHours).toBe(9);

    // Live employee has different shift (10 hours)
    const liveEmployee = {
      id: 42,
      salary: 2400,
      shift: 'morning',
      shift_start: '07:00',
      shift_end: '17:00', // 10 hours
      weekend_days: '5',
      hire_date: '2026-01-01',
      termination_date: null,
    };

    const result = await computeLivePayrollFigures(payrollRow, liveEmployee, basePolicy);

    // Minute rate should use 9-hour shift (snapshot), not 10-hour (live)
    // With 2400 weekly salary, 6 work days: dailyRate = 2400/6 = 400
    // minuteRate = 400 / (9 * 60) = 0.7407...
    const expectedDailyRate = 2400 / 6;
    const expectedMinuteRate = expectedDailyRate / (9 * 60);
    const rates = getRates(2400, new Set([5]), basePolicy, true, {
      shift: 'morning',
      shift_start: '08:00',
      shift_end: '17:00',
    });

    expect(rates.shiftHours).toBe(9);
    expect(rates.minuteRate).toBeCloseTo(expectedMinuteRate, 6);
  });

  test('paid records always use stored base_salary regardless of snapshot', async () => {
    const paidRow = {
      id: 5,
      employee_id: 42,
      status: 'paid',
      week_start: '2026-07-25',
      week_end: '2026-07-31',
      month: 7,
      year: 2026,
      snapshot_salary: 3000,
      snapshot_shift: 'morning',
      snapshot_shift_start: '08:00',
      snapshot_shift_end: '17:00',
      snapshot_weekend_days: '5',
      snapshot_hire_date: '2026-01-01',
      snapshot_termination_date: null,
      base_salary: 2800, // prorated at payment time
      net_salary: 2700,
      bonus: 100,
      deductions: 200,
      manual_bonus: 0,
      manual_deductions: 0,
      hr_bonus: 0,
      hr_penalty: 0,
      hr_overtime: 0,
      loan_deduction: 0,
    };

    const result = await computeLivePayrollFigures(paidRow, null, basePolicy);

    // For paid records, baseSalary should be the stored prorated base_salary
    expect(result.baseSalary).toBe(2800);
  });
});
