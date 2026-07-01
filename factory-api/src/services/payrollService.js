const payrollRepository = require('../repositories/payrollRepository');
const accountingService = require('./accountingService');
const { getAttendancePayrollPolicy } = require('../utils/policySettings');
const ApiError = require('../utils/ApiError');

const round2 = (n) => Number(Number(n || 0).toFixed(2));

const weightedLateMinutes = (lateMinutes) => {
  const total = Math.max(0, Number(lateMinutes || 0));
  const firstBand = Math.min(15, total);
  const secondBand = Math.max(0, total - 15);
  return firstBand + (secondBand * 1.5);
};

const normalizeToUtcDate = (value) => {
  const text = String(value || '').slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
};

const toSaturdayUtc = (date) => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const diffToSaturday = (d.getUTCDay() - 6 + 7) % 7;
  d.setUTCDate(d.getUTCDate() - diffToSaturday);
  return d;
};

const currentWeekSaturdayUtc = () => toSaturdayUtc(new Date());

const toIsoDate = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

const weekendSetFrom = (weekendDays) => {
  const raw = String(weekendDays || process.env.PAYROLL_WEEKEND_DAYS || '0,6');
  return new Set(
    raw
      .split(',')
      .map((x) => Number(String(x).trim()))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
  );
};

