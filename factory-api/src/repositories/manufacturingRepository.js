const pool = require('../db/pool');

// ============================
// BILL OF MATERIALS (BOM)
// ============================
const createBom = async (bomData, materials, client = pool) => {
  const { product_id, name, version, base_quantity } = bomData;
  const bomResult = await client.query(
    `INSERT INTO boms (product_id, name, version, base_quantity)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [product_id, name, version, base_quantity]
  );
  const bom = bomResult.rows[0];

  const matPromises = materials.map(mat => 
    client.query(
      `INSERT INTO bom_materials (bom_id, material_id, quantity, scrap_percentage, notes)
       VALUES ($1, $2, $3, $4, $5)`,
      [bom.id, mat.material_id, mat.quantity, mat.scrap_percentage || 0, mat.notes]
    )
  );
  await Promise.all(matPromises);

  return bom;
};

const getBoms = async (productId) => {
  let query = `SELECT b.*, p.name as product_name FROM boms b JOIN products p ON b.product_id = p.id`;
  const params = [];
  if (productId) {
    query += ` WHERE b.product_id = $1`;
    params.push(productId);
  }
  query += ` ORDER BY b.created_at DESC`;
  const result = await pool.query(query, params);
  return result.rows;
};

const getBomById = async (id, client = pool) => {
  const bomResult = await client.query(`SELECT * FROM boms WHERE id = $1`, [id]);
  if (!bomResult.rows.length) return null;
  const bom = bomResult.rows[0];

  const matsResult = await client.query(
    `SELECT bm.*, m.name as material_name, m.unit 
     FROM bom_materials bm
     JOIN materials m ON bm.material_id = m.id
     WHERE bm.bom_id = $1`,
    [id]
  );
  bom.materials = matsResult.rows;
  return bom;
};

// ============================
// PRODUCTION STAGES
// ============================
const getProductionStages = async () => {
  const result = await pool.query(`SELECT * FROM production_stages WHERE is_active = true ORDER BY name ASC`);
  return result.rows;
};

const createProductionStage = async (stageData) => {
  const { name, description, cost_per_hour } = stageData;
  const result = await pool.query(
    `INSERT INTO production_stages (name, description, cost_per_hour) VALUES ($1, $2, $3) RETURNING *`,
    [name, description, cost_per_hour]
  );
  return result.rows[0];
};

// ============================
// ROUTINGS
// ============================
const createRouting = async (routingData, steps, client = pool) => {
  const { product_id, name } = routingData;
  const routeResult = await client.query(
    `INSERT INTO routings (product_id, name) VALUES ($1, $2) RETURNING *`,
    [product_id, name]
  );
  const routing = routeResult.rows[0];

  const stepPromises = steps.map((step, idx) => 
    client.query(
      `INSERT INTO routing_steps (routing_id, stage_id, sequence_order, standard_time_minutes, instructions)
       VALUES ($1, $2, $3, $4, $5)`,
      [routing.id, step.stage_id, step.sequence_order || (idx + 1), step.standard_time_minutes || 0, step.instructions]
    )
  );
  await Promise.all(stepPromises);

  return routing;
};

const getRoutings = async (productId) => {
  let query = `SELECT r.*, p.name as product_name FROM routings r JOIN products p ON r.product_id = p.id`;
  const params = [];
  if (productId) {
    query += ` WHERE r.product_id = $1`;
    params.push(productId);
  }
  query += ` ORDER BY r.created_at DESC`;
  const result = await pool.query(query, params);
  return result.rows;
};

const getRoutingById = async (id, client = pool) => {
  const routeResult = await client.query(`SELECT * FROM routings WHERE id = $1`, [id]);
  if (!routeResult.rows.length) return null;
  const routing = routeResult.rows[0];

  const stepsResult = await client.query(
    `SELECT rs.*, s.name as stage_name, s.cost_per_hour
     FROM routing_steps rs
     JOIN production_stages s ON rs.stage_id = s.id
     WHERE rs.routing_id = $1
     ORDER BY rs.sequence_order ASC`,
    [id]
  );
  routing.steps = stepsResult.rows;
  return routing;
};

// ============================
// WORK ORDERS
// ============================
const createWorkOrder = async (woData, client = pool) => {
  const { production_order_id, stage_id, sequence_order, scheduled_start, scheduled_end } = woData;
  const result = await client.query(
    `INSERT INTO work_orders (production_order_id, stage_id, sequence_order, scheduled_start, scheduled_end)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [production_order_id, stage_id, sequence_order, scheduled_start, scheduled_end]
  );
  return result.rows[0];
};

