import { getOrderDisplayNumber, getOrderProductName } from './productionOrderDisplay';

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

export const orderHasSortingPhase = (order) => (
  order?.phases?.sorting !== null && order?.phases?.sorting !== undefined
);

export const buildExitPermissionPayload = (order, sortingPhase, employeeName, completedAt, productNameById = {}) => {
  const orderNum = getOrderDisplayNumber(order);
  const when = completedAt ? new Date(completedAt) : new Date();
  const dateStamp = when.toISOString().slice(0, 10).replaceAll('-', '');
  const sortingQuantity = sortingPhase?.quantity ?? order?.phases?.sorting ?? '';
  const colorBreakdown = Array.isArray(sortingPhase?.color_breakdown) ? sortingPhase.color_breakdown : [];
  return {
    orderNumber: orderNum,
    modelNumber: orderNum,
    productName: getOrderProductName(order, productNameById),
    sortingQuantity,
    colorBreakdown,
    inputQuantity: order?.phases?.input ?? order?.planned_quantity ?? '',
    employeeName: employeeName || '—',
    completedAt: when.toISOString(),
    documentRef: `EP-${orderNum}-${dateStamp}`,
  };
};

const writeAndPrint = (doc, win, html) => {
  doc.open();
  doc.write(html);
  doc.close();

  const triggerPrint = () => {
    win.focus();
    win.print();
  };

  if (doc.readyState === 'complete') {
    setTimeout(triggerPrint, 300);
  } else {
    win.addEventListener('load', () => setTimeout(triggerPrint, 300), { once: true });
  }
};

const printViaIframe = (html) => {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'exit-permission-print');
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '0',
    height: '0',
    border: '0',
    visibility: 'hidden',
  });

  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument || win?.document;
  if (!doc || !win) {
    iframe.remove();
    return false;
  }

  const cleanup = () => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  };

  win.addEventListener('afterprint', cleanup, { once: true });
  setTimeout(cleanup, 120000);

  writeAndPrint(doc, win, html);
  return true;
};

const printViaPopup = (html) => {
  const printWindow = globalThis.window.open('', '_blank');
  if (!printWindow) return false;

  try {
    writeAndPrint(printWindow.document, printWindow, html);
    return true;
  } catch {
    printWindow.close();
    return false;
  }
};

