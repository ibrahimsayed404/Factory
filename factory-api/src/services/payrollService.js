const payrollRepository = require('../repositories/payrollRepository');
const accountingService = require('./accountingService');
const { getAttendancePayrollPolicy } = require('../utils/policySettings');
const ApiError = require('../utils/ApiError');

const round2 = (n) => Number(Number(n || 0).toFixed(2));

/**
 * Late weighting is applied per attendance day (not on the weekly total):
 * - day late ≤ 10 min → ×1 (e.g. Saturday 5 → 5)
 * - day late > 10 min → full day late ×1.5 (e.g. Sunday 40 → 60)
 * Example week: 5 + (40 * 1.5) = 65 charged minutes.
 */
const weightedLateMinutesForDay = (lateMinutes) => {
  const total = Math.max(0, Number(lateMinutes || 0));
  if (total <= 10) return total;
  return total * 1.5;
};

const sumWeightedLateMinutes = (attendanceRows = []) => (
  attendanceRows.reduce((sum, row) => sum + weightedLateMinutesForDay(row.late_minutes), 0)
);

/** Early leave (left before shift end): always ×1 — same rate as ≤10 late minutes. */
const earlyLeaveChargeMinutes = (earlyLeaveMinutes) => Math.max(0, Number(earlyLeaveMinutes || 0));

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
  const raw = String(weekendDays || process.env.PAYROLL_WEEKEND_DAYS || '5');
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

const getWeeklyWorkDays = (weekendSet) => {
  const weekDays = 7 - weekendSet.size;
  return weekDays > 0 ? weekDays : 5;
};

const getRates = (baseSalary, weekendSet, policy, useWeeklySalary) => {
  const dailyRate = useWeeklySalary
    ? baseSalary / getWeeklyWorkDays(weekendSet)
    : baseSalary / policy.workingDaysPerMonth;
  const minuteRate = dailyRate / (policy.workHoursPerDay * 60);
  return { dailyRate, minuteRate };
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
  const weekendDaysExpr = supportsWeekendDays ? "COALESCE(e.weekend_days, '5')" : "'5'";

  const total = await payrollRepository.getPayrollRecordsCount({ weekStart, month, year, status });
  const rows = await payrollRepository.getPayrollRecords({
    weekStart, month, year, status, limit: pageSize, offset, weekendDaysExpr, supportsWeekendDays
  });

  const policy = await getPayrollPolicy();
  const enriched = rows.map((row) => {
    const baseSalary = Number(row.base_salary || 0);
    const weekendSet = weekendSetFrom(row.weekend_days);
    const useWeeklySalary = Boolean(row.week_start);
    const { dailyRate, minuteRate } = getRates(baseSalary, weekendSet, policy, useWeeklySalary);
    // Prefer DB per-day weighted sum when present; never re-weight the weekly total.
    const lateWeighted = Number(row.late_weighted_minutes || 0);
    const earlyLeaveMinutes = earlyLeaveChargeMinutes(row.early_leave_minutes);

    const autoDeductions =
      ((lateWeighted + earlyLeaveMinutes) * minuteRate) +
      (Number(row.absent_days) * dailyRate) +
      (Number(row.half_days) * (dailyRate / 2));
    const weekendOvertimeMinutes = Number(row.weekend_overtime_minutes || 0);
    const regularOvertimeMinutes = Math.max(0, Number(row.overtime_minutes || 0) - weekendOvertimeMinutes);
    const autoBonus =
      (regularOvertimeMinutes * minuteRate * policy.overtimeMultiplier) +
      (weekendOvertimeMinutes * minuteRate * policy.vacationOvertimeMultiplier);

    const hrBonus = Number(row.hr_bonus || 0);
    const hrPenalty = Number(row.hr_penalty || 0);
    const hrOvertime = Number(row.hr_overtime || 0);
    const loanDeduction = Number(row.loan_deduction || 0);
    const computedAutoBonus = round2(autoBonus);
    const computedAutoDeductions = round2(autoDeductions);
    const storedManualBonus = Number(row.manual_bonus || 0);
    const storedManualDeductions = Number(row.manual_deductions || 0);
    // Always recompute auto_* from attendance so late-day weighting stays correct even
    // when older payroll rows were saved with weekly-total weighting.
    const displayBonus = round2(computedAutoBonus + storedManualBonus + hrBonus + hrOvertime);
    const displayDeductions = round2(computedAutoDeductions + storedManualDeductions + hrPenalty + loanDeduction);
    const displayNet = round2(baseSalary + displayBonus - displayDeductions);
    const weeklyPaymentEstimate = row.week_start
      ? displayNet
      : (displayNet / Math.max(1, policy.weeksPerMonth));

    return {
      ...row,
      bonus: displayBonus,
      deductions: displayDeductions,
      net_salary: displayNet,
      payroll_breakdown: {
        manual_bonus: round2(storedManualBonus),
        manual_deductions: round2(storedManualDeductions),
        auto_bonus: computedAutoBonus,
        auto_deductions: computedAutoDeductions,
        hr_bonus: hrBonus,
        hr_penalty: hrPenalty,
        hr_overtime_bonus: hrOvertime,
        loan_deduction: loanDeduction,
        late_minutes: Number(row.late_minutes),
        early_leave_minutes: earlyLeaveMinutes,
        overtime_minutes: Number(row.overtime_minutes),
        regular_overtime_minutes: regularOvertimeMinutes,
        weekend_overtime_minutes: weekendOvertimeMinutes,
        absent_days: Number(row.absent_days),
        half_days: Number(row.half_days),
        inferred_absent_days: Number(row.inferred_absent_days || 0),
        late_weighted_minutes: round2(lateWeighted),
        weekly_payment_estimate: round2(weeklyPaymentEstimate),
      },
    };
  });

  return { data: enriched, total, page: pageNum, limit: pageSize };
};

