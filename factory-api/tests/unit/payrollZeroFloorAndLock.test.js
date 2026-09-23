/**
 * payrollZeroFloorAndLock.test.js
 *
 * Unit tests verifying:
 * 1. Floor at zero: net salary cannot be negative when deductions exceed base salary.
 * 2. Recalc drift suppression on paid records: has_recalc_drift is false for paid records.
 * 3. Period locking: regenerating a fully paid week throws an ApiError.
 */
jest.mock('../../src/utils/policySettings', () => ({
  getAttendancePayrollPolicy: jest.fn().mockResolvedValue({
    workHoursPerDay: 8,
    workingDaysPerMonth: 30,
    payrollOvertimeMultiplier: 1.5,
    payrollVacationOvertimeMultiplier: 1,
    payrollWeeksPerMonth: 4,
  }),
}));

const {
  computeLivePayrollFigures,
  getPayroll,
  generatePayroll,
} = require('../../src/services/payrollService');
const payrollRepository = require('../../src/repositories/payrollRepository');
const ApiError = require('../../src/utils/ApiError');

// Silence shift-resolution warnings during tests
beforeAll(() => { jest.spyOn(console, 'warn').mockImplementation(() => {}); });
afterAll(() => { console.warn.mockRestore(); });

jest.mock('../../src/repositories/payrollRepository', () => ({
  getAttendanceForPayroll: jest.fn().mockResolvedValue([]),
  getApprovedLeavesForPayroll: jest.fn().mockResolvedValue([]),
  hasWeekendDaysColumn: jest.fn().mockResolvedValue(true),
  hasSnapshotColumns: jest.fn().mockResolvedValue(true),
  hasEmployeeNameColumn: jest.fn().mockResolvedValue(true),
  getEmployeeForPayroll: jest.fn(),
  getPayrollRecordsForWeek: jest.fn(),
  getActiveEmployeesForPayroll: jest.fn(),
  getEmployeesForPayrollWeek: jest.fn(),
  upsertPayroll: jest.fn(),
  applyLoanDeductions: jest.fn(),
  getPayrollById: jest.fn(),
  getAttendanceBatchForPayroll: jest.fn().mockResolvedValue(new Map()),
  getApprovedLeavesBatchForPayroll: jest.fn().mockResolvedValue(new Map()),
  getPayrollRecordsCount: jest.fn(),
  getPayrollRecords: jest.fn(),
}));

jest.mock('../../src/services/accountingService', () => ({
  reconcilePayrollAccrual: jest.fn().mockResolvedValue(),
  postPayrollPayment: jest.fn().mockResolvedValue(),
}));

const basePolicy = {
  workHoursPerDay: 8,
  workingDaysPerMonth: 30,
  overtimeMultiplier: 1.5,
  vacationOvertimeMultiplier: 1,
  weeksPerMonth: 4,
};

