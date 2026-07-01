const pool = require('../db/pool');

const getProductionOrdersCount = async (status) => {
  let countQuery = 'SELECT COUNT(*) FROM production_orders po WHERE 1=1';
  const params = [];
  if (status) {
    params.push(status);
    countQuery += ` AND po.status = $${params.length}`;
  }
  const countResult = await pool.query(countQuery, params);
  return Number.parseInt(countResult.rows[0].count, 10);
};

const getProductionOrders = async ({ status, limit, offset }) => {
  let query = `
    SELECT po.*, COALESCE(p.name, po.product_name) AS product_name,
           e.name AS assigned_to_name, so.order_number AS sales_order_number
    FROM production_orders po
    LEFT JOIN products p ON po.product_id = p.id
    LEFT JOIN employees e ON po.assigned_to = e.id
    LEFT JOIN sales_orders so ON po.sales_order_id = so.id
    WHERE 1=1
  `;
  const params = [];
  if (status) {
    params.push(status);
    query += ` AND po.status = $${params.length}`;
  }
  
  const dataParams = [...params, limit, offset];
  query += ` ORDER BY po.due_date ASC LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`;
  
  const result = await pool.query(query, dataParams);
  return result.rows;
};

const getProductionOrderById = async (id) => {
  const result = await pool.query(
    `SELECT po.*, COALESCE(p.name, po.product_name) AS product_name, e.name AS assigned_to_name FROM production_orders po
     LEFT JOIN products p ON po.product_id = p.id
     LEFT JOIN employees e ON po.assigned_to = e.id WHERE po.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const getProductionOrderMaterials = async (orderId) => {
  const result = await pool.query(
    `SELECT pm.*, m.name AS material_name, m.unit FROM production_materials pm
     JOIN materials m ON pm.material_id = m.id WHERE pm.production_order_id = $1`,
    [orderId]
  );
  return result.rows;
};

const insertProductionOrder = async (client, { orderNum, product_name, quantity, sales_order_id, assigned_to, start_date, due_date, notes }) => {
  const result = await client.query(
    `INSERT INTO production_orders
     (order_number, product_name, quantity, sales_order_id, assigned_to, start_date, due_date, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [orderNum, product_name, quantity, sales_order_id, assigned_to, start_date, due_date, notes]
  );
  return result.rows[0];
};

const getMaterialForUpdate = async (client, materialId) => {
  const result = await client.query(
    'SELECT id, name, quantity FROM materials WHERE id = $1 FOR UPDATE',
    [materialId]
  );
  return result.rows[0] || null;
};

const insertProductionMaterial = async (client, orderId, materialId, quantityUsed) => {
  await client.query(
    `INSERT INTO production_materials (production_order_id, material_id, quantity_used)
     VALUES ($1,$2,$3)`,
    [orderId, materialId, quantityUsed]
  );
};

const deductMaterialQuantity = async (client, materialId, quantityUsed) => {
  await client.query(
    'UPDATE materials SET quantity = quantity - $1, updated_at=NOW() WHERE id = $2',
    [quantityUsed, materialId]
  );
};

const getProductionOrderBasic = async (id) => {
  const result = await pool.query(
    'SELECT id, quantity, produced_qty, status FROM production_orders WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
};

const updateProductionOrderStatus = async (id, status, producedQty) => {
  const result = await pool.query(
    `UPDATE production_orders SET status=COALESCE($1,status),
     produced_qty=COALESCE($2,produced_qty), updated_at=NOW()
     WHERE id=$3 RETURNING *`,
    [status, producedQty, id]
  );
  return result.rows[0] || null;
};

module.exports = {
  getProductionOrdersCount,
  getProductionOrders,
  getProductionOrderById,
  getProductionOrderMaterials,
  insertProductionOrder,
  getMaterialForUpdate,
  insertProductionMaterial,
  deductMaterialQuantity,
  getProductionOrderBasic,
  updateProductionOrderStatus,
};
