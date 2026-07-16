import { groupPayrollByWeek } from '../utils/payrollGrouping';

describe('groupPayrollByWeek', () => {
  it('groups payroll rows by their week start and keeps the newest week first', () => {
    const rows = [
      { id: 1, week_start: '2026-06-13', employee_name: 'A', net_salary: 1000 },
      { id: 2, week_start: '2026-06-20', employee_name: 'B', net_salary: 1100 },
      { id: 3, week_start: '2026-06-13', employee_name: 'C', net_salary: 1200 },
    ];

    const groups = groupPayrollByWeek(rows);

    expect(groups).toHaveLength(2);
    expect(groups[0].weekStart).toBe('2026-06-20');
    expect(groups[0].records).toHaveLength(1);
    expect(groups[1].records).toHaveLength(2);
    expect(groups[1].employeeCount).toBe(2);
  });
});
