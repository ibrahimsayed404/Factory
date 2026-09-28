import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { productionCycleApi } from './production.api';
import { printShopApi } from '../printShops/printShops.api';
import { useFetch } from '../../hooks/useFetch';
import { PageHeader, Card, Btn, Spinner, ErrorMsg, Modal } from '../../components/ui';
import { PrintableOrderSlip } from './PrintableOrderSlip';

export default function ProductionPrintingPhase() {
  const navigate = useNavigate();
  const { data: orders, loading: ordersLoading, refetch: refetchOrders } = useFetch(productionCycleApi.listOrders);
  const { data: printShops, loading: shopsLoading } = useFetch(printShopApi.list);

  const [activeTab, setActiveTab] = useState('ready_to_send'); // 'ready_to_send' or 'at_print'

  // Send to print modal state
  const [sendTargetOrder, setSendTargetOrder] = useState(null);
  const [selectedShopId, setSelectedShopId] = useState('');
  const [sentColors, setSentColors] = useState([]);
  const [printNotes, setPrintNotes] = useState('');
  const [sending, setSending] = useState(false);

  // Receive from print modal state
  const [receiveTargetOrder, setReceiveTargetOrder] = useState(null);
  const [receivedColors, setReceivedColors] = useState([]);
  const [receiveNotes, setReceiveNotes] = useState('');
  const [receiving, setReceiving] = useState(false);

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [printSlipOrder, setPrintSlipOrder] = useState(null);
  const [slipType, setSlipType] = useState('print_send');

  // Orders finished sorting and ready to be sent to print shop
  const readyToSendOrders = (orders || []).filter(o =>
    (o.current_stage === 'printing' || o.current_stage === 'sorting') &&
    !o.print_sent_at &&
    !o.print_received_at &&
    o.current_stage !== 'ready_for_delivery' &&
    o.current_stage !== 'delivered'
  );

  // Orders that have been sent and currently at print shop
  const atPrintOrders = (orders || []).filter(o =>
    o.current_stage === 'printing' &&
    Boolean(o.print_sent_at) &&
    !o.print_received_at
  );

  const openSendModal = (order) => {
    setSendTargetOrder(order);
    setSelectedShopId(printShops?.[0]?.id ? String(printShops[0].id) : '');
    setPrintNotes('');
    setError('');

    // Pre-populate sent quantity from sorted quantity or cut quantity
    const initial = (order.colors || []).map(c => ({
      id: c.id,
      color: c.color,
      sorted_quantity: c.sorted_quantity !== null ? c.sorted_quantity : c.cut_quantity,
      print_sent_quantity: c.sorted_quantity !== null ? c.sorted_quantity : c.cut_quantity,
    }));
    setSentColors(initial);
  };

  const handleConfirmSend = async (shouldPrint = true) => {
    if (!sendTargetOrder) return;
    if (!selectedShopId) {
      setError('يرجى اختيار المطبعة المستلمة من القائمة');
      return;
    }

    setSending(true);
    setError('');
    try {
      const updated = await productionCycleApi.sendToPrint(sendTargetOrder.id, {
        print_shop_id: Number.parseInt(selectedShopId, 10),
        colors: sentColors.map(c => ({
          id: c.id,
          print_sent_quantity: Number.parseInt(c.print_sent_quantity, 10) || 0,
        })),
        print_notes: printNotes,
      });

      setSuccessMsg(`تم إرسال الأوردر ${updated.model_number} إلى المطبعة بنجاح!`);
      const targetPrint = updated;
      setSendTargetOrder(null);
      setActiveTab('at_print');
      await refetchOrders();

      if (shouldPrint) {
        setSlipType('print_send');
        setPrintSlipOrder(targetPrint);
      }
    } catch (err) {
      setError(err.message || 'حدث خطأ أثناء إرسال الأوردر للمطبعة');
    } finally {
      setSending(false);
    }
  };

  const openReceiveModal = (order) => {
    setReceiveTargetOrder(order);
    setReceiveNotes(order.print_notes || '');
    setError('');

    // Pre-populate received quantity with sent quantity as default
    const initial = (order.colors || []).map(c => ({
      id: c.id,
      color: c.color,
      print_sent_quantity: c.print_sent_quantity !== null ? c.print_sent_quantity : (c.sorted_quantity || c.cut_quantity),
      print_received_quantity: c.print_sent_quantity !== null ? c.print_sent_quantity : (c.sorted_quantity || c.cut_quantity),
      print_note: '',
    }));
    setReceivedColors(initial);
  };

  const handleConfirmReceive = async (shouldPrint = true) => {
    if (!receiveTargetOrder) return;

    setReceiving(true);
    setError('');
    try {
      const updated = await productionCycleApi.receiveFromPrint(receiveTargetOrder.id, {
        colors: receivedColors.map(c => ({
          id: c.id,
          print_received_quantity: Number.parseInt(c.print_received_quantity, 10) || 0,
          print_note: c.print_note,
        })),
        print_notes: receiveNotes,
      });

      setSuccessMsg(`تم استلام الأوردر ${updated.model_number} من المطبعة بنجاح، وأصبح جاهزاً للتسليم!`);
      const targetPrint = updated;
      setReceiveTargetOrder(null);
      await refetchOrders();

      if (shouldPrint) {
        setSlipType('print_receive');
        setPrintSlipOrder(targetPrint);
      }
    } catch (err) {
      setError(err.message || 'حدث خطأ أثناء تسجيل استلام الأوردر');
    } finally {
      setReceiving(false);
    }
  };

  const loading = ordersLoading || shopsLoading;

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <PageHeader
        title="مرحلة المطبعة"
        subtitle="إرسال التشغيلات للمطابع وطباعة أوامر التوريد ومتابعة الاستلام"
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="secondary" onClick={() => navigate('/print-shops')}>
              🏢 إدارة دليل المطابع
            </Btn>
            <Btn variant="primary" onClick={() => navigate('/production-orders/delivery')}>
              🚚 الذهاب للتسليم ➔
            </Btn>
          </div>
        }
      />

      {error && <ErrorMsg error={error} onDismiss={() => setError('')} style={{ marginBottom: 16 }} />}
      {successMsg && (
        <div style={{
          background: 'rgba(34, 197, 94, 0.15)',
          color: '#22c55e',
          padding: '12px 18px',
          borderRadius: 8,
          marginBottom: 20,
          border: '1px solid rgba(34, 197, 94, 0.3)',
          fontWeight: 600,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <span>✓ {successMsg}</span>
          <Btn
            variant="primary"
            size="sm"
            onClick={() => navigate('/production-orders/delivery')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <span>🚚</span> الذهاب لصفحة التسليم ➔
          </Btn>
        </div>
      )}

      {/* Tabs: Chronological Order: 1. Ready to send, 2. Currently at print */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        <button
          type="button"
          onClick={() => setActiveTab('ready_to_send')}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            border: 'none',
            background: activeTab === 'ready_to_send' ? 'var(--accent)' : 'var(--bg-hover)',
            color: activeTab === 'ready_to_send' ? '#ffffff' : 'var(--text-secondary)',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: activeTab === 'ready_to_send' ? '0 1px 4px rgba(37,99,235,0.25)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <span>📦 جاهزة للإرسال للمطبعة</span>
          <span style={{
            background: activeTab === 'ready_to_send' ? 'rgba(255,255,255,0.2)' : 'var(--bg-elevated)',
            color: activeTab === 'ready_to_send' ? '#ffffff' : 'var(--text-primary)',
            padding: '2px 8px',
            borderRadius: 12,
            fontSize: 12,
          }}>
            {readyToSendOrders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('at_print')}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            border: 'none',
            background: activeTab === 'at_print' ? 'var(--accent)' : 'var(--bg-hover)',
            color: activeTab === 'at_print' ? '#ffffff' : 'var(--text-secondary)',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: activeTab === 'at_print' ? '0 1px 4px rgba(37,99,235,0.25)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <span>🖨️ في المطبعة حالياً</span>
          <span style={{
            background: activeTab === 'at_print' ? 'rgba(255,255,255,0.2)' : 'var(--bg-elevated)',
            color: activeTab === 'at_print' ? '#ffffff' : 'var(--text-primary)',
            padding: '2px 8px',
            borderRadius: 12,
            fontSize: 12,
          }}>
            {atPrintOrders.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Orders Ready to Send to Print Shop */}
      {activeTab === 'ready_to_send' && (
        <Card style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              📦 الأوردرات الجاهزة للإرسال للمطبعة
            </h3>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {readyToSendOrders.length} أوردر تم فرزه وجاهز للإرسال
            </span>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 30 }}><Spinner /></div>
          ) : readyToSendOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              لا توجد أوردرات بانتظار الخروج للمطبعة.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '10px 14px' }}>رقم الموديل</th>
                    <th style={{ padding: '10px 14px' }}>اسم الموديل</th>
                    <th style={{ padding: '10px 14px' }}>الكمية المفرزة</th>
                    <th style={{ padding: '10px 14px' }}>الألوان المتاحة</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center' }}>إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {readyToSendOrders.map(ord => (
                    <tr key={ord.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--accent, #38bdf8)' }}>
                        {ord.model_number || ord.order_number}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>{ord.order_name || ord.product_name}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 700 }}>
                        {ord.total_sorted_quantity || ord.total_cut_quantity} قطعة
                      </td>
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
                              {col.color}: <strong>{col.sorted_quantity !== null ? col.sorted_quantity : col.cut_quantity}</strong>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <Btn
                          variant="primary"
                          size="sm"
                          onClick={() => openSendModal(ord)}
                        >
                          إرسال للمطبعة ➔
                        </Btn>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Tab 2: Orders Currently at Print Shop */}
      {activeTab === 'at_print' && (
        <Card style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              🖨️ الأوردرات الموجودة حالياً بالمطابع
            </h3>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              إجمالي {atPrintOrders.reduce((sum, o) => sum + (o.total_print_sent_quantity || 0), 0)} قطعة قيد الطباعة
            </span>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 30 }}><Spinner /></div>
          ) : atPrintOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              لا توجد أوردرات تحت الطباعة حالياً.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '10px 14px' }}>رقم الموديل</th>
                    <th style={{ padding: '10px 14px' }}>اسم الموديل</th>
                    <th style={{ padding: '10px 14px' }}>المطبعة</th>
                    <th style={{ padding: '10px 14px' }}>الكمية المرسلة</th>
                    <th style={{ padding: '10px 14px' }}>تاريخ الخروج</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center' }}>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {atPrintOrders.map(ord => (
                    <tr key={ord.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--accent, #38bdf8)' }}>
                        {ord.model_number || ord.order_number}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>{ord.order_name || ord.product_name}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          background: 'rgba(217, 119, 6, 0.15)',
                          color: '#f59e0b',
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontWeight: 700,
                          fontSize: 13,
                        }}>
                          {ord.print_shop_name || 'مطبعة مسجلة'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 700 }}>
                        {ord.total_print_sent_quantity || ord.total_cut_quantity} قطعة
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-muted)' }}>
                        {ord.print_sent_at ? new Date(ord.print_sent_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                          <Btn
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setSlipType('print_send');
                              setPrintSlipOrder(ord);
                            }}
                            title="إعادة طباعة أمر التوريد"
                          >
                            🖨️ أمر التوريد
                          </Btn>
                          <Btn
                            variant="primary"
                            size="sm"
                            onClick={() => openReceiveModal(ord)}
                          >
                            ✓ تم الاستلام
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
      )}

      {/* Modal: Send to Print Shop */}
      {sendTargetOrder && (
        <Modal
          title={`إرسال موديل ${sendTargetOrder.model_number} للمطبعة`}
          onClose={() => { setSendTargetOrder(null); setError(''); }}
          zIndex={120}
        >
          <div style={{ padding: 8 }}>
            {error && <ErrorMsg error={error} onDismiss={() => setError('')} style={{ marginBottom: 16 }} />}

            {(!printShops || printShops.length === 0) && (
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
                <span>⚠️ لا توجد مطابع مسجلة حتى الآن. يجب إضافة مطبعة أولاً من دليل المطابع لتتمكن من إرسال الأوردر.</span>
                <Btn variant="secondary" size="sm" onClick={() => navigate('/print-shops')}>
                  🏢 فتح دليل المطابع
                </Btn>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, fontSize: 14 }}>
                اختر المطبعة المستلمة *
              </label>
              <select
                value={selectedShopId}
                onChange={e => setSelectedShopId(e.target.value)}
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
                <option value="">-- اختر من قائمة المطابع المسجلة --</option>
                {(printShops || []).map(ps => (
                  <option key={ps.id} value={ps.id}>
                    {ps.name} {ps.phone ? `(${ps.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, fontSize: 14 }}>
                الكميات المرسلة لكل لون:
              </label>
              <div style={{
                background: 'var(--bg-card-subtle, rgba(255,255,255,0.02))',
                borderRadius: 6,
                border: '1px solid var(--border)',
                overflow: 'hidden',
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-hover)' }}>
                      <th style={{ padding: '8px 12px' }}>اللون</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>المفرز</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', width: 140 }}>المرسل للطباعة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sentColors.map((c, i) => (
                      <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700 }}>{c.color}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          {c.sorted_quantity}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <input
                            type="number"
                            min="1"
                            value={c.print_sent_quantity}
                            onChange={e => {
                              const val = e.target.value;
                              setSentColors(prev => prev.map((item, idx) => idx === i ? { ...item, print_sent_quantity: val } : item));
                            }}
                            style={{
                              width: '100%',
                              padding: '6px 10px',
                              background: 'var(--bg-base)',
                              border: '1px solid var(--border)',
                              borderRadius: 4,
                              color: 'var(--text-primary)',
                              textAlign: 'center',
                              fontWeight: 700,
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 13 }}>
                ملاحظات أمر التوريد للمطبعة (نوع الطباعة / الألوان)
              </label>
              <input
                type="text"
                placeholder="مثال: طباعة سلك سكرين لوجو أمامي أسود وفضي"
                value={printNotes}
                onChange={e => setPrintNotes(e.target.value)}
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
              <Btn variant="secondary" onClick={() => { setSendTargetOrder(null); setError(''); }}>
                إلغاء
              </Btn>
              <Btn
                variant="primary"
                onClick={() => handleConfirmSend(true)}
                disabled={sending}
              >
                🖨️ {sending ? <Spinner size="sm" /> : 'تأكيد الخروج وطباعة أمر التوريد'}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Receive from Print Shop */}
      {receiveTargetOrder && (
        <Modal
          title={`استلام موديل ${receiveTargetOrder.model_number} من المطبعة`}
          onClose={() => { setReceiveTargetOrder(null); setError(''); }}
          zIndex={120}
        >
          <div style={{ padding: 8 }}>
            {error && <ErrorMsg error={error} onDismiss={() => setError('')} style={{ marginBottom: 16 }} />}
            <div style={{
              background: 'rgba(217, 119, 6, 0.1)',
              padding: 12,
              borderRadius: 6,
              marginBottom: 16,
              fontSize: 13,
              color: '#f59e0b',
              fontWeight: 600,
            }}>
              المطبعة: {receiveTargetOrder.print_shop_name || 'مطبعة مسجلة'} — يرجى عد ومطابقة القطع المستلمة لتسجيل أي عجز أو هالك طباعة.
            </div>

            <div style={{ marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-hover)' }}>
                    <th style={{ padding: '8px 12px' }}>اللون</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>المرسل</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', width: 140 }}>المستلم فعلياً *</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', width: 100 }}>الفارق</th>
                    <th style={{ padding: '8px 12px' }}>ملاحظة الهالك</th>
                  </tr>
                </thead>
                <tbody>
                  {receivedColors.map((c, i) => {
                    const sent = Number.parseInt(c.print_sent_quantity, 10) || 0;
                    const rec = Number.parseInt(c.print_received_quantity, 10);
                    const diff = Number.isNaN(rec) ? 0 : rec - sent;

                    return (
                      <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700 }}>{c.color}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          {sent}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <input
                            type="number"
                            min="0"
                            value={c.print_received_quantity}
                            onChange={e => {
                              const val = e.target.value;
                              setReceivedColors(prev => prev.map((item, idx) => idx === i ? { ...item, print_received_quantity: val } : item));
                            }}
                            style={{
                              width: '100%',
                              padding: '6px 10px',
                              background: 'var(--bg-base)',
                              border: diff !== 0 ? '1px solid #ef4444' : '1px solid var(--border)',
                              borderRadius: 4,
                              color: 'var(--text-primary)',
                              textAlign: 'center',
                              fontWeight: 700,
                            }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          {diff === 0 ? (
                            <span style={{ color: '#22c55e', fontWeight: 700 }}>✓ كامل</span>
                          ) : diff < 0 ? (
                            <span style={{ color: '#ef4444', fontWeight: 700 }}>عجز ({diff})</span>
                          ) : (
                            <span style={{ color: '#38bdf8', fontWeight: 700 }}>+{diff}</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <input
                            type="text"
                            placeholder="ملاحظات الهالك إن وجدت..."
                            value={c.print_note}
                            onChange={e => {
                              const val = e.target.value;
                              setReceivedColors(prev => prev.map((item, idx) => idx === i ? { ...item, print_note: val } : item));
                            }}
                            style={{
                              width: '100%',
                              padding: '6px 10px',
                              background: 'var(--bg-base)',
                              border: '1px solid var(--border)',
                              borderRadius: 4,
                              color: 'var(--text-primary)',
                              fontSize: 12,
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
              <Btn variant="secondary" onClick={() => { setReceiveTargetOrder(null); setError(''); }}>
                إلغاء
              </Btn>
              <Btn
                variant="primary"
                onClick={() => handleConfirmReceive(true)}
                disabled={receiving}
              >
                ✓ {receiving ? <Spinner size="sm" /> : 'تأكيد الاستلام وطباعة إذن الاستلام'}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Printable Slip Modal */}
      {printSlipOrder && (
        <PrintableOrderSlip
          order={printSlipOrder}
          type={slipType}
          onClose={() => setPrintSlipOrder(null)}
        />
      )}
    </div>
  );
}