const createWorkOrderMaterial = async (womData, client = pool) => {
  const { work_order_id, material_id, planned_quantity } = womData;
  const result = await client.query(
    `INSERT INTO work_order_materials (work_order_id, material_id, planned_quantity)
     VALUES ($1, $2, $3) RETURNING *`,
    [work_order_id, material_id, planned_quantity]
  );
  return result.rows[0];
};

const getWorkOrdersForProductionOrder = async (orderId, client = pool) => {
  const result = await client.query(
    `SELECT wo.*, s.name as stage_name, s.cost_per_hour
     FROM work_orders wo
     JOIN production_stages s ON wo.stage_id = s.id
     WHERE wo.production_order_id = $1
     ORDER BY wo.sequence_order ASC`,
    [orderId]
  );

  const workOrders = result.rows;
  
  // Get materials for each work order
  for (const wo of workOrders) {
    const matResult = await client.query(
      `SELECT wom.*, m.name as material_name, m.unit
       FROM work_order_materials wom
       JOIN materials m ON wom.material_id = m.id
       WHERE wom.work_order_id = $1`,
      [wo.id]
    );
    wo.materials = matResult.rows;
  }

  return workOrders;
};

const updateWorkOrderStatus = async (id, updateData, client = pool) => {
  const { status, actual_start, actual_end, assigned_machine_id, assigned_employee_id, produced_quantity, waste_quantity, rework_quantity, labor_cost, machine_cost } = updateData;
  
  const updates = [];
  const params = [];
  let paramIdx = 1;

  if (status !== undefined) { updates.push(`status = $${paramIdx++}`); params.push(status); }
  if (actual_start !== undefined) { updates.push(`actual_start = $${paramIdx++}`); params.push(actual_start); }
  if (actual_end !== undefined) { updates.push(`actual_end = $${paramIdx++}`); params.push(actual_end); }
  if (assigned_machine_id !== undefined) { updates.push(`assigned_machine_id = $${paramIdx++}`); params.push(assigned_machine_id); }
  if (assigned_employee_id !== undefined) { updates.push(`assigned_employee_id = $${paramIdx++}`); params.push(assigned_employee_id); }
  if (produced_quantity !== undefined) { updates.push(`produced_quantity = $${paramIdx++}`); params.push(produced_quantity); }
  if (waste_quantity !== undefined) { updates.push(`waste_quantity = $${paramIdx++}`); params.push(waste_quantity); }
  if (rework_quantity !== undefined) { updates.push(`rework_quantity = $${paramIdx++}`); params.push(rework_quantity); }
  if (labor_cost !== undefined) { updates.push(`labor_cost = $${paramIdx++}`); params.push(labor_cost); }
  if (machine_cost !== undefined) { updates.push(`machine_cost = $${paramIdx++}`); params.push(machine_cost); }

  updates.push(`updated_at = NOW()`);
  params.push(id);

  const query = `UPDATE work_orders SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`;
  const result = await client.query(query, params);
  return result.rows[0];
};

const consumeWorkOrderMaterial = async (womId, qtyToConsume, qtyWaste, client = pool) => {
  const result = await client.query(
    `UPDATE work_order_materials 
     SET consumed_quantity = consumed_quantity + $1,
         waste_quantity = waste_quantity + $2
     WHERE id = $3 RETURNING *`,
    [qtyToConsume, qtyWaste, womId]
  );
  return result.rows[0];
};

module.exports = {
  createBom,
  getBoms,
  getBomById,
  getProductionStages,
  createProductionStage,
  createRouting,
  getRoutings,
  getRoutingById,
  createWorkOrder,
  createWorkOrderMaterial,
  getWorkOrdersForProductionOrder,
  updateWorkOrderStatus,
  consumeWorkOrderMaterial
};
