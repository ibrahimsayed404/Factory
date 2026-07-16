require('dotenv').config();
const productionTrackingService = require('../src/services/productionTrackingService');
const pool = require('../src/db/pool');

(async () => {
  try {
    await productionTrackingService.listProductionOrders({ limit: 1 });
    const result = await pool.query(`
      SELECT po.id, po.model_number, po.product_name, po.product_id, p.name AS catalog
      FROM production_orders po
      LEFT JOIN products p ON po.product_id = p.id
      ORDER BY po.id DESC
      LIMIT 10
    `);
    console.log('Orders after repair:');
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
})();
