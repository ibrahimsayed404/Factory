
const pool = require('../../config/db');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');

// DELETE /api/sales/:id
const deleteOrder = async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Only allow deleting if not paid or shipped
    const orderRes = await client.query('SELECT * FROM sales_orders WHERE id = $1', [req.params.id]);
    if (!orderRes.rows.length) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const order = orderRes.rows[0];
    if (order.payment_status === 'paid' || order.status === 'shipped' || order.status === 'delivered') {
      return res.status(400).json({ error: 'Cannot delete a paid or shipped order' });
    }
    // Delete order items
    await client.query('DELETE FROM sales_order_items WHERE sales_order_id = $1', [req.params.id]);
    // Delete the order
    await client.query('DELETE FROM sales_orders WHERE id = $1', [req.params.id]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

const buildOrderNumber = (prefix) => {
  const ts = Date.now().toString().slice(-8);
  const rand = randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${ts}-${rand}`;
};

const recalculateCustomerOrderBalances = async (client, customerId) => {
  const payments = await client.query(
    `SELECT COALESCE(SUM(amount), 0)::float AS total
     FROM customer_payments
     WHERE customer_id = $1`,
    [customerId]
  );

  let remainingCredit = Number(payments.rows[0]?.total || 0);
  const orders = await client.query(
    `SELECT id, total_amount, status
     FROM sales_orders
     WHERE customer_id = $1
       AND status != 'cancelled'
     ORDER BY order_date ASC, id ASC`,
    [customerId]
  );

  for (const order of orders.rows) {
    const totalAmount = Number(order.total_amount || 0);
    const appliedAmount = Math.max(0, Math.min(totalAmount, remainingCredit));
    remainingCredit -= appliedAmount;

    let paymentStatus = 'pending';
    if (appliedAmount >= totalAmount && totalAmount > 0) paymentStatus = 'paid';
    else if (appliedAmount > 0) paymentStatus = 'invoiced';

    await client.query(
      `UPDATE sales_orders
       SET paid_amount = $1,
           payment_status = $2
       WHERE id = $3`,
      [appliedAmount, paymentStatus, order.id]
    );
  }
};

const createProductionOrderForItem = async (client, salesOrder, item, notes) => {
  for (let i = 0; i < 5; i += 1) {
    const orderNum = buildOrderNumber('PO');
    try {
      const result = await client.query(
        `INSERT INTO production_orders
         (order_number, product_name, quantity, sales_order_id, assigned_to, due_date, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [
          orderNum,
          item.product_name,
          item.quantity,
          salesOrder.id,
          null,
          salesOrder.delivery_date || null,
          notes,
        ]
      );
      return result.rows[0];
    } catch (err) {
      if (err.code !== '23505') throw err;
    }
  }

  const err = new Error('Could not generate unique production order number');
  err.status = 500;
  throw err;
};

