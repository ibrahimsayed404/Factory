import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { productionTrackingApi } from '../api';
import { useFetch } from '../hooks/useFetch';
import { Badge, Card, ErrorMsg, PageHeader, Select, Spinner, Table } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';

const efficiencyVariant = (efficiency) => {
  if (efficiency === null || efficiency === undefined) return 'neutral';
  if (efficiency > 95) return 'success';
  if (efficiency >= 85) return 'warning';
  return 'danger';
};

export default function ProductionTrackingReport() {
  const { t } = useLanguage();
  const { data: orders, loading, error } = useFetch(productionTrackingApi.list);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const { data: report, loading: reportLoading, error: reportError } = useFetch(
    () => (selectedOrderId ? productionTrackingApi.getReport(selectedOrderId) : null),
    [selectedOrderId]
  );

  const selected = useMemo(
    () => (orders || []).find((o) => String(o.id) === String(selectedOrderId)) || null,
    [orders, selectedOrderId]
  );

  const warning = (report?.loss_percentage || 0) > 10;

  const chartData = report
    ? [
      { name: t('input', 'Input'), quantity: report.input ?? 0 },
      { name: t('sorting', 'Sorting'), quantity: report.sorting ?? 0 },
      { name: t('final', 'Final'), quantity: report.final ?? 0 },
    ]
    : [];

  const phaseTableColumns = [
    { key: 'phase', label: t('phase', 'Phase') },
    { key: 'quantity', label: t('quantity', 'Quantity') },
    { key: 'employee', label: t('employee', 'Employee'), render: (v) => v || '—' },
    { key: 'machine', label: t('machine', 'Machine'), render: (v) => v || '—' },
    { key: 'loss_reason', label: t('loss', 'Loss Reason'), render: (v) => v || '—' },
    { key: 'duration_minutes', label: t('duration', 'Duration (min)'), render: (v) => v ?? '—' },
  ];

  const tableColumns = [
    { key: 'label', label: t('metric', 'Metric') },
    { key: 'value', label: t('value', 'Value') },
  ];

  const tableData = report
    ? [
      { label: t('input', 'Input'), value: report.input ?? '—' },
      { label: t('sorting', 'Sorting'), value: `${report.sorting ?? '—'} (loss: ${report.sorting_loss ?? '—'})` },
      { label: t('final', 'Final'), value: `${report.final ?? '—'} (loss: ${report.final_loss ?? '—'})` },
      { label: t('totalLoss', 'Total Loss'), value: report.total_loss ?? '—' },
      { label: t('lossPercentage', 'Loss Percentage'), value: report.loss_percentage !== null && report.loss_percentage !== undefined ? `${report.loss_percentage}%` : '—' },
      { label: t('efficiency', 'Efficiency'), value: report.efficiency !== null && report.efficiency !== undefined ? `${report.efficiency}%` : '—' },
    ]
    : [];

  return (
    <div style={{ padding: '28px 28px 40px' }}>
      <PageHeader title={t('productionTrackingReport', 'Production Tracking Report')} subtitle={t('comparePhases', 'Compare quantities across Input, Sorting, and Final phases')} />

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}
      {reportLoading && selectedOrderId && <Spinner />}
      {reportError && <ErrorMsg msg={reportError} />}

      <Card style={{ marginBottom: 16 }}>
        <Select label={t('selectProductionOrder', 'Select Production Order')} value={selectedOrderId} onChange={(e) => setSelectedOrderId(e.target.value)}>
          <option value="">{t('chooseOrder', 'Choose order')}</option>
          {(orders || []).map((order) => (
            <option key={order.id} value={order.id}>
              {order.order_number} - {order.model_number}
            </option>
          ))}
        </Select>
      </Card>

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
