const weightedLateMinutesForDay = (lateMinutes) => {
  const total = Math.max(0, Number(lateMinutes || 0));
  if (total <= 10) return total;
  return total * 1.5;
};

const sumWeightedLateMinutes = (attendanceRows = []) => (
  attendanceRows.reduce((sum, row) => sum + weightedLateMinutesForDay(row.late_minutes), 0)
);

const earlyLeaveChargeMinutes = (earlyLeaveMinutes) => Math.max(0, Number(earlyLeaveMinutes || 0));

describe('per-day late weighting', () => {
  test('keeps days <= 10 at x1 and days > 10 at x1.5', () => {
    // Saturday 5 + Sunday 40 => 5 + (40 * 1.5) = 65
    expect(sumWeightedLateMinutes([
      { late_minutes: 5 },
      { late_minutes: 40 },
    ])).toBe(65);
  });

  test('does not weight the weekly total as one block', () => {
    // Old bug: (5+40)=45 > 10 => 45 * 1.5 = 67.5
    expect(weightedLateMinutesForDay(45)).toBe(67.5);
    expect(sumWeightedLateMinutes([
      { late_minutes: 5 },
      { late_minutes: 40 },
    ])).not.toBe(67.5);
  });

  test('weights each heavy day independently', () => {
    // two days of 20 => 30 + 30 = 60 (not 40 * 1.5 = 60 coincidentally same, use 15+20)
    expect(sumWeightedLateMinutes([
      { late_minutes: 15 },
      { late_minutes: 20 },
    ])).toBe(15 * 1.5 + 20 * 1.5);
  });

  test('early leave is always charged at x1 multiplier', () => {
    expect(earlyLeaveChargeMinutes(30)).toBe(30);
    expect(earlyLeaveChargeMinutes(60)).toBe(60);
    expect(earlyLeaveChargeMinutes(0)).toBe(0);
  });
});
