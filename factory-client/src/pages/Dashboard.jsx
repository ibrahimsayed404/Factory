import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { dashboardApi } from '../api';
import { useFetch } from '../hooks/useFetch';
import { MetricCard, Card, Spinner, ErrorMsg, PageHeader, Badge } from '../components/ui';
import { useLanguage } from '../context/LanguageContext';

const productionColors = {
  pending: 'var(--warn)',
  in_progress: 'var(--info)',
  done: 'var(--accent)',
  shipped: '#8a95aa',
  sorting: 'var(--info)',
  outsourcing: '#a78bfa',
  completed: 'var(--accent)',
};

const productionStatusLabel = (status) => ({
  pending: 'Pending',
  in_progress: 'In Progress',
  done: 'Done',
  shipped: 'Shipped',
  sorting: 'Sorting',
  outsourcing: 'Outsourcing',
  completed: 'Completed',
}[status] || status.replaceAll('_', ' '));

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: '10px 14px',
      fontSize: 12,
      boxShadow: 'var(--shadow-md)',
    }}>
      <div style={{ color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || 'var(--text-primary)' }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</strong>
        </div>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const { data: stats, loading, error } = useFetch(dashboardApi.stats);
  const { data: stageEfficiency } = useFetch(dashboardApi.stageEfficiency);
  const { t, language } = useLanguage();

  const chartData = stats?.production_summary?.map(p => ({
    name: productionStatusLabel(p.status),
    count: Number.parseInt(p.count, 10),
    fill: productionColors[p.status] || 'var(--accent)',
  })) || [];

  return (
    <div style={{ padding: '28px 30px 40px' }}>
      <PageHeader
        title={t('dashboard', 'Dashboard')}
        subtitle={new Date().toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      />

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}

      {stats && (
        <>
          {/* Metrics */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16, marginBottom: 28,
          }}>
            <div className="animate-in stagger-1">
              <MetricCard
                label={t('activeOrders', 'Active orders')}
                value={stats.active_orders}
                sub={t('currentlyOpen', 'Currently open')}
                icon="📋"
              />
            </div>
            <div className="animate-in stagger-2">
              <MetricCard
                label={t('revenue', 'Revenue')}
                value={`$${Number(stats.monthly_revenue).toLocaleString()}`}
                sub={t('customerPaymentsThisMonth', 'Customer payments this month')}
                color="var(--accent)"
                icon="💰"
              />
            </div>
            <div className="animate-in stagger-3">
              <MetricCard
                label={t('moneySpent', 'Money spent')}
                value={`$${Number(stats.monthly_spent).toLocaleString()}`}
                sub={t('paidPayrollThisMonth', 'Paid payroll this month')}
                color="var(--danger)"
                icon="📉"
              />
            </div>
            <div className="animate-in stagger-4">
              <MetricCard
                label={t('netAfterPayroll', 'Net after payroll')}
                value={`$${Number(stats.monthly_net).toLocaleString()}`}
                sub={t('revenueMinusPaidSalary', 'Revenue minus paid salary')}
                color={Number(stats.monthly_net) >= 0 ? 'var(--accent)' : 'var(--danger)'}
                icon="📊"
              />
            </div>
          </div>

          {/* Charts */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: 16,
          }}>
            <div className="animate-in stagger-3">
              <Card>
                <div style={{
                  fontSize: 13, fontWeight: 700, marginBottom: 18,
                  color: 'var(--text-secondary)', letterSpacing: '-0.01em',
                }}>
                  {t('productionByStatus', 'Production by status')}
                </div>
                {chartData.length ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} barCategoryGap="30%">
                      <defs>
                        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22d3a0" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#22d3a0" stopOpacity={0.4} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="url(#barGrad)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{
                    height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-muted)', fontSize: 13,
                  }}>
                    {t('noProductionDataYet', 'No production data yet')}
                  </div>
                )}
              </Card>
            </div>

            <div className="animate-in stagger-4">
              <Card>
                <div style={{
                  fontSize: 13, fontWeight: 700, marginBottom: 18,
                  color: 'var(--text-secondary)', letterSpacing: '-0.01em',
                }}>
                  {t('quickStats', 'Quick stats')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {[
                    { label: t('activeOrders', 'Active orders'), value: stats.active_orders, badge: 'info' },
                    { label: t('lowStockItems', 'Low stock items'), value: stats.low_stock_alerts, badge: stats.low_stock_alerts > 0 ? 'danger' : 'success' },
                    { label: t('activeEmployees', 'Active employees'), value: stats.active_employees, badge: 'success' },
                    { label: t('revenue', 'Revenue'), value: `$${Number(stats.monthly_revenue).toLocaleString()}`, badge: 'success' },
                    { label: t('paidPayrollThisMonthShort', 'Paid payroll this month'), value: `$${Number(stats.paid_payroll_spent).toLocaleString()}`, badge: 'danger' },
                  ].map((item, i) => (
                    <div key={item.label} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 6px',
                      borderBottom: i < 4 ? '1px solid var(--border)' : 'none',
                      transition: 'background .15s var(--ease-out)',
                      borderRadius: 'var(--radius-xs)',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{item.label}</span>
                      <Badge variant={item.badge}>{item.value}</Badge>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          {/* Stage Efficiency */}
          {stageEfficiency && (
            <div style={{ marginTop: 28 }}>
              <Card>
                <div style={{
                  fontSize: 13, fontWeight: 700, marginBottom: 18,
                  color: 'var(--text-secondary)', letterSpacing: '-0.01em',
                }}>
                  {t('stageEfficiency', 'Stage Efficiency')}
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 16,
                }}>
                  {['input', 'sorting', 'outsourcing', 'final'].map((phase) => {
                    const data = stageEfficiency[phase] || {};
                    const phaseLabel = t(phase, phase.charAt(0).toUpperCase() + phase.slice(1));
                    return (
                      <div key={phase} style={{
                        padding: 14,
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-hover)',
                        border: '1px solid var(--border)',
                      }}>
                        <div style={{
                          fontSize: 12, fontWeight: 700, marginBottom: 10,
                          color: 'var(--text-secondary)', textTransform: 'capitalize',
                        }}>
                          {phaseLabel}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('totalQty', 'Total Qty')}</span>
                            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                              {data.total_quantity || 0}
                            </div>
                          </div>
                          <div>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('avgLoss', 'Avg Loss %')}</span>
                            <div style={{ fontSize: 16, fontWeight: 700, color: Number(data.average_loss_percentage) > 10 ? 'var(--danger)' : 'var(--accent)' }}>
                              {(data.average_loss_percentage || 0).toFixed(2)}%
                            </div>
                          </div>
                          <div>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('currentOrders', 'Current Orders')}</span>
                            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                              {data.current_order_count || 0}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
