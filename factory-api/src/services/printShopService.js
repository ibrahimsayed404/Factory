const pool = require('../db/pool');
const ApiError = require('../utils/ApiError');

const listPrintShops = async () => {
  const query = `
    SELECT 
      ps.*,
      COUNT(po.id) FILTER (WHERE po.current_stage = 'printing') AS active_printing_orders,
      COALESCE(SUM(po.total_print_sent_quantity) FILTER (WHERE po.current_stage = 'printing'), 0) AS active_printing_pieces,
      COUNT(po.id) AS total_orders_handled
    FROM print_shops ps
    LEFT JOIN production_orders po ON ps.id = po.print_shop_id
    WHERE ps.status = 'active'
    GROUP BY ps.id
    ORDER BY ps.name ASC
  `;
  const result = await pool.query(query);
  return result.rows;
};

const getPrintShopById = async (id) => {
  const result = await pool.query('SELECT * FROM print_shops WHERE id = $1', [id]);
  if (result.rows.length === 0) throw new ApiError(404, 'المطبعة غير موجودة');
  return result.rows[0];
};

const createPrintShop = async ({ name, contact_person, phone, address, notes }) => {
  const shopName = String(name || '').trim();
  if (!shopName) throw new ApiError(400, 'اسم المطبعة مطلوب');

  const result = await pool.query(
    `INSERT INTO print_shops (name, contact_person, phone, address, notes, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'active', NOW(), NOW())
     RETURNING *`,
    [shopName, contact_person || null, phone || null, address || null, notes || null]
  );

  return result.rows[0];
};

const updatePrintShop = async (id, { name, contact_person, phone, address, notes }) => {
  const shopName = String(name || '').trim();
  if (!shopName) throw new ApiError(400, 'اسم المطبعة مطلوب');

  const result = await pool.query(
    `UPDATE print_shops
     SET name = $1,
         contact_person = $2,
         phone = $3,
         address = $4,
         notes = $5,
         updated_at = NOW()
     WHERE id = $6
     RETURNING *`,
    [shopName, contact_person || null, phone || null, address || null, notes || null, id]
  );

  if (result.rows.length === 0) throw new ApiError(404, 'المطبعة غير موجودة');
  return result.rows[0];
};

const deletePrintShop = async (id) => {
  // Check if any order is currently in printing stage at this shop
  const activeRes = await pool.query(
    `SELECT count(*) FROM production_orders WHERE print_shop_id = $1 AND current_stage = 'printing'`,
    [id]
  );
  if (Number(activeRes.rows[0].count) > 0) {
    throw new ApiError(400, 'لا يمكن حذف المطبعة لوجود أوردرات تحت الطباعة حالياً بها');
  }

  // Soft-delete
  const result = await pool.query(
    `UPDATE print_shops SET status = 'archived', updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );
  if (result.rows.length === 0) throw new ApiError(404, 'المطبعة غير موجودة');

  return { success: true, message: 'تم أرشفة المطبعة بنجاح' };
};

module.exports = {
  listPrintShops,
  getPrintShopById,
  createPrintShop,
  updatePrintShop,
  deletePrintShop,
};