describe('Payroll Zero Floor and Period Locking Unit Tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Floor at Zero (Negative Net Salary Prevention)', () => {
    test('computeLivePayrollFigures floors recomputedNet at 0 when deductions exceed salary', async () => {
      const rowWithExcessiveDeductions = {
        id: 100,
        employee_id: 160,
        status: 'pending',
        week_start: '2026-08-08',
        week_end: '2026-08-14',
        month: 8,
        year: 2026,
        base_salary: 1000,
        snapshot_salary: 1000,
        snapshot_shift: 'morning',
        snapshot_shift_start: '09:00:00',
        snapshot_shift_end: '18:00:00',
        snapshot_weekend_days: '5',
        manual_bonus: 0,
        manual_deductions: 800,
        hr_bonus: 0,
        hr_penalty: 500, // Total manual/HR deductions = 1300 > 1000
        hr_overtime: 0,
        loan_deduction: 400,
      };

      const result = await computeLivePayrollFigures(rowWithExcessiveDeductions, null, basePolicy, [], []);
      expect(result.recomputedNet).toBe(0);
      expect(result.recomputedNet).toBeGreaterThanOrEqual(0);
    });
  });

  describe('2. Recalc Drift Suppression on Paid Records', () => {
    test('getPayroll sets has_recalc_drift = false for paid records even if recompute differs', async () => {
      const paidRecordWithDiscrepancy = {
        id: 3121,
        employee_id: 160,
        employee_name: 'أبو آدم',
        status: 'paid',
        week_start: '2026-08-08',
        week_end: '2026-08-14',
        month: 8,
        year: 2026,
        base_salary: '2500.00',
        bonus: '0.00',
        deductions: '2066.67',
        net_salary: '433.33', // Stored net
        snapshot_salary: '2500.00',
        snapshot_shift: 'morning',
        snapshot_shift_start: '09:00:00',
        snapshot_shift_end: '18:00:00',
        snapshot_weekend_days: '5',
        loan_deduction: '400.00',
        manual_bonus: '0.00',
        manual_deductions: '0.00',
        hr_bonus: '0.00',
        hr_penalty: '0.00',
        hr_overtime: '0.00',
      };

      payrollRepository.getPayrollRecordsCount.mockResolvedValue(1);
      payrollRepository.getPayrollRecords.mockResolvedValue([paidRecordWithDiscrepancy]);

      const res = await getPayroll({ weekStartInput: '2026-08-08' });
      expect(res.data).toHaveLength(1);
      const row = res.data[0];

      expect(row.status).toBe('paid');
      expect(row.net_salary).toBe(433.33);
      // Even if attendance would produce a different recompute, paid rows MUST NOT show drift
      expect(row.has_recalc_drift).toBe(false);
    });

    test('getPayroll sets has_recalc_drift = true for pending records if recompute differs', async () => {
      const pendingRecord = {
        id: 4001,
        employee_id: 200,
        employee_name: 'عامل تجريبي',
        status: 'pending',
        week_start: '2026-09-19',
        week_end: '2026-09-25',
        month: 9,
        year: 2026,
        base_salary: '2000.00',
        bonus: '0.00',
        deductions: '0.00',
        net_salary: '2000.00', // Stored net
        snapshot_salary: '2000.00',
        snapshot_shift: 'morning',
        snapshot_shift_start: '09:00:00',
        snapshot_shift_end: '18:00:00',
        snapshot_weekend_days: '5',
        loan_deduction: '0.00',
        manual_bonus: '0.00',
        manual_deductions: '0.00',
        hr_bonus: '0.00',
        hr_penalty: '500.00', // Unaccounted HR penalty causing recompute = 1500
        hr_overtime: '0.00',
      };

      payrollRepository.getPayrollRecordsCount.mockResolvedValue(1);
      payrollRepository.getPayrollRecords.mockResolvedValue([pendingRecord]);

      const res = await getPayroll({ weekStartInput: '2026-09-19' });
      expect(res.data).toHaveLength(1);
      const row = res.data[0];

      expect(row.status).toBe('pending');
      // For pending records, drift SHOULD be flagged to alert admin before paying
      expect(row.has_recalc_drift).toBe(true);
    });
  });

  describe('3. Period Locking on Bulk Generation', () => {
    test('generatePayroll blocks regenerating when all records for the week are already paid', async () => {
      payrollRepository.getPayrollRecordsForWeek.mockResolvedValue([
        { id: 1, employee_id: 10, status: 'paid' },
        { id: 2, employee_id: 11, status: 'paid' },
      ]);

      await expect(generatePayroll({ weekStartInput: '2026-08-08' })).rejects.toThrow(
        /already marked as paid and locked/
      );
    });

    test('generatePayroll blocks recalculating a single employee whose record is paid', async () => {
      payrollRepository.getPayrollRecordsForWeek.mockResolvedValue([
        { id: 1, employee_id: 10, status: 'paid' },
      ]);

      await expect(
        generatePayroll({ weekStartInput: '2026-08-08', employee_id: 10 })
      ).rejects.toThrow(/already marked as paid/);
    });
  });
});
