import React, { useMemo, useState } from 'react';
import { inventoryApi, productionTrackingApi, productApi } from '../api';
import { useFetch } from '../hooks/useFetch';
import { PageHeader, Card, Btn, Input, Select, Spinner, ErrorMsg, Table } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { buildProductNameLookup, getOrderDisplayNumber, getOrderProductName } from '../utils/productionOrderDisplay';

const createEmptyMaterial = () => ({
  id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  material_id: '',
  color: '',
  output_quantity: '',
  material_quantity: '',
});

const splitColors = (value) => String(value || '')
  .split(',')
  .map((color) => color.trim())
  .filter(Boolean);

export default function ProductionOrderCreate() {
  const { t } = useLanguage();
  const { data: materials, loading: materialsLoading } = useFetch(inventoryApi.list);
  const { data: products, loading: productsLoading } = useFetch(productApi.list);
  const { data: orders } = useFetch(productionTrackingApi.list);
  const loading = materialsLoading || productsLoading;
  const [productId, setProductId] = useState('');
  const [productNumber, setProductNumber] = useState('');
  const [rows, setRows] = useState([createEmptyMaterial()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lastCreated, setLastCreated] = useState(null);

  const selectedProduct = useMemo(
    () => (products || []).find((p) => String(p.id) === String(productId)) || null,
    [products, productId]
  );

  const productNameById = useMemo(() => buildProductNameLookup(products), [products]);

  const updateRow = (index, key, value) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };

  const addRow = () => setRows((prev) => [...prev, createEmptyMaterial()]);
  const removeRow = (index) => setRows((prev) => prev.filter((_, i) => i !== index));

  const validate = () => {
    if (!productId) return t('selectProductRequired', 'Please select a product.');
    if (!productNumber.trim()) return t('productNumberRequired', 'Product number is required.');

    for (const row of rows) {
      if (!row.material_id && !row.output_quantity && !row.material_quantity) continue;
      if (!row.material_id) return t('materials', 'Each material row needs a material.');
      if (!row.color?.trim()) return t('color', 'Each material row needs a color.');
      const outputQty = Number(row.output_quantity);
      const materialQty = Number(row.material_quantity);
      if (!Number.isFinite(outputQty) || outputQty <= 0) return t('quantity', 'Each color quantity must be > 0.');
      if (!Number.isFinite(materialQty) || materialQty <= 0) return t('qtyUsed', 'Each material kg must be > 0.');
    }

    return '';
  };

  const totalQuantity = useMemo(() => rows.reduce((sum, row) => {
    const value = Number(row.output_quantity);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0), [rows]);

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
        model_number: productNumber.trim(),
        product_name: selectedProduct.name.trim(),
        product_id: Number(selectedProduct.id),
        quantity: totalQuantity,
        color_breakdown: rows
          .filter((row) => row.material_id && row.output_quantity)
          .map((row) => ({
            color: row.color.trim(),
            quantity: Number(row.output_quantity),
          })),
        materials: rows
          .filter((row) => row.material_id && row.material_quantity)
          .map((row) => ({
            material_id: Number.parseInt(row.material_id, 10),
            color: row.color.trim(),
            quantity: Number(row.material_quantity),
          })),
      };

      const created = await productionTrackingApi.createOrder(payload);
      setLastCreated(created);
      setProductId('');
      setProductNumber('');
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
      { phase: 'Outsourcing', quantity: lastCreated.phases?.outsourcing ?? '—' },
      { phase: 'Final', quantity: lastCreated.phases?.final ?? '—' },
    ]
    : [];

  return (
    <div style={{ padding: '28px 28px 40px' }}>
      <PageHeader title={t('createProductionOrder', 'Create Production Order')} subtitle={t('createOrderSubtitle', 'Select product name and enter the order number (e.g. 6001, 6002)')} />

      {loading && <Spinner />}

      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Select label={t('product', 'Product')} value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">{t('selectProduct', 'Select product')}</option>
            {(products || []).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
          <Input
            label={t('productNumber', 'Product Number')}
            value={productNumber}
            onChange={(e) => setProductNumber(e.target.value)}
            placeholder={t('productNumberPlaceholder', 'e.g. 6001, 6002')}
          />
          {selectedProduct && (
            <div style={{ display: 'flex', alignItems: 'flex-end', fontSize: 13, color: 'var(--text-secondary)', paddingBottom: 10 }}>
              {t('productName', 'Product Name')}: <strong style={{ marginLeft: 6, color: 'var(--text-primary)' }}>{selectedProduct.name}</strong>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'flex-end', fontSize: 13, color: 'var(--text-secondary)', paddingBottom: 10 }}>
            {t('totalQuantity', 'Total Quantity')}: <strong style={{ marginLeft: 6, color: 'var(--text-primary)' }}>{totalQuantity || '—'}</strong>
          </div>
        </div>

        <div style={{ marginTop: 16, marginBottom: 10, fontSize: 13, color: 'var(--text-secondary)' }}>{t('materials', 'Materials')}</div>

        {rows.map((row, index) => (
          <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 10, marginBottom: 10 }}>
            <Select value={row.material_id} onChange={(e) => {
              const value = e.target.value;
              const selectedMaterial = (materials || []).find((m) => String(m.id) === String(value));
              updateRow(index, 'material_id', value);
              updateRow(index, 'color', selectedMaterial?.color || selectedMaterial?.colors || '');
            }}>
              <option value="">{t('selectMaterial', 'Select material')}</option>
              {(materials || []).map((m) => (
                <option key={m.id} value={m.id}>{m.name}{(m.color || m.colors) ? ` - ${m.color || m.colors}` : ''} (stock: {m.quantity})</option>
              ))}
            </Select>
            <Input value={row.color} readOnly placeholder={t('color', 'Color')} />
            <Input type="number" min="1" step="1" value={row.output_quantity} onChange={(e) => updateRow(index, 'output_quantity', e.target.value)} placeholder={t('quantity', 'Quantity')} />
            <Input type="number" min="0.01" step="0.01" value={row.material_quantity} onChange={(e) => updateRow(index, 'material_quantity', e.target.value)} placeholder={t('qtyUsed', 'Kg used')} />
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
            {getOrderDisplayNumber(lastCreated)} — {getOrderProductName(lastCreated, productNameById)}
          </div>
          <Table columns={columns} data={phaseRows} />
        </Card>
      )}
    </div>
  );
}
