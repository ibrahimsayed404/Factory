import React, { useState } from 'react';
import { hrApi } from './loans.api';
import { employeeApi } from '../employees/employees.api';
import { useFetch } from '../../hooks/useFetch';
import { PageHeader, Card, Table, Badge, Btn, Modal, Input, Select, Spinner, ErrorMsg } from '../../components/ui';
import { useLanguage } from '../../context/LanguageContext';

const emptyForm = {
  employee_id: '',
  principal_amount: '',
  remaining_amount: '',
  monthly_installment: '',
  status: 'active',
};

export default function Loans() {
  const { t } = useLanguage();
  const { data: loans, loading, error, refetch } = useFetch(() => hrApi.loans('?limit=1000'));
  const { data: employees } = useFetch(employeeApi.list);
  const [showModal, setShowModal] = useState(false);
  const [editingLoan, setEditingLoan] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [showFinished, setShowFinished] = useState(false);

  const openCreate = () => {
    setEditingLoan(null);
    setForm(emptyForm);
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (loan) => {
    setEditingLoan(loan);
    setForm({
      employee_id: loan.employee_id || '',
      principal_amount: loan.principal_amount ?? '',
      remaining_amount: loan.remaining_amount ?? loan.principal_amount ?? '',
      monthly_installment: loan.monthly_installment ?? '',
      status: loan.status || 'active',
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.employee_id) {
      setFormError(t('loan_errEmployee', 'Please select an employee.'));
      return;
    }
    const principal = Number(form.principal_amount);
    const installment = Number(form.monthly_installment);
    if (!Number.isFinite(principal) || principal <= 0) {
      setFormError(t('loan_errPrincipal', 'Principal amount must be greater than zero.'));
      return;
    }
    if (!Number.isFinite(installment) || installment <= 0) {
      setFormError(t('loan_errInstallment', 'Monthly installment must be greater than zero.'));
      return;
    }

    let remaining = form.remaining_amount !== '' ? Number(form.remaining_amount) : principal;
    if (!Number.isFinite(remaining) || remaining < 0) {
      setFormError(t('loan_errRemaining', 'Remaining amount must be a non-negative number.'));
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      if (editingLoan) {
        await hrApi.updateLoan(editingLoan.id, {
          employee_id: Number(form.employee_id),
          principal_amount: principal,
          remaining_amount: remaining,
          monthly_installment: installment,
          status: form.status,
        });
      } else {
        await hrApi.createLoan({
          employee_id: Number(form.employee_id),
          principal_amount: principal,
          monthly_installment: installment,
          status: form.status,
        });
      }
      setShowModal(false);
      setForm(emptyForm);
      setEditingLoan(null);
      await refetch();
    } catch (err) {
      setFormError(err?.message || (editingLoan ? t('loan_errUpdate', 'Failed to update loan.') : t('loan_errCreate', 'Failed to create loan.')));
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'employee_name', label: t('loan_employee', 'Employee') },
    { key: 'principal_amount', label: t('loan_principal', 'Principal'), render: (v) => `${Number(v || 0).toLocaleString('en-US')} ${t('currency', 'EGP')}` },
    { key: 'remaining_amount', label: t('loan_remaining', 'Remaining'), render: (v) => `${Number(v || 0).toLocaleString('en-US')} ${t('currency', 'EGP')}` },
    { key: 'monthly_installment', label: t('loan_installment', 'Installment'), render: (v) => `${Number(v || 0).toLocaleString('en-US')} ${t('currency', 'EGP')}` },
    { key: 'status', label: t('loan_status', 'Status'), render: (v) => <Badge variant={v === 'active' ? 'success' : 'default'}>{v === 'active' ? t('loan_active', 'Active') : t('loan_finished', 'Finished')}</Badge> },
    { key: 'created_at', label: t('loan_created', 'Created'), render: (v) => v ? String(v).slice(0, 10) : '—' },
    {
      key: 'actions',
      label: t('loan_actions', 'Actions'),
      sortable: false,
      render: (_, loan) => (
        <Btn variant="ghost" size="sm" onClick={() => openEdit(loan)}>
          {t('loan_edit', 'Edit / Adjust')}
        </Btn>
      ),
    },
  ];

  const filteredLoans = loans?.filter(l => showFinished || l.status === 'active') || [];

  return (
    <div style={{ padding: '28px 28px 40px' }}>
      <PageHeader title={t('loan_title', 'Loans')} subtitle={t('loan_subtitle', 'Create and track employee loans and repayments')}
        action={
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={showFinished} onChange={(e) => setShowFinished(e.target.checked)} style={{ cursor: 'pointer' }} />
              {t('loan_showFinished', 'Show finished loans')}
            </label>
            <Btn variant="primary" onClick={openCreate}>{t('loan_addBtn', '+ Add loan')}</Btn>
          </div>
        }
      />
      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}
      {!loading && <Card padding="0"><Table columns={columns} data={filteredLoans} /></Card>}

      {showModal && (
        <Modal title={editingLoan ? t('loan_editTitle', 'Edit / Adjust loan') : t('loan_addTitle', 'Add loan')} onClose={() => { setShowModal(false); setEditingLoan(null); }} width={480}>
          {formError && <div style={{ color: 'var(--danger)', marginBottom: 12, fontWeight: 600 }}>{formError}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Select label={t('loan_employee', 'Employee')} value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
              <option value="">{t('loan_selectEmployee', 'Select employee')}</option>
              {employees?.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </Select>
            <Input label={t('loan_principalAmount', 'Principal amount')} type="number" value={form.principal_amount} onChange={(e) => setForm({ ...form, principal_amount: e.target.value })} />
            {editingLoan && (
              <Input label={t('loan_remainingAmount', 'Remaining amount')} type="number" value={form.remaining_amount} onChange={(e) => setForm({ ...form, remaining_amount: e.target.value })} />
            )}
            <Input label={t('loan_installmentAmount', 'Monthly installment')} type="number" value={form.monthly_installment} onChange={(e) => setForm({ ...form, monthly_installment: e.target.value })} />
            <Select label={t('loan_status', 'Status')} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">{t('loan_active', 'Active')}</option>
              <option value="closed">{t('loan_closed', 'Closed')}</option>
            </Select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <Btn onClick={() => { setShowModal(false); setEditingLoan(null); }}>{t('loan_cancel', 'Cancel')}</Btn>
            <Btn variant="primary" onClick={handleSave} disabled={saving}>{saving ? t('loan_saving', 'Saving…') : (editingLoan ? t('loan_update', 'Update') : t('loan_save', 'Save'))}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
