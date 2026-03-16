const pool = require('../../config/db');

// GET /api/inventory — list all materials (with optional low-stock filter)
const getAll = async (req, res, next) => {
  try {
    const { low_stock, category, page, limit: limitParam } = req.query;
    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(1000, Math.max(1, parseInt(limitParam, 10) || 50));
    const offset   = (pageNum - 1) * pageSize;

    let baseWhere = 'WHERE 1=1';
    const params = [];
    if (low_stock === 'true') {
      baseWhere += ' AND quantity <= min_quantity';
    }
    if (category) {
      params.push(category);
      baseWhere += ` AND category = $${params.length}`;
    }

    const countResult = await pool.query(`SELECT COUNT(*) FROM materials ${baseWhere}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const dataParams = [...params, pageSize, offset];
    const dataResult = await pool.query(
      `SELECT * FROM materials ${baseWhere} ORDER BY name LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    );

    res.json({ data: dataResult.rows, total, page: pageNum, limit: pageSize });
  } catch (err) { next(err); }
};

// GET /api/inventory/:id
const getOne = async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM materials WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Material not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

// POST /api/inventory
const create = async (req, res, next) => {
  try {
    const { name, category, unit, quantity, min_quantity, cost_per_unit, supplier } = req.body;
    const result = await pool.query(
      `INSERT INTO materials (name, category, unit, quantity, min_quantity, cost_per_unit, supplier)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, category, unit, quantity, min_quantity, cost_per_unit, supplier]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
};

// PUT /api/inventory/:id
const update = async (req, res, next) => {
  try {
    const { name, category, unit, quantity, min_quantity, cost_per_unit, supplier } = req.body;
    const result = await pool.query(
      `UPDATE materials SET name=$1, category=$2, unit=$3, quantity=$4, min_quantity=$5,
       cost_per_unit=$6, supplier=$7, updated_at=NOW() WHERE id=$8 RETURNING *`,
      [name, category, unit, quantity, min_quantity, cost_per_unit, supplier, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Material not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

// DELETE /api/inventory/:id
const remove = async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM materials WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Material not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) { next(err); }
};

module.exports = { getAll, getOne, create, update, remove };