export const printExitPermission = ({
  orderNumber,
  modelNumber,
  productName,
  sortingQuantity,
  colorBreakdown = [],
  employeeName,
  completedAt,
  documentRef,
  language = 'ar', // Default to Arabic as requested
}) => {
  if (!globalThis.window || !globalThis.document?.body) return;

  const isArabic = true; // Force Arabic language for the print layout
  const labels = {
    brand: 'Black Fox',
    brandSub: 'نظام إدارة المصنع',
    title: 'إذن خروج مواد',
    subtitle: 'وثيقة رسمية — بعد إتمام مرحلة الفرز للتعهيد الخارجي',
    badge: 'مصرح للتعهيد',
    docRef: 'رقم الوثيقة',
    orderNumber: 'رقم أمر الإنتاج',
    productNumber: 'رقم المنتج',
    productName: 'اسم المنتج',
    sortingQty: 'الكمية بعد الفرز',
    colorBreakdown: 'تفصيل الألوان',
    colorQty: 'الكمية',
    employee: 'الموظف المسؤول',
    issueDate: 'تاريخ الإصدار',
    preparedBy: 'أُعد بواسطة',
    approvedBy: 'اعتماد الإدارة',
    footer: 'هذه الوثيقة تفويض رسمي لإخراج المنتجات المفرزة إلى مصنع شريك خارجي.',
  };

  const issueDate = completedAt
    ? new Date(completedAt).toLocaleString(isArabic ? 'ar-EG' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
    : new Date().toLocaleString(isArabic ? 'ar-EG' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

  const ref = documentRef || `EP-${orderNumber}-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`;

  const html = `<!DOCTYPE html>
<html lang="${isArabic ? 'ar' : 'en'}" dir="${isArabic ? 'rtl' : 'ltr'}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(labels.title)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      font-family: ${isArabic ? "'Segoe UI', Tahoma, Arial, sans-serif" : "'Segoe UI', 'Helvetica Neue', Arial, sans-serif"};
      margin: 0;
      padding: 0;
      color: #1a1a1a;
      background: #fff;
      font-size: 13px;
      line-height: 1.45;
    }
    .page {
      max-width: 210mm;
      min-height: 277mm;
      margin: 0 auto;
      padding: 10mm 12mm 12mm;
      border: 1px solid #d0d0d0;
    }
    .top-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      padding-bottom: 14px;
      border-bottom: 3px solid #0f766e;
      margin-bottom: 18px;
    }
    .brand-block { flex: 1; }
    .brand {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 0.14em;
      color: #0f766e;
      text-transform: uppercase;
    }
    .brand-sub {
      margin-top: 4px;
      font-size: 11px;
      color: #666;
      letter-spacing: 0.04em;
    }
    .meta-block {
      text-align: ${isArabic ? 'left' : 'right'};
      min-width: 180px;
    }
    .meta-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #888;
      font-weight: 700;
    }
    .meta-value {
      font-size: 13px;
      font-weight: 700;
      font-family: 'Consolas', 'Courier New', monospace;
      margin-top: 2px;
      margin-bottom: 10px;
    }
    .title-row {
      text-align: center;
      margin: 8px 0 20px;
    }
    .badge {
      display: inline-block;
      padding: 5px 14px;
      border-radius: 999px;
      background: #ecfdf5;
      color: #0f766e;
      border: 1px solid #99f6e4;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    h1 {
      margin: 0 0 6px;
      font-size: 26px;
      font-weight: 700;
      color: #111;
    }
    .subtitle {
      margin: 0;
      color: #555;
      font-size: 13px;
    }
    table.details {
      width: 100%;
      border-collapse: collapse;
      margin: 0 0 22px;
      border: 1px solid #ccc;
    }
    table.details th,
    table.details td {
      border: 1px solid #ddd;
      padding: 11px 14px;
      vertical-align: top;
    }
    table.details th {
      width: 34%;
      background: #f7f7f7;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #555;
      font-weight: 700;
      text-align: ${isArabic ? 'right' : 'left'};
    }
    table.details td {
      font-size: 16px;
      font-weight: 700;
      color: #111;
    }
    table.details td.highlight {
      font-size: 20px;
      color: #0f766e;
    }
    table.breakdown {
      width: 100%;
      border-collapse: collapse;
      margin: -6px 0 22px;
      border: 1px solid #ccc;
    }
    table.breakdown th,
    table.breakdown td {
      border: 1px solid #ddd;
      padding: 8px 10px;
      font-size: 12px;
      text-align: start;
    }
    table.breakdown th {
      background: #f7f7f7;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #555;
      font-weight: 700;
    }
    table.breakdown td.qty {
      font-weight: 700;
      text-align: center;
      font-family: 'Consolas', 'Courier New', monospace;
    }
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 28px;
      margin-top: 36px;
    }
    .sign-card {
      border: 1px solid #ccc;
      border-radius: 6px;
      padding: 14px;
      min-height: 110px;
    }
    .sign-title {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #666;
      font-weight: 700;
      margin-bottom: 52px;
    }
    .sign-line {
      border-top: 1px solid #333;
      padding-top: 8px;
      font-size: 12px;
      color: #444;
    }
    .footer-note {
      margin-top: 28px;
      padding-top: 12px;
      border-top: 1px dashed #bbb;
      font-size: 11px;
      color: #666;
      text-align: center;
    }
    @media print {
      body { background: #fff; }
      .page { border: none; max-width: none; min-height: auto; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="top-bar">
      <div class="brand-block">
        <div class="brand">${escapeHtml(labels.brand)}</div>
        <div class="brand-sub">${escapeHtml(labels.brandSub)}</div>
      </div>
      <div class="meta-block">
        <div class="meta-label">${escapeHtml(labels.docRef)}</div>
        <div class="meta-value">${escapeHtml(ref)}</div>
        <div class="meta-label">${escapeHtml(labels.issueDate)}</div>
        <div class="meta-value" style="font-family:inherit;font-size:12px">${escapeHtml(issueDate)}</div>
      </div>
    </div>

    <div class="title-row">
      <div class="badge">${escapeHtml(labels.badge)}</div>
      <h1>${escapeHtml(labels.title)}</h1>
      <p class="subtitle">${escapeHtml(labels.subtitle)}</p>
    </div>

    <table class="details">
      <tr>
        <th>${escapeHtml(labels.orderNumber)}</th>
        <td class="highlight">${escapeHtml(orderNumber)}</td>
      </tr>
      <tr>
        <th>${escapeHtml(labels.productNumber)}</th>
        <td>${escapeHtml(modelNumber)}</td>
      </tr>
      <tr>
        <th>${escapeHtml(labels.productName)}</th>
        <td>${escapeHtml(productName)}</td>
      </tr>
      <tr>
        <th>${escapeHtml(labels.sortingQty)}</th>
        <td class="highlight">${escapeHtml(sortingQuantity)}</td>
      </tr>
      <tr>
        <th>${escapeHtml(labels.employee)}</th>
        <td>${escapeHtml(employeeName || '—')}</td>
      </tr>
    </table>

    ${colorBreakdown.length ? `
      <table class="breakdown">
        <tr>
          <th>${escapeHtml(labels.colorBreakdown)}</th>
          <th style="width: 28%">${escapeHtml(labels.colorQty)}</th>
        </tr>
        ${colorBreakdown.map((row) => `
          <tr>
            <td>${escapeHtml(row?.color || '—')}</td>
            <td class="qty">${escapeHtml(row?.quantity ?? '')}</td>
          </tr>
        `).join('')}
      </table>
    ` : ''}

    <div class="signatures">
      <div class="sign-card">
        <div class="sign-title">${escapeHtml(labels.preparedBy)}</div>
        <div class="sign-line">${escapeHtml(employeeName || '')}</div>
      </div>
      <div class="sign-card">
        <div class="sign-title">${escapeHtml(labels.approvedBy)}</div>
        <div class="sign-line">&nbsp;</div>
      </div>
    </div>

    <div class="footer-note">${escapeHtml(labels.footer)}</div>
  </div>
</body>
</html>`;

  if (!printViaIframe(html)) {
    printViaPopup(html);
  }
};
