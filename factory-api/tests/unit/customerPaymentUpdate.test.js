const salesService = require('../../src/services/salesService');
const salesRepository = require('../../src/repositories/salesRepository');
const accountingService = require('../../src/services/accountingService');
const auditService = require('../../src/services/auditService');
const pool = require('../../src/db/pool');

describe('Customer Payment Update and Delete Unit Tests', () => {
  let mockClient;
  let queryLog;

  beforeEach(() => {
    queryLog = [];
    mockClient = {
      query: jest.fn(async (sql, params) => {
        const rawStr = typeof sql === 'string' ? sql : (sql?.text || '');
        const queryStr = rawStr.replace(/\s+/g, ' ').trim();
        queryLog.push({ sql: queryStr, params });

        if (queryStr.includes('BEGIN') || queryStr.includes('COMMIT') || queryStr.includes('ROLLBACK')) {
          return { rows: [] };
        }
        if (queryStr.includes('SELECT * FROM customers WHERE id =')) {
          return { rows: [{ id: 10, name: 'Mohamed Farouk' }] };
        }
        if (queryStr.includes('FROM customer_payments WHERE id = $1 AND customer_id = $2')) {
          return {
            rows: [{
              id: 99,
              customer_id: 10,
              invoice_id: null,
              payment_date: '2026-09-24',
              amount: 180000,
              payment_method: 'bank',
              reference_number: 'REF-1',
              notes: 'Initial payment',
              evidence_url: null,
              evidence_name: null,
              evidence_mime: null,
            }],
          };
        }
        if (queryStr.includes('FROM customer_payment_allocations WHERE customer_payment_id = $1')) {
          return {
            rows: [{ id: 1, customer_payment_id: 99, invoice_id: 5, amount: 10000 }],
          };
        }
        if (queryStr.includes('DELETE FROM customer_payment_allocations')) {
          return { rows: [] };
        }
        if (queryStr.includes('UPDATE invoices') && queryStr.includes('GREATEST(0, paid_amount - $1)')) {
          return { rows: [{ id: 5, paid_amount: 0, status: 'issued' }] };
        }
        if (queryStr.includes('UPDATE customer_payments')) {
          return {
            rows: [{
              id: 99,
              customer_id: 10,
              payment_date: params?.[0] || '2026-09-24',
              amount: params?.[1] || 150000,
              notes: params?.[4] || 'Updated payment note',
            }],
          };
        }
        if (queryStr.includes('DELETE FROM customer_payments')) {
          return { rows: [{ id: 99 }] };
        }
        if (queryStr.includes('FROM invoices WHERE customer_id =') && queryStr.includes('open invoices')) {
          return {
            rows: [{
              id: 5,
              total_amount: 20000,
              paid_amount: 0,
              credited_amount: 0,
            }],
          };
        }
        if (queryStr.includes('INSERT INTO customer_payment_allocations')) {
          return { rows: [{ id: 2, customer_payment_id: 99, invoice_id: 5, amount: 20000 }] };
        }
        if (queryStr.includes('UPDATE invoices') && queryStr.includes('paid_amount = paid_amount + $1')) {
          return { rows: [{ id: 5, paid_amount: 20000, status: 'paid' }] };
        }
        if (queryStr.includes('SELECT COALESCE(SUM(amount), 0)::float AS total FROM customer_payments')) {
          return { rows: [{ total: 150000 }] };
        }
        if (queryStr.includes('SELECT id, total_amount, status FROM sales_orders')) {
          return { rows: [{ id: 1, total_amount: 150000, status: 'pending' }] };
        }
        if (queryStr.includes('UPDATE sales_orders SET paid_amount =')) {
          return { rows: [] };
        }
        if (queryStr.includes('DELETE FROM accounting_journal_entries')) {
          return { rows: [{ id: 301 }] };
        }
        return { rows: [] };
      }),
      release: jest.fn(),
    };

    jest.spyOn(pool, 'connect').mockResolvedValue(mockClient);
    jest.spyOn(accountingService, 'postCustomerPayment').mockResolvedValue({ id: 888 });
    jest.spyOn(auditService, 'log').mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('successfully updates customer payment amount and notes, re-allocates and recalculates balances', async () => {
    const result = await salesService.updateCustomerPayment(1, 10, 99, null, {
      amount: 150000,
      notes: 'Updated note',
      payment_date: '2026-09-25',
    });

    expect(result).toBeDefined();
    expect(Number(result.amount)).toBe(150000);

    const sqlCalls = queryLog.map(q => q.sql);
    expect(sqlCalls).toContain('BEGIN');
    expect(sqlCalls).toContain('COMMIT');

    const rollbackAlloc = queryLog.some(q => q.sql.includes('GREATEST(0, paid_amount - $1)'));
    expect(rollbackAlloc).toBe(true);

    const orderCheck = queryLog.some(q => q.sql.includes('SELECT id, total_amount, status FROM sales_orders'));
    expect(orderCheck).toBe(true);

    expect(accountingService.postCustomerPayment).toHaveBeenCalled();
  });

  test('rejects update with amount <= 0', async () => {
    await expect(
      salesService.updateCustomerPayment(1, 10, 99, null, { amount: -50 })
    ).rejects.toThrow('Amount must be greater than 0');

    const sqlCalls = queryLog.map(q => q.sql);
    expect(sqlCalls).toContain('ROLLBACK');
  });

  test('throws 404 when payment does not exist', async () => {
    mockClient.query.mockImplementation(async (sql) => {
      const queryStr = typeof sql === 'string' ? sql : (sql?.text || '');
      if (queryStr.includes('SELECT * FROM customers WHERE id =')) {
        return { rows: [{ id: 10 }] };
      }
      if (queryStr.includes('FROM customer_payments WHERE id = $1 AND customer_id = $2')) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    await expect(
      salesService.updateCustomerPayment(1, 10, 999, null, { amount: 500 })
    ).rejects.toThrow('Payment not found');
  });

  test('successfully deletes a customer payment and cleans up allocations and accounting', async () => {
    const result = await salesService.deleteCustomerPayment(1, 10, 99);

    expect(result).toEqual({ success: true, message: 'Payment deleted successfully' });

    const sqlCalls = queryLog.map(q => q.sql);
    expect(sqlCalls).toContain('BEGIN');
    expect(sqlCalls).toContain('COMMIT');

    const deletePaymentCall = queryLog.some(q => q.sql.includes('DELETE FROM customer_payments'));
    expect(deletePaymentCall).toBe(true);

    const deleteAllocCall = queryLog.some(q => q.sql.includes('DELETE FROM customer_payment_allocations'));
    expect(deleteAllocCall).toBe(true);
  });
});
