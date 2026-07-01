const pool = require('../db/pool');

const getAllProducts = async () => {
  const result = await pool.query('SELECT * FROM products ORDER BY name ASC');
  return result.rows;
};

const getProductById = async (id) => {
  const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
  return result.rows[0] || null;
};

const createProduct = async ({ name, sku, description, default_price }) => {
  const result = await pool.query(
    `INSERT INTO products (name, sku, description, default_price)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, sku || null, description || null, default_price || 0]
  );
  return result.rows[0];
};

const updateProduct = async (id, { name, sku, description, default_price }) => {
  const result = await pool.query(
    `UPDATE products 
     SET name = $1, sku = $2, description = $3, default_price = $4, updated_at = NOW()
     WHERE id = $5 RETURNING *`,
    [name, sku || null, description || null, default_price || 0, id]
  );
  return result.rows[0] || null;
};

const deleteProduct = async (id, client = pool) => {
  const result = await client.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
  return result.rows[0] || null;
};

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
