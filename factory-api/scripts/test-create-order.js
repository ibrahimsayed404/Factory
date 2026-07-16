require('dotenv').config();
const productionTrackingService = require('../src/services/productionTrackingService');
const pool = require('../src/db/pool');

(async () => {
  try {
    const created = await productionTrackingService.createProductionOrder({
      modelNumber: '6002',
      productName: 'Shirt',
      product_id: 1,
      quantity: 100,
      materials: [],
    });
    console.log('Created:', JSON.stringify({
      id: created.id,
      model_number: created.model_number,
      product_name: created.product_name,
      product_id: created.product_id,
      catalog_product_name: created.catalog_product_name,
    }, null, 2));

    const list = await productionTrackingService.listProductionOrders({ limit: 5 });
    const row = list.data.find((o) => o.id === created.id);
    console.log('Listed:', JSON.stringify({
      id: row.id,
      model_number: row.model_number,
      product_name: row.product_name,
      product_id: row.product_id,
      catalog_product_name: row.catalog_product_name,
    }, null, 2));

    await pool.query('DELETE FROM production_phases WHERE order_id = $1', [created.id]);
    await pool.query('DELETE FROM production_orders WHERE id = $1', [created.id]);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
})();
