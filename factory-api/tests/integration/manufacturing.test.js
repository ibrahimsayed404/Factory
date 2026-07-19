require('dotenv').config();
if (process.env.DB_HOST && (process.env.DB_HOST.includes('supabase') || process.env.DB_HOST.includes('pooler'))) {
  throw new Error('SAFETY BLOCK: Integration tests are disabled on cloud Supabase DB to prevent data deletion.');
}
const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/db/pool');
const bcrypt = require('bcryptjs');
const fs = require('node:fs');
const path = require('node:path');

describe('Manufacturing ERP Integration Tests', () => {
  let adminToken;
  let testProductId;
  let testMaterial1Id;
  let testMaterial2Id;
  let bomId;
  let routingId;
  let stageId;
  let productionOrderId;

  const schemaPath = path.join(__dirname, '..', '..', 'src', 'db', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  const migrationPath = path.join(__dirname, '..', '..', 'migrations', '20260630_manufacturing_module.sql');
  let migrationSql = '';
  if (fs.existsSync(migrationPath)) {
    migrationSql = fs.readFileSync(migrationPath, 'utf8');
  }

  beforeAll(async () => {
    const client = await pool.connect();
    try {
      // Run base schema
      await client.query(schemaSql);
      
      // Run manufacturing migration if needed
      if (migrationSql) {
        await client.query(migrationSql);
      }
      // Create admin user & token
      const hash = await bcrypt.hash('admin123', 10);
      await client.query(`DELETE FROM users WHERE email = 'mfg_admin@test.com'`);
      const userRes = await client.query(
        `INSERT INTO users (name, email, password, role) VALUES ('Mfg Admin', 'mfg_admin@test.com', $1, 'admin') RETURNING id`,
        [hash]
      );
      
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'mfg_admin@test.com', password: 'admin123' });
      
      adminToken = loginRes.body.token;

      // Create test product
      const pRes = await client.query(
        `INSERT INTO products (name, sku, default_price) VALUES ('Test Shirt', 'TSHIRT-01', 100)
         ON CONFLICT (name) DO UPDATE SET default_price = 100 RETURNING id`
      );
      testProductId = pRes.rows[0].id;

      // Create test materials
      const m1Res = await client.query(
        `INSERT INTO materials (name, category, unit, quantity, cost_per_unit) VALUES ('Cotton Fabric', 'fabric', 'meters', 1000, 5)
         ON CONFLICT (name) DO UPDATE SET cost_per_unit = 5 RETURNING id`
      );
      testMaterial1Id = m1Res.rows[0].id;

      const m2Res = await client.query(
        `INSERT INTO materials (name, category, unit, quantity, cost_per_unit) VALUES ('Buttons', 'button', 'pcs', 5000, 0.1)
         ON CONFLICT (name) DO UPDATE SET cost_per_unit = 0.1 RETURNING id`
      );
      testMaterial2Id = m2Res.rows[0].id;

      // Create production stage
      const sRes = await client.query(
        `INSERT INTO production_stages (name, cost_per_hour) VALUES ('Test Sewing', 30.00)
         ON CONFLICT (name) DO UPDATE SET cost_per_hour = 30.00 RETURNING id`
      );
      stageId = sRes.rows[0].id;

    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    // Cleanup is handled by global setup/teardown in normal suites, but we can do a quick clean if needed.
    // For now we assume the test DB is reset.
    await pool.end();
  });

  describe('BOMs & Routings', () => {
    it('should create a BOM for a product', async () => {
      const res = await request(app)
        .post('/api/manufacturing/boms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          product_id: testProductId,
          name: 'Standard Shirt BOM',
          base_quantity: 1,
          materials: [
            { material_id: testMaterial1Id, quantity: 2, scrap_percentage: 5 },
            { material_id: testMaterial2Id, quantity: 5, scrap_percentage: 0 }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      bomId = res.body.id;
    });

    it('should create a Routing for a product', async () => {
      const res = await request(app)
        .post('/api/manufacturing/routings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          product_id: testProductId,
          name: 'Standard Shirt Routing',
          steps: [
            { stage_id: stageId, sequence_order: 1, standard_time_minutes: 60 }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      routingId = res.body.id;
    });
  });

  describe('Production Order & Work Orders', () => {
    it('should create a Production Order with Work Orders and Reserve Stock', async () => {
      const res = await request(app)
        .post('/api/production')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          product_id: testProductId,
          quantity: 100,
          bom_id: bomId,
          routing_id: routingId,
          start_date: '2026-07-01',
          due_date: '2026-07-10'
        });

      expect(res.status).toBe(201);
      expect(res.body.work_orders).toHaveLength(1);
      productionOrderId = res.body.id;

      const workOrder = res.body.work_orders[0];
      expect(workOrder.materials).toHaveLength(2);
      
      // Verify quantity: 100 units * 2 meters * 1.05 scrap = 210 planned
      const mat1 = workOrder.materials.find(m => m.material_id === testMaterial1Id);
      expect(Number(mat1.planned_quantity)).toBe(210);

      // Verify stock reservation in ledger
      const ledgerRes = await pool.query(`SELECT * FROM inventory_transactions WHERE reference_id = $1 AND transaction_type = 'reserve'`, [productionOrderId]);
      expect(ledgerRes.rows).toHaveLength(2); // Two materials reserved
    });

    it('should complete a Work Order and Issue Stock', async () => {
      // Get the work order ID
      const poRes = await request(app)
        .get(`/api/production/${productionOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      const workOrderId = poRes.body.work_orders[0].id;
      const womId1 = poRes.body.work_orders[0].materials.find(m => m.material_id === testMaterial1Id).id;

      const completeRes = await request(app)
        .put(`/api/production/work-orders/${workOrderId}/complete`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          actual_start: new Date(Date.now() - 3600000), // 1 hour ago
          actual_end: new Date(),
          produced_quantity: 100,
          waste_quantity: 0,
          materials_consumed: [
            { work_order_material_id: womId1, quantity: 200, waste: 10 }
          ]
        });

      expect(completeRes.status).toBe(200);

      // Verify costs on PO
      const updatedPo = await pool.query(`SELECT total_material_cost, total_labor_cost, status FROM production_orders WHERE id = $1`, [productionOrderId]);
      
      // labor cost should be ~30 (1 hour * $30)
      expect(Number(updatedPo.rows[0].total_labor_cost)).toBeGreaterThan(29);
      
      // status should be 'done' since it's the only WO
      expect(updatedPo.rows[0].status).toBe('done');
    });
  });
});
