import React, { useState, useMemo } from 'react';
import { salesApi, resolveApiAssetUrl } from '../api';
import { useFetch } from '../hooks/useFetch';
import { PageHeader, Card, Table, Btn, Modal, Input, Spinner, ErrorMsg, MetricCard, Badge, statusVariant, SearchInput } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';

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
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteSaving, setDeleteSaving] = useState(false);
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

  const enrichLedgerOrders = async (orders = []) => Promise.all(
    (orders || []).map(async (order) => {
      try {
        const detailed = await salesApi.order(order.id);
        const detailedOrder = detailed?.data && typeof detailed.data === 'object' ? detailed.data : detailed;
        return {
          ...order,
          ...detailedOrder,
          items: Array.isArray(detailedOrder?.items) ? detailedOrder.items : Array.isArray(order?.items) ? order.items : [],
        };
      } catch {
        return order;
      }
    })
  );

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
    setLedgerLoading(true);
    setLedgerError('');
    setPaymentError('');
    setPaymentForm(emptyPaymentForm());
    setPaymentEvidence(null);
    try {
      const data = await salesApi.customerLedger(customer.id);
      setLedger({
        ...data,
        orders: await enrichLedgerOrders(data?.orders || []),
      });
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
      setLedger({
        ...data,
        orders: await enrichLedgerOrders(data?.orders || []),
      });
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
          return <Badge variant="danger">Due ${remaining.toLocaleString()}</Badge>;
        }
        if (credit > 0) {
          return <Badge variant="success">Credit ${credit.toLocaleString()}</Badge>;
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
  const getOrderItems = (row) => {
    const sourceItems = Array.isArray(row?.items)
      ? row.items
      : typeof row?.items === 'string'
        ? (() => {
            try {
              const parsed = JSON.parse(row.items);
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          })()
        : [];

    return sourceItems
      .map((item) => ({
        product_name: item?.product_name || item?.name || 'Item',
        color: item?.color || item?.colors || item?.variant_color || '',
        quantity: Number(item?.quantity || 0),
      }))
      .filter((item) => item.product_name);
  };
  const orderColumns = [
    { key: 'order_number', label: 'Order #' },
    { key: 'order_date', label: t('date', 'Date') },
    { key: 'total_products', label: t('productsTaken', 'Products') },
    { key: 'total_amount', label: t('totalOrdered', 'Total') },
    { key: 'paid_amount', label: t('totalPaid', 'Paid') },
    { key: 'balance', label: t('remaining', 'Remaining') },
    { key: 'payment_status', label: t('payment', 'Payment') },
    { key: 'status', label: t('status', 'Order status') },
    { key: 'details', label: t('details', 'Details') },
    { key: 'actions', label: '' },
  ];
  const paymentColumns = [
    { key: 'payment_date', label: t('paymentDate', 'Payment date'), render: v => v ? new Date(v).toLocaleDateString() : '—' },
    { key: 'amount', label: t('amount', 'Amount'), render: v => <span style={{ color: 'var(--accent)', fontWeight: 600 }}>+${Number(v || 0).toLocaleString()}</span> },
    {
      key: 'evidence_url',
      label: 'Evidence',
      render: (_, row) => row.evidence_url ? (
        <a href={resolveApiAssetUrl(row.evidence_url)} target="_blank" rel="noreferrer" style={{ color: 'var(--info)' }}>
          {row.evidence_name || t('viewFile', 'View file')}
        </a>
      ) : '—',
    },
    { key: 'notes', label: t('notes', 'Notes'), render: v => v || '—' },
  ];

  let ledgerBody = <Spinner />;
  if (ledgerError) {
    ledgerBody = <ErrorMsg msg={ledgerError} />;
  } else if (!ledgerLoading) {
    ledgerBody = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12 }}>
          <MetricCard label={t('productsTaken', 'Products taken')} value={summary.total_products || 0} />
          <MetricCard label={t('totalOrdered', 'Total ordered')} value={`$${Number(summary.total_ordered || 0).toLocaleString()}`} />
          <MetricCard label={t('totalPaid', 'Total paid')} value={`$${Number(summary.total_paid || 0).toLocaleString()}`} color="var(--accent)" />
          <MetricCard label={t('remaining', 'Remaining')} value={`$${Number(summary.remaining_balance || 0).toLocaleString()}`} color={Number(summary.remaining_balance || 0) > 0 ? 'var(--danger)' : 'var(--accent)'} />
        </div>

        <Card>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>{t('addPayment', 'ADD WEEKLY PAYMENT')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto', gap: 10, alignItems: 'end' }}>
            <Input label={t('paymentDate', 'Payment date')} type="date" value={paymentForm.payment_date} onChange={e => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} />
            <Input label={t('amount', 'Amount')} type="number" min="0.01" value={paymentForm.amount} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
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
          <div style={{ padding: '14px 16px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{t('customerLedger', 'CUSTOMER ORDERS')}</div>
          {!ledgerOrders.length ? (
            <div style={{ padding: '20px 16px', color: 'var(--text-muted)', fontSize: 13 }}>{t('noOrdersYet', 'No orders for this customer yet.')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 12px 12px' }}>
              {ledgerOrders.map((row) => {
                const items = getOrderItems(row);
                const remaining = Math.max(0, Number(row.total_amount || 0) - Number(row.paid_amount || 0));
                const displayOrderNumber = row.order_number || row.orderNo || row.order_no || `#${row.id}`;
                return (
                  <div key={row.id} style={{ padding: '10px 12px', backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 7px', borderRadius: 6, background: 'var(--accent-dim)', color: 'var(--accent)', fontWeight: 700, fontSize: 12, lineHeight: 1, fontFamily: 'var(--font-mono)' }}>
                          {displayOrderNumber}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
                          {row.order_date ? new Date(row.order_date).toLocaleDateString() : '—'} · {Number(row.total_products || 0)} pcs
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <Badge variant={statusVariant(row.payment_status)}>{row.payment_status}</Badge>
                        <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                        <Btn size="sm" variant="danger" onClick={async () => {
                          setDeleteTarget(row);
                          setDeletePassword('');
                          setDeleteError('');
                        }}>Delete</Btn>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2 }}>{t('totalOrdered', 'Total ordered')}</div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>${Number(row.total_amount || 0).toLocaleString()}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2 }}>{t('totalPaid', 'Total paid')}</div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>${Number(row.paid_amount || 0).toLocaleString()}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2 }}>{t('remaining', 'Remaining')}</div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>${remaining.toLocaleString()}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2 }}>{t('productsTaken', 'Products taken')}</div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{Number(row.total_products || 0)}</div>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>{t('orderItems', 'ORDER ITEMS')}</div>
                      {!items.length ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{String(row.details || row.order_details || row.items_details || '') || '—'}</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {items.map((item, idx) => (
                            <div key={`${row.id}-${idx}-${item.product_name}`} style={{ padding: '8px 10px', backgroundColor: 'var(--background-primary)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 0, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product_name}</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
                                <Badge variant="outline" style={{ display: 'flex', gap: 8, padding: '3px 7px', fontSize: 11, backgroundColor: 'var(--background-primary)' }}>
                                  <span style={{ fontWeight: 500 }}>{item.color || t('defaultColor', 'Default')}</span>
                                </Badge>
                                <Badge variant="outline" style={{ display: 'flex', gap: 8, padding: '3px 7px', fontSize: 11, backgroundColor: 'var(--background-primary)' }}>
                                  <span style={{ fontWeight: 500 }}>{item.quantity} {t('pcs', 'pcs')}</span>
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card padding="0">
          <div style={{ padding: '14px 16px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>PAYMENT HISTORY</div>
          <Table columns={paymentColumns} data={paymentRows} emptyMsg={t('noPaymentsYet', 'No payments recorded yet.')} />
        </Card>
      </div>
    );
  }

  const handleDeleteOrder = async () => {
    if (!deleteTarget) return;
    if (!deletePassword.trim()) {
      setDeleteError(t('passwordRequired', 'Password is required.'));
      return;
    }

    setDeleteSaving(true);
    setDeleteError('');
    try {
      await salesApi.delete(deleteTarget.id, { password: deletePassword });
      setDeleteTarget(null);
      setDeletePassword('');
      await reloadLedger();
    } catch (e) {
      setDeleteError(e.message || t('deleteFailed', 'Failed to delete order.'));
    } finally {
      setDeleteSaving(false);
    }
  };

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
              placeholder="Search by name, email, phone, city, country, or address..." 
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

      {deleteTarget && (
        <Modal title={t('deleteOrder', 'Delete Order')} onClose={() => setDeleteTarget(null)} width={420}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {t('confirmDeleteOrder', 'Enter your password to confirm deleting order')} {deleteTarget.order_number}.
            </div>
            <Input
              label={t('confirmPassword', 'Enter your password to confirm')}
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
            />
            {deleteError && <ErrorMsg msg={deleteError} />}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Btn onClick={() => setDeleteTarget(null)} disabled={deleteSaving}>{t('cancel', 'Cancel')}</Btn>
              <Btn variant="danger" onClick={handleDeleteOrder} disabled={deleteSaving}>
                {deleteSaving ? t('deleting', 'Deleting…') : t('delete', 'Delete')}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