const calculatePayrollForEmployee = async (employee, options) => {
  const { weekStart, weekEnd, effectiveMonth, effectiveYear, manualBonus, manualDeductions, policy } = options;
  const base_salary = Number(employee.salary || 0);
  const weekendSet = weekendSetFrom(employee.weekend_days);
  const useWeeklySalary = Boolean(weekStart);
  const { dailyRate, minuteRate } = getRates(base_salary, weekendSet, policy, useWeeklySalary);

  const attendanceRecords = await payrollRepository.getAttendanceForPayroll(
    employee.id, weekStart, weekEnd, effectiveMonth, effectiveYear
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
  const lateWeighted = sumWeightedLateMinutes(attendanceRecords);
  const earlyLeaveMinutes = earlyLeaveChargeMinutes(totals.early_leave_minutes);

  const autoDeductions =
    ((lateWeighted + earlyLeaveMinutes) * minuteRate) +
    (absentDays * dailyRate) +
    (halfDays * (dailyRate / 2));
  const autoBonus =
    (regularOvertimeMinutes * minuteRate * policy.overtimeMultiplier) +
    (weekendOvertimeMinutes * minuteRate * policy.vacationOvertimeMultiplier);

  let hrBonus = 0;
  let hrPenalty = 0;
  let hrOvertime = 0;
  let loanDeduction = 0;
  let loans = [];

  if (useWeeklySalary) {
    const hrData = await payrollRepository.getHrDataForWeeklyPayroll(employee.id, weekStart, weekEnd);
    loans = hrData.loans;
    
    loanDeduction = loans.reduce(
      (sum, loan) => sum + Math.min(loan.monthly_installment, loan.remaining_amount),
      0
    );

    hrData.transactions.forEach(t => {
      if (t.transaction_type === 'bonus') hrBonus += Number(t.total_amount);
      if (t.transaction_type === 'penalty') hrPenalty += Number(t.total_amount);
      if (t.transaction_type === 'overtime') hrOvertime += Number(t.total_amount);
    });
  }

  const finalBonus = round2(autoBonus + manualBonus + hrBonus + hrOvertime);
  const finalDeductions = round2(autoDeductions + manualDeductions + hrPenalty + loanDeduction);
  const net_salary = round2(base_salary + finalBonus - finalDeductions);

  const savedRecord = await payrollRepository.upsertPayroll({
    employee_id: employee.id,
    effectiveMonth,
    effectiveYear,
    weekStart,
    weekEnd,
    base_salary,
    finalBonus,
    finalDeductions,
    net_salary,
    loan_deduction: loanDeduction,
    manual_bonus: manualBonus,
    manual_deductions: manualDeductions,
    auto_bonus: autoBonus,
    auto_deductions: autoDeductions,
    hr_bonus: hrBonus,
    hr_penalty: hrPenalty,
    hr_overtime: hrOvertime,
  });

  await accountingService.postPayrollAccrual(savedRecord);

  if (useWeeklySalary && loans.length) {
    const loanPayments = loans.map((loan) => ({
      id: loan.id,
      amount: Math.min(loan.monthly_installment, loan.remaining_amount),
    }));
    await payrollRepository.applyLoanPayments(loanPayments);
  }

  return {
    ...savedRecord,
    base_salary: Number(savedRecord.base_salary || 0),
    bonus: Number(savedRecord.bonus || 0),
    deductions: Number(savedRecord.deductions || 0),
    net_salary: Number(savedRecord.net_salary || 0),
    payroll_breakdown: {
      manual_bonus: round2(manualBonus),
      manual_deductions: round2(manualDeductions),
      hr_bonus: round2(hrBonus),
      hr_penalty: round2(hrPenalty),
      hr_overtime_bonus: round2(hrOvertime),
      loan_deduction: round2(loanDeduction),
      auto_bonus: round2(autoBonus),
      auto_deductions: round2(autoDeductions),
      late_minutes: Number(totals.late_minutes),
      late_weighted_minutes: round2(lateWeighted),
      early_leave_minutes: earlyLeaveMinutes,
      overtime_minutes: Number(totals.overtime_minutes),
      regular_overtime_minutes: regularOvertimeMinutes,
      weekend_overtime_minutes: weekendOvertimeMinutes,
      absent_days: absentDays,
      inferred_absent_days: inferredAbsentDays,
      half_days: halfDays,
      weekly_payment_estimate: round2(useWeeklySalary ? net_salary : (net_salary / Math.max(1, policy.weeksPerMonth))),
    },
  };
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
  let effectiveWeekStartDate = null;
  if (weekStartDate) {
    effectiveWeekStartDate = toSaturdayUtc(weekStartDate);
  } else if (!hasLegacyMonthYear) {
    effectiveWeekStartDate = currentWeekSaturdayUtc();
  }

  if (effectiveWeekStartDate) {
    weekStart = toIsoDate(effectiveWeekStartDate);
    const weekEndDate = new Date(effectiveWeekStartDate);
    weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 5);
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
  const employees = employee_id
    ? [await payrollRepository.getEmployeeForPayroll(employee_id, supportsWeekendDays)]
    : await payrollRepository.getActiveEmployeesForPayroll(supportsWeekendDays);

  if (employee_id && !employees[0]) throw new ApiError(404, 'Employee not found');

  const policy = await getPayrollPolicy();
  const payrollResults = [];

  for (const employee of employees) {
    if (!employee) continue;
    const result = await calculatePayrollForEmployee(employee, {
      weekStart,
      weekEnd,
      effectiveMonth,
      effectiveYear,
      manualBonus,
      manualDeductions,
      policy,
    });
    payrollResults.push(result);
  }

  return employee_id ? payrollResults[0] : payrollResults;
};

const markPaid = async (id) => {
  const result = await payrollRepository.updatePayrollPaid(id);
  if (!result) throw new ApiError(404, 'Record not found');
  await accountingService.postPayrollPayment(result);
  return result;
};

const updateManualAdjustments = async (id, data = {}) => {
  await payrollRepository.ensureWeeklyPayrollColumns();
  const record = await payrollRepository.getPayrollById(id);
  if (!record) throw new ApiError(404, 'Payroll record not found');
  if (record.status === 'paid') {
    throw new ApiError(400, 'Cannot adjust a paid payroll record');
  }

  const manualBonus = Math.max(0, Number(data.bonus ?? data.manual_bonus ?? 0));
  const manualDeductions = Math.max(0, Number(data.deductions ?? data.manual_deductions ?? 0));
  if (!Number.isFinite(manualBonus) || !Number.isFinite(manualDeductions)) {
    throw new ApiError(400, 'bonus and deductions must be numeric');
  }

  const supportsWeekendDays = await payrollRepository.hasWeekendDaysColumn();
  const employee = await payrollRepository.getEmployeeForPayroll(record.employee_id, supportsWeekendDays);
  if (!employee) throw new ApiError(404, 'Employee not found');

  const policy = await getPayrollPolicy();
  const weekendSet = weekendSetFrom(employee.weekend_days);
  const useWeeklySalary = Boolean(record.week_start);
  const asIsoDate = (value) => {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString().slice(0, 10);
    }
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value));
    return match ? match[1] : null;
  };
  const weekStart = asIsoDate(record.week_start);
  const weekEnd = asIsoDate(record.week_end) || weekStart;
  const { dailyRate, minuteRate } = getRates(Number(employee.salary || record.base_salary || 0), weekendSet, policy, useWeeklySalary);

  const attendanceRecords = await payrollRepository.getAttendanceForPayroll(
    record.employee_id,
    weekStart,
    weekEnd,
    record.month,
    record.year
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
  const weekendOvertimeMinutes = totals.weekend_overtime_minutes;
  const regularOvertimeMinutes = Math.max(0, totals.overtime_minutes - weekendOvertimeMinutes);
  const lateWeighted = sumWeightedLateMinutes(attendanceRecords);
  const earlyLeaveMinutes = earlyLeaveChargeMinutes(totals.early_leave_minutes);
  const absentDays = totals.absent_days + inferredAbsentDays;

  const autoDeductions = round2(
    ((lateWeighted + earlyLeaveMinutes) * minuteRate) +
    (absentDays * dailyRate) +
    (totals.half_days * (dailyRate / 2))
  );
  const autoBonus = round2(
    (regularOvertimeMinutes * minuteRate * policy.overtimeMultiplier) +
    (weekendOvertimeMinutes * minuteRate * policy.vacationOvertimeMultiplier)
  );

  const hrBonus = Number(record.hr_bonus || 0);
  const hrPenalty = Number(record.hr_penalty || 0);
  const hrOvertime = Number(record.hr_overtime || 0);
  const loanDeduction = Number(record.loan_deduction || 0);
  const baseSalary = Number(record.base_salary || 0);

  const finalBonus = round2(autoBonus + manualBonus + hrBonus + hrOvertime);
  const finalDeductions = round2(autoDeductions + manualDeductions + hrPenalty + loanDeduction);
  const netSalary = round2(baseSalary + finalBonus - finalDeductions);

  const saved = await payrollRepository.updateManualAdjustments(id, {
    manualBonus: round2(manualBonus),
    manualDeductions: round2(manualDeductions),
    autoBonus,
    autoDeductions,
    finalBonus,
    finalDeductions,
    netSalary,
  });

  return {
    ...saved,
    base_salary: Number(saved.base_salary || 0),
    bonus: Number(saved.bonus || 0),
    deductions: Number(saved.deductions || 0),
    net_salary: Number(saved.net_salary || 0),
    payroll_breakdown: {
      manual_bonus: round2(manualBonus),
      manual_deductions: round2(manualDeductions),
      auto_bonus: autoBonus,
      auto_deductions: autoDeductions,
      hr_bonus: round2(hrBonus),
      hr_penalty: round2(hrPenalty),
      hr_overtime_bonus: round2(hrOvertime),
      loan_deduction: round2(loanDeduction),
      late_minutes: totals.late_minutes,
      late_weighted_minutes: round2(lateWeighted),
      early_leave_minutes: earlyLeaveMinutes,
      weekly_payment_estimate: round2(saved.week_start ? netSalary : (netSalary / Math.max(1, policy.weeksPerMonth))),
    },
  };
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
  // `salary` stored on employee is weekly salary. Convert to monthly equivalent
  // when generating monthly payroll by multiplying weeksPerMonth.
  const monthlyBaseSalary = base_salary * Number(policy.weeksPerMonth || 4);
  const dailyRate = monthlyBaseSalary / policy.workingDaysPerMonth;
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
  const lateWeighted = sumWeightedLateMinutes(attendanceRecords);
  const earlyLeaveMinutes = earlyLeaveChargeMinutes(totals.early_leave_minutes);

  const autoDeductions =
    ((lateWeighted + earlyLeaveMinutes) * minuteRate) +
    (absentDays * dailyRate) +
    (halfDays * (dailyRate / 2));
    
  const autoBonus =
    (regularOvertimeMinutes * minuteRate * policy.overtimeMultiplier) +
    (weekendOvertimeMinutes * minuteRate * policy.vacationOvertimeMultiplier);

  // Get HR data (transactions and loans)
  const { transactions, loanDeduction, loans } = await payrollRepository.getHrDataForPayroll(employee_id, month, year);
  
  let hrBonus = 0;
  let hrPenalty = 0;
  let hrOvertime = 0;
  
  transactions.forEach(t => {
    if (t.transaction_type === 'bonus') hrBonus += Number(t.total_amount);
    if (t.transaction_type === 'penalty') hrPenalty += Number(t.total_amount);
    if (t.transaction_type === 'overtime') hrOvertime += Number(t.total_amount);
  });

  const finalBonus = round2(autoBonus + hrBonus + hrOvertime);
  const finalDeductions = round2(autoDeductions + hrPenalty + loanDeduction);
  // Net salary for the month: monthly equivalent of weekly salary plus bonuses minus deductions
  const net_salary = round2(monthlyBaseSalary + finalBonus - finalDeductions);

  const savedRecord = await payrollRepository.upsertPayroll({
    employee_id, effectiveMonth: month, effectiveYear: year, 
    weekStart: null, weekEnd: null,
    base_salary, finalBonus, finalDeductions, net_salary,
    loan_deduction: loanDeduction,
    manual_bonus: 0,
    manual_deductions: 0,
    auto_bonus: autoBonus,
    auto_deductions: autoDeductions,
    hr_bonus: hrBonus,
    hr_penalty: hrPenalty,
    hr_overtime: hrOvertime,
  });

  await accountingService.postPayrollAccrual(savedRecord);

  if (loans.length) {
    const loanPayments = loans.map((loan) => ({
      id: loan.id,
      amount: Math.min(loan.monthly_installment, loan.remaining_amount),
    }));
    await payrollRepository.applyLoanPayments(loanPayments);
  }

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
      early_leave_minutes: earlyLeaveMinutes,
      overtime_minutes: Number(totals.overtime_minutes),
      regular_overtime_minutes: regularOvertimeMinutes,
      weekend_overtime_minutes: weekendOvertimeMinutes,
      absent_days: absentDays,
      inferred_absent_days: inferredAbsentDays,
      half_days: halfDays,
    },
  };
};

