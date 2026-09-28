import React, { useState, useMemo } from 'react';
import { salesApi } from './sales.api';
import { resolveApiAssetUrl } from '../../api/client';
import { useFetch } from '../../hooks/useFetch';
import { PageHeader, Card, Table, Btn, Modal, Input, Spinner, ErrorMsg, MetricCard, Badge, statusVariant, SearchInput } from '../../components/ui';
import { useLanguage } from '../../context/LanguageContext';
import { printHtmlDocument } from '../../utils/printDocument';
import { buildStatement, buildStatementPrintHtml, orderItems, money } from './customerStatement';

const emptyForm = { name: '', email: '', phone: '', address: '', city: '', country: '' };
const emptyPaymentForm = () => {
  const now = new Date();
  const paymentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return { payment_date: paymentDate, amount: '', notes: '' };
};

const validateEmail = (email) => {
  // Simple email regex
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
};

export default function Customers() {
  const { t } = useLanguage();
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
  const [editingPayment, setEditingPayment] = useState(null);
  const [editPaymentForm, setEditPaymentForm] = useState({
    payment_date: '',
    amount: '',
    notes: '',
    payment_method: '',
    reference_number: '',
  });
  const [editPaymentEvidence, setEditPaymentEvidence] = useState(null);
  const [editPaymentSaving, setEditPaymentSaving] = useState(false);
  const [editPaymentError, setEditPaymentError] = useState('');
  const [deletePaymentTarget, setDeletePaymentTarget] = useState(null);
  const [deletePaymentSaving, setDeletePaymentSaving] = useState(false);
  const [deletePaymentError, setDeletePaymentError] = useState('');
  const [ledgerTab, setLedgerTab] = useState('statement');
  const [stmtFrom, setStmtFrom] = useState('');
  const [stmtTo, setStmtTo] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [formError, setFormError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    const term = searchTerm.toLowerCase().trim();
    if (!term) return customers;
    return customers.filter(customer => 
      (customer.name?.toLowerCase() || '').includes(term) ||
      (customer.email?.toLowerCase() || '').includes(term) ||
      (customer.phone?.toLowerCase() || '').includes(term) ||
      (customer.city?.toLowerCase() || '').includes(term) ||
      (customer.country?.toLowerCase() || '').includes(term) ||
      (customer.address?.toLowerCase() || '').includes(term)
    );
  }, [customers, searchTerm]);

  const validateForm = () => {
    if (!form.name.trim()) return t('customerNameRequired', 'Customer name is required.');
    if (!form.email.trim() || !validateEmail(form.email)) return t('validEmailRequired', 'A valid email is required.');
    if (!form.phone.trim()) return t('phoneRequired', 'Phone is required.');
    return '';
  };

  const handleCreate = async () => {
    setFormError('');
    setSuccessMsg('');
    const err = validateForm();
    if (err) {
      setFormError(err);
      return;
    }
    setSaving(true);
    try {
      await salesApi.createCustomer(form);
      setShowModal(false);
      setForm(emptyForm);
      setSuccessMsg(t('customerAdded', 'Customer added successfully!'));
      await refetch();
    } catch (e) {
      setFormError(e.message || t('failedAddCustomer', 'Failed to add customer.'));
    } finally {
      setSaving(false);
    }
  };

  const openLedger = async (customer) => {
    setSelectedCustomer(customer);
    setShowLedger(true);
    setLedgerTab('statement');
    setStmtFrom('');
    setStmtTo('');
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
      refetch();
    } catch (e) {
      setPaymentError(e.message);
    } finally {
      setPaymentSaving(false);
    }
  };

  const openEditPayment = (payment) => {
    setEditingPayment(payment);
    setEditPaymentForm({
      payment_date: payment.payment_date ? payment.payment_date.slice(0, 10) : '',
      amount: String(payment.amount ?? ''),
      notes: payment.notes || '',
      payment_method: payment.payment_method || '',
      reference_number: payment.reference_number || '',
    });
    setEditPaymentEvidence(null);
    setEditPaymentError('');
  };

  const handleUpdatePayment = async () => {
    if (!editingPayment || !selectedCustomer) return;
    const amountVal = Number(editPaymentForm.amount);
    if (!amountVal || amountVal <= 0) {
      setEditPaymentError(t('validAmountRequired', 'Please enter a valid amount greater than 0'));
      return;
    }

    setEditPaymentSaving(true);
    setEditPaymentError('');
    try {
      const payload = editPaymentEvidence
        ? (() => {
            const formData = new FormData();
            if (editPaymentForm.payment_date) formData.append('payment_date', editPaymentForm.payment_date);
            formData.append('amount', String(amountVal));
            formData.append('notes', editPaymentForm.notes || '');
            formData.append('payment_method', editPaymentForm.payment_method || '');
            formData.append('reference_number', editPaymentForm.reference_number || '');
            formData.append('evidence', editPaymentEvidence);
            return formData;
          })()
        : {
            payment_date: editPaymentForm.payment_date || null,
            amount: amountVal,
            notes: editPaymentForm.notes || '',
            payment_method: editPaymentForm.payment_method || null,
            reference_number: editPaymentForm.reference_number || null,
          };

      await salesApi.updatePayment(selectedCustomer.id, editingPayment.id, payload);
      setEditingPayment(null);
      setEditPaymentEvidence(null);
      await reloadLedger();
      refetch();
    } catch (e) {
      setEditPaymentError(e.message || 'Failed to update payment');
    } finally {
      setEditPaymentSaving(false);
    }
  };

  const openDeletePayment = (payment) => {
    setDeletePaymentTarget(payment);
    setDeletePaymentError('');
  };

  const handleDeletePayment = async () => {
    if (!deletePaymentTarget || !selectedCustomer) return;
    setDeletePaymentSaving(true);
    setDeletePaymentError('');
    try {
      await salesApi.deletePayment(selectedCustomer.id, deletePaymentTarget.id);
      setDeletePaymentTarget(null);
      await reloadLedger();
      refetch();
    } catch (e) {
      setDeletePaymentError(e.message || 'Failed to delete payment');
    } finally {
      setDeletePaymentSaving(false);
    }
  };

  const f = v => e => setForm({ ...form, [v]: e.target.value });

  const columns = [
    { key: 'name', label: t('material', 'Name'), render: (v) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--info-dim)', color: 'var(--info)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600 }}>
          {v?.[0]?.toUpperCase()}
        </div>
        {v}
      </div>
    )},
    { key: 'email', label: t('email', 'Email'), render: v => v || '—' },
    { key: 'phone', label: t('phone', 'Phone'), render: v => v || '—' },
    {
      key: 'remaining_balance',
      label: t('customerBalance', 'Balance'),
      render: (_, row) => {
        const remaining = Number(row.remaining_balance || 0);
        const credit = Number(row.credit_balance || 0);
        if (remaining > 0) {
          return <Badge variant="danger">{t('balanceDue', 'عليه')} {money(remaining)} {t('currency', 'ج.م')}</Badge>;
        }
        if (credit > 0) {
          return <Badge variant="success">{t('balanceCredit', 'له')} {money(credit)} {t('currency', 'ج.م')}</Badge>;
        }
        return <Badge variant="success">{t('clear', 'Clear')}</Badge>;
      },
    },
    { key: 'city', label: t('city', 'City'), render: v => v || '—' },
    { key: 'country', label: t('country', 'Country'), render: v => v || '—' },
    { key: 'created_at', label: t('since', 'Since'), render: v => new Date(v).toLocaleDateString() },
    { key: 'actions', label: '', render: (_, row) => <Btn size="sm" onClick={() => openLedger(row)}>{t('ledger', 'Ledger')}</Btn> },
  ];

  const ledgerOrders = ledger?.orders || [];
  const paymentRows = ledger?.payments || [];
  const summary = ledger?.summary || {};
  const fmt = (v) => `${money(v)} ${t('currency', 'ج.م')}`;
  const balanceText = (b) => {
    if (b > 0.005) return `${t('balanceDue', 'عليه')} ${fmt(b)}`;
    if (b < -0.005) return `${t('balanceCredit', 'له')} ${fmt(-b)}`;
    return t('clear', 'صفر');
  };
  const statement = buildStatement({ orders: ledgerOrders, payments: paymentRows, from: stmtFrom, to: stmtTo });

  const printStatement = () => {
    const html = buildStatementPrintHtml({ customer: selectedCustomer, statement, from: stmtFrom, to: stmtTo });
    printHtmlDocument(html, { title: `statement-${selectedCustomer?.id || ''}` });
  };

  const paymentColumns = [
    { key: 'payment_date', label: t('paymentDate', 'Payment date'), render: v => v ? String(v).slice(0, 10) : '—' },
    { key: 'amount', label: t('amount', 'Amount'), render: v => <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{fmt(v)}</span> },
    {
      key: 'evidence_url',
      label: t('evidence', 'Evidence'),
      render: (_, row) => row.evidence_url ? (
        <a href={resolveApiAssetUrl(row.evidence_url)} target="_blank" rel="noreferrer" style={{ color: 'var(--info)' }}>
          {row.evidence_name || t('viewFile', 'View file')}
        </a>
      ) : '—',
    },
    { key: 'notes', label: t('notes', 'Notes'), render: v => v || '—' },
    {
      key: 'actions',
      label: '',
      render: (_, row) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <Btn size="sm" variant="secondary" onClick={() => openEditPayment(row)}>
            {t('edit', 'Edit')}
          </Btn>
          <Btn size="sm" variant="danger" onClick={() => openDeletePayment(row)}>
            {t('delete', 'Delete')}
          </Btn>
        </div>
      ),
    },
  ];

  const tabBtn = (key, label, count) => (
    <button
      type="button"
      onClick={() => setLedgerTab(key)}
      style={{
        padding: '8px 16px',
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: ledgerTab === key ? 'var(--accent)' : 'var(--bg-hover)',
        color: ledgerTab === key ? '#ffffff' : 'var(--text-secondary)',
        fontWeight: 700,
        fontSize: 13,
        cursor: 'pointer',
      }}
    >
      {label}{count !== undefined ? ` (${count})` : ''}
    </button>
  );

  const th = { padding: '8px 10px', textAlign: 'start', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, borderBottom: '1px solid var(--border)' };
  const td = { padding: '8px 10px', fontSize: 13, borderBottom: '1px solid var(--border)', verticalAlign: 'top' };
  const num = { ...td, textAlign: 'end', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };

  let ledgerBody = <Spinner />;
  if (ledgerError) {
    ledgerBody = <ErrorMsg msg={ledgerError} />;
  } else if (!ledgerLoading) {
    const due = Number(summary.remaining_balance || 0);
    const credit = Number(summary.credit_balance || 0);
    ledgerBody = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12 }}>
          <MetricCard label={t('totalOrdered', 'Total ordered')} value={fmt(summary.total_ordered)} />
          <MetricCard label={t('totalPaid', 'Total paid')} value={fmt(summary.total_paid)} color="var(--accent)" />
          <MetricCard
            label={t('customerBalance', 'Balance')}
            value={balanceText(due > 0 ? due : -credit)}
            color={due > 0 ? 'var(--danger)' : 'var(--accent)'}
          />
          <MetricCard label={t('productsTaken', 'Products taken')} value={`${Number(summary.total_products || 0).toLocaleString('en-US')} ${t('pcs', 'ق')}`} />
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {tabBtn('statement', t('tabStatement', 'كشف الحساب'))}
          {tabBtn('deliveries', t('tabDeliveries', 'التسليمات'), ledgerOrders.length)}
          {tabBtn('payments', t('tabPayments', 'الدفعات'), paymentRows.length)}
        </div>

        {ledgerTab === 'statement' && (
          <Card padding="0">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'end', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 170 }}><Input label={t('fromDate', 'من')} type="date" value={stmtFrom} onChange={e => setStmtFrom(e.target.value)} /></div>
              <div style={{ width: 170 }}><Input label={t('toDate', 'إلى')} type="date" value={stmtTo} onChange={e => setStmtTo(e.target.value)} /></div>
              {(stmtFrom || stmtTo) && <Btn size="sm" onClick={() => { setStmtFrom(''); setStmtTo(''); }}>{t('allPeriods', 'كل الفترات')}</Btn>}
              <div style={{ flex: 1 }} />
              <Btn variant="primary" onClick={printStatement}>🖨️ {t('printStatement', 'طباعة كشف الحساب')}</Btn>
            </div>
            <div style={{ overflowX: 'auto', maxHeight: 460, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)' }}>
                  <tr>
                    <th style={th}>{t('stmtDate', 'التاريخ')}</th>
                    <th style={th}>{t('stmtDescription', 'البيان')}</th>
                    <th style={{ ...th, textAlign: 'end' }}>{t('stmtDebit', 'عليه')}</th>
                    <th style={{ ...th, textAlign: 'end' }}>{t('stmtCredit', 'له')}</th>
                    <th style={{ ...th, textAlign: 'end' }}>{t('stmtBalance', 'الرصيد')}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ background: 'var(--bg-hover)' }}>
                    <td style={td} colSpan={4}><strong>{t('openingBalance', 'رصيد أول المدة')}</strong></td>
                    <td style={{ ...num, fontWeight: 700 }}>{balanceText(statement.opening)}</td>
                  </tr>
                  {statement.rows.length === 0 && (
                    <tr><td style={{ ...td, color: 'var(--text-muted)' }} colSpan={5}>{t('noMovements', 'لا توجد حركات في هذه الفترة')}</td></tr>
                  )}
                  {statement.rows.map((r) => (
                    <tr key={r.key}>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.date}</td>
                      <td style={td}>
                        <span style={{
                          display: 'inline-block',
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 4,
                          marginInlineEnd: 6,
                          background: r.type === 'delivery' ? 'rgba(220, 38, 38, 0.1)' : 'rgba(5, 150, 105, 0.1)',
                          color: r.type === 'delivery' ? '#dc2626' : '#059669',
                        }}>
                          {r.type === 'delivery' ? t('typeDelivery', 'تسليم') : t('typePayment', 'دفعة')}
                        </span>
                        {r.description}
                      </td>
                      <td style={{ ...num, color: '#dc2626' }}>{r.debit ? money(r.debit) : ''}</td>
                      <td style={{ ...num, color: '#059669' }}>{r.credit ? money(r.credit) : ''}</td>
                      <td style={{ ...num, fontWeight: 700 }}>{balanceText(r.balance)}</td>
                    </tr>
                  ))}
                  <tr style={{ background: 'var(--bg-hover)', fontWeight: 700 }}>
                    <td style={td} colSpan={2}>{t('periodTotal', 'إجمالي الفترة')}</td>
                    <td style={{ ...num, color: '#dc2626' }}>{money(statement.totalDebit)}</td>
                    <td style={{ ...num, color: '#059669' }}>{money(statement.totalCredit)}</td>
                    <td style={num} />
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ padding: '12px 14px', fontSize: 15, fontWeight: 800, borderTop: '1px solid var(--border)' }}>
              {t('closingBalance', 'الرصيد الختامي')}: <span style={{ color: statement.closing > 0 ? 'var(--danger)' : 'var(--accent)' }}>{balanceText(statement.closing)}</span>
            </div>
          </Card>
        )}

        {ledgerTab === 'deliveries' && (
          <Card padding="0">
            {!ledgerOrders.length ? (
              <div style={{ padding: '20px 16px', color: 'var(--text-muted)', fontSize: 13 }}>{t('noOrdersYet', 'No orders for this customer yet.')}</div>
            ) : (
              <div style={{ overflowX: 'auto', maxHeight: 520, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)' }}>
                    <tr>
                      <th style={th}>{t('stmtDate', 'التاريخ')}</th>
                      <th style={th}>{t('model', 'الموديل')}</th>
                      <th style={th}>{t('color', 'اللون')}</th>
                      <th style={{ ...th, textAlign: 'end' }}>{t('quantity', 'الكمية')}</th>
                      <th style={{ ...th, textAlign: 'end' }}>{t('unitPrice', 'سعر القطعة')}</th>
                      <th style={{ ...th, textAlign: 'end' }}>{t('lineTotal', 'الإجمالي')}</th>
                      <th style={th}>{t('payment', 'الدفع')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...ledgerOrders].sort((a, b) => String(b.order_date).localeCompare(String(a.order_date)) || b.id - a.id).map((row) => {
                      const items = orderItems(row);
                      const lines = items.length ? items : [{ product_name: row.order_number || `#${row.id}`, color: '', quantity: Number(row.total_products || 0), unit_price: 0, line_total: Number(row.total_amount || 0) }];
                      return lines.map((item, idx) => (
                        <tr key={`${row.id}-${idx}`}>
                          {idx === 0 && <td style={{ ...td, whiteSpace: 'nowrap' }} rowSpan={lines.length}>{String(row.order_date || '').slice(0, 10)}</td>}
                          <td style={{ ...td, fontWeight: 700 }}>{item.product_name}</td>
                          <td style={td}>{item.color || '—'}</td>
                          <td style={num}>{item.quantity.toLocaleString('en-US')}</td>
                          <td style={num}>{item.unit_price ? money(item.unit_price) : '—'}</td>
                          <td style={{ ...num, fontWeight: 700 }}>{money(item.line_total)}</td>
                          {idx === 0 && (
                            <td style={td} rowSpan={lines.length}>
                              <Badge variant={statusVariant(row.payment_status)}>
                                {row.payment_status === 'paid' ? t('payPaid', 'مدفوع')
                                  : row.payment_status === 'pending' ? t('payPending', 'غير مدفوع')
                                    : t('payPartial', 'مدفوع جزئياً')}
                              </Badge>
                            </td>
                          )}
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {ledgerTab === 'payments' && (
          <>
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12 }}>{t('addPayment', 'Add payment')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto', gap: 10, alignItems: 'end' }}>
                <Input label={t('paymentDate', 'Payment date')} type="date" value={paymentForm.payment_date} onChange={e => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} />
                <Input label={`${t('amount', 'Amount')} (${t('currency', 'ج.م')})`} type="number" min="0.01" value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
                <Input label={t('notes', 'Notes')} value={paymentForm.notes} onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })} />
                <Btn variant="primary" onClick={handleAddPayment} disabled={paymentSaving || !paymentForm.amount} aria-busy={paymentSaving}>
                  {paymentSaving ? <Spinner /> : t('addPayment', 'Add payment')}
                </Btn>
              </div>
              <div style={{ marginTop: 10, maxWidth: 340 }}>
                <Input
                  label={t('evidence', 'Evidence (screenshot or PDF)')}
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={e => setPaymentEvidence(e.target.files?.[0] || null)}
                />
              </div>
              {paymentError && <div style={{ marginTop: 12 }}><ErrorMsg msg={paymentError} /></div>}
            </Card>
            <Card padding="0">
              <div style={{ padding: '14px 16px', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>{t('paymentHistory', 'سجل الدفعات')}</div>
              <Table columns={paymentColumns} data={paymentRows} emptyMsg={t('noPaymentsYet', 'No payments recorded yet.')} />
            </Card>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 28px 40px' }}>
      <PageHeader title={t('addCustomer', 'Customers')} subtitle={t('manageClientAccounts', 'Manage your client accounts')}
        action={<Btn variant="primary" onClick={() => { setForm(emptyForm); setShowModal(true); }}>{t('addCustomer', '+ Add customer')}</Btn>}
      />
      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}
      {!loading && (
        <>
          <Card padding="12px 16px" style={{ marginBottom: 16 }}>
            <SearchInput 
              placeholder={t('searchCustomers', 'ابحث بالاسم أو التليفون أو المدينة...')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </Card>
          <Card padding="0"><Table columns={columns} data={filteredCustomers} /></Card>
        </>
      )}

      {successMsg && <div style={{color:'var(--accent)',margin:'12px 0',fontWeight:600}}>{successMsg}</div>}

      {showModal && (
        <Modal title={t('addCustomer', 'Add customer')} onClose={() => setShowModal(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}><Input label={t('addCustomer', 'Company / Customer name')} value={form.name} onChange={f('name')} /></div>
            <Input label={t('email', 'Email')} type="email" value={form.email} onChange={f('email')} />
            <Input label={t('phone', 'Phone')} value={form.phone} onChange={f('phone')} />
            <Input label={t('city', 'City')} value={form.city} onChange={f('city')} />
            <Input label={t('country', 'Country')} value={form.country} onChange={f('country')} />
            <div style={{ gridColumn: '1/-1' }}><Input label={t('address', 'Address')} value={form.address} onChange={f('address')} /></div>
          </div>
          {formError && <div style={{color:'var(--danger)',marginTop:10}}>{formError}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <Btn onClick={() => setShowModal(false)} disabled={saving}>{t('cancel', 'Cancel')}</Btn>
            <Btn variant="primary" onClick={handleCreate} disabled={saving || !!validateForm()} aria-busy={saving}>
              {saving ? <Spinner /> : t('save', 'Save')}
            </Btn>
          </div>
        </Modal>
      )}

      {showLedger && (
        <Modal title={`${t('customerLedger', 'Customer ledger')} — ${selectedCustomer?.name || ''}`} onClose={() => setShowLedger(false)} width={980}>
          {ledgerBody}
        </Modal>
      )}

      {editingPayment && (
        <Modal
          title={t('editPayment', 'Edit Payment')}
          onClose={() => setEditingPayment(null)}
          width={520}
          zIndex={120}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input
                label={t('paymentDate', 'Payment date')}
                type="date"
                value={editPaymentForm.payment_date}
                onChange={e => setEditPaymentForm({ ...editPaymentForm, payment_date: e.target.value })}
              />
              <Input
                label={t('amount', 'Amount')}
                type="number"
                step="any"
                min="0.01"
                value={editPaymentForm.amount}
                onChange={e => setEditPaymentForm({ ...editPaymentForm, amount: e.target.value })}
              />
            </div>

            <Input
              label={t('notes', 'Notes')}
              value={editPaymentForm.notes}
              onChange={e => setEditPaymentForm({ ...editPaymentForm, notes: e.target.value })}
              placeholder={t('notesPlaceholder', 'Payment notes / description')}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input
                label={t('paymentMethod', 'Payment method')}
                value={editPaymentForm.payment_method}
                onChange={e => setEditPaymentForm({ ...editPaymentForm, payment_method: e.target.value })}
                placeholder="e.g. cash, bank, check"
              />
              <Input
                label={t('referenceNumber', 'Reference #')}
                value={editPaymentForm.reference_number}
                onChange={e => setEditPaymentForm({ ...editPaymentForm, reference_number: e.target.value })}
                placeholder="Ref / Check number"
              />
            </div>

            <div>
              <Input
                label={t('newEvidence', 'Update Evidence (optional)')}
                type="file"
                accept="image/*,application/pdf"
                onChange={e => setEditPaymentEvidence(e.target.files?.[0] || null)}
              />
              {editingPayment.evidence_url && !editPaymentEvidence && (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {t('currentFile', 'Current file')}:{' '}
                  <a href={resolveApiAssetUrl(editingPayment.evidence_url)} target="_blank" rel="noreferrer" style={{ color: 'var(--info)' }}>
                    {editingPayment.evidence_name || t('viewFile', 'View current evidence')}
                  </a>
                </div>
              )}
            </div>

            {editPaymentError && <ErrorMsg msg={editPaymentError} />}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
              <Btn onClick={() => setEditingPayment(null)} disabled={editPaymentSaving}>
                {t('cancel', 'Cancel')}
              </Btn>
              <Btn
                variant="primary"
                onClick={handleUpdatePayment}
                disabled={editPaymentSaving || !editPaymentForm.amount}
                aria-busy={editPaymentSaving}
              >
                {editPaymentSaving ? <Spinner /> : t('saveChanges', 'Save changes')}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {deletePaymentTarget && (
        <Modal
          title={t('deletePaymentTitle', 'Delete Payment')}
          onClose={() => setDeletePaymentTarget(null)}
          width={440}
          zIndex={120}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {t('confirmDeletePaymentMsg', 'Are you sure you want to delete this payment of')}{' '}
              <strong style={{ color: 'var(--accent)', margin: '0 4px' }}>
                {fmt(deletePaymentTarget.amount)}
              </strong>
              {deletePaymentTarget.payment_date ? ` (${String(deletePaymentTarget.payment_date).slice(0, 10)})` : ''}?
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {t('deletePaymentWarning', 'This will revert invoice allocations and recalculate the customer ledger balance.')}
            </div>

            {deletePaymentError && <ErrorMsg msg={deletePaymentError} />}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
              <Btn onClick={() => setDeletePaymentTarget(null)} disabled={deletePaymentSaving}>
                {t('cancel', 'Cancel')}
              </Btn>
              <Btn
                variant="danger"
                onClick={handleDeletePayment}
                disabled={deletePaymentSaving}
              >
                {deletePaymentSaving ? t('deleting', 'Deleting…') : t('delete', 'Delete')}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
