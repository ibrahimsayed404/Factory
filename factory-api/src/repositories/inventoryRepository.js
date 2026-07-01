const pool = require('../db/pool');

const createWarehouse = async ({ name, type, location_address }) => {
  const result = await pool.query(
    `INSERT INTO warehouses (id, name, type, location_address)
     VALUES (
       COALESCE((SELECT MAX(id) + 1 FROM warehouses), 1),
       $1,
       $2,
       $3
     )
     RETURNING *`,
    [name, type || 'internal', location_address]
  );
  return result.rows[0];
};

const getWarehouses = async () => {
  const result = await pool.query('SELECT * FROM warehouses ORDER BY id ASC');
  return result.rows;
};

const createLocation = async ({ warehouse_id, code, description }) => {
  const result = await pool.query(
    `INSERT INTO warehouse_locations (id, warehouse_id, code, description)
     VALUES (
       COALESCE((SELECT MAX(id) + 1 FROM warehouse_locations), 1),
       $1,
       $2,
       $3
     )
     RETURNING *`,
    [warehouse_id, code, description]
  );
  return result.rows[0];
};

const getLocations = async (warehouseId) => {
  let query = 'SELECT * FROM warehouse_locations';
  const params = [];
  if (warehouseId) {
    query += ' WHERE warehouse_id = $1';
    params.push(warehouseId);
  }
  query += ' ORDER BY code ASC';
  const result = await pool.query(query, params);
  return result.rows;
};

const insertTransaction = async (tx, client = pool) => {
  const {
    item_type,
    item_id,
    warehouse_id,
    location_id,
    quantity,
    transaction_type,
    batch_number,
    lot_number,
    barcode,
    qr_code,
    reference_type,
    reference_id,
    user_id,
    notes
  } = tx;

  const result = await client.query(
    `INSERT INTO inventory_transactions 
      (item_type, item_id, warehouse_id, location_id, quantity, transaction_type, 
       batch_number, lot_number, barcode, qr_code, reference_type, reference_id, user_id, notes) 
     VALUES (
       $1::inventory_item_type,
       $2::int,
       $3::int,
       $4::int,
       $5::numeric,
       $6::inventory_transaction_type,
       $7::varchar,
       $8::varchar,
       $9::varchar,
       $10::varchar,
       $11::varchar,
       $12::int,
       $13::int,
       $14::text
     ) RETURNING *`,
    [
      item_type, item_id, warehouse_id, location_id, quantity, transaction_type,
      batch_number || null, lot_number || null, barcode || null, qr_code || null,
      reference_type || null, reference_id || null, user_id || null, notes || null
    ]
  );
  return result.rows[0];
};

const getInventoryBalances = async ({ item_type, item_id, warehouse_id, location_id }, client = pool) => {
  let query = 'SELECT * FROM inventory_balances WHERE 1=1';
  const params = [];
  
  if (item_type) {
    params.push(item_type);
    query += ` AND item_type = $${params.length}`;
  }
  if (item_id) {
    params.push(item_id);
    query += ` AND item_id = $${params.length}`;
  }
  if (warehouse_id) {
    params.push(warehouse_id);
    query += ` AND warehouse_id = $${params.length}`;
  }
  if (location_id) {
    params.push(location_id);
    query += ` AND location_id = $${params.length}`;
  }

  query += ' ORDER BY id ASC';
  const result = await client.query(query, params);
  return result.rows;
};

const getLedgerHistory = async (filters = {}) => {
  let query = 'SELECT * FROM inventory_transactions WHERE 1=1';
  const params = [];
  
  if (filters.item_type) {
    params.push(filters.item_type);
    query += ` AND item_type = $${params.length}`;
  }
  if (filters.item_id) {
    params.push(filters.item_id);
    query += ` AND item_id = $${params.length}`;
  }
  if (filters.warehouse_id) {
    params.push(filters.warehouse_id);
    query += ` AND warehouse_id = $${params.length}`;
  }

  query += ' ORDER BY created_at DESC LIMIT 500';
  const result = await pool.query(query, params);
  return result.rows;
};

module.exports = {
  createWarehouse,
  getWarehouses,
  createLocation,
  getLocations,
  insertTransaction,
  getInventoryBalances,
  getLedgerHistory
};
