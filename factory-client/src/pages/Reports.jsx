import React, { useState } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area, CartesianGrid,
} from 'recharts';
import { reportsApi } from '../api';
import { useFetch } from '../hooks/useFetch';
import { PageHeader, Card, MetricCard, Spinner, ErrorMsg, Badge, Btn } from '../components/ui';
import {
  buildSalesReportHtml,
  buildProductionReportHtml,
  buildHrReportHtml,
  buildPrintShopsReportHtml,
} from '../utils/reportTemplateGenerator';

let reportExportModules;
const loadReportExportModules = async () => {
  if (!reportExportModules) {
    const [{ jsPDF }, { default: autoTable }, { default: writeXlsxFile }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
      import('write-excel-file/browser'),
    ]);
    reportExportModules = { jsPDF, autoTable, writeXlsxFile };
  }
  return reportExportModules;
};

/* ── Export helpers ─────────────────────────────────── */
const exportPDF = async (filename, title, sections, action = 'print', htmlContent = null) => {
  // If rich self-explanatory HTML content is provided, prioritize native high-definition browser rendering
  // This gives the user full Arabic Cairo/Segoe UI fonts, color badges, KPI cards, and "Save as PDF" option
  if (htmlContent) {
    const { printHtmlDocument } = await import('../utils/printDocument');
    const ok = printHtmlDocument(htmlContent, { title: filename.replace(/\.pdf$/i, '') || title });
    if (ok) return;
  }

  const [{ jsPDF, autoTable }, { downloadPdfBlob, printPdfBlob }] = await Promise.all([
    loadReportExportModules(),
    import('../utils/printDocument'),
  ]);
  // Landscape A4 orientation: 297mm width x 210mm height gives ample room for 8+ columns without text-wrapping
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(); // 297mm
  const H = doc.internal.pageSize.getHeight(); // 210mm

  // Dark Corporate Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, 18, 'F');
  doc.setTextColor(37, 99, 235);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('BLACK FOX FACTORY MANAGEMENT', 14, 10);
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Executive Operational & Financial Audit Report', 14, 14.5);
  doc.setTextColor(203, 213, 225);
  doc.setFontSize(8);
  doc.text(`Generated: ${new Date().toLocaleString()}`, W - 14, 11, { align: 'right' });

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 28);
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.8);
  doc.line(14, 31, W - 14, 31);

  let y = 37;

  sections.forEach(({ title: sTitle, description, head, rows, foot, metrics }) => {
    if (y > 165) { doc.addPage(); y = 18; }
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(sTitle, 14, y);
    y += 4.5;

    if (description) {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(description, 14, y);
      y += 5.5;
    }

    if (metrics) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const boxW = Math.min(50, (W - 28 - (metrics.length - 1) * 4) / metrics.length);
      metrics.forEach((m, i) => {
        const x = 14 + i * (boxW + 4);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, boxW, 13, 1.5, 1.5, 'FD');
        doc.setFillColor(37, 99, 235);
        doc.rect(x, y, boxW, 1.2, 'F');
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(7);
        doc.text(m.label, x + 3, y + 4.5);
        doc.setTextColor(30, 64, 175);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(String(m.value), x + 3, y + 9);
        if (m.desc) {
          doc.setTextColor(148, 163, 184);
          doc.setFontSize(6);
          doc.setFont('helvetica', 'normal');
          doc.text(m.desc, x + 3, y + 11.8);
        }
      });
      y += 17;
    }

    if (head && rows?.length) {
      autoTable(doc, {
        startY: y,
        head: [head],
        body: rows,
        foot: foot ? [foot] : undefined,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 2, overflow: 'ellipsize' },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5, halign: 'center' },
        bodyStyles: { fontSize: 7, textColor: [30, 41, 59], cellPadding: 2 },
        footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.5 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 },
      });
      y = doc.lastAutoTable.finalY + 8;
    } else if (!metrics) {
      doc.setFontSize(7.5);
      doc.setTextColor(150, 150, 150);
      doc.text('No data available for this section in the specified period.', 14, y + 4);
      y += 8;
    }
  });

  // Approvals & Signatures Block on last page
  if (y > 160) { doc.addPage(); y = 20; }
  doc.setDrawColor(203, 213, 225);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(14, y + 2, W - 14, y + 2);
  doc.setLineDashPattern([], 0);
  y += 7;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const signW = (W - 28 - 16) / 3;
  ['Prepared & Audited By', 'Finance & Cost Control', 'Executive Approval (Black Fox)'].forEach((title, idx) => {
    const sx = 14 + idx * (signW + 8);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(sx, y, signW, 16, 1.5, 1.5, 'FD');
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(7);
    doc.text(title, sx + signW / 2, y + 4, { align: 'center' });
    doc.setDrawColor(148, 163, 184);
    doc.line(sx + 5, y + 11.5, sx + signW - 5, y + 11.5);
    doc.setFontSize(6);
    doc.text('Signature & Date', sx + signW / 2, y + 14.5, { align: 'center' });
  });

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.text(`Black Fox Clothing Factory — Executive Report — Page ${i} of ${pageCount}`, W / 2, 202, { align: 'center' });
  }

  if (action === 'download') {
    downloadPdfBlob(doc, filename);
  } else {
    printPdfBlob(doc, title);
  }
};

const exportExcel = async (filename, sheets) => {
  const { writeXlsxFile } = await loadReportExportModules();
  const data = sheets.map(({ headers, rows }) => [headers, ...rows]);
  const sheetNames = sheets.map(({ sheetName }, index) => {
    const fallback = `Sheet ${index + 1}`;
    return (sheetName || fallback).slice(0, 31);
  });

  await writeXlsxFile(data, {
    sheets: sheetNames,
    fileName: filename,
  });
};

