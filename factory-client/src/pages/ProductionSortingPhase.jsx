import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { productionCycleApi } from '../api';
import { useFetch } from '../hooks/useFetch';
import { PageHeader, Card, Btn, Spinner, ErrorMsg } from '../components/ui';
import { PrintableOrderSlip } from '../components/production/PrintableOrderSlip';

export default function ProductionSortingPhase() {
  const navigate = useNavigate();
  const { data: orders, loading, refetch } = useFetch(productionCycleApi.listOrders);

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [sortedColors, setSortedColors] = useState([]);
  const [sortingNotes, setSortingNotes] = useState('');
  const [nextAction, setNextAction] = useState('printing'); // 'printing' or 'delivery'
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [printOrder, setPrintOrder] = useState(null);

  // Available orders for sorting: orders in 'cutting' or 'sorting'
  const sortingOrders = (orders || []).filter(
    o => o.current_stage === 'cutting' || o.current_stage === 'sorting'
  );

  const handleSelectOrder = (order) => {
    setSelectedOrder(order);
    setError('');
    setSuccessMsg('');
    setSortingNotes(order.sorting_notes || '');

    // Initialize sortedColors from order.colors
    const initial = (order.colors || []).map(c => ({
      id: c.id,
      color: c.color,
      cut_quantity: c.cut_quantity,
      sorted_quantity: c.sorted_quantity !== null ? c.sorted_quantity : c.cut_quantity,
      sorting_note: c.sorting_note || '',
    }));
    setSortedColors(initial);
  };

  const updateColorSorting = (id, field, value) => {
    setSortedColors(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleSaveSorting = async (shouldPrint = false) => {
    if (!selectedOrder) return;
    setError('');
    setSuccessMsg('');

    // Check discrepancies and require notes if diff != 0
    let hasDiscrepancyWithoutNote = false;
    for (const c of sortedColors) {
      const sorted = Number.parseInt(c.sorted_quantity, 10);
      const cut = Number.parseInt(c.cut_quantity, 10);
      if (Number.isNaN(sorted) || sorted < 0) {
        setError(`يرجى كتابة كمية فرز صحيحة للون ${c.color}`);
        return;
      }
      if (sorted !== cut && !(c.sorting_note || '').trim()) {
        hasDiscrepancyWithoutNote = true;
      }
    }

    if (hasDiscrepancyWithoutNote) {
      setError('تنبيه: يوجد فرق بين كمية القص والفرز في بعض الألوان. يرجى كتابة ملاحظة توضح سبب الزيادة أو النقصان لكل لون للتأكيد.');
      return;
    }

    setSaving(true);
    try {
      const updated = await productionCycleApi.submitSorting(selectedOrder.id, {
        colors: sortedColors.map(c => ({
          id: c.id,
          sorted_quantity: Number.parseInt(c.sorted_quantity, 10),
          sorting_note: (c.sorting_note || '').trim(),
        })),
        sorting_notes: (sortingNotes || '').trim(),
        next_action: nextAction,
      });

      const destination = nextAction === 'delivery' ? 'جاهز للتسليم' : 'المطبعة';
      setSuccessMsg(`تم اعتماد الفرز بنجاح للأوردر ${updated.model_number}! تم التحويل إلى: ${destination}.`);
      setSelectedOrder(null);
      await refetch();

      if (shouldPrint) {
        setPrintOrder(updated);
      }
    } catch (err) {
      setError(err.message || 'حدث خطأ أثناء اعتماد الفرز');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <PageHeader
        title="مرحلة فرز ما بعد القص"
        subtitle="فحص ومطابقة كميات الألوان المقصوصة وتسجيل الهالك أو الزيادة"
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="secondary" onClick={() => navigate('/production-orders/cutting')}>
              ✂️ العودة للقص
            </Btn>
            <Btn variant="primary" onClick={() => navigate('/production-orders/printing')}>
              🖨️ الذهاب للمطبعة ➔
            </Btn>
          </div>
        }
      />

      {error && <ErrorMsg error={error} onDismiss={() => setError('')} style={{ marginBottom: 16 }} />}
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

      {/* Active Sorting Modal / Form Card if Order is Selected */}
      {selectedOrder && (
        <Card style={{ marginBottom: 32, padding: 24, border: '2px solid var(--accent, #38bdf8)' }}>
          {error && <ErrorMsg error={error} onDismiss={() => setError('')} style={{ marginBottom: 16 }} />}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>أنت الآن تقوم بفرز الأوردر:</span>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
                موديل {selectedOrder.model_number} — {selectedOrder.order_name || selectedOrder.product_name}
              </h3>
            </div>
            <Btn variant="secondary" size="sm" onClick={() => { setSelectedOrder(null); setError(''); }}>
              إلغاء الفرز
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
                  <th style={{ padding: '10px 14px', textAlign: 'center', width: 140 }}>كمية القص</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', width: 180 }}>كمية الفرز الفعلية *</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', width: 130 }}>الفارق</th>
                  <th style={{ padding: '10px 14px' }}>ملاحظة الفرز (مطلوبة عند وجود فرق)</th>
                </tr>
              </thead>
              <tbody>
                {sortedColors.map((c) => {
                  const cut = Number.parseInt(c.cut_quantity, 10) || 0;
                  const sorted = Number.parseInt(c.sorted_quantity, 10);
                  const diff = Number.isNaN(sorted) ? 0 : sorted - cut;

                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 700 }}>{c.color}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {cut} قطعة
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <input
                          type="number"
                          min="0"
                          value={c.sorted_quantity}
                          onChange={e => updateColorSorting(c.id, 'sorted_quantity', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            background: 'var(--bg-base)',
                            border: diff !== 0 ? '1px solid #f59e0b' : '1px solid var(--border)',
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
                          <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 13 }}>
                            عجز ({diff})
                          </span>
                        ) : (
                          <span style={{ color: '#38bdf8', fontWeight: 700, fontSize: 13 }}>
                            زيادة (+{diff})
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <input
                          type="text"
                          placeholder={diff !== 0 ? 'اكتب سبب الفرق (مثال: ديفو نسيج / تلف قص)...' : 'ملاحظة اختيارية...'}
                          value={c.sorting_note}
                          onChange={e => updateColorSorting(c.id, 'sorting_note', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            background: 'var(--bg-base)',
                            border: diff !== 0 && !(c.sorting_note || '').trim() ? '1px solid #ef4444' : '1px solid var(--border)',
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

          {/* Next Destination & Actions */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>المرحلة التالية للأوردر:</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="nextAction"
                  value="printing"
                  checked={nextAction === 'printing'}
                  onChange={() => setNextAction('printing')}
                />
                <span>🖨️ إرسال للمطبعة</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="nextAction"
                  value="delivery"
                  checked={nextAction === 'delivery'}
                  onChange={() => setNextAction('delivery')}
                />
                <span>🚚 تخطي المطبعة (سادة ← تسليم مباشر)</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <Btn
                variant="secondary"
                onClick={() => handleSaveSorting(false)}
                disabled={saving}
              >
                {saving ? <Spinner size="sm" /> : '💾 اعتماد الفرز'}
              </Btn>
              <Btn
                variant="primary"
                onClick={() => handleSaveSorting(true)}
                disabled={saving}
              >
                🖨️ {saving ? <Spinner size="sm" /> : 'اعتماد وطباعة إذن الفرز'}
              </Btn>
            </div>
          </div>
        </Card>
      )}

      {/* Orders List awaiting sorting */}
      <Card style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            🗂️ الأوردرات المتاحة للفرز
          </h3>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {sortingOrders.length} أوردر بانتظار الفرز
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 30 }}><Spinner /></div>
        ) : sortingOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
            لا توجد أوردرات بانتظار الفرز حالياً.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead>
                <tr style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px 14px' }}>رقم الموديل</th>
                  <th style={{ padding: '10px 14px' }}>اسم الموديل</th>
                  <th style={{ padding: '10px 14px' }}>تفاصيل الألوان والمقصوص</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>إجمالي القص</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>الحالة</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {sortingOrders.map(ord => (
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
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <span style={{
                        background: 'rgba(245, 158, 11, 0.15)',
                        color: '#f59e0b',
                        padding: '4px 10px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600,
                      }}>
                        {ord.current_stage === 'cutting' ? 'في انتظار الفرز' : 'جاري الفرز'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <Btn
                        variant="primary"
                        size="sm"
                        onClick={() => handleSelectOrder(ord)}
                      >
                        بدء الفرز 📝
                      </Btn>
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
          type="sorting"
          onClose={() => setPrintOrder(null)}
        />
      )}
    </div>
  );
}
