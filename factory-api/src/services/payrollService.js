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
 * NOTE: `late_minutes` here is already net of the configurable attendance grace
 * period (attendanceLateGraceMinutes) applied at logging time; this 10-minute
 * weighting threshold is an independent payroll rule, not the same grace period.
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

// Weekly payroll periods run Saturday → Friday (7 calendar days). The weekend day
// (Friday by default) IS included in the period so that work performed on the
// weekend day is captured for weekend-overtime detection.
const WEEK_LENGTH_DAYS = 6; // offset from Saturday to Friday inclusive

const nextUtcDay = (cursor) => new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate() + 1));

const weekendSetFrom = (weekendDays) => {
  const raw = String(weekendDays || process.env.PAYROLL_WEEKEND_DAYS || '5');
  return new Set(
    raw
      .split(',')
      .map((x) => Number(String(x).trim()))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
  );
};

const toIsoDateString = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value));
  return match ? match[1] : null;
};

const getPayrollPeriodRange = ({ weekStart, weekEnd, effectiveMonth, effectiveYear }) => {
  if (weekStart) {
    const start = toIsoDateString(weekStart);
    let end;
    if (weekEnd) {
      end = toIsoDateString(weekEnd);
    } else {
      const startDate = normalizeToUtcDate(start);
      const endDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate() + WEEK_LENGTH_DAYS));
      end = toIsoDate(endDate);
    }
    return { periodStart: start, periodEnd: end };
  } else if (effectiveMonth && effectiveYear) {
    const m = Number(effectiveMonth);
    const y = Number(effectiveYear);
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { periodStart: start, periodEnd: `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}` };
  }
  return { periodStart: null, periodEnd: null };
};

const getBusinessTodayIso = () => {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Africa/Cairo' });
};

/**
 * Build the set of dates covered by approved leave that should be EXCLUDED from
 * absence penalties. Unpaid leave is intentionally NOT excluded — an unpaid-leave
 * day is treated like an absence (the employee is not paid for it).
 */
const buildApprovedLeaveDatesSet = (leaveRows = []) => {
  const approvedSet = new Set();
  for (const row of leaveRows) {
    if (String(row.leave_type || '').toLowerCase() === 'unpaid') continue;
    const startStr = toIsoDateString(row.start_date);
    const endStr = toIsoDateString(row.end_date);
    if (!startStr || !endStr) continue;

    let cursor = normalizeToUtcDate(startStr);
    const endDate = normalizeToUtcDate(endStr);
    while (cursor <= endDate) {
      approvedSet.add(toIsoDate(cursor));
      cursor = nextUtcDay(cursor);
    }
  }
  return approvedSet;
};

const calculateInferredAbsentDays = (records = [], weekendSet, periodStart, periodEnd, employee = {}, approvedLeaveDates = new Set()) => {
  const startIso = toIsoDateString(periodStart);
  const periodEndIso = toIsoDateString(periodEnd);
  if (!startIso || !periodEndIso) return 0;

  // Cap end date at Egypt business date so future, unoccurred days in open periods are not marked absent
  const todayIso = getBusinessTodayIso();
  const endIso = (todayIso && periodEndIso > todayIso) ? todayIso : periodEndIso;

  const hireIso = toIsoDateString(employee?.hire_date);
  const terminationIso = toIsoDateString(employee?.termination_date);

  const recordedDates = new Set(
    records.map((r) => toIsoDateString(r.date)).filter(Boolean)
  );

  let inferred = 0;
  let cursor = normalizeToUtcDate(startIso);
  const endDate = normalizeToUtcDate(endIso);

  while (cursor <= endDate) {
    const dateStr = toIsoDate(cursor);
    const day = cursor.getUTCDay();

    const isWeekend = weekendSet.has(day);
    const hasRecord = recordedDates.has(dateStr);
    const beforeHire = hireIso ? dateStr < hireIso : false;
    const afterTermination = terminationIso ? dateStr > terminationIso : false;
    const isApprovedLeave = approvedLeaveDates ? approvedLeaveDates.has(dateStr) : false;

    if (!isWeekend && !hasRecord && !beforeHire && !afterTermination && !isApprovedLeave) {
      inferred += 1;
    }

    cursor = nextUtcDay(cursor);
  }

  return inferred;
};

const inferredAbsentDaysBetweenRecords = calculateInferredAbsentDays;

/**
 * Count working (non-weekend) days in [periodStart, periodEnd] and how many of
 * them the employee was actually employed for (between hire and termination).
 * Used to prorate base salary for partial weeks around hire/termination.
 */