/* ── Colour palette ─────────────────────────────────── */
const COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#0284c7', '#dc2626'];
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const normalizeMonthlyRows = (rows = []) => rows.map((row) => {
  const fallbackName = row.month && MONTH_LABELS[Number(row.month) - 1]
    ? MONTH_LABELS[Number(row.month) - 1]
    : (row.month_start || '');
  return {
    ...row,
    name: row.month_label || row.name || fallbackName,
  };
});

const getInitialRange = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const start = `${y}-${m}-01`;
  const end = `${y}-${m}-${String(new Date(y, now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;
  return { start, end };
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
const SalesTab = ({ startDate, endDate }) => {
  const { data, loading, error, refetch } = useFetch(
    () => reportsApi.sales({ start_date: startDate, end_date: endDate }),
    [startDate, endDate]
  );
  const [exporting, setExporting] = useState('');
  const [netMode, setNetMode] = useState('cash');
  const [addingExpense, setAddingExpense] = useState(false);
  const [expenseError, setExpenseError] = useState('');
  const [expenseForm, setExpenseForm] = useState(() => {
    const now = new Date();
    const expenseDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return { expense_date: expenseDate, amount: '', category: '', notes: '' };
  });

  const handlePDF = async (action = 'print') => {
    setExporting(action === 'download' ? 'pdf-download' : 'pdf-print');
    try {
      const monthly = normalizeMonthlyRows(data?.monthly || []);
      const totalRevenue = (data?.monthly || []).reduce((a, r) => a + (r.revenue || 0), 0);
      const totalSpent = (data?.monthly || []).reduce((a, r) => a + (r.total_spent || 0), 0);
      const totalNet = (data?.monthly || []).reduce((a, r) => a + (netMode === 'cash' ? (r.net_value || 0) : (r.accrual_net_value || 0)), 0);
      const totalCollected = (data?.monthly || []).reduce((a, r) => a + (r.collected || 0), 0);
      const totalOrders = (data?.monthly || []).reduce((a, r) => a + (r.orders || 0), 0);

      const htmlContent = buildSalesReportHtml({ data, startDate, endDate, netMode });

      await exportPDF(
        `sales-report-${startDate}-to-${endDate}.pdf`,
        `Sales & Cashflow Report — ${startDate} to ${endDate}`,
        [
          {
            title: 'Executive Financial Summary',
            description: 'Core revenue, collections, operating costs, and net liquidity indicators.',
            metrics: [
              { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}`, desc: 'Invoiced orders' },
              { label: 'Total Orders', value: totalOrders, desc: 'Sales orders count' },
              { label: 'Collected Cash', value: `$${totalCollected.toLocaleString()}`, desc: 'Liquid funds received' },
              { label: 'Total Spent', value: `$${totalSpent.toLocaleString()}`, desc: 'Payroll + Materials + Extra' },
              { label: netMode === 'cash' ? 'Cash Net' : 'Accrual Net', value: `$${totalNet.toLocaleString()}`, desc: netMode === 'cash' ? 'Collected - Spent' : 'Revenue - Costs' },
            ],
          },
          {
            title: 'Monthly Cashflow Trend',
            description: 'Chronological comparison of monthly revenue recognition, collections, and net margin.',
            head: ['Month', 'Orders', 'Revenue ($)', 'Collected ($)', 'Spent ($)', netMode === 'cash' ? 'Cash Net ($)' : 'Accrual Net ($)'],
            rows: monthly.map(r => [
              r.name,
              r.orders || 0,
              (r.revenue || 0).toLocaleString(),
              (r.collected || 0).toLocaleString(),
              (r.total_spent || 0).toLocaleString(),
              (netMode === 'cash' ? (r.net_value || 0) : (r.accrual_net_value || 0)).toLocaleString(),
            ]),
            foot: [
              'Total Summary',
              totalOrders,
              totalRevenue.toLocaleString(),
              totalCollected.toLocaleString(),
              totalSpent.toLocaleString(),
              totalNet.toLocaleString(),
            ],
          },
          {
            title: 'Top Customers & Receivables',
            description: 'Major clients performance, invoiced revenue, collected cash, and outstanding balances.',
            head: ['Customer', 'Orders', 'Revenue ($)', 'Collected ($)', 'Balance Due ($)'],
            rows: (data?.top_customers || []).map(c => {
              const rev = Number(c.revenue || 0);
              const col = Number(c.collected || 0);
              const due = Math.max(0, rev - col);
              return [c.name, c.orders, rev.toLocaleString(), col.toLocaleString(), due.toLocaleString()];
            }),
          },
          {
            title: 'Payment Status Distribution',
            description: 'Breakdown of orders based on client payment settlement state.',
            head: ['Status', 'Orders Count', 'Amount ($)'],
            rows: (data?.payment_breakdown || []).map(p => [p.status, p.count, p.amount.toLocaleString()]),
          },
          {
            title: 'Operating Spend Breakdown',
            description: 'Distribution of factory expenditures across payroll, materials, and overhead.',
            head: ['Expense Category', 'Amount ($)'],
            rows: [
              ['Payroll & Labor (Direct)', Number(data?.summary?.payroll_spent || 0).toLocaleString()],
              ['Materials & Raw Fabrics (COGS)', Number(data?.summary?.materials_spent || 0).toLocaleString()],
              ['Extra Expenses & Overheads', Number(data?.summary?.extra_expenses_spent || data?.summary?.extra_spent || 0).toLocaleString()],
              ['Total Operating Spend', Number(data?.summary?.total_spent || 0).toLocaleString()],
              ['Cash Net Balance (Liquid)', Number(data?.summary?.net_value || 0).toLocaleString()],
              ['Accrual Net Profit (Accounting)', Number(data?.summary?.accrual_net_value || 0).toLocaleString()],
            ],
          },
        ],
        action,
        htmlContent
      );
    } finally { setExporting(''); }
  };

  const handleExcel = async () => {
    setExporting('excel');
    try {
      const monthly = normalizeMonthlyRows(data?.monthly || []);
      await exportExcel(`sales-report-${startDate}-to-${endDate}.xlsx`, [
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

  const monthly = normalizeMonthlyRows(data.monthly || []);
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
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <Btn size="sm" onClick={handleExcel} disabled={!!exporting}>{exporting==='excel'?'جاري التصدير…':'↓ Excel'}</Btn>
          <Btn size="sm" onClick={() => handlePDF('print')} disabled={!!exporting}>{exporting==='pdf-print'?'جاري الفتح…':'🖨️ طباعة (Print / PDF)'}</Btn>
          <Btn size="sm" variant="primary" onClick={() => handlePDF('download')} disabled={!!exporting}>{exporting==='pdf-download'?'جاري الحفظ…':'⬇️ حفظ ملف PDF'}</Btn>
        </div>
      </div>

      <Card>
        <SectionTitle>Add extra spent money</SectionTitle>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:10, alignItems:'end' }}>
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

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:14 }}>
        <MetricCard label="Total revenue"    value={`$${totalRevenue.toLocaleString()}`}   color="var(--accent)" sub={`${startDate} to ${endDate}`} />
        <MetricCard label="Total orders"     value={totalOrders}                            sub={`${startDate} to ${endDate}`} />
        <MetricCard label="Amount collected" value={`$${totalCollected.toLocaleString()}`} sub={`${startDate} to ${endDate}`} />
        <MetricCard label="Total spent"      value={`$${totalSpent.toLocaleString()}`}     color="var(--danger)" sub={`${startDate} to ${endDate}`} />
        <MetricCard label={netMode === 'cash' ? 'Net value (cash)' : 'Net value (accrual)'} value={`$${netValue.toLocaleString()}`} color={netValue >= 0 ? 'var(--accent)' : 'var(--danger)'} sub={`${startDate} to ${endDate}`} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))', gap:16 }}>
        <Card>
          <SectionTitle>Monthly sales cashflow — {startDate} to {endDate}</SectionTitle>
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

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))', gap:16 }}>
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

