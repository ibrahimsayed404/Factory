const { randomBytes } = require('node:crypto');
const pool = require('../db/pool');
const bomService = require('./bomService');
const routingService = require('./routingService');
const inventoryService = require('./inventoryService');
const accountingService = require('./accountingService');
const productionRepository = require('../repositories/productionRepository');
const manufacturingRepository = require('../repositories/manufacturingRepository');
const ApiError = require('../utils/ApiError');

const buildOrderNumber = (prefix) => {
  const ts = Date.now().toString().slice(-8);
  const rand = randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${ts}-${rand}`;
};

const getProductionOrders = async (filters) => {
  const pageNum = Math.max(1, Number.parseInt(filters.page, 10) || 1);
  const pageSize = Math.min(1000, Math.max(1, Number.parseInt(filters.limit, 10) || 50));
  const offset = (pageNum - 1) * pageSize;
  const total = await productionRepository.getProductionOrdersCount(filters.status);
  const data = await productionRepository.getProductionOrders({ status: filters.status, limit: pageSize, offset });
  return { data, total, page: pageNum, limit: pageSize };
};

const getProductionOrderById = async (id) => {
  const order = await productionRepository.getProductionOrderById(id);
  if (!order) throw new ApiError(404, 'Production Order not found');

  order.work_orders = await manufacturingRepository.getWorkOrdersForProductionOrder(id);
  return order;
};

const createLegacyProductionOrder = async (data, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const quantity = Number.parseInt(data.quantity, 10);
    let resolvedProductId = data.product_id || null;
    if (!resolvedProductId && data.product_name) {
      const productResult = await client.query('SELECT id FROM products WHERE name = $1', [data.product_name]);
      resolvedProductId = productResult.rows[0]?.id || null;
    }

    let order = null;
    for (let i = 0; i < 5; i += 1) {
      const orderNum = buildOrderNumber('PO');
      try {
        const orderResult = await client.query(
          `INSERT INTO production_orders
           (order_number, product_id, product_name, quantity, status, start_date, due_date, notes)
           VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7)
           RETURNING *`,
          [orderNum, resolvedProductId, data.product_name, quantity, data.start_date || null, data.due_date || null, data.notes || null]
        );
        order = orderResult.rows[0];
        break;
      } catch (err) {
        if (err.code !== '23505') throw err;
      }
    }

    if (!order) throw new ApiError(500, 'Could not generate unique production order number');

    for (const material of data.materials || []) {
      const materialId = Number.parseInt(material.material_id, 10);
      const requiredQty = Number(material.quantity_used ?? material.quantity);
      const materialRow = await productionRepository.getMaterialForUpdate(client, materialId);
      if (!materialRow) throw new ApiError(400, `Material ${materialId} not found`);
      const availableQty = Number(materialRow.quantity || 0);
      if (requiredQty > availableQty) {
        throw new ApiError(400, `Insufficient stock for ${materialRow.name}. Required ${requiredQty}, available ${availableQty}`);
      }

      await productionRepository.insertProductionMaterial(client, order.id, materialId, requiredQty);
      await inventoryService.issueStock({
        item_type: 'material',
        item_id: materialId,
        quantity: requiredQty,
        reference_type: 'production_order',
        reference_id: order.id,
        user_id: userId,
        notes: `Production usage for order ${order.order_number}`,
      }, client);
    }

    await client.query('COMMIT');
    return await getProductionOrderById(order.id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const createProductionOrder = async (data, userId) => {
  if (data.product_name && Array.isArray(data.materials) && !data.bom_id && !data.routing_id) {
    return createLegacyProductionOrder(data, userId);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { product_id, quantity, bom_id, routing_id, assigned_to, start_date, due_date, notes } = data;

    // 1. Fetch BOM and Routing
    const bom = await bomService.getBomById(bom_id);
    const routing = await routingService.getRoutingById(routing_id);
    
    if (bom.product_id !== product_id) throw new ApiError(400, 'BOM does not match product');
    if (routing.product_id !== product_id) throw new ApiError(400, 'Routing does not match product');

    // 2. Generate Order Number & Insert
    const orderNum = buildOrderNumber('PO');
    const orderResult = await client.query(
      `INSERT INTO production_orders 
       (order_number, product_id, product_name, quantity, bom_id, routing_id, assigned_to, start_date, due_date, notes)
       VALUES ($1, $2, (SELECT name FROM products WHERE id = $2), $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [orderNum, product_id, quantity, bom_id, routing_id, assigned_to, start_date, due_date, notes]
    );
    const order = orderResult.rows[0];

    // 3. Create Work Orders based on Routing
    let previousEndDate = new Date(start_date || Date.now());
    for (const step of routing.steps) {
      // Very basic scheduling: just add standard time sequentially
      const scheduledStart = new Date(previousEndDate);
      const scheduledEnd = new Date(scheduledStart.getTime() + (step.standard_time_minutes * 60000));
      
      const wo = await manufacturingRepository.createWorkOrder({
        production_order_id: order.id,
        stage_id: step.stage_id,
        sequence_order: step.sequence_order,
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd
      }, client);

      previousEndDate = scheduledEnd;

      // 4. If this is the FIRST step, assign all materials and reserve stock
      if (step.sequence_order === 1) {
        for (const mat of bom.materials) {
          // Calculate planned quantity: (BOM qty / BOM base_qty) * order qty * (1 + scrap%)
          const ratio = Number(mat.quantity) / Number(bom.base_quantity);
          const scrapMultiplier = 1 + (Number(mat.scrap_percentage) / 100);
          const plannedQty = ratio * quantity * scrapMultiplier;

          await manufacturingRepository.createWorkOrderMaterial({
            work_order_id: wo.id,
            material_id: mat.material_id,
            planned_quantity: plannedQty
          }, client);

          // Reserve Stock in Inventory Ledger (assuming default warehouse 1 for now)
          await inventoryService.reserveStock({
            item_type: 'material',
            item_id: mat.material_id,
            warehouse_id: 1, // Need configurable warehouse in real life
            location_id: 1,  // Need configurable location
            quantity: plannedQty,
            reference_type: 'production_order',
            reference_id: order.id,
            user_id: userId,
            notes: `Reserved for PO ${orderNum}`
          }, client);
        }
      }
    }

    await client.query('COMMIT');
    return await getProductionOrderById(order.id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const updateProductionStatus = async (id, data) => {
  const current = await productionRepository.getProductionOrderBasic(id);
  if (!current) throw new ApiError(404, 'Production Order not found');

  const producedQty = data.produced_qty !== undefined && data.produced_qty !== null
    ? Number.parseInt(data.produced_qty, 10)
    : Number(current.produced_qty || 0);
  const targetQty = Number(current.quantity || 0);
  let status = data.status || current.status;
  if (producedQty >= targetQty && targetQty > 0) status = 'done';
  else if (producedQty > 0) status = 'in_progress';

  const updated = await productionRepository.updateProductionOrderStatus(id, status, producedQty);
  if (!updated) throw new ApiError(404, 'Production Order not found');
  return updated;
};

const completeWorkOrder = async (workOrderId, completionData, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get work order details
    const woResult = await client.query(`SELECT * FROM work_orders WHERE id = $1`, [workOrderId]);
    if (!woResult.rows.length) throw new ApiError(404, 'Work order not found');
    const wo = woResult.rows[0];
    
    const { produced_quantity, waste_quantity, rework_quantity, actual_start, actual_end, materials_consumed } = completionData;
    
    // If materials were consumed, issue them from inventory and update WO material
    let totalMaterialCost = 0;
    if (materials_consumed && materials_consumed.length > 0) {
      for (const mc of materials_consumed) {
        await manufacturingRepository.consumeWorkOrderMaterial(mc.work_order_material_id, mc.quantity, mc.waste, client);
        
        // Find material_id
        const womResult = await client.query(`SELECT material_id FROM work_order_materials WHERE id = $1`, [mc.work_order_material_id]);
        const materialId = womResult.rows[0].material_id;

        // Issue stock from inventory
        await inventoryService.issueStock({
          item_type: 'material',
          item_id: materialId,
          warehouse_id: 1, 
          location_id: 1,
          quantity: Number(mc.quantity) + Number(mc.waste),
          reference_type: 'work_order',
          reference_id: workOrderId,
          user_id: userId,
          notes: `Consumed by WO ${workOrderId}`
        }, client);

        // Calculate material cost (approximate using latest cost_per_unit)
        const matCostResult = await client.query(`SELECT cost_per_unit FROM materials WHERE id = $1`, [materialId]);
        totalMaterialCost += (Number(matCostResult.rows[0].cost_per_unit || 0) * (Number(mc.quantity) + Number(mc.waste)));
      }
    }

    // Calculate Labor and Machine Costs based on duration
    const durationHours = (new Date(actual_end).getTime() - new Date(actual_start).getTime()) / 3600000;
    const stageResult = await client.query(`SELECT cost_per_hour FROM production_stages WHERE id = $1`, [wo.stage_id]);
    const laborCost = Number(stageResult.rows[0].cost_per_hour || 0) * durationHours;
    const machineCost = wo.assigned_machine_id ? 10 * durationHours : 0; // Fake machine cost logic

    await manufacturingRepository.updateWorkOrderStatus(workOrderId, {
      status: 'completed',
      actual_start,
      actual_end,
      produced_quantity,
      waste_quantity,
      rework_quantity,
      labor_cost: laborCost,
      machine_cost: machineCost
    }, client);

    // Update parent PO total costs
    await client.query(
      `UPDATE production_orders 
       SET total_material_cost = total_material_cost + $1,
           total_labor_cost = total_labor_cost + $2,
           total_machine_cost = total_machine_cost + $3,
           updated_at = NOW()
       WHERE id = $4`,
      [totalMaterialCost, laborCost, machineCost, wo.production_order_id]
    );

    // Check if this was the last WO. If so, complete PO.
    const remainingWos = await client.query(
      `SELECT count(*) FROM work_orders WHERE production_order_id = $1 AND status != 'completed'`,
      [wo.production_order_id]
    );

    if (Number(remainingWos.rows[0].count) === 0) {
      await client.query(
        `UPDATE production_orders SET status = 'done', produced_qty = $1, updated_at = NOW() WHERE id = $2`,
        [produced_quantity, wo.production_order_id]
      );

      // Receive finished goods into inventory
      const poResult = await client.query(`SELECT product_id, order_number FROM production_orders WHERE id = $1`, [wo.production_order_id]);
      
      await inventoryService.receiveStock({
        item_type: 'product',
        item_id: poResult.rows[0].product_id,
        warehouse_id: 1, 
        location_id: 1,
        quantity: produced_quantity,
        reference_type: 'production_order',
        reference_id: wo.production_order_id,
        user_id: userId,
        notes: `Produced by PO ${poResult.rows[0].order_number}`
      }, client);

      const costRes = await client.query(
        `SELECT total_material_cost, total_labor_cost, total_machine_cost
         FROM production_orders WHERE id = $1`,
        [wo.production_order_id]
      );
      const completionCost =
        Number(costRes.rows[0]?.total_material_cost || 0) +
        Number(costRes.rows[0]?.total_labor_cost || 0) +
        Number(costRes.rows[0]?.total_machine_cost || 0);

      await accountingService.postProductionCompletion(
        { id: wo.production_order_id, order_number: poResult.rows[0].order_number },
        completionCost,
        client
      );
    } else {
       // Mark PO as in progress
       await client.query(
        `UPDATE production_orders SET status = 'in_progress', updated_at = NOW() WHERE id = $1`,
        [wo.production_order_id]
      );
    }

    await client.query('COMMIT');
    return await getProductionOrderById(wo.production_order_id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  getProductionOrders,
  getProductionOrderById,
  createProductionOrder,
  updateProductionStatus,
  completeWorkOrder
};
