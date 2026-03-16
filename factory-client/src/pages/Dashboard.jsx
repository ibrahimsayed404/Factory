import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { dashboardApi } from '../api';
import { useFetch } from '../hooks/useFetch';
import { MetricCard, Card, Spinner, ErrorMsg, PageHeader, Badge, statusVariant } from '../components/ui';

const productionColors = {
  pending: 'var(--warn)',
  in_progress: 'var(--info)',
  done: 'var(--accent)',
  shipped: '#8a95aa',
};

export default function Dashboard() {
  const { data: stats, loading, error } = useFetch(dashboardApi.stats);

  const chartData = stats?.production_summary?.map(p => ({
    name: p.status.replace('_', ' '),
    count: parseInt(p.count),
    fill: productionColors[p.status] || 'var(--accent)',
  })) || [];

  return (
    <div style={{ padding: '28px 28px 40px' }}>
      <PageHeader
        title="Dashboard"
        subtitle={new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      />

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}

      {stats && (
        <>
          {/* Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 14, marginBottom: 24 }}>
            <MetricCard label="Active orders"     value={stats.active_orders}     sub="Currently open" />
            <MetricCard label="Revenue"   value={`$${Number(stats.monthly_revenue).toLocaleString()}`} sub="Customer payments this month" color="var(--accent)" />
            <MetricCard label="Money spent"       value={`$${Number(stats.monthly_spent).toLocaleString()}`} sub="Paid payroll this month" color="var(--danger)" />
            <MetricCard label="Net after payroll" value={`$${Number(stats.monthly_net).toLocaleString()}`} sub="Revenue minus paid salary" color={Number(stats.monthly_net) >= 0 ? 'var(--accent)' : 'var(--danger)'} />
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Card>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: 'var(--text-secondary)' }}>Production by status</div>
              {chartData.length ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} barCategoryGap="30%">
                    <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    />
                    <Bar dataKey="count" radius={[4,4,0,0]}>
                      {chartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  No production data yet
                </div>
              )}
            </Card>

            <Card>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: 'var(--text-secondary)' }}>Quick stats</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Active orders', value: stats.active_orders, badge: 'info' },
                  { label: 'Low stock items', value: stats.low_stock_alerts, badge: stats.low_stock_alerts > 0 ? 'danger' : 'success' },
                  { label: 'Active employees', value: stats.active_employees, badge: 'success' },
                  { label: 'Revenue', value: `$${Number(stats.monthly_revenue).toLocaleString()}`, badge: 'success' },
                  { label: 'Paid payroll this month', value: `$${Number(stats.paid_payroll_spent).toLocaleString()}`, badge: 'danger' },
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
