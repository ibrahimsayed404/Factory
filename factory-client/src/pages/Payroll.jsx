import React, { useMemo, useState } from 'react';
import { payrollApi } from '../api';
import { useFetch } from '../hooks/useFetch';
import { PageHeader, Card, Table, Badge, Btn, Modal, Input, Spinner, ErrorMsg } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { groupPayrollByWeek } from '../utils/payrollGrouping';

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

/** Parse an ISO date string or Date object to a local Date object timezone-safely */
const parseLocalDate = (dateVal) => {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return dateVal;
  const str = String(dateVal);
  if (str.includes('T')) {
    return new Date(str);
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return new Date(str);
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
 * Formats a week interval like: "from Saturday to Thursday from 4/7 to 9/7"
 */
const formatWeekInterval = (weekStart, weekEnd, t) => {
  const startDate = parseLocalDate(weekStart);
  const endDate = parseLocalDate(weekEnd || (weekStart ? addDaysIso(weekStart, 5) : null));
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

export default function Payroll() {
  const { t } = useLanguage();

  const { data: records, loading, error, refetch } = useFetch(
    () => payrollApi.list('?limit=1000'), []
  );

  const [showModal, setShowModal] = useState(false);
  const [selectedBreakdown, setSelectedBreakdown] = useState(null);
  const [selectedWeekStart, setSelectedWeekStart] = useState(null);
  const [form, setForm] = useState({ week_start: getCurrentWeekStartIso(), bonus: '0', deductions: '0' });
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');

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
    try {
      await payrollApi.create({
        week_start: normalizedWeekStart,
        bonus: form.bonus,
        deductions: form.deductions,
      });
      setShowModal(false);
      await refetch({ silent: true });
    } catch (e) {
      setActionError(e.message || t('payrollGenerateFailed', 'Failed to generate payroll.'));
    } finally { setSaving(false); }
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
    const isAr = t('appName') !== 'FabriCore';
    const direction = isAr ? 'rtl' : 'ltr';
    const weekLabel = formatWeekInterval(selectedWeek.weekStart === 'monthly' ? null : selectedWeek.weekStart, selectedWeek.weekEnd, t);

    const { printHtmlDocument } = await import('../utils/printDocument');

    const recordsHtml = sortedRecords.map(row => `
      <tr>
        <td>${row.employee_name || '—'}</td>
        <td>${row.department_name || '—'}</td>
        <td>${row.role || '—'}</td>
        <td class="num">$${Number(row.base_salary || 0).toLocaleString()}</td>
        <td class="num">${Number(row.bonus || 0) > 0 ? `+$${Number(row.bonus).toLocaleString()}` : '—'}</td>
        <td class="num">${Number(row.deductions || 0) > 0 ? `-$${Number(row.deductions).toLocaleString()}` : '—'}</td>
        <td class="num"><strong>$${Number(row.net_salary || 0).toLocaleString()}</strong></td>
        <td><span class="badge ${row.status || 'pending'}">${row.status || 'pending'}</span></td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html lang="${isAr ? 'ar' : 'en'}" dir="${direction}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${t('payroll', 'Payroll')} — ${weekLabel}</title>
        <style>
          body {
            font-family: system-ui, -apple-system, "Segoe UI", Tahoma, Arial, sans-serif;
            margin: 20px;
            color: #1e293b;
            background: #fff;
            direction: ${direction};
          }
          .header-banner {
            background: #0f1117;
            color: #22d3a0;
            padding: 20px 24px;
            border-radius: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
          }
          .header-banner h1 {
            font-size: 18px;
            margin: 0;
            font-weight: 700;
          }
          .header-banner .meta {
            color: #94a3b8;
            font-size: 12px;
          }
          .title-section {
            margin-bottom: 20px;
            border-bottom: 2px solid #22d3a0;
            padding-bottom: 10px;
          }
          .title-section h2 {
            font-size: 20px;
            margin: 0 0 5px 0;
            color: #0f172a;
          }
          .metrics-container {
            display: flex;
            gap: 16px;
            margin-bottom: 24px;
          }
          .metric-card {
            flex: 1;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 12px 16px;
          }
          .metric-card .label {
            font-size: 12px;
            color: #64748b;
            margin-bottom: 4px;
          }
          .metric-card .val {
            font-size: 16px;
            font-weight: 700;
            color: #0f172a;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          th, td {
            padding: 10px 12px;
            text-align: ${isAr ? 'right' : 'left'};
            font-size: 13px;
            border-bottom: 1px solid #e2e8f0;
          }
          th {
            background: #0f6e56;
            color: #fff;
            font-weight: 600;
          }
          tr:nth-child(even) {
            background: #f8fafc;
          }
          .num {
            text-align: right;
          }
          .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
          }
          .badge.paid {
            background: #dcfce7;
            color: #15803d;
          }
          .badge.pending {
            background: #fef9c3;
            color: #a16207;
          }
          @media print {
            body { margin: 10px; }
            .header-banner {
              background: #0f1117 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            th {
               background: #0f6e56 !important;
               color: #fff !important;
               -webkit-print-color-adjust: exact;
               print-color-adjust: exact;
            }
            .metric-card {
               background: #f8fafc !important;
               -webkit-print-color-adjust: exact;
               print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <div class="header-banner">
          <h1>FabriCore Factory Management</h1>
          <div class="meta">${new Date().toLocaleString()}</div>
        </div>
        <div class="title-section">
          <h2>${t('payroll', 'Payroll')}</h2>
          <div style="font-size: 14px; color: #475569;">${weekLabel}</div>
        </div>
        <div class="metrics-container">
          <div class="metric-card">
            <div class="label">${t('employees', 'Employees')}</div>
            <div class="val">${selectedWeek.employeeCount}</div>
          </div>
          <div class="metric-card">
            <div class="label">${t('totalNet', 'Total Net')}</div>
            <div class="val">$${Number(selectedWeek.totalNet || 0).toLocaleString()}</div>
          </div>
          <div class="metric-card">
            <div class="label">${t('status', 'Status')}</div>
            <div class="val">${selectedWeek.paidCount}/${selectedWeek.employeeCount} ${t('paid', 'paid')}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>${t('employee', 'Employee')}</th>
              <th>${t('department', 'Department')}</th>
              <th>${t('role', 'Role')}</th>
              <th class="num">${t('base', 'Base')}</th>
              <th class="num">${t('bonus', 'Bonus')}</th>
              <th class="num">${t('deductions', 'Deductions')}</th>
              <th class="num">${t('netSalary', 'Net salary')}</th>
              <th>${t('status', 'Status')}</th>
            </tr>
          </thead>
          <tbody>
            ${recordsHtml}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const ok = printHtmlDocument(html, { title: 'payroll-print' });
    if (!ok) {
      setActionError(t('payrollExportFailed', 'Failed to export payroll to PDF.'));
    }
  };

  const groupedPayroll = useMemo(() => groupPayrollByWeek(records || []), [records]);
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
    { key: 'base_salary', label: t('base', 'Base'), render: v => `$${Number(v).toLocaleString()}` },
    { key: 'bonus', label: t('bonus', 'Bonus'), render: v => v > 0 ? <span style={{ color: 'var(--accent)' }}>+${Number(v).toLocaleString()}</span> : '—' },
    { key: 'deductions', label: t('deductions', 'Deductions'), render: v => v > 0 ? <span style={{ color: 'var(--danger)' }}>-${Number(v).toLocaleString()}</span> : '—' },
    { key: 'net_salary', label: t('netSalary', 'Net salary'), render: v => <strong>${Number(v).toLocaleString()}</strong> },
    { key: 'weekly_payment_estimate', label: t('weeklyPay', 'Weekly Pay'), render: (_, row) => `$${Number(row.payroll_breakdown?.weekly_payment_estimate || 0).toLocaleString()}` },
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
      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}
      {actionError && <div style={{ marginBottom: 12 }}><ErrorMsg msg={actionError} /></div>}
      {!loading && !selectedWeek && (
        <div style={{ display: 'grid', gap: 12 }}>
          {groupedPayroll.map((group) => (
            <Card key={group.weekStart} padding="16px 18px">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{formatWeekInterval(group.weekStart === 'monthly' ? null : group.weekStart, group.weekEnd, t)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{group.employeeCount} employee{group.employeeCount === 1 ? '' : 's'} · ${Number(group.totalNet || 0).toLocaleString()}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Badge variant="default">{group.paidCount}/{group.employeeCount} paid</Badge>
                  <Btn size="sm" variant="primary" onClick={() => setSelectedWeekStart(group.weekStart)}>{t('open', 'Open')}</Btn>
                  {group.weekStart !== 'monthly' && group.paidCount === 0 && (
                    <Btn size="sm" variant="danger" onClick={() => handleDeleteWeek(group.weekStart)}>{t('delete', 'Delete')}</Btn>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {group.records.slice(0, 4).map((row) => (
                  <div key={row.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', minWidth: 150 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{row.employee_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>${Number(row.net_salary || 0).toLocaleString()}</div>
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
            <div style={{ display: 'flex', gap: 8 }}>
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
              {t('weeklyPayroll', 'Payroll weeks run Saturday to Friday. The selected date is mapped to that week, and salary is calculated from attendance within the week.')}
            </div>
            <Input label={t('manualBonus', 'Manual bonus adjustment ($)')} type="number" value={form.bonus} onChange={e => setForm({ ...form, bonus: e.target.value })} />
            <Input label={t('manualDeductions', 'Manual deduction adjustment ($)')} type="number" value={form.deductions} onChange={e => setForm({ ...form, deductions: e.target.value })} />
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
            <Card padding="10px 12px"><strong>{t('autoBonus', 'Auto bonus')}</strong><div style={{ marginTop: 4, color: 'var(--accent)' }}>+${Number(selectedBreakdown.payroll_breakdown?.auto_bonus || 0).toLocaleString()}</div></Card>
            <Card padding="10px 12px"><strong>{t('autoDeductions', 'Auto deductions')}</strong><div style={{ marginTop: 4, color: 'var(--danger)' }}>-${Number(selectedBreakdown.payroll_breakdown?.auto_deductions || 0).toLocaleString()}</div></Card>
            <Card padding="10px 12px"><strong>{t('manualBonus', 'Manual bonus')}</strong><div style={{ marginTop: 4 }}>+${Number(selectedBreakdown.payroll_breakdown?.manual_bonus || 0).toLocaleString()}</div></Card>
            <Card padding="10px 12px"><strong>{t('manualDeductions', 'Manual deductions')}</strong><div style={{ marginTop: 4 }}>-${Number(selectedBreakdown.payroll_breakdown?.manual_deductions || 0).toLocaleString()}</div></Card>
            <Card padding="10px 12px"><strong>{t('loanDeduction', 'Loan deduction')}</strong><div style={{ marginTop: 4, color: 'var(--danger)' }}>-${Number(selectedBreakdown.payroll_breakdown?.loan_deduction || 0).toLocaleString()}</div></Card>
          </div>

          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
            <Card padding="10px 12px">{t('lateMinutes', 'Late minutes')}: <strong>{selectedBreakdown.payroll_breakdown?.late_minutes || 0}</strong></Card>
            <Card padding="10px 12px">{t('lateWeightedMinutes', 'Late weighted minutes')}: <strong>{selectedBreakdown.payroll_breakdown?.late_weighted_minutes || 0}</strong></Card>
            <Card padding="10px 12px">{t('earlyLeaveMinutes', 'Early leave minutes')}: <strong>{selectedBreakdown.payroll_breakdown?.early_leave_minutes || 0}</strong></Card>
            <Card padding="10px 12px">{t('regularOvertime', 'Regular overtime')}: <strong>{selectedBreakdown.payroll_breakdown?.overtime_minutes || 0}</strong></Card>
            <Card padding="10px 12px">{t('weekendWorkOvertime', 'Weekend work overtime')}: <strong>{selectedBreakdown.payroll_breakdown?.weekend_overtime_minutes || 0}</strong></Card>
            <Card padding="10px 12px">{t('totalOvertime', 'Total overtime (×1.5)')}: <strong>{Math.round((selectedBreakdown.payroll_breakdown?.overtime_minutes || 0) * 1.5)}</strong></Card>
            <Card padding="10px 12px">{t('absentDays', 'Absent days')}: <strong>{selectedBreakdown.payroll_breakdown?.absent_days || 0}</strong></Card>
            <Card padding="10px 12px">{t('halfDays', 'Half days')}: <strong>{selectedBreakdown.payroll_breakdown?.half_days || 0}</strong></Card>
            <Card padding="10px 12px">{t('inferredAbsentDays', 'Inferred absent days')}: <strong>{selectedBreakdown.payroll_breakdown?.inferred_absent_days || 0}</strong></Card>
            <Card padding="10px 12px">{t('weeklyPaymentEstimate', 'Weekly payment estimate')}: <strong>${Number(selectedBreakdown.payroll_breakdown?.weekly_payment_estimate || 0).toLocaleString()}</strong></Card>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <Btn onClick={() => setSelectedBreakdown(null)}>{t('close', 'Close')}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
