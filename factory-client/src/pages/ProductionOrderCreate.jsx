import React, { useState } from 'react';
import { inventoryApi, productionTrackingApi } from '../api';
import { useFetch } from '../hooks/useFetch';
import { PageHeader, Card, Btn, Input, Select, Spinner, ErrorMsg, Table } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';

const createEmptyMaterial = () => ({
  id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  material_id: '',
  quantity: '',
});

export default function ProductionOrderCreate() {
  const { t } = useLanguage();
  const { data: materials, loading } = useFetch(inventoryApi.list);
  const [modelNumber, setModelNumber] = useState('');
  const [quantity, setQuantity] = useState('');
  const [rows, setRows] = useState([createEmptyMaterial()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lastCreated, setLastCreated] = useState(null);

  const updateRow = (index, key, value) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };

  const addRow = () => setRows((prev) => [...prev, createEmptyMaterial()]);
  const removeRow = (index) => setRows((prev) => prev.filter((_, i) => i !== index));

  const validate = () => {
    if (!modelNumber.trim()) return t('modelNumber', 'Model number is required.');
    const q = Number.parseInt(quantity, 10);
    if (!Number.isInteger(q) || q <= 0) return t('plannedQuantity', 'Quantity must be a positive integer.');

    for (const row of rows) {
      if (!row.material_id && !row.quantity) continue;
      if (!row.material_id) return t('materials', 'Each material row needs a material.');
      const qty = Number(row.quantity);
      if (!Number.isFinite(qty) || qty <= 0) return t('qtyUsed', 'Each material quantity must be > 0.');
    }

    return '';
  };

  const handleSubmit = async () => {
    setError('');
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        model_number: modelNumber.trim(),
        quantity: Number.parseInt(quantity, 10),
        materials: rows
          .filter((row) => row.material_id && row.quantity)
          .map((row) => ({
            material_id: Number.parseInt(row.material_id, 10),
            quantity: Number(row.quantity),
          })),
      };

      const created = await productionTrackingApi.createOrder(payload);
      setLastCreated(created);
      setModelNumber('');
      setQuantity('');
      setRows([createEmptyMaterial()]);
    } catch (e) {
      setError(e.message || t('createProductionOrder', 'Failed to create production order.'));
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'phase', label: t('phase', 'Phase') },
    { key: 'quantity', label: t('quantity', 'Quantity') },
  ];

  const phaseRows = lastCreated
    ? [
      { phase: 'Input', quantity: lastCreated.phases?.input ?? '—' },
      { phase: 'Sorting', quantity: lastCreated.phases?.sorting ?? '—' },
      { phase: 'Final', quantity: lastCreated.phases?.final ?? '—' },
    ]
    : [];

  return (
    <div style={{ padding: '28px 28px 40px' }}>
      <PageHeader title={t('createProductionOrder', 'Create Production Order')} subtitle={t('inputPhaseMaterialConsumption', 'Input phase + material consumption')} />

      {loading && <Spinner />}

      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input label={t('modelNumber', 'Model Number')} value={modelNumber} onChange={(e) => setModelNumber(e.target.value)} />
          <Input label={t('plannedQuantity', 'Planned Quantity')} type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>

        <div style={{ marginTop: 16, marginBottom: 10, fontSize: 13, color: 'var(--text-secondary)' }}>{t('materials', 'Materials')}</div>

        {rows.map((row, index) => (
          <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 10, marginBottom: 10 }}>
            <Select value={row.material_id} onChange={(e) => updateRow(index, 'material_id', e.target.value)}>
              <option value="">{t('selectEmployee', 'Select material')}</option>
              {(materials || []).map((m) => (
                <option key={m.id} value={m.id}>{m.name} (stock: {m.quantity})</option>
              ))}
            </Select>
            <Input type="number" min="0.01" step="0.01" value={row.quantity} onChange={(e) => updateRow(index, 'quantity', e.target.value)} placeholder={t('qtyUsed', 'Qty used')} />
            <Btn size="sm" variant="danger" onClick={() => removeRow(index)} disabled={rows.length === 1}>{t('remove', 'Remove')}</Btn>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 14 }}>
          <Btn onClick={addRow}>{t('addItem', '+ Add Material')}</Btn>
          <Btn variant="primary" onClick={handleSubmit} disabled={saving}>{saving ? t('saving', 'Creating…') : t('createOrder', 'Create Order')}</Btn>
        </div>

        {error && <div style={{ marginTop: 12 }}><ErrorMsg msg={error} /></div>}
      </Card>

      {lastCreated && (
        <Card style={{ marginTop: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{t('lastCreatedOrder', 'Last Created Order')}</div>
          <div style={{ marginBottom: 10, fontSize: 13 }}>
            {lastCreated.order_number} - {lastCreated.model_number}
          </div>
          <Table columns={columns} data={phaseRows} />
        </Card>
      )}
    </div>
  );
}
