import React, { useMemo, useState } from 'react';
import { payrollApi } from './payroll.api';
import { useFetch } from '../../hooks/useFetch';
import { PageHeader, Card, Table, Badge, Btn, Modal, Input, Spinner, ErrorMsg } from '../../components/ui';
import { useLanguage } from '../../context/LanguageContext';
import { groupPayrollByWeek } from './payrollGrouping';
import { formatMinutes, formatCurrency } from './payrollFormat';

// Weekly payroll periods run Saturday → Friday (7 days inclusive).
const WEEK_LENGTH_DAYS = 6;

const getCurrentWeekStartIso = () => {
  const now = new Date();
  const day = now.getDay();
  const diffToSaturday = (day - 6 + 7) % 7;
  const saturday = new Date(now);
  saturday.setDate(now.getDate() - diffToSaturday);
  saturday.setHours(0, 0, 0, 0);
  const y = saturday.getFullYear();
  const m = String(saturday.getMonth() + 1).padStart(2, '0');
  const d = String(saturday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Parse an ISO date string or Date object to a local-midnight Date object,
 * timezone-safely. The API now serializes payroll dates as plain YYYY-MM-DD, but
 * we still defensively extract the calendar date from any ISO-with-time string
 * (rather than `new Date(str)`, which parses the trailing Z as UTC and can shift
 * the day on negative-offset clients).
 */
const parseLocalDate = (dateVal) => {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return dateVal;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateVal));
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return null;
};

