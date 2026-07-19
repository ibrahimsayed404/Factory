require('dotenv').config();
if (process.env.DB_HOST && (process.env.DB_HOST.includes('supabase') || process.env.DB_HOST.includes('pooler'))) {
  throw new Error('SAFETY BLOCK: Integration tests are disabled on cloud Supabase DB to prevent data deletion.');
}
const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/db/pool');
const bcrypt = require('bcryptjs');

let token;
let supplierId;
let prId;
let poId;
let materialId;
let warehouseId = 1; // Default
let locationId = 1; // Default

// A simplified schema setup for the test, assuming the full schema runs via setup-tests if present.
// We will rely on the global beforeAll / schema setup if any, or just insert what we need.

const fs = require('node:fs');
const path = require('node:path');

const schemaPath = path.join(__dirname, '..', '..', 'src', 'db', 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');

beforeAll(async () => {
  // Create tables if not exist
  await pool.query(schemaSql);

  // Clear purchasing tables
  await pool.query(`
    TRUNCATE TABLE 
      purchase_returns, purchase_return_items,
      supplier_payments, 
      purchase_orders, purchase_order_items, 
      purchase_requests, purchase_request_items, 
      suppliers, 
      materials, 
      inventory_transactions, inventory_balances,
      warehouses, warehouse_locations,
      users 
    RESTART IDENTITY CASCADE
  `);

  // Ensure default warehouse and location exists
  await pool.query(`
    INSERT INTO warehouses (id, name, type) VALUES (1, 'Main Warehouse', 'internal') ON CONFLICT DO NOTHING;
    INSERT INTO warehouse_locations (id, warehouse_id, code) VALUES (1, 1, 'DEF-LOC') ON CONFLICT DO NOTHING;
  `);

  // Insert test material
  const mat = await pool.query(
    `INSERT INTO materials (name, category, unit, cost_per_unit, quantity) 
     VALUES ('Test Steel', 'Metal', 'kg', 10.00, 0) RETURNING id`
  );
  materialId = mat.rows[0].id;

  // Insert Admin user
  const hash = await bcrypt.hash('admin123', 10);
  await pool.query(
    `INSERT INTO users (name, email, password, role) VALUES ('Admin', 'admin@test.com', $1, 'admin')`,
    [hash]
  );

  // Login to get token
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@test.com', password: 'admin123' });
  
  token = res.body.token;
});

afterAll(async () => {
  await pool.end();
});

describe('Purchasing Module (Procure-to-Pay)', () => {

  it('should create a new supplier', async () => {
    const res = await request(app)
      .post('/api/purchasing/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Acme Steel Co.',
        email: 'sales@acmesteel.com',
        phone: '555-0100',
        city: 'New York',
        country: 'USA'
      });
    
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Acme Steel Co.');
    supplierId = res.body.id;
  });

  it('should create a purchase request', async () => {
    const res = await request(app)
      .post('/api/purchasing/requests')
      .set('Authorization', `Bearer ${token}`)
      .send({
        request_number: 'PR-1001',
        required_date: '2026-07-15',
        notes: 'Need more steel for production',
        items: [
          {
            material_id: materialId,
            material_name: 'Test Steel',
            quantity: 500,
            estimated_unit_price: 10.50
          }
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body.request_number).toBe('PR-1001');
    expect(Number(res.body.total_estimated_amount)).toBe(5250);
    prId = res.body.id;
  });

  it('should approve the purchase request', async () => {
    const res = await request(app)
      .post(`/api/purchasing/requests/${prId}/approve`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
  });

  it('should create a purchase order from the request', async () => {
    const res = await request(app)
      .post('/api/purchasing/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        order_number: 'PO-2001',
        purchase_request_id: prId,
        supplier_id: supplierId,
        expected_delivery_date: '2026-07-10',
        notes: 'Please deliver to Main Warehouse',
        items: [
          {
            material_id: materialId,
            material_name: 'Test Steel',
            ordered_quantity: 500,
            unit_price: 10.00 // Final negotiated price
          }
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body.order_number).toBe('PO-2001');
    expect(Number(res.body.total_amount)).toBe(5000);
    poId = res.body.id;
  });

  it('should mark the PO as ordered', async () => {
    const res = await request(app)
      .post(`/api/purchasing/orders/${poId}/order`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ordered');
  });

  it('should receive goods and update inventory ledger', async () => {
    // 1. Get PO items to find the ID
    const poRes = await request(app)
      .get(`/api/purchasing/orders/${poId}`)
      .set('Authorization', `Bearer ${token}`);
    
    const poItemId = poRes.body.items[0].id;

    // 2. Receive goods
    const res = await request(app)
      .post(`/api/purchasing/orders/${poId}/receive`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        warehouseId: 1,
        locationId: 1,
        receiptItems: [
          {
            po_item_id: poItemId,
            received_quantity: 500,
            batch_number: 'BAT-99'
          }
        ]
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('received'); // Fully received

    // 3. Verify Inventory Balance
    const invRes = await pool.query(
      `SELECT quantity_on_hand FROM inventory_balances WHERE item_type = 'material' AND item_id = $1`,
      [materialId]
    );
    expect(Number(invRes.rows[0].quantity_on_hand)).toBe(500);

    // 4. Verify Legacy Material Sync
    const matRes = await pool.query(`SELECT quantity FROM materials WHERE id = $1`, [materialId]);
    expect(Number(matRes.rows[0].quantity)).toBe(500);
  });

  it('should make a payment to the supplier and update ledger', async () => {
    const res = await request(app)
      .post('/api/purchasing/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        supplier_id: supplierId,
        purchase_order_id: poId,
        payment_date: '2026-07-11',
        amount: 2500, // Partial payment
        payment_method: 'Bank Transfer'
      });

    expect(res.status).toBe(201);

    // Verify Supplier Ledger
    const ledger = await request(app)
      .get(`/api/purchasing/suppliers/${supplierId}/ledger`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(ledger.status).toBe(200);
    expect(Number(ledger.body.total_ordered)).toBe(5000);
    expect(Number(ledger.body.total_paid_via_po)).toBe(2500);
    expect(Number(ledger.body.balance)).toBe(2500); // 5000 ordered - 2500 paid
  });

});
