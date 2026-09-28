import { buildStatement, balanceLabel, orderDescription, buildStatementPrintHtml } from './customerStatement';

const orders = [
  { id: 2, order_number: 'SO-2', order_date: '2026-09-10', status: 'new', total_amount: '1000.00',
    items: [{ product_name: '6226 - زنط', color: '4 الوان', quantity: 40, unit_price: '25.00' }] },
  { id: 1, order_number: 'SO-1', order_date: '2026-09-01', status: 'new', total_amount: '500.00', items: [] },
  { id: 3, order_number: 'SO-3', order_date: '2026-09-15', status: 'cancelled', total_amount: '999.00', items: [] },
];
const payments = [
  { id: 7, payment_date: '2026-09-10', amount: '300.00', notes: 'كاش' },
  { id: 8, payment_date: '2026-09-20', amount: '1500.00', notes: '' },
];

describe('buildStatement', () => {
  test('orders are debits, payments credits, in date order with a running balance', () => {
    const s = buildStatement({ orders, payments });
    expect(s.rows.map((r) => [r.date, r.type, r.balance])).toEqual([
      ['2026-09-01', 'delivery', 500],
      ['2026-09-10', 'delivery', 1500],
      ['2026-09-10', 'payment', 1200],
      ['2026-09-20', 'payment', -300],
    ]);
    expect(s.opening).toBe(0);
    expect(s.totalDebit).toBe(1500);
    expect(s.totalCredit).toBe(1800);
    expect(s.closing).toBe(-300);
  });

  test('cancelled orders are ignored', () => {
    expect(buildStatement({ orders, payments }).rows.some((r) => r.ref === 'SO-3')).toBe(false);
  });

  test('a date range carries earlier movements into the opening balance', () => {
    const s = buildStatement({ orders, payments, from: '2026-09-10', to: '2026-09-15' });
    expect(s.opening).toBe(500);
    expect(s.rows.map((r) => r.balance)).toEqual([1500, 1200]);
    expect(s.closing).toBe(1200);
  });

  test('an empty range keeps the opening balance as closing', () => {
    const s = buildStatement({ orders, payments, from: '2026-10-01' });
    expect(s.rows).toHaveLength(0);
    expect(s.closing).toBe(-300);
  });
});

test('balance labels say who owes whom', () => {
  expect(balanceLabel(1200)).toBe('عليه 1,200 ج.م');
  expect(balanceLabel(-300)).toBe('له 300 ج.م');
  expect(balanceLabel(0)).toBe('صفر');
});

test('delivery description lists model, color, quantity and price', () => {
  expect(orderDescription(orders[0])).toBe('6226 - زنط (4 الوان): 40 ق × 25');
});

test('printable statement escapes text and shows the closing balance', () => {
  const html = buildStatementPrintHtml({
    customer: { name: 'A <b>', phone: '010' },
    statement: buildStatement({ orders, payments }),
  });
  expect(html).toContain('A &lt;b&gt;');
  expect(html).toContain('الرصيد الختامي: له 300 ج.م');
});
