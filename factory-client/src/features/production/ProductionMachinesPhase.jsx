import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { productionCycleApi } from './production.api';
import { useFetch } from '../../hooks/useFetch';
import { PageHeader, Card, Btn, Spinner, ErrorMsg } from '../../components/ui';

// Pieces entering the machines for a color: print-shop output, else sorted, else cut.
const machineInputQty = (c) => {
  if (c.print_received_quantity !== null && c.print_received_quantity !== undefined) return Number(c.print_received_quantity);
  if (c.sorted_quantity !== null && c.sorted_quantity !== undefined) return Number(c.sorted_quantity);
  return Number(c.cut_quantity || 0);
};

export default function ProductionMachinesPhase() {
  const navigate = useNavigate();
  const { data: orders, loading, refetch } = useFetch(productionCycleApi.listOrders);

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [machineColors, setMachineColors] = useState([]);
  const [machineNotes, setMachineNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const machineOrders = (orders || []).filter((o) => o.current_stage === 'machines');

  const handleSelectOrder = (order) => {
    setSelectedOrder(order);
    setError('');
    setSuccessMsg('');
    setMachineNotes(order.machine_notes || '');
    setMachineColors((order.colors || []).map((c) => {
      const input = machineInputQty(c);
      return {
        id: c.id,
        color: c.color,
        input_quantity: input,
        machine_quantity: c.machine_quantity !== null && c.machine_quantity !== undefined ? c.machine_quantity : input,
        machine_note: c.machine_note || '',
      };
    }));
  };

  const updateColor = (id, field, value) => {
    setMachineColors((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const handleSave = async () => {
    if (!selectedOrder) return;
    setError('');
    setSuccessMsg('');

    for (const c of machineColors) {
      const qty = Number(c.machine_quantity);
      if (c.machine_quantity === '' || !Number.isInteger(qty) || qty < 0) {
        setError(`يرجى كتابة كمية صحيحة للون ${c.color}`);
        return;
      }
      if (qty > c.input_quantity) {
        setError(`كمية المكن للون ${c.color} (${qty}) أكبر من الكمية الداخلة (${c.input_quantity})`);
        return;
      }
      if (qty < c.input_quantity && !(c.machine_note || '').trim()) {
        setError(`يوجد نقص في اللون ${c.color}. يرجى كتابة ملاحظة توضح السبب (مثال: تالف في المكن).`);
        return;
      }
    }

    setSaving(true);
    try {
      const updated = await productionCycleApi.submitMachines(selectedOrder.id, {
        colors: machineColors.map((c) => ({
          id: c.id,
          machine_quantity: Number(c.machine_quantity),
          machine_note: (c.machine_note || '').trim(),
        })),
        machine_notes: (machineNotes || '').trim(),
      });
      setSuccessMsg(`تم اعتماد المكن للأوردر ${updated.model_number}! تم التحويل إلى: جاهز للتسليم.`);
      setSelectedOrder(null);
      await refetch();
    } catch (err) {
      setError(err.message || 'حدث خطأ أثناء اعتماد المكن');
    } finally {
      setSaving(false);
    }
  };

  const totalIn = machineColors.reduce((s, c) => s + c.input_quantity, 0);
  const totalOut = machineColors.reduce((s, c) => s + (Number.parseInt(c.machine_quantity, 10) || 0), 0);

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <PageHeader
        title="مرحلة المكن"
        subtitle="تسجيل الكمية اللي خلصت من المكن لكل لون قبل التسليم"
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="secondary" onClick={() => navigate('/production-orders/printing')}>
              🖨️ العودة للمطبعة
            </Btn>
            <Btn variant="primary" onClick={() => navigate('/production-orders/delivery')}>
              🚚 الذهاب للتسليم ➔
            </Btn>
          </div>
        }
      />

      {error && !selectedOrder && <ErrorMsg error={error} onDismiss={() => setError('')} style={{ marginBottom: 16 }} />}
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

      {selectedOrder && (
        <Card style={{ marginBottom: 32, padding: 24, border: '2px solid var(--accent, #38bdf8)' }}>
          {error && <ErrorMsg error={error} onDismiss={() => setError('')} style={{ marginBottom: 16 }} />}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>تسجيل المكن للأوردر:</span>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
                موديل {selectedOrder.model_number} — {selectedOrder.order_name || selectedOrder.product_name}
              </h3>
            </div>
            <Btn variant="secondary" size="sm" onClick={() => { setSelectedOrder(null); setError(''); }}>
              إلغاء
            </Btn>
          </div>

          <div style={{
            background: 'var(--bg-card-subtle, rgba(255,255,255,0.02))',
            borderRadius: 8,
            border: '1px solid var(--border)',
            overflow: 'hidden',
            marginBottom: 20,
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead>
                <tr style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px 14px' }}>اللون</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', width: 150 }}>الداخل للمكن</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', width: 180 }}>الخارج من المكن *</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', width: 130 }}>الفارق</th>
                  <th style={{ padding: '10px 14px' }}>ملاحظة (مطلوبة عند وجود نقص)</th>
                </tr>
              </thead>
              <tbody>
                {machineColors.map((c) => {
                  const out = Number.parseInt(c.machine_quantity, 10);
                  const diff = Number.isNaN(out) ? 0 : out - c.input_quantity;
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 700 }}>{c.color}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {c.input_quantity} قطعة
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <input
                          type="number"
                          min="0"
                          max={c.input_quantity}
                          value={c.machine_quantity}
                          onChange={(e) => updateColor(c.id, 'machine_quantity', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            background: 'var(--bg-base)',
                            border: diff > 0 ? '1px solid #ef4444' : diff < 0 ? '1px solid #f59e0b' : '1px solid var(--border)',
                            borderRadius: 6,
                            color: 'var(--text-primary)',
                            fontWeight: 700,
                            textAlign: 'center',
                          }}
                        />
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        {diff === 0 ? (
                          <span style={{ color: '#22c55e', fontWeight: 700, fontSize: 13 }}>✓ مطابق</span>
                        ) : diff < 0 ? (
                          <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: 13 }}>نقص ({diff})</span>
                        ) : (
                          <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 13 }}>أكبر من الداخل!</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <input
                          type="text"
                          placeholder={diff < 0 ? 'اكتب سبب النقص (مثال: تالف في المكن)...' : 'ملاحظة اختيارية...'}
                          value={c.machine_note}
                          onChange={(e) => updateColor(c.id, 'machine_note', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            background: 'var(--bg-base)',
                            border: diff < 0 && !(c.machine_note || '').trim() ? '1px solid #ef4444' : '1px solid var(--border)',
                            borderRadius: 6,
                            color: 'var(--text-primary)',
                            fontSize: 13,
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>ملاحظات عامة على المكن</label>
            <textarea
              rows={2}
              value={machineNotes}
              onChange={(e) => setMachineNotes(e.target.value)}
              placeholder="ملاحظة اختيارية..."
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'var(--bg-base)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: 'var(--text-primary)',
                fontSize: 13,
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--bg-hover)',
            padding: 16,
            borderRadius: 8,
            gap: 16,
          }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>
              الداخل: {totalIn} قطعة — الخارج: {totalOut} قطعة — المرحلة التالية: 🚚 جاهز للتسليم
            </span>
            <Btn variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? <Spinner size="sm" /> : '⚙️ اعتماد المكن'}
            </Btn>
          </div>
        </Card>
      )}

      <Card style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>⚙️ الأوردرات في مرحلة المكن</h3>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{machineOrders.length} أوردر بانتظار المكن</span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 30 }}><Spinner /></div>
        ) : machineOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
            لا توجد أوردرات في مرحلة المكن حالياً.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead>
                <tr style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px 14px' }}>رقم الموديل</th>
                  <th style={{ padding: '10px 14px' }}>اسم الموديل</th>
                  <th style={{ padding: '10px 14px' }}>الألوان والكمية الداخلة</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>إجمالي الداخل</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>جاي من</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {machineOrders.map((ord) => (
                  <tr key={ord.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--accent, #38bdf8)' }}>
                      {ord.model_number || ord.order_number}
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>{ord.order_name || ord.product_name}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {(ord.colors || []).map((col) => (
                          <span
                            key={col.id}
                            style={{
                              background: 'var(--bg-card-subtle, rgba(255,255,255,0.06))',
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 12,
                              border: '1px solid var(--border)',
                            }}
                          >
                            {col.color}: <strong>{machineInputQty(col)}</strong>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700 }}>
                      {(ord.colors || []).reduce((s, col) => s + machineInputQty(col), 0)} قطعة
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: 13 }}>
                      {ord.print_received_at ? '🖨️ المطبعة' : '🗂️ الفرز'}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <Btn variant="primary" size="sm" onClick={() => handleSelectOrder(ord)}>
                        تسجيل المكن ⚙️
                      </Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