const countEmployedWorkDays = (periodStart, periodEnd, weekendSet, employee = {}) => {
  const startIso = toIsoDateString(periodStart);
  const endIso = toIsoDateString(periodEnd);
  if (!startIso || !endIso) return { employed: 0, total: 0 };

  const hireIso = toIsoDateString(employee?.hire_date);
  const terminationIso = toIsoDateString(employee?.termination_date);

  let employed = 0;
  let total = 0;
  let cursor = normalizeToUtcDate(startIso);
  const endDate = normalizeToUtcDate(endIso);
  while (cursor <= endDate) {
    const day = cursor.getUTCDay();
    if (!weekendSet.has(day)) {
      total += 1;
      const dateStr = toIsoDate(cursor);
      const beforeHire = hireIso ? dateStr < hireIso : false;
      const afterTermination = terminationIso ? dateStr > terminationIso : false;
      if (!beforeHire && !afterTermination) employed += 1;
    }
    cursor = nextUtcDay(cursor);
  }
  return { employed, total };
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

const getPayroll = async ({ weekStartInput, month, year, status, dateFrom, dateTo, page, limit }) => {
  const normalizedWeekStartDate = weekStartInput ? normalizeToUtcDate(weekStartInput) : null;
  if (weekStartInput && !normalizedWeekStartDate) {
    throw new ApiError(400, 'Invalid week_start date format');
  }
  const weekStart = normalizedWeekStartDate ? toIsoDate(toSaturdayUtc(normalizedWeekStartDate)) : null;
  // Optional week_start range filter (bounds the fetch so the list never
  // silently truncates). Snap to the enclosing Saturday for consistency.
  const from = dateFrom && normalizeToUtcDate(dateFrom) ? toIsoDate(toSaturdayUtc(normalizeToUtcDate(dateFrom))) : null;
  const to = dateTo && normalizeToUtcDate(dateTo) ? toIsoDate(toSaturdayUtc(normalizeToUtcDate(dateTo))) : null;
  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const pageSize = Math.min(2000, Math.max(1, Number.parseInt(limit, 10) || 50));
  const offset = (pageNum - 1) * pageSize;

  const supportsWeekendDays = await payrollRepository.hasWeekendDaysColumn();
  const weekendDaysExpr = supportsWeekendDays ? "COALESCE(e.weekend_days, '5')" : "'5'";

  const total = await payrollRepository.getPayrollRecordsCount({ weekStart, month, year, status, dateFrom: from, dateTo: to });
  const rows = await payrollRepository.getPayrollRecords({
    weekStart, month, year, status, dateFrom: from, dateTo: to, limit: pageSize, offset, weekendDaysExpr, supportsWeekendDays
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

    const absentDays = Number(row.absent_days);
    const halfDays = Number(row.half_days);
    // Per-component dollar amounts, so each line in the breakdown/PDF is
    // transparent and independently verifiable (rather than one lumped total).
    const lateDeductionAmount = lateWeighted * minuteRate;
    const earlyLeaveDeductionAmount = earlyLeaveMinutes * minuteRate;
    const absentDeductionAmount = absentDays * dailyRate;
    const halfDayDeductionAmount = halfDays * (dailyRate / 2);
    const autoDeductions = lateDeductionAmount + earlyLeaveDeductionAmount + absentDeductionAmount + halfDayDeductionAmount;
    const weekendOvertimeMinutes = Number(row.weekend_overtime_minutes || 0);
    const regularOvertimeMinutes = Math.max(0, Number(row.overtime_minutes || 0) - weekendOvertimeMinutes);
    const regularOvertimeAmount = regularOvertimeMinutes * minuteRate * policy.overtimeMultiplier;
    const weekendOvertimeAmount = weekendOvertimeMinutes * minuteRate * policy.vacationOvertimeMultiplier;
    const autoBonus = regularOvertimeAmount + weekendOvertimeAmount;

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
    const recomputedBonus = round2(computedAutoBonus + storedManualBonus + hrBonus + hrOvertime);
    const recomputedDeductions = round2(computedAutoDeductions + storedManualDeductions + hrPenalty + loanDeduction);
    const recomputedNet = round2(baseSalary + recomputedBonus - recomputedDeductions);

    // For PAID records the frozen stored figures are authoritative (they were
    // journaled to accounting). Show those, but flag any drift vs. a fresh
    // recompute so the admin can spot attendance edited after payment.
    const isPaid = row.status === 'paid';
    const storedNet = round2(Number(row.net_salary || 0));
    const hasRecalcDrift = isPaid && Math.abs(recomputedNet - storedNet) >= 0.01;
    const displayBonus = isPaid ? round2(Number(row.bonus || 0)) : recomputedBonus;
    const displayDeductions = isPaid ? round2(Number(row.deductions || 0)) : recomputedDeductions;
    const displayNet = isPaid ? storedNet : recomputedNet;
    const weeklyPaymentEstimate = row.week_start
      ? displayNet
      : (displayNet / Math.max(1, policy.weeksPerMonth));

    return {
      ...row,
      bonus: displayBonus,
      deductions: displayDeductions,
      net_salary: displayNet,
      recomputed_net_salary: recomputedNet,
      has_recalc_drift: hasRecalcDrift,
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
        absent_days: absentDays,
        half_days: halfDays,
        inferred_absent_days: Number(row.inferred_absent_days || 0),
        late_weighted_minutes: round2(lateWeighted),
        // Per-component dollar amounts (for a transparent, verifiable breakdown).
        late_deduction: round2(lateDeductionAmount),
        early_leave_deduction: round2(earlyLeaveDeductionAmount),
        absent_deduction: round2(absentDeductionAmount),
        half_day_deduction: round2(halfDayDeductionAmount),
        regular_overtime_bonus: round2(regularOvertimeAmount),
        weekend_overtime_bonus: round2(weekendOvertimeAmount),
        weekly_payment_estimate: round2(weeklyPaymentEstimate),
      },
    };
  });

  return { data: enriched, total, page: pageNum, limit: pageSize };
};

