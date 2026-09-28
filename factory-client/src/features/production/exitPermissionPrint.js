/**
 * Print utility for Exit Permission (إذن خروج بضاعة / خامات)
 * Generates an executive A4 printable document with Black Fox official branding.
 */

import { getOrderDisplayNumber, getOrderProductName } from './productionOrderDisplay';

const escapeHtml = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
};

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
    documentRef: `BF-EP-${orderNum}-${dateStamp}`,
  };
};

const formatColorName = (val) => {
  if (!val) return '—';
  return String(val)
    .replace(/([\u0600-\u06FF])([a-zA-Z])/g, '$1 / $2')
    .replace(/([a-zA-Z])([\u0600-\u06FF])/g, '$1 / $2')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
};

const writeAndPrint = (doc, win, html) => {
  doc.open();
  doc.write(html);
  doc.close();

  const triggerPrint = () => {
    try {
      win.print();
    } catch (e) {
      console.warn('Silent print blocked by browser sandbox:', e);
    }
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
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';

  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument || win?.document;

  if (!win || !doc) {
    iframe.remove();
    return false;
  }

  const cleanup = () => {
    setTimeout(() => {
      try {
        iframe.remove();
      } catch {
        // Ignored
      }
    }, 1500);
  };

  win.addEventListener('afterprint', cleanup, { once: true });

  try {
    writeAndPrint(doc, win, html);
    return true;
  } catch {
    cleanup();
    return false;
  }
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
}) => {
  if (!globalThis.window || !globalThis.document?.body) return;

  const isArabic = true; // Force Arabic language for official factory printout
  const labels = {
    brand: 'BLACK FOX',
    brandSub: 'مصنع بلاك فوكس للملابس الجاهزة — إدارة العمليات والرقابة الصناعية',
    title: 'إذن خروج وتوريد خامات / منتجات',
    subtitle: 'وثيقة تفويض رسمي معتمدة — بعد إتمام مرحلة الفرز والتجهيز للتعهيد الخارجي',
    badge: 'مصرح رسمي للتعهيد والمطابع',
    docRef: 'رقم الإذن والوثيقة',
    orderNumber: 'رقم أمر الإنتاج',
    productNumber: 'رقم الموديل',
    productName: 'اسم الصنف / الموديل',
    sortingQty: 'الكمية المعتمدة بعد الفرز',
    colorBreakdown: 'تفصيل الألوان والكميات',
    colorQty: 'الكمية المصرح بها',
    employee: 'الموظف المسؤول عن التجهيز',
    issueDate: 'تاريخ وساعة الإصدار',
    preparedBy: 'المسؤول عن الإعداد والتسليم',
    approvedBy: 'اعتماد إدارة المصنع والرقابة',
    footer: 'هذه الوثيقة تفويض رسمي ومستند قانوني معتمد لنقل وإخراج الخامات والأصناف المذكورة أعلاه.',
  };

  const issueDate = completedAt
    ? new Date(completedAt).toLocaleString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    : new Date().toLocaleString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const ref = documentRef || `BF-EP-${orderNumber || modelNumber || 'ORD'}-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`;

  const colors = Array.isArray(colorBreakdown) ? colorBreakdown : [];

  const html = `<!DOCTYPE html>
<html lang="${isArabic ? 'ar' : 'en'}" dir="${isArabic ? 'rtl' : 'ltr'}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(labels.title)} — ${escapeHtml(orderNumber)}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      margin: 0;
      padding: 0;
      color: #0f172a;
      background: #fff;
      font-size: 13px;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      max-width: 210mm;
      margin: 0 auto;
      padding: 6mm 8mm;
    }
    .top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 14px;
      border-bottom: 3px solid #0f172a;
      margin-bottom: 16px;
    }
    .brand-block {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .brand-text {
      border-right: 2px solid #e2e8f0;
      padding-right: 14px;
    }
    .brand-title {
      font-size: 19px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.01em;
    }
    .brand-sub {
      margin-top: 2px;
      font-size: 11px;
      color: #475569;
      font-weight: 600;
    }
    .meta-block {
      text-align: left;
      min-width: 200px;
    }
    .meta-badge {
      display: inline-block;
      background: #1e293b;
      color: #fff;
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 800;
      margin-bottom: 6px;
    }
    .meta-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #64748b;
      font-weight: 700;
    }
    .meta-value {
      font-size: 13px;
      font-weight: 800;
      font-family: 'Consolas', monospace;
      color: #2563eb;
      margin-top: 1px;
      margin-bottom: 4px;
    }
    .title-banner {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-right: 4px solid #2563eb;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 18px;
      display: flex;
      justifyContent: space-between;
      align-items: center;
    }
    .title-banner h1 {
      margin: 0;
      font-size: 17px;
      font-weight: 800;
      color: #0f172a;
    }
    .title-banner .subtitle {
      margin: 3px 0 0;
      color: #475569;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-pill {
      background: #dbeafe;
      color: #1e40af;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
    }
    .details-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 18px;
    }
    .detail-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px 12px;
      background: #ffffff;
    }
    .detail-card.primary {
      border-top: 3px solid #2563eb;
    }
    .detail-card.dark {
      border-top: 3px solid #0f172a;
    }
    .detail-card.success {
      border-top: 3px solid #16a34a;
      background: #f8fafc;
    }
    .detail-card.info {
      border-top: 3px solid #0284c7;
    }
    .detail-label {
      font-size: 10px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
    }
    .detail-val {
      font-size: 15px;
      font-weight: 900;
      color: #0f172a;
      margin-top: 4px;
    }
    .detail-val.large {
      font-size: 18px;
      color: #15803d;
    }
    table.breakdown {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      border: 1px solid #cbd5e1;
      font-size: 12px;
    }
    table.breakdown th {
      background: #0f172a;
      color: #ffffff;
      padding: 9px 12px;
      font-weight: 800;
      text-align: right;
      border-bottom: 2px solid #334155;
    }
    table.breakdown td {
      border: 1px solid #e2e8f0;
      padding: 8px 12px;
      color: #0f172a;
    }
    table.breakdown tr:nth-child(even) td {
      background: #f8fafc;
    }
    table.breakdown td.qty {
      font-weight: 800;
      text-align: center;
      color: #1e40af;
      font-size: 13px;
    }
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
      margin-top: 26px;
      padding-top: 18px;
      border-top: 2px dashed #cbd5e1;
    }
    .sign-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 14px;
      background: #f8fafc;
      text-align: center;
      font-size: 12px;
    }
    .sign-card.stamp-box {
      background: #fff;
      border: 1px solid #cbd5e1;
    }
    .sign-title {
      font-size: 11px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 35px;
    }
    .sign-line {
      border-top: 1px dashed #94a3b8;
      padding-top: 6px;
      font-size: 11px;
      color: #475569;
    }
    .stamp-seal {
      display: inline-block;
      border: 2px solid #2563eb;
      border-radius: 50%;
      padding: 5px 10px;
      color: #2563eb;
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin: 4px auto 6px;
      transform: rotate(-3deg);
    }
    .footer-note {
      margin-top: 22px;
      padding-top: 10px;
      border-top: 1px solid #f1f5f9;
      font-size: 10px;
      color: #94a3b8;
      display: flex;
      justifyContent: space-between;
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
        <!-- Modern Fox Logo SVG -->
        <svg width="44" height="44" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bfGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#2563eb" />
              <stop offset="100%" stop-color="#1d4ed8" />
            </linearGradient>
            <linearGradient id="bfGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#38bdf8" />
              <stop offset="100%" stop-color="#2563eb" />
            </linearGradient>
            <linearGradient id="bfGrad3" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#1e293b" />
              <stop offset="100%" stop-color="#0f172a" />
            </linearGradient>
          </defs>
          <polygon points="50,48 20,8 14,38" fill="url(#bfGrad3)" />
          <polygon points="50,48 20,8 30,38" fill="url(#bfGrad1)" />
          <polygon points="50,48 80,8 86,38" fill="url(#bfGrad3)" />
          <polygon points="50,48 80,8 70,38" fill="url(#bfGrad1)" />
          <polygon points="50,22 62,38 50,54 38,38" fill="url(#bfGrad2)" />
          <polygon points="50,54 38,38 12,52 32,74" fill="url(#bfGrad1)" />
          <polygon points="50,54 62,38 88,52 68,74" fill="url(#bfGrad1)" />
          <polygon points="12,52 32,74 22,78" fill="url(#bfGrad3)" />
          <polygon points="88,52 68,74 78,78" fill="url(#bfGrad3)" />
          <polygon points="50,54 32,74 50,92" fill="#ffffff" fill-opacity="0.95" />
          <polygon points="50,54 68,74 50,92" fill="#e2e8f0" />
          <polygon points="50,86 44,92 56,92" fill="#0f172a" />
          <polygon points="36,54 44,57 40,61" fill="#f59e0b" />
          <polygon points="64,54 56,57 60,61" fill="#f59e0b" />
        </svg>
        <div class="brand-text">
          <div class="brand-title">مصنع بلاك فوكس للملابس الجاهزة</div>
          <div class="brand-sub">${escapeHtml(labels.brandSub)}</div>
        </div>
      </div>
      <div class="meta-block">
        <div class="meta-badge">${escapeHtml(labels.title)}</div>
        <div class="meta-label">${escapeHtml(labels.docRef)}</div>
        <div class="meta-value">${escapeHtml(ref)}</div>
        <div class="meta-label">${escapeHtml(labels.issueDate)}</div>
        <div style="font-size:11px;color:#64748b;margin-top:1px;">${escapeHtml(issueDate)}</div>
      </div>
    </div>

    <div class="title-banner">
      <div>
        <h1>${escapeHtml(labels.title)} — ${escapeHtml(orderNumber)}</h1>
        <div class="subtitle">${escapeHtml(labels.subtitle)}</div>
      </div>
      <div class="badge-pill">${escapeHtml(labels.badge)}</div>
    </div>

    <div class="details-grid">
      <div class="detail-card primary">
        <div class="detail-label">${escapeHtml(labels.orderNumber)}</div>
        <div class="detail-val">${escapeHtml(orderNumber)}</div>
      </div>
      <div class="detail-card dark">
        <div class="detail-label">${escapeHtml(labels.productNumber)}</div>
        <div class="detail-val">${escapeHtml(modelNumber || '—')}</div>
      </div>
      <div class="detail-card info">
        <div class="detail-label">${escapeHtml(labels.productName)}</div>
        <div class="detail-val" style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(productName || '—')}</div>
      </div>
      <div class="detail-card success">
        <div class="detail-label">${escapeHtml(labels.sortingQty)}</div>
        <div class="detail-val large">${Number(sortingQuantity || 0).toLocaleString()} <span style="font-size:11px;font-weight:600">قطعة</span></div>
      </div>
    </div>

    ${colors.length > 0 ? `
    <table class="breakdown">
      <thead>
        <tr>
          <th style="width: 40px; text-align: center;">#</th>
          <th>${escapeHtml(labels.colorBreakdown)}</th>
          <th style="width: 140px; text-align: center;">${escapeHtml(labels.colorQty)}</th>
          <th>ملاحظات الفحص والمطابقة</th>
        </tr>
      </thead>
      <tbody>
        ${colors.map((c, i) => `
          <tr>
            <td style="text-align: center; color: #64748b;">${i + 1}</td>
            <td style="font-weight: 800;">${escapeHtml(formatColorName(c.color || c.name))}</td>
            <td class="qty">${Number(c.quantity || c.qty || 0).toLocaleString()} قطعة</td>
            <td style="color: #64748b; font-size: 11px;">${escapeHtml(c.notes || 'مطابق للمواصفات')}</td>
          </tr>
        `).join('')}
      </tbody>
      <tfoot>
        <tr style="background:#f1f5f9;font-weight:900;">
          <td colspan="2" style="padding:10px 12px;font-size:13px;">الإجمالي الكلي بعد الفرز</td>
          <td style="text-align:center;color:#1e40af;font-size:14px;padding:10px 12px;">${Number(sortingQuantity || 0).toLocaleString()} قطعة</td>
          <td></td>
        </tr>
      </tfoot>
    </table>
    ` : ''}

    <div class="signatures">
      <div class="sign-card">
        <div class="sign-title">${escapeHtml(labels.preparedBy)}</div>
        <div class="sign-line">الاسم: ${escapeHtml(employeeName || '...............................')}</div>
      </div>
      <div class="sign-card">
        <div class="sign-title">توقيع المستلم / السائق</div>
        <div class="sign-line">الاسم: .......................................</div>
      </div>
      <div class="sign-card stamp-box">
        <div class="sign-title">${escapeHtml(labels.approvedBy)}</div>
        <div class="stamp-seal">BLACK FOX APPROVED</div>
        <div class="sign-line">الختم والتاريخ المعتمد</div>
      </div>
    </div>

    <div class="footer-note">
      <div>${escapeHtml(labels.footer)}</div>
      <div>Black Fox Factory Management — Page 1 of 1</div>
    </div>
  </div>
</body>
</html>`;

  if (!printViaIframe(html)) {
    printViaPopup(html);
  }
};
