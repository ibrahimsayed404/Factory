import React, { useEffect, useMemo, useState } from 'react';
import { employeeApi, productApi, productionTrackingApi } from '../api';
import { useFetch } from '../hooks/useFetch';
import { PageHeader, Card, Btn, Input, Select, Spinner, ErrorMsg, Modal, OrderDetailsSummary } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { buildProductNameLookup, formatOrderOptionLabel } from '../utils/productionOrderDisplay';

const toLocalDatetimeInput = (date) => {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

const defaultStart = () => {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  return toLocalDatetimeInput(now);
};

const defaultEnd = () => {
  const end = new Date();
  end.setMinutes(0, 0, 0);
  end.setHours(end.getHours() + 2);
  return toLocalDatetimeInput(end);
};

export default function ProductionOutsourcing() {
  const { t } = useLanguage();
  const { data: orders, loading, error, refetch } = useFetch(productionTrackingApi.list);
  const { data: employees } = useFetch(employeeApi.list);
  const { data: products } = useFetch(productApi.list);
  const { data: partnerFactories, refetch: refetchFactories } = useFetch(productionTrackingApi.partnerFactories);
  const productNameById = useMemo(() => buildProductNameLookup(products), [products]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [partnerFactoryId, setPartnerFactoryId] = useState('');
  const [lossReason, setLossReason] = useState('');
  const [colorRows, setColorRows] = useState([{ id: 'c1', color: '', quantity: '' }]);
  const [startedAt, setStartedAt] = useState(defaultStart());
  const [completedAt, setCompletedAt] = useState(defaultEnd());
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddFactory, setShowAddFactory] = useState(false);
  const [factoryForm, setFactoryForm] = useState({ name: '', contact_person: '', phone: '' });
  const [factorySaving, setFactorySaving] = useState(false);
  const [factoryError, setFactoryError] = useState('');
  const [orderReport, setOrderReport] = useState(null);

  const selected = useMemo(
    () => (orders || []).find((o) => String(o.id) === String(selectedOrderId)),
    [orders, selectedOrderId]
  );
  const updateColorRow = (index, field, value) => setColorRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  const addColorRow = () => setColorRows((prev) => [...prev, { id: `c${Date.now()}-${Math.random()}`, color: '', quantity: '' }]);
  const removeColorRow = (index) => setColorRows((prev) => prev.filter((_, i) => i !== index));

  const availableOrders = useMemo(
    () => (orders || []).filter((o) => o.phases?.sorting !== null && o.phases?.outsourcing === null),
    [orders]
  );

  useEffect(() => {
    const totalColorQty = colorRows
      .reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);
    if (totalColorQty > 0) {
      setQuantity(String(totalColorQty));
    }
  }, [colorRows]);

  const handleAddFactory = async () => {
    const name = factoryForm.name.trim();
    if (!name) {
      setFactoryError(t('partnerFactoryNameRequired', 'Partner factory name is required.'));
      return;
    }

    setFactorySaving(true);
    setFactoryError('');
    try {
      const created = await productionTrackingApi.createPartnerFactory({
        name,
        contact_person: factoryForm.contact_person.trim() || null,
        phone: factoryForm.phone.trim() || null,
      });
      await refetchFactories();
      setPartnerFactoryId(String(created.id));
      setShowAddFactory(false);
      setFactoryForm({ name: '', contact_person: '', phone: '' });
    } catch (e) {
      setFactoryError(e.message || t('partnerFactoryCreateFailed', 'Failed to add partner factory.'));
    } finally {
      setFactorySaving(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitError('');
    setSuccess('');

    if (!selectedOrderId) {
      setSubmitError(t('chooseOrder', 'Please choose an order.'));
      return;
    }
    if (!employeeId) {
      setSubmitError(t('employee', 'Please choose the responsible employee.'));
      return;
    }

    const started = new Date(startedAt);
    const completed = new Date(completedAt);
    if (Number.isNaN(started.getTime()) || Number.isNaN(completed.getTime()) || completed <= started) {
      setSubmitError(t('date', 'End time must be greater than start time.'));
      return;
    }

    const q = Number.parseInt(quantity, 10);
    if (!Number.isInteger(q) || q < 0) {
      setSubmitError(t('outsourcingQtyError', 'Outsourcing quantity must be a non-negative integer.'));
      return;
    }

    setSaving(true);
    try {
      const report = await productionTrackingApi.addOutsourcing(selectedOrderId, {
        quantity: q,
        color_breakdown: colorRows
          .filter((row) => row.color && row.quantity)
          .map((row) => ({ color: row.color, quantity: Number(row.quantity) })),
        loss_reason: lossReason.trim() || null,
        employee_id: Number(employeeId),
        partner_factory_id: partnerFactoryId ? Number(partnerFactoryId) : null,
        started_at: started.toISOString(),
        completed_at: completed.toISOString(),
      });
      setSuccess(`${t('outsourcingSaved', 'Outsourcing phase saved.')} Loss: ${report.outsourcing_loss ?? 0}`);
      setQuantity('');
      setLossReason('');
      setColorRows([{ id: 'c1', color: '', quantity: '' }]);
      setPartnerFactoryId('');
      setStartedAt(defaultStart());
      setCompletedAt(defaultEnd());
      await refetch();
    } catch (e) {
      setSubmitError(e.message || t('outsourcingFailed', 'Failed to save outsourcing phase.'));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (!selectedOrderId) {
      setColorRows([{ id: 'c1', color: '', quantity: '' }]);
      setOrderReport(null);
      return undefined;
    }

    const loadOrderReport = async () => {
      try {
        const report = await productionTrackingApi.getReport(selectedOrderId);
        if (!isMounted) return;
        setOrderReport(report);
        const inputPhase = (report?.phases || []).find((phase) => phase.phase === 'input');
        const breakdown = Array.isArray(inputPhase?.color_breakdown) ? inputPhase.color_breakdown : [];
        if (breakdown.length > 0) {
          setColorRows(breakdown.map((item, index) => ({
            id: `c${Date.now()}-${index}`,
            color: item.color || '',
            quantity: item.quantity !== null && item.quantity !== undefined ? String(item.quantity) : '',
          })));
        } else {
          setColorRows([{ id: 'c1', color: '', quantity: '' }]);
        }
      } catch (err) {
        console.error('Failed to load production order report', err);
      }
    };

    loadOrderReport();
    return () => {
      isMounted = false;
    };
  }, [selectedOrderId]);

  return (
    <div style={{ padding: '28px 28px 40px' }}>
      <PageHeader title={t('outsourcing', 'Outsourcing Phase')} subtitle={t('outsourcingSubtitle', 'Send items to an external partner factory for specialized processing')} />

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}

      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Select label={t('selectProductionOrder', 'Production Order')} value={selectedOrderId} onChange={(e) => setSelectedOrderId(e.target.value)}>
            <option value="">{t('chooseOrder', 'Select order')}</option>
            {availableOrders.map((order) => (
              <option key={order.id} value={order.id}>
                {formatOrderOptionLabel(order)}
              </option>
            ))}
          </Select>
          <Input label={t('outsourcingQty', 'Outsourcing Quantity')} type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <Select label={t('employee', 'Responsible Employee')} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">{t('selectEmployee', 'Select employee')}</option>
            {(employees || []).map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </Select>
          <div>
            <Select label={t('partnerFactory', 'Partner Factory')} value={partnerFactoryId} onChange={(e) => setPartnerFactoryId(e.target.value)}>
              <option value="">{t('selectPartnerFactory', 'Select partner factory')}</option>
              {(partnerFactories || []).map((factory) => (
                <option key={factory.id} value={factory.id}>{factory.name}</option>
              ))}
            </Select>
            <Btn size="sm" onClick={() => { setFactoryError(''); setShowAddFactory(true); }} style={{ marginTop: 8 }}>
              {t('addPartnerFactory', '+ Add partner factory')}
            </Btn>
          </div>
          <Input label={t('startDate', 'Start Time')} type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
          <Input label={t('dueDate', 'End Time')} type="datetime-local" value={completedAt} onChange={(e) => setCompletedAt(e.target.value)} />
          <div style={{ gridColumn: '1/-1' }}>
            <Input label={t('loss', 'Loss Reason (optional)')} value={lossReason} onChange={(e) => setLossReason(e.target.value)} placeholder="External rejection, quality issues..." />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <strong>{t('colors', 'Color quantities')}</strong>
              <Btn size="sm" onClick={addColorRow}>{t('addItem', '+ Add color')}</Btn>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {colorRows.map((row, index) => (
                <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
                  <Input value={row.color} onChange={(e) => updateColorRow(index, 'color', e.target.value)} placeholder={t('color', 'Color')} />
                  <Input type="number" min="0" value={row.quantity} onChange={(e) => updateColorRow(index, 'quantity', e.target.value)} placeholder={t('qty', 'Quantity')} />
                  <Btn size="sm" variant="danger" onClick={() => removeColorRow(index)} disabled={colorRows.length === 1}>{t('remove', 'Remove')}</Btn>
                </div>
              ))}
            </div>
          </div>
        </div>

        <OrderDetailsSummary
          order={selected}
          orderReport={orderReport}
          t={t}
          productNameById={productNameById}
          currentPhase="outsourcing"
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <Btn variant="primary" onClick={handleSubmit} disabled={saving}>{saving ? t('saving', 'Saving…') : t('outsourcingSaveBtn', 'Save Outsourcing Phase')}</Btn>
        </div>

        {submitError && <div style={{ marginTop: 12 }}><ErrorMsg msg={submitError} /></div>}
        {success && <div style={{ marginTop: 12, color: 'var(--accent)', fontSize: 13 }}>{success}</div>}
      </Card>

      {showAddFactory && (
        <Modal title={t('addPartnerFactory', 'Add partner factory')} onClose={() => setShowAddFactory(false)} width={420}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input label={t('partnerFactoryName', 'Factory name')} value={factoryForm.name} onChange={(e) => setFactoryForm({ ...factoryForm, name: e.target.value })} />
            <Input label={t('contactPerson', 'Contact person')} value={factoryForm.contact_person} onChange={(e) => setFactoryForm({ ...factoryForm, contact_person: e.target.value })} />
            <Input label={t('phone', 'Phone')} value={factoryForm.phone} onChange={(e) => setFactoryForm({ ...factoryForm, phone: e.target.value })} />
          </div>
          {factoryError && <div style={{ marginTop: 12 }}><ErrorMsg msg={factoryError} /></div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <Btn onClick={() => setShowAddFactory(false)} disabled={factorySaving}>{t('cancel', 'Cancel')}</Btn>
            <Btn variant="primary" onClick={handleAddFactory} disabled={factorySaving}>
              {factorySaving ? t('saving', 'Saving…') : t('save', 'Save')}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
