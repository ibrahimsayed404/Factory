import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { productionCycleApi } from './production.api';
import { useFetch } from '../../hooks/useFetch';
import { PageHeader, Card, Btn, Spinner, ErrorMsg, Modal } from '../../components/ui';
import { PrintableOrderSlip } from './PrintableOrderSlip';

export default function ProductionTrackingBoard() {
  const navigate = useNavigate();
  const { data: orders, loading: ordersLoading, refetch: refetchOrders } = useFetch(productionCycleApi.listOrders);
  const { data: kpis, loading: kpisLoading, refetch: refetchKPIs } = useFetch(productionCycleApi.getKPIs);

  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' or 'table'
  const [cardDensity, setCardDensity] = useState('compact'); // 'compact' or 'detailed'
  const [deliverySubTab, setDeliverySubTab] = useState('ready'); // 'ready', 'delivered', or 'all'
  const [timeFilter, setTimeFilter] = useState('active'); // 'active', 'month', 'all'
  const [expandedColumns, setExpandedColumns] = useState({});
  const [search, setSearch] = useState('');
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
  const [printSlipOrder, setPrintSlipOrder] = useState(null);
  const [slipType, setSlipType] = useState('cutting');
  const [deletingId, setDeletingId] = useState(null);

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    let list = orders;

    // Time / Status Lifecycle Filter
    if (timeFilter === 'active') {
      // In active mode, hide delivered orders unless searching
      if (!search.trim()) {
        list = list.filter(o => o.current_stage !== 'delivered');
      }
    } else if (timeFilter === 'month') {
      const now = new Date();
      const curYear = now.getFullYear();
      const curMonth = now.getMonth();
      list = list.filter(o => {
        if (!o.created_at) return true;
        const d = new Date(o.created_at);
        return d.getFullYear() === curYear && d.getMonth() === curMonth;
      });
    }

    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter(o =>
      (o.model_number || '').toLowerCase().includes(q) ||
      (o.order_name || '').toLowerCase().includes(q) ||
      (o.customer_name || '').toLowerCase().includes(q) ||
      (o.print_shop_name || '').toLowerCase().includes(q)
    );
  }, [orders, search, timeFilter]);

  const cuttingOrders = filteredOrders.filter(o => o.current_stage === 'cutting');
  const sortingOrders = filteredOrders.filter(o => o.current_stage === 'sorting');
  const printingOrders = filteredOrders.filter(o => o.current_stage === 'printing');
  const readyForDeliveryOrders = filteredOrders.filter(o => o.current_stage === 'ready_for_delivery');
  const deliveredOrders = (orders || []).filter(o => {
    if (o.current_stage !== 'delivered') return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      (o.model_number || '').toLowerCase().includes(q) ||
      (o.order_name || '').toLowerCase().includes(q) ||
      (o.customer_name || '').toLowerCase().includes(q) ||
      (o.print_shop_name || '').toLowerCase().includes(q)
    );
  });

  const deliveryColumnOrders = useMemo(() => {
    if (deliverySubTab === 'ready') return readyForDeliveryOrders;
    if (deliverySubTab === 'delivered') return deliveredOrders;
    return [...readyForDeliveryOrders, ...deliveredOrders];
  }, [deliverySubTab, readyForDeliveryOrders, deliveredOrders]);

  const getColItems = (list, colKey) => {
    const isExpanded = Boolean(expandedColumns[colKey]);
    const limit = isExpanded ? list.length : 15;
    return {
      items: list.slice(0, limit),
      hasMore: list.length > limit,
      remaining: list.length - limit,
    };
  };

  const handleDeleteOrder = async (orderId, modelNum) => {
    if (!window.confirm(`هل أنت متأكد من حذف أمر الإنتاج موديل ${modelNum}؟ سيتم حذف جميع تفاصيل مراحله.`)) return;
    setDeletingId(orderId);
    try {
      await productionCycleApi.deleteOrder(orderId);
      if (selectedOrderDetails?.id === orderId) {
        setSelectedOrderDetails(null);
      }
      await Promise.all([refetchOrders(), refetchKPIs()]);
    } catch (err) {
      alert(err.message || 'فشل حذف أمر الإنتاج');
    } finally {
      setDeletingId(null);
    }
  };

  const getPiecesCount = (o) => {
    if (o.current_stage === 'delivered') return o.total_delivered_quantity || o.quantity;
    if (o.current_stage === 'ready_for_delivery') return o.total_print_received_quantity || o.total_sorted_quantity || o.total_cut_quantity;
    if (o.current_stage === 'printing') return o.total_print_sent_quantity || o.total_sorted_quantity || o.total_cut_quantity;
    if (o.current_stage === 'sorting') return o.total_sorted_quantity || o.total_cut_quantity;
    return o.total_cut_quantity || o.quantity || 0;
  };

  const getStageBadge = (stage) => {
    switch (stage) {
      case 'cutting':
        return <span style={{ background: 'rgba(2, 132, 199, 0.1)', color: '#0284c7', border: '1px solid rgba(2, 132, 199, 0.25)', padding: '3px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>1. القص</span>;
      case 'sorting':
        return <span style={{ background: 'rgba(217, 119, 6, 0.1)', color: '#d97706', border: '1px solid rgba(217, 119, 6, 0.25)', padding: '3px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>2. الفرز</span>;
      case 'printing':
        return <span style={{ background: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed', border: '1px solid rgba(124, 58, 237, 0.25)', padding: '3px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>3. المطبعة</span>;
      case 'ready_for_delivery':
        return <span style={{ background: 'rgba(5, 150, 105, 0.1)', color: '#059669', border: '1px solid rgba(5, 150, 105, 0.25)', padding: '3px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>4. جاهز للتسليم</span>;
      case 'delivered':
        return <span style={{ background: 'rgba(4, 120, 87, 0.12)', color: '#047857', border: '1px solid rgba(4, 120, 87, 0.25)', padding: '3px 8px', borderRadius: 4, fontSize: 12, fontWeight: 800 }}>✓ تم التسليم</span>;
      default:
        return <span>{stage}</span>;
    }
  };

  const openSlip = (order, type) => {
    setSlipType(type);
    setPrintSlipOrder(order);
  };

  const loading = ordersLoading || kpisLoading;

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      <PageHeader
        title="لوحة متابعة خط الإنتاج"
        subtitle="غرفة التحكم الشاملة لمسار الأوردرات عبر مراحل التشغيل الأربعة"
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="primary" onClick={() => navigate('/production-orders/cutting')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>✂️</span> أمر قص جديد
            </Btn>
            <Btn variant="secondary" onClick={() => { refetchOrders(); refetchKPIs(); }}>
              🔄 تحديث
            </Btn>
          </div>
        }
      />

      {/* KPI Cards Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}>
        {/* Cutting */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderTop: '3px solid #0284c7',
          borderRadius: 10,
          padding: '16px 20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>
            <span>✂️ في القص</span>
            <span>{kpis?.cutting_orders || 0} أوردر</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0284c7', marginTop: 8 }}>
            {Number(kpis?.cutting_pieces || 0).toLocaleString()} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>قطعة</span>
          </div>
        </div>

        {/* Sorting */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderTop: '3px solid #d97706',
          borderRadius: 10,
          padding: '16px 20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>
            <span>🗂️ في الفرز</span>
            <span>{kpis?.sorting_orders || 0} أوردر</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#d97706', marginTop: 8 }}>
            {Number(kpis?.sorting_pieces || 0).toLocaleString()} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>قطعة</span>
          </div>
        </div>

        {/* Printing */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderTop: '3px solid #7c3aed',
          borderRadius: 10,
          padding: '16px 20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>
            <span>🖨️ في المطبعة</span>
            <span>{kpis?.printing_orders || 0} أوردر</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#7c3aed', marginTop: 8 }}>
            {Number(kpis?.printing_pieces || 0).toLocaleString()} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>قطعة</span>
          </div>
        </div>

        {/* Ready for Delivery */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderTop: '3px solid #059669',
          borderRadius: 10,
          padding: '16px 20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>
            <span>🚚 جاهز للتسليم</span>
            <span>{kpis?.ready_delivery_orders || 0} أوردر</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#059669', marginTop: 8 }}>
            {Number(kpis?.ready_delivery_pieces || 0).toLocaleString()} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>قطعة</span>
          </div>
        </div>

        {/* Delivered Total */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderTop: '3px solid #047857',
          borderRadius: 10,
          padding: '16px 20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>
            <span>✓ تم التسليم</span>
            <span>{kpis?.delivered_orders || 0} أوردر</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#047857', marginTop: 8 }}>
            {Number(kpis?.delivered_revenue || 0).toLocaleString()} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>ج.م</span>
          </div>
        </div>
      </div>

      {/* Controls: Search and View Mode Toggle */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 14,
        marginBottom: 20,
      }}>
        <div style={{ minWidth: 280, flex: 1, maxWidth: 420, position: 'relative' }}>
          <input
            type="text"
            placeholder="🔍 بحث برقم الموديل (مثلاً 6201)، اسم الموديل، العميل، المطبعة..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 36px 10px 16px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: 14,
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 14,
                padding: 4,
              }}
              title="مسح البحث"
            >
              ✕
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Time / Lifecycle Filter */}
          <div style={{ display: 'flex', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 3 }}>
            <button
              type="button"
              onClick={() => setTimeFilter('active')}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                background: timeFilter === 'active' ? 'var(--accent)' : 'transparent',
                color: timeFilter === 'active' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 12,
                boxShadow: timeFilter === 'active' ? '0 1px 3px rgba(37,99,235,0.25)' : 'none',
                transition: 'all 0.15s ease',
              }}
              title="عرض الأوردرات الجارية في خط الإنتاج فقط وإخفاء المسلم لتسريع اللوحة"
            >
              🏭 الأوردرات الجارية
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('month')}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                background: timeFilter === 'month' ? 'var(--accent)' : 'transparent',
                color: timeFilter === 'month' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 12,
                boxShadow: timeFilter === 'month' ? '0 1px 3px rgba(37,99,235,0.25)' : 'none',
                transition: 'all 0.15s ease',
              }}
              title="أوردرات الشهر الحالي"
            >
              📅 هذا الشهر
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('all')}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                background: timeFilter === 'all' ? 'var(--accent)' : 'transparent',
                color: timeFilter === 'all' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 12,
                boxShadow: timeFilter === 'all' ? '0 1px 3px rgba(37,99,235,0.25)' : 'none',
                transition: 'all 0.15s ease',
              }}
              title="كل الأوردرات السابقة والحالية"
            >
              🌐 الكل
            </button>
          </div>

          {/* Card Density Toggle */}
          <div style={{ display: 'flex', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 3 }}>
            <button
              type="button"
              onClick={() => setCardDensity('compact')}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                background: cardDensity === 'compact' ? 'var(--accent)' : 'transparent',
                color: cardDensity === 'compact' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 12,
                boxShadow: cardDensity === 'compact' ? '0 1px 3px rgba(37,99,235,0.25)' : 'none',
                transition: 'all 0.15s ease',
              }}
              title="عرض مدمج وموفر للمساحة"
            >
              🎴 كروت مدمجة
            </button>
            <button
              type="button"
              onClick={() => setCardDensity('detailed')}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                background: cardDensity === 'detailed' ? 'var(--accent)' : 'transparent',
                color: cardDensity === 'detailed' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 12,
                boxShadow: cardDensity === 'detailed' ? '0 1px 3px rgba(37,99,235,0.25)' : 'none',
                transition: 'all 0.15s ease',
              }}
              title="عرض كامل التفاصيل والألوان"
            >
              📑 كروت مفصلة
            </button>
          </div>

          {/* View Mode Toggle */}
          <div style={{ display: 'flex', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: 3 }}>
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                background: viewMode === 'kanban' ? 'var(--accent)' : 'transparent',
                color: viewMode === 'kanban' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 12,
                boxShadow: viewMode === 'kanban' ? '0 1px 3px rgba(37,99,235,0.25)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              🗂️ لوحة المراحل
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                background: viewMode === 'table' ? 'var(--accent)' : 'transparent',
                color: viewMode === 'table' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 12,
                boxShadow: viewMode === 'table' ? '0 1px 3px rgba(37,99,235,0.25)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              📋 جدول تفصيلي
            </button>
          </div>
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40 }}><Spinner /></div>}

      {/* Mode 1: Kanban Pipeline Board */}
      {!loading && viewMode === 'kanban' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(280px, 1fr))',
          gap: 16,
          alignItems: 'start',
          overflowX: 'auto',
          paddingBottom: 20,
        }}>
          {/* Column 1: Cutting */}
          {(() => {
            const col = getColItems(cuttingOrders, 'cutting');
            return (
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                overflow: 'hidden',
              }}>
                <div style={{
                  background: 'rgba(2, 132, 199, 0.08)',
                  borderBottom: '2px solid #0284c7',
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ fontWeight: 800, color: '#0284c7', fontSize: 15 }}>✂️ 1. مرحلة القص</span>
                  <span style={{ background: '#0284c7', color: '#ffffff', borderRadius: 12, padding: '2px 8px', fontSize: 12, fontWeight: 800 }}>
                    {cuttingOrders.length}
                  </span>
                </div>
                <div style={{
                  padding: 10,
                  minHeight: 350,
                  maxHeight: 'calc(100vh - 310px)',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: cardDensity === 'compact' ? 8 : 12,
                }}>
                  {cuttingOrders.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: 13 }}>
                      لا توجد أوردرات في مرحلة القص
                    </div>
                  ) : (
                    <>
                      {col.items.map(ord => (
                        <OrderKanbanCard
                          key={ord.id}
                          order={ord}
                          density={cardDensity}
                          onOpenDetails={() => setSelectedOrderDetails(ord)}
                          onOpenSlip={openSlip}
                          onAction={() => navigate('/production-orders/sorting')}
                          actionText="تحويل للفرز ➔"
                          onDelete={() => handleDeleteOrder(ord.id, ord.model_number)}
                        />
                      ))}
                      {col.hasMore && (
                        <button
                          type="button"
                          onClick={() => setExpandedColumns(prev => ({ ...prev, cutting: true }))}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 6,
                            border: '1px dashed var(--border)',
                            background: 'var(--bg-hover)',
                            color: '#0284c7',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            textAlign: 'center',
                          }}
                        >
                          + عرض {col.remaining} أوردر إضافي
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Column 2: Sorting */}
          {(() => {
            const col = getColItems(sortingOrders, 'sorting');
            return (
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                overflow: 'hidden',
              }}>
                <div style={{
                  background: 'rgba(217, 119, 6, 0.08)',
                  borderBottom: '2px solid #d97706',
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ fontWeight: 800, color: '#d97706', fontSize: 15 }}>🗂️ 2. فرز ما بعد القص</span>
                  <span style={{ background: '#d97706', color: '#ffffff', borderRadius: 12, padding: '2px 8px', fontSize: 12, fontWeight: 800 }}>
                    {sortingOrders.length}
                  </span>
                </div>
                <div style={{
                  padding: 10,
                  minHeight: 350,
                  maxHeight: 'calc(100vh - 310px)',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: cardDensity === 'compact' ? 8 : 12,
                }}>
                  {sortingOrders.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: 13 }}>
                      لا توجد أوردرات في الفرز
                    </div>
                  ) : (
                    <>
                      {col.items.map(ord => (
                        <OrderKanbanCard
                          key={ord.id}
                          order={ord}
                          density={cardDensity}
                          onOpenDetails={() => setSelectedOrderDetails(ord)}
                          onOpenSlip={openSlip}
                          onAction={() => navigate('/production-orders/printing')}
                          actionText="إرسال للمطبعة ➔"
                          onDelete={() => handleDeleteOrder(ord.id, ord.model_number)}
                        />
                      ))}
                      {col.hasMore && (
                        <button
                          type="button"
                          onClick={() => setExpandedColumns(prev => ({ ...prev, sorting: true }))}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 6,
                            border: '1px dashed var(--border)',
                            background: 'var(--bg-hover)',
                            color: '#d97706',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            textAlign: 'center',
                          }}
                        >
                          + عرض {col.remaining} أوردر إضافي
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Column 3: Printing */}
          {(() => {
            const col = getColItems(printingOrders, 'printing');
            return (
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                overflow: 'hidden',
              }}>
                <div style={{
                  background: 'rgba(124, 58, 237, 0.08)',
                  borderBottom: '2px solid #7c3aed',
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ fontWeight: 800, color: '#7c3aed', fontSize: 15 }}>🖨️ 3. في المطبعة</span>
                  <span style={{ background: '#7c3aed', color: '#ffffff', borderRadius: 12, padding: '2px 8px', fontSize: 12, fontWeight: 800 }}>
                    {printingOrders.length}
                  </span>
                </div>
                <div style={{
                  padding: 10,
                  minHeight: 350,
                  maxHeight: 'calc(100vh - 310px)',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: cardDensity === 'compact' ? 8 : 12,
                }}>
                  {printingOrders.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: 13 }}>
                      لا توجد أوردرات في المطبعة
                    </div>
                  ) : (
                    <>
                      {col.items.map(ord => (
                        <OrderKanbanCard
                          key={ord.id}
                          order={ord}
                          density={cardDensity}
                          onOpenDetails={() => setSelectedOrderDetails(ord)}
                          onOpenSlip={openSlip}
                          onAction={() => navigate('/production-orders/printing')}
                          actionText={ord.print_sent_at ? "استلام من المطبعة ✓" : "إرسال للمطبعة ➔"}
                          onDelete={() => handleDeleteOrder(ord.id, ord.model_number)}
                        />
                      ))}
                      {col.hasMore && (
                        <button
                          type="button"
                          onClick={() => setExpandedColumns(prev => ({ ...prev, printing: true }))}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 6,
                            border: '1px dashed var(--border)',
                            background: 'var(--bg-hover)',
                            color: '#7c3aed',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            textAlign: 'center',
                          }}
                        >
                          + عرض {col.remaining} أوردر إضافي
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Column 4: Delivery (with Sub-Tabs: Ready vs Delivered) */}
          {(() => {
            const col = getColItems(deliveryColumnOrders, 'delivery');
            return (
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                overflow: 'hidden',
              }}>
                <div style={{
                  background: 'rgba(5, 150, 105, 0.08)',
                  borderBottom: '2px solid #059669',
                  padding: '10px 14px',
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}>
                    <span style={{ fontWeight: 800, color: '#059669', fontSize: 15 }}>🚚 4. التسليم</span>
                    <span style={{ background: '#059669', color: '#ffffff', borderRadius: 12, padding: '2px 8px', fontSize: 12, fontWeight: 800 }}>
                      {readyForDeliveryOrders.length} جاهز
                    </span>
                  </div>

                  {/* Sub-filter tabs inside column 4 */}
                  <div style={{ display: 'flex', gap: 4, background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: 3, borderRadius: 6 }}>
                    <button
                      type="button"
                      onClick={() => setDeliverySubTab('ready')}
                      style={{
                        flex: 1,
                        padding: '4px 6px',
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 4,
                        border: 'none',
                        background: deliverySubTab === 'ready' ? '#059669' : 'transparent',
                        color: deliverySubTab === 'ready' ? '#ffffff' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      بانتظار التسليم ({readyForDeliveryOrders.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeliverySubTab('delivered')}
                      style={{
                        flex: 1,
                        padding: '4px 6px',
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 4,
                        border: 'none',
                        background: deliverySubTab === 'delivered' ? '#047857' : 'transparent',
                        color: deliverySubTab === 'delivered' ? '#ffffff' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      تم التسليم ({deliveredOrders.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeliverySubTab('all')}
                      style={{
                        padding: '4px 8px',
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 4,
                        border: 'none',
                        background: deliverySubTab === 'all' ? 'var(--bg-hover)' : 'transparent',
                        color: deliverySubTab === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      title="عرض الكل"
                    >
                      الكل
                    </button>
                  </div>
                </div>

                <div style={{
                  padding: 10,
                  minHeight: 350,
                  maxHeight: 'calc(100vh - 310px)',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: cardDensity === 'compact' ? 8 : 12,
                }}>
                  {deliveryColumnOrders.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: 13 }}>
                      {deliverySubTab === 'ready' ? 'لا توجد أوردرات بانتظار التسليم' : 'لا توجد أوردرات مسلمة'}
                    </div>
                  ) : (
                    <>
                      {col.items.map(ord => (
                        <OrderKanbanCard
                          key={ord.id}
                          order={ord}
                          density={cardDensity}
                          onOpenDetails={() => setSelectedOrderDetails(ord)}
                          onOpenSlip={openSlip}
                          onAction={() => navigate('/production-orders/delivery')}
                          actionText={ord.current_stage === 'delivered' ? 'معاينة الفاتورة' : 'تسليم للعميل 🚚'}
                          onDelete={() => handleDeleteOrder(ord.id, ord.model_number)}
                        />
                      ))}
                      {col.hasMore && (
                        <button
                          type="button"
                          onClick={() => setExpandedColumns(prev => ({ ...prev, delivery: true }))}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 6,
                            border: '1px dashed var(--border)',
                            background: 'var(--bg-hover)',
                            color: '#059669',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            textAlign: 'center',
                          }}
                        >
                          + عرض {col.remaining} أوردر إضافي
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Mode 2: Detailed Table View */}
      {!loading && viewMode === 'table' && (
        <Card style={{ padding: 20 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead>
                <tr style={{ background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 14px' }}>رقم الموديل</th>
                  <th style={{ padding: '12px 14px' }}>اسم الموديل</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>المرحلة الحالية</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>الكمية</th>
                  <th style={{ padding: '12px 14px' }}>المطبعة</th>
                  <th style={{ padding: '12px 14px' }}>العميل المسلم إليه</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>الإجمالي المالي</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>تاريخ الإنشاء</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      لا توجد أوردرات مطابقة للبحث
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(ord => (
                    <tr key={ord.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--accent)' }}>
                        {ord.model_number || ord.order_number}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 600 }}>{ord.order_name || ord.product_name}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {getStageBadge(ord.current_stage)}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700 }}>
                        {getPiecesCount(ord).toLocaleString()} قطعة
                      </td>
                      <td style={{ padding: '12px 14px', color: ord.print_shop_name ? '#7c3aed' : 'var(--text-muted)' }}>
                        {ord.print_shop_name || '—'}
                      </td>
                      <td style={{ padding: '12px 14px', color: ord.customer_name ? '#0284c7' : 'var(--text-muted)' }}>
                        {ord.customer_name || '—'}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: '#059669' }}>
                        {ord.total_price ? `${Number(ord.total_price).toLocaleString()} ج.م` : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                        {new Date(ord.created_at).toLocaleDateString('ar-EG')}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <Btn variant="secondary" size="sm" onClick={() => setSelectedOrderDetails(ord)}>
                            🔍 تفاصيل
                          </Btn>
                          <Btn
                            variant="danger"
                            size="sm"
                            onClick={() => handleDeleteOrder(ord.id, ord.model_number)}
                            title="حذف الأوردر"
                          >
                            🗑️
                          </Btn>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal: Order Details & Timeline */}
      {selectedOrderDetails && (
        <Modal
          title={`تفاصيل ومسار الأوردر: موديل ${selectedOrderDetails.model_number} (${selectedOrderDetails.order_name || selectedOrderDetails.product_name})`}
          onClose={() => setSelectedOrderDetails(null)}
          zIndex={120}
        >
          <div style={{ padding: 8 }}>
            {/* Timeline Progress Tracker */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              position: 'relative',
              marginBottom: 32,
              padding: '10px 20px',
            }}>
              {['القص', 'الفرز', 'المطبعة', 'التسليم'].map((stepName, sIdx) => {
                const stages = ['cutting', 'sorting', 'printing', 'ready_for_delivery', 'delivered'];
                const curIdx = stages.indexOf(selectedOrderDetails.current_stage);
                const isPassed = curIdx >= sIdx;
                const isCurrent = curIdx === sIdx;

                return (
                  <div key={sIdx} style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: isPassed ? '#059669' : 'var(--bg-hover)',
                      color: isPassed ? '#ffffff' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      margin: '0 auto 6px',
                      border: isCurrent ? '2px solid var(--accent)' : 'none',
                    }}>
                      {isPassed ? '✓' : sIdx + 1}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: isPassed ? 700 : 500 }}>
                      {stepName}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Colors Breakdown */}
            <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>جدول كميات الألوان بالمراحل:</h4>
            <div style={{
              background: 'var(--bg-card-subtle, rgba(255,255,255,0.02))',
              borderRadius: 8,
              border: '1px solid var(--border)',
              overflow: 'hidden',
              marginBottom: 20,
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-hover)' }}>
                    <th style={{ padding: '8px 12px' }}>اللون</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>القص</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>الفرز</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>المرسل مطبعة</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>المستلم مطبعة</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>المسلم للعميل</th>
                    <th style={{ padding: '8px 12px' }}>ملاحظة الفرز / الهالك</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedOrderDetails.colors || []).map((col) => (
                    <tr key={col.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 700 }}>{col.color}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>{col.cut_quantity}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: col.sorted_quantity !== null && col.sorted_quantity !== col.cut_quantity ? '#ef4444' : 'inherit' }}>
                        {col.sorted_quantity ?? '—'}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>{col.print_sent_quantity ?? '—'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>{col.print_received_quantity ?? '—'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: '#059669' }}>
                        {col.delivered_quantity ?? '—'}
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: 12 }}>
                        {col.sorting_note || col.print_note || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Stage Print Actions */}
            <div style={{
              background: 'var(--bg-hover)',
              padding: 16,
              borderRadius: 8,
              marginBottom: 20,
            }}>
              <span style={{ display: 'block', fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
                🖨️ طباعة أذونات المراحل لهذا الأوردر:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <Btn variant="secondary" size="sm" onClick={() => openSlip(selectedOrderDetails, 'cutting')}>
                  ✂️ إذن أمر القص
                </Btn>
                {selectedOrderDetails.total_sorted_quantity > 0 && (
                  <Btn variant="secondary" size="sm" onClick={() => openSlip(selectedOrderDetails, 'sorting')}>
                    🗂️ إذن الفرز
                  </Btn>
                )}
                {selectedOrderDetails.total_print_sent_quantity > 0 && (
                  <Btn variant="secondary" size="sm" onClick={() => openSlip(selectedOrderDetails, 'print_send')}>
                    🖨️ أمر توريد المطبعة
                  </Btn>
                )}
                {selectedOrderDetails.total_print_received_quantity > 0 && (
                  <Btn variant="secondary" size="sm" onClick={() => openSlip(selectedOrderDetails, 'print_receive')}>
                    📥 إذن استلام المطبعة
                  </Btn>
                )}
                {selectedOrderDetails.current_stage === 'delivered' && (
                  <Btn variant="primary" size="sm" onClick={() => openSlip(selectedOrderDetails, 'delivery')}>
                    🚚 إذن تسليم العميل
                  </Btn>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Btn
                variant="danger"
                size="sm"
                onClick={() => handleDeleteOrder(selectedOrderDetails.id, selectedOrderDetails.model_number)}
              >
                🗑️ حذف أمر الإنتاج
              </Btn>
              <Btn variant="secondary" onClick={() => setSelectedOrderDetails(null)}>
                إغلاق
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Printable Slip Preview Modal */}
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

// Subcomponent: Order Kanban Card
function OrderKanbanCard({ order, density = 'compact', onOpenDetails, onOpenSlip, onAction, actionText, onDelete }) {
  const pieces = order.total_cut_quantity || order.quantity || 0;

  if (density === 'compact') {
    return (
      <div style={{
        background: 'var(--bg-base)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '8px 10px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        transition: 'all 0.15s ease',
      }}>
        {/* Top line: Model & Count */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)' }}>
              {order.model_number || order.order_number}
            </span>
            <span style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 110,
            }}>
              {order.order_name || order.product_name}
            </span>
          </div>
          <span style={{
            fontSize: 11,
            fontWeight: 800,
            background: 'var(--bg-hover)',
            color: 'var(--text-secondary)',
            padding: '2px 6px',
            borderRadius: 4,
            whiteSpace: 'nowrap',
          }}>
            {pieces} ق
          </span>
        </div>

        {/* Sub-status label */}
        <div style={{ fontSize: 11, fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {order.current_stage === 'printing' && (
              <span style={{ color: order.print_sent_at ? '#7c3aed' : '#d97706' }}>
                {order.print_sent_at ? `🖨️ ${order.print_shop_name || 'مطبعة'}` : '⏳ بانتظار الخروج'}
              </span>
            )}
            {order.current_stage === 'ready_for_delivery' && (
              <span style={{ color: '#059669' }}>🚚 جاهز للتسليم</span>
            )}
            {order.current_stage === 'delivered' && (
              <span style={{ color: '#047857' }}>
                ✓ مسلم {order.total_price ? `(${Number(order.total_price).toLocaleString()} ج)` : ''}
              </span>
            )}
            {order.current_stage === 'cutting' && (
              <span style={{ color: '#0284c7' }}>✂️ بانتظار الفرز</span>
            )}
            {order.current_stage === 'sorting' && (
              <span style={{ color: '#d97706' }}>🗂️ قيد الفرز</span>
            )}
          </div>

          {order.customer_name && order.current_stage !== 'delivered' && (
            <span style={{ color: '#0284c7', fontSize: 10, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              👤 {order.customer_name}
            </span>
          )}
        </div>

        {/* Action footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: 4,
          borderTop: '1px solid var(--border)',
        }}>
          <button
            type="button"
            onClick={onOpenDetails}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 11,
              padding: '2px 4px',
            }}
            title="عرض التفاصيل والأذونات"
          >
            🔍 تفاصيل
          </button>

          <Btn
            variant="primary"
            size="sm"
            onClick={onAction}
            style={{ fontSize: 11, padding: '3px 8px' }}
          >
            {actionText}
          </Btn>
        </div>
      </div>
    );
  }

  // Detailed Card View
  return (
    <div style={{
      background: 'var(--bg-base)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: 14,
      boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>
            {order.model_number || order.order_number}
          </span>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
            {order.order_name || order.product_name}
          </div>
        </div>
        <span style={{
          fontSize: 13,
          fontWeight: 800,
          background: 'var(--bg-hover)',
          color: 'var(--text-secondary)',
          padding: '2px 8px',
          borderRadius: 6,
        }}>
          {pieces} ق
        </span>
      </div>

      {/* Colors Badges */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {(order.colors || []).slice(0, 3).map((col, idx) => (
          <span
            key={idx}
            style={{
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: 11,
              border: '1px solid var(--border)',
            }}
          >
            {col.color}: {col.cut_quantity}
          </span>
        ))}
        {(order.colors || []).length > 3 && (
          <span
            style={{
              background: 'var(--bg-hover)',
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
            }}
          >
            +{order.colors.length - 3} ألوان
          </span>
        )}
      </div>

      {/* Stage Specific Note */}
      {order.current_stage === 'printing' && (
        <div style={{ fontSize: 12, fontWeight: 700 }}>
          {order.print_sent_at ? (
            <span style={{ color: '#7c3aed' }}>
              🖨️ في المطبعة: {order.print_shop_name || 'مطبعة مسجلة'}
            </span>
          ) : (
            <span style={{ color: '#d97706' }}>
              ⏳ جاهز للإرسال للمطبعة
            </span>
          )}
        </div>
      )}

      {order.current_stage === 'ready_for_delivery' && (
        <div style={{ fontSize: 12, color: '#059669', fontWeight: 700 }}>
          🚚 جاهز للتسليم للعميل
        </div>
      )}

      {order.customer_name && (
        <div style={{ fontSize: 12, color: '#0284c7', fontWeight: 600 }}>
          العميل: {order.customer_name} {order.total_price ? `(${Number(order.total_price).toLocaleString()} ج)` : ''}
        </div>
      )}

      {/* Actions Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid var(--border)', marginTop: 2 }}>
        <button
          type="button"
          onClick={onOpenDetails}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}
        >
          🔍 تفاصيل
        </button>

        <Btn variant="primary" size="sm" onClick={onAction}>
          {actionText}
        </Btn>
      </div>
    </div>
  );
}
