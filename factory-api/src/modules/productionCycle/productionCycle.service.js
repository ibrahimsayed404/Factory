const pool = require('../../db/pool');
const ApiError = require('../../utils/ApiError');
const salesRepository = require('../sales/sales.repository');

// Stage constants
const STAGE_CUTTING = 'cutting';
const STAGE_SORTING = 'sorting';
const STAGE_PRINTING = 'printing';
const STAGE_MACHINES = 'machines';
const STAGE_READY_FOR_DELIVERY = 'ready_for_delivery';
const STAGE_DELIVERED = 'delivered';

// Each step only accepts orders at the stage it belongs to, so an order cannot
// be re-sorted after delivery, received from print twice, or skip the machines.
const STAGE_NAMES_AR = {
  cutting: 'القص',
  sorting: 'الفرز',
  printing: 'المطبعة',
  machines: 'المكن',
  ready_for_delivery: 'جاهز للتسليم',
  delivered: 'اتسلم',
};

const assertStage = (order, allowed, stepName) => {
  if (!allowed.includes(order.current_stage)) {
    const stage = STAGE_NAMES_AR[order.current_stage] || order.current_stage;
    throw new ApiError(400, `لا يمكن تنفيذ ${stepName}: أمر الإنتاج في مرحلة "${stage}"`);
  }
};

// Pieces entering the machines stage for a color: what came back from the print
// shop, else what was sorted, else what was cut.
const stageInputQuantity = (c) => {
  if (c.print_received_quantity !== null && c.print_received_quantity !== undefined) return Number(c.print_received_quantity);
  if (c.sorted_quantity !== null && c.sorted_quantity !== undefined) return Number(c.sorted_quantity);
  return Number(c.cut_quantity || 0);
};

// Pieces delivered to the customer: the machines output, else the stage input
// (orders finished before the machines stage existed).
const deliverableQuantity = (c) => (
  c.machine_quantity !== null && c.machine_quantity !== undefined ? Number(c.machine_quantity) : stageInputQuantity(c)
);

/**
 * 1. Create Cutting Order (Stage 1)
 * @param {Object} data - { modelNumber, orderName, colors: [{ color, quantity }], notes, userId }
 */
