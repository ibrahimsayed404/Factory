import React, { useState } from 'react';
import { salesApi, resolveApiAssetUrl } from '../api';
import { useFetch } from '../hooks/useFetch';
import { PageHeader, Card, Table, Btn, Modal, Input, Spinner, ErrorMsg, MetricCard, Badge, statusVariant } from '../components/ui';

const emptyForm = { name: '', email: '', phone: '', address: '', city: '', country: '' };
const emptyPaymentForm = () => {
  const now = new Date();
  const paymentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return { payment_date: paymentDate, amount: '', notes: '' };
};

export default function Customers() {
  const { data: customers, loading, error, refetch } = useFetch(salesApi.customers);
  const [showModal, setShowModal] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState('');
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm());
  const [paymentEvidence, setPaymentEvidence] = useState(null);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setSaving(true);
    try { await salesApi.createCustomer(form); setShowModal(false); refetch(); }
    finally { setSaving(false); }
  };

  const openLedger = async (customer) => {
    setSelectedCustomer(customer);
    setShowLedger(true);
    setLedgerLoading(true);
    setLedgerError('');
    setPaymentError('');
    setPaymentForm(emptyPaymentForm());
    setPaymentEvidence(null);
    try {
      const data = await salesApi.customerLedger(customer.id);
      setLedger(data);
    } catch (e) {
      setLedgerError(e.message);
    } finally {
      setLedgerLoading(false);
    }
  };

  const reloadLedger = async () => {
    if (!selectedCustomer) return;
    setLedgerLoading(true);
    setLedgerError('');
    try {
      const data = await salesApi.customerLedger(selectedCustomer.id);
      setLedger(data);
    } catch (e) {
      setLedgerError(e.message);
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleAddPayment = async () => {
    setPaymentSaving(true);
    setPaymentError('');
    try {
      const payload = paymentEvidence
        ? (() => {
            const formData = new FormData();
            formData.append('payment_date', paymentForm.payment_date);
            formData.append('amount', String(Number(paymentForm.amount)));
            formData.append('notes', paymentForm.notes || '');
            formData.append('evidence', paymentEvidence);
            return formData;
          })()
        : {
            payment_date: paymentForm.payment_date,
            amount: Number(paymentForm.amount),
            notes: paymentForm.notes,
          };

      await salesApi.addPayment(selectedCustomer.id, payload);
      setPaymentForm(emptyPaymentForm());
      setPaymentEvidence(null);
      await reloadLedger();
    } catch (e) {
      setPaymentError(e.message);
    } finally {
      setPaymentSaving(false);
    }
  };

  const f = v => e => setForm({ ...form, [v]: e.target.value });

  const columns = [
    { key: 'name', label: 'Name', render: (v) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--info-dim)', color: 'var(--info)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600 }}>
          {v?.[0]?.toUpperCase()}
        </div>
        {v}
      </div>
    )},
    { key: 'email', label: 'Email', render: v => v || '—' },
    { key: 'phone', label: 'Phone', render: v => v || '—' },
    {
      key: 'remaining_balance',
      label: 'Balance',
      render: (_, row) => {
        const remaining = Number(row.remaining_balance || 0);
        const credit = Number(row.credit_balance || 0);
        if (remaining > 0) {
          return <Badge variant="danger">Due ${remaining.toLocaleString()}</Badge>;
        }
        if (credit > 0) {
          return <Badge variant="success">Credit ${credit.toLocaleString()}</Badge>;
        }
        return <Badge variant="success">Clear</Badge>;
      },
    },
    { key: 'city', label: 'City', render: v => v || '—' },
    { key: 'country', label: 'Country', render: v => v || '—' },
    { key: 'created_at', label: 'Since', render: v => new Date(v).toLocaleDateString() },
    { key: 'actions', label: '', render: (_, row) => <Btn size="sm" onClick={() => openLedger(row)}>Ledger</Btn> },
  ];

  const ledgerOrders = ledger?.orders || [];
  const paymentRows = ledger?.payments || [];
  const summary = ledger?.summary || {};
  const orderColumns = [
    { key: 'order_number', label: 'Order #' },
    { key: 'order_date', label: 'Date', render: v => v ? new Date(v).toLocaleDateString() : '—' },
    { key: 'total_products', label: 'Products', render: v => Number(v || 0) },
    { key: 'total_amount', label: 'Total', render: v => `$${Number(v || 0).toLocaleString()}` },
    { key: 'paid_amount', label: 'Paid', render: v => `$${Number(v || 0).toLocaleString()}` },
    { key: 'balance', label: 'Remaining', render: (_, row) => `$${Math.max(0, Number(row.total_amount || 0) - Number(row.paid_amount || 0)).toLocaleString()}` },
    { key: 'payment_status', label: 'Payment', render: v => <Badge variant={statusVariant(v)}>{v}</Badge> },
    { key: 'status', label: 'Order status', render: v => <Badge variant={statusVariant(v)}>{v}</Badge> },
  ];
  const paymentColumns = [
    { key: 'payment_date', label: 'Payment date', render: v => v ? new Date(v).toLocaleDateString() : '—' },
    { key: 'amount', label: 'Amount', render: v => <span style={{ color: 'var(--accent)', fontWeight: 600 }}>+${Number(v || 0).toLocaleString()}</span> },
    {
      key: 'evidence_url',
      label: 'Evidence',
      render: (_, row) => row.evidence_url ? (
        <a href={resolveApiAssetUrl(row.evidence_url)} target="_blank" rel="noreferrer" style={{ color: 'var(--info)' }}>
          {row.evidence_name || 'View file'}
        </a>
      ) : '—',
    },
    { key: 'notes', label: 'Notes', render: v => v || '—' },
  ];

  return (
    <div style={{ padding: '28px 28px 40px' }}>
      <PageHeader title="Customers" subtitle="Manage your client accounts"
        action={<Btn variant="primary" onClick={() => { setForm(emptyForm); setShowModal(true); }}>+ Add customer</Btn>}
      />
      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}
      {!loading && <Card padding="0"><Table columns={columns} data={customers || []} /></Card>}

      {showModal && (
        <Modal title="Add customer" onClose={() => setShowModal(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}><Input label="Company / Customer name" value={form.name} onChange={f('name')} /></div>
            <Input label="Email" type="email" value={form.email} onChange={f('email')} />
            <Input label="Phone" value={form.phone} onChange={f('phone')} />
            <Input label="City" value={form.city} onChange={f('city')} />
            <Input label="Country" value={form.country} onChange={f('country')} />
            <div style={{ gridColumn: '1/-1' }}><Input label="Address" value={form.address} onChange={f('address')} /></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <Btn onClick={() => setShowModal(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={handleCreate} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Btn>
          </div>
        </Modal>
      )}

      {showLedger && (
        <Modal title={`Customer ledger — ${selectedCustomer?.name || ''}`} onClose={() => setShowLedger(false)} width={980}>
          {ledgerLoading ? <Spinner /> : ledgerError ? <ErrorMsg msg={ledgerError} /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12 }}>
                <MetricCard label="Products taken" value={summary.total_products || 0} />
                <MetricCard label="Total ordered" value={`$${Number(summary.total_ordered || 0).toLocaleString()}`} />
                <MetricCard label="Total paid" value={`$${Number(summary.total_paid || 0).toLocaleString()}`} color="var(--accent)" />
                <MetricCard label="Remaining" value={`$${Number(summary.remaining_balance || 0).toLocaleString()}`} color={Number(summary.remaining_balance || 0) > 0 ? 'var(--danger)' : 'var(--accent)'} />
              </div>

              <Card>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>ADD WEEKLY PAYMENT</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto', gap: 10, alignItems: 'end' }}>
                  <Input label="Payment date" type="date" value={paymentForm.payment_date} onChange={e => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} />
                  <Input label="Amount" type="number" min="0.01" value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
                  <Input label="Notes" value={paymentForm.notes} onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })} />
                  <Btn variant="primary" onClick={handleAddPayment} disabled={paymentSaving || !paymentForm.amount}>{paymentSaving ? 'Saving…' : 'Add payment'}</Btn>
                </div>
                <div style={{ marginTop: 10, maxWidth: 340 }}>
                  <Input
                    label="Evidence (screenshot or PDF)"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={e => setPaymentEvidence(e.target.files?.[0] || null)}
                  />
                </div>
                {paymentError && <div style={{ marginTop: 12 }}><ErrorMsg msg={paymentError} /></div>}
              </Card>

              <Card padding="0">
                <div style={{ padding: '14px 16px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>CUSTOMER ORDERS</div>
                <Table columns={orderColumns} data={ledgerOrders} emptyMsg="No orders for this customer yet." />
              </Card>

              <Card padding="0">
                <div style={{ padding: '14px 16px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>PAYMENT HISTORY</div>
                <Table columns={paymentColumns} data={paymentRows} emptyMsg="No payments recorded yet." />
              </Card>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
