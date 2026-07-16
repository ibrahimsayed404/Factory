require('dotenv').config();
const pool = require('../src/db/pool');

pool.query(`
  SELECT po.id, po.order_number, po.model_number, po.product_name, po.product_id, p.name AS catalog
  FROM production_orders po
  LEFT JOIN products p ON po.product_id = p.id
  ORDER BY po.id DESC
  LIMIT 5
`).then((r) => {
  console.log(JSON.stringify(r.rows, null, 2));
  return pool.end();
}).catch((e) => {
  console.error(e);
  pool.end();
});
