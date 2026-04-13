const pool = require('../../config/db');
const { randomBytes } = require('node:crypto');

const buildOrderNumber = (prefix) => {
  const ts = Date.now().toString().slice(-8);
  const rand = randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${ts}-${rand}`;
};

const makeError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

// GET /api/production
const getAll = async (req, res, next) => {
  try {
    const { status, page, limit: limitParam } = req.query;
    const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
    const pageSize = Math.min(1000, Math.max(1, Number.parseInt(limitParam, 10) || 50));
    const offset = (pageNum - 1) * pageSize;

    let countQuery = 'SELECT COUNT(*) FROM production_orders po WHERE 1=1';
    let query = `
      SELECT po.*, e.name AS assigned_to_name, so.order_number AS sales_order_number
      FROM production_orders po
      LEFT JOIN employees e ON po.assigned_to = e.id
      LEFT JOIN sales_orders so ON po.sales_order_id = so.id
      WHERE 1=1
    `;
    const params = [];
    if (status) {
      params.push(status);
      countQuery += ` AND po.status = $${params.length}`;
      query += ` AND po.status = $${params.length}`;
    }

    const countResult = await pool.query(countQuery, params);
    const total = Number.parseInt(countResult.rows[0].count, 10);

    const dataParams = [...params, pageSize, offset];
    query += ` ORDER BY po.due_date ASC LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`;
    const result = await pool.query(query, dataParams);
    res.json({ data: result.rows, total, page: pageNum, limit: pageSize });
  } catch (err) { next(err); }
};

// GET /api/production/:id
const getOne = async (req, res, next) => {
  try {
    const order = await pool.query(
      `SELECT po.*, e.name AS assigned_to_name FROM production_orders po
       LEFT JOIN employees e ON po.assigned_to = e.id WHERE po.id = $1`,
      [req.params.id]
    );
    if (!order.rows.length) return res.status(404).json({ error: 'Order not found' });

    const materials = await pool.query(
      `SELECT pm.*, m.name AS material_name, m.unit FROM production_materials pm
       JOIN materials m ON pm.material_id = m.id WHERE pm.production_order_id = $1`,
      [req.params.id]
    );
    res.json({ ...order.rows[0], materials: materials.rows });
  } catch (err) { next(err); }
};

// POST /api/production
const create = async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { product_name, quantity, sales_order_id, assigned_to, start_date, due_date, notes, materials = [] } = req.body;

    let order = null;
    for (let i = 0; i < 5; i += 1) {
      const orderNum = buildOrderNumber('PO');
      try {
        const result = await client.query(
          `INSERT INTO production_orders
           (order_number, product_name, quantity, sales_order_id, assigned_to, start_date, due_date, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [orderNum, product_name, quantity, sales_order_id, assigned_to, start_date, due_date, notes]
        );
        order = result.rows[0];
        break;
      } catch (err) {
        if (err.code !== '23505') throw err;
      }
    }

    if (!order) throw makeError(500, 'Could not generate unique production order number');

    for (const mat of materials) {
      const materialRes = await client.query(
        'SELECT id, name, quantity FROM materials WHERE id = $1 FOR UPDATE',
        [mat.material_id]
      );
      if (!materialRes.rows.length) {
        throw makeError(400, `Material ${mat.material_id} not found`);
      }

      const currentQty = Number(materialRes.rows[0].quantity || 0);
      const requiredQty = Number(mat.quantity_used || 0);
      if (requiredQty <= 0) {
        throw makeError(400, 'Material quantity_used must be greater than 0');
      }
      if (currentQty < requiredQty) {
        throw makeError(
          400,
          `Insufficient stock for ${materialRes.rows[0].name}. Required ${requiredQty}, available ${currentQty}`
        );
      }

      await client.query(
        `INSERT INTO production_materials (production_order_id, material_id, quantity_used)
         VALUES ($1,$2,$3)`,
        [order.id, mat.material_id, requiredQty]
      );
      // Deduct from inventory
      await client.query(
        'UPDATE materials SET quantity = quantity - $1, updated_at=NOW() WHERE id = $2',
        [requiredQty, mat.material_id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(order);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// PUT /api/production/:id/status
const updateStatus = async (req, res, next) => {
  try {
    const { status, produced_qty } = req.body;
    const current = await pool.query(
      'SELECT id, quantity, produced_qty, status FROM production_orders WHERE id = $1',
      [req.params.id]
    );
    if (!current.rows.length) return res.status(404).json({ error: 'Order not found' });

    const order = current.rows[0];
    const totalQuantity = Number(order.quantity || 0);
    const nextProducedQty = produced_qty === undefined || produced_qty === null || produced_qty === ''
      ? Number(order.produced_qty || 0)
      : Number(produced_qty);

    if (Number.isNaN(nextProducedQty) || nextProducedQty < 0) {
      throw makeError(400, 'produced_qty must be a non-negative number');
    }

    if (nextProducedQty > totalQuantity) {
      throw makeError(400, `produced_qty cannot exceed ordered quantity (${totalQuantity})`);
    }

    let resolvedStatus = status || order.status;
    if (produced_qty !== undefined && produced_qty !== null && produced_qty !== '') {
      if (nextProducedQty >= totalQuantity) {
        resolvedStatus = status === 'shipped' ? 'shipped' : 'done';
      } else if (nextProducedQty > 0) {
        resolvedStatus = 'in_progress';
      } else if (!status || status === 'done' || status === 'shipped') {
        resolvedStatus = 'pending';
      }
    }

    const result = await pool.query(
      `UPDATE production_orders SET status=COALESCE($1,status),
       produced_qty=COALESCE($2,produced_qty), updated_at=NOW()
       WHERE id=$3 RETURNING *`,
      [resolvedStatus, produced_qty === undefined || produced_qty === null || produced_qty === '' ? null : nextProducedQty, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

module.exports = { getAll, getOne, create, updateStatus };
