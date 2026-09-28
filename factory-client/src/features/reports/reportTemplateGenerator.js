/**
 * Executive Report Template Generator for Black Fox Factory Management System.
 * Generates clean, spacious, self-explanatory, and beautifully styled A4 Landscape reports.
 * Designed with zero clutter, no awkward text-wrapping, concise guides, and official approval seals.
 */

const BLACK_FOX_SVG_LOGO = `
<svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;">
  <defs>
    <linearGradient id="bfReportGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563eb" />
      <stop offset="100%" stop-color="#1d4ed8" />
    </linearGradient>
    <linearGradient id="bfReportGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6" />
      <stop offset="100%" stop-color="#1e40af" />
    </linearGradient>
    <linearGradient id="bfReportGrad3" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e293b" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
  </defs>
  <polygon points="50,14 18,38 32,74 50,54" fill="url(#bfReportGrad1)" />
  <polygon points="50,14 82,38 68,74 50,54" fill="url(#bfReportGrad2)" />
  <polygon points="50,14 38,4 32,24" fill="#1e3a8a" />
  <polygon points="50,14 62,4 68,24" fill="#1e40af" />
  <polygon points="12,52 32,74 22,78" fill="url(#bfReportGrad3)" />
  <polygon points="88,52 68,74 78,78" fill="url(#bfReportGrad3)" />
  <polygon points="50,54 32,74 50,92" fill="#ffffff" fill-opacity="0.95" />
  <polygon points="50,54 68,74 50,92" fill="#e2e8f0" />
  <polygon points="50,86 44,92 56,92" fill="#0f172a" />
  <polygon points="36,54 44,57 40,61" fill="#f59e0b" />
  <polygon points="64,54 56,57 60,61" fill="#f59e0b" />
</svg>
`;

const formatCurrency = (val) => {
  const n = Number(val || 0);
  return `${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م`;
};

const formatNumber = (val) => Number(val || 0).toLocaleString('en-US');

const getBaseStyles = () => `
  @page {
    size: A4 landscape;
    margin: 6mm 8mm;
  }
  * {
    box-sizing: border-box;
  }
  body {
    font-family: 'Segoe UI', Tahoma, Arial, 'Cairo', sans-serif;
    margin: 0;
    padding: 0;
    color: #0f172a;
    background: #ffffff;
    direction: rtl;
    text-align: right;
    font-size: 11.5px;
    line-height: 1.4;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .report-page {
    width: 281mm;
    max-width: 281mm;
    margin: 0 auto;
    padding: 0;
  }
  @media print {
    html, body {
      width: 281mm !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .report-page {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
    }
  }
  .header-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #0f172a;
    color: #ffffff;
    padding: 10px 18px;
    border-radius: 6px;
    margin-bottom: 10px;
    border-bottom: 2.5px solid #2563eb;
  }
  .brand-group {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .brand-info h1 {
    font-size: 16px;
    font-weight: 900;
    margin: 0 0 2px 0;
    color: #ffffff;
    letter-spacing: -0.01em;
    white-space: nowrap;
  }
  .brand-info .sub {
    font-size: 10.5px;
    color: #94a3b8;
    font-weight: 500;
    white-space: nowrap;
  }
  .meta-group {
    text-align: left;
    font-size: 10.5px;
    color: #cbd5e1;
    white-space: nowrap;
  }
  .meta-ref {
    font-family: monospace;
    color: #38bdf8;
    font-weight: 700;
    font-size: 10.5px;
  }
  .title-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    padding-bottom: 6px;
    border-bottom: 1.5px solid #e2e8f0;
  }
  .title-section h2 {
    font-size: 18px;
    margin: 0;
    color: #0f172a;
    font-weight: 900;
    white-space: nowrap;
  }
  .title-section .subtitle {
    font-size: 11px;
    color: #64748b;
    margin-top: 2px;
    font-weight: 600;
    white-space: nowrap;
  }
  .date-badge {
    background: #eff6ff;
    color: #1e40af;
    padding: 3px 10px;
    border-radius: 5px;
    font-size: 10.5px;
    font-weight: 700;
    border: 1px solid #bfdbfe;
    white-space: nowrap;
  }
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 8px;
    margin-bottom: 12px;
  }
  .kpi-grid.col-5 {
    grid-template-columns: repeat(5, 1fr);
  }
  .kpi-card {
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 8px 10px;
    border-top: 3px solid #2563eb;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .kpi-card.green { border-top-color: #16a34a; }
  .kpi-card.amber { border-top-color: #d97706; }
  .kpi-card.purple { border-top-color: #7c3aed; }
  .kpi-card.red { border-top-color: #dc2626; }
  .kpi-card.dark { border-top-color: #0f172a; }
  .kpi-label {
    font-size: 10.5px;
    color: #475569;
    font-weight: 700;
    white-space: nowrap;
  }
  .kpi-value {
    font-size: 16px;
    font-weight: 900;
    color: #0f172a;
    margin: 2px 0;
    white-space: nowrap;
  }
  .kpi-desc {
    font-size: 9.5px;
    color: #64748b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .guide-container {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 12px;
  }
  .guide-card {
    background: #f0f7ff;
    border: 1px solid #bfdbfe;
    border-right: 3.5px solid #2563eb;
    border-radius: 5px;
    padding: 7px 10px;
    font-size: 10.5px;
    line-height: 1.4;
    color: #1e3a8a;
  }
  .guide-card.green {
    background: #f0fdf4;
    border-color: #bbf7d0;
    border-right-color: #16a34a;
    color: #14532d;
  }
  .guide-card-title {
    font-weight: 800;
    margin-bottom: 2px;
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    white-space: nowrap;
  }
  .guide-card-text {
    font-size: 10px;
    color: #334155;
    line-height: 1.35;
  }
  .section-header {
    font-size: 12px;
    font-weight: 800;
    color: #0f172a;
    margin: 12px 0 6px 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #cbd5e1;
    padding-bottom: 3px;
  }
  .section-header .sub-info {
    font-size: 10px;
    font-weight: 500;
    color: #64748b;
    white-space: nowrap;
  }
  table.data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    margin-bottom: 12px;
    border: 1px solid #cbd5e1;
    page-break-inside: auto;
  }
  table.data-table tr {
    page-break-inside: avoid;
    page-break-after: auto;
  }
  table.data-table th {
    background: #0f172a;
    color: #ffffff;
    padding: 6px 8px;
    font-weight: 700;
    text-align: right;
    border: 1px solid #334155;
    font-size: 10.5px;
    white-space: nowrap;
  }
  table.data-table td {
    padding: 5px 8px;
    border: 1px solid #e2e8f0;
    color: #1e293b;
    white-space: nowrap;
    vertical-align: middle;
  }
  table.data-table tr:nth-child(even) td {
    background: #f8fafc;
  }
  table.data-table tfoot td {
    background: #f1f5f9;
    font-weight: 800;
    border-top: 2px solid #94a3b8;
    color: #0f172a;
    padding: 6px 8px;
  }
  .badge {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 9.5px;
    font-weight: 700;
    white-space: nowrap;
  }
  .badge.success { background: #dcfce7; color: #15803d; }
  .badge.warning { background: #fef9c3; color: #a16207; }
  .badge.danger { background: #fee2e2; color: #b91c1c; }
  .badge.info { background: #e0f2fe; color: #0369a1; }
  .badge.neutral { background: #f1f5f9; color: #475569; }
  .nowrap {
    white-space: nowrap;
  }
  .signatures-section {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-top: 14px;
    padding-top: 10px;
    border-top: 1.5px dashed #cbd5e1;
    page-break-inside: avoid;
  }
  .sign-card {
    border: 1px solid #cbd5e1;
    border-radius: 5px;
    padding: 8px 10px;
    background: #f8fafc;
    text-align: center;
  }
  .sign-card.stamp-box {
    background: #ffffff;
    border: 1px solid #94a3b8;
  }
  .sign-title {
    font-size: 10.5px;
    font-weight: 800;
    color: #0f172a;
    margin-bottom: 24px;
    white-space: nowrap;
  }
  .sign-line {
    border-top: 1px dashed #94a3b8;
    padding-top: 4px;
    font-size: 9.5px;
    color: #475569;
    white-space: nowrap;
  }
  .stamp-seal {
    display: inline-block;
    border: 2px solid #2563eb;
    border-radius: 50%;
    padding: 2px 7px;
    color: #2563eb;
    font-size: 8px;
    font-weight: 900;
    margin: 1px auto 3px;
    transform: rotate(-3deg);
  }
  .report-footer {
    margin-top: 10px;
    padding-top: 6px;
    border-top: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    color: #94a3b8;
  }
`;

