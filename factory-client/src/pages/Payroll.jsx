import React, { useState } from 'react';
import { payrollApi, employeeApi } from '../api';
import { useFetch } from '../hooks/useFetch';
import { PageHeader, Card, Table, Badge, Btn, Modal, Input, Select, Spinner, ErrorMsg } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';

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

const normalizeToSaturdayIso = (isoDate) => {
  if (!isoDate) return getCurrentWeekStartIso();
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return getCurrentWeekStartIso();
  const day = d.getDay();
  const diffToSaturday = (day - 6 + 7) % 7;
  d.setDate(d.getDate() - diffToSaturday);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dayPart = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dayPart}`;
};

const addDaysIso = (isoDate, days) => {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function Payroll() {
  const { t } = useLanguage();
  const [weekStart, setWeekStart] = useState(getCurrentWeekStartIso());

  const { data: records, loading, error, refetch } = useFetch(
    () => payrollApi.list(`?week_start=${encodeURIComponent(weekStart)}&limit=1000`), [weekStart]
  );
  const { data: employees } = useFetch(employeeApi.list);

  const [showModal, setShowModal] = useState(false);
  const [selectedBreakdown, setSelectedBreakdown] = useState(null);
  const [form, setForm] = useState({ employee_id: '', bonus: '0', deductions: '0' });
  const [saving, setSaving] = useState(false);

  const handleGenerate = async () => {
    setSaving(true);
    try {
      await payrollApi.create({ ...form, week_start: weekStart });
      setShowModal(false); refetch();
    } finally { setSaving(false); }
  };

  const handlePay = async (id) => {
    if (!globalThis.window.confirm(t('markAsPaid', 'Mark as paid?'))) return;
    await payrollApi.pay(id);
    refetch();
  };

  const columns = [
    { key: 'employee_name', label: t('employee', 'Employee') },
    { key: 'week_start', label: t('week', 'Week'), render: (_, row) => {
      const start = row.week_start || weekStart;
      const end = row.week_end || (start ? addDaysIso(start, 6) : '—');
      return `${start || '—'} to ${end || '—'}`;
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
      <Btn size="sm" variant="primary" onClick={() => handlePay(row.id)}>{t('markPaid', 'Mark paid')}</Btn>
    )},
  ];

  return (
    <div style={{ padding: '28px 28px 40px' }}>
      <PageHeader title={t('payroll', 'Payroll')} subtitle={t('weeklyPayroll', 'Manage weekly payroll (Saturday to Friday) and payments')}
        action={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Input label={t('weekStartSaturday', 'Week start (Saturday)')} type="date" value={weekStart} onChange={e => setWeekStart(normalizeToSaturdayIso(e.target.value))} style={{ width: 190 }} />
            <Btn variant="primary" onClick={() => setShowModal(true)}>{t('generate', '+ Generate')}</Btn>
          </div>
        }
      />
      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}
      {!loading && <Card padding="0"><Table columns={columns} data={records || []} /></Card>}

      {showModal && (
        <Modal title={`${t('generatePayroll', 'Generate payroll')} — ${weekStart}`} onClose={() => setShowModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Select label={t('employee', 'Employee')} value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })}>
              <option value="">{t('selectEmployee', 'Select employee')}</option>
              {employees?.map(e => <option key={e.id} value={e.id}>{e.name} — ${Number(e.salary).toLocaleString()}</option>)}
            </Select>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {t('weeklyPayroll', 'Payroll weeks run Saturday to Friday. Late, early leave, overtime, and absence adjustments are auto-calculated from attendance.')}
            </div>
            <Input label={t('manualBonus', 'Manual bonus adjustment ($)')} type="number" value={form.bonus} onChange={e => setForm({ ...form, bonus: e.target.value })} />
            <Input label={t('manualDeductions', 'Manual deduction adjustment ($)')} type="number" value={form.deductions} onChange={e => setForm({ ...form, deductions: e.target.value })} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <Btn onClick={() => setShowModal(false)}>{t('cancel', 'Cancel')}</Btn>
            <Btn variant="primary" onClick={handleGenerate} disabled={saving}>{saving ? t('saving', 'Generating…') : t('generate', 'Generate')}</Btn>
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
          </div>

          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
            <Card padding="10px 12px">{t('lateMinutes', 'Late minutes')}: <strong>{selectedBreakdown.payroll_breakdown?.late_minutes || 0}</strong></Card>
            <Card padding="10px 12px">{t('lateWeightedMinutes', 'Late weighted minutes')}: <strong>{selectedBreakdown.payroll_breakdown?.late_weighted_minutes || 0}</strong></Card>
            <Card padding="10px 12px">{t('earlyLeaveMinutes', 'Early leave minutes')}: <strong>{selectedBreakdown.payroll_breakdown?.early_leave_minutes || 0}</strong></Card>
            <Card padding="10px 12px">{t('regularOvertime', 'Regular overtime')}: <strong>{selectedBreakdown.payroll_breakdown?.regular_overtime_minutes ?? (selectedBreakdown.payroll_breakdown?.overtime_minutes || 0)}</strong></Card>
            <Card padding="10px 12px">{t('weekendWorkOvertime', 'Weekend work overtime')}: <strong>{selectedBreakdown.payroll_breakdown?.weekend_overtime_minutes || 0}</strong></Card>
            <Card padding="10px 12px">{t('totalOvertime', 'Total overtime')}: <strong>{selectedBreakdown.payroll_breakdown?.overtime_minutes || 0}</strong></Card>
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
