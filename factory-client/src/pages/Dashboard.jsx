import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { dashboardApi } from '../api';
import { useFetch } from '../hooks/useFetch';
import { MetricCard, Card, Spinner, ErrorMsg, PageHeader, Badge } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';

const productionColors = {
  pending: 'var(--warn)',
  in_progress: 'var(--info)',
  done: 'var(--accent)',
  shipped: '#8a95aa',
};

export default function Dashboard() {
  const { data: stats, loading, error } = useFetch(dashboardApi.stats);
  const { t, language } = useLanguage();

  const chartData = stats?.production_summary?.map(p => ({
    name: p.status.replace('_', ' '),
    count: Number.parseInt(p.count, 10),
    fill: productionColors[p.status] || 'var(--accent)',
  })) || [];

  return (
    <div style={{ padding: '28px 28px 40px' }}>
      <PageHeader
        title={t('dashboard', 'Dashboard')}
        subtitle={new Date().toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      />

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}

      {stats && (
        <>
          {/* Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 14, marginBottom: 24 }}>
            <MetricCard label={t('activeOrders', 'Active orders')}     value={stats.active_orders}     sub={t('currentlyOpen', 'Currently open')} />
            <MetricCard label={t('revenue', 'Revenue')}   value={`$${Number(stats.monthly_revenue).toLocaleString()}`} sub={t('customerPaymentsThisMonth', 'Customer payments this month')} color="var(--accent)" />
            <MetricCard label={t('moneySpent', 'Money spent')}       value={`$${Number(stats.monthly_spent).toLocaleString()}`} sub={t('paidPayrollThisMonth', 'Paid payroll this month')} color="var(--danger)" />
            <MetricCard label={t('netAfterPayroll', 'Net after payroll')} value={`$${Number(stats.monthly_net).toLocaleString()}`} sub={t('revenueMinusPaidSalary', 'Revenue minus paid salary')} color={Number(stats.monthly_net) >= 0 ? 'var(--accent)' : 'var(--danger)'} />
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Card>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: 'var(--text-secondary)' }}>{t('productionByStatus', 'Production by status')}</div>
              {chartData.length ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} barCategoryGap="30%">
                    <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    />
                    <Bar dataKey="count" radius={[4,4,0,0]} fill="var(--accent)" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  {t('noProductionDataYet', 'No production data yet')}
                </div>
              )}
            </Card>

            <Card>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: 'var(--text-secondary)' }}>{t('quickStats', 'Quick stats')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: t('activeOrders', 'Active orders'), value: stats.active_orders, badge: 'info' },
                  { label: t('lowStockItems', 'Low stock items'), value: stats.low_stock_alerts, badge: stats.low_stock_alerts > 0 ? 'danger' : 'success' },
                  { label: t('activeEmployees', 'Active employees'), value: stats.active_employees, badge: 'success' },
                  { label: t('revenue', 'Revenue'), value: `$${Number(stats.monthly_revenue).toLocaleString()}`, badge: 'success' },
                  { label: t('paidPayrollThisMonthShort', 'Paid payroll this month'), value: `$${Number(stats.paid_payroll_spent).toLocaleString()}`, badge: 'danger' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.label}</span>
                    <Badge variant={item.badge}>{item.value}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