/**
 * Build Sales & Cashflow Detailed Report HTML (A4 Landscape)
 */
export const buildSalesReportHtml = ({ data = {}, startDate = '', endDate = '' }) => {
  const monthly = data.monthly || [];
  const topCustomers = data.top_customers || [];
  const summary = data.summary || {};

  const totalRevenue = monthly.reduce((s, r) => s + Number(r.revenue || 0), 0);
  const totalCollected = monthly.reduce((s, r) => s + Number(r.collected || 0), 0);
  const totalSpent = monthly.reduce((s, r) => s + Number(r.total_spent || 0), 0);
  const totalCashNet = monthly.reduce((s, r) => s + Number(r.net_value || 0), 0);
  const totalAccrualNet = monthly.reduce((s, r) => s + Number(r.accrual_net_value || 0), 0);
  const totalOrders = monthly.reduce((s, r) => s + Number(r.orders || 0), 0);
  const collectionRate = totalRevenue > 0 ? ((totalCollected / totalRevenue) * 100).toFixed(1) : 0;
  const remainingReceivables = Math.max(0, totalRevenue - totalCollected);

  const docRef = `BF-SALES-${startDate.replaceAll('-', '')}-${endDate.replaceAll('-', '')}`;

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>تقرير المبيعات والتدفقات النقدية — بلاك فوكس</title>
  <style>${getBaseStyles()}</style>
</head>
<body>
  <div class="report-page">
    <!-- Header Banner -->
    <div class="header-banner">
      <div class="brand-group">
        ${BLACK_FOX_SVG_LOGO}
        <div class="brand-info">
          <h1>مصنع بلاك فوكس للملابس الجاهزة — BLACK FOX</h1>
          <div class="sub">الإدارة المالية والرقابة على الحسابات والمبيعات</div>
        </div>
      </div>
      <div class="meta-group">
        <div>كود الوثيقة: <span class="meta-ref">${docRef}</span></div>
        <div>تاريخ الإصدار: ${new Date().toLocaleDateString('ar-EG')}</div>
      </div>
    </div>

    <!-- Title Section -->
    <div class="title-section">
      <div>
        <h2>تقرير المبيعات والتدفقات النقدية والأرباح</h2>
        <div class="subtitle">تحليل الإيرادات والتحصيلات الفعلية وهيكل المصروفات وموقف السيولة</div>
      </div>
      <div class="date-badge">
        الفترة: من ${startDate || '—'} إلى ${endDate || '—'}
      </div>
    </div>

    <!-- Executive KPI Grid (6 Clean Cards Side-by-Side) -->
    <div class="kpi-grid">
      <div class="kpi-card green">
        <div class="kpi-label">إجمالي المبيعات</div>
        <div class="kpi-value" style="color:#15803d">${formatCurrency(totalRevenue)}</div>
        <div class="kpi-desc">فواتير صادرة (${totalOrders} أوردر)</div>
      </div>
      <div class="kpi-card green">
        <div class="kpi-label">المقبوض نقداً</div>
        <div class="kpi-value" style="color:#0f766e">${formatCurrency(totalCollected)}</div>
        <div class="kpi-desc">سيولة محصلة (${collectionRate}%)</div>
      </div>
      <div class="kpi-card amber">
        <div class="kpi-label">إجمالي المصروفات</div>
        <div class="kpi-value" style="color:#b45309">${formatCurrency(totalSpent)}</div>
        <div class="kpi-desc">رواتب + خامات + نثريات</div>
      </div>
      <div class="kpi-card ${totalCashNet >= 0 ? 'green' : 'red'}">
        <div class="kpi-label">صافي النقد (Cash)</div>
        <div class="kpi-value" style="color:${totalCashNet >= 0 ? '#15803d' : '#dc2626'}">${formatCurrency(totalCashNet)}</div>
        <div class="kpi-desc">المقبوض - المنصرف فعلياً</div>
      </div>
      <div class="kpi-card purple">
        <div class="kpi-label">الربح المحاسبي (Accrual)</div>
        <div class="kpi-value" style="color:#6d28d9">${formatCurrency(totalAccrualNet)}</div>
        <div class="kpi-desc">المبيعات - التكاليف (شامل الآجل)</div>
      </div>
      <div class="kpi-card dark">
        <div class="kpi-label">المستحقات المعلقة</div>
        <div class="kpi-value" style="color:#0f172a">${formatCurrency(remainingReceivables)}</div>
        <div class="kpi-desc">متبقي قيد التحصيل</div>
      </div>
    </div>

    <!-- Clean 3-Card Operational Guide -->
    <div class="guide-container">
      <div class="guide-card">
        <div class="guide-card-title">💡 صافي النقد مقابل الربح المحاسبي:</div>
        <div class="guide-card-text">صافي النقد (Cash Net) يمثل السيولة الجاهزة بالخزينة لسداد الالتزامات، بينما الربح المحاسبي (Accrual) يحسب أرباح الأوردرات كاملة حتى لو كانت بالآجل.</div>
      </div>
      <div class="guide-card">
        <div class="guide-card-title">📊 معدل التحصيل النقدي (${collectionRate}%):</div>
        <div class="guide-card-text">المستهدف القياسي للمصنع ≥ 85%. أي رصيد متبقي يعتبر مديونية واجبة المتابعة المستمرة مع مسؤولي المبيعات والعملاء.</div>
      </div>
      <div class="guide-card">
        <div class="guide-card-title">⚖️ هيكل التكاليف المباشرة:</div>
        <div class="guide-card-text">رواتب الإنتاج وخامات الأقمشة تمثل التكلفة المباشرة (COGS)، ويجب أن تتناسب طردياً مع عدد القطع المنتجة لحماية هوامش الأرباح.</div>
      </div>
    </div>

    <!-- Table 1: Monthly Cashflow Trend (Wide Landscape Table) -->
    <div class="section-header">
      <span>1. بيان التدفق النقدي والمبيعات الشهري (Monthly Cashflow Trend)</span>
      <span class="sub-info">مقارنة دورية لحركة السيولة والإيرادات والمصروفات</span>
    </div>
    <table class="data-table">
      <thead>
        <tr>
          <th>الشهر</th>
          <th style="text-align:center;">الأوردرات</th>
          <th>المبيعات (ج.م)</th>
          <th>المحصل نقداً (ج.م)</th>
          <th>المصروفات (ج.م)</th>
          <th>صافي النقد (Cash Net)</th>
          <th>الربح المحاسبي (Accrual)</th>
          <th style="text-align:center;">نسبة التحصيل</th>
        </tr>
      </thead>
      <tbody>
        ${monthly.length === 0 ? '<tr><td colspan="8" style="text-align:center;padding:10px;color:#94a3b8;">لا توجد بيانات مسجلة لهذه الفترة</td></tr>' : monthly.map(r => {
          const rowRev = Number(r.revenue || 0);
          const rowCol = Number(r.collected || 0);
          const rowExp = Number(r.total_spent || 0);
          const rowCash = Number(r.net_value || 0);
          const rowAcc = Number(r.accrual_net_value || 0);
          const rowRate = rowRev > 0 ? ((rowCol / rowRev) * 100).toFixed(0) : '0';
          return `
            <tr>
              <td class="nowrap" style="font-weight:800;color:#0f172a;">${r.name || '—'}</td>
              <td class="nowrap" style="text-align:center;">${r.orders || 0}</td>
              <td class="nowrap" style="font-weight:700;">${formatNumber(rowRev)}</td>
              <td class="nowrap" style="color:#0f766e;font-weight:700;">${formatNumber(rowCol)}</td>
              <td class="nowrap" style="color:#b45309;">${formatNumber(rowExp)}</td>
              <td class="nowrap" style="color:${rowCash >= 0 ? '#15803d' : '#dc2626'};font-weight:800;">${formatNumber(rowCash)}</td>
              <td class="nowrap" style="color:#6d28d9;font-weight:700;">${formatNumber(rowAcc)}</td>
              <td class="nowrap" style="text-align:center;">
                <span class="badge ${Number(rowRate) >= 80 ? 'success' : Number(rowRate) >= 50 ? 'warning' : 'danger'}">
                  ${rowRate}%
                </span>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
      <tfoot>
        <tr>
          <td>الإجمالي العام</td>
          <td style="text-align:center;">${totalOrders}</td>
          <td class="nowrap">${formatNumber(totalRevenue)}</td>
          <td class="nowrap" style="color:#0f766e;">${formatNumber(totalCollected)}</td>
          <td class="nowrap" style="color:#b45309;">${formatNumber(totalSpent)}</td>
          <td class="nowrap" style="color:${totalCashNet >= 0 ? '#15803d' : '#dc2626'};">${formatNumber(totalCashNet)}</td>
          <td class="nowrap" style="color:#6d28d9;">${formatNumber(totalAccrualNet)}</td>
          <td class="nowrap" style="text-align:center;">${collectionRate}%</td>
        </tr>
      </tfoot>
    </table>

    <!-- Grid of 2 Balanced Tables: Top Customers & Expense Breakdown -->
    <div style="display:grid;grid-template-columns:1.25fr 0.75fr;gap:12px;align-items:start;">
      <div style="min-width:0;overflow:hidden;">
        <div class="section-header">
          <span>2. قائمة كبار العملاء وحالة السداد (Top Customers & Receivables)</span>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>اسم العميل</th>
              <th style="text-align:center;">الأوردرات</th>
              <th>المبيعات (ج.م)</th>
              <th>المحصل (ج.م)</th>
              <th>المتبقي (ج.م)</th>
              <th style="text-align:center;">الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${topCustomers.length === 0 ? '<tr><td colspan="6" style="text-align:center;padding:10px;color:#94a3b8;">لا توجد معاملات مسجلة</td></tr>' : topCustomers.map(c => {
              const cRev = Number(c.revenue || 0);
              const cCol = Number(c.collected || 0);
              const cDue = Math.max(0, cRev - cCol);
              const statusBadge = cDue === 0
                ? '<span class="badge success">مسدد بالكامل</span>'
                : cCol > 0
                  ? '<span class="badge warning">دفعة جزئية</span>'
                  : '<span class="badge danger">غير مسدد</span>';
              return `
                <tr>
                  <td class="nowrap" style="font-weight:800;color:#0f172a;">${c.name || 'عميل نقدي'}</td>
                  <td class="nowrap" style="text-align:center;">${c.orders || 0}</td>
                  <td class="nowrap" style="font-weight:700;">${formatNumber(cRev)}</td>
                  <td class="nowrap" style="color:#0f766e;font-weight:700;">${formatNumber(cCol)}</td>
                  <td class="nowrap" style="color:${cDue > 0 ? '#dc2626' : '#64748b'};font-weight:700;">${formatNumber(cDue)}</td>
                  <td class="nowrap" style="text-align:center;">${statusBadge}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <div style="min-width:0;overflow:hidden;">
        <div class="section-header">
          <span>3. توزيع بنود المصروفات التشغيلية</span>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>بند المصروف</th>
              <th>القيمة (ج.م)</th>
              <th style="text-align:center;">النسبة %</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>رواتب وأجور العمالة</td>
              <td class="nowrap" style="font-weight:700;">${formatNumber(summary.payroll_spent || 0)}</td>
              <td class="nowrap" style="text-align:center;">${totalSpent > 0 ? ((Number(summary.payroll_spent || 0) / totalSpent) * 100).toFixed(1) : 0}%</td>
            </tr>
            <tr>
              <td>خامات ومستلزمات الإنتاج</td>
              <td class="nowrap" style="font-weight:700;">${formatNumber(summary.materials_spent || 0)}</td>
              <td class="nowrap" style="text-align:center;">${totalSpent > 0 ? ((Number(summary.materials_spent || 0) / totalSpent) * 100).toFixed(1) : 0}%</td>
            </tr>
            <tr>
              <td>نثريات ومصروفات عامة</td>
              <td class="nowrap" style="font-weight:700;">${formatNumber(summary.extra_expenses_spent || summary.extra_spent || 0)}</td>
              <td class="nowrap" style="text-align:center;">${totalSpent > 0 ? ((Number(summary.extra_expenses_spent || summary.extra_spent || 0) / totalSpent) * 100).toFixed(1) : 0}%</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td>إجمالي المصروفات</td>
              <td class="nowrap">${formatNumber(totalSpent)}</td>
              <td style="text-align:center;">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- Official Approvals (3 Clean Signature Blocks) -->
    <div class="signatures-section">
      <div class="sign-card">
        <div class="sign-title">إعداد وتدقيق الحسابات</div>
        <div class="sign-line">التوقيع: .......................................</div>
      </div>
      <div class="sign-card">
        <div class="sign-title">المدير المالي والرقابة</div>
        <div class="sign-line">التوقيع: .......................................</div>
      </div>
      <div class="sign-card stamp-box">
        <div class="sign-title">اعتماد الإدارة العامة</div>
        <div class="stamp-seal">BLACK FOX APPROVED</div>
        <div class="sign-line">الختم والتاريخ المعتمد</div>
      </div>
    </div>

    <!-- Footer Note -->
    <div class="report-footer">
      <div>وثيقة مالية وتشغيلية رسمية صادرة من نظام Black Fox Factory Management System</div>
      <div>الصفحة 1 من 1</div>
    </div>
  </div>
</body>
</html>
  `;
};

/**
 * Build Production Pipeline & Quality Report HTML (A4 Landscape)
 */
export const buildProductionReportHtml = ({ data = {}, startDate = '', endDate = '' }) => {
  const summary = data.summary || {};
  const printShops = data.print_shops || [];
  const models = data.models || [];

  const totalCut = Number(summary.total_cut_units || 0);
  const totalDelivered = Number(summary.total_delivered_units || 0);
  const yieldRate = summary.yield_rate || (totalCut > 0 ? ((totalDelivered / totalCut) * 100).toFixed(1) : 0);
  const totalLoss = Math.max(0, totalCut - totalDelivered);
  const docRef = `BF-PROD-${startDate.replaceAll('-', '')}-${endDate.replaceAll('-', '')}`;

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>تقرير خط الإنتاج ومراحل التشغيل والجودة — بلاك فوكس</title>
  <style>${getBaseStyles()}</style>
</head>
<body>
  <div class="report-page">
    <!-- Header Banner -->
    <div class="header-banner">
      <div class="brand-group">
        ${BLACK_FOX_SVG_LOGO}
        <div class="brand-info">
          <h1>مصنع بلاك فوكس للملابس الجاهزة — BLACK FOX</h1>
          <div class="sub">إدارة العمليات الصناعية وضبط الجودة وخطوط الإنتاج</div>
        </div>
      </div>
      <div class="meta-group">
        <div>كود الوثيقة: <span class="meta-ref">${docRef}</span></div>
        <div>تاريخ الإصدار: ${new Date().toLocaleDateString('ar-EG')}</div>
      </div>
    </div>

    <!-- Title Section -->
    <div class="title-section">
      <div>
        <h2>تقرير خط الإنتاج ومسار المراحل ومعدلات الفقد والجودة</h2>
        <div class="subtitle">تتبع حركة القطع عبر المراحل الـ 4 (القص ➔ الفرز ➔ الطباعة ➔ التسليم النهائي)</div>
      </div>
      <div class="date-badge">
        الفترة: من ${startDate || '—'} إلى ${endDate || '—'}
      </div>
    </div>

    <!-- Executive KPI Grid (5 Cards in 1 Row) -->
    <div class="kpi-grid col-5">
      <div class="kpi-card dark">
        <div class="kpi-label">أوامر الإنتاج</div>
        <div class="kpi-value">${formatNumber(summary.total_orders || 0)} أوردر</div>
        <div class="kpi-desc">أوردرات التشغيل للفترة</div>
      </div>
      <div class="kpi-card green">
        <div class="kpi-label">القطع المقصوصة</div>
        <div class="kpi-value" style="color:#0284c7">${formatNumber(totalCut)} ق</div>
        <div class="kpi-desc">مخرجات مقصدار القماش</div>
      </div>
      <div class="kpi-card green">
        <div class="kpi-label">القطع المسلمة للعميل</div>
        <div class="kpi-value" style="color:#15803d">${formatNumber(totalDelivered)} ق</div>
        <div class="kpi-desc">منتجات سليمة مطابقة للجودة</div>
      </div>
      <div class="kpi-card ${Number(yieldRate) >= 98 ? 'green' : Number(yieldRate) >= 95 ? 'amber' : 'red'}">
        <div class="kpi-label">سلامة الإنتاج (Yield)</div>
        <div class="kpi-value" style="color:${Number(yieldRate) >= 98 ? '#15803d' : '#d97706'}">${yieldRate}%</div>
        <div class="kpi-desc">المعيار القياسي ≥ 98%</div>
      </div>
      <div class="kpi-card ${totalLoss > 0 ? 'red' : 'green'}">
        <div class="kpi-label">إجمالي الفاقد والهالك</div>
        <div class="kpi-value" style="color:${totalLoss > 0 ? '#dc2626' : '#15803d'}">${formatNumber(totalLoss)} ق</div>
        <div class="kpi-desc">عجز الفرز والطباعة</div>
      </div>
    </div>

    <!-- Clean 3-Card Operational Guide -->
    <div class="guide-container">
      <div class="guide-card green">
        <div class="guide-card-title">⚙️ معدل سلامة الإنتاج (Yield Rate):</div>
        <div class="guide-card-text">يحسب بالمعادلة <code>(القطع المسلمة ÷ القطع المقصوصة) × 100</code>. المستهدف الصناعي هو 98% فما فوق.</div>
      </div>
      <div class="guide-card green">
        <div class="guide-card-title">🔍 مسار المراحل الـ 4:</div>
        <div class="guide-card-text">تتبع إلزامي دقيق: (1. القص ➔ 2. الفرز ➔ 3. المطبعة الخارجية ➔ 4. التشطيب والتسليم) لضمان عدم ضياع أي قطعة.</div>
      </div>
      <div class="guide-card green">
        <div class="guide-card-title">⚠️ حدود الهالك المقبولة:</div>
        <div class="guide-card-text">أي مرحلة يتجاوز الفاقد فيها 2.0% تعتبر خارج الحدود المقبولة وتستوجب تطبيق غرامة تلف خامات ومحاسبة المشرف.</div>
      </div>
    </div>

    <!-- Table 1: Model-by-Model Quality Performance -->
    <div class="section-header">
      <span>1. أداء وجودة الموديلات والأصناف (Model Performance & Quality Matrix)</span>
      <span class="sub-info">تفصيل الكميات المقصوصة والمسلمة والعجز لكل صنف</span>
    </div>
    <table class="data-table">
      <thead>
        <tr>
          <th>رقم الموديل</th>
          <th>اسم الصنف / الموديل</th>
          <th style="text-align:center;">الأوردرات</th>
          <th>الكمية المقصوصة</th>
          <th>المفرزة</th>
          <th>المسلمة للعميل</th>
          <th>العجز / الهالك</th>
          <th style="text-align:center;">معدل الجودة</th>
          <th>القيمة المحققة (ج.م)</th>
        </tr>
      </thead>
      <tbody>
        ${models.length === 0 ? '<tr><td colspan="9" style="text-align:center;padding:10px;color:#94a3b8;">لا توجد موديلات مسجلة لهذه الفترة</td></tr>' : models.map(m => {
          const mCut = Number(m.cut_units || 0);
          const mDel = Number(m.delivered_units || 0);
          const mLoss = Number(m.loss_units || 0);
          const mRate = mCut > 0 ? ((mDel / mCut) * 100).toFixed(1) : '100.0';
          return `
            <tr>
              <td class="nowrap" style="font-weight:800;color:#1e40af;">${m.model_number || '—'}</td>
              <td class="nowrap" style="font-weight:600;">${m.model_name || 'صنف إنتاج'}</td>
              <td class="nowrap" style="text-align:center;">${m.orders || 1}</td>
              <td class="nowrap" style="color:#0284c7;font-weight:700;">${formatNumber(mCut)} ق</td>
              <td class="nowrap" style="color:#d97706;font-weight:600;">${formatNumber(m.sorted_units || 0)} ق</td>
              <td class="nowrap" style="color:#15803d;font-weight:800;">${formatNumber(mDel)} ق</td>
              <td class="nowrap" style="color:${mLoss > 0 ? '#dc2626' : '#64748b'};font-weight:700;">${formatNumber(mLoss)} ق</td>
              <td class="nowrap" style="text-align:center;">
                <span class="badge ${Number(mRate) >= 98 ? 'success' : Number(mRate) >= 95 ? 'warning' : 'danger'}">
                  ${mRate}%
                </span>
              </td>
              <td class="nowrap" style="font-weight:700;">${formatNumber(m.revenue || 0)}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2">الإجمالي العام لجميع الموديلات</td>
          <td style="text-align:center;">${models.reduce((s, m) => s + Number(m.orders || 1), 0)}</td>
          <td class="nowrap" style="color:#0284c7;">${formatNumber(models.reduce((s, m) => s + Number(m.cut_units || 0), 0))} ق</td>
          <td class="nowrap" style="color:#d97706;">${formatNumber(models.reduce((s, m) => s + Number(m.sorted_units || 0), 0))} ق</td>
          <td class="nowrap" style="color:#15803d;">${formatNumber(models.reduce((s, m) => s + Number(m.delivered_units || 0), 0))} ق</td>
          <td class="nowrap" style="color:#dc2626;">${formatNumber(models.reduce((s, m) => s + Number(m.loss_units || 0), 0))} ق</td>
          <td class="nowrap" style="text-align:center;">${yieldRate}%</td>
          <td class="nowrap">${formatNumber(models.reduce((s, m) => s + Number(m.revenue || 0), 0))}</td>
        </tr>
      </tfoot>
    </table>

    <!-- Table 2: Print Shops Quality Performance -->
    <div class="section-header">
      <span>2. جودة وأداء المطابع وورش التشغيل الخارجي (Print Shops & Outwork Quality)</span>
      <span class="sub-info">رصد القطع المحولة والمستلمة ونسبة الهالك</span>
    </div>
    <table class="data-table">
      <thead>
        <tr>
          <th>اسم المطبعة / الورشة</th>
          <th>بيانات التواصل</th>
          <th style="text-align:center;">الأوردرات</th>
          <th>القطع المحولة</th>
          <th>المستلم الفعلي</th>
          <th>العجز / الهالك</th>
          <th style="text-align:center;">نسبة الهالك %</th>
          <th style="text-align:center;">تقييم الجودة</th>
        </tr>
      </thead>
      <tbody>
        ${printShops.length === 0 ? '<tr><td colspan="8" style="text-align:center;padding:10px;color:#94a3b8;">لا توجد عمليات طباعة مسجلة</td></tr>' : printShops.map(p => {
          const pLossRate = Number(p.loss_rate || 0);
          const ratingBadge = pLossRate === 0
            ? '<span class="badge success">ممتاز (0%)</span>'
            : pLossRate <= 2
              ? '<span class="badge warning">مقبول (&le;2%)</span>'
              : '<span class="badge danger">مرتفع (&gt;2%)</span>';
          return `
            <tr>
              <td class="nowrap" style="font-weight:800;color:#0f172a;">🖨️ ${p.print_shop_name || '—'}</td>
              <td class="nowrap" style="color:#64748b;">${p.phone || '—'}</td>
              <td class="nowrap" style="text-align:center;">${p.orders || 0}</td>
              <td class="nowrap" style="color:#0284c7;font-weight:700;">${formatNumber(p.sent_units || 0)} ق</td>
              <td class="nowrap" style="color:#15803d;font-weight:700;">${formatNumber(p.received_units || 0)} ق</td>
              <td class="nowrap" style="color:${Number(p.loss_units) > 0 ? '#dc2626' : '#64748b'};font-weight:700;">${formatNumber(p.loss_units || 0)} ق</td>
              <td class="nowrap" style="text-align:center;font-weight:800;">${pLossRate.toFixed(1)}%</td>
              <td class="nowrap" style="text-align:center;">${ratingBadge}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>

    <!-- Official Approvals -->
    <div class="signatures-section">
      <div class="sign-card">
        <div class="sign-title">مشرف خط الإنتاج والتفصيل</div>
        <div class="sign-line">التوقيع: .......................................</div>
      </div>
      <div class="sign-card">
        <div class="sign-title">مسؤول مراقبة الجودة (QC)</div>
        <div class="sign-line">التوقيع: .......................................</div>
      </div>
      <div class="sign-card stamp-box">
        <div class="sign-title">اعتماد مدير المصنع</div>
        <div class="stamp-seal">BLACK FOX APPROVED</div>
        <div class="sign-line">الختم والتاريخ المعتمد</div>
      </div>
    </div>

    <!-- Footer Note -->
    <div class="report-footer">
      <div>تقرير مراقبة وضبط خطوط الإنتاج — Black Fox Factory Management System</div>
      <div>الصفحة 1 من 1</div>
    </div>
  </div>
</body>
</html>
  `;
};

/**
 * Build HR & Payroll Analytics Report HTML (A4 Landscape)
 */
export const buildHrReportHtml = ({ data = {}, startDate = '', endDate = '' }) => {
  const pr = data.payroll_summary || {};
  const history = data.payroll_history || [];
  const departments = data.by_department || [];
  const topHours = data.top_hours || [];

  const totalPayout = Number(pr.total_payout || 0);
  const paidPayout = Number(pr.paid_payout || 0);
  const pendingPayout = Math.max(0, totalPayout - paidPayout);
  const totalBonuses = Number(pr.total_bonuses || 0);
  const totalDeductions = Number(pr.total_deductions || 0);
  const docRef = `BF-HR-${startDate.replaceAll('-', '')}-${endDate.replaceAll('-', '')}`;

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>تقرير الموارد البشرية والرواتب — بلاك فوكس</title>
  <style>${getBaseStyles()}</style>
</head>
<body>
  <div class="report-page">
    <!-- Header Banner -->
    <div class="header-banner">
      <div class="brand-group">
        ${BLACK_FOX_SVG_LOGO}
        <div class="brand-info">
          <h1>مصنع بلاك فوكس للملابس الجاهزة — BLACK FOX</h1>
          <div class="sub">إدارة الموارد البشرية وشؤون العاملين وكشوف الأجور</div>
        </div>
      </div>
      <div class="meta-group">
        <div>كود الوثيقة: <span class="meta-ref">${docRef}</span></div>
        <div>تاريخ الإصدار: ${new Date().toLocaleDateString('ar-EG')}</div>
      </div>
    </div>

    <!-- Title Section -->
    <div class="title-section">
      <div>
        <h2>تقرير الرواتب ومستحقات العاملين ومؤشرات الحضور</h2>
        <div class="subtitle">بيان مستحقات الأجور وساعات العمل الإضافية والخصومات والبدلات</div>
      </div>
      <div class="date-badge">
        الفترة: من ${startDate || '—'} إلى ${endDate || '—'}
      </div>
    </div>

    <!-- Executive KPI Grid (5 Cards in 1 Row) -->
    <div class="kpi-grid col-5">
      <div class="kpi-card dark">
        <div class="kpi-label">إجمالي استحقاق الرواتب</div>
        <div class="kpi-value">${formatCurrency(totalPayout)}</div>
        <div class="kpi-desc">إجمالي مستحقات الأجور للفترة</div>
      </div>
      <div class="kpi-card green">
        <div class="kpi-label">الرواتب المسددة فعلياً</div>
        <div class="kpi-value" style="color:#15803d">${formatCurrency(paidPayout)}</div>
        <div class="kpi-desc">أجور مسلمة نقداً وتحويلاً</div>
      </div>
      <div class="kpi-card amber">
        <div class="kpi-label">مستحقات معلقة</div>
        <div class="kpi-value" style="color:#b45309">${formatCurrency(pendingPayout)}</div>
        <div class="kpi-desc">أجور قيد الصرف والمراجعة</div>
      </div>
      <div class="kpi-card purple">
        <div class="kpi-label">المكافآت والإضافي</div>
        <div class="kpi-value" style="color:#6d28d9">${formatCurrency(totalBonuses)}</div>
        <div class="kpi-desc">حوافز إنتاج وساعات إضافية</div>
      </div>
      <div class="kpi-card red">
        <div class="kpi-label">الخصومات والجزاءات</div>
        <div class="kpi-value" style="color:#dc2626">${formatCurrency(totalDeductions)}</div>
        <div class="kpi-desc">غياب + تأخير + سلف + جزاءات</div>
      </div>
    </div>

    <!-- Clean 3-Card Operational Guide -->
    <div class="guide-container">
      <div class="guide-card">
        <div class="guide-card-title">👥 معادلة احتساب صافي الراتب:</div>
        <div class="guide-card-text">صافي الراتب = الأساسي + (بدل الإضافي المحتسب + مكافآت الإدارة) - (خصومات التأخير والغياب + قسط السلفة + جزاءات الجودة).</div>
      </div>
      <div class="guide-card">
        <div class="guide-card-title">⏱️ ضبط ساعات العمل الإضافي:</div>
        <div class="guide-card-text">مقارنة ساعات الإضافي بإنتاجية القطع المنجزة للتحقق من كفاءة تشغيل الورديات الإضافية وتفادي الهدر في التكلفة.</div>
      </div>
      <div class="guide-card">
        <div class="guide-card-title">💳 انتظام سداد السلف:</div>
        <div class="guide-card-text">الاستقطاع التلقائي لأقساط السلف يحمي السيولة النقدية للخزينة ويمنع تراكم المديونيات على العمال.</div>
      </div>
    </div>

    <!-- Table 1: Monthly Payroll History -->
    <div class="section-header">
      <span>1. حركة صرف الرواتب الشهرية (Monthly Payroll History)</span>
      <span class="sub-info">متابعة المبالغ المسددة والمعلقة شهرياً</span>
    </div>
    <table class="data-table">
      <thead>
        <tr>
          <th>الشهر</th>
          <th style="text-align:center;">سجلات الموظفين</th>
          <th>الرواتب المسددة (ج.م)</th>
          <th>الرواتب المعلقة (ج.م)</th>
          <th>إجمالي المستحق (ج.م)</th>
          <th style="text-align:center;">نسبة الصرف %</th>
        </tr>
      </thead>
      <tbody>
        ${history.length === 0 ? '<tr><td colspan="6" style="text-align:center;padding:10px;color:#94a3b8;">لا توجد بيانات مسجلة</td></tr>' : history.map(r => {
          const rPaid = Number(r.paid_payout || 0);
          const rPend = Number(r.pending_payout || 0);
          const rTot = Number(r.total_payout || 0);
          const rRate = rTot > 0 ? ((rPaid / rTot) * 100).toFixed(0) : '0';
          return `
            <tr>
              <td class="nowrap" style="font-weight:800;color:#0f172a;">${r.name || '—'}</td>
              <td class="nowrap" style="text-align:center;">${r.total_records || r.paid_records || 0}</td>
              <td class="nowrap" style="color:#15803d;font-weight:700;">${formatNumber(rPaid)}</td>
              <td class="nowrap" style="color:#b45309;font-weight:700;">${formatNumber(rPend)}</td>
              <td class="nowrap" style="font-weight:800;color:#0f172a;">${formatNumber(rTot)}</td>
              <td class="nowrap" style="text-align:center;">
                <span class="badge ${Number(rRate) >= 90 ? 'success' : Number(rRate) >= 50 ? 'warning' : 'danger'}">
                  ${rRate}%
                </span>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
      <tfoot>
        <tr>
          <td>الإجمالي العام</td>
          <td style="text-align:center;">${history.reduce((s, r) => s + Number(r.total_records || r.paid_records || 0), 0)}</td>
          <td class="nowrap" style="color:#15803d;">${formatNumber(history.reduce((s, r) => s + Number(r.paid_payout || 0), 0))}</td>
          <td class="nowrap" style="color:#b45309;">${formatNumber(history.reduce((s, r) => s + Number(r.pending_payout || 0), 0))}</td>
          <td class="nowrap">${formatNumber(history.reduce((s, r) => s + Number(r.total_payout || 0), 0))}</td>
          <td class="nowrap" style="text-align:center;">${totalPayout > 0 ? ((paidPayout / totalPayout) * 100).toFixed(0) : 0}%</td>
        </tr>
      </tfoot>
    </table>

    <!-- Grid of 2 Balanced Tables: Department Attendance & Top Dedicated Employees -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start;">
      <div style="min-width:0;overflow:hidden;">
        <div class="section-header">
          <span>2. مؤشرات الحضور وساعات العمل حسب القسم</span>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>القسم</th>
              <th style="text-align:center;">أيام الحضور</th>
              <th style="text-align:center;">الغياب</th>
              <th>إجمالي الساعات</th>
            </tr>
          </thead>
          <tbody>
            ${departments.length === 0 ? '<tr><td colspan="4" style="text-align:center;color:#94a3b8;">لا توجد بيانات</td></tr>' : departments.map(d => `
              <tr>
                <td class="nowrap" style="font-weight:700;">${d.department || '—'}</td>
                <td class="nowrap" style="text-align:center;color:#15803d;font-weight:700;">${d.present || 0}</td>
                <td class="nowrap" style="text-align:center;color:#dc2626;font-weight:700;">${d.absent || 0}</td>
                <td class="nowrap" style="font-weight:700;">${Number(d.hours || 0).toFixed(1)} ساعة</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="min-width:0;overflow:hidden;">
        <div class="section-header">
          <span>3. أعلى الموظفين تسجيلاً لساعات العمل</span>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>اسم الموظف</th>
              <th style="text-align:center;">الأيام المسجلة</th>
              <th>إجمالي ساعات العمل</th>
            </tr>
          </thead>
          <tbody>
            ${topHours.length === 0 ? '<tr><td colspan="3" style="text-align:center;color:#94a3b8;">لا توجد بيانات</td></tr>' : topHours.map(e => `
              <tr>
                <td class="nowrap" style="font-weight:700;color:#0f172a;">${e.name || '—'}</td>
                <td class="nowrap" style="text-align:center;">${e.days_logged || 0} يوم</td>
                <td class="nowrap" style="color:#0284c7;font-weight:800;">${Number(e.total_hours || 0).toFixed(1)} ساعة</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Official Approvals -->
    <div class="signatures-section">
      <div class="sign-card">
        <div class="sign-title">مسؤول الموارد البشرية (HR)</div>
        <div class="sign-line">التوقيع: .......................................</div>
      </div>
      <div class="sign-card">
        <div class="sign-title">المحاسب المالي للرواتب</div>
        <div class="sign-line">التوقيع: .......................................</div>
      </div>
      <div class="sign-card stamp-box">
        <div class="sign-title">اعتماد الإدارة العامة</div>
        <div class="stamp-seal">BLACK FOX APPROVED</div>
        <div class="sign-line">الختم والتاريخ المعتمد</div>
      </div>
    </div>

    <!-- Footer Note -->
    <div class="report-footer">
      <div>كشف رواتب ومستحقات معتمد — مصنع بلاك فوكس للملابس الجاهزة</div>
      <div>الصفحة 1 من 1</div>
    </div>
  </div>
</body>
</html>
  `;
};

/**
 * Build Print Shops & Outwork Performance Report HTML (A4 Landscape)
 */
export const buildPrintShopsReportHtml = ({ data = {}, startDate = '', endDate = '' }) => {
  const summary = data.summary || {};
  const printShops = data.print_shops || [];
  const recentDispatches = data.recent_dispatches || [];

  const totalSent = Number(summary.total_sent_units || 0);
  const totalReceived = Number(summary.total_received_units || 0);
  const totalLoss = Number(summary.total_loss_units || 0);
  const lossRate = summary.loss_rate || (totalSent > 0 ? ((totalLoss / totalSent) * 100).toFixed(1) : 0);
  const docRef = `BF-SHOPS-${startDate.replaceAll('-', '')}-${endDate.replaceAll('-', '')}`;

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>تقرير المطابع والتشغيل الخارجي ونسب الهالك — بلاك فوكس</title>
  <style>${getBaseStyles()}</style>
</head>
<body>
  <div class="report-page">
    <!-- Header Banner -->
    <div class="header-banner">
      <div class="brand-group">
        ${BLACK_FOX_SVG_LOGO}
        <div class="brand-info">
          <h1>مصنع بلاك فوكس للملابس الجاهزة — BLACK FOX</h1>
          <div class="sub">إدارة التعهيد الخارجي ومراقبة جودة المطابع والتطريز</div>
        </div>
      </div>
      <div class="meta-group">
        <div>كود الوثيقة: <span class="meta-ref">${docRef}</span></div>
        <div>تاريخ الإصدار: ${new Date().toLocaleDateString('ar-EG')}</div>
      </div>
    </div>

    <!-- Title Section -->
    <div class="title-section">
      <div>
        <h2>تقرير أداء المطابع وجودة التشغيل الخارجي ونسب الهالك</h2>
        <div class="subtitle">رصد كميات القماش المحولة للمطابع، المستلم الفعلي، وحساب العجز والغرامات</div>
      </div>
      <div class="date-badge">
        الفترة: من ${startDate || '—'} إلى ${endDate || '—'}
      </div>
    </div>

    <!-- Executive KPI Grid (5 Cards in 1 Row) -->
    <div class="kpi-grid col-5">
      <div class="kpi-card dark">
        <div class="kpi-label">المطابع المعتمدة</div>
        <div class="kpi-value">${formatNumber(summary.total_shops || printShops.length || 0)} ورشة</div>
        <div class="kpi-desc">شركاء التشغيل الخارجي</div>
      </div>
      <div class="kpi-card green">
        <div class="kpi-label">أوردرات الطباعة</div>
        <div class="kpi-value">${formatNumber(summary.orders_with_print || 0)} أوردر</div>
        <div class="kpi-desc">أوامر محولة للمطابع</div>
      </div>
      <div class="kpi-card green">
        <div class="kpi-label">القطع المحولة</div>
        <div class="kpi-value" style="color:#0284c7">${formatNumber(totalSent)} ق</div>
        <div class="kpi-desc">بإذون خروج معتمدة</div>
      </div>
      <div class="kpi-card green">
        <div class="kpi-label">المستلم بعد الفحص</div>
        <div class="kpi-value" style="color:#15803d">${formatNumber(totalReceived)} ق</div>
        <div class="kpi-desc">قطع سليمة ومطابقة</div>
      </div>
      <div class="kpi-card ${Number(lossRate) > 2 ? 'red' : 'amber'}">
        <div class="kpi-label">عجز وهالك الطباعة</div>
        <div class="kpi-value" style="color:${Number(lossRate) > 2 ? '#dc2626' : '#d97706'}">${formatNumber(totalLoss)} ق (${lossRate}%)</div>
        <div class="kpi-desc">الحد المقبول &le; 2.0%</div>
      </div>
    </div>

    <!-- Clean 3-Card Operational Guide -->
    <div class="guide-container">
      <div class="guide-card">
        <div class="guide-card-title">🏭 تقييم واعتماد المطابع:</div>
        <div class="guide-card-text">ممتاز (الهالك &lt; 1%) | مقبول (1% - 2.5%) | مرفوض (&gt; 2.5%) يوجب إيقاف التوريد فوراً وتطبيق غرامة تلف خامات.</div>
      </div>
      <div class="guide-card">
        <div class="guide-card-title">📑 المطابقة الثنائية (Dual-Verification):</div>
        <div class="guide-card-text">مطابقة إذن خروج البضاعة الصادر من المصنع مع محضر استلام القطع وتوقيع مندوب المطبعة على محضر الفرز.</div>
      </div>
      <div class="guide-card">
        <div class="guide-card-title">🎨 ضبط جودة وثبات الألوان:</div>
        <div class="guide-card-text">إلزامية مطابقة العينة المختومة واختبار ثبات الأحبار بمقاومة الغسيل والشد قبل تحويل الدفعة لمرحلة التغليف.</div>
      </div>
    </div>

    <!-- Table 1: Print Shops Loss & Quality Scorecard -->
    <div class="section-header">
      <span>1. جدول تقييم جودة المطابع والتشغيل الخارجي (Vendor Loss Scorecard)</span>
      <span class="sub-info">رصد حجم التشغيل والفاقد ومعدل الكفاءة</span>
    </div>
    <table class="data-table">
      <thead>
        <tr>
          <th>اسم المطبعة</th>
          <th>بيانات الاتصال والمسؤول</th>
          <th style="text-align:center;">إجمالي الأوردرات</th>
          <th style="text-align:center;">جاري التشغيل</th>
          <th>القطع المحولة</th>
          <th>المستلم الفعلي</th>
          <th>العجز / الهالك</th>
          <th style="text-align:center;">نسبة الفقد %</th>
          <th style="text-align:center;">التقييم</th>
        </tr>
      </thead>
      <tbody>
        ${printShops.length === 0 ? '<tr><td colspan="9" style="text-align:center;padding:10px;color:#94a3b8;">لا توجد مطابع مسجلة</td></tr>' : printShops.map(ps => {
          const psLossRate = Number(ps.loss_rate || 0);
          const ratingBadge = psLossRate === 0
            ? '<span class="badge success">ممتاز</span>'
            : psLossRate <= 2
              ? '<span class="badge warning">مقبول</span>'
              : '<span class="badge danger">مرتفع الهالك</span>';
          return `
            <tr>
              <td class="nowrap" style="font-weight:800;color:#0f172a;">🖨️ ${ps.print_shop_name || '—'}</td>
              <td class="nowrap" style="color:#64748b;">${ps.phone || '—'} ${ps.contact_person ? `(${ps.contact_person})` : ''}</td>
              <td class="nowrap" style="text-align:center;">${ps.total_orders || 0}</td>
              <td class="nowrap" style="text-align:center;">${ps.active_orders > 0 ? `<span class="badge info">${ps.active_orders} جاري</span>` : '0'}</td>
              <td class="nowrap" style="color:#0284c7;font-weight:700;">${formatNumber(ps.sent_units || 0)} ق</td>
              <td class="nowrap" style="color:#15803d;font-weight:700;">${formatNumber(ps.received_units || 0)} ق</td>
              <td class="nowrap" style="color:${Number(ps.loss_units) > 0 ? '#dc2626' : '#64748b'};font-weight:700;">${formatNumber(ps.loss_units || 0)} ق</td>
              <td class="nowrap" style="text-align:center;font-weight:800;">${psLossRate.toFixed(1)}%</td>
              <td class="nowrap" style="text-align:center;">${ratingBadge}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2">الإجمالي العام لجميع المطابع</td>
          <td style="text-align:center;">${printShops.reduce((s, p) => s + Number(p.total_orders || 0), 0)}</td>
          <td style="text-align:center;">${printShops.reduce((s, p) => s + Number(p.active_orders || 0), 0)}</td>
          <td class="nowrap" style="color:#0284c7;">${formatNumber(totalSent)} ق</td>
          <td class="nowrap" style="color:#15803d;">${formatNumber(totalReceived)} ق</td>
          <td class="nowrap" style="color:#dc2626;">${formatNumber(totalLoss)} ق</td>
          <td class="nowrap" style="text-align:center;">${lossRate}%</td>
          <td></td>
        </tr>
      </tfoot>
    </table>

    <!-- Table 2: Recent Dispatches Log -->
    <div class="section-header">
      <span>2. سجل أحدث إذون وإرساليات الطباعة (Recent Printing Dispatches Log)</span>
      <span class="sub-info">متابعة مواعيد الإرسال والاستلام ومحاضر الفحص</span>
    </div>
    <table class="data-table">
      <thead>
        <tr>
          <th>رقم الأوردر / الموديل</th>
          <th>اسم الموديل</th>
          <th>المطبعة</th>
          <th>تاريخ الإرسال</th>
          <th>تاريخ الاستلام</th>
          <th style="text-align:center;">الكمية المرسلة</th>
          <th style="text-align:center;">الكمية المستلمة</th>
          <th style="text-align:center;">المرحلة الحالية</th>
        </tr>
      </thead>
      <tbody>
        ${recentDispatches.length === 0 ? '<tr><td colspan="8" style="text-align:center;padding:10px;color:#94a3b8;">لا توجد إذون خروج مسجلة</td></tr>' : recentDispatches.map(d => `
          <tr>
            <td class="nowrap" style="font-weight:800;color:#1e40af;">${d.order_number || d.model_number || '—'}</td>
            <td class="nowrap" style="font-weight:600;">${d.order_name || '—'}</td>
            <td class="nowrap">${d.print_shop_name || '—'}</td>
            <td class="nowrap" style="color:#64748b;">${d.print_sent_at ? new Date(d.print_sent_at).toLocaleDateString('ar-EG') : '—'}</td>
            <td class="nowrap" style="color:#64748b;">${d.print_received_at ? new Date(d.print_received_at).toLocaleDateString('ar-EG') : 'قيد التشغيل'}</td>
            <td class="nowrap" style="text-align:center;color:#0284c7;font-weight:700;">${formatNumber(d.total_print_sent_quantity || 0)} ق</td>
            <td class="nowrap" style="text-align:center;color:#15803d;font-weight:700;">${formatNumber(d.total_print_received_quantity || 0)} ق</td>
            <td class="nowrap" style="text-align:center;"><span class="badge neutral">${d.current_stage || '—'}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- Official Approvals -->
    <div class="signatures-section">
      <div class="sign-card">
        <div class="sign-title">مسؤول التعهيد والمطابع</div>
        <div class="sign-line">التوقيع: .......................................</div>
      </div>
      <div class="sign-card">
        <div class="sign-title">مشرف استلام الجودة والفحص</div>
        <div class="sign-line">التوقيع: .......................................</div>
      </div>
      <div class="sign-card stamp-box">
        <div class="sign-title">اعتماد الإدارة العامة</div>
        <div class="stamp-seal">BLACK FOX APPROVED</div>
        <div class="sign-line">الختم والتاريخ المعتمد</div>
      </div>
    </div>

    <!-- Footer Note -->
    <div class="report-footer">
      <div>وثيقة رقابة على التشغيل الخارجي — مصنع بلاك فوكس للملابس الجاهزة</div>
      <div>الصفحة 1 من 1</div>
    </div>
  </div>
</body>
</html>
  `;
};
