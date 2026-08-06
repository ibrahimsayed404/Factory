const pool = require('../../src/db/pool');
const {
  runAutoCheckoutShiftBased,
  runAutoAbsence12PM,
  minutesToTimeString,
} = require('../../src/services/autoAttendanceScheduler');

jest.mock('../../src/db/pool', () => ({
  query: jest.fn(),
}));

jest.mock('../../src/utils/policySettings', () => ({
  getAttendancePayrollPolicy: jest.fn().mockResolvedValue({
    attendanceLateGraceMinutes: 10,
    attendanceOvertimeGraceMinutes: 15,
  }),
}));

describe('autoAttendanceScheduler Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('minutesToTimeString helper', () => {
    test('converts minutes to HH:MM format properly', () => {
      expect(minutesToTimeString(540)).toBe('09:00');
      expect(minutesToTimeString(1020)).toBe('17:00');
      expect(minutesToTimeString(1080)).toBe('18:00');
      expect(minutesToTimeString(0)).toBe('00:00');
      expect(minutesToTimeString(null)).toBeNull();
    });
  });

  describe('runAutoCheckoutShiftBased', () => {
    test('1. Does NOT auto-checkout 8am-5pm shift before 1-hour grace buffer (at 5:59 PM)', async () => {
      // 8:00 AM - 5:00 PM shift (shift_end = 17:00 / 1020 min). Trigger is 1020 + 60 = 1080 min (6:00 PM).
      // Override time: 17:59 (1079 minutes).
      const mockOverrideDate = new Date('2026-08-06T17:59:00+03:00');

      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            employee_id: 10,
            date: '2026-08-06',
            check_in: '08:00',
            notes: null,
            shift: 'morning',
            shift_start: '08:00',
            shift_end: '17:00',
            weekend_days: '5',
          },
        ],
      });

      const updatedCount = await runAutoCheckoutShiftBased(mockOverrideDate);
      expect(updatedCount).toBe(0);
      expect(pool.query).toHaveBeenCalledTimes(1); // Only initial SELECT query
    });

    test('2. Auto-checkouts 8am-5pm shift AFTER 1-hour grace buffer (at 6:01 PM)', async () => {
      // Override time: 18:01 (1081 minutes >= 1080 trigger).
      const mockOverrideDate = new Date('2026-08-06T18:01:00+03:00');

      pool.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              employee_id: 10,
              date: '2026-08-06',
              check_in: '08:00',
              notes: null,
              shift: 'morning',
              shift_start: '08:00',
              shift_end: '17:00',
              weekend_days: '5',
            },
          ],
        })
        .mockResolvedValueOnce({ rowCount: 1 }); // UPDATE query

      const updatedCount = await runAutoCheckoutShiftBased(mockOverrideDate);
      expect(updatedCount).toBe(1);
      expect(pool.query).toHaveBeenCalledTimes(2);

      const updateCallArgs = pool.query.mock.calls[1][1];
      expect(updateCallArgs[0]).toBe('17:00'); // check_out set to shift end
      expect(updateCallArgs[5]).toBe('present'); // status
      expect(updateCallArgs[6]).toContain('Auto-checked out at shift end (17:00)');
    });

    test('3. Does NOT auto-checkout 9am-6pm shift at 6:30 PM, but auto-checkouts at 7:01 PM', async () => {
      // 9:00 AM - 6:00 PM shift (shift_end = 18:00 / 1080 min). Trigger is 1080 + 60 = 1140 min (7:00 PM).

      // Test at 18:30 (1110 minutes < 1140 trigger)
      const mockDate630PM = new Date('2026-08-06T18:30:00+03:00');
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 2,
            employee_id: 11,
            date: '2026-08-06',
            check_in: '09:00',
            notes: null,
            shift: 'morning',
            shift_start: '09:00',
            shift_end: '18:00',
            weekend_days: '5',
          },
        ],
      });
      const count630 = await runAutoCheckoutShiftBased(mockDate630PM);
      expect(count630).toBe(0);

      // Test at 19:01 (1141 minutes >= 1140 trigger)
      const mockDate701PM = new Date('2026-08-06T19:01:00+03:00');
      pool.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 2,
              employee_id: 11,
              date: '2026-08-06',
              check_in: '09:00',
              notes: null,
              shift: 'morning',
              shift_start: '09:00',
              shift_end: '18:00',
              weekend_days: '5',
            },
          ],
        })
        .mockResolvedValueOnce({ rowCount: 1 });

      const count701 = await runAutoCheckoutShiftBased(mockDate701PM);
      expect(count701).toBe(1);
    });
  });

  describe('runAutoAbsence12PM', () => {
    test('1. Skips execution if time is before 12:00 PM (e.g. 11:30 AM)', async () => {
      const mockDate1130AM = new Date('2026-08-06T11:30:00+03:00');
      const insertedCount = await runAutoAbsence12PM(mockDate1130AM);

      expect(insertedCount).toBe(0);
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('2. Marks unpunched active employees absent at/after 12:00 PM', async () => {
      // Thursday 2026-08-06 (not a weekend day for Friday-weekend employee)
      const mockDate1205PM = new Date('2026-08-06T12:05:00+03:00');

      pool.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 20,
              name: 'Employee 20',
              hire_date: '2026-01-01',
              termination_date: null,
              weekend_days: '5', // Friday
              shift: 'morning',
              shift_start: '09:00',
              shift_end: '17:00',
            },
          ],
        })
        .mockResolvedValueOnce({ rowCount: 1 }); // INSERT query

      const insertedCount = await runAutoAbsence12PM(mockDate1205PM);
      expect(insertedCount).toBe(1);
      expect(pool.query).toHaveBeenCalledTimes(2);

      const insertQueryStr = pool.query.mock.calls[1][0];
      const insertCallArgs = pool.query.mock.calls[1][1];
      expect(insertCallArgs[0]).toBe('2026-08-06');
      expect(insertCallArgs[1]).toEqual([20]);
      expect(insertQueryStr).toContain("'absent'");
      expect(insertQueryStr).toContain('Auto-marked absent at 12:00 PM');
    });

    test('3. Skips marking absent if today is employee weekend day', async () => {
      // Friday 2026-08-07 (weekend day 5 for employee)
      const mockDateFriday1205PM = new Date('2026-08-07T12:05:00+03:00');

      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 21,
            name: 'Employee 21',
            hire_date: '2026-01-01',
            termination_date: null,
            weekend_days: '5', // Friday
            shift: 'morning',
            shift_start: '09:00',
            shift_end: '17:00',
          },
        ],
      });

      const insertedCount = await runAutoAbsence12PM(mockDateFriday1205PM);
      expect(insertedCount).toBe(0);
      expect(pool.query).toHaveBeenCalledTimes(1); // Only candidates query, no INSERT call
    });
  });
});
