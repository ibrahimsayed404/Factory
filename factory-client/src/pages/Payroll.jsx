import React, { useState } from 'react';
import { payrollApi, employeeApi } from '../api';
import { useFetch } from '../hooks/useFetch';
import { PageHeader, Card, Table, Badge, Btn, Modal, Input, Select, Spinner, ErrorMsg } from '../components/ui';

export default function Payroll() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());

  const { data: records, loading, error, refetch } = useFetch(
    () => payrollApi.list(`?month=${month}&year=${year}`), [month, year]
  );
  const { data: employees } = useFetch(employeeApi.list);

  const [showModal, setShowModal] = useState(false);
  const [selectedBreakdown, setSelectedBreakdown] = useState(null);
  const [form, setForm] = useState({ employee_id: '', bonus: '0', deductions: '0' });
  const [saving, setSaving] = useState(false);

  const handleGenerate = async () => {
    setSaving(true);
    try {
      await payrollApi.create({ ...form, month, year });
      setShowModal(false); refetch();
    } finally { setSaving(false); }
  };

  const handlePay = async (id) => {
    if (!window.confirm('Mark as paid?')) return;
    await payrollApi.pay(id);
    refetch();
  };

  const columns = [
    { key: 'employee_name', label: 'Employee' },
    { key: 'role', label: 'Role', render: v => v || '—' },
    { key: 'base_salary', label: 'Base', render: v => `$${Number(v).toLocaleString()}` },
    { key: 'bonus', label: 'Bonus', render: v => v > 0 ? <span style={{ color: 'var(--accent)' }}>+${Number(v).toLocaleString()}</span> : '—' },
    { key: 'deductions', label: 'Deductions', render: v => v > 0 ? <span style={{ color: 'var(--danger)' }}>-${Number(v).toLocaleString()}</span> : '—' },
    { key: 'net_salary', label: 'Net salary', render: v => <strong>${Number(v).toLocaleString()}</strong> },
    { key: 'payroll_breakdown', label: 'Breakdown', render: (_, row) => (
      <Btn size="sm" onClick={() => setSelectedBreakdown(row)}>View</Btn>
    )},
    { key: 'status', label: 'Status', render: v => <Badge variant={v === 'paid' ? 'success' : 'warning'}>{v}</Badge> },
    { key: 'actions', label: '', render: (_, row) => row.status === 'pending' && (
      <Btn size="sm" variant="primary" onClick={() => handlePay(row.id)}>Mark paid</Btn>
    )},
  ];

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div style={{ padding: '28px 28px 40px' }}>
      <PageHeader title="Payroll" subtitle="Manage employee salaries and payments"
        action={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ width: 90 }}>
              {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </Select>
            <Input type="number" value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 80 }} />
            <Btn variant="primary" onClick={() => setShowModal(true)}>+ Generate</Btn>
          </div>
        }
      />
      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}
      {!loading && <Card padding="0"><Table columns={columns} data={records || []} /></Card>}

      {showModal && (
        <Modal title={`Generate payroll — ${months[month-1]} ${year}`} onClose={() => setShowModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Select label="Employee" value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })}>
              <option value="">Select employee</option>
              {employees?.map(e => <option key={e.id} value={e.id}>{e.name} — ${Number(e.salary).toLocaleString()}</option>)}
            </Select>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Late, early leave, overtime, and absence adjustments are auto-calculated from attendance.
            </div>
            <Input label="Manual bonus adjustment ($)" type="number" value={form.bonus} onChange={e => setForm({ ...form, bonus: e.target.value })} />
            <Input label="Manual deduction adjustment ($)" type="number" value={form.deductions} onChange={e => setForm({ ...form, deductions: e.target.value })} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <Btn onClick={() => setShowModal(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleGenerate} disabled={saving}>{saving ? 'Generating…' : 'Generate'}</Btn>
          </div>
        </Modal>
      )}

      {selectedBreakdown && (
        <Modal title={`Payroll breakdown — ${selectedBreakdown.employee_name}`} onClose={() => setSelectedBreakdown(null)} width={520}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
            <Card padding="10px 12px"><strong>Auto bonus</strong><div style={{ marginTop: 4, color: 'var(--accent)' }}>+${Number(selectedBreakdown.payroll_breakdown?.auto_bonus || 0).toLocaleString()}</div></Card>
            <Card padding="10px 12px"><strong>Auto deductions</strong><div style={{ marginTop: 4, color: 'var(--danger)' }}>-${Number(selectedBreakdown.payroll_breakdown?.auto_deductions || 0).toLocaleString()}</div></Card>
            <Card padding="10px 12px"><strong>Manual bonus</strong><div style={{ marginTop: 4 }}>+${Number(selectedBreakdown.payroll_breakdown?.manual_bonus || 0).toLocaleString()}</div></Card>
            <Card padding="10px 12px"><strong>Manual deductions</strong><div style={{ marginTop: 4 }}>-${Number(selectedBreakdown.payroll_breakdown?.manual_deductions || 0).toLocaleString()}</div></Card>
          </div>

          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
            <Card padding="10px 12px">Late minutes: <strong>{selectedBreakdown.payroll_breakdown?.late_minutes || 0}</strong></Card>
            <Card padding="10px 12px">Early leave minutes: <strong>{selectedBreakdown.payroll_breakdown?.early_leave_minutes || 0}</strong></Card>
            <Card padding="10px 12px">Regular overtime: <strong>{selectedBreakdown.payroll_breakdown?.regular_overtime_minutes ?? (selectedBreakdown.payroll_breakdown?.overtime_minutes || 0)}</strong></Card>
            <Card padding="10px 12px">Weekend work overtime: <strong>{selectedBreakdown.payroll_breakdown?.weekend_overtime_minutes || 0}</strong></Card>
            <Card padding="10px 12px">Total overtime: <strong>{selectedBreakdown.payroll_breakdown?.overtime_minutes || 0}</strong></Card>
            <Card padding="10px 12px">Absent days: <strong>{selectedBreakdown.payroll_breakdown?.absent_days || 0}</strong></Card>
            <Card padding="10px 12px">Half days: <strong>{selectedBreakdown.payroll_breakdown?.half_days || 0}</strong></Card>
            <Card padding="10px 12px">Inferred absent days: <strong>{selectedBreakdown.payroll_breakdown?.inferred_absent_days || 0}</strong></Card>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <Btn onClick={() => setSelectedBreakdown(null)}>Close</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