// GET /api/customers (with pagination)
const getCustomers = async (req, res, next) => {
  try {
    const { page, limit: limitParam } = req.query;
    const pageNum  = Math.max(1, Number.parseInt(page, 10) || 1);
    const pageSize = Math.min(1000, Math.max(1, Number.parseInt(limitParam, 10) || 50));
    const offset   = (pageNum - 1) * pageSize;

    const countResult = await pool.query('SELECT COUNT(*) FROM customers');
    const total = Number.parseInt(countResult.rows[0].count, 10);

    const dataResult = await pool.query(
      `SELECT
         c.*,
         COALESCE(so.total_ordered, 0)::float AS total_ordered,
         COALESCE(cp.total_paid, 0)::float AS total_paid,
         GREATEST(COALESCE(so.total_ordered, 0) - COALESCE(cp.total_paid, 0), 0)::float AS remaining_balance,
         GREATEST(COALESCE(cp.total_paid, 0) - COALESCE(so.total_ordered, 0), 0)::float AS credit_balance
       FROM customers c
       LEFT JOIN (
         SELECT customer_id, SUM(total_amount)::float AS total_ordered
         FROM sales_orders
         WHERE status != 'cancelled'
         GROUP BY customer_id
       ) so ON so.customer_id = c.id
       LEFT JOIN (
         SELECT customer_id, SUM(amount)::float AS total_paid
         FROM customer_payments
         GROUP BY customer_id
       ) cp ON cp.customer_id = c.id
       ORDER BY c.name
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );
    res.json({ data: dataResult.rows, total, page: pageNum, limit: pageSize });
  } catch (err) { next(err); }
};

// POST /api/customers
const createCustomer = async (req, res, next) => {
  try {
    const { name, email, phone, address, city, country } = req.body;
    const result = await pool.query(
      `INSERT INTO customers (name, email, phone, address, city, country)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, email, phone, address, city, country]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
};

// GET /api/customers/:id/ledger
const getCustomerLedger = async (req, res, next) => {
  try {
    const customer = await pool.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    if (!customer.rows.length) return res.status(404).json({ error: 'Customer not found' });

    const [orders, payments, summary] = await Promise.all([
      pool.query(
        `SELECT so.*, COALESCE(SUM(soi.quantity), 0)::int AS total_products
         FROM sales_orders so
         LEFT JOIN sales_order_items soi ON soi.sales_order_id = so.id
         WHERE so.customer_id = $1
         GROUP BY so.id
         ORDER BY so.order_date DESC, so.id DESC`,
        [req.params.id]
      ),
      pool.query(
        `SELECT id, payment_date::text AS payment_date, amount, notes,
                evidence_url, evidence_name, evidence_mime, created_at
         FROM customer_payments
         WHERE customer_id = $1
         ORDER BY payment_date DESC, id DESC`,
        [req.params.id]
      ),
      pool.query(
        `SELECT
           COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total_amount ELSE 0 END), 0)::float AS total_ordered,
           COALESCE(SUM(CASE WHEN status IN ('shipped','delivered') THEN total_amount ELSE 0 END), 0)::float AS delivered_value,
           COALESCE(SUM(CASE WHEN status != 'cancelled' THEN paid_amount ELSE 0 END), 0)::float AS applied_paid,
           COALESCE((SELECT SUM(amount) FROM customer_payments WHERE customer_id = $1), 0)::float AS total_paid,
           COALESCE((SELECT SUM(soi.quantity)
                    FROM sales_order_items soi
                    JOIN sales_orders so2 ON so2.id = soi.sales_order_id
                    WHERE so2.customer_id = $1 AND so2.status != 'cancelled'), 0)::int AS total_products
         FROM sales_orders
         WHERE customer_id = $1`,
        [req.params.id]
      ),
    ]);

    const totals = summary.rows[0] || {};
    const totalOrdered = Number(totals.total_ordered || 0);
    const totalPaid = Number(totals.total_paid || 0);
    const remainingBalance = Math.max(0, totalOrdered - totalPaid);
    const creditBalance = Math.max(0, totalPaid - totalOrdered);

    res.json({
      customer: customer.rows[0],
      summary: {
        total_ordered: totalOrdered,
        delivered_value: Number(totals.delivered_value || 0),
        applied_paid: Number(totals.applied_paid || 0),
        total_paid: totalPaid,
        total_products: Number(totals.total_products || 0),
        remaining_balance: remainingBalance,
        credit_balance: creditBalance,
      },
      orders: orders.rows,
      payments: payments.rows,
    });
  } catch (err) { next(err); }
};

// POST /api/customers/:id/payments
const createCustomerPayment = async (req, res, next) => {
  const client = await pool.connect();
  let uploadedFilePath = null;
  try {
    await client.query('BEGIN');
    const customer = await client.query('SELECT id FROM customers WHERE id = $1', [req.params.id]);
    if (!customer.rows.length) {
      const err = new Error('Customer not found');
      err.status = 404;
      throw err;
    }

    const { amount, payment_date, notes } = req.body;
    const evidenceUrl = req.file ? `/api/uploads/payment-evidence/${req.file.filename}` : null;
    uploadedFilePath = req.file ? req.file.path : null;
    const evidenceName = req.file ? req.file.originalname : null;
    const evidenceMime = req.file ? req.file.mimetype : null;
    const inserted = await client.query(
      `INSERT INTO customer_payments (
        customer_id, payment_date, amount, notes, evidence_url, evidence_name, evidence_mime
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, customer_id, payment_date::text AS payment_date, amount, notes,
                 evidence_url, evidence_name, evidence_mime, created_at`,
      [
        req.params.id,
        payment_date || new Date().toISOString().slice(0, 10),
        amount,
        notes || null,
        evidenceUrl,
        evidenceName,
        evidenceMime,
      ]
    );

    await recalculateCustomerOrderBalances(client, req.params.id);

    await client.query('COMMIT');
    res.status(201).json(inserted.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      try {
        fs.unlinkSync(uploadedFilePath);
      } catch (unlinkErr) {
        console.warn('Failed to remove uploaded evidence after rollback:', unlinkErr.message);
      }
    }
      console.error('Error in createCustomerPayment:', {
        message: err.message,
        stack: err.stack,
        error: err,
        body: req.body
      });
      next(err);
  } finally {
    client.release();
  }
};

// GET /api/sales
const getOrders = async (req, res, next) => {
  try {
    const { status, payment_status, customer_id, page, limit: limitParam } = req.query;
    const pageNum  = Math.max(1, Number.parseInt(page, 10) || 1);
    const pageSize = Math.min(1000, Math.max(1, Number.parseInt(limitParam, 10) || 50));
    const offset   = (pageNum - 1) * pageSize;

    let baseWhere = 'WHERE 1=1';
    const params = [];
    if (status)         { params.push(status);       baseWhere += ` AND so.status = $${params.length}`; }
    if (payment_status) { params.push(payment_status); baseWhere += ` AND so.payment_status = $${params.length}`; }
    if (customer_id)    { params.push(customer_id);  baseWhere += ` AND so.customer_id = $${params.length}`; }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM sales_orders so ${baseWhere}`, params
    );
    const total = Number.parseInt(countResult.rows[0].count, 10);

    const dataParams = [...params, pageSize, offset];
    const dataResult = await pool.query(
      `SELECT so.*, c.name AS customer_name
       FROM sales_orders so
       LEFT JOIN customers c ON so.customer_id = c.id
       ${baseWhere}
       ORDER BY so.created_at DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    );

    res.json({ data: dataResult.rows, total, page: pageNum, limit: pageSize });
  } catch (err) { next(err); }
};

