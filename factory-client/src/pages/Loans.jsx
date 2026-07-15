import React, { useState } from 'react';
import { hrApi, employeeApi } from '../api';
import { useFetch } from '../hooks/useFetch';
import { PageHeader, Card, Table, Badge, Btn, Modal, Input, Select, Spinner, ErrorMsg } from '../components/ui';

const emptyForm = {
  employee_id: '',
  principal_amount: '',
  monthly_installment: '',
  status: 'active',
};

export default function Loans() {
  const { data: loans, loading, error, refetch } = useFetch(() => hrApi.loans('?limit=1000'));
  const { data: employees } = useFetch(employeeApi.list);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [showFinished, setShowFinished] = useState(false);

  const handleSave = async () => {
    if (!form.employee_id) {
      setFormError('Please select an employee.');
      return;
    }
    const principal = Number(form.principal_amount);
    const installment = Number(form.monthly_installment);
    if (!Number.isFinite(principal) || principal <= 0) {
      setFormError('Principal amount must be greater than zero.');
      return;
    }
    if (!Number.isFinite(installment) || installment <= 0) {
      setFormError('Monthly installment must be greater than zero.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      await hrApi.createLoan({
        employee_id: Number(form.employee_id),
        principal_amount: principal,
        monthly_installment: installment,
        status: form.status,
      });
      setShowModal(false);
      setForm(emptyForm);
      await refetch();
    } catch (err) {
      setFormError(err?.message || 'Failed to create loan.');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'employee_name', label: 'Employee' },
    { key: 'principal_amount', label: 'Principal', render: (v) => `$${Number(v || 0).toLocaleString()}` },
    { key: 'remaining_amount', label: 'Remaining', render: (v) => `$${Number(v || 0).toLocaleString()}` },
    { key: 'monthly_installment', label: 'Installment', render: (v) => `$${Number(v || 0).toLocaleString()}` },
    { key: 'status', label: 'Status', render: (v) => <Badge variant={v === 'active' ? 'success' : 'default'}>{v === 'active' ? 'Active' : 'Finished'}</Badge> },
    { key: 'created_at', label: 'Created', render: (v) => v ? new Date(v).toLocaleDateString() : '—' },
  ];

  const filteredLoans = loans?.filter(l => showFinished || l.status === 'active') || [];

  return (
    <div style={{ padding: '28px 28px 40px' }}>
      <PageHeader title="Loans" subtitle="Create and track employee loans and repayments"
        action={
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={showFinished} onChange={(e) => setShowFinished(e.target.checked)} style={{ cursor: 'pointer' }} />
              Show finished loans
            </label>
            <Btn variant="primary" onClick={() => setShowModal(true)}>+ Add loan</Btn>
          </div>
        }
      />
      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}
      {!loading && <Card padding="0"><Table columns={columns} data={filteredLoans} /></Card>}

      {showModal && (
        <Modal title="Add loan" onClose={() => setShowModal(false)} width={480}>
          {formError && <div style={{ color: 'var(--danger)', marginBottom: 12, fontWeight: 600 }}>{formError}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Select label="Employee" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
              <option value="">Select employee</option>
              {employees?.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </Select>
            <Input label="Principal amount" type="number" value={form.principal_amount} onChange={(e) => setForm({ ...form, principal_amount: e.target.value })} />
            <Input label="Monthly installment" type="number" value={form.monthly_installment} onChange={(e) => setForm({ ...form, monthly_installment: e.target.value })} />
            <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">Active</option>
              <option value="closed">Closed</option>
            </Select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <Btn onClick={() => setShowModal(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
