import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { productApi, productionTrackingApi } from '../api';
import { useFetch } from '../hooks/useFetch';
import { Badge, Card, ErrorMsg, PageHeader, Select, Spinner, Table, Btn, Modal, Input } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { buildProductNameLookup, formatOrderOptionLabel } from '../utils/productionOrderDisplay';

const efficiencyVariant = (efficiency) => {
  if (efficiency === null || efficiency === undefined) return 'neutral';
  if (efficiency > 95) return 'success';
  if (efficiency >= 85) return 'warning';
  return 'danger';
};

export default function ProductionTrackingReport() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: orders, loading, error, refetch } = useFetch(productionTrackingApi.list);
  const { data: products } = useFetch(productApi.list);
  const productNameById = useMemo(() => buildProductNameLookup(products), [products]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { data: report, loading: reportLoading, error: reportError } = useFetch(
    () => (selectedOrderId ? productionTrackingApi.getReport(selectedOrderId) : null),
    [selectedOrderId]
  );

  const selected = useMemo(
    () => (orders || []).find((o) => String(o.id) === String(selectedOrderId)) || null,
    [orders, selectedOrderId]
  );

  const canDelete = Boolean(selectedOrderId && report);

  const handleDeleteOrder = async () => {
    if (!selectedOrderId) return;
    if (!deletePassword.trim()) {
      setDeleteError(t('passwordRequired', 'Password is required.'));
      return;
    }
    setDeleting(true);
    setDeleteError('');
    try {
      await productionTrackingApi.deleteOrder(selectedOrderId, { password: deletePassword });
      setShowDeleteConfirm(false);
      setSelectedOrderId('');
      setDeletePassword('');
      await refetch();
    } catch (e) {
      setDeleteError(e.message || t('deleteFailed', 'Failed to delete order.'));
    } finally {
      setDeleting(false);
    }
  };

  const warning = (report?.loss_percentage || 0) > 10;

  const cutQty = report?.total_cut_quantity ?? report?.input ?? 0;
  const sortedQty = report?.total_sorted_quantity ?? report?.sorting ?? cutQty;
  const printSent = report?.total_print_sent_quantity ?? report?.outsourcing ?? 0;
  const printRecv = report?.total_print_received_quantity ?? printSent;
  const deliveredQty = report?.total_delivered_quantity ?? report?.final ?? 0;
  const cutLoss = Math.max(0, cutQty - sortedQty);
  const printLoss = Math.max(0, printSent - printRecv);
  const totalLoss = cutLoss + printLoss;
  const eff = cutQty > 0 ? ((deliveredQty / cutQty) * 100).toFixed(1) : (report?.efficiency ?? 100);

  const chartData = report
    ? [
      { name: '1. القص', quantity: cutQty },
      { name: '2. الفرز', quantity: sortedQty },
      { name: '3. المطبعة', quantity: printRecv || printSent },
      { name: '4. التسليم', quantity: deliveredQty },
    ]
    : [];

  const phaseTableColumns = [
    { key: 'phase', label: t('phase', 'Phase') },
    { key: 'quantity', label: t('quantity', 'Quantity') },
    { key: 'employee', label: t('employee', 'Employee'), render: (v) => v || '—' },
    {
      key: 'facility',
      label: t('machineOrPartnerFactory', 'Machine / Partner Factory'),
      render: (_, row) => (
        row.phase === 'outsourcing'
          ? (row.partner_factory || '—')
          : (row.machine || '—')
      ),
    },
    { key: 'loss_reason', label: t('loss', 'Loss Reason'), render: (v) => v || '—' },
    { key: 'duration_minutes', label: t('duration', 'Duration (min)'), render: (v) => v ?? '—' },
  ];

  const tableColumns = [
    { key: 'label', label: t('metric', 'Metric') },
    { key: 'value', label: t('value', 'Value') },
  ];

  const tableData = report
    ? [
      { label: 'رقم الموديل واسم الأوردر', value: `${report.model_number || report.order_number} — ${report.order_name || report.product_name || '—'}` },
      { label: 'المرحلة الحالية للأوردر', value: report.current_stage || '—' },
      { label: '1. مرحلة القص (Cut Qty)', value: `${cutQty} قطعة` },
      { label: '2. مرحلة الفرز (Sorted Qty)', value: `${sortedQty} قطعة ${cutLoss > 0 ? `(هالك القص: ${cutLoss} ق)` : '✓ بدون هالك'}` },
      { label: '3. المطبعة والتشغيل الخارجي', value: report.print_shop_name ? `${report.print_shop_name} — أرسل: ${printSent} ق | استلم: ${printRecv} ق ${printLoss > 0 ? `(عجز: ${printLoss} ق)` : ''}` : 'لم يحول لمطبعة خارجية' },
      { label: '4. التسليم للعميل (Delivery)', value: deliveredQty > 0 ? `${deliveredQty} قطعة (العميل: ${report.customer_name || '—'} · ${report.total_price ? Number(report.total_price).toLocaleString() + ' ج.م' : ''})` : 'بانتظار التسليم' },
      { label: 'إجمالي القطع المفقودة (Total Loss)', value: `${totalLoss} قطعة` },
      { label: 'معدل الكفاءة والإنجاز (Yield)', value: `${eff}%` },
    ]
    : [];

  return (
    <div style={{ padding: '28px 28px 40px' }}>
      <PageHeader
        title="تقرير متابعة دورة الإنتاج الشاملة"
        subtitle="مقارنة الكميات والهالك عبر مراحل التشغيل الأربعة: القص، الفرز، المطبعة، والتسليم"
      />

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}
      {reportLoading && selectedOrderId && <Spinner />}
      {reportError && <ErrorMsg msg={reportError} />}

      <Card style={{ marginBottom: 16 }}>
        <Select label={t('selectProductionOrder', 'Select Production Order')} value={selectedOrderId} onChange={(e) => setSelectedOrderId(e.target.value)}>
          <option value="">{t('chooseOrder', 'Choose order')}</option>
          {(orders || []).map((order) => (
            <option key={order.id} value={order.id}>
              {formatOrderOptionLabel(order, productNameById)}
            </option>
          ))}
        </Select>
        {canDelete && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <Btn size="sm" variant="danger" onClick={() => { setDeletePassword(''); setDeleteError(''); setShowDeleteConfirm(true); }}>
              {t('delete', 'Delete Order')}
            </Btn>
          </div>
        )}
      </Card>

      {showDeleteConfirm && (
        <Modal title={t('deleteOrder', 'Delete Production Order?')} onClose={() => setShowDeleteConfirm(false)} width={400}>
          <div style={{ marginBottom: 16, fontSize: 14 }}>
            {t('cancelOrderWarning', 'This will permanently delete the order and restore deducted materials. Finished product stock will be reversed if applicable.')}
          </div>
          <Input
            label={t('confirmPassword', 'Enter your password to confirm')}
            type="password"
            value={deletePassword}
            onChange={(e) => {
              setDeletePassword(e.target.value);
              if (deleteError) setDeleteError('');
            }}
            autoComplete="current-password"
            placeholder={user?.email || ''}
          />
          {deleteError && <div style={{ marginTop: 12 }}><ErrorMsg msg={deleteError} /></div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <Btn onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
              {t('cancel', 'Cancel')}
            </Btn>
            <Btn variant="danger" onClick={handleDeleteOrder} disabled={deleting}>
              {deleting ? t('deleting', 'Deleting...') : t('delete', 'Delete')}
            </Btn>
          </div>
        </Modal>
      )}

      {selected && report && (
        <>
          <div style={{ marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
            <Badge variant={efficiencyVariant(report.efficiency)}>
              {t('efficiency', 'Efficiency')}: {report.efficiency ?? '—'}%
            </Badge>
            <Badge variant={warning ? 'danger' : 'success'}>
              {t('loss', 'Loss')}: {report.loss_percentage ?? 0}%
            </Badge>
          </div>

          {warning && (
            <div style={{ marginBottom: 14 }}>
              <Badge variant="danger">{t('warningLoss', 'Warning: Loss exceeds 10% (HIGH_LOSS alert)')}</Badge>
            </div>
          )}

          {Array.isArray(report.alerts) && report.alerts.length > 0 && (
            <Card style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t('alerts', 'Alerts')}</div>
              {report.alerts.map((alert, idx) => (
                <div key={`${alert.type}-${idx}`} style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 4 }}>
                  {alert.type}: {alert.message}
                </div>
              ))}
            </Card>
          )}

          <Card style={{ marginBottom: 16 }}>
            <Table columns={tableColumns} data={tableData} />
          </Card>

          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>{t('phaseDetails', 'Phase Details')}</div>
            <Table columns={phaseTableColumns} data={report.phases || []} />
          </Card>

          <Card>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>{t('phaseQuantityChart', 'Phase Quantity Chart')}</div>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="quantity" fill="var(--accent)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