const calculatePayrollForEmployee = async (employee, options) => {
  const { weekStart, weekEnd, effectiveMonth, effectiveYear, manualBonus, manualDeductions, policy } = options;
  const fullBaseSalary = Number(employee.salary || 0);
  const weekendSet = weekendSetFrom(employee.weekend_days);
  const useWeeklySalary = Boolean(weekStart);
  const { dailyRate, minuteRate } = getRates(fullBaseSalary, weekendSet, policy, useWeeklySalary);

  const attendanceRecords = await payrollRepository.getAttendanceForPayroll(
    employee.id, weekStart, weekEnd, effectiveMonth, effectiveYear
  );

  const { periodStart, periodEnd } = getPayrollPeriodRange({ weekStart, weekEnd, effectiveMonth, effectiveYear });
  const leaveRows = await payrollRepository.getApprovedLeavesForPayroll(employee.id, periodStart, periodEnd);
  const approvedLeaveDates = buildApprovedLeaveDatesSet(leaveRows);

  // Prorate base salary for partial employment (hire/termination mid-period).
  const { employed, total } = countEmployedWorkDays(periodStart, periodEnd, weekendSet, employee);
  const base_salary = (useWeeklySalary && total > 0 && employed < total)
    ? round2(fullBaseSalary * (employed / total))
    : fullBaseSalary;

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

  const inferredAbsentDays = calculateInferredAbsentDays(
    attendanceRecords,
    weekendSet,
    periodStart,
    periodEnd,
    employee,
    approvedLeaveDates
  );

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
  // Loan payments that still need to be applied to hr_loans for this payroll
  // record (i.e. not yet recorded in the payroll_loan_deductions ledger).
  let loanPaymentsToApply = [];

  if (useWeeklySalary) {
    const hrData = await payrollRepository.getHrDataForWeeklyPayroll(employee.id, weekStart, weekEnd);
    const activeLoans = hrData.loans;
    // Prorate the monthly installment across the weeks in a month so a full
    // installment is not deducted every single week.
    const weeksPerMonth = Math.max(1, Number(policy.weeksPerMonth || 4));

    // Reconcile against what has already been deducted for this exact payroll
    // record so regeneration never double-charges a loan.
    const existingPayrollId = await payrollRepository.getPayrollIdByWeek(employee.id, weekStart);
    const existingLedger = existingPayrollId
      ? await payrollRepository.getLoanDeductionsForPayroll(existingPayrollId)
      : [];
    const ledgerByLoan = new Map(existingLedger.map((r) => [Number(r.loan_id), Number(r.amount)]));

    const activeLoanIds = new Set();
    for (const loan of activeLoans) {
      activeLoanIds.add(loan.id);
      if (ledgerByLoan.has(loan.id)) {
        // Already deducted for this record — keep the same amount, do not re-apply.
        loanDeduction += ledgerByLoan.get(loan.id);
      } else {
        const installment = round2(Number(loan.monthly_installment || 0) / weeksPerMonth);
        const amount = round2(Math.min(installment, Number(loan.remaining_amount || 0)));
        if (amount > 0) {
          loanDeduction += amount;
          loanPaymentsToApply.push({ id: loan.id, amount });
        }
      }
    }
    // Ledger entries for loans already closed by this record's earlier run still
    // count toward this record's loan_deduction.
    for (const [loanId, amount] of ledgerByLoan) {
      if (!activeLoanIds.has(loanId)) loanDeduction += amount;
    }
    loanDeduction = round2(loanDeduction);

    hrData.transactions.forEach((t) => {
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

  // Apply loan payments idempotently: the ledger uniqueness constraint on
  // (payroll_id, loan_id) guarantees a loan is only ever debited once per record.
  if (useWeeklySalary && loanPaymentsToApply.length) {
    await payrollRepository.applyLoanDeductions(savedRecord.id, loanPaymentsToApply);
  }

  // Post/reconcile the accounting accrual (adjusts the ledger if net_salary changed
  // on regeneration instead of silently keeping the stale amount).
  await accountingService.reconcilePayrollAccrual(savedRecord);

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
  const { employee_id, week_start: weekStartInput, bonus = 0, deductions = 0 } = data;
  // Manual bonus/deductions are clamped non-negative (a negative here would
  // silently invert into the opposite adjustment).
  const manualBonus = Math.max(0, Number(bonus || 0));
  const manualDeductions = Math.max(0, Number(deductions || 0));

  const weekStartDate = weekStartInput ? normalizeToUtcDate(weekStartInput) : null;
  if (weekStartInput && !weekStartDate) {
    throw new ApiError(400, 'Invalid week_start date format');
  }

  const effectiveWeekStartDate = weekStartDate ? toSaturdayUtc(weekStartDate) : currentWeekSaturdayUtc();
  const weekStart = toIsoDate(effectiveWeekStartDate);
  const weekEndDate = new Date(effectiveWeekStartDate);
  weekEndDate.setUTCDate(weekEndDate.getUTCDate() + WEEK_LENGTH_DAYS);
  const weekEnd = toIsoDate(weekEndDate);
  const effectiveMonth = effectiveWeekStartDate.getUTCMonth() + 1;
  const effectiveYear = effectiveWeekStartDate.getUTCFullYear();

  const supportsWeekendDays = await payrollRepository.hasWeekendDaysColumn();
  const policy = await getPayrollPolicy();

  const commonOptions = { weekStart, weekEnd, effectiveMonth, effectiveYear, manualBonus, manualDeductions, policy };

  if (employee_id) {
    const employee = await payrollRepository.getEmployeeForPayroll(employee_id, supportsWeekendDays);
    if (!employee) throw new ApiError(404, 'Employee not found');
    return calculatePayrollForEmployee(employee, commonOptions);
  }

  // Bulk generation for all active employees: never fail the whole batch because
  // one employee errored — collect per-employee outcomes so the caller can see
  // exactly which succeeded and which failed.
  const employees = await payrollRepository.getActiveEmployeesForPayroll(supportsWeekendDays);
  const generated = [];
  const failed = [];
  for (const employee of employees) {
    if (!employee) continue;
    try {
      generated.push(await calculatePayrollForEmployee(employee, commonOptions));
    } catch (err) {
      failed.push({ employee_id: employee.id, error: err?.message || 'Unknown error' });
    }
  }
  return { generated, failed, week_start: weekStart };
};

const markPaid = async (id) => {
  const result = await payrollRepository.updatePayrollPaid(id);
  if (!result) throw new ApiError(404, 'Record not found');
  await accountingService.postPayrollPayment(result);
  return result;
};

const updateManualAdjustments = async (id, data = {}) => {
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

  // Use the canonical period range (timezone-safe, correct Sat→Fri length) for
  // both the attendance query and the inferred-absence/leave window.
  const { periodStart, periodEnd } = getPayrollPeriodRange({
    weekStart: record.week_start,
    weekEnd: record.week_end,
    effectiveMonth: record.month,
    effectiveYear: record.year,
  });
  const weekStart = record.week_start ? periodStart : null;
  const weekEnd = record.week_start ? periodEnd : null;
  const { dailyRate, minuteRate } = getRates(Number(employee.salary || record.base_salary || 0), weekendSet, policy, useWeeklySalary);

  const attendanceRecords = await payrollRepository.getAttendanceForPayroll(
    record.employee_id,
    weekStart,
    weekEnd,
    record.month,
    record.year
  );

  const leaveRows = await payrollRepository.getApprovedLeavesForPayroll(record.employee_id, periodStart, periodEnd);
  const approvedLeaveDates = buildApprovedLeaveDatesSet(leaveRows);

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

  const inferredAbsentDays = calculateInferredAbsentDays(
    attendanceRecords,
    weekendSet,
    periodStart,
    periodEnd,
    employee,
    approvedLeaveDates
  );
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

  // Keep the accounting accrual in sync with the adjusted net salary.
  await accountingService.reconcilePayrollAccrual(saved);

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

const deletePayrollWeek = async (weekStartInput) => {
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

  // Reverse the exact loan amounts recorded in the ledger for each record, then
  // delete the records — all within a single transaction. The ledger rows are
  // removed automatically via ON DELETE CASCADE.
  await payrollRepository.reverseLoanDeductionsAndDeleteRecords(records.map((r) => r.id));

  return { success: true, message: 'Payroll week deleted successfully', deleted: records.length };
};

module.exports = {
  getPayroll,
  generatePayroll,
  markPaid,
  updateManualAdjustments,
  deletePayrollWeek,
  calculateInferredAbsentDays,
  countEmployedWorkDays,
  buildApprovedLeaveDatesSet,
};
