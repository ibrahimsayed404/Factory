const pool = require('../db/pool');

// =======================
// SUPPLIERS
// =======================
const createSupplier = async (supplierData) => {
  const { name, email, phone, address, city, country, rating } = supplierData;
  const result = await pool.query(
    `INSERT INTO suppliers (name, email, phone, address, city, country, rating)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [name, email, phone, address, city, country, rating]
  );
  return result.rows[0];
};

const getSuppliers = async () => {
  const result = await pool.query(
    `SELECT * FROM suppliers ORDER BY created_at DESC`
  );
  return result.rows;
};

const getSupplierById = async (id) => {
  const result = await pool.query(
    `SELECT * FROM suppliers WHERE id = $1`,
    [id]
  );
  return result.rows[0];
};

// =======================
// PURCHASE REQUESTS
// =======================
const createPurchaseRequest = async (prData, items, client = pool) => {
  const { request_number, requested_by, required_date, total_estimated_amount, notes } = prData;
  
  const prResult = await client.query(
    `INSERT INTO purchase_requests (request_number, requested_by, required_date, total_estimated_amount, notes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [request_number, requested_by, required_date, total_estimated_amount, notes]
  );
  const pr = prResult.rows[0];

  const itemPromises = items.map(item => 
    client.query(
      `INSERT INTO purchase_request_items (purchase_request_id, material_id, material_name, quantity, estimated_unit_price)
       VALUES ($1, $2, $3, $4, $5)`,
      [pr.id, item.material_id, item.material_name, item.quantity, item.estimated_unit_price]
    )
  );
  await Promise.all(itemPromises);

  return pr;
};

const getPurchaseRequests = async () => {
  const result = await pool.query(
    `SELECT pr.*, u.name as requested_by_name
     FROM purchase_requests pr
     LEFT JOIN users u ON pr.requested_by = u.id
     ORDER BY pr.created_at DESC`
  );
  return result.rows;
};

const getPurchaseRequestById = async (id) => {
  const prResult = await pool.query(`SELECT * FROM purchase_requests WHERE id = $1`, [id]);
  if (!prResult.rows.length) return null;

  const itemsResult = await pool.query(`SELECT * FROM purchase_request_items WHERE purchase_request_id = $1`, [id]);
  return { ...prResult.rows[0], items: itemsResult.rows };
};

const updatePurchaseRequestStatus = async (id, status, client = pool) => {
  const result = await client.query(
    `UPDATE purchase_requests SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [status, id]
  );
  return result.rows[0];
};

// =======================
// PURCHASE ORDERS
// =======================
const createPurchaseOrder = async (poData, items, client = pool) => {
  const { 
    order_number, purchase_request_id, supplier_id, expected_delivery_date, 
    total_amount, notes, created_by 
  } = poData;
  
  const poResult = await client.query(
    `INSERT INTO purchase_orders (order_number, purchase_request_id, supplier_id, expected_delivery_date, total_amount, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [order_number, purchase_request_id, supplier_id, expected_delivery_date, total_amount, notes, created_by]
  );
  const po = poResult.rows[0];

  const itemPromises = items.map(item => 
    client.query(
      `INSERT INTO purchase_order_items (purchase_order_id, material_id, material_name, ordered_quantity, unit_price)
       VALUES ($1, $2, $3, $4, $5)`,
      [po.id, item.material_id, item.material_name, item.ordered_quantity, item.unit_price]
    )
  );
  await Promise.all(itemPromises);

  return po;
};

const getPurchaseOrders = async () => {
  const result = await pool.query(
    `SELECT po.*, s.name as supplier_name, u.name as created_by_name
     FROM purchase_orders po
     LEFT JOIN suppliers s ON po.supplier_id = s.id
     LEFT JOIN users u ON po.created_by = u.id
     ORDER BY po.created_at DESC`
  );
  return result.rows;
};

const getPurchaseOrderById = async (id, client = pool) => {
  const poResult = await client.query(
    `SELECT po.*, s.name as supplier_name 
     FROM purchase_orders po
     LEFT JOIN suppliers s ON po.supplier_id = s.id
     WHERE po.id = $1`, [id]
  );
  if (!poResult.rows.length) return null;

  const itemsResult = await client.query(`SELECT * FROM purchase_order_items WHERE purchase_order_id = $1`, [id]);
  return { ...poResult.rows[0], items: itemsResult.rows };
};

const updatePurchaseOrderStatus = async (id, status, client = pool) => {
  const result = await client.query(
    `UPDATE purchase_orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [status, id]
  );
  return result.rows[0];
};

const updatePurchaseOrderItemReceived = async (itemId, receivedQty, client = pool) => {
  const result = await client.query(
    `UPDATE purchase_order_items 
     SET received_quantity = received_quantity + $1 
     WHERE id = $2 RETURNING *`,
    [receivedQty, itemId]
  );
  return result.rows[0];
};

const updatePurchaseOrderDeliveryDate = async (poId, client = pool) => {
  await client.query(
    `UPDATE purchase_orders SET actual_delivery_date = CURRENT_DATE, updated_at = NOW() WHERE id = $1`,
    [poId]
  );
};

// =======================
// SUPPLIER PAYMENTS
// =======================
const createSupplierPayment = async (paymentData, client = pool) => {
  const { supplier_id, purchase_order_id, payment_date, amount, payment_method, reference_number, notes, created_by } = paymentData;
  const result = await client.query(
    `INSERT INTO supplier_payments (supplier_id, purchase_order_id, payment_date, amount, payment_method, reference_number, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [supplier_id, purchase_order_id, payment_date, amount, payment_method, reference_number, notes, created_by]
  );

  if (purchase_order_id) {
    await client.query(
      `UPDATE purchase_orders 
       SET paid_amount = paid_amount + $1,
           payment_status = CASE 
             WHEN paid_amount + $1 >= total_amount THEN 'paid'
             ELSE 'partial'
           END,
           updated_at = NOW()
       WHERE id = $2`,
      [amount, purchase_order_id]
    );
  }

  return result.rows[0];
};

const getSupplierLedger = async (supplierId) => {
  // Sum of total PO amounts vs paid amounts
  const result = await pool.query(
    `SELECT 
       COALESCE(SUM(total_amount), 0) as total_ordered,
       COALESCE(SUM(paid_amount), 0) as total_paid
     FROM purchase_orders 
     WHERE supplier_id = $1 AND status NOT IN ('draft', 'cancelled')`,
    [supplierId]
  );
  
  // Get all payments just to be safe
  const paymentsResult = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) as total_direct_payments 
     FROM supplier_payments 
     WHERE supplier_id = $1`,
    [supplierId]
  );

  return {
    total_ordered: result.rows[0].total_ordered,
    total_paid_via_po: result.rows[0].total_paid,
    total_payments: paymentsResult.rows[0].total_direct_payments,
    balance: Number(result.rows[0].total_ordered) - Number(paymentsResult.rows[0].total_direct_payments)
  };
};

module.exports = {
  createSupplier,
  getSuppliers,
  getSupplierById,
  createPurchaseRequest,
  getPurchaseRequests,
  getPurchaseRequestById,
  updatePurchaseRequestStatus,
  createPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrderStatus,
  updatePurchaseOrderItemReceived,
  updatePurchaseOrderDeliveryDate,
  createSupplierPayment,
  getSupplierLedger
};
