import React, { useState } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area, CartesianGrid,
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { reportsApi } from '../api';
import { useFetch } from '../hooks/useFetch';
import { PageHeader, Card, MetricCard, Spinner, ErrorMsg, Badge, Btn } from '../components/ui';

/* ── Export helpers ─────────────────────────────────── */
const exportPDF = async (filename, title, sections) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  doc.setFillColor(15, 17, 23);
  doc.rect(0, 0, W, 18, 'F');
  doc.setTextColor(34, 211, 160);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('FabriCore Factory Management', 14, 12);
  doc.setTextColor(180, 180, 180);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, W - 14, 12, { align: 'right' });

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 30);
  doc.setDrawColor(34, 211, 160);
  doc.setLineWidth(0.8);
  doc.line(14, 33, W - 14, 33);

  let y = 40;

  sections.forEach(({ title: sTitle, head, rows, metrics }) => {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text(sTitle, 14, y);
    y += 6;

    if (metrics) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      metrics.forEach((m, i) => {
        const x = 14 + i * 55;
        doc.setFillColor(240, 250, 246);
        doc.roundedRect(x, y, 50, 12, 2, 2, 'F');
        doc.setTextColor(100, 100, 100);
        doc.text(m.label, x + 3, y + 4.5);
        doc.setTextColor(15, 110, 86);
        doc.setFont('helvetica', 'bold');
        doc.text(String(m.value), x + 3, y + 9.5);
        doc.setFont('helvetica', 'normal');
      });
      y += 18;
    }

    if (head && rows?.length) {
      autoTable(doc, {
        startY: y,
        head: [head],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [15, 17, 23], textColor: [34, 211, 160], fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8, textColor: [40, 40, 40] },
        alternateRowStyles: { fillColor: [248, 252, 250] },
        margin: { left: 14, right: 14 },
        styles: { cellPadding: 2.5 },
      });
      y = doc.lastAutoTable.finalY + 10;
    } else if (!metrics) {
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('No data available for this period.', 14, y + 4);
      y += 12;
    }
  });

  doc.save(filename);
};

const exportExcel = async (filename, sheets) => {
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ sheetName, headers, rows }) => {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 4, 14) }));
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });
  XLSX.writeFile(wb, filename);
};

/* ── Colour palette ─────────────────────────────────── */
const COLORS = ['#22d3a0','#60a5fa','#f5a623','#f05252','#a78bfa','#fb923c'];
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const fill12 = (rows) => {
  const map = {};
  rows.forEach(r => { map[r.month] = r; });
  return MONTH_LABELS.map((name, i) => ({ name, ...(map[i + 1] || {}) }));
};

const TT = ({ active, payload, label, prefix = '', suffix = '' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 14px', fontSize:12 }}>
      <div style={{ color:'var(--text-secondary)', marginBottom:6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || 'var(--text-primary)', marginBottom:2 }}>
          {p.name}: {prefix}{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}{suffix}
        </div>
      ))}
    </div>
  );
};

const SectionTitle = ({ children }) => (
  <div style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:14 }}>
    {children}
  </div>
);

