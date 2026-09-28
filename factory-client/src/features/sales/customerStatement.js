// Customer account statement: deliveries (debit) and payments (credit) in date
// order with a running balance. A positive balance means the customer owes us.

const day = (value) => String(value || '').slice(0, 10);

export const money = (value) => Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });

export const PAYMENT_STATUS_AR = {
  paid: 'مدفوع',
  invoiced: 'مدفوع جزئياً',
  partially_paid: 'مدفوع جزئياً',
  pending: 'غير مدفوع',
};

export const orderItems = (order) => {
  const items = Array.isArray(order?.items) ? order.items : [];
  return items.map((item) => ({
    product_name: item.product_name || item.name || '—',
    color: item.color || '',
    quantity: Number(item.quantity || 0),
    unit_price: Number(item.unit_price || 0),
    line_total: Number(item.line_total ?? (Number(item.quantity || 0) * Number(item.unit_price || 0))),
  }));
};

export const orderDescription = (order) => {
  const items = orderItems(order);
  if (!items.length) return `تسليم ${order.order_number || ''}`.trim();
  return items
    .map((i) => `${i.product_name}${i.color ? ` (${i.color})` : ''}: ${i.quantity.toLocaleString('en-US')} ق × ${money(i.unit_price)}`)
    .join(' · ');
};

/**
 * @param {{ orders: object[], payments: object[], from?: string, to?: string }} data
 * from/to are inclusive 'YYYY-MM-DD' strings; empty means open-ended.
 */
export const buildStatement = ({ orders = [], payments = [], from = '', to = '' }) => {
  const entries = [
    ...orders
      .filter((o) => o.status !== 'cancelled')
      .map((o) => ({
        key: `o-${o.id}`,
        date: day(o.order_date || o.delivery_date || o.created_at),
        type: 'delivery',
        ref: o.order_number || `#${o.id}`,
        description: orderDescription(o),
        debit: Number(o.total_amount || 0),
        credit: 0,
        sort: 0,
        id: Number(o.id),
      })),
    ...payments.map((p) => ({
      key: `p-${p.id}`,
      date: day(p.payment_date),
      type: 'payment',
      ref: p.reference_number || '',
      description: p.notes ? `دفعة — ${p.notes}` : 'دفعة',
      debit: 0,
      credit: Number(p.amount || 0),
      sort: 1,
      id: Number(p.id),
    })),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.sort - b.sort || a.id - b.id));

  let opening = 0;
  const rows = [];
  let running = 0;
  let totalDebit = 0;
  let totalCredit = 0;
  for (const e of entries) {
    if (from && e.date < from) {
      opening += e.debit - e.credit;
      continue;
    }
    if (to && e.date > to) continue;
    if (!rows.length) running = opening;
    running += e.debit - e.credit;
    totalDebit += e.debit;
    totalCredit += e.credit;
    rows.push({ ...e, balance: running });
  }
  const closing = rows.length ? running : opening;
  return { opening, rows, totalDebit, totalCredit, closing };
};

export const balanceLabel = (balance) => {
  if (balance > 0.005) return `عليه ${money(balance)} ج.م`;
  if (balance < -0.005) return `له ${money(-balance)} ج.م`;
  return 'صفر';
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const buildStatementPrintHtml = ({ customer, statement, from, to }) => {
  const period = from || to ? `من ${from || 'البداية'} إلى ${to || 'اليوم'}` : 'كل الفترات';
  const rows = statement.rows.map((r) => `
    <tr>
      <td class="nowrap">${esc(r.date)}</td>
      <td>${r.type === 'delivery' ? 'تسليم' : 'دفعة'}${r.ref ? ` <span class="muted">${esc(r.ref)}</span>` : ''}</td>
      <td>${esc(r.description)}</td>
      <td class="num">${r.debit ? money(r.debit) : ''}</td>
      <td class="num">${r.credit ? money(r.credit) : ''}</td>
      <td class="num strong">${esc(balanceLabel(r.balance))}</td>
    </tr>`).join('');
  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8" />
<title>كشف حساب — ${esc(customer?.name)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color: #111; font-size: 12px; }
  h1 { font-size: 20px; margin: 0; }
  .head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 12px; }
  .muted { color: #666; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: right; vertical-align: top; }
  th { background: #f2f2f2; }
  .num { text-align: left; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .nowrap { white-space: nowrap; }
  .strong { font-weight: 700; }
  .total td { background: #f7f7f7; font-weight: 700; }
  .closing { margin-top: 14px; font-size: 15px; font-weight: 800; }
</style></head>
<body>
  <div class="head">
    <div><h1>BLACK FOX — كشف حساب عميل</h1><div class="muted">${esc(period)}</div></div>
    <div style="text-align:left">
      <div class="strong">${esc(customer?.name)}</div>
      ${customer?.phone ? `<div class="muted">${esc(customer.phone)}</div>` : ''}
      <div class="muted">تاريخ الطباعة: ${new Date().toLocaleDateString('en-GB')}</div>
    </div>
  </div>
  <table>
    <thead><tr><th>التاريخ</th><th>النوع</th><th>البيان</th><th>عليه (ج.م)</th><th>له (ج.م)</th><th>الرصيد</th></tr></thead>
    <tbody>
      <tr class="total"><td colspan="5">رصيد أول المدة</td><td class="num">${esc(balanceLabel(statement.opening))}</td></tr>
      ${rows || '<tr><td colspan="6" class="muted">لا توجد حركات في هذه الفترة</td></tr>'}
      <tr class="total"><td colspan="3">إجمالي الفترة</td><td class="num">${money(statement.totalDebit)}</td><td class="num">${money(statement.totalCredit)}</td><td></td></tr>
    </tbody>
  </table>
  <div class="closing">الرصيد الختامي: ${esc(balanceLabel(statement.closing))}</div>
</body></html>`;
};