const createCuttingOrder = async ({ modelNumber, orderName, colors, notes, userId }) => {
  const modelNum = String(modelNumber || '').trim();
  const name = String(orderName || '').trim();

  if (!modelNum) throw new ApiError(400, 'رقم الموديل / الأوردر مطلوب');
  if (!name) throw new ApiError(400, 'اسم الموديل / الأوردر مطلوب');
  if (!Array.isArray(colors) || colors.length === 0) {
    throw new ApiError(400, 'يجب إضافة لون واحد على الأقل مع الكمية');
  }

  // Calculate total cut quantity and validate color rows
  let totalCutQty = 0;
  const validatedColors = [];
  for (const c of colors) {
    const colorName = String(c.color || '').trim();
    const qty = Number.parseInt(c.quantity, 10);
    if (!colorName) throw new ApiError(400, 'اسم اللون مطلوب لكل بند');
    if (Number.isNaN(qty) || qty <= 0) throw new ApiError(400, `الكمية للون "${colorName}" يجب أن تكون أكبر من صفر`);
    totalCutQty += qty;
    validatedColors.push({ color: colorName, quantity: qty });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert into production_orders
    const orderRes = await client.query(
      `INSERT INTO production_orders (
        order_number, model_number, order_name, product_name,
        quantity, planned_quantity, total_cut_quantity,
        status, current_stage, notes, created_by,
        start_date, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_DATE, NOW(), NOW())
      RETURNING *`,
      [
        modelNum,
        modelNum,
        name,
        name,
        totalCutQty,
        totalCutQty,
        totalCutQty,
        STAGE_CUTTING,
        STAGE_CUTTING,
        notes || null,
        userId || null,
      ]
    );

    const order = orderRes.rows[0];

    // Insert color rows into production_order_colors
    const colorRows = [];
    for (const item of validatedColors) {
      const colorRes = await client.query(
        `INSERT INTO production_order_colors (
          order_id, color, cut_quantity, created_at, updated_at
        ) VALUES ($1, $2, $3, NOW(), NOW())
        RETURNING *`,
        [order.id, item.color, item.quantity]
      );
      colorRows.push(colorRes.rows[0]);
    }

    await client.query('COMMIT');
    return { ...order, colors: colorRows };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * 2. Get All Production Orders with full colors and stage data
 */
const listProductionOrders = async (filters = {}, clientOrPool = pool) => {
  const { orderId, stage, status, search, printShopId, customerId } = filters;
  const conditions = [];
  const params = [];

  if (orderId) {
    params.push(orderId);
    conditions.push(`po.id = $${params.length}`);
  }

  if (stage) {
    params.push(stage);
    conditions.push(`po.current_stage = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`po.status = $${params.length}`);
  }

  if (printShopId) {
    params.push(printShopId);
    conditions.push(`po.print_shop_id = $${params.length}`);
  }

  if (customerId) {
    params.push(customerId);
    conditions.push(`po.customer_id = $${params.length}`);
  }

  if (search) {
    params.push(`%${search.trim().toLowerCase()}%`);
    conditions.push(`(
      LOWER(po.order_number) LIKE $${params.length}
      OR LOWER(po.model_number) LIKE $${params.length}
      OR LOWER(po.order_name) LIKE $${params.length}
      OR LOWER(c.name) LIKE $${params.length}
      OR LOWER(ps.name) LIKE $${params.length}
    )`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
    SELECT 
      po.*,
      c.name AS customer_name,
      c.phone AS customer_phone,
      ps.name AS print_shop_name,
      ps.phone AS print_shop_phone,
      COALESCE(
        json_agg(
          json_build_object(
            'id', poc.id,
            'color', poc.color,
            'cut_quantity', poc.cut_quantity,
            'sorted_quantity', poc.sorted_quantity,
            'sorting_note', poc.sorting_note,
            'print_sent_quantity', poc.print_sent_quantity,
            'print_received_quantity', poc.print_received_quantity,
            'print_note', poc.print_note,
            'machine_quantity', poc.machine_quantity,
            'machine_note', poc.machine_note,
            'delivered_quantity', poc.delivered_quantity
          ) ORDER BY poc.id
        ) FILTER (WHERE poc.id IS NOT NULL), '[]'::json
      ) AS colors
    FROM production_orders po
    LEFT JOIN customers c ON po.customer_id = c.id
    LEFT JOIN print_shops ps ON po.print_shop_id = ps.id
    LEFT JOIN production_order_colors poc ON po.id = poc.order_id
    ${whereClause}
    GROUP BY po.id, c.name, c.phone, ps.name, ps.phone
    ORDER BY po.id DESC
  `;

  const result = await clientOrPool.query(query, params);
  return result.rows;
};

/**
 * 3. Get Single Production Order by ID with full details
 */
const getProductionOrderById = async (id, clientOrPool = pool) => {
  const orders = await listProductionOrders({ orderId: id }, clientOrPool);
  if (!orders || orders.length === 0) throw new ApiError(404, 'أمر الإنتاج غير موجود');
  return orders[0];
};

/**
 * 4. Submit Sorting Phase (Stage 2)
 * @param {number} orderId
 * @param {Object} data - { colors: [{ id, sorted_quantity, sorting_note }], sorting_notes, next_action: 'printing' | 'delivery' }
 */
const submitSortingPhase = async (orderId, { colors, sorting_notes, next_action }) => {
  if (!Array.isArray(colors) || colors.length === 0) {
    throw new ApiError(400, 'بيانات كميات الفرز مطلوبة');
  }

  const client = await pool.connect();
  let committed = false;
  try {
    await client.query('BEGIN');

    const orderRes = await client.query('SELECT * FROM production_orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (orderRes.rows.length === 0) throw new ApiError(404, 'أمر الإنتاج غير موجود');
    assertStage(orderRes.rows[0], [STAGE_CUTTING, STAGE_SORTING], 'الفرز');

    let totalSortedQty = 0;

    for (const c of colors) {
      const sortedQty = Number.parseInt(c.sorted_quantity, 10);
      if (Number.isNaN(sortedQty) || sortedQty < 0) {
        throw new ApiError(400, 'كمية الفرز يجب أن تكون رقم صحيح أكبر من أو يساوي صفر');
      }
      totalSortedQty += sortedQty;

      await client.query(
        `UPDATE production_order_colors
         SET sorted_quantity = $1,
             sorting_note = $2,
             updated_at = NOW()
         WHERE id = $3 AND order_id = $4`,
        [sortedQty, c.sorting_note || null, c.id, orderId]
      );
    }

    // Sum total_sorted_quantity directly from DB for deterministic integrity
    const sumRes = await client.query(
      `SELECT COALESCE(SUM(sorted_quantity), 0) AS total_sorted
       FROM production_order_colors
       WHERE order_id = $1`,
      [orderId]
    );
    totalSortedQty = Number.parseInt(sumRes.rows[0].total_sorted, 10) || 0;

    // Next stage: a plain order (next_action 'delivery' = no printing) goes straight
    // to the machines; otherwise to the print shop.
    const nextStage = next_action === 'delivery' ? STAGE_MACHINES : STAGE_PRINTING;

    await client.query(
      `UPDATE production_orders
       SET total_sorted_quantity = $1,
           sorting_notes = $2,
           current_stage = $3,
           sorted_at = NOW(),
           stage_entered_at = NOW(),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [totalSortedQty, sorting_notes || null, nextStage, orderId]
    );

    await client.query('COMMIT');
    committed = true;
  } catch (err) {
    if (!committed) {
      try {
        await client.query('ROLLBACK');
      } catch (rbErr) {
        console.error('Rollback error:', rbErr.message);
      }
    }
    throw err;
  } finally {
    client.release();
  }

  return await getProductionOrderById(orderId);
};

/**
 * 5. Send to Print Shop (Stage 3 - Part 1)
 * @param {number} orderId
 * @param {Object} data - { print_shop_id, colors: [{ id, print_sent_quantity }], print_notes, sent_at }
 */
const sendToPrintShop = async (orderId, { print_shop_id, colors, print_notes, sent_at }) => {
  if (!print_shop_id) throw new ApiError(400, 'يرجى اختيار المطبعة');

  const client = await pool.connect();
  let committed = false;
  try {
    await client.query('BEGIN');

    const orderRes = await client.query('SELECT * FROM production_orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (orderRes.rows.length === 0) throw new ApiError(404, 'أمر الإنتاج غير موجود');
    assertStage(orderRes.rows[0], [STAGE_SORTING, STAGE_PRINTING], 'الإرسال للمطبعة');
    if (orderRes.rows[0].print_sent_at) throw new ApiError(400, 'أمر الإنتاج اتبعت للمطبعة قبل كده');

    let totalPrintSent = 0;

    if (Array.isArray(colors) && colors.length > 0) {
      for (const c of colors) {
        const sentQty = Number.parseInt(c.print_sent_quantity, 10);
        const validQty = Number.isNaN(sentQty) ? 0 : sentQty;
        totalPrintSent += validQty;

        await client.query(
          `UPDATE production_order_colors
           SET print_sent_quantity = $1,
               updated_at = NOW()
           WHERE id = $2 AND order_id = $3`,
          [validQty, c.id, orderId]
        );
      }
    } else {
      // Default: copy sorted_quantity to print_sent_quantity
      const colorRows = await client.query('SELECT * FROM production_order_colors WHERE order_id = $1', [orderId]);
      for (const row of colorRows.rows) {
        const qty = row.sorted_quantity !== null ? row.sorted_quantity : row.cut_quantity;
        totalPrintSent += qty;
        await client.query(
          `UPDATE production_order_colors
           SET print_sent_quantity = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [qty, row.id]
        );
      }
    }

    const sumSent = await client.query(
      `SELECT COALESCE(SUM(print_sent_quantity), 0) AS total_sent
       FROM production_order_colors
       WHERE order_id = $1`,
      [orderId]
    );
    totalPrintSent = Number.parseInt(sumSent.rows[0].total_sent, 10) || 0;

    await client.query(
      `UPDATE production_orders
       SET print_shop_id = $1,
           total_print_sent_quantity = $2,
           print_sent_at = COALESCE($3, NOW()),
           stage_entered_at = COALESCE($3, NOW()),
           print_notes = $4,
           current_stage = $5,
           updated_at = NOW()
       WHERE id = $6`,
      [print_shop_id, totalPrintSent, sent_at || null, print_notes || null, STAGE_PRINTING, orderId]
    );

    await client.query('COMMIT');
    committed = true;
  } catch (err) {
    if (!committed) {
      try {
        await client.query('ROLLBACK');
      } catch (rbErr) {
        console.error('Rollback error:', rbErr.message);
      }
    }
    throw err;
  } finally {
    client.release();
  }

  return await getProductionOrderById(orderId);
};

/**
 * 6. Receive from Print Shop (Stage 3 - Part 2)
 * @param {number} orderId
 * @param {Object} data - { colors: [{ id, print_received_quantity, print_note }], print_notes, received_at }
 */
const receiveFromPrintShop = async (orderId, { colors, print_notes, received_at }) => {
  if (!Array.isArray(colors) || colors.length === 0) {
    throw new ApiError(400, 'بيانات الكميات المستلمة من المطبعة مطلوبة');
  }

  const client = await pool.connect();
  let committed = false;
  try {
    await client.query('BEGIN');

    const orderRes = await client.query('SELECT * FROM production_orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (orderRes.rows.length === 0) throw new ApiError(404, 'أمر الإنتاج غير موجود');
    assertStage(orderRes.rows[0], [STAGE_PRINTING], 'الاستلام من المطبعة');
    if (!orderRes.rows[0].print_sent_at) throw new ApiError(400, 'أمر الإنتاج لسه ماتبعتش للمطبعة');

    for (const c of colors) {
      const recQty = Number.parseInt(c.print_received_quantity, 10);
      if (Number.isNaN(recQty) || recQty < 0) {
        throw new ApiError(400, 'الكمية المستلمة يجب أن تكون رقم صحيح أكبر من أو يساوي صفر');
      }

      await client.query(
        `UPDATE production_order_colors
         SET print_received_quantity = $1,
             print_note = $2,
             updated_at = NOW()
         WHERE id = $3 AND order_id = $4`,
        [recQty, c.print_note || null, c.id, orderId]
      );
    }

    const sumRec = await client.query(
      `SELECT COALESCE(SUM(print_received_quantity), 0) AS total_rec
       FROM production_order_colors
       WHERE order_id = $1`,
      [orderId]
    );
    const totalPrintReceived = Number.parseInt(sumRec.rows[0].total_rec, 10) || 0;

    await client.query(
      `UPDATE production_orders
       SET total_print_received_quantity = $1,
           print_received_at = COALESCE($2, NOW()),
           stage_entered_at = NOW(),
           print_notes = COALESCE($3, print_notes),
           current_stage = $4,
           updated_at = NOW()
       WHERE id = $5`,
      [totalPrintReceived, received_at || null, print_notes || null, STAGE_MACHINES, orderId]
    );

    await client.query('COMMIT');
    committed = true;
  } catch (err) {
    if (!committed) {
      try {
        await client.query('ROLLBACK');
      } catch (rbErr) {
        console.error('Rollback error:', rbErr.message);
      }
    }
    throw err;
  } finally {
    client.release();
  }

  return await getProductionOrderById(orderId);
};

/**
 * 7. Skip Print: go straight to the machines stage
 */
const skipPrint = async (orderId) => {
  const client = await pool.connect();
  let committed = false;
  try {
    await client.query('BEGIN');
    const orderRes = await client.query('SELECT * FROM production_orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (orderRes.rows.length === 0) throw new ApiError(404, 'أمر الإنتاج غير موجود');
    assertStage(orderRes.rows[0], [STAGE_SORTING, STAGE_PRINTING], 'تخطي المطبعة');
    if (orderRes.rows[0].print_sent_at) throw new ApiError(400, 'أمر الإنتاج في المطبعة فعلاً؛ سجّل الاستلام بدل التخطي');

    await client.query(
      `UPDATE production_orders
       SET current_stage = $1,
           stage_entered_at = NOW(),
           updated_at = NOW()
       WHERE id = $2`,
      [STAGE_MACHINES, orderId]
    );

    await client.query('COMMIT');
    committed = true;
  } catch (err) {
    if (!committed) {
      try {
        await client.query('ROLLBACK');
      } catch (rbErr) {
        console.error('Rollback error:', rbErr.message);
      }
    }
    throw err;
  } finally {
    client.release();
  }

  return await getProductionOrderById(orderId);
};

/**
 * 8. Submit Machines Phase (المكن) — mandatory in-house stage after printing.
 * Records, per color, how many pieces came out of the machines. Output can be
 * lower than what went in (damage) but never higher. Moves the order to
 * ready_for_delivery.
 * @param {number} orderId
 * @param {Object} data - { colors: [{ id, machine_quantity, machine_note }], machine_notes, completed_at }
 */
const submitMachinesPhase = async (orderId, { colors, machine_notes, completed_at }) => {
  if (!Array.isArray(colors) || colors.length === 0) {
    throw new ApiError(400, 'بيانات كميات المكن مطلوبة');
  }

  const client = await pool.connect();
  let committed = false;
  try {
    await client.query('BEGIN');

    const orderRes = await client.query('SELECT * FROM production_orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (orderRes.rows.length === 0) throw new ApiError(404, 'أمر الإنتاج غير موجود');
    if (orderRes.rows[0].current_stage !== STAGE_MACHINES) {
      throw new ApiError(400, 'أمر الإنتاج ليس في مرحلة المكن');
    }

    const colorRows = await client.query('SELECT * FROM production_order_colors WHERE order_id = $1', [orderId]);
    const byId = new Map(colorRows.rows.map((c) => [Number(c.id), c]));
    const submittedIds = new Set(colors.map((c) => Number(c.id)));
    if (colorRows.rows.some((c) => !submittedIds.has(Number(c.id)))) {
      throw new ApiError(400, 'يجب إدخال كمية المكن لكل الألوان');
    }

    for (const c of colors) {
      const row = byId.get(Number(c.id));
      if (!row) throw new ApiError(400, 'لون غير موجود في أمر الإنتاج');

      const qty = Number(c.machine_quantity);
      if (!Number.isInteger(qty) || qty < 0) {
        throw new ApiError(400, 'كمية المكن يجب أن تكون رقم صحيح أكبر من أو يساوي صفر');
      }
      const inputQty = stageInputQuantity(row);
      if (qty > inputQty) {
        throw new ApiError(400, `كمية المكن للون "${row.color}" (${qty}) أكبر من الكمية الداخلة (${inputQty})`);
      }

      await client.query(
        `UPDATE production_order_colors
         SET machine_quantity = $1,
             machine_note = $2,
             updated_at = NOW()
         WHERE id = $3 AND order_id = $4`,
        [qty, c.machine_note || null, row.id, orderId]
      );
    }

    const sumRes = await client.query(
      `SELECT COALESCE(SUM(machine_quantity), 0) AS total_machine
       FROM production_order_colors
       WHERE order_id = $1`,
      [orderId]
    );
    const totalMachine = Number.parseInt(sumRes.rows[0].total_machine, 10) || 0;

    await client.query(
      `UPDATE production_orders
       SET total_machine_quantity = $1,
           machine_notes = $2,
           machines_completed_at = COALESCE($3, NOW()),
           stage_entered_at = NOW(),
           current_stage = $4,
           updated_at = NOW()
       WHERE id = $5`,
      [totalMachine, machine_notes || null, completed_at || null, STAGE_READY_FOR_DELIVERY, orderId]
    );

    await client.query('COMMIT');
    committed = true;
  } catch (err) {
    if (!committed) {
      try {
        await client.query('ROLLBACK');
      } catch (rbErr) {
        console.error('Rollback error:', rbErr.message);
      }
    }
    throw err;
  } finally {
    client.release();
  }

  return await getProductionOrderById(orderId);
};

/**
 * 9. Deliver to Customer (final stage)
 * Assigns customer, unit price, charges customer balance/creates sales order, marks delivered.
 * @param {number} orderId
 * @param {Object} data - { customer_id, unit_price, delivery_notes, delivered_at }
 */
const deliverToCustomer = async (orderId, { customer_id, unit_price, delivery_notes, delivered_at, user_id }) => {
  if (!customer_id) throw new ApiError(400, 'يرجى اختيار العميل');
  const price = Number.parseFloat(unit_price);
  if (Number.isNaN(price) || price <= 0) {
    throw new ApiError(400, 'سعر القطعة يجب أن يكون أكبر من صفر');
  }

  const client = await pool.connect();
  let committed = false;
  try {
    await client.query('BEGIN');

    const orderRes = await client.query('SELECT * FROM production_orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (orderRes.rows.length === 0) throw new ApiError(404, 'أمر الإنتاج غير موجود');
    const order = orderRes.rows[0];
    if (order.current_stage !== STAGE_READY_FOR_DELIVERY) {
      throw new ApiError(400, 'أمر الإنتاج غير جاهز للتسليم (لازم يعدي على المكن الأول)');
    }

    // Final delivered pieces per color: the machines output.
    const colorRows = await client.query('SELECT * FROM production_order_colors WHERE order_id = $1', [orderId]);
    let totalDeliveredQty = 0;

    for (const c of colorRows.rows) {
      const deliveredQty = deliverableQuantity(c);
      totalDeliveredQty += deliveredQty;

      await client.query(
        `UPDATE production_order_colors
         SET delivered_quantity = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [deliveredQty, c.id]
      );
    }

    if (totalDeliveredQty <= 0) {
      throw new ApiError(400, 'لا يمكن تسليم أمر إنتاج بإجمالي كمية صفر أو سالبة');
    }

    const totalPrice = Number((totalDeliveredQty * price).toFixed(2));

    // Create sales_order so it reflects on the customer's account and ledger
    const soNumber = `SO-${order.order_number}-${Date.now().toString().slice(-4)}`;
    const salesOrder = await salesRepository.createSalesOrderRecord(client, {
      orderNum: soNumber,
      quotation_id: null,
      customer_id,
      delivery_date: delivered_at ? new Date(delivered_at) : new Date(),
      notes: `تسليم أمر إنتاج موديل ${order.model_number} (${order.order_name}) - ${delivery_notes || ''}`,
      created_by: user_id || null,
      subtotal: totalPrice,
      discount_amount: 0,
      tax_amount: 0,
      total_amount: totalPrice,
    });

    // Insert sales order items for each color
    for (const c of colorRows.rows) {
      const deliveredQty = deliverableQuantity(c);

      await salesRepository.insertSalesOrderItem(client, {
        sales_order_id: salesOrder.id,
        product_name: `${order.model_number} - ${order.order_name}`,
        color: c.color,
        quantity: deliveredQty,
        unit_price: price,
      });
    }

    // Recalculate customer balances and apply any open credits/payments
    const totalPaid = await salesRepository.getCustomerPayments(client, customer_id);
    let remainingCredit = Number(totalPaid);
    const customerOrders = await salesRepository.getCustomerOrders(client, customer_id);

    for (const ord of customerOrders) {
      const ordTotal = Number(ord.total_amount || 0);
      const applied = Math.max(0, Math.min(ordTotal, remainingCredit));
      remainingCredit -= applied;
      let pStatus = 'pending';
      if (applied >= ordTotal && ordTotal > 0) pStatus = 'paid';
      else if (applied > 0) pStatus = 'invoiced';
      await salesRepository.updateOrderPaymentStatus(client, ord.id, applied, pStatus);
    }

    // Update production_order
    await client.query(
      `UPDATE production_orders
       SET customer_id = $1,
           unit_price = $2,
           total_price = $3,
           sales_order_id = $4,
           total_delivered_quantity = $5,
           current_stage = $6,
           status = $7,
           delivered_at = COALESCE($8, NOW()),
           stage_entered_at = NOW(),
           delivery_notes = $9,
           updated_at = NOW()
       WHERE id = $10`,
      [
        customer_id,
        price,
        totalPrice,
        salesOrder.id,
        totalDeliveredQty,
        STAGE_DELIVERED,
        STAGE_DELIVERED,
        delivered_at || null,
        delivery_notes || null,
        orderId,
      ]
    );

    await client.query('COMMIT');
    committed = true;
  } catch (err) {
    if (!committed) {
      try {
        await client.query('ROLLBACK');
      } catch (rbErr) {
        console.error('Rollback error:', rbErr.message);
      }
    }
    throw err;
  } finally {
    client.release();
  }

  return await getProductionOrderById(orderId);
};

/**
 * 10. Delete Production Order
 */
const deleteProductionOrder = async (orderId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const orderRes = await client.query('SELECT * FROM production_orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (orderRes.rows.length === 0) throw new ApiError(404, 'أمر الإنتاج غير موجود');

    // If order was delivered and created a sales_order, clean up sales_order
    const salesOrderId = orderRes.rows[0].sales_order_id;
    if (salesOrderId) {
      await client.query('DELETE FROM sales_order_items WHERE sales_order_id = $1', [salesOrderId]);
      await client.query('DELETE FROM sales_orders WHERE id = $1', [salesOrderId]);
      if (orderRes.rows[0].customer_id) {
        // Recalculate customer balance
        const totalPaid = await salesRepository.getCustomerPayments(client, orderRes.rows[0].customer_id);
        let rem = Number(totalPaid);
        const orders = await salesRepository.getCustomerOrders(client, orderRes.rows[0].customer_id);
        for (const ord of orders) {
          const tot = Number(ord.total_amount || 0);
          const app = Math.max(0, Math.min(tot, rem));
          rem -= app;
          let ps = 'pending';
          if (app >= tot && tot > 0) ps = 'paid';
          else if (app > 0) ps = 'invoiced';
          await salesRepository.updateOrderPaymentStatus(client, ord.id, app, ps);
        }
      }
    }

    // Delete color rows (cascaded by FK, but do explicitly for safety)
    await client.query('DELETE FROM production_order_colors WHERE order_id = $1', [orderId]);
    await client.query('DELETE FROM production_orders WHERE id = $1', [orderId]);

    await client.query('COMMIT');
    return { success: true, message: 'تم حذف أمر الإنتاج بنجاح' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * 11. Get Production KPIs Summary
 */
const getProductionKPIs = async () => {
  const result = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE current_stage = 'cutting') AS cutting_orders,
      COALESCE(SUM(total_cut_quantity) FILTER (WHERE current_stage = 'cutting'), 0) AS cutting_pieces,
      COUNT(*) FILTER (WHERE current_stage = 'sorting') AS sorting_orders,
      COALESCE(SUM(total_cut_quantity) FILTER (WHERE current_stage = 'sorting'), 0) AS sorting_pieces,
      COUNT(*) FILTER (WHERE current_stage = 'printing') AS printing_orders,
      COALESCE(SUM(total_print_sent_quantity) FILTER (WHERE current_stage = 'printing'), 0) AS printing_pieces,
      COUNT(*) FILTER (WHERE current_stage = 'machines') AS machines_orders,
      COALESCE(SUM(CASE WHEN print_received_at IS NOT NULL THEN total_print_received_quantity
                        ELSE COALESCE(NULLIF(total_sorted_quantity, 0), total_cut_quantity) END)
               FILTER (WHERE current_stage = 'machines'), 0) AS machines_pieces,
      COUNT(*) FILTER (WHERE current_stage = 'ready_for_delivery') AS ready_delivery_orders,
      COALESCE(SUM(COALESCE(total_machine_quantity,
                            CASE WHEN print_received_at IS NOT NULL THEN total_print_received_quantity END,
                            NULLIF(total_sorted_quantity, 0), total_cut_quantity))
               FILTER (WHERE current_stage = 'ready_for_delivery'), 0) AS ready_delivery_pieces,
      COUNT(*) FILTER (WHERE current_stage = 'delivered') AS delivered_orders,
      COALESCE(SUM(total_delivered_quantity) FILTER (WHERE current_stage = 'delivered'), 0) AS delivered_pieces,
      COALESCE(SUM(total_price) FILTER (WHERE current_stage = 'delivered'), 0) AS delivered_revenue
    FROM production_orders
  `);

  return result.rows[0];
};

module.exports = {
  STAGE_CUTTING,
  STAGE_SORTING,
  STAGE_PRINTING,
  STAGE_MACHINES,
  STAGE_READY_FOR_DELIVERY,
  STAGE_DELIVERED,
  createCuttingOrder,
  listProductionOrders,
  getProductionOrderById,
  submitSortingPhase,
  sendToPrintShop,
  receiveFromPrintShop,
  skipPrint,
  submitMachinesPhase,
  deliverToCustomer,
  deleteProductionOrder,
  getProductionKPIs,
};