/* ── TAB: Sales ─────────────────────────────────────── */
const SalesTab = ({ year }) => {
  const { data, loading, error, refetch } = useFetch(() => reportsApi.sales(year), [year]);
  const [exporting, setExporting] = useState('');
  const [netMode, setNetMode] = useState('cash');
  const [addingExpense, setAddingExpense] = useState(false);
  const [expenseError, setExpenseError] = useState('');
  const [expenseForm, setExpenseForm] = useState(() => {
    const now = new Date();
    const expenseDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return { expense_date: expenseDate, amount: '', category: '', notes: '' };
  });

  const handlePDF = async () => {
    setExporting('pdf');
    try {
      const monthly = fill12(data?.monthly || []);
      const totalRevenue = (data?.monthly||[]).reduce((a,r) => a+(r.revenue||0),0);
      const totalSpent = (data?.monthly||[]).reduce((a,r) => a+(r.total_spent||0),0);
      const totalNet = (data?.monthly||[]).reduce((a,r) => a+(netMode === 'cash' ? (r.net_value||0) : (r.accrual_net_value||0)),0);
      await exportPDF(`sales-report-${year}.pdf`, `Sales Report — ${year}`, [
        {
          title: 'Summary',
          metrics: [
            { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}` },
            { label: 'Total Orders', value: (data?.monthly||[]).reduce((a,r) => a+(r.orders||0),0) },
            { label: 'Collected', value: `$${(data?.monthly||[]).reduce((a,r) => a+(r.collected||0),0).toLocaleString()}` },
            { label: 'Total Spent', value: `$${totalSpent.toLocaleString()}` },
            { label: netMode === 'cash' ? 'Net Value (Cash)' : 'Net Value (Accrual)', value: `$${totalNet.toLocaleString()}` },
          ],
        },
        {
          title: 'Monthly Breakdown',
          head: ['Month', 'Orders', 'Revenue ($)', 'Collected ($)', 'Spent ($)', netMode === 'cash' ? 'Cash Net ($)' : 'Accrual Net ($)'],
          rows: monthly.map(r => [
            r.name,
            r.orders||0,
            (r.revenue||0).toLocaleString(),
            (r.collected||0).toLocaleString(),
            (r.total_spent||0).toLocaleString(),
            (netMode === 'cash' ? (r.net_value||0) : (r.accrual_net_value||0)).toLocaleString(),
          ]),
        },
        {
          title: 'Top Customers',
          head: ['Customer', 'Orders', 'Revenue ($)', 'Collected ($)'],
          rows: (data?.top_customers||[]).map(c => [c.name, c.orders, Number(c.revenue||0).toLocaleString(), Number(c.collected||0).toLocaleString()]),
        },
        {
          title: 'Payment Status',
          head: ['Status', 'Count', 'Amount ($)'],
          rows: (data?.payment_breakdown||[]).map(p => [p.status, p.count, p.amount.toLocaleString()]),
        },
        {
          title: 'Spend Breakdown',
          head: ['Type', 'Amount ($)'],
          rows: [
            ['Payroll spent', Number(data?.summary?.payroll_spent || 0).toLocaleString()],
            ['Materials spent', Number(data?.summary?.materials_spent || 0).toLocaleString()],
            ['Total spent', Number(data?.summary?.total_spent || 0).toLocaleString()],
            ['Cash net value', Number(data?.summary?.net_value || 0).toLocaleString()],
            ['Accrual net value', Number(data?.summary?.accrual_net_value || 0).toLocaleString()],
          ],
        },
      ]);
    } finally { setExporting(''); }
  };

  const handleExcel = async () => {
    setExporting('excel');
    try {
      const monthly = fill12(data?.monthly || []);
      await exportExcel(`sales-report-${year}.xlsx`, [
        {
          sheetName: 'Monthly Revenue',
          headers: ['Month', 'Orders', 'Revenue ($)', 'Collected ($)', 'Spent ($)', 'Cash Net ($)', 'Accrual Net ($)', 'Payroll Spent ($)', 'Materials Spent ($)', 'Extra Spent ($)'],
          rows: monthly.map(r => [r.name, r.orders||0, r.revenue||0, r.collected||0, r.total_spent||0, r.net_value||0, r.accrual_net_value||0, r.payroll_spent||0, r.materials_spent||0, r.extra_spent||0]),
        },
        {
          sheetName: 'Top Customers',
          headers: ['Customer', 'Orders', 'Revenue ($)', 'Collected ($)'],
          rows: (data?.top_customers||[]).map(c => [c.name, c.orders, c.revenue||0, c.collected||0]),
        },
        {
          sheetName: 'Payment Status',
          headers: ['Status', 'Count', 'Amount ($)'],
          rows: (data?.payment_breakdown||[]).map(p => [p.status, p.count, p.amount]),
        },
        {
          sheetName: 'Spend Summary',
          headers: ['Type', 'Amount ($)'],
          rows: [
            ['Payroll spent', data?.summary?.payroll_spent || 0],
            ['Materials spent', data?.summary?.materials_spent || 0],
            ['Extra spent', data?.summary?.extra_spent || 0],
            ['Total spent', data?.summary?.total_spent || 0],
            ['Cash net value', data?.summary?.net_value || 0],
            ['Accrual net value', data?.summary?.accrual_net_value || 0],
          ],
        },
        {
          sheetName: 'Order Statuses',
          headers: ['Status', 'Count'],
          rows: (data?.order_statuses||[]).map(o => [o.status, o.count]),
        },
      ]);
    } finally { setExporting(''); }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  if (!data) return null;

  const addExpense = async () => {
    setAddingExpense(true);
    setExpenseError('');
    try {
      await reportsApi.addSalesExpense({
        expense_date: expenseForm.expense_date,
        amount: Number(expenseForm.amount),
        category: expenseForm.category,
        notes: expenseForm.notes,
      });
      setExpenseForm({ ...expenseForm, amount: '', category: '', notes: '' });
      await refetch();
    } catch (e) {
      setExpenseError(e.message);
    } finally {
      setAddingExpense(false);
    }
  };

  const monthly = fill12(data.monthly || []);
  const totalRevenue   = (data.monthly||[]).reduce((a,r) => a+(r.revenue||0),0);
  const totalOrders    = (data.monthly||[]).reduce((a,r) => a+(r.orders||0),0);
  const totalCollected = (data.monthly||[]).reduce((a,r) => a+(r.collected||0),0);
  const totalSpent     = (data.monthly||[]).reduce((a,r) => a+(r.total_spent||0),0);
  const netValue       = (data.monthly||[]).reduce((a,r) => a+(netMode === 'cash' ? (r.net_value||0) : (r.accrual_net_value||0)),0);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:8 }}>
          <Btn size="sm" variant={netMode === 'cash' ? 'primary' : 'ghost'} onClick={() => setNetMode('cash')}>Cash net</Btn>
          <Btn size="sm" variant={netMode === 'accrual' ? 'primary' : 'ghost'} onClick={() => setNetMode('accrual')}>Accrual net</Btn>
        </div>
        <div style={{ display:'flex', gap:8 }}>
        <Btn size="sm" onClick={handleExcel} disabled={!!exporting}>{exporting==='excel'?'Exporting…':'↓ Excel'}</Btn>
        <Btn size="sm" variant="primary" onClick={handlePDF} disabled={!!exporting}>{exporting==='pdf'?'Generating PDF…':'↓ PDF'}</Btn>
        </div>
      </div>

      <Card>
        <SectionTitle>Add extra spent money</SectionTitle>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 2fr auto', gap:10, alignItems:'end' }}>
          <input type="date" value={expenseForm.expense_date} onChange={e => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
            style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text-primary)', padding:'8px 10px', fontSize:13 }} />
          <input type="number" min="0.01" placeholder="Amount" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
            style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text-primary)', padding:'8px 10px', fontSize:13 }} />
          <input type="text" placeholder="Category" value={expenseForm.category} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}
            style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text-primary)', padding:'8px 10px', fontSize:13 }} />
          <input type="text" placeholder="Notes" value={expenseForm.notes} onChange={e => setExpenseForm({ ...expenseForm, notes: e.target.value })}
            style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text-primary)', padding:'8px 10px', fontSize:13 }} />
          <Btn size="sm" variant="primary" onClick={addExpense} disabled={addingExpense || !expenseForm.amount}>{addingExpense ? 'Saving…' : 'Add expense'}</Btn>
        </div>
        {expenseError && <div style={{ marginTop: 10 }}><ErrorMsg msg={expenseError} /></div>}
      </Card>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,minmax(0,1fr))', gap:14 }}>
        <MetricCard label="Total revenue"    value={`$${totalRevenue.toLocaleString()}`}   color="var(--accent)" sub={`${year}`} />
        <MetricCard label="Total orders"     value={totalOrders}                            sub={`${year}`} />
        <MetricCard label="Amount collected" value={`$${totalCollected.toLocaleString()}`} sub={`${year}`} />
        <MetricCard label="Total spent"      value={`$${totalSpent.toLocaleString()}`}     color="var(--danger)" sub={`${year}`} />
        <MetricCard label={netMode === 'cash' ? 'Net value (cash)' : 'Net value (accrual)'} value={`$${netValue.toLocaleString()}`} color={netValue >= 0 ? 'var(--accent)' : 'var(--danger)'} sub={`${year}`} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16 }}>
        <Card>
          <SectionTitle>Monthly sales cashflow — {year}</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthly}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#22d3a0" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#22d3a0" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#60a5fa" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fill:'var(--text-muted)', fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:'var(--text-muted)', fontSize:11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<TT prefix="$" />} />
              <Legend iconSize={8} wrapperStyle={{ fontSize:11, color:'var(--text-secondary)' }} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#22d3a0" strokeWidth={2} fill="url(#revGrad)" />
              <Area type="monotone" dataKey="total_spent" name="Spent" stroke="#f05252" strokeWidth={2} fillOpacity={0} />
              <Area type="monotone" dataKey={netMode === 'cash' ? 'net_value' : 'accrual_net_value'} name={netMode === 'cash' ? 'Cash net' : 'Accrual net'} stroke="#60a5fa" strokeWidth={2} fill="url(#netGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <SectionTitle>Spend summary</SectionTitle>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
              <span style={{ color:'var(--text-secondary)' }}>Payroll spent</span>
              <span style={{ color:'var(--danger)', fontWeight:600 }}>${Number(data?.summary?.payroll_spent || 0).toLocaleString()}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
              <span style={{ color:'var(--text-secondary)' }}>Materials spent</span>
              <span style={{ color:'var(--warn)', fontWeight:600 }}>${Number(data?.summary?.materials_spent || 0).toLocaleString()}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
              <span style={{ color:'var(--text-secondary)' }}>Extra spent</span>
              <span style={{ color:'#f59e0b', fontWeight:600 }}>${Number(data?.summary?.extra_spent || 0).toLocaleString()}</span>
            </div>
            <div style={{ height:1, background:'var(--border)' }} />
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
              <span style={{ color:'var(--text-secondary)' }}>Total spent</span>
              <span style={{ color:'var(--danger)', fontWeight:700 }}>${Number(data?.summary?.total_spent || 0).toLocaleString()}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
              <span style={{ color:'var(--text-secondary)' }}>Cash net value</span>
              <span style={{ color:Number(data?.summary?.net_value || 0) >= 0 ? 'var(--accent)' : 'var(--danger)', fontWeight:700 }}>${Number(data?.summary?.net_value || 0).toLocaleString()}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
              <span style={{ color:'var(--text-secondary)' }}>Accrual net value</span>
              <span style={{ color:Number(data?.summary?.accrual_net_value || 0) >= 0 ? 'var(--accent)' : 'var(--danger)', fontWeight:700 }}>${Number(data?.summary?.accrual_net_value || 0).toLocaleString()}</span>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <Card>
          <SectionTitle>Top customers by collections</SectionTitle>
          {(data.top_customers||[]).map((c,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
              <div style={{ width:24, height:24, borderRadius:'50%', background:COLORS[i%COLORS.length]+'22',
                color:COLORS[i%COLORS.length], display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:600, flexShrink:0 }}>
                {i+1}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:500 }}>{c.name}</div>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>{c.orders} orders · ${Number(c.revenue||0).toLocaleString()} revenue</div>
              </div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--accent)' }}>${Number(c.collected||0).toLocaleString()}</div>
            </div>
          ))}
          {!data.top_customers?.length && <div style={{ color:'var(--text-muted)', fontSize:13 }}>No data yet</div>}
        </Card>
        <Card>
          <SectionTitle>Orders per month</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthly} barCategoryGap="35%">
              <XAxis dataKey="name" tick={{ fill:'var(--text-muted)', fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:'var(--text-muted)', fontSize:11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<TT />} cursor={{ fill:'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="orders" name="Orders" fill="#60a5fa" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
};

/* ── TAB: Production ────────────────────────────────── */
const ProductionTab = ({ year }) => {
  const { data, loading, error } = useFetch(() => reportsApi.production(year), [year]);
  const [exporting, setExporting] = useState('');

  const handlePDF = async () => {
    setExporting('pdf');
    try {
      const c = data?.completion || {};
      const rate = c.total > 0 ? Math.round((c.done/c.total)*100) : 0;
      await exportPDF(`production-report-${year}.pdf`, `Production Report — ${year}`, [
        {
          title: 'Summary',
          metrics: [
            { label: 'Total Orders', value: c.total||0 },
            { label: 'Completed', value: c.done||0 },
            { label: 'Completion Rate', value: `${rate}%` },
          ],
        },
        {
          title: 'Monthly Output',
          head: ['Month','Orders','Completed','Units Ordered','Units Produced'],
          rows: fill12(data?.monthly||[]).map(r => [r.name, r.total||0, r.completed||0, r.units_ordered||0, r.units_produced||0]),
        },
        {
          title: 'Top Employees by Output',
          head: ['Employee','Orders','Units Produced'],
          rows: (data?.by_employee||[]).map(e => [e.name, e.orders, e.units_produced]),
        },
        {
          title: 'Status Breakdown',
          head: ['Status','Count'],
          rows: (data?.status_breakdown||[]).map(s => [s.status, s.count]),
        },
        {
          title: 'Product Progress',
          head: ['Product','Orders','Ordered','Produced','Remaining','Completion %','Late Orders','Late Units'],
          rows: (data?.product_progress||[]).map(p => [
            p.product_name,
            p.orders,
            p.units_ordered,
            p.units_produced,
            p.units_remaining,
            Number(p.completion_rate || 0).toFixed(1),
            p.late_orders,
            p.late_units,
          ]),
        },
        {
          title: 'Late Products',
          head: ['Product','Late Orders','Late Units','Oldest Due Date'],
          rows: (data?.late_products||[]).map(p => [p.product_name, p.late_orders, p.late_units, p.oldest_due_date || '—']),
        },
      ]);
    } finally { setExporting(''); }
  };

  const handleExcel = async () => {
    setExporting('excel');
    try {
      await exportExcel(`production-report-${year}.xlsx`, [
        {
          sheetName: 'Monthly Output',
          headers: ['Month','Orders','Completed','Units Ordered','Units Produced'],
          rows: fill12(data?.monthly||[]).map(r => [r.name, r.total||0, r.completed||0, r.units_ordered||0, r.units_produced||0]),
        },
        {
          sheetName: 'By Employee',
          headers: ['Employee','Orders','Units Produced'],
          rows: (data?.by_employee||[]).map(e => [e.name, e.orders, e.units_produced]),
        },
        {
          sheetName: 'Status Breakdown',
          headers: ['Status','Count'],
          rows: (data?.status_breakdown||[]).map(s => [s.status, s.count]),
        },
        {
          sheetName: 'Product Progress',
          headers: ['Product','Orders','Ordered Units','Produced Units','Remaining Units','Completion %','Late Orders','Late Units','Earliest Late Due Date'],
          rows: (data?.product_progress||[]).map(p => [
            p.product_name,
            p.orders,
            p.units_ordered,
            p.units_produced,
            p.units_remaining,
            p.completion_rate,
            p.late_orders,
            p.late_units,
            p.earliest_late_due_date || '',
          ]),
        },
        {
          sheetName: 'Late Products',
          headers: ['Product','Late Orders','Late Units','Oldest Due Date'],
          rows: (data?.late_products||[]).map(p => [p.product_name, p.late_orders, p.late_units, p.oldest_due_date || '']),
        },
      ]);
    } finally { setExporting(''); }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  if (!data) return null;

  const monthly = fill12(data.monthly||[]);
  const completion = data.completion||{};
  const productProgress = data.product_progress || [];
  const lateProducts = data.late_products || [];
  const lateUnitsTotal = lateProducts.reduce((sum, p) => sum + Number(p.late_units || 0), 0);
  const completionRate = completion.total > 0 ? Math.round((completion.done/completion.total)*100) : 0;
  const unitRate = completion.total_units > 0 ? Math.round((completion.produced_units/completion.total_units)*100) : 0;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
        <Btn size="sm" onClick={handleExcel} disabled={!!exporting}>{exporting==='excel'?'Exporting…':'↓ Excel'}</Btn>
        <Btn size="sm" variant="primary" onClick={handlePDF} disabled={!!exporting}>{exporting==='pdf'?'Generating PDF…':'↓ PDF'}</Btn>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,minmax(0,1fr))', gap:14 }}>
        <MetricCard label="Total orders"    value={completion.total||0} />
        <MetricCard label="Completed"       value={completion.done||0}  color="var(--accent)" />
        <MetricCard label="Completion rate" value={`${completionRate}%`} color={completionRate>70?'var(--accent)':'var(--warn)'} />
        <MetricCard label="Unit fill rate"  value={`${unitRate}%`}       color={unitRate>70?'var(--accent)':'var(--warn)'} />
        <MetricCard label="Late units"      value={lateUnitsTotal}        color={lateUnitsTotal > 0 ? 'var(--danger)' : 'var(--accent)'} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16 }}>
        <Card>
          <SectionTitle>Units ordered vs produced — {year}</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly} barCategoryGap="25%">
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fill:'var(--text-muted)', fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:'var(--text-muted)', fontSize:11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<TT />} cursor={{ fill:'rgba(255,255,255,0.04)' }} />
              <Legend iconSize={8} wrapperStyle={{ fontSize:11, color:'var(--text-secondary)' }} />
              <Bar dataKey="units_ordered"  name="Ordered"  fill="#60a5fa" radius={[4,4,0,0]} />
              <Bar dataKey="units_produced" name="Produced" fill="#22d3a0" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <SectionTitle>Status breakdown</SectionTitle>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={data.status_breakdown||[]} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={70} paddingAngle={3}>
                {(data.status_breakdown||[]).map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', fontSize:12 }} />
              <Legend iconSize={8} wrapperStyle={{ fontSize:11, color:'var(--text-secondary)' }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card>
        <SectionTitle>Top employees by production output</SectionTitle>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {(data.by_employee||[]).map((e,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:26, height:26, borderRadius:'50%', background:'var(--accent-dim)', color:'var(--accent)',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:600, flexShrink:0 }}>
                {e.name?.[0]?.toUpperCase()}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:13, fontWeight:500 }}>{e.name}</span>
                  <span style={{ fontSize:12, color:'var(--text-muted)' }}>{e.units_produced} units · {e.orders} orders</span>
                </div>
                <div style={{ height:5, background:'var(--bg-hover)', borderRadius:99 }}>
                  <div style={{ width:`${Math.min((e.units_produced/Math.max(...(data.by_employee||[]).map(x=>x.units_produced),1))*100,100)}%`,
                    height:'100%', background:'var(--accent)', borderRadius:99 }} />
                </div>
              </div>
            </div>
          ))}
          {!data.by_employee?.length && <div style={{ color:'var(--text-muted)', fontSize:13 }}>No data yet</div>}
        </div>
      </Card>

      <Card>
        <SectionTitle>Product completion report</SectionTitle>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr>
                {['Product','Orders','Ordered','Produced','Remaining','Completion','Late','Late Units'].map((h) => (
                  <th key={h} style={{ textAlign:'left', padding:'8px 10px', fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.06em', borderBottom:'1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {productProgress.length === 0 ? (
                <tr><td colSpan={8} style={{ padding:'18px 10px', color:'var(--text-muted)', textAlign:'center' }}>No product data yet.</td></tr>
              ) : productProgress.map((p, i) => {
                const completionPct = Number(p.completion_rate || 0);
                return (
                  <tr key={`${p.product_name}-${i}`} style={{ borderBottom:'1px solid var(--border)' }}>
                    <td style={{ padding:'10px' }}>{p.product_name}</td>
                    <td style={{ padding:'10px' }}>{p.orders}</td>
                    <td style={{ padding:'10px' }}>{p.units_ordered}</td>
                    <td style={{ padding:'10px' }}>{p.units_produced}</td>
                    <td style={{ padding:'10px', color:Number(p.units_remaining) > 0 ? 'var(--warn)' : 'var(--accent)' }}>{p.units_remaining}</td>
                    <td style={{ padding:'10px' }}>
                      <Badge variant={completionPct >= 100 ? 'success' : completionPct >= 60 ? 'info' : 'warning'}>{completionPct.toFixed(1)}%</Badge>
                    </td>
                    <td style={{ padding:'10px' }}>
                      <Badge variant={Number(p.late_orders || 0) > 0 ? 'danger' : 'success'}>{Number(p.late_orders || 0) > 0 ? 'Late' : 'On time'}</Badge>
                    </td>
                    <td style={{ padding:'10px' }}>{p.late_units}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <SectionTitle>Late products</SectionTitle>
        {(lateProducts||[]).length === 0 ? (
          <div style={{ color:'var(--accent)', fontSize:13 }}>No late products right now.</div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:12 }}>
            {(lateProducts||[]).map((p, i) => (
              <div key={`${p.product_name}-${i}`} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px' }}>
                <div style={{ fontSize:13, fontWeight:600, marginBottom:6 }}>{p.product_name}</div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text-secondary)' }}>
                  <span>Late orders</span><span>{p.late_orders}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text-secondary)' }}>
                  <span>Late units</span><span style={{ color:'var(--danger)', fontWeight:600 }}>{p.late_units}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text-secondary)' }}>
                  <span>Oldest due</span><span>{p.oldest_due_date || '—'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

/* ── TAB: HR ────────────────────────────────────────── */
const HRTab = ({ year, month }) => {
  const { data, loading, error } = useFetch(() => reportsApi.hr(year, month), [year, month]);
  const [exporting, setExporting] = useState('');

  const handlePDF = async () => {
    setExporting('pdf');
    try {
      const pr = data?.payroll_summary || {};
      const payrollHistory = fill12(data?.payroll_history || []).map((row) => ({
        name: row.name,
        paid_payout: row.paid_payout || 0,
        pending_payout: row.pending_payout || 0,
        total_payout: row.total_payout || 0,
      }));
      await exportPDF(`hr-report-${MONTH_LABELS[month-1]}-${year}.pdf`, `HR & Payroll Report — ${MONTH_LABELS[month-1]} ${year}`, [
        {
          title: 'Payroll Summary',
          metrics: [
            { label: 'Total Payout', value: `$${Number(pr.total_payout||0).toLocaleString()}` },
            { label: 'Paid Payroll', value: `$${Number(pr.paid_payout||0).toLocaleString()}` },
            { label: 'Bonuses', value: `$${Number(pr.total_bonuses||0).toLocaleString()}` },
            { label: 'Deductions', value: `$${Number(pr.total_deductions||0).toLocaleString()}` },
          ],
        },
        {
          title: 'Payroll Spend History',
          head: ['Month','Paid Payroll ($)','Pending Payroll ($)','Total Payroll ($)'],
          rows: payrollHistory.map(r => [r.name, Number(r.paid_payout).toLocaleString(), Number(r.pending_payout).toLocaleString(), Number(r.total_payout).toLocaleString()]),
        },
        {
          title: 'Attendance by Department',
          head: ['Department','Records','Present','Absent','Hours'],
          rows: (data?.by_department||[]).map(d => [d.department, d.records, d.present, d.absent, d.hours?.toFixed(1)]),
        },
        {
          title: 'Attendance Status Breakdown',
          head: ['Status','Count'],
          rows: (data?.attendance_summary||[]).map(a => [a.status, a.count]),
        },
        {
          title: 'Top Employees by Hours',
          head: ['Employee','Total Hours','Days Logged'],
          rows: (data?.top_hours||[]).map(e => [e.name, e.total_hours, e.days_logged]),
        },
      ]);
    } finally { setExporting(''); }
  };

  const handleExcel = async () => {
    setExporting('excel');
    try {
      await exportExcel(`hr-report-${MONTH_LABELS[month-1]}-${year}.xlsx`, [
        {
          sheetName: 'Payroll History',
          headers: ['Month','Paid Payroll ($)','Pending Payroll ($)','Total Payroll ($)','Paid Records','Total Records'],
          rows: fill12(data?.payroll_history||[]).map(r => [r.name, r.paid_payout||0, r.pending_payout||0, r.total_payout||0, r.paid_records||0, r.total_records||0]),
        },
        {
          sheetName: 'Attendance by Dept',
          headers: ['Department','Records','Present','Absent','Hours'],
          rows: (data?.by_department||[]).map(d => [d.department, d.records, d.present, d.absent, d.hours]),
        },
        {
          sheetName: 'Attendance Status',
          headers: ['Status','Count'],
          rows: (data?.attendance_summary||[]).map(a => [a.status, a.count]),
        },
        {
          sheetName: 'Top Hours',
          headers: ['Employee','Total Hours','Days Logged'],
          rows: (data?.top_hours||[]).map(e => [e.name, e.total_hours, e.days_logged]),
        },
      ]);
    } finally { setExporting(''); }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  if (!data) return null;

  const pr = data.payroll_summary || {};
  const payrollHistory = fill12(data.payroll_history || []).map((row) => ({
    name: row.name,
    paid_payout: row.paid_payout || 0,
    pending_payout: row.pending_payout || 0,
    total_payout: row.total_payout || 0,
  }));

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
        <Btn size="sm" onClick={handleExcel} disabled={!!exporting}>{exporting==='excel'?'Exporting…':'↓ Excel'}</Btn>
        <Btn size="sm" variant="primary" onClick={handlePDF} disabled={!!exporting}>{exporting==='pdf'?'Generating PDF…':'↓ PDF'}</Btn>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(0,1fr))', gap:14 }}>
        <MetricCard label="Payroll payout" value={`$${Number(pr.total_payout||0).toLocaleString()}`} color="var(--accent)" />
        <MetricCard label="Paid payroll"   value={`$${Number(pr.paid_payout||0).toLocaleString()}`} color="var(--danger)" />
        <MetricCard label="Pending payroll" value={`$${Number(pr.pending_payout||0).toLocaleString()}`} />
        <MetricCard label="Paid employees" value={`${pr.paid_count||0} / ${pr.total_records||0}`} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <Card>
          <SectionTitle>Payroll spend history — {year}</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={payrollHistory} barCategoryGap="25%">
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fill:'var(--text-muted)', fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:'var(--text-muted)', fontSize:11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<TT prefix="$" />} cursor={{ fill:'rgba(255,255,255,0.04)' }} />
              <Legend iconSize={8} wrapperStyle={{ fontSize:11, color:'var(--text-secondary)' }} />
              <Bar dataKey="paid_payout" name="Paid payroll" fill="#f05252" radius={[4,4,0,0]} />
              <Bar dataKey="pending_payout" name="Pending payroll" fill="#60a5fa" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <SectionTitle>Attendance breakdown — {MONTH_LABELS[month-1]} {year}</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={data.attendance_summary||[]} dataKey="count" nameKey="status"
                cx="50%" cy="50%" outerRadius={75} paddingAngle={3}
                label={({ status, percent }) => `${status} ${Math.round(percent*100)}%`}>
                {(data.attendance_summary||[]).map((entry,i) => (
                  <Cell key={i} fill={
                    entry.status==='present'?'#22d3a0':
                    entry.status==='absent'?'#f05252':
                    entry.status==='late'?'#f5a623':'#60a5fa'
                  } />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', fontSize:12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <SectionTitle>Attendance by department</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.by_department||[]} layout="vertical" barCategoryGap="25%">
              <XAxis type="number" tick={{ fill:'var(--text-muted)', fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="department" tick={{ fill:'var(--text-muted)', fontSize:11 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip content={<TT />} cursor={{ fill:'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="present" name="Present" fill="#22d3a0" radius={[0,4,4,0]} />
              <Bar dataKey="absent"  name="Absent"  fill="#f05252" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card>
        <SectionTitle>Top employees by hours — {MONTH_LABELS[month-1]}</SectionTitle>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {(data.top_hours||[]).map((e,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:26, height:26, borderRadius:'50%', background:'var(--info-dim)', color:'var(--info)',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:600, flexShrink:0 }}>
                {e.name?.[0]?.toUpperCase()}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:13, fontWeight:500 }}>{e.name}</span>
                  <span style={{ fontSize:12, color:'var(--text-muted)' }}>{e.total_hours}h · {e.days_logged} days</span>
                </div>
                <div style={{ height:5, background:'var(--bg-hover)', borderRadius:99 }}>
                  <div style={{ width:`${Math.min((e.total_hours/Math.max(...(data.top_hours||[]).map(x=>x.total_hours),1))*100,100)}%`,
                    height:'100%', background:'var(--info)', borderRadius:99 }} />
                </div>
              </div>
            </div>
          ))}
          {!data.top_hours?.length && <div style={{ color:'var(--text-muted)', fontSize:13 }}>No data yet</div>}
        </div>
      </Card>
    </div>
  );
};

/* ── TAB: Inventory ─────────────────────────────────── */
const InventoryTab = () => {
  const { data, loading, error } = useFetch(reportsApi.inventory);
  const [exporting, setExporting] = useState('');

  const handlePDF = async () => {
    setExporting('pdf');
    try {
      const totalValue = (data?.by_category||[]).reduce((a,r) => a+(r.total_value||0),0);
      await exportPDF('inventory-report.pdf', 'Inventory Report', [
        {
          title: 'Summary',
          metrics: [
            { label: 'Total Stock Value', value: `$${totalValue.toLocaleString()}` },
            { label: 'Categories', value: (data?.by_category||[]).length },
            { label: 'Low Stock Items', value: (data?.low_stock||[]).length },
          ],
        },
        {
          title: 'Stock by Category',
          head: ['Category','Items','Total Qty','Value ($)'],
          rows: (data?.by_category||[]).map(c => [c.category, c.items, c.total_qty, Number(c.total_value).toLocaleString()]),
        },
        {
          title: 'Low Stock Items',
          head: ['Material','Category','Qty','Min Qty','Level %'],
          rows: (data?.low_stock||[]).map(i => [i.name, i.category||'—', i.quantity, i.min_quantity, `${Math.round(i.pct||0)}%`]),
        },
        {
          title: 'Most Used in Production',
          head: ['Material','Unit','Total Used','Orders'],
          rows: (data?.usage_by_production||[]).map(m => [m.name, m.unit, m.total_used, m.orders]),
        },
      ]);
    } finally { setExporting(''); }
  };

  const handleExcel = async () => {
    setExporting('excel');
    try {
      await exportExcel('inventory-report.xlsx', [
        {
          sheetName: 'By Category',
          headers: ['Category','Items','Total Qty','Total Value ($)'],
          rows: (data?.by_category||[]).map(c => [c.category, c.items, c.total_qty, c.total_value]),
        },
        {
          sheetName: 'Low Stock',
          headers: ['Material','Category','Current Qty','Min Qty','Level %'],
          rows: (data?.low_stock||[]).map(i => [i.name, i.category||'', i.quantity, i.min_quantity, Math.round(i.pct||0)]),
        },
        {
          sheetName: 'Top by Value',
          headers: ['Material','Category','Qty','Value ($)'],
          rows: (data?.top_by_value||[]).map(m => [m.name, m.category||'', m.quantity, m.value]),
        },
        {
          sheetName: 'Production Usage',
          headers: ['Material','Unit','Total Used','Orders'],
          rows: (data?.usage_by_production||[]).map(m => [m.name, m.unit, m.total_used, m.orders]),
        },
      ]);
    } finally { setExporting(''); }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  if (!data) return null;

  const totalValue = (data.by_category||[]).reduce((a,r) => a+(r.total_value||0),0);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
        <Btn size="sm" onClick={handleExcel} disabled={!!exporting}>{exporting==='excel'?'Exporting…':'↓ Excel'}</Btn>
        <Btn size="sm" variant="primary" onClick={handlePDF} disabled={!!exporting}>{exporting==='pdf'?'Generating PDF…':'↓ PDF'}</Btn>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:14 }}>
        <MetricCard label="Total stock value" value={`$${totalValue.toLocaleString()}`} color="var(--accent)" />
        <MetricCard label="Categories"        value={(data.by_category||[]).length} />
        <MetricCard label="Low stock items"   value={(data.low_stock||[]).length} color={(data.low_stock||[]).length>0?'var(--danger)':undefined} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <Card>
          <SectionTitle>Stock value by category</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.by_category||[]} barCategoryGap="30%">
              <XAxis dataKey="category" tick={{ fill:'var(--text-muted)', fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:'var(--text-muted)', fontSize:11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<TT prefix="$" />} cursor={{ fill:'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="total_value" name="Value ($)" radius={[4,4,0,0]}>
                {(data.by_category||[]).map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <SectionTitle>Low stock items</SectionTitle>
          {(data.low_stock||[]).length === 0
            ? <div style={{ color:'var(--accent)', fontSize:13 }}>All items are sufficiently stocked.</div>
            : (data.low_stock||[]).map((item,i) => (
              <div key={i} style={{ marginBottom:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:13, fontWeight:500 }}>{item.name}</span>
                  <Badge variant="danger">{item.quantity} left</Badge>
                </div>
                <div style={{ height:5, background:'var(--bg-hover)', borderRadius:99 }}>
                  <div style={{ width:`${Math.min(item.pct||0,100)}%`, height:'100%', background:'var(--danger)', borderRadius:99 }} />
                </div>
              </div>
            ))
          }
        </Card>
      </div>

      <Card>
        <SectionTitle>Most used materials in production</SectionTitle>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:12 }}>
          {(data.usage_by_production||[]).map((m,i) => (
            <div key={i} style={{ background:'var(--bg-elevated)', borderRadius:10, padding:'12px 14px', border:'1px solid var(--border)' }}>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:4 }}>{m.orders} production orders</div>
              <div style={{ fontSize:14, fontWeight:600, marginBottom:2 }}>{m.name}</div>
              <div style={{ fontSize:13, color:COLORS[i%COLORS.length], fontWeight:500 }}>{m.total_used} {m.unit} used</div>
            </div>
          ))}
          {!data.usage_by_production?.length && <div style={{ color:'var(--text-muted)', fontSize:13 }}>No production data yet</div>}
        </div>
      </Card>
    </div>
  );
};

/* ── Main component ─────────────────────────────────── */
const TABS = ['Sales', 'Production', 'HR & Payroll', 'Inventory'];

export default function Reports() {
  const now = new Date();
  const [tab,   setTab]   = useState(0);
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  return (
    <div style={{ padding:'28px 28px 40px' }}>
      <PageHeader
        title="Reports & Analytics"
        subtitle="Business intelligence across all modules"
        action={
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {tab === 2 && (
              <select value={month} onChange={e => setMonth(Number(e.target.value))}
                style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:6,
                  color:'var(--text-primary)', padding:'7px 10px', fontSize:13 }}>
                {MONTH_LABELS.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
            )}
            {tab !== 3 && (
              <input type="number" value={year} onChange={e => setYear(Number(e.target.value))}
                style={{ width:80, background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:6,
                  color:'var(--text-primary)', padding:'7px 10px', fontSize:13 }} />
            )}
          </div>
        }
      />

      <div style={{ display:'flex', gap:4, marginBottom:24, borderBottom:'1px solid var(--border)', paddingBottom:0 }}>
        {TABS.map((t,i) => (
          <button key={i} onClick={() => setTab(i)} style={{
            padding:'9px 18px', fontSize:13, fontWeight:500,
            background:'transparent', color: tab===i ? 'var(--accent)' : 'var(--text-secondary)',
            border:'none', borderBottom: tab===i ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom:-1, cursor:'pointer', transition:'all .15s',
          }}>{t}</button>
        ))}
      </div>

      {tab === 0 && <SalesTab      year={year} />}
      {tab === 1 && <ProductionTab year={year} />}
      {tab === 2 && <HRTab         year={year} month={month} />}
      {tab === 3 && <InventoryTab  />}
    </div>
  );
}