const deletePayrollWeek = async (weekStartInput) => {
  await payrollRepository.ensureWeeklyPayrollColumns();
  const normalizedWeekStartDate = weekStartInput ? normalizeToUtcDate(weekStartInput) : null;
  if (weekStartInput && !normalizedWeekStartDate) {
    throw new ApiError(400, 'Invalid week_start date format');
  }
  if (!normalizedWeekStartDate) {
    throw new ApiError(400, 'week_start is required to delete weekly payroll');
  }

  const exactDate = toIsoDate(normalizedWeekStartDate);
  let records = await payrollRepository.getPayrollRecordsForWeek(exactDate);

  if (records.length === 0) {
    const saturdayDate = toIsoDate(toSaturdayUtc(normalizedWeekStartDate));
    records = await payrollRepository.getPayrollRecordsForWeek(saturdayDate);
  }

  for (const record of records) {
    if (record.status !== 'pending') {
      throw new ApiError(400, 'Cannot delete week payroll: some records are already marked as paid');
    }
  }

  for (const record of records) {
    // 1. Revert loan payments applied during generation
    const loans = await payrollRepository.getLoansForEmployee(record.employee_id);
    for (const loan of loans) {
      const restoreAmount = Math.min(loan.monthly_installment, loan.principal_amount - loan.remaining_amount);
      if (restoreAmount > 0) {
        await payrollRepository.restoreLoanPayment(loan.id, restoreAmount);
      }
    }

    // 2. Delete the payroll record
    await payrollRepository.deletePayrollRecord(record.id);
  }

  return { success: true, message: 'Payroll week deleted successfully' };
};

module.exports = {
  getPayroll,
  generatePayroll,
  generateMonthlyPayroll,
  markPaid,
  updateManualAdjustments,
  deletePayrollWeek,
};
