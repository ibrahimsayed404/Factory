require('dotenv').config();
if (process.env.DB_HOST && (process.env.DB_HOST.includes('supabase') || process.env.DB_HOST.includes('pooler'))) {
  throw new Error('SAFETY BLOCK: Integration tests are disabled on cloud Supabase DB to prevent data deletion.');
}
const request = require('supertest');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const app = require('../../src/app');
const pool = require('../../src/db/pool');

const schemaPath = path.join(__dirname, '..', '..', 'src', 'db', 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');

const resetData = async () => {
  await pool.query(`
    TRUNCATE TABLE
      inventory_transactions,
      inventory_balances,
      warehouse_locations,
      warehouses,
      production_phases,
      production_materials,
      production_orders,
      sales_order_items,
      sales_orders,
      customers,
      payroll,
      attendance,
      employees,
      materials,
      products,
      departments,
      users
    RESTART IDENTITY CASCADE
  `);
};

const createAdminAndLogin = async () => {
  const password = 'AdminPass123!';
  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users (name, email, password, role)
     VALUES ($1, $2, $3, 'admin')`,
    ['Admin User', 'admin@test.com', hash]
  );

  const agent = request.agent(app);
  const login = await agent
    .post('/api/auth/login')
    .send({ email: 'admin@test.com', password });

  expect(login.status).toBe(200);
  return agent;
};

beforeAll(async () => {
  await pool.query(schemaSql);
  await resetData();
});

afterAll(async () => {
  await pool.end();
});

describe('Inventory Ledger System', () => {
  let agent;
  let materialId;
  let productId;
  let warehouseId = 1; // Default
  let locationId = 1; // Default

  beforeAll(async () => {
    agent = await createAdminAndLogin();
    
    // Ensure default warehouse exists
    await pool.query(`INSERT INTO warehouses (id, name, type) VALUES (1, 'Main', 'internal') ON CONFLICT DO NOTHING`);
    await pool.query(`INSERT INTO warehouse_locations (id, warehouse_id, code) VALUES (1, 1, 'LOC1') ON CONFLICT DO NOTHING`);

    // Create a material and product
    const matRes = await pool.query(`INSERT INTO materials (name, unit, quantity) VALUES ('Cotton', 'kg', 0) RETURNING id`);
    materialId = matRes.rows[0].id;

    const prodRes = await pool.query(`INSERT INTO products (name, default_price, quantity) VALUES ('Shirt', 20.00, 0) RETURNING id`);
    productId = prodRes.rows[0].id;
  });

  afterEach(async () => {
    await pool.query(`TRUNCATE TABLE inventory_transactions, inventory_balances RESTART IDENTITY CASCADE`);
    await pool.query(`UPDATE materials SET quantity = 0`);
    await pool.query(`UPDATE products SET quantity = 0`);
  });

  it('receives stock, updates ledger, and cascades quantity to legacy material', async () => {
    const res = await agent.post('/api/inventory/receive').send({
      item_type: 'material',
      item_id: materialId,
      quantity: 500,
      batch_number: 'B-100',
    });

    expect(res.status).toBe(201);
    expect(res.body.quantity).toBe('500.00'); // pg numeric

    // Check Balances
    const balRes = await agent.get(`/api/inventory-ledger/balances?item_type=material&item_id=${materialId}`);
    expect(balRes.body.length).toBe(1);
    expect(balRes.body[0].quantity_on_hand).toBe('500.00');
    expect(balRes.body[0].batch_number).toBe('B-100');

    // Check legacy materials table
    const matDb = await pool.query(`SELECT quantity FROM materials WHERE id = $1`, [materialId]);
    expect(matDb.rows[0].quantity).toBe('500.00');
  });

  it('issues stock and correctly adjusts balance downwards', async () => {
    // Manually add 100 first
    await agent.post('/api/inventory/receive').send({
      item_type: 'product',
      item_id: productId,
      quantity: 100,
    });

    const res = await agent.post('/api/inventory/issue').send({
      item_type: 'product',
      item_id: productId,
      quantity: 30,
      notes: 'Sale'
    });
    
    expect(res.status).toBe(201);
    expect(Number(res.body.quantity)).toBe(-30);

    const balRes = await agent.get(`/api/inventory-ledger/balances?item_type=product&item_id=${productId}`);
    expect(Number(balRes.body[0].quantity_on_hand)).toBe(70);
  });

  it('creates ledger entries on stock transfer', async () => {
    // Add second warehouse
    const locRes = await agent.post('/api/inventory/locations').send({
      warehouse_id: warehouseId,
      code: 'LOC-2',
    });
    const loc2 = locRes.body.id;

    // Receive 200 in Loc 1
    await agent.post('/api/inventory/receive').send({
      item_type: 'material',
      item_id: materialId,
      quantity: 200,
    });

    // Transfer 50 to Loc 2
    const transfer = await agent.post('/api/inventory/transfer').send({
      item_type: 'material',
      item_id: materialId,
      quantity: 50,
      from_warehouse_id: warehouseId,
      to_warehouse_id: warehouseId,
      to_location_id: loc2
    });

    expect(transfer.status).toBe(200);

    // Ledger should have an OUT and IN
    const ledger = await agent.get(`/api/inventory-ledger/history`);
    // Index 0 is the IN, Index 1 is the OUT, Index 2 is the initial Receive
    expect(ledger.body[0].transaction_type).toBe('in');
    expect(ledger.body[1].transaction_type).toBe('out');

    const bals = await agent.get(`/api/inventory-ledger/balances?item_type=material&item_id=${materialId}`);
    expect(bals.body.length).toBe(2);

    const l1 = bals.body.find(b => b.location_id === locationId);
    const l2 = bals.body.find(b => b.location_id === loc2);
    
    expect(Number(l1.quantity_on_hand)).toBe(150);
    expect(Number(l2.quantity_on_hand)).toBe(50);
  });
});
