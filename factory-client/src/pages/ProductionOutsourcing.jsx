import React, { useMemo, useState } from 'react';
import { employeeApi, productionTrackingApi } from '../api';
import { useFetch } from '../hooks/useFetch';
import { PageHeader, Card, Btn, Input, Select, Spinner, ErrorMsg } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';

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
  const { data: machines } = useFetch(productionTrackingApi.machines);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [machineId, setMachineId] = useState('');
  const [lossReason, setLossReason] = useState('');
  const [startedAt, setStartedAt] = useState(defaultStart());
  const [completedAt, setCompletedAt] = useState(defaultEnd());
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState('');

  const selected = useMemo(
    () => (orders || []).find((o) => String(o.id) === String(selectedOrderId)),
    [orders, selectedOrderId]
  );

  // Filter orders to show only those with 'sorting' as latest phase
  const availableOrders = useMemo(
    () => (orders || []).filter((o) => o.latest_phase === 'sorting'),
    [orders]
  );

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
        loss_reason: lossReason.trim() || null,
        employee_id: Number(employeeId),
        machine_id: machineId ? Number(machineId) : null,
        started_at: started.toISOString(),
        completed_at: completed.toISOString(),
      });
      setSuccess(`${t('outsourcingSaved', 'Outsourcing phase saved.')} Loss: ${report.outsourcing_loss ?? 0}`);
      setQuantity('');
      setLossReason('');
      setMachineId('');
      setStartedAt(defaultStart());
      setCompletedAt(defaultEnd());
      await refetch();
    } catch (e) {
      setSubmitError(e.message || t('outsourcingFailed', 'Failed to save outsourcing phase.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '28px 28px 40px' }}>
      <PageHeader title={t('outsourcing', 'Outsourcing Phase')} subtitle={t('outsourcingSubtitle', 'Send items to external vendors for specialized processing')} />

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}

      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Select label={t('selectProductionOrder', 'Production Order')} value={selectedOrderId} onChange={(e) => setSelectedOrderId(e.target.value)}>
            <option value="">{t('chooseOrder', 'Select order')}</option>
            {availableOrders.map((order) => (
              <option key={order.id} value={order.id}>
                {order.order_number} - {order.model_number} ({order.status})
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
          <Select label={t('machine', 'Machine (optional)')} value={machineId} onChange={(e) => setMachineId(e.target.value)}>
            <option value="">{t('machine', 'No machine')}</option>
            {(machines || []).map((machine) => (
              <option key={machine.id} value={machine.id}>{machine.name}</option>
            ))}
          </Select>
          <Input label={t('startDate', 'Start Time')} type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
          <Input label={t('dueDate', 'End Time')} type="datetime-local" value={completedAt} onChange={(e) => setCompletedAt(e.target.value)} />
          <div style={{ gridColumn: '1/-1' }}>
            <Input label={t('loss', 'Loss Reason (optional)')} value={lossReason} onChange={(e) => setLossReason(e.target.value)} placeholder="External rejection, quality issues..." />
          </div>
        </div>

        {selected && (
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
            Sorted Quantity: {selected.sorting ?? selected.planned_quantity}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <Btn variant="primary" onClick={handleSubmit} disabled={saving}>{saving ? t('saving', 'Saving…') : t('outsourcingSaveBtn', 'Save Outsourcing Phase')}</Btn>
        </div>

        {submitError && <div style={{ marginTop: 12 }}><ErrorMsg msg={submitError} /></div>}
        {success && <div style={{ marginTop: 12, color: 'var(--accent)', fontSize: 13 }}>{success}</div>}
      </Card>
    </div>
  );
}