// GET /api/sales/:id
const getOrder = async (req, res, next) => {
  try {
    const order = await pool.query(
      `SELECT so.*, c.name AS customer_name FROM sales_orders so
       LEFT JOIN customers c ON so.customer_id = c.id WHERE so.id = $1`,
      [req.params.id]
    );
    if (!order.rows.length) return res.status(404).json({ error: 'Order not found' });
    const items = await pool.query('SELECT * FROM sales_order_items WHERE sales_order_id = $1', [req.params.id]);
    res.json({ ...order.rows[0], items: items.rows });
  } catch (err) { next(err); }
};

// POST /api/sales
const createOrder = async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { customer_id, delivery_date, notes, items = [] } = req.body;

    let order = null;
    for (let i = 0; i < 5; i += 1) {
      const orderNum = buildOrderNumber('SO');
      try {
        const orderRes = await client.query(
          `INSERT INTO sales_orders (order_number, customer_id, delivery_date, notes)
           VALUES ($1,$2,$3,$4) RETURNING *`,
          [orderNum, customer_id, delivery_date, notes]
        );
        order = orderRes.rows[0];
        break;
      } catch (err) {
        if (err.code !== '23505') throw err;
      }
    }

    if (!order) {
      const err = new Error('Could not generate unique sales order number');
      err.status = 500;
      throw err;
    }

    let total = 0;
    for (const item of items) {
      await client.query(
        `INSERT INTO sales_order_items (sales_order_id, product_name, quantity, unit_price)
         VALUES ($1,$2,$3,$4)`,
        [order.id, item.product_name, item.quantity, item.unit_price]
      );
      total += item.quantity * item.unit_price;

      await createProductionOrderForItem(
        client,
        order,
        item,
        `Auto-created from sales order ${order.order_number}`
      );
    }

    await client.query('UPDATE sales_orders SET total_amount=$1 WHERE id=$2', [total, order.id]);
    if (customer_id) {
      await recalculateCustomerOrderBalances(client, customer_id);
    }
    await client.query('COMMIT');
    res.status(201).json({ ...order, total_amount: total });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// PUT /api/sales/:id/status
const updateStatus = async (req, res, next) => {
  try {
    const { status, payment_status, paid_amount } = req.body;
    const result = await pool.query(
      `UPDATE sales_orders SET status=COALESCE($1,status),
       payment_status=COALESCE($2,payment_status),
       paid_amount=COALESCE($3,paid_amount) WHERE id=$4 RETURNING *`,
      [status, payment_status, paid_amount, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Order not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

module.exports = {
  getCustomers,
  createCustomer,
  getCustomerLedger,
  createCustomerPayment,
  getOrders,
  getOrder,
  createOrder,
  updateStatus,
  deleteOrder,
};
