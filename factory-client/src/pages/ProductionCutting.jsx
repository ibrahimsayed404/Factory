import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { productionCycleApi } from '../api';
import { useFetch } from '../hooks/useFetch';
import { PageHeader, Card, Table, Btn, Input, Spinner, ErrorMsg } from '../components/ui';
import { PrintableOrderSlip } from '../components/production/PrintableOrderSlip';

export default function ProductionCutting() {
  const navigate = useNavigate();
  const { data: orders, loading, refetch } = useFetch(productionCycleApi.listOrders);

  const [modelNumber, setModelNumber] = useState('');
  const [orderName, setOrderName] = useState('');
  const [notes, setNotes] = useState('');
  const [colors, setColors] = useState([
    { id: 1, color: 'أسود', quantity: '' },
    { id: 2, color: 'أبيض', quantity: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [printOrder, setPrintOrder] = useState(null);

  const addColorRow = () => {
    setColors(prev => [...prev, { id: Date.now(), color: '', quantity: '' }]);
  };

  const removeColorRow = (id) => {
    if (colors.length <= 1) return;
    setColors(prev => prev.filter(c => c.id !== id));
  };

  const updateColorRow = (id, field, value) => {
    setColors(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const totalCutQty = colors.reduce((sum, c) => {
    const q = Number.parseInt(c.quantity, 10);
    return sum + (Number.isNaN(q) ? 0 : q);
  }, 0);

  const handleSubmit = async (shouldPrint = false) => {
    setError('');
    setSuccessMsg('');

    if (!modelNumber.trim()) {
      setError('يرجى كتابة رقم الموديل / الأوردر (مثلاً: 6201)');
      return;
    }
    if (!orderName.trim()) {
      setError('يرجى كتابة اسم الموديل (مثلاً: بيزك)');
      return;
    }

    const validColors = colors.filter(c => c.color.trim() && Number.parseInt(c.quantity, 10) > 0);
    if (validColors.length === 0) {
      setError('يجب إضافة لون واحد على الأقل بكمية صحيحة');
      return;
    }

    setSaving(true);
    try {
      const created = await productionCycleApi.createCutting({
        modelNumber: modelNumber.trim(),
        orderName: orderName.trim(),
        notes: notes.trim(),
        colors: validColors.map(c => ({
          color: c.color.trim(),
          quantity: Number.parseInt(c.quantity, 10),
        })),
      });

      setSuccessMsg(`تم إنشاء أمر القص للموديل ${created.model_number} بإجمالي ${created.total_cut_quantity} قطعة بنجاح!`);
      setModelNumber('');
      setOrderName('');
      setNotes('');
      setColors([
        { id: 1, color: 'أسود', quantity: '' },
        { id: 2, color: 'أبيض', quantity: '' },
      ]);

      await refetch();

      if (shouldPrint) {
        setPrintOrder(created);
      }
    } catch (err) {
      setError(err.message || 'حدث خطأ أثناء حفظ أمر القص');
    } finally {
      setSaving(false);
    }
  };

  const recentCuttingOrders = (orders || []).filter(o => o.current_stage === 'cutting');

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <PageHeader
        title="مرحلة القص وإنشاء الأوامر"
        subtitle="إنشاء أمر تشغيل جديد وتحديد كميات القص لكل لون"
        action={
          <Btn variant="secondary" onClick={() => navigate('/production-pipeline')}>
            📊 عرض لوحة متابعة الإنتاج
          </Btn>
        }
      />

      {error && <ErrorMsg error={error} style={{ marginBottom: 16 }} />}
      {successMsg && (
        <div style={{
          background: 'rgba(34, 197, 94, 0.15)',
          color: '#22c55e',
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 20,
          border: '1px solid rgba(34, 197, 94, 0.3)',
          fontWeight: 600,
        }}>
          ✓ {successMsg}
        </div>
      )}

      {/* Creation Form Card */}
      <Card style={{ marginBottom: 32, padding: 24 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
          ✂️ بيانات أمر القص والموديل
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
          <Input
            label="رقم الموديل / الأوردر *"
            placeholder="مثال: 6201"
            value={modelNumber}
            onChange={e => setModelNumber(e.target.value)}
          />
          <Input
            label="اسم الموديل *"
            placeholder="مثال: بيزك أو تيشرت صيفي"
            value={orderName}
            onChange={e => setOrderName(e.target.value)}
          />
          <Input
            label="ملاحظات القص / التشغيل"
            placeholder="مثال: قماش سينجل ليكرا - قص ترابيزة 1"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        {/* Colors & Quantities Table */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
              الألوان والكميات المقصوصة
            </span>
            <Btn variant="secondary" size="sm" onClick={addColorRow}>
              + إضافة لون آخر
            </Btn>
          </div>

          <div style={{
            background: 'var(--bg-card-subtle, rgba(255,255,255,0.02))',
            borderRadius: 8,
            border: '1px solid var(--border)',
            overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead>
                <tr style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px 14px', width: 40 }}>#</th>
                  <th style={{ padding: '10px 14px' }}>اللون</th>
                  <th style={{ padding: '10px 14px', width: 180 }}>الكمية المقصوصة (قطعة)</th>
                  <th style={{ padding: '10px 14px', width: 70, textAlign: 'center' }}>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {colors.map((c, idx) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 14px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td style={{ padding: '8px 14px' }}>
                      <input
                        type="text"
                        placeholder="اسم اللون (مثل: أسود، أبيض، كحلي...)"
                        value={c.color}
                        onChange={e => updateColorRow(c.id, 'color', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          background: 'var(--bg-base)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          color: 'var(--text-primary)',
                        }}
                      />
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      <input
                        type="number"
                        min="1"
                        placeholder="0"
                        value={c.quantity}
                        onChange={e => updateColorRow(c.id, 'quantity', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          background: 'var(--bg-base)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          color: 'var(--text-primary)',
                          fontWeight: 700,
                        }}
                      />
                    </td>
                    <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => removeColorRow(c.id)}
                        disabled={colors.length <= 1}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: colors.length <= 1 ? 'var(--text-muted)' : '#ef4444',
                          cursor: colors.length <= 1 ? 'not-allowed' : 'pointer',
                          fontSize: 16,
                        }}
                        title="حذف اللون"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Total & Action Buttons */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-hover)',
          padding: '16px 20px',
          borderRadius: 8,
          gap: 16,
        }}>
          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>إجمالي عدد القطع المقصوصة: </span>
            <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent, #38bdf8)' }}>
              {totalCutQty.toLocaleString()} قطعة
            </span>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <Btn
              variant="secondary"
              onClick={() => handleSubmit(false)}
              disabled={saving}
            >
              {saving ? <Spinner size="sm" /> : '💾 حفظ أمر القص'}
            </Btn>
            <Btn
              variant="primary"
              onClick={() => handleSubmit(true)}
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <span>🖨️</span> {saving ? <Spinner size="sm" /> : 'حفظ وطباعة إذن القص'}
            </Btn>
          </div>
        </div>
      </Card>

      {/* Orders awaiting sorting */}
      <Card style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            📋 أوامر القص الجارية (في انتظار الفرز)
          </h3>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {recentCuttingOrders.length} أوردر
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 30 }}><Spinner /></div>
        ) : recentCuttingOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
            لا توجد أوامر قيد القص حالياً. يمكنك إنشاء أمر جديد بالأعلى.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead>
                <tr style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px 14px' }}>رقم الموديل</th>
                  <th style={{ padding: '10px 14px' }}>اسم الموديل</th>
                  <th style={{ padding: '10px 14px' }}>الألوان والكميات</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>إجمالي القص</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>التاريخ</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {recentCuttingOrders.map(ord => (
                  <tr key={ord.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--accent, #38bdf8)' }}>
                      {ord.model_number || ord.order_number}
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>{ord.order_name || ord.product_name}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {(ord.colors || []).map((col, idx) => (
                          <span
                            key={idx}
                            style={{
                              background: 'var(--bg-card-subtle, rgba(255,255,255,0.06))',
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 12,
                              border: '1px solid var(--border)',
                            }}
                          >
                            {col.color}: <strong>{col.cut_quantity}</strong>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700 }}>
                      {ord.total_cut_quantity || ord.quantity} قطعة
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                      {new Date(ord.created_at).toLocaleDateString('ar-EG')}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                        <Btn
                          variant="secondary"
                          size="sm"
                          onClick={() => setPrintOrder(ord)}
                          title="طباعة إذن القص"
                        >
                          🖨️ إذن القص
                        </Btn>
                        <Btn
                          variant="primary"
                          size="sm"
                          onClick={() => navigate('/production-orders/sorting')}
                        >
                          تحويل للفرز ➔
                        </Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Printable Slip Modal */}
      {printOrder && (
        <PrintableOrderSlip
          order={printOrder}
          type="cutting"
          onClose={() => setPrintOrder(null)}
        />
      )}
    </div>
  );
}
