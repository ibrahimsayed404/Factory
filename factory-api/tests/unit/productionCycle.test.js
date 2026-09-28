const productionCycleService = require('../../src/modules/productionCycle/productionCycle.service');
const salesRepository = require('../../src/modules/sales/sales.repository');
const pool = require('../../src/db/pool');

describe('Production Cycle Unit Tests', () => {
  let mockClient;
  let queryLog;
  let orderStage;
  let colorRows;

  beforeEach(() => {
    queryLog = [];
    orderStage = 'cutting';
    colorRows = [
      { id: 201, order_id: 101, color: 'أسود', cut_quantity: 200, sorted_quantity: 198, print_received_quantity: null, machine_quantity: null },
      { id: 202, order_id: 101, color: 'أبيض', cut_quantity: 300, sorted_quantity: 300, print_received_quantity: null, machine_quantity: null },
    ];
    mockClient = {
      query: jest.fn(async (sql, params) => {
        const rawStr = typeof sql === 'string' ? sql : (sql?.text || '');
        const queryStr = rawStr.replace(/\s+/g, ' ').trim();
        queryLog.push({ sql: queryStr, params });

        if (queryStr.includes('BEGIN') || queryStr.includes('COMMIT') || queryStr.includes('ROLLBACK')) {
          return { rows: [] };
        }

        if (queryStr.includes('INSERT INTO production_orders')) {
          return {
            rows: [{
              id: 101,
              order_number: params[0],
              model_number: params[1],
              order_name: params[2],
              total_cut_quantity: params[6],
              current_stage: 'cutting',
              status: 'cutting',
            }],
          };
        }

        if (queryStr.includes('INSERT INTO production_order_colors')) {
          return {
            rows: [{
              id: 201,
              order_id: params[0],
              color: params[1],
              cut_quantity: params[2],
            }],
          };
        }

        if (queryStr.includes('SELECT * FROM production_orders WHERE id = $1')) {
          return {
            rows: [{
              id: 101,
              order_number: '6201',
              model_number: '6201',
              order_name: 'بيزك',
              total_cut_quantity: 500,
              current_stage: orderStage,
              status: 'cutting',
            }],
          };
        }

        if (queryStr.includes('UPDATE production_order_colors')) {
          return { rows: [{ id: 201, order_id: 101 }] };
        }

        if (queryStr.includes('UPDATE production_orders')) {
          return {
            rows: [{
              id: 101,
              order_number: '6201',
              model_number: '6201',
              order_name: 'بيزك',
              current_stage: params?.[2] || 'sorting',
            }],
          };
        }

        if (queryStr.includes('SELECT * FROM production_order_colors WHERE order_id = $1')) {
          return { rows: colorRows };
        }

        if (queryStr.includes('SELECT COALESCE(SUM(machine_quantity)')) {
          return { rows: [{ total_machine: 490 }] };
        }

        if (queryStr.includes('SELECT COALESCE(SUM(sorted_quantity)')) {
          return { rows: [{ total_sorted: 498 }] };
        }

        if (queryStr.includes('SELECT COALESCE(SUM(print_sent_quantity)')) {
          return { rows: [{ total_sent: 498 }] };
        }

        if (queryStr.includes('SELECT COALESCE(SUM(print_received_quantity)')) {
          return { rows: [{ total_rec: 495 }] };
        }

        return { rows: [] };
      }),
      release: jest.fn(),
    };

    jest.spyOn(pool, 'connect').mockResolvedValue(mockClient);
    jest.spyOn(pool, 'query').mockImplementation(async (sql, params) => {
      if (typeof sql === 'string' && sql.includes('FROM production_orders po')) {
        return {
          rows: [{
            id: 101,
            order_number: '6201',
            model_number: '6201',
            order_name: 'بيزك',
            total_cut_quantity: 500,
            current_stage: 'cutting',
            status: 'cutting',
            colors: [
              { id: 201, color: 'أسود', cut_quantity: 200, sorted_quantity: null },
              { id: 202, color: 'أبيض', cut_quantity: 300, sorted_quantity: null },
            ],
          }],
        };
      }
      return { rows: [] };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('createCuttingOrder fails if modelNumber or orderName is missing', async () => {
    await expect(productionCycleService.createCuttingOrder({
      modelNumber: '',
      orderName: 'بيزك',
      colors: [{ color: 'أسود', quantity: 200 }],
    })).rejects.toThrow('رقم الموديل / الأوردر مطلوب');

    await expect(productionCycleService.createCuttingOrder({
      modelNumber: '6201',
      orderName: '',
      colors: [{ color: 'أسود', quantity: 200 }],
    })).rejects.toThrow('اسم الموديل / الأوردر مطلوب');
  });

  test('createCuttingOrder fails if colors array is empty or invalid quantity', async () => {
    await expect(productionCycleService.createCuttingOrder({
      modelNumber: '6201',
      orderName: 'بيزك',
      colors: [],
    })).rejects.toThrow('يجب إضافة لون واحد على الأقل مع الكمية');

    await expect(productionCycleService.createCuttingOrder({
      modelNumber: '6201',
      orderName: 'بيزك',
      colors: [{ color: 'أسود', quantity: -10 }],
    })).rejects.toThrow('الكمية للون "أسود" يجب أن تكون أكبر من صفر');
  });

  test('createCuttingOrder successfully creates order and inserts all color rows', async () => {
    const result = await productionCycleService.createCuttingOrder({
      modelNumber: '6201',
      orderName: 'بيزك',
      colors: [
        { color: 'أسود', quantity: 200 },
        { color: 'أبيض', quantity: 300 },
      ],
      notes: 'أوردر تجريبي جديد',
      userId: 1,
    });

    expect(result.id).toBe(101);
    expect(result.order_number).toBe('6201');
    expect(result.total_cut_quantity).toBe(500);

    const beginLogged = queryLog.some((q) => q.sql === 'BEGIN');
    const commitLogged = queryLog.some((q) => q.sql === 'COMMIT');
    expect(beginLogged).toBe(true);
    expect(commitLogged).toBe(true);
  });

  test('submitSortingPhase updates sorted quantities and notes', async () => {
    const result = await productionCycleService.submitSortingPhase(101, {
      colors: [
        { id: 201, sorted_quantity: 198, sorting_note: 'عجز 2 قطعة' },
        { id: 202, sorted_quantity: 300, sorting_note: '' },
      ],
      sorting_notes: 'تم الفرز بنجاح',
      next_action: 'printing',
    });

    expect(result).toBeDefined();
    const updateOrderLogged = queryLog.some((q) => q.sql.includes('UPDATE production_orders'));
    expect(updateOrderLogged).toBe(true);
  });

  test('deliverToCustomer charges customer and updates balance', async () => {
    orderStage = 'ready_for_delivery';
    jest.spyOn(salesRepository, 'createSalesOrderRecord').mockResolvedValue({ id: 55, order_number: 'SO-6201-1234' });
    jest.spyOn(salesRepository, 'insertSalesOrderItem').mockResolvedValue({ id: 1 });
    jest.spyOn(salesRepository, 'getCustomerPayments').mockResolvedValue(100000);
    jest.spyOn(salesRepository, 'getCustomerOrders').mockResolvedValue([{ id: 55, total_amount: 74700 }]);
    jest.spyOn(salesRepository, 'updateOrderPaymentStatus').mockResolvedValue();

    const result = await productionCycleService.deliverToCustomer(101, {
      customer_id: 10,
      unit_price: 150,
      delivery_notes: 'تسليم كامل للعميل',
      user_id: 1,
    });

    expect(result).toBeDefined();
    expect(salesRepository.createSalesOrderRecord).toHaveBeenCalled();
    expect(salesRepository.updateOrderPaymentStatus).toHaveBeenCalled();
  });

  test('submitSortingPhase rejects negative sorted quantity', async () => {
    await expect(productionCycleService.submitSortingPhase(101, {
      colors: [{ id: 201, sorted_quantity: -5, sorting_note: '' }],
      sorting_notes: '',
      next_action: 'printing',
    })).rejects.toThrow('كمية الفرز يجب أن تكون رقم صحيح أكبر من أو يساوي صفر');
  });

  test('sendToPrintShop rejects missing print_shop_id', async () => {
    await expect(productionCycleService.sendToPrintShop(101, {
      print_shop_id: null,
      colors: [],
    })).rejects.toThrow('يرجى اختيار المطبعة');
  });

  test('receiveFromPrintShop rejects negative received quantity', async () => {
    await expect(productionCycleService.receiveFromPrintShop(101, {
      colors: [{ id: 201, print_received_quantity: -10 }],
    })).rejects.toThrow('الكمية المستلمة يجب أن تكون رقم صحيح أكبر من أو يساوي صفر');
  });

  test('deliverToCustomer rejects non-positive unit price', async () => {
    orderStage = 'ready_for_delivery';
    await expect(productionCycleService.deliverToCustomer(101, {
      customer_id: 10,
      unit_price: 0,
    })).rejects.toThrow('سعر القطعة يجب أن يكون أكبر من صفر');

    await expect(productionCycleService.deliverToCustomer(101, {
      customer_id: 10,
      unit_price: -50,
    })).rejects.toThrow('سعر القطعة يجب أن يكون أكبر من صفر');
  });

  test('skipPrint sends the order to the machines stage', async () => {
    const result = await productionCycleService.skipPrint(101);
    expect(result).toBeDefined();
    const updateLogged = queryLog.some(q => q.sql.includes('UPDATE production_orders') && q.params.includes('machines'));
    expect(updateLogged).toBe(true);
  });

  test('sorting a plain order (no printing) sends it to the machines stage', async () => {
    await productionCycleService.submitSortingPhase(101, {
      colors: [{ id: 201, sorted_quantity: 198 }, { id: 202, sorted_quantity: 300 }],
      next_action: 'delivery',
    });
    const update = queryLog.find((q) => q.sql.includes('UPDATE production_orders') && q.sql.includes('sorted_at'));
    expect(update.params[2]).toBe('machines');
  });

  test('receiving from the print shop sends the order to the machines stage', async () => {
    await productionCycleService.receiveFromPrintShop(101, {
      colors: [{ id: 201, print_received_quantity: 195 }, { id: 202, print_received_quantity: 300 }],
    });
    const update = queryLog.find((q) => q.sql.includes('UPDATE production_orders') && q.sql.includes('print_received_at'));
    expect(update.params[3]).toBe('machines');
  });

  describe('submitMachinesPhase', () => {
    const allColors = [
      { id: 201, machine_quantity: 190, machine_note: '8 تالف' },
      { id: 202, machine_quantity: 300 },
    ];

    test('rejects an order that is not in the machines stage', async () => {
      orderStage = 'printing';
      await expect(productionCycleService.submitMachinesPhase(101, { colors: allColors }))
        .rejects.toThrow('أمر الإنتاج ليس في مرحلة المكن');
    });

    test('requires a quantity for every color', async () => {
      orderStage = 'machines';
      await expect(productionCycleService.submitMachinesPhase(101, { colors: [allColors[0]] }))
        .rejects.toThrow('يجب إدخال كمية المكن لكل الألوان');
    });

    test('rejects more pieces out than went in', async () => {
      orderStage = 'machines';
      await expect(productionCycleService.submitMachinesPhase(101, {
        colors: [{ id: 201, machine_quantity: 199 }, { id: 202, machine_quantity: 300 }],
      })).rejects.toThrow('أكبر من الكمية الداخلة (198)');
    });

    test('rejects negative or fractional quantities', async () => {
      orderStage = 'machines';
      await expect(productionCycleService.submitMachinesPhase(101, {
        colors: [{ id: 201, machine_quantity: -1 }, { id: 202, machine_quantity: 300 }],
      })).rejects.toThrow('كمية المكن يجب أن تكون رقم صحيح');
      await expect(productionCycleService.submitMachinesPhase(101, {
        colors: [{ id: 201, machine_quantity: 10.5 }, { id: 202, machine_quantity: 300 }],
      })).rejects.toThrow('كمية المكن يجب أن تكون رقم صحيح');
    });

    test('uses the print-shop output as the input when the order was printed', async () => {
      orderStage = 'machines';
      colorRows[0].print_received_quantity = 150;
      await expect(productionCycleService.submitMachinesPhase(101, {
        colors: [{ id: 201, machine_quantity: 151 }, { id: 202, machine_quantity: 300 }],
      })).rejects.toThrow('أكبر من الكمية الداخلة (150)');
    });

    test('records quantities and moves the order to ready_for_delivery', async () => {
      orderStage = 'machines';
      await productionCycleService.submitMachinesPhase(101, { colors: allColors, machine_notes: 'تم' });

      const colorUpdates = queryLog.filter((q) => q.sql.includes('UPDATE production_order_colors') && q.sql.includes('machine_quantity'));
      expect(colorUpdates.map((q) => q.params[0])).toEqual([190, 300]);
      const orderUpdate = queryLog.find((q) => q.sql.includes('total_machine_quantity'));
      expect(orderUpdate.params[0]).toBe(490);
      expect(orderUpdate.params[3]).toBe('ready_for_delivery');
      expect(queryLog.some((q) => q.sql === 'COMMIT')).toBe(true);
    });
  });

  test('deliverToCustomer refuses an order that has not been through the machines', async () => {
    orderStage = 'machines';
    await expect(productionCycleService.deliverToCustomer(101, { customer_id: 10, unit_price: 100 }))
      .rejects.toThrow('غير جاهز للتسليم');
  });

  test('deliverToCustomer delivers the machines output', async () => {
    orderStage = 'ready_for_delivery';
    colorRows[0].machine_quantity = 190;
    colorRows[1].machine_quantity = 300;
    jest.spyOn(salesRepository, 'createSalesOrderRecord').mockResolvedValue({ id: 55 });
    jest.spyOn(salesRepository, 'insertSalesOrderItem').mockResolvedValue({ id: 1 });
    jest.spyOn(salesRepository, 'getCustomerPayments').mockResolvedValue(0);
    jest.spyOn(salesRepository, 'getCustomerOrders').mockResolvedValue([]);

    await productionCycleService.deliverToCustomer(101, { customer_id: 10, unit_price: 10 });

    const items = salesRepository.insertSalesOrderItem.mock.calls.map(([, item]) => item.quantity);
    expect(items).toEqual([190, 300]);
    expect(salesRepository.createSalesOrderRecord.mock.calls[0][1].total_amount).toBe(4900);
  });
});
