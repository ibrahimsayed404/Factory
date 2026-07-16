export const groupPayrollByWeek = (rows = []) => {
  const groups = new Map();

  for (const row of rows) {
    const weekStart = row.week_start || 'monthly';
    if (!groups.has(weekStart)) {
      groups.set(weekStart, []);
    }
    groups.get(weekStart).push(row);
  }

  return Array.from(groups.entries())
    .map(([weekStart, records]) => ({
      weekStart,
      weekEnd: records.find((r) => r.week_end)?.week_end || null,
      weekLabel: weekStart === 'monthly' ? 'Monthly' : weekStart,
      records,
      employeeCount: records.length,
      totalNet: records.reduce((sum, row) => sum + Number(row.net_salary || 0), 0),
      paidCount: records.filter((row) => row.status === 'paid').length,
    }))
    .sort((a, b) => {
      if (a.weekStart === 'monthly') return 1;
      if (b.weekStart === 'monthly') return -1;
      return a.weekStart < b.weekStart ? 1 : -1;
    });
};
