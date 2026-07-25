const salesService = require('../../src/services/salesService');
const productionTrackingService = require('../../src/services/productionTrackingService');
const salesRepository = require('../../src/repositories/salesRepository');
const pool = require('../../src/db/pool');

describe('Sales & Production Order Transaction Atomicity Tests', () => {
  let mockClient;
  let queryLog;

  beforeEach(() => {
    queryLog = [];
    mockClient = {
      query: jest.fn(async (sql, params) => {
        const queryStr = typeof sql === 'string' ? sql : (sql?.text || '');
        queryLog.push({ sql: queryStr.trim(), params });

        if (queryStr.includes('BEGIN')) {
          return { rows: [] };
        }
        if (queryStr.includes('COMMIT')) {
          return { rows: [] };
        }
        if (queryStr.includes('ROLLBACK')) {
          return { rows: [] };
        }
        if (queryStr.includes('INSERT INTO sales_orders')) {
          return {
            rows: [{
              id: 101,
              order_number: 'SO-1001',
              customer_id: 5,
              total_amount: 500,
              status: 'pending',
            }],
          };
        }
        if (queryStr.includes('INSERT INTO sales_order_items')) {
          return {
            rows: [{
              id: 501,
              sales_order_id: 101,
              product_name: 'Custom Product A',
              quantity: 10,
              unit_price: 50,
            }],
          };
        }
        if (queryStr.includes('SELECT pg_advisory_xact_lock')) {
          return { rows: [] };
        }
        if (queryStr.includes('SELECT id FROM production_orders WHERE model_number') || queryStr.includes('model_number IS NOT NULL')) {
          return { rows: [] };
        }
        if (queryStr.includes('FROM products')) {
          return { rows: [{ id: 99, name: 'Custom Product A' }] };
        }
        if (queryStr.includes('INSERT INTO products')) {
          return { rows: [{ id: 99, name: 'Custom Product A' }] };
        }
        if (queryStr.includes('INSERT INTO production_orders')) {
          return {
            rows: [{
              id: 201,
              order_number: 'PO-2001',
              model_number: 'Custom Product A',
              quantity: 10,
              sales_order_id: 101,
              status: 'pending',
            }],
          };
        }
        if (queryStr.includes('INSERT INTO production_phases')) {
          return { rows: [{ id: 301, order_id: 201 }] };
        }
        if (queryStr.includes('UPDATE sales_orders SET status')) {
          return { rows: [{ id: 101, status: 'reserved' }] };
        }
        if (queryStr.includes('INSERT INTO audit_logs')) {
          return { rows: [] };
        }
        return {
          rows: [{
            id: 201,
            order_number: 'PO-2001',
            model_number: 'Custom Product A',
            product_name: 'Custom Product A',
            planned_quantity: 10,
            quantity: 10,
            status: 'pending',
            input_quantity: 10,
            sorting_quantity: 0,
            outsourcing_quantity: 0,
            final_quantity: 0,
          }],
        };
      }),
      release: jest.fn(),
    };

    jest.spyOn(pool, 'connect').mockResolvedValue(mockClient);
    jest.spyOn(pool, 'query').mockImplementation(mockClient.query);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('SUCCESS CASE: Both sales order and production order are created within the SAME transaction block and committed together', async () => {
    const saleData = {
      customer_id: 5,
      delivery_date: '2026-08-01',
      notes: 'Test sale order',
      items: [
        {
          product_name: 'Custom Product A',
          quantity: 10,
          unit_price: 50,
          make_to_order: true,
        },
      ],
    };

    const result = await salesService.createSalesOrder(1, saleData);

    expect(result).toBeDefined();
    expect(result.id).toBe(101);

    // Verify transaction lifecycle: BEGIN at start, COMMIT at end
    const sqlStatements = queryLog.map(q => q.sql);
    expect(sqlStatements[0]).toBe('BEGIN');
    expect(sqlStatements[sqlStatements.length - 1]).toBe('COMMIT');

    // Verify both sales_orders and production_orders queries ran on the SAME client
    const hasSalesOrderInsert = sqlStatements.some(s => s.includes('INSERT INTO sales_orders'));
    const hasProductionOrderInsert = sqlStatements.some(s => s.includes('INSERT INTO production_orders'));

    expect(hasSalesOrderInsert).toBe(true);
    expect(hasProductionOrderInsert).toBe(true);
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  test('FAILURE CASE: Forced failure during production order creation triggers ROLLBACK, preventing orphaned sales order', async () => {
    // Force production order creation to fail by making createProductionOrder throw an error
    jest.spyOn(productionTrackingService, 'createProductionOrder').mockRejectedValue(
      new Error('FORCED PRODUCTION ORDER FAILURE: Invalid materials or missing product')
    );

    const saleData = {
      customer_id: 5,
      delivery_date: '2026-08-01',
      notes: 'Test sale order causing failure',
      items: [
        {
          product_name: 'Custom Product B',
          quantity: 5,
          unit_price: 100,
          make_to_order: true,
        },
      ],
    };

    await expect(salesService.createSalesOrder(1, saleData)).rejects.toThrow(
      'FORCED PRODUCTION ORDER FAILURE: Invalid materials or missing product'
    );

    const sqlStatements = queryLog.map(q => q.sql);

    // Verify transaction started with BEGIN and ended with ROLLBACK
    expect(sqlStatements[0]).toBe('BEGIN');
    expect(sqlStatements[sqlStatements.length - 1]).toBe('ROLLBACK');

    // Verify sales order insert WAS executed prior to failure, but ROLLBACK was called to undo it
    const hasSalesOrderInsert = sqlStatements.some(s => s.includes('INSERT INTO sales_orders'));
    expect(hasSalesOrderInsert).toBe(true);
    expect(sqlStatements.includes('COMMIT')).toBe(false);
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });
});