/* ── Stage Label Helper ────────────────────────────── */
const getStageLabel = (stage) => {
  switch (stage) {
    case 'cutting': return '1. القص';
    case 'sorting': return '2. الفرز';
    case 'printing': return '3. المطبعة';
    case 'ready_for_delivery': return '4. جاهز للتسليم';
    case 'delivered': return '✓ تم التسليم';
    default: return stage;
  }
};

/* ── TAB: Production ────────────────────────────────── */
const ProductionTab = ({ startDate, endDate }) => {
  const { data, loading, error } = useFetch(
    () => reportsApi.production({ start_date: startDate, end_date: endDate }),
    [startDate, endDate]
  );
  const [exporting, setExporting] = useState('');

  const summary = data?.summary || {};
  const monthly = normalizeMonthlyRows(data?.monthly || []);
  const printShops = data?.print_shops || [];
  const models = data?.models || [];
  const stageBreakdown = (data?.stage_breakdown || []).map(s => ({
    ...s,
    name: getStageLabel(s.stage),
    count: s.orders,
  }));

  const handlePDF = async (action = 'print') => {
    setExporting(action === 'download' ? 'pdf-download' : 'pdf-print');
    try {
      const totalCut = Number(summary.total_cut_units || 0);
      const totalDelivered = Number(summary.total_delivered_units || 0);
      const yieldRate = summary.yield_rate || (totalCut > 0 ? ((totalDelivered / totalCut) * 100).toFixed(1) : 0);
      const totalLoss = Math.max(0, totalCut - totalDelivered);

      const htmlContent = buildProductionReportHtml({ data, startDate, endDate });

      await exportPDF(
        `production-pipeline-report-${startDate}-to-${endDate}.pdf`,
        `Production Pipeline & Quality Report — ${startDate} to ${endDate}`,
        [
          {
            title: 'Production Cycle & Quality Funnel Summary',
            description: '4-phase manufacturing overview from cutting to final delivered garments.',
            metrics: [
              { label: 'Total Orders', value: summary.total_orders || 0, desc: 'Production orders' },
              { label: 'Total Cut Pieces', value: `${totalCut.toLocaleString()} pcs`, desc: 'Starting cut units' },
              { label: 'Delivered Pieces', value: `${totalDelivered.toLocaleString()} pcs`, desc: 'Approved & delivered' },
              { label: 'Yield Rate', value: `${yieldRate}%`, desc: '(Delivered / Cut) * 100' },
              { label: 'Total Loss/Defects', value: `${totalLoss.toLocaleString()} pcs`, desc: 'Scrap & missing units' },
            ],
          },
          {
            title: 'Model-by-Model Output & Defect Matrix',
            description: 'Granular tracking of cut quantities, sorting, final delivery, and losses per model.',
            head: ['Model #', 'Model Name', 'Orders', 'Cut Units', 'Sorted', 'Delivered', 'Loss', 'Revenue ($)'],
            rows: models.map(m => [
              m.model_number,
              m.model_name || '—',
              m.orders,
              m.cut_units,
              m.sorted_units,
              m.delivered_units,
              m.loss_units,
              Number(m.revenue || 0).toLocaleString(),
            ]),
            foot: [
              'Total Summary',
              'All Models',
              models.reduce((s, m) => s + Number(m.orders || 1), 0),
              models.reduce((s, m) => s + Number(m.cut_units || 0), 0).toLocaleString(),
              models.reduce((s, m) => s + Number(m.sorted_units || 0), 0).toLocaleString(),
              models.reduce((s, m) => s + Number(m.delivered_units || 0), 0).toLocaleString(),
              models.reduce((s, m) => s + Number(m.loss_units || 0), 0).toLocaleString(),
              models.reduce((s, m) => s + Number(m.revenue || 0), 0).toLocaleString(),
            ],
          },
          {
            title: 'Print Shops & Outwork Quality Performance',
            description: 'Loss rates, sent quantities, and receipt reconciliation for external printing partners.',
            head: ['Print Shop', 'Phone', 'Orders', 'Sent Units', 'Received Units', 'Loss Units', 'Loss Rate %'],
            rows: printShops.map(p => [
              p.print_shop_name,
              p.phone || '—',
              p.orders,
              p.sent_units,
              p.received_units,
              p.loss_units,
              `${p.loss_rate}%`,
            ]),
          },
          {
            title: 'Monthly Production Output Trend',
            description: 'Monthly progression of orders placed, completed batches, and garment volume.',
            head: ['Month', 'Total Orders', 'Delivered Orders', 'Cut Units', 'Delivered Units', 'Delivered Revenue ($)'],
            rows: monthly.map(r => [
              r.name,
              r.total || 0,
              r.completed || 0,
              r.units_ordered || 0,
              r.units_produced || 0,
              Number(r.revenue || 0).toLocaleString(),
            ]),
          },
        ],
        action,
        htmlContent
      );
    } finally { setExporting(''); }
  };

  const handleExcel = async () => {
    setExporting('excel');
    try {
      await exportExcel(`production-pipeline-report-${startDate}-to-${endDate}.xlsx`, [
        {
          sheetName: 'Monthly Trend',
          headers: ['Month', 'Total Orders', 'Delivered Orders', 'Cut Units', 'Delivered Units', 'Delivered Revenue'],
          rows: monthly.map(r => [
            r.name,
            r.total || 0,
            r.completed || 0,
            r.units_ordered || 0,
            r.units_produced || 0,
            r.revenue || 0,
          ]),
        },
        {
          sheetName: 'Print Shops',
          headers: ['Print Shop', 'Phone', 'Orders', 'Sent Units', 'Received Units', 'Loss Units', 'Loss Rate %'],
          rows: printShops.map(p => [
            p.print_shop_name,
            p.phone || '',
            p.orders,
            p.sent_units,
            p.received_units,
            p.loss_units,
            p.loss_rate,
          ]),
        },
        {
          sheetName: 'Models Performance',
          headers: ['Model #', 'Model Name', 'Orders', 'Cut Units', 'Sorted Units', 'Delivered Units', 'Loss Units', 'Delivered Revenue'],
          rows: models.map(m => [
            m.model_number,
            m.model_name || '',
            m.orders,
            m.cut_units,
            m.sorted_units,
            m.delivered_units,
            m.loss_units,
            m.revenue || 0,
          ]),
        },
        {
          sheetName: 'Stages Breakdown',
          headers: ['Stage', 'Stage Name', 'Orders Count', 'Total Units'],
          rows: stageBreakdown.map(s => [s.stage, s.name, s.orders, s.units]),
        },
      ]);
    } finally { setExporting(''); }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  if (!data) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Export Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Btn size="sm" onClick={handleExcel} disabled={!!exporting}>
          {exporting === 'excel' ? 'جاري التصدير…' : '↓ Excel'}
        </Btn>
        <Btn size="sm" onClick={() => handlePDF('print')} disabled={!!exporting}>
          {exporting === 'pdf-print' ? 'جاري الفتح…' : '🖨️ طباعة (Print / PDF)'}
        </Btn>
        <Btn size="sm" variant="primary" onClick={() => handlePDF('download')} disabled={!!exporting}>
          {exporting === 'pdf-download' ? 'جاري الحفظ…' : '⬇️ حفظ ملف PDF'}
        </Btn>
      </div>

      {/* 5 Funnel KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: 14,
      }}>
        {/* Stage 1: Cutting */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderTop: '3px solid #0284c7',
          borderRadius: 10,
          padding: '16px 18px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 12, fontWeight: 700 }}>
            <span>✂️ 1. إجمالي القص</span>
            <span>{summary.total_orders || 0} أوردر</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0284c7', marginTop: 8 }}>
            {Number(summary.total_cut_units || 0).toLocaleString()} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>قطعة</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            الكميات المقصوصة في المصنع
          </div>
        </div>

        {/* Stage 2: Sorting */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderTop: '3px solid #d97706',
          borderRadius: 10,
          padding: '16px 18px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 12, fontWeight: 700 }}>
            <span>🗂️ 2. الفرز والعجز</span>
            <span style={{ color: summary.cutting_loss_units > 0 ? '#dc2626' : '#059669' }}>
              هالك: {summary.cutting_loss_units || 0} ق
            </span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#d97706', marginTop: 8 }}>
            {Number(summary.total_sorted_units || 0).toLocaleString()} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>قطعة</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            القطع المفروزة بعد القص
          </div>
        </div>

        {/* Stage 3: Printing */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderTop: '3px solid #7c3aed',
          borderRadius: 10,
          padding: '16px 18px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 12, fontWeight: 700 }}>
            <span>🖨️ 3. المطابع المستلمة</span>
            <span style={{ color: summary.printing_loss_units > 0 ? '#dc2626' : '#059669' }}>
              عجز: {summary.printing_loss_units || 0} ق
            </span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#7c3aed', marginTop: 8 }}>
            {Number(summary.total_print_received_units || 0).toLocaleString()} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>/ {Number(summary.total_print_sent_units || 0).toLocaleString()} ق</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            المستلم من المطابع والورش
          </div>
        </div>

        {/* Stage 4: Delivery */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderTop: '3px solid #059669',
          borderRadius: 10,
          padding: '16px 18px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 12, fontWeight: 700 }}>
            <span>🚚 4. المسلم للعملاء</span>
            <span>{summary.delivered_orders || 0} أوردر</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#059669', marginTop: 8 }}>
            {Number(summary.total_delivered_units || 0).toLocaleString()} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>قطعة</span>
          </div>
          <div style={{ fontSize: 11, color: '#059669', fontWeight: 600, marginTop: 4 }}>
            إيراد: {Number(summary.total_delivered_revenue || 0).toLocaleString()} ج.م
          </div>
        </div>

        {/* Yield Rate */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderTop: `3px solid ${Number(summary.yield_rate || 0) >= 80 ? '#059669' : '#d97706'}`,
          borderRadius: 10,
          padding: '16px 18px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 12, fontWeight: 700 }}>
            <span>⚡ معدل الكفاءة (Yield)</span>
            <span>نسبة الإنجاز</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: Number(summary.yield_rate || 0) >= 80 ? '#059669' : '#d97706', marginTop: 8 }}>
            {summary.yield_rate || 0}%
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            القطع المسلمة بنجاح من المقصوص
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {/* Monthly Output Chart */}
        <Card>
          <SectionTitle>القطع المقصوصة مقابل المسلمة شهرياً — {startDate} إلى {endDate}</SectionTitle>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={monthly} barCategoryGap="25%">
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<TT />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} />
              <Bar dataKey="units_ordered" name="قطع مقصوصة" fill="#0284c7" radius={[4, 4, 0, 0]} />
              <Bar dataKey="units_produced" name="قطع مسلمة للعملاء" fill="#059669" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Stage Distribution Chart */}
        <Card>
          <SectionTitle>توزيع الأوردرات حسب المرحلة الحالية</SectionTitle>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie
                data={stageBreakdown}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={4}
              >
                {stageBreakdown.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', fontSize: 12, borderRadius: 8 }} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Table 1: Print Shops Performance */}
      <Card>
        <SectionTitle>أداء المطابع والورش الخارجية (Print Shops Performance)</SectionTitle>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'right' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['اسم المطبعة', 'الهاتف', 'الأوردرات', 'القطع المحولة', 'القطع المستلمة', 'العجز / الفقد', 'نسبة العجز %'].map((h, i) => (
                  <th key={i} style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {printShops.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                    لا توجد بيانات مطابع مسجلة خلال هذه الفترة.
                  </td>
                </tr>
              ) : (
                printShops.map((ps, i) => (
                  <tr key={ps.id || i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      🖨️ {ps.print_shop_name}
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{ps.phone || '—'}</td>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{ps.orders} أوردر</td>
                    <td style={{ padding: '12px', fontWeight: 700, color: '#0284c7' }}>
                      {Number(ps.sent_units || 0).toLocaleString()} ق
                    </td>
                    <td style={{ padding: '12px', fontWeight: 700, color: '#059669' }}>
                      {Number(ps.received_units || 0).toLocaleString()} ق
                    </td>
                    <td style={{ padding: '12px', fontWeight: 700, color: Number(ps.loss_units) > 0 ? '#dc2626' : 'var(--text-muted)' }}>
                      {Number(ps.loss_units || 0).toLocaleString()} ق
                    </td>
                    <td style={{ padding: '12px' }}>
                      <Badge variant={Number(ps.loss_rate) > 5 ? 'danger' : Number(ps.loss_rate) > 0 ? 'warning' : 'success'}>
                        {Number(ps.loss_rate || 0).toFixed(1)}%
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Table 2: Models Breakdown */}
      <Card>
        <SectionTitle>تقرير أداء الموديلات والإنتاج (Models Production & Sales)</SectionTitle>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'right' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['رقم الموديل', 'اسم الموديل', 'الأوردرات', 'المقصوص', 'المفروز', 'المسلم للعميل', 'الهالك', 'الإيراد المالي'].map((h, i) => (
                  <th key={i} style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {models.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                    لا توجد بيانات موديلات في الفترة المحددة.
                  </td>
                </tr>
              ) : (
                models.map((m, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px', fontWeight: 800, color: 'var(--accent)' }}>
                      {m.model_number}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{m.model_name || '—'}</td>
                    <td style={{ padding: '12px' }}>{m.orders} أوردر</td>
                    <td style={{ padding: '12px', fontWeight: 700, color: '#0284c7' }}>
                      {Number(m.cut_units || 0).toLocaleString()} ق
                    </td>
                    <td style={{ padding: '12px', fontWeight: 600, color: '#d97706' }}>
                      {Number(m.sorted_units || 0).toLocaleString()} ق
                    </td>
                    <td style={{ padding: '12px', fontWeight: 700, color: '#059669' }}>
                      {Number(m.delivered_units || 0).toLocaleString()} ق
                    </td>
                    <td style={{ padding: '12px', fontWeight: 700, color: Number(m.loss_units) > 0 ? '#dc2626' : 'var(--text-muted)' }}>
                      {Number(m.loss_units || 0).toLocaleString()} ق
                    </td>
                    <td style={{ padding: '12px', fontWeight: 800, color: '#059669' }}>
                      {Number(m.revenue || 0).toLocaleString()} ج.م
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

/* ── TAB: HR ────────────────────────────────────────── */
const HRTab = ({ startDate, endDate }) => {
  const { data, loading, error } = useFetch(
    () => reportsApi.hr({ start_date: startDate, end_date: endDate }),
    [startDate, endDate]
  );
  const [exporting, setExporting] = useState('');

  const handlePDF = async (action = 'print') => {
    setExporting(action === 'download' ? 'pdf-download' : 'pdf-print');
    try {
      const pr = data?.payroll_summary || {};
      const payrollHistory = normalizeMonthlyRows(data?.payroll_history || []).map((row) => ({
        name: row.name,
        paid_payout: row.paid_payout || 0,
        pending_payout: row.pending_payout || 0,
        total_payout: row.total_payout || 0,
      }));

      const htmlContent = buildHrReportHtml({ data, startDate, endDate });

      await exportPDF(
        `hr-report-${startDate}-to-${endDate}.pdf`,
        `HR & Payroll Analytics Report — ${startDate} to ${endDate}`,
        [
          {
            title: 'Payroll Financial Liability Summary',
            description: 'Disbursed wages, pending liabilities, overtime incentives, and employee deductions.',
            metrics: [
              { label: 'Total Liability', value: `$${Number(pr.total_payout || 0).toLocaleString()}`, desc: 'Total calculated wages' },
              { label: 'Paid Out', value: `$${Number(pr.paid_payout || 0).toLocaleString()}`, desc: 'Disbursed to workers' },
              { label: 'Pending Payout', value: `$${Number(Math.max(0, (pr.total_payout || 0) - (pr.paid_payout || 0))).toLocaleString()}`, desc: 'Awaiting disbursement' },
              { label: 'Overtime & Bonuses', value: `$${Number(pr.total_bonuses || 0).toLocaleString()}`, desc: 'Production overtime incentives' },
              { label: 'Deductions', value: `$${Number(pr.total_deductions || 0).toLocaleString()}`, desc: 'Late, absent, loan installments' },
            ],
          },
          {
            title: 'Monthly Payroll Payout History',
            description: 'Monthly disbursement status and reconciliation of wages.',
            head: ['Month', 'Paid Payroll ($)', 'Pending Payroll ($)', 'Total Payroll ($)'],
            rows: payrollHistory.map(r => [
              r.name,
              Number(r.paid_payout).toLocaleString(),
              Number(r.pending_payout).toLocaleString(),
              Number(r.total_payout).toLocaleString(),
            ]),
            foot: [
              'Total Summary',
              payrollHistory.reduce((s, r) => s + Number(r.paid_payout || 0), 0).toLocaleString(),
              payrollHistory.reduce((s, r) => s + Number(r.pending_payout || 0), 0).toLocaleString(),
              payrollHistory.reduce((s, r) => s + Number(r.total_payout || 0), 0).toLocaleString(),
            ],
          },
          {
            title: 'Departmental Attendance & Logged Hours',
            description: 'Worker attendance rate, recorded shifts, and worked hours across factory departments.',
            head: ['Department', 'Attendance Records', 'Present Days', 'Absent Days', 'Logged Hours'],
            rows: (data?.by_department || []).map(d => [
              d.department,
              d.records,
              d.present,
              d.absent,
              `${d.hours?.toFixed(1)} hrs`,
            ]),
          },
          {
            title: 'Top Dedicated Employees by Logged Hours',
            description: 'Staff members with highest commitment and hours on the factory floor.',
            head: ['Employee Name', 'Total Hours', 'Days Logged'],
            rows: (data?.top_hours || []).map(e => [e.name, `${e.total_hours} hrs`, e.days_logged]),
          },
        ],
        action,
        htmlContent
      );
    } finally { setExporting(''); }
  };

  const handleExcel = async () => {
    setExporting('excel');
    try {
      await exportExcel(`hr-report-${startDate}-to-${endDate}.xlsx`, [
        {
          sheetName: 'Payroll History',
          headers: ['Month','Paid Payroll ($)','Pending Payroll ($)','Total Payroll ($)','Paid Records','Total Records'],
          rows: normalizeMonthlyRows(data?.payroll_history||[]).map(r => [r.name, r.paid_payout||0, r.pending_payout||0, r.total_payout||0, r.paid_records||0, r.total_records||0]),
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
  const payrollHistory = normalizeMonthlyRows(data.payroll_history || []).map((row) => ({
    name: row.name,
    paid_payout: row.paid_payout || 0,
    pending_payout: row.pending_payout || 0,
    total_payout: row.total_payout || 0,
  }));

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div style={{ display:'flex', justifyContent:'flex-end', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <Btn size="sm" onClick={handleExcel} disabled={!!exporting}>{exporting==='excel'?'جاري التصدير…':'↓ Excel'}</Btn>
        <Btn size="sm" onClick={() => handlePDF('print')} disabled={!!exporting}>{exporting==='pdf-print'?'جاري الفتح…':'🖨️ طباعة (Print / PDF)'}</Btn>
        <Btn size="sm" variant="primary" onClick={() => handlePDF('download')} disabled={!!exporting}>{exporting==='pdf-download'?'جاري الحفظ…':'⬇️ حفظ ملف PDF'}</Btn>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:14 }}>
        <MetricCard label="Payroll payout" value={`$${Number(pr.total_payout||0).toLocaleString()}`} color="var(--accent)" />
        <MetricCard label="Paid payroll"   value={`$${Number(pr.paid_payout||0).toLocaleString()}`} color="var(--danger)" />
        <MetricCard label="Pending payroll" value={`$${Number(pr.pending_payout||0).toLocaleString()}`} />
        <MetricCard label="Paid employees" value={`${pr.paid_count||0} / ${pr.total_records||0}`} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))', gap:16 }}>
        <Card>
          <SectionTitle>Payroll spend history — {startDate} to {endDate}</SectionTitle>
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
          <SectionTitle>Attendance breakdown — {startDate} to {endDate}</SectionTitle>
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
        <SectionTitle>Top employees by hours — {startDate} to {endDate}</SectionTitle>
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

/* ── TAB: Print Shops & Outwork ─────────────────────── */
const PrintShopsTab = ({ startDate, endDate }) => {
  const { data, loading, error } = useFetch(
    () => reportsApi.printShops({ start_date: startDate, end_date: endDate }),
    [startDate, endDate]
  );
  const [exporting, setExporting] = useState('');

  const summary = data?.summary || {};
  const printShops = data?.print_shops || [];
  const recentDispatches = data?.recent_dispatches || [];

  const handlePDF = async (action = 'print') => {
    setExporting(action === 'download' ? 'pdf-download' : 'pdf-print');
    try {
      const totalSent = Number(summary.total_sent_units || 0);
      const totalReceived = Number(summary.total_received_units || 0);
      const totalLoss = Number(summary.total_loss_units || 0);
      const lossRate = summary.loss_rate || (totalSent > 0 ? ((totalLoss / totalSent) * 100).toFixed(1) : 0);

      const htmlContent = buildPrintShopsReportHtml({ data, startDate, endDate });

      await exportPDF(
        `print-shops-report-${startDate}-to-${endDate}.pdf`,
        `Print Shops & Outwork Quality Report — ${startDate} to ${endDate}`,
        [
          {
            title: 'Print Shops & Outwork Performance Summary',
            description: 'Overview of outsourced embroidery and printing orders, dispatched volume, and scrap.',
            metrics: [
              { label: 'Registered Shops', value: summary.total_shops || printShops.length || 0, desc: 'Partner workshops' },
              { label: 'Orders Dispatched', value: summary.orders_with_print || 0, desc: 'Batches sent to print' },
              { label: 'Sent Units', value: `${totalSent.toLocaleString()} pcs`, desc: 'Cut fabrics delivered' },
              { label: 'Received Units', value: `${totalReceived.toLocaleString()} pcs`, desc: 'Passed inspection' },
              { label: 'Loss & Scrap Rate', value: `${totalLoss.toLocaleString()} pcs (${lossRate}%)`, desc: 'Max tolerance < 2.0%' },
            ],
          },
          {
            title: 'Print Shops Quality & Loss Scorecard',
            description: 'Vendor evaluation ranking each shop by received yield and defective pieces.',
            head: ['Print Shop', 'Phone', 'Orders', 'Active Orders', 'Sent Units', 'Received Units', 'Loss Units', 'Loss Rate %'],
            rows: printShops.map(p => [
              p.print_shop_name,
              p.phone || '—',
              p.total_orders,
              p.active_orders,
              p.sent_units,
              p.received_units,
              p.loss_units,
              `${p.loss_rate}%`,
            ]),
            foot: [
              'Total Summary',
              'All Shops',
              printShops.reduce((s, p) => s + Number(p.total_orders || 0), 0),
              printShops.reduce((s, p) => s + Number(p.active_orders || 0), 0),
              totalSent.toLocaleString(),
              totalReceived.toLocaleString(),
              totalLoss.toLocaleString(),
              `${lossRate}%`,
            ],
          },
          {
            title: 'Recent Printing Dispatches Log',
            description: 'Chronological dispatch log with delivery timestamps and operational status.',
            head: ['Order # / Model', 'Order Name', 'Print Shop', 'Sent Date', 'Sent Units', 'Received Units', 'Current Stage'],
            rows: recentDispatches.map(d => [
              d.order_number || d.model_number,
              d.order_name || '—',
              d.print_shop_name,
              d.print_sent_at ? new Date(d.print_sent_at).toLocaleDateString() : '—',
              d.total_print_sent_quantity || 0,
              d.total_print_received_quantity || 0,
              getStageLabel(d.current_stage),
            ]),
          },
        ],
        action,
        htmlContent
      );
    } finally { setExporting(''); }
  };

  const handleExcel = async () => {
    setExporting('excel');
    try {
      await exportExcel(`print-shops-report-${startDate}-to-${endDate}.xlsx`, [
        {
          sheetName: 'Print Shops Performance',
          headers: ['Print Shop', 'Phone', 'Contact Person', 'Total Orders', 'Active Orders', 'Sent Units', 'Received Units', 'Loss Units', 'Loss Rate %'],
          rows: printShops.map(p => [
            p.print_shop_name,
            p.phone || '',
            p.contact_person || '',
            p.total_orders,
            p.active_orders,
            p.sent_units,
            p.received_units,
            p.loss_units,
            p.loss_rate,
          ]),
        },
        {
          sheetName: 'Dispatches History',
          headers: ['Order #', 'Model #', 'Order Name', 'Print Shop', 'Sent Date', 'Received Date', 'Sent Units', 'Received Units', 'Stage'],
          rows: recentDispatches.map(d => [
            d.order_number,
            d.model_number,
            d.order_name || '',
            d.print_shop_name,
            d.print_sent_at ? new Date(d.print_sent_at).toISOString().slice(0, 10) : '',
            d.print_received_at ? new Date(d.print_received_at).toISOString().slice(0, 10) : '',
            d.total_print_sent_quantity || 0,
            d.total_print_received_quantity || 0,
            d.current_stage,
          ]),
        },
      ]);
    } finally { setExporting(''); }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  if (!data) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Btn size="sm" onClick={handleExcel} disabled={!!exporting}>
          {exporting === 'excel' ? 'جاري التصدير…' : '↓ Excel'}
        </Btn>
        <Btn size="sm" onClick={() => handlePDF('print')} disabled={!!exporting}>
          {exporting === 'pdf-print' ? 'جاري الفتح…' : '🖨️ طباعة (Print / PDF)'}
        </Btn>
        <Btn size="sm" variant="primary" onClick={() => handlePDF('download')} disabled={!!exporting}>
          {exporting === 'pdf-download' ? 'جاري الحفظ…' : '⬇️ حفظ ملف PDF'}
        </Btn>
      </div>

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 14,
      }}>
        <MetricCard label="المطابع المسجلة" value={summary.total_shops || 0} icon="🖨️" />
        <MetricCard label="أوردرات محولة للطباعة" value={summary.orders_with_print || 0} icon="📦" />
        <MetricCard
          label="القطع المحولة للمطابع"
          value={`${Number(summary.total_sent_units || 0).toLocaleString()} ق`}
          color="#0284c7"
          icon="📤"
        />
        <MetricCard
          label="المستلم ونسبة الهالك"
          value={`${Number(summary.total_received_units || 0).toLocaleString()} ق`}
          sub={`عجز: ${summary.total_loss_units || 0} ق (${summary.loss_rate || 0}%)`}
          color={Number(summary.loss_rate) > 5 ? 'var(--danger)' : 'var(--accent)'}
          icon="📥"
        />
      </div>

      {/* Table 1: Print Shops Quality & Performance */}
      <Card>
        <SectionTitle>أداء وجودة المطابع والتشغيل الخارجي (Print Shops Performance & Loss)</SectionTitle>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'right' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['اسم المطبعة', 'بيانات التواصل', 'إجمالي الأوردرات', 'قيد الطباعة الآن', 'القطع المحولة', 'المستلم', 'العجز / الهالك', 'نسبة الفقد %'].map((h, i) => (
                  <th key={i} style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {printShops.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                    لا توجد مطابع مسجلة أو تشغيل خارجي في هذه الفترة.
                  </td>
                </tr>
              ) : (
                printShops.map((ps, i) => (
                  <tr key={ps.id || i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      🖨️ {ps.print_shop_name}
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                      {ps.phone || '—'} {ps.contact_person ? `(${ps.contact_person})` : ''}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{ps.total_orders} أوردر</td>
                    <td style={{ padding: '12px' }}>
                      {Number(ps.active_orders) > 0 ? (
                        <Badge variant="warning">{ps.active_orders} جاري</Badge>
                      ) : (
                        <Badge variant="neutral">0</Badge>
                      )}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 700, color: '#0284c7' }}>
                      {Number(ps.sent_units || 0).toLocaleString()} ق
                    </td>
                    <td style={{ padding: '12px', fontWeight: 700, color: '#059669' }}>
                      {Number(ps.received_units || 0).toLocaleString()} ق
                    </td>
                    <td style={{ padding: '12px', fontWeight: 700, color: Number(ps.loss_units) > 0 ? '#dc2626' : 'var(--text-muted)' }}>
                      {Number(ps.loss_units || 0).toLocaleString()} ق
                    </td>
                    <td style={{ padding: '12px' }}>
                      <Badge variant={Number(ps.loss_rate) > 5 ? 'danger' : Number(ps.loss_rate) > 0 ? 'warning' : 'success'}>
                        {Number(ps.loss_rate || 0).toFixed(1)}%
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Table 2: Recent Dispatches History */}
      <Card>
        <SectionTitle>سجل أذونات الخروج والتشغيل الأخيرة (Dispatches & Receipts Log)</SectionTitle>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'right' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['الموديل', 'اسم الموديل', 'المطبعة', 'تاريخ الإرسال', 'الكمية المرسلة', 'الكمية المستلمة', 'المرحلة الحالية'].map((h, i) => (
                  <th key={i} style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentDispatches.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                    لا توجد أذونات خروج للمطابع في هذه الفترة.
                  </td>
                </tr>
              ) : (
                recentDispatches.map((d, i) => (
                  <tr key={d.id || i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px', fontWeight: 800, color: 'var(--accent)' }}>
                      {d.model_number || d.order_number}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{d.order_name || '—'}</td>
                    <td style={{ padding: '12px', color: '#7c3aed', fontWeight: 600 }}>🖨️ {d.print_shop_name}</td>
                    <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                      {d.print_sent_at ? new Date(d.print_sent_at).toLocaleDateString('ar-EG') : '—'}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 700, color: '#0284c7' }}>
                      {Number(d.total_print_sent_quantity || 0).toLocaleString()} ق
                    </td>
                    <td style={{ padding: '12px', fontWeight: 700, color: d.total_print_received_quantity ? '#059669' : 'var(--text-muted)' }}>
                      {d.total_print_received_quantity ? `${Number(d.total_print_received_quantity).toLocaleString()} ق` : 'قيد الطباعة'}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <Badge variant={d.current_stage === 'delivered' ? 'success' : d.current_stage === 'ready_for_delivery' ? 'info' : 'warning'}>
                        {getStageLabel(d.current_stage)}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

/* ── Main component ─────────────────────────────────── */
const TABS = ['المبيعات والتدفقات (Sales)', 'خط الإنتاج والتشغيل (Production)', 'الموظفين والرواتب (HR)', 'المطابع والتشغيل الخارجي (Print Shops)'];

export default function Reports() {
  const [tab, setTab] = useState(0);
  const initialRange = getInitialRange();
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);

  return (
    <div style={{ padding: '28px 30px 40px' }}>
      <PageHeader
        title="التقارير والإحصائيات الشاملة"
        subtitle="مؤشرات أداء الأعمال لخط الإنتاج، المبيعات، المطابع والتشغيل الخارجي، والرواتب"
        action={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                padding: '8px 12px',
                fontSize: 13,
                transition: 'border .2s var(--ease-out)',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={e => setEndDate(e.target.value)}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                padding: '8px 12px',
                fontSize: 13,
                transition: 'border .2s var(--ease-out)',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
            {startDate > endDate && (
              <span style={{ color: 'var(--danger)', fontSize: 12, fontWeight: 500 }}>تاريخ النهاية يجب أن يكون بعد البداية</span>
            )}
          </div>
        }
      />

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 28,
        borderBottom: '1px solid var(--border)', paddingBottom: 0,
        overflowX: 'auto',
      }}>
        {TABS.map((t, i) => (
          <button
            key={i}
            onClick={() => setTab(i)}
            style={{
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: tab === i ? 700 : 500,
              background: tab === i ? 'var(--accent-dim)' : 'transparent',
              color: tab === i ? 'var(--accent)' : 'var(--text-secondary)',
              border: 'none',
              borderBottom: tab === i ? '2px solid var(--accent)' : '2px solid transparent',
              borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
              marginBottom: -1,
              cursor: 'pointer',
              transition: 'all .2s var(--ease-out)',
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { if (tab !== i) e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { if (tab !== i) e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="animate-in">
        {tab === 0 && <SalesTab startDate={startDate} endDate={endDate} />}
        {tab === 1 && <ProductionTab startDate={startDate} endDate={endDate} />}
        {tab === 2 && <HRTab startDate={startDate} endDate={endDate} />}
        {tab === 3 && <PrintShopsTab startDate={startDate} endDate={endDate} />}
      </div>
    </div>
  );
}
