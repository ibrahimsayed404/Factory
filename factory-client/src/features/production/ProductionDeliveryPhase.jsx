import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { productionCycleApi, salesApi } from '../../api';
import { useFetch } from '../../hooks/useFetch';
import { PageHeader, Card, Btn, Spinner, ErrorMsg, Modal, Select, Input } from '../../components/ui';
import { PrintableOrderSlip } from './PrintableOrderSlip';

export default function ProductionDeliveryPhase() {
  const navigate = useNavigate();
  const { data: orders, loading: ordersLoading, refetch: refetchOrders } = useFetch(productionCycleApi.listOrders);
  const { data: customers, loading: customersLoading } = useFetch(salesApi.customers);

  const [deliveryTargetOrder, setDeliveryTargetOrder] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [delivering, setDelivering] = useState(false);

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [printSlipOrder, setPrintSlipOrder] = useState(null);

  const readyOrders = (orders || []).filter(o => o.current_stage === 'ready_for_delivery');
  const deliveredOrders = (orders || []).filter(o => o.current_stage === 'delivered');

  const openDeliveryModal = (order) => {
    setDeliveryTargetOrder(order);
    setSelectedCustomerId(order.customer_id ? String(order.customer_id) : (customers?.[0]?.id ? String(customers[0].id) : ''));
    setUnitPrice(order.unit_price ? String(order.unit_price) : '');
    setDeliveryNotes('');
    setError('');
  };

  const getOrderTotalPieces = (order) => {
    if (!order) return 0;
    if (order.total_delivered_quantity > 0) return order.total_delivered_quantity;
    if (order.total_print_received_quantity > 0) return order.total_print_received_quantity;
    if (order.total_sorted_quantity > 0) return order.total_sorted_quantity;
    return order.total_cut_quantity || order.quantity || 0;
  };

  const calculatedTotalAmount = () => {
    const pieces = getOrderTotalPieces(deliveryTargetOrder);
    const price = Number.parseFloat(unitPrice);
    if (Number.isNaN(price) || price <= 0) return 0;
    return Number((pieces * price).toFixed(2));
  };

  const handleConfirmDelivery = async (shouldPrint = true) => {
    if (!deliveryTargetOrder) return;
    if (!selectedCustomerId) {
      setError('يرجى اختيار العميل المستلم');
      return;
    }
    const price = Number.parseFloat(unitPrice);
    if (Number.isNaN(price) || price <= 0) {
      setError('يرجى إدخال سعر قطعة صحيح أكبر من صفر');
      return;
    }

    setDelivering(true);
    setError('');
    try {
      const delivered = await productionCycleApi.deliver(deliveryTargetOrder.id, {
        customer_id: Number.parseInt(selectedCustomerId, 10),
        unit_price: price,
        delivery_notes: deliveryNotes,
        delivered_at: new Date().toISOString(),
      });

      setSuccessMsg(`تم تسليم الأوردر ${delivered.model_number} وتحميل مبلغ ${Number(delivered.total_price).toLocaleString()} ج.م على حساب العميل بنجاح!`);
      const targetPrint = delivered;
      setDeliveryTargetOrder(null);
      await refetchOrders();

      if (shouldPrint) {
        setPrintSlipOrder(targetPrint);
      }
    } catch (err) {
      setError(err.message || 'حدث خطأ أثناء تأكيد التسليم');
    } finally {
      setDelivering(false);
    }
  };

  const loading = ordersLoading || customersLoading;

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <PageHeader
        title="مرحلة التسليم للعميل"
        subtitle="تسليم الأوردرات الجاهزة وتحديد سعر البيع وتحميل القيمة على كشف حساب العميل"
        action={
          <Btn variant="primary" onClick={() => navigate('/production-pipeline')}>
            📊 عرض لوحة متابعة الإنتاج الكاملة
          </Btn>
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

      {/* Section 1: Ready for Delivery */}
      <Card style={{ marginBottom: 32, padding: 24, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
            🚚 أوردرات جاهزة للتسليم للعملاء
          </h3>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {readyOrders.length} أوردر مكتمل التصنيع
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 30 }}><Spinner /></div>
        ) : readyOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
            لا توجد أوردرات بانتظار التسليم حالياً.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead>
                <tr style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px 14px' }}>رقم الموديل</th>
                  <th style={{ padding: '10px 14px' }}>اسم الموديل</th>
                  <th style={{ padding: '10px 14px' }}>إجمالي القطع الجاهزة</th>
                  <th style={{ padding: '10px 14px' }}>تفاصيل الألوان المنجزة</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {readyOrders.map(ord => {
                  const pieces = getOrderTotalPieces(ord);
                  return (
                    <tr key={ord.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--accent, #38bdf8)' }}>
                        {ord.model_number || ord.order_number}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>{ord.order_name || ord.product_name}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 800, color: '#22c55e', fontSize: 15 }}>
                        {pieces.toLocaleString()} قطعة
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {(ord.colors || []).map((col, idx) => {
                            const qty = col.print_received_quantity !== null
                              ? col.print_received_quantity
                              : (col.sorted_quantity !== null ? col.sorted_quantity : col.cut_quantity);
                            return (
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
                                {col.color}: <strong>{qty}</strong>
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <Btn
                          variant="primary"
                          size="sm"
                          onClick={() => openDeliveryModal(ord)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                          <span>🚚</span> تسليم للعميل
                        </Btn>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Section 2: Delivered Orders History */}
      <Card style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            ✓ سجل الأوردرات المسلمة
          </h3>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {deliveredOrders.length} أوردر تم تسليمهم
          </span>
        </div>

        {deliveredOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
            لم يتم تسليم أي أوردرات حتى الآن.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead>
                <tr style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px 14px' }}>رقم الموديل</th>
                  <th style={{ padding: '10px 14px' }}>اسم الموديل</th>
                  <th style={{ padding: '10px 14px' }}>العميل</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>القطع المسلمة</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>سعر القطعة</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>الإجمالي المحمّل</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>تاريخ التسليم</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {deliveredOrders.map(ord => (
                  <tr key={ord.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--accent, #38bdf8)' }}>
                      {ord.model_number || ord.order_number}
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>{ord.order_name || ord.product_name}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#319795' }}>
                      {ord.customer_name || '—'}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700 }}>
                      {(ord.total_delivered_quantity || ord.quantity).toLocaleString()} قطعة
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      {ord.unit_price ? `${ord.unit_price} ج.م` : '—'}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 800, color: '#22c55e' }}>
                      {ord.total_price ? `${Number(ord.total_price).toLocaleString()} ج.م` : '—'}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                      {ord.delivered_at ? new Date(ord.delivered_at).toLocaleDateString('ar-EG') : '—'}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <Btn
                        variant="secondary"
                        size="sm"
                        onClick={() => setPrintSlipOrder(ord)}
                      >
                        🖨️ إذن التسليم
                      </Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal: Deliver to Customer */}
      {deliveryTargetOrder && (
        <Modal
          title={`تسليم موديل ${deliveryTargetOrder.model_number} (${deliveryTargetOrder.order_name || deliveryTargetOrder.product_name}) للعميل`}
          onClose={() => { setDeliveryTargetOrder(null); setError(''); }}
          zIndex={120}
        >
          <div style={{ padding: 8 }}>
            {error && <ErrorMsg error={error} onDismiss={() => setError('')} style={{ marginBottom: 16 }} />}

            {(!customers || customers.length === 0) && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                padding: '12px 16px',
                borderRadius: 6,
                marginBottom: 16,
                fontSize: 13,
                border: '1px solid rgba(239, 68, 68, 0.25)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}>
                <span>⚠️ لا يوجد عملاء مسجلين حتى الآن. يجب إضافة عميل أولاً من صفحة العملاء.</span>
                <Btn variant="secondary" size="sm" onClick={() => navigate('/customers')}>
                  👥 فتح صفحة العملاء
                </Btn>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, fontSize: 14 }}>
                اختر العميل المستلم *
              </label>
              <select
                value={selectedCustomerId}
                onChange={e => setSelectedCustomerId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                }}
              >
                <option value="">-- اختر من قائمة العملاء المسجلين --</option>
                {(customers || []).map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 16,
              background: 'var(--bg-card-subtle, rgba(255,255,255,0.02))',
              padding: 16,
              borderRadius: 8,
              border: '1px solid var(--border)',
              marginBottom: 16,
            }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>إجمالي عدد القطع المسلمة:</span>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
                  {getOrderTotalPieces(deliveryTargetOrder).toLocaleString()} قطعة
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 700, marginBottom: 4, fontSize: 13 }}>
                  سعر القطعة (ج.م) *
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.1"
                  placeholder="مثال: 150"
                  value={unitPrice}
                  onChange={e => setUnitPrice(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
                    fontWeight: 700,
                    fontSize: 16,
                  }}
                />
              </div>
            </div>

            {/* Calculated Total Box */}
            <div style={{
              background: 'rgba(34, 197, 94, 0.12)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              padding: 16,
              borderRadius: 8,
              marginBottom: 20,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontWeight: 700, color: '#22c55e', fontSize: 15 }}>
                إجمالي المبلغ المحمّل على حساب العميل:
              </span>
              <span style={{ fontSize: 24, fontWeight: 900, color: '#22c55e' }}>
                {calculatedTotalAmount().toLocaleString()} ج.م
              </span>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 13 }}>
                ملاحظات إذن التسليم
              </label>
              <input
                type="text"
                placeholder="مثال: تم الاستلام والتسليم بموجب شيك أو تحويل أو كاش..."
                value={deliveryNotes}
                onChange={e => setDeliveryNotes(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <Btn variant="secondary" onClick={() => { setDeliveryTargetOrder(null); setError(''); }}>
                إلغاء
              </Btn>
              <Btn
                variant="primary"
                onClick={() => handleConfirmDelivery(true)}
                disabled={delivering}
              >
                🚚 {delivering ? <Spinner size="sm" /> : 'تأكيد التسليم وطباعة الإذن'}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Printable Slip Modal */}
      {printSlipOrder && (
        <PrintableOrderSlip
          order={printSlipOrder}
          type="delivery"
          onClose={() => setPrintSlipOrder(null)}
        />
      )}
    </div>
  );
}