const inferredAbsentDaysBetweenRecords = (records, weekendSet) => {
  if (!records.length) return 0;

  const sorted = [...records].sort((a, b) => new Date(a.date) - new Date(b.date));
  const start = new Date(`${sorted[0].date}T00:00:00Z`);
  const end = new Date(`${sorted.at(-1).date}T00:00:00Z`);
  const recorded = new Set(sorted.map((r) => String(r.date)));

  let inferred = 0;
  let cursor = new Date(start);
  while (cursor <= end) {
    const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}-${String(cursor.getUTCDate()).padStart(2, '0')}`;
    const day = cursor.getUTCDay();
    if (!weekendSet.has(day) && !recorded.has(key)) inferred += 1;
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate() + 1));
  }
  return inferred;
};

const isWeekendAttendanceDate = (dateValue, weekendSet) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue || '').slice(0, 10));
  if (!match) return false;
  const day = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay();
  return weekendSet.has(day);
};

const getPayrollPolicy = async () => {
  const settings = await getAttendancePayrollPolicy();

  return {
    workHoursPerDay: Number(process.env.PAYROLL_WORK_HOURS_PER_DAY || 8),
    workingDaysPerMonth: Number(process.env.PAYROLL_WORKING_DAYS_PER_MONTH || 30),
    overtimeMultiplier: Number(settings.payrollOvertimeMultiplier || 1.5),
    vacationOvertimeMultiplier: Number(settings.payrollVacationOvertimeMultiplier || 1),
    weeksPerMonth: Number(settings.payrollWeeksPerMonth || 4),
  };
};

const getPayroll = async ({ weekStartInput, month, year, status, page, limit }) => {
  await payrollRepository.ensureWeeklyPayrollColumns();
  
  const normalizedWeekStartDate = weekStartInput ? normalizeToUtcDate(weekStartInput) : null;
  if (weekStartInput && !normalizedWeekStartDate) {
    throw new ApiError(400, 'Invalid week_start date format');
  }
  const weekStart = normalizedWeekStartDate ? toIsoDate(toSaturdayUtc(normalizedWeekStartDate)) : null;
  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const pageSize = Math.min(1000, Math.max(1, Number.parseInt(limit, 10) || 50));
  const offset = (pageNum - 1) * pageSize;
  
  const supportsWeekendDays = await payrollRepository.hasWeekendDaysColumn();
  const weekendDaysExpr = supportsWeekendDays ? "COALESCE(e.weekend_days, '0,6')" : "'0,6'";

  const total = await payrollRepository.getPayrollRecordsCount({ weekStart, month, year, status });
  const rows = await payrollRepository.getPayrollRecords({
    weekStart, month, year, status, limit: pageSize, offset, weekendDaysExpr
  });

  const policy = await getPayrollPolicy();
  const enriched = rows.map((row) => {
    const baseSalary = Number(row.base_salary || 0);
    const dailyRate = baseSalary / policy.workingDaysPerMonth;
    const minuteRate = dailyRate / (policy.workHoursPerDay * 60);
    const lateWeighted = weightedLateMinutes(row.late_minutes);

    const autoDeductions =
      ((lateWeighted + Number(row.early_leave_minutes)) * minuteRate) +
      (Number(row.absent_days) * dailyRate) +
      (Number(row.half_days) * (dailyRate / 2));
    const weekendOvertimeMinutes = Number(row.weekend_overtime_minutes || 0);
    const regularOvertimeMinutes = Math.max(0, Number(row.overtime_minutes || 0) - weekendOvertimeMinutes);
    const autoBonus =
      (regularOvertimeMinutes * minuteRate * policy.overtimeMultiplier) +
      (weekendOvertimeMinutes * minuteRate * policy.vacationOvertimeMultiplier);

    const finalBonus = Number(row.bonus || 0);
    const finalDeductions = Number(row.deductions || 0);
    const weeklyPaymentEstimate = Number(row.net_salary || 0) / Math.max(1, policy.weeksPerMonth);

    return {
      ...row,
      payroll_breakdown: {
        manual_bonus: round2(finalBonus - autoBonus),
        manual_deductions: round2(finalDeductions - autoDeductions),
        auto_bonus: round2(autoBonus),
        auto_deductions: round2(autoDeductions),
        late_minutes: Number(row.late_minutes),
        early_leave_minutes: Number(row.early_leave_minutes),
        overtime_minutes: Number(row.overtime_minutes),
        regular_overtime_minutes: regularOvertimeMinutes,
        weekend_overtime_minutes: weekendOvertimeMinutes,
        absent_days: Number(row.absent_days),
        half_days: Number(row.half_days),
        late_weighted_minutes: round2(lateWeighted),
        weekly_payment_estimate: round2(weeklyPaymentEstimate),
      },
    };
  });

  return { data: enriched, total, page: pageNum, limit: pageSize };
};

const generatePayroll = async (data) => {
  await payrollRepository.ensureWeeklyPayrollColumns();
  const { employee_id, week_start: weekStartInput, month: monthInput, year: yearInput, bonus = 0, deductions = 0 } = data;
  const manualBonus = Number(bonus || 0);
  const manualDeductions = Number(deductions || 0);

  const weekStartDate = weekStartInput ? normalizeToUtcDate(weekStartInput) : null;
  if (weekStartInput && !weekStartDate) {
    throw new ApiError(400, 'Invalid week_start date format');
  }

  let effectiveMonth;
  let effectiveYear;
  let weekStart;
  let weekEnd;

  const hasLegacyMonthYear = monthInput !== undefined && yearInput !== undefined;
  const effectiveWeekStartDate = weekStartDate
    ? toSaturdayUtc(weekStartDate)
    : (!hasLegacyMonthYear ? currentWeekSaturdayUtc() : null);

  if (effectiveWeekStartDate) {
    weekStart = toIsoDate(effectiveWeekStartDate);
    const weekEndDate = new Date(effectiveWeekStartDate);
    weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6);
    weekEnd = toIsoDate(weekEndDate);
    effectiveMonth = effectiveWeekStartDate.getUTCMonth() + 1;
    effectiveYear = effectiveWeekStartDate.getUTCFullYear();
  } else {
    effectiveMonth = Number(monthInput);
    effectiveYear = Number(yearInput);
    weekStart = null;
    weekEnd = null;
  }

  const supportsWeekendDays = await payrollRepository.hasWeekendDaysColumn();
  const emp = await payrollRepository.getEmployeeForPayroll(employee_id, supportsWeekendDays);
  if (!emp) throw new ApiError(404, 'Employee not found');

  const base_salary = Number(emp.salary || 0);
  const policy = await getPayrollPolicy();
  const dailyRate = base_salary / policy.workingDaysPerMonth;
  const minuteRate = dailyRate / (policy.workHoursPerDay * 60);
  const weekendSet = weekendSetFrom(emp.weekend_days);

  const attendanceRecords = await payrollRepository.getAttendanceForPayroll(
    employee_id, weekStart, weekEnd, effectiveMonth, effectiveYear
  );

  const totals = attendanceRecords.reduce((acc, row) => ({
    late_minutes: acc.late_minutes + Number(row.late_minutes || 0),
    early_leave_minutes: acc.early_leave_minutes + Number(row.early_leave_minutes || 0),
    overtime_minutes: acc.overtime_minutes + Number(row.overtime_minutes || 0),
    weekend_overtime_minutes: acc.weekend_overtime_minutes + (isWeekendAttendanceDate(row.date, weekendSet) ? Number(row.overtime_minutes || 0) : 0),
    absent_days: acc.absent_days + Number(row.absent_days || 0),
    half_days: acc.half_days + Number(row.half_days || 0),
  }), {
    late_minutes: 0, early_leave_minutes: 0, overtime_minutes: 0,
    weekend_overtime_minutes: 0, absent_days: 0, half_days: 0,
  });

  const inferredAbsentDays = inferredAbsentDaysBetweenRecords(attendanceRecords, weekendSet);

  const overtimeMinutes = totals.overtime_minutes;
  const weekendOvertimeMinutes = totals.weekend_overtime_minutes;
  const regularOvertimeMinutes = Math.max(0, overtimeMinutes - weekendOvertimeMinutes);
  const absentDays = totals.absent_days + inferredAbsentDays;
  const halfDays = totals.half_days;
  const lateWeighted = weightedLateMinutes(totals.late_minutes);

  const autoDeductions =
    ((lateWeighted + totals.early_leave_minutes) * minuteRate) +
    (absentDays * dailyRate) +
    (halfDays * (dailyRate / 2));
  const autoBonus =
    (regularOvertimeMinutes * minuteRate * policy.overtimeMultiplier) +
    (weekendOvertimeMinutes * minuteRate * policy.vacationOvertimeMultiplier);

  const finalBonus = round2(autoBonus + manualBonus);
  const finalDeductions = round2(autoDeductions + manualDeductions);
  const net_salary = round2(base_salary + finalBonus - finalDeductions);

  const savedRecord = await payrollRepository.upsertPayroll({
    employee_id, effectiveMonth, effectiveYear, weekStart, weekEnd,
    base_salary, finalBonus, finalDeductions, net_salary
  });

  await accountingService.postPayrollAccrual(savedRecord);

  return {
    ...savedRecord,
    base_salary: Number(savedRecord.base_salary || 0),
    bonus: Number(savedRecord.bonus || 0),
    deductions: Number(savedRecord.deductions || 0),
    net_salary: Number(savedRecord.net_salary || 0),
    payroll_breakdown: {
      manual_bonus: round2(manualBonus),
      manual_deductions: round2(manualDeductions),
      auto_bonus: round2(autoBonus),
      auto_deductions: round2(autoDeductions),
      late_minutes: Number(totals.late_minutes),
      late_weighted_minutes: round2(lateWeighted),
      early_leave_minutes: Number(totals.early_leave_minutes),
      overtime_minutes: Number(totals.overtime_minutes),
      regular_overtime_minutes: regularOvertimeMinutes,
      weekend_overtime_minutes: weekendOvertimeMinutes,
      absent_days: absentDays,
      inferred_absent_days: inferredAbsentDays,
      half_days: halfDays,
      weekly_payment_estimate: round2(net_salary / Math.max(1, policy.weeksPerMonth)),
    },
  };
};

const markPaid = async (id) => {
  const result = await payrollRepository.updatePayrollPaid(id);
  if (!result) throw new ApiError(404, 'Record not found');
  await accountingService.postPayrollPayment(result);
  return result;
};

const generateMonthlyPayroll = async (data) => {
  const { employee_id, month, year } = data;
  
  if (!month || !year || !employee_id) {
    throw new ApiError(400, 'month, year, and employee_id are required');
  }

  const supportsWeekendDays = await payrollRepository.hasWeekendDaysColumn();
  const emp = await payrollRepository.getEmployeeForPayroll(employee_id, supportsWeekendDays);
  if (!emp) throw new ApiError(404, 'Employee not found');

  const base_salary = Number(emp.salary || 0);
  const policy = await getPayrollPolicy();
  const dailyRate = base_salary / policy.workingDaysPerMonth;
  const minuteRate = dailyRate / (policy.workHoursPerDay * 60);
  const weekendSet = weekendSetFrom(emp.weekend_days);

  const attendanceRecords = await payrollRepository.getAttendanceForPayroll(
    employee_id, null, null, month, year
  );

  const totals = attendanceRecords.reduce((acc, row) => ({
    late_minutes: acc.late_minutes + Number(row.late_minutes || 0),
    early_leave_minutes: acc.early_leave_minutes + Number(row.early_leave_minutes || 0),
    overtime_minutes: acc.overtime_minutes + Number(row.overtime_minutes || 0),
    weekend_overtime_minutes: acc.weekend_overtime_minutes + (isWeekendAttendanceDate(row.date, weekendSet) ? Number(row.overtime_minutes || 0) : 0),
    absent_days: acc.absent_days + Number(row.absent_days || 0),
    half_days: acc.half_days + Number(row.half_days || 0),
  }), {
    late_minutes: 0, early_leave_minutes: 0, overtime_minutes: 0,
    weekend_overtime_minutes: 0, absent_days: 0, half_days: 0,
  });

  const inferredAbsentDays = inferredAbsentDaysBetweenRecords(attendanceRecords, weekendSet);

  const overtimeMinutes = totals.overtime_minutes;
  const weekendOvertimeMinutes = totals.weekend_overtime_minutes;
  const regularOvertimeMinutes = Math.max(0, overtimeMinutes - weekendOvertimeMinutes);
  const absentDays = totals.absent_days + inferredAbsentDays;
  const halfDays = totals.half_days;
  const lateWeighted = weightedLateMinutes(totals.late_minutes);

  const autoDeductions =
    ((lateWeighted + totals.early_leave_minutes) * minuteRate) +
    (absentDays * dailyRate) +
    (halfDays * (dailyRate / 2));
    
  const autoBonus =
    (regularOvertimeMinutes * minuteRate * policy.overtimeMultiplier) +
    (weekendOvertimeMinutes * minuteRate * policy.vacationOvertimeMultiplier);

  // Get HR data (transactions and loans)
  const hrData = await payrollRepository.getHrDataForPayroll(employee_id, month, year);
  
  let hrBonus = 0;
  let hrPenalty = 0;
  let hrOvertime = 0;
  
  hrData.transactions.forEach(t => {
    if (t.transaction_type === 'bonus') hrBonus += Number(t.total_amount);
    if (t.transaction_type === 'penalty') hrPenalty += Number(t.total_amount);
    if (t.transaction_type === 'overtime') hrOvertime += Number(t.total_amount);
  });
  
  const loanDeduction = hrData.loanDeduction;

  const finalBonus = round2(autoBonus + hrBonus + hrOvertime);
  const finalDeductions = round2(autoDeductions + hrPenalty + loanDeduction);
  const net_salary = round2(base_salary + finalBonus - finalDeductions);

  const savedRecord = await payrollRepository.upsertPayroll({
    employee_id, effectiveMonth: month, effectiveYear: year, 
    weekStart: null, weekEnd: null,
    base_salary, finalBonus, finalDeductions, net_salary
  });

  await accountingService.postPayrollAccrual(savedRecord);

  return {
    ...savedRecord,
    base_salary: Number(savedRecord.base_salary || 0),
    bonus: Number(savedRecord.bonus || 0),
    deductions: Number(savedRecord.deductions || 0),
    net_salary: Number(savedRecord.net_salary || 0),
    payroll_breakdown: {
      hr_bonus: round2(hrBonus),
      hr_penalty: round2(hrPenalty),
      hr_overtime_bonus: round2(hrOvertime),
      loan_deduction: round2(loanDeduction),
      auto_bonus: round2(autoBonus),
      auto_deductions: round2(autoDeductions),
      late_minutes: Number(totals.late_minutes),
      late_weighted_minutes: round2(lateWeighted),
      early_leave_minutes: Number(totals.early_leave_minutes),
      overtime_minutes: Number(totals.overtime_minutes),
      regular_overtime_minutes: regularOvertimeMinutes,
      weekend_overtime_minutes: weekendOvertimeMinutes,
      absent_days: absentDays,
      inferred_absent_days: inferredAbsentDays,
      half_days: halfDays,
    },
  };
};

module.exports = {
  getPayroll,
  generatePayroll,
  generateMonthlyPayroll,
  markPaid,
};