const normalizeToSaturdayIso = (isoDate) => {
  if (!isoDate) return getCurrentWeekStartIso();
  const d = parseLocalDate(isoDate);
  if (!d || Number.isNaN(d.getTime())) return getCurrentWeekStartIso();
  const day = d.getDay();
  const diffToSaturday = (day - 6 + 7) % 7;
  d.setDate(d.getDate() - diffToSaturday);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dayPart = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dayPart}`;
};

const addDaysIso = (isoDate, days) => {
  const d = parseLocalDate(isoDate);
  if (!d) return '';
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getLocalDateString = (dateVal) => {
  const d = parseLocalDate(dateVal);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Day name keys indexed by JS getDay() (0=Sunday, 6=Saturday) */
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Formats a week interval like: "from Saturday to Friday from 4/7 to 10/7"
 */
const formatWeekInterval = (weekStart, weekEnd, t) => {
  const startDate = parseLocalDate(weekStart);
  const endDate = parseLocalDate(weekEnd || (weekStart ? addDaysIso(weekStart, WEEK_LENGTH_DAYS) : null));
  if (!startDate) return weekStart || '—';

  const startDay = startDate.getDate();
  const startMonth = startDate.getMonth() + 1;
  const startDayName = t(DAY_KEYS[startDate.getDay()], DAY_KEYS[startDate.getDay()]);

  if (!endDate) return `${startDayName} (${startDay}/${startMonth})`;

  const endDay = endDate.getDate();
  const endMonth = endDate.getMonth() + 1;
  const endDayName = t(DAY_KEYS[endDate.getDay()], DAY_KEYS[endDate.getDay()]);

  return `${t('from', 'from')} ${startDayName} ${t('to', 'to')} ${endDayName} ${t('from', 'from')} ${startDay}/${startMonth} ${t('to', 'to')} ${endDay}/${endMonth}`;
};

let reportExportModules;
const loadReportExportModules = async () => {
  if (!reportExportModules) {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    reportExportModules = { jsPDF, autoTable };
  }
  return reportExportModules;
};

// Default the visible window to roughly the last 12 weeks, bounded so the fetch
// never silently truncates. Users can widen the range via the filter bar.
const defaultDateFrom = () => addDaysIso(getCurrentWeekStartIso(), -7 * 12);

export default function Payroll() {
  const { t, language } = useLanguage();

  const [filters, setFilters] = useState({
    from: defaultDateFrom(),
    to: getCurrentWeekStartIso(),
    status: '',      // '', 'pending', 'paid'
    employee: '',    // client-side name search
  });

  const buildQuery = () => {
    const params = new URLSearchParams({ limit: '2000' });
    if (filters.from) params.set('date_from', filters.from);
    if (filters.to) params.set('date_to', filters.to);
    if (filters.status) params.set('status', filters.status);
    return `?${params.toString()}`;
  };

  const { data: payrollPage, loading, error, refetch } = useFetch(
    () => payrollApi.listPaged(buildQuery()),
    [filters.from, filters.to, filters.status]
  );
  const records = payrollPage?.data || [];
  const truncated = payrollPage ? payrollPage.total > records.length : false;

  const [showModal, setShowModal] = useState(false);
  const [selectedBreakdown, setSelectedBreakdown] = useState(null);
  const [selectedWeekStart, setSelectedWeekStart] = useState(null);
  const [form, setForm] = useState({ week_start: getCurrentWeekStartIso() });
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionNotice, setActionNotice] = useState('');

  // Adjust modal state
  const [adjustTarget, setAdjustTarget] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ bonus: '0', deductions: '0' });
  const [adjustSaving, setAdjustSaving] = useState(false);
  const [adjustError, setAdjustError] = useState('');

  const handleGenerate = async () => {
    if (!form.week_start) {
      setActionError(t('selectWeekStart', 'Please select a week start date.'));
      return;
    }
    const normalizedWeekStart = normalizeToSaturdayIso(form.week_start);
    if (!normalizedWeekStart) {
      setActionError(t('selectWeekStart', 'Please select a valid week start date.'));
      return;
    }
    setSaving(true);
    setActionError('');
    setActionNotice('');
    try {
      const result = await payrollApi.create({ week_start: normalizedWeekStart });
      setShowModal(false);
      // Bulk generation returns { generated, failed }. Surface any per-employee
      // failures instead of silently succeeding.
      const failed = Array.isArray(result?.failed) ? result.failed : [];
      if (failed.length > 0) {
        setActionError(
          t('payrollPartialFail', 'Payroll generated with some failures')
          + `: ${failed.length} employee(s) failed.`
        );
      } else {
        const count = Array.isArray(result?.generated) ? result.generated.length : null;
        setActionNotice(count !== null
          ? `${t('payrollGenerated', 'Payroll generated for')} ${count} ${t('employees', 'employees')}.`
          : t('payrollGeneratedOk', 'Payroll generated.'));
      }
    } catch (e) {
      setActionError(e.message || t('payrollGenerateFailed', 'Failed to generate payroll.'));
    } finally {
      // Always refetch so partial successes become visible regardless of outcome.
      await refetch({ silent: true });
      setSaving(false);
    }
  };

  const handlePay = async (id) => {
    if (!globalThis.window.confirm(t('markAsPaid', 'Mark as paid?'))) return;
    setActionError('');
    try {
      await payrollApi.pay(id);
      await refetch({ silent: true });
    } catch (e) {
      setActionError(e.message || t('payrollPayFailed', 'Failed to mark payroll as paid.'));
    }
  };

  const handlePayWeek = async (weekStart) => {
    if (!globalThis.window.confirm(t('confirmPayEntireWeek', 'هل أنت متأكد من اعتماد وصرف رواتب هذا الأسبوع بالكامل؟ سيتم إغلاق الأسبوع وترحيل المصروفات للتقارير واللوحة الرئيسية.'))) return;
    setSaving(true);
    setActionError('');
    try {
      const normalizedWeekStart = getLocalDateString(weekStart);
      await payrollApi.payWeek(normalizedWeekStart);
      await refetch({ silent: true });
    } catch (e) {
      setActionError(e.message || t('payrollPayWeekFailed', 'Failed to mark week as paid.'));
    } finally {
      setSaving(false);
    }
  };

  const openAdjustModal = (row) => {
    setAdjustTarget(row);
    const bd = row.payroll_breakdown || {};
    setAdjustForm({
      bonus: String(bd.manual_bonus ?? row.manual_bonus ?? 0),
      deductions: String(bd.manual_deductions ?? row.manual_deductions ?? 0),
    });
    setAdjustError('');
  };

  const handleAdjust = async (overrides = null) => {
    if (!adjustTarget?.id) return;
    setAdjustSaving(true);
    setAdjustError('');
    try {
      const bonusValue = overrides?.bonus !== undefined ? overrides.bonus : adjustForm.bonus;
      const deductionsValue = overrides?.deductions !== undefined ? overrides.deductions : adjustForm.deductions;
      await payrollApi.updateManual(adjustTarget.id, {
        bonus: Number(bonusValue || 0),
        deductions: Number(deductionsValue || 0),
      });
      setAdjustTarget(null);
      await refetch({ silent: true });
    } catch (e) {
      setAdjustError(e.message || t('failedAdjustPayroll', 'Failed to adjust payroll.'));
    } finally { setAdjustSaving(false); }
  };

  const handleClearManual = async () => {
    if (!adjustTarget?.id) return;
    if (!globalThis.window.confirm(t('confirmClearManual', 'Clear manual bonus and deductions for this employee?'))) return;
    setAdjustForm({ bonus: '0', deductions: '0' });
    await handleAdjust({ bonus: 0, deductions: 0 });
  };

  const handleDeleteWeek = async (weekStart) => {
    if (!globalThis.window.confirm(t('confirmDeleteWeekPayroll', "Are you sure you want to delete this week's payroll? This will also revert any loan deductions applied for this week."))) return;
    setSaving(true);
    setActionError('');
    try {
      const normalizedWeekStart = getLocalDateString(weekStart);
      await payrollApi.deleteWeek(normalizedWeekStart);
      setSelectedWeekStart(null);
      await refetch({ silent: true });
    } catch (e) {
      setActionError(e.message || t('payrollDeleteFailed', 'Failed to delete payroll week.'));
    } finally {
      setSaving(false);
    }
  };

  const handleExportPDF = async () => {
    if (!selectedWeek) return;
    const isAr = language === 'ar';
    const direction = isAr ? 'rtl' : 'ltr';
    const weekLabel = formatWeekInterval(selectedWeek.weekStart === 'monthly' ? null : selectedWeek.weekStart, selectedWeek.weekEnd, t);

    const { printHtmlDocument } = await import('../../utils/printDocument');

    // Only render rows that carry a value — zero/empty rows are omitted so the
    // breakdown shows just what actually affected this employee's pay.
    const renderBreakdownRow = (label, amount, { positive = false } = {}) => {
      const sign = positive ? '+' : '-';
      const color = positive ? '#0f6e56' : '#b91c1c';
      return `<div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f1f5f9;"><span>${label}</span><strong style="color:${color}">${sign}${formatCurrency(amount)}</strong></div>`;
    };
    const renderPlainRow = (label, value) => (
      `<div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f1f5f9;"><span>${label}</span><strong>${value}</strong></div>`
    );

    const employeeBreakdowns = sortedRecords.map(row => {
      const b = row.payroll_breakdown || {};
      const rows = [];
      // Base salary always shows (the anchor of the calculation).
      rows.push(renderPlainRow(t('base', 'Base salary'), formatCurrency(row.base_salary)));

      // Deductions — each shown only when non-zero, with its detail in the label.
      if (b.late_deduction > 0) rows.push(renderBreakdownRow(`${t('lateDeduction', 'Late')} (${formatMinutes(b.late_minutes)} → ${formatMinutes(b.late_weighted_minutes)} ${t('weighted', 'weighted')})`, b.late_deduction));
      if (b.early_leave_deduction > 0) rows.push(renderBreakdownRow(`${t('earlyLeave', 'Early leave')} (${formatMinutes(b.early_leave_minutes)})`, b.early_leave_deduction));
      const totalAbsent = b.absent_days || 0;
      if (b.absent_deduction > 0) rows.push(renderBreakdownRow(`${t('absent', 'Absent')} (${totalAbsent} ${t('days', 'day(s)')})`, b.absent_deduction));
      if (b.half_day_deduction > 0) rows.push(renderBreakdownRow(`${t('halfDay', 'Half day')} (${b.half_days})`, b.half_day_deduction));
      if (b.hr_penalty > 0) rows.push(renderBreakdownRow(t('hrPenalty', 'HR penalty'), b.hr_penalty));
      if (b.manual_deductions > 0) rows.push(renderBreakdownRow(t('manualDeductions', 'Manual deduction'), b.manual_deductions));
      if (b.loan_deduction > 0) rows.push(renderBreakdownRow(t('loanDeduction', 'Loan deduction'), b.loan_deduction));

      // Bonuses — each shown only when non-zero.
      if (b.regular_overtime_bonus > 0) rows.push(renderBreakdownRow(`${t('regularOvertime', 'Overtime')} (${formatMinutes(b.regular_overtime_minutes)} → ${formatMinutes(b.regular_overtime_weighted_minutes ?? b.regular_overtime_minutes)} ${t('weighted', 'weighted')})`, b.regular_overtime_bonus, { positive: true }));
      if (b.weekend_overtime_bonus > 0) rows.push(renderBreakdownRow(`${t('weekendWorkOvertime', 'Weekend overtime')} (${formatMinutes(b.weekend_overtime_minutes)} → ${formatMinutes(b.weekend_overtime_weighted_minutes ?? b.weekend_overtime_minutes)} ${t('weighted', 'weighted')})`, b.weekend_overtime_bonus, { positive: true }));
      if (b.hr_bonus > 0) rows.push(renderBreakdownRow(t('hrBonus', 'HR bonus'), b.hr_bonus, { positive: true }));
      if (b.hr_overtime_bonus > 0) rows.push(renderBreakdownRow(t('hrOvertime', 'HR overtime bonus'), b.hr_overtime_bonus, { positive: true }));
      if (b.manual_bonus > 0) rows.push(renderBreakdownRow(t('manualBonus', 'Manual bonus'), b.manual_bonus, { positive: true }));

      const fieldsHtml = rows.join('');

      const statusClass = row.status === 'paid' ? 'paid' : 'pending';
      const statusLabel = row.status === 'paid' ? t('paid', 'Paid') : t('pending', 'Pending');

      return `
        <div style="page-break-inside: avoid; margin-bottom: 20px; padding: 16px 18px; border: 1px solid #cbd5e1; border-radius: 8px; background: #ffffff;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #0f172a;">
            <div>
              <div style="font-size: 16px; font-weight: 800; color: #0f172a;">${row.employee_name || '—'}</div>
              <div style="font-size: 12px; color: #475569; font-weight: 600; margin-top: 2px;">${row.department_name || '—'} · ${row.role || '—'}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 18px; font-weight: 900; color: #15803d;">${formatCurrency(row.net_salary)}</div>
              <div style="font-size: 11px; color: #64748b; font-weight: 600;">${t('netSalary', 'Net salary')}</div>
              <span class="badge ${statusClass}" style="margin-top: 4px;">${statusLabel}</span>
            </div>
          </div>
          ${fieldsHtml}
          ${row.week_start ? `<div style="margin-top: 8px; font-size: 11px; color: #64748b; font-weight: 600;">الأسبوع المالي: ${formatWeekInterval(row.week_start, row.week_end, t)}</div>` : ''}
        </div>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html lang="${isAr ? 'ar' : 'en'}" dir="${direction}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${t('payroll', 'Payroll')} — ${weekLabel}</title>
        <style>
          @page { size: A4 portrait; margin: 10mm 12mm; }
          * { box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
            margin: 0;
            padding: 10px 14px;
            color: #0f172a;
            background: #fff;
            direction: ${direction};
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .header-banner {
            background: #0f172a;
            color: #ffffff;
            padding: 18px 24px;
            border-radius: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
          }
          .header-banner h1 {
            font-size: 19px;
            margin: 0;
            font-weight: 900;
            letter-spacing: -0.01em;
          }
          .header-banner .meta {
            color: #94a3b8;
            font-size: 11px;
            margin-top: 3px;
          }
          .title-section {
            margin-bottom: 18px;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 10px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .title-section h2 {
            font-size: 22px;
            margin: 0;
            color: #0f172a;
            font-weight: 900;
          }
          .metrics-container {
            display: flex;
            gap: 14px;
            margin-bottom: 24px;
          }
          .metric-card {
            flex: 1;
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-top: 3px solid #2563eb;
            border-radius: 8px;
            padding: 12px 16px;
          }
          .metric-card .label {
            font-size: 11px;
            color: #64748b;
            font-weight: 700;
            margin-bottom: 4px;
            text-transform: uppercase;
          }
          .metric-card .val {
            font-size: 18px;
            font-weight: 900;
            color: #0f172a;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          th, td {
            padding: 9px 12px;
            text-align: ${isAr ? 'right' : 'left'};
            font-size: 12px;
            border-bottom: 1px solid #e2e8f0;
          }
          th {
            background: #0f172a;
            color: #fff;
            font-weight: 700;
          }
          tr:nth-child(even) {
            background: #f8fafc;
          }
          .num {
            text-align: right;
            font-weight: 700;
          }
          .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 700;
          }
          .badge.paid {
            background: #dcfce7;
            color: #15803d;
          }
          .badge.pending {
            background: #fef9c3;
            color: #a16207;
          }
          .signatures {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 16px;
            margin-top: 28px;
            padding-top: 18px;
            border-top: 2px dashed #cbd5e1;
            text-align: center;
          }
          .sign-box {
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px 14px;
            background: #f8fafc;
          }
          .sign-box.stamp {
            background: #fff;
            border: 1px solid #cbd5e1;
          }
          .sign-title {
            font-size: 11px;
            font-weight: 800;
            color: #0f172a;
            margin-bottom: 35px;
          }
          .sign-line {
            border-top: 1px dashed #94a3b8;
            padding-top: 6px;
            font-size: 11px;
            color: #475569;
          }
          .stamp-badge {
            display: inline-block;
            border: 2px solid #2563eb;
            border-radius: 50%;
            padding: 4px 8px;
            color: #2563eb;
            font-size: 9px;
            font-weight: 900;
            margin: 4px auto 6px;
            transform: rotate(-3deg);
          }
          @media print {
            body { margin: 0; padding: 0; }
            .header-banner {
              background: #0f172a !important;
              color: #fff !important;
            }
            th {
              background: #0f172a !important;
              color: #fff !important;
            }
            .metric-card {
              background: #f8fafc !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="header-banner">
          <div>
            <h1>مصنع بلاك فوكس للملابس الجاهزة — BLACK FOX</h1>
            <div class="meta">كشف الرواتب الأسبوعي ومستحقات العاملين المعتمدة</div>
          </div>
          <div style="text-align: ${isAr ? 'left' : 'right'}; font-size: 11px; color: #94a3b8;">
            <div>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</div>
            <div style="font-family: monospace; color: #38bdf8; margin-top: 2px;">DOC: BF-PAYROLL-${selectedWeek.weekStart || 'W'}</div>
          </div>
        </div>
        <div class="title-section">
          <div>
            <h2>${t('payroll', 'Payroll')}</h2>
            <div style="font-size: 13px; color: #475569; font-weight: 600; margin-top: 2px;">فترة التشغيل: ${weekLabel}</div>
          </div>
          <div style="font-size: 12px; color: #2563eb; font-weight: 700; background: #eff6ff; padding: 4px 12px; border-radius: 6px;">
            كشف رواتب معتمد
          </div>
        </div>
        <div class="metrics-container">
          <div class="metric-card">
            <div class="label">${t('employees', 'Employees')}</div>
            <div class="val">${selectedWeek.employeeCount} موظف</div>
          </div>
          <div class="metric-card">
            <div class="label">${t('totalNet', 'Total Net')}</div>
            <div class="val" style="color:#15803d">${formatCurrency(selectedWeek.totalNet)}</div>
          </div>
          <div class="metric-card">
            <div class="label">${t('status', 'Status')}</div>
            <div class="val">${selectedWeek.paidCount}/${selectedWeek.employeeCount} ${t('paid', 'paid')}</div>
          </div>
        </div>

        <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-right:4px solid #16a34a; border-radius:6px; padding:10px 14px; margin-bottom:20px; font-size:11.5px; color:#166534; line-height:1.5;">
          <div style="font-weight:800; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
            <span>📘</span> معادلة وضوابط احتساب صافي الراتب المستحق:
          </div>
          <div style="margin-bottom:4px;">
            <strong>المعادلة:</strong> <code>الراتب الأساسي + (بدل الإضافي المحتسب + مكافآت الإدارة) - (خصم التأخير المرجح + خصم الغياب + قسط السلفة + جزاءات الجودة) = صافي الراتب المستحق</code>
          </div>
          <div style="font-size:10.5px; color:#475569;">
            * ملاحظة: يتم احتساب دقائق التأخير والإضافي بناءً على الأوزان المعتمدة في لائحة الحضور. استقطاعات السلف تخصم تلقائياً من المستحق الأسبوعي.
          </div>
        </div>

        ${employeeBreakdowns}

        <div class="signatures">
          <div class="sign-box">
            <div class="sign-title">المحاسب المسؤول</div>
            <div class="sign-line">التوقيع: .......................................</div>
          </div>
          <div class="sign-box">
            <div class="sign-title">المدير المالي والرقابة</div>
            <div class="sign-line">التوقيع: .......................................</div>
          </div>
          <div class="sign-box stamp">
            <div class="sign-title">اعتماد الإدارة العامة</div>
            <div class="stamp-badge">BLACK FOX APPROVED</div>
            <div class="sign-line">الختم والتاريخ المعتمد</div>
          </div>
        </div>

        <div style="margin-top: 20px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 8px; display: flex; justify-content: space-between;">
          <span>Black Fox Clothing Factory Management</span>
          <span>وثيقة رواتب رسمية — سرية ومحمية</span>
        </div>
      </body>
      </html>
    `;

    const ok = printHtmlDocument(html, { title: 'payroll-print' });
    if (!ok) {
      setActionError(t('payrollExportFailed', 'Failed to export payroll to PDF.'));
    }
  };

  // Client-side employee-name / status filtering over the (date-bounded) fetched
  // set. Empty weeks are dropped so the week list only shows matching records.
  const filteredRecords = useMemo(() => {
    const term = filters.employee.trim().toLowerCase();
    if (!term && !filters.status) return records;
    return records.filter((r) => {
      const matchesName = !term || String(r.employee_name || '').toLowerCase().includes(term);
      const matchesStatus = !filters.status || r.status === filters.status;
      return matchesName && matchesStatus;
    });
  }, [records, filters.employee, filters.status]);

  const groupedPayroll = useMemo(() => groupPayrollByWeek(filteredRecords || []), [filteredRecords]);
  console.log('DEBUG groupedPayroll:', groupedPayroll.map(g => ({ weekStart: g.weekStart, count: g.employeeCount, total: g.totalNet })));
  console.log('DEBUG filteredRecords count:', filteredRecords?.length);
  console.log('DEBUG week-2026-07-25 sum from filteredRecords:', (filteredRecords || []).filter(r => r.week_start === '2026-07-25').reduce((s, r) => s + Number(r.net_salary || 0), 0));
  const selectedWeek = useMemo(
    () => groupedPayroll.find((group) => group.weekStart === selectedWeekStart) || null,
    [groupedPayroll, selectedWeekStart]
  );

  const sortedRecords = useMemo(() => {
    if (!selectedWeek || !selectedWeek.records) return [];
    return [...selectedWeek.records].sort((a, b) => {
      const deptA = a.department_name || '';
      const deptB = b.department_name || '';
      if (deptA !== deptB) {
        return deptA.localeCompare(deptB, undefined, { sensitivity: 'base' });
      }
      const nameA = a.employee_name || '';
      const nameB = b.employee_name || '';
      return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
    });
  }, [selectedWeek]);

  const columns = [
    { key: 'employee_name', label: t('employee', 'Employee') },
    { key: 'department_name', label: t('department', 'Department'), render: v => v || '—' },
    { key: 'week_start', label: t('week', 'Week'), render: (_, row) => {
      return formatWeekInterval(row.week_start, row.week_end, t);
    } },
    { key: 'role', label: t('role', 'Role'), render: v => v || '—' },
    { key: 'base_salary', label: t('base', 'Base'), render: v => formatCurrency(v) },
    { key: 'bonus', label: t('bonus', 'Bonus'), render: v => v > 0 ? <span style={{ color: 'var(--accent)' }}>+{formatCurrency(v)}</span> : '—' },
    { key: 'deductions', label: t('deductions', 'Deductions'), render: v => v > 0 ? <span style={{ color: 'var(--danger)' }}>-{formatCurrency(v)}</span> : '—' },
    { key: 'net_salary', label: t('netSalary', 'Net salary'), render: (v, row) => (
      <strong title={row.status !== 'paid' && row.has_recalc_drift ? t('recalcDriftHint', 'Recalculated total differs from the paid amount') : undefined}>
        {formatCurrency(v)}{row.status !== 'paid' && row.has_recalc_drift ? ' ⚠️' : ''}
      </strong>
    ) },
    { key: 'weekly_payment_estimate', label: t('weeklyPay', 'Weekly Pay'), render: (_, row) => formatCurrency(row.payroll_breakdown?.weekly_payment_estimate || 0) },
    { key: 'payroll_breakdown', label: t('breakdown', 'Breakdown'), render: (_, row) => (
      <Btn size="sm" onClick={() => setSelectedBreakdown(row)}>{t('view', 'View')}</Btn>
    )},
    { key: 'status', label: t('status', 'Status'), render: v => <Badge variant={v === 'paid' ? 'success' : 'warning'}>{v}</Badge> },
    { key: 'actions', label: '', render: (_, row) => row.status === 'pending' && (
      <div style={{ display: 'flex', gap: 6 }}>
        <Btn size="sm" onClick={() => openAdjustModal(row)}>{t('adjust', 'Adjust')}</Btn>
        <Btn size="sm" variant="primary" onClick={() => handlePay(row.id)}>{t('markPaid', 'Mark paid')}</Btn>
      </div>
    )},
  ];

  return (
    <div style={{ padding: '28px 28px 40px' }}>
      <PageHeader title={t('payroll', 'Payroll')} subtitle={t('weeklyPayroll', 'Manage weekly payroll (Saturday to Friday) and payments')}
        action={<Btn variant="primary" onClick={() => setShowModal(true)}>{t('generate', '+ Generate')}</Btn>}
      />
      {!selectedWeek && (
        <Card padding="12px 16px" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Input label={t('fromDate', 'From')} type="date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
            <Input label={t('toDate', 'To')} type="date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
            <div style={{ minWidth: 140 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{t('status', 'Status')}</label>
              <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
                <option value="">{t('all', 'All')}</option>
                <option value="pending">{t('pending', 'Pending')}</option>
                <option value="paid">{t('paid', 'Paid')}</option>
              </select>
            </div>
            <Input label={t('employee', 'Employee')} placeholder={t('searchByName', 'Search by name…')} value={filters.employee} onChange={e => setFilters(f => ({ ...f, employee: e.target.value }))} />
          </div>
        </Card>
      )}
      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}
      {truncated && (
        <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, background: 'var(--warning-soft, #fef9c3)', color: 'var(--warning-strong, #a16207)', fontSize: 13 }}>
          {t('payrollTruncated', 'Showing the most recent records only. Narrow the date range to see everything in range.')}
        </div>
      )}
      {actionError && <div style={{ marginBottom: 12 }}><ErrorMsg msg={actionError} /></div>}
      {actionNotice && (
        <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, background: 'var(--accent-soft, #e6f7f1)', color: 'var(--accent, #0f6e56)', fontSize: 13 }}>
          {actionNotice}
        </div>
      )}
      {!loading && !error && !selectedWeek && groupedPayroll.length === 0 && (
        <Card padding="32px"><div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          {(filters.employee || filters.status || records.length > 0)
            ? t('noPayrollMatch', 'No payroll records match the current filters.')
            : t('noPayrollYet', 'No payroll generated yet. Use "+ Generate" to create the first weekly payroll.')}
        </div></Card>
      )}
      {!loading && !error && !selectedWeek && groupedPayroll.length > 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          {groupedPayroll.map((group) => (
            <Card key={group.weekStart} padding="16px 18px">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{formatWeekInterval(group.weekStart === 'monthly' ? null : group.weekStart, group.weekEnd, t)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{group.employeeCount} employee{group.employeeCount === 1 ? '' : 's'} · {formatCurrency(group.totalNet)}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Badge variant={group.paidCount === group.employeeCount && group.employeeCount > 0 ? 'success' : 'default'}>
                    {group.paidCount === group.employeeCount && group.employeeCount > 0 ? '🔒 ' : ''}{group.paidCount}/{group.employeeCount} {t('paid', 'paid')}
                  </Badge>
                  <Btn size="sm" variant="primary" onClick={() => setSelectedWeekStart(group.weekStart)}>{t('open', 'Open')}</Btn>
                  {group.weekStart !== 'monthly' && group.paidCount < group.employeeCount && (
                    <Btn size="sm" variant="success" onClick={() => handlePayWeek(group.weekStart)} disabled={saving}>
                      💰 {t('payWeek', 'اعتماد وصرف')}
                    </Btn>
                  )}
                  {group.weekStart !== 'monthly' && group.paidCount === 0 && (
                    <Btn size="sm" variant="danger" onClick={() => handleDeleteWeek(group.weekStart)}>{t('delete', 'Delete')}</Btn>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {group.records.slice(0, 4).map((row) => (
                  <div key={row.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', minWidth: 150 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{row.employee_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatCurrency(row.net_salary)}</div>
                  </div>
                ))}
                {group.records.length > 4 && <div style={{ alignSelf: 'center', color: 'var(--text-muted)', fontSize: 12 }}>+{group.records.length - 4} more</div>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {!loading && selectedWeek && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{formatWeekInterval(selectedWeek.weekStart === 'monthly' ? null : selectedWeek.weekStart, selectedWeek.weekEnd, t)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedWeek.employeeCount} employee{selectedWeek.employeeCount === 1 ? '' : 's'} payrolls</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {selectedWeek.weekStart !== 'monthly' && selectedWeek.paidCount < selectedWeek.employeeCount && (
                <Btn variant="success" onClick={() => handlePayWeek(selectedWeek.weekStart)} loading={saving}>
                  💰 {t('payEntireWeek', 'اعتماد وصرف الأسبوع بالكامل')}
                </Btn>
              )}
              <Btn onClick={handleExportPDF}>{t('exportPDF', 'Export PDF')}</Btn>
              <Btn onClick={() => setSelectedWeekStart(null)}>{t('back', 'Back to weeks')}</Btn>
            </div>
          </div>
          <Card padding="0"><Table columns={columns} data={sortedRecords} /></Card>
        </div>
      )}

      {showModal && (
        <Modal title={t('generatePayroll', 'Generate payroll')} onClose={() => setShowModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input label={t('weekDate', 'Week date')} type="date" value={form.week_start} onChange={e => setForm({ ...form, week_start: e.target.value })} />
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {t('weeklyPayrollHint', 'Payroll weeks run Saturday to Friday. The selected date is mapped to that week, and salary is calculated from attendance within the week. Per-employee bonuses and deductions can be set afterwards with the "Adjust" button on each row.')}
            </div>
          </div>
          {actionError && <div style={{ marginTop: 12 }}><ErrorMsg msg={actionError} /></div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <Btn onClick={() => setShowModal(false)}>{t('cancel', 'Cancel')}</Btn>
            <Btn variant="primary" onClick={handleGenerate} disabled={saving}>{saving ? t('saving', 'Generating…') : t('generate', 'Generate')}</Btn>
          </div>
        </Modal>
      )}

      {/* Adjust modal for individual employee bonus/deductions */}
      {adjustTarget && (
        <Modal title={`${t('adjustPayroll', 'Adjust Payroll')} — ${adjustTarget.employee_name}`} onClose={() => setAdjustTarget(null)} width={480}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
            {formatWeekInterval(adjustTarget.week_start, adjustTarget.week_end, t)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input label={t('manualBonus', 'Manual bonus ($)')} type="number" min="0" step="0.01" value={adjustForm.bonus} onChange={e => setAdjustForm({ ...adjustForm, bonus: e.target.value })} />
            <Input label={t('manualDeductions', 'Manual deduction ($)')} type="number" min="0" step="0.01" value={adjustForm.deductions} onChange={e => setAdjustForm({ ...adjustForm, deductions: e.target.value })} />
          </div>
          {adjustError && <div style={{ marginTop: 12 }}><ErrorMsg msg={adjustError} /></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
            <Btn
              onClick={handleClearManual}
              disabled={adjustSaving || (
                Number(adjustForm.bonus || 0) === 0 &&
                Number(adjustForm.deductions || 0) === 0 &&
                Number(adjustTarget?.payroll_breakdown?.manual_bonus || adjustTarget?.manual_bonus || 0) === 0 &&
                Number(adjustTarget?.payroll_breakdown?.manual_deductions || adjustTarget?.manual_deductions || 0) === 0
              )}
            >
              {t('clearManual', 'Clear manual')}
            </Btn>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn onClick={() => setAdjustTarget(null)}>{t('cancel', 'Cancel')}</Btn>
              <Btn variant="primary" onClick={() => handleAdjust()} disabled={adjustSaving}>{adjustSaving ? t('saving', 'Saving…') : t('save', 'Save')}</Btn>
            </div>
          </div>
        </Modal>
      )}

      {selectedBreakdown && (
        <Modal title={`${t('payrollBreakdown', 'Payroll breakdown')} — ${selectedBreakdown.employee_name}`} onClose={() => setSelectedBreakdown(null)} width={520}>
          {selectedBreakdown.status !== 'paid' && selectedBreakdown.has_recalc_drift && (
            <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: 'var(--warning-soft, #fef9c3)', color: 'var(--warning-strong, #a16207)', fontSize: 12 }}>
              ⚠️ {t('recalcDriftHint', 'Recalculated total differs from the paid amount')}: {formatCurrency(selectedBreakdown.recomputed_net_salary)} vs {formatCurrency(selectedBreakdown.net_salary)}
            </div>
          )}
          {(() => {
            const b = selectedBreakdown.payroll_breakdown || {};
            const totalAbsent = b.absent_days || 0;
            // Only itemize rows that actually affected pay (non-zero).
            const items = [
              { label: `${t('lateDeduction', 'Late')} (${formatMinutes(b.late_minutes)} → ${formatMinutes(b.late_weighted_minutes)} ${t('weighted', 'weighted')})`, amount: b.late_deduction, positive: false },
              { label: `${t('earlyLeave', 'Early leave')} (${formatMinutes(b.early_leave_minutes)})`, amount: b.early_leave_deduction, positive: false },
              { label: `${t('absent', 'Absent')} (${totalAbsent} ${t('days', 'day(s)')})`, amount: b.absent_deduction, positive: false },
              { label: `${t('halfDay', 'Half day')} (${b.half_days})`, amount: b.half_day_deduction, positive: false },
              { label: t('hrPenalty', 'HR penalty'), amount: b.hr_penalty, positive: false },
              { label: t('manualDeductions', 'Manual deduction'), amount: b.manual_deductions, positive: false },
              { label: t('loanDeduction', 'Loan deduction'), amount: b.loan_deduction, positive: false },
              { label: `${t('regularOvertime', 'Overtime')} (${formatMinutes(b.regular_overtime_minutes)} → ${formatMinutes(b.regular_overtime_weighted_minutes ?? b.regular_overtime_minutes)} ${t('weighted', 'weighted')})`, amount: b.regular_overtime_bonus, positive: true },
              { label: `${t('weekendWorkOvertime', 'Weekend overtime')} (${formatMinutes(b.weekend_overtime_minutes)} → ${formatMinutes(b.weekend_overtime_weighted_minutes ?? b.weekend_overtime_minutes)} ${t('weighted', 'weighted')})`, amount: b.weekend_overtime_bonus, positive: true },
              { label: t('hrBonus', 'HR bonus'), amount: b.hr_bonus, positive: true },
              { label: t('hrOvertime', 'HR overtime bonus'), amount: b.hr_overtime_bonus, positive: true },
              { label: t('manualBonus', 'Manual bonus'), amount: b.manual_bonus, positive: true },
            ].filter(it => Number(it.amount) > 0);

            const rowStyle = { display: 'flex', justifyContent: 'space-between', padding: '8px 2px', borderBottom: '1px solid var(--border)', fontSize: 13 };
            return (
              <div>
                <div style={{ ...rowStyle, fontWeight: 700 }}>
                  <span>{t('base', 'Base salary')}</span><span>{formatCurrency(selectedBreakdown.base_salary)}</span>
                </div>
                {items.map((it) => (
                  <div key={it.label} style={rowStyle}>
                    <span>{it.label}</span>
                    <strong style={{ color: it.positive ? 'var(--accent)' : 'var(--danger)' }}>{it.positive ? '+' : '-'}{formatCurrency(it.amount)}</strong>
                  </div>
                ))}
                {items.length === 0 && (
                  <div style={{ ...rowStyle, color: 'var(--text-muted)' }}>{t('noAdjustments', 'No deductions or bonuses this week.')}</div>
                )}
                <div style={{ ...rowStyle, fontWeight: 700, fontSize: 15, borderBottom: 'none', marginTop: 4 }}>
                  <span>{t('netSalary', 'Net salary')}</span><span style={{ color: 'var(--accent)' }}>{formatCurrency(selectedBreakdown.net_salary)}</span>
                </div>
              </div>
            );
          })()}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <Btn onClick={() => setSelectedBreakdown(null)}>{t('close', 'Close')}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
