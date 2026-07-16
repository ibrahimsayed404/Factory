/* eslint-env jest */

require('dotenv').config();
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_value';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
process.env.DEVICE_INGEST_API_KEY = process.env.DEVICE_INGEST_API_KEY || 'test_device_ingest_key';
process.env.REGISTER_INVITE_CODE = process.env.REGISTER_INVITE_CODE || 'test-invite-code';
process.env.DB_NAME = process.env.TEST_DB_NAME || process.env.DB_NAME || 'factory_test_db';

const fs = require('node:fs');
const path = require('node:path');
const request = require('supertest');
const bcrypt = require('bcryptjs');

const app = require('../../src/app');
const pool = require('../../src/db/pool');

const schemaPath = path.join(__dirname, '..', '..', 'src', 'db', 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');

const resetData = async () => {
  await pool.query(`
    TRUNCATE TABLE
      machines,
      partner_factories,
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
  await pool.query(`
    INSERT INTO departments (name) VALUES
      ('Cutting'),
      ('Sewing'),
      ('Quality Control'),
      ('Warehouse'),
      ('Administration')
  `);
  await pool.query(`
    INSERT INTO warehouses (id, name, type) VALUES (1, 'Main Warehouse', 'internal') ON CONFLICT DO NOTHING;
    INSERT INTO warehouse_locations (id, warehouse_id, code) VALUES (1, 1, 'DEF-LOC') ON CONFLICT DO NOTHING;
  `);
};

const createAdminAndLogin = async () => {
  const password = 'AdminPass123!';
  const hash = await bcrypt.hash(password, 10);
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

const createCatalogProduct = async (agent, name) => {
  const created = await agent.post('/api/products').send({ name, default_price: 10 });
  expect(created.status).toBe(201);
  return created.body;
};

beforeAll(async () => {
  await pool.query(schemaSql);
  await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS weekend_days VARCHAR(20) DEFAULT '0,6'`);
  await pool.query('ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS evidence_url TEXT');
  await pool.query('ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS evidence_name VARCHAR(255)');
  await pool.query('ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS evidence_mime VARCHAR(100)');
  await pool.query(`ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS product_id INT REFERENCES products(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS product_id INT REFERENCES products(id) ON DELETE SET NULL`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS machines (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL UNIQUE,
      code VARCHAR(60) UNIQUE,
      status VARCHAR(30) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS partner_factories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL UNIQUE,
      code VARCHAR(60) UNIQUE,
      contact_person VARCHAR(120),
      phone VARCHAR(40),
      notes TEXT,
      status VARCHAR(30) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE production_phases
      ADD COLUMN IF NOT EXISTS partner_factory_id INT
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS partner_factories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL UNIQUE,
      code VARCHAR(60) UNIQUE,
      contact_person VARCHAR(120),
      phone VARCHAR(40),
      notes TEXT,
      status VARCHAR(30) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE production_phases
      ADD COLUMN IF NOT EXISTS partner_factory_id INT
  `);
  await resetData();
});

afterAll(async () => {
  await pool.end();
});

describe('Production tracking phases', () => {
  beforeEach(async () => {
    await resetData();
  });

  test('creates production order with input phase and deducts inventory materials', async () => {
    const agent = await createAdminAndLogin();

    const material = await agent
      .post('/api/inventory')
      .send({
        name: 'Tracking Cotton',
        category: 'fabric',
        unit: 'meters',
        quantity: 1000,
        min_quantity: 50,
        cost_per_unit: 2,
      });
    expect(material.status).toBe(201);

    const product = await createCatalogProduct(agent, 'M-101 Product');

    const created = await agent
      .post('/api/production-orders')
      .send({
        model_number: 'M-101',
        product_name: 'M-101 Product',
        product_id: product.id,
        quantity: 1000,
        materials: [
          { material_id: material.body.id, quantity: 500 },
        ],
      });

    expect(created.status).toBe(201);
    expect(created.body.model_number).toBe('M-101');
    expect(created.body.product_name).toBe('M-101 Product');
    expect(created.body.catalog_product_name).toBe('M-101 Product');
    expect(created.body.phases.input).toBe(1000);
    expect(created.body.phases.sorting).toBe(null);
    expect(created.body.phases.final).toBe(null);
    expect(created.body.status).toBe('pending');

    const inventoryAfter = await agent.get(`/api/inventory/${material.body.id}`);
    expect(inventoryAfter.status).toBe(200);
    expect(Number(inventoryAfter.body.quantity)).toBe(500);

    const report = await agent.get(`/api/production-orders/${created.body.id}/report`);
    expect(report.status).toBe(200);
    expect(report.body.input).toBe(1000);
    expect(Array.isArray(report.body.phases)).toBe(true);
  });

  test('stores catalog product name separately from model number', async () => {
    const agent = await createAdminAndLogin();
    const product = await createCatalogProduct(agent, 'Blue Polo Shirt');

    const created = await agent
      .post('/api/production-orders')
      .send({
        model_number: '6001',
        product_name: 'Blue Polo Shirt',
        product_id: product.id,
        quantity: 1200,
        materials: [],
      });

    expect(created.status).toBe(201);
    expect(created.body.model_number).toBe('6001');
    expect(created.body.product_name).toBe('Blue Polo Shirt');
    expect(created.body.catalog_product_name).toBe('Blue Polo Shirt');

    const list = await agent.get('/api/production-orders?limit=1000');
    expect(list.status).toBe(200);
    const row = list.body.data.find((order) => order.id === created.body.id);
    expect(row.product_name).toBe('Blue Polo Shirt');
    expect(row.model_number).toBe('6001');
  });

  test('validates sorting, outsourcing, and final quantities and computes phase losses', async () => {
    const agent = await createAdminAndLogin();

    const employeeOne = await agent
      .post('/api/employees')
      .send({ name: 'Sorter 1', email: 'sorter1@test.com', role: 'Sorter', shift: 'morning', salary: 1200 });
    expect(employeeOne.status).toBe(201);

    const employeeTwo = await agent
      .post('/api/employees')
      .send({ name: 'Final 1', email: 'final1@test.com', role: 'Final', shift: 'morning', salary: 1200 });
    expect(employeeTwo.status).toBe(201);

    const employeeThree = await agent
      .post('/api/employees')
      .send({ name: 'Outsourcing 1', email: 'outsource1@test.com', role: 'Outsourcing', shift: 'morning', salary: 1200 });
    expect(employeeThree.status).toBe(201);

    const machineInsert = await pool.query(
      `INSERT INTO machines (name, code) VALUES ($1, $2) RETURNING id`,
      ['Sorting Machine A', 'SM-A']
    );
    const machineId = machineInsert.rows[0].id;

    const factoryInsert = await pool.query(
      `INSERT INTO partner_factories (name, code) VALUES ($1, $2) RETURNING id`,
      ['Al-Nour Textiles', 'ANT-01']
    );
    const partnerFactoryId = factoryInsert.rows[0].id;

    const product = await createCatalogProduct(agent, 'M-102 Product');

    const created = await agent
      .post('/api/production-orders')
      .send({
        model_number: 'M-102',
        product_name: 'M-102 Product',
        product_id: product.id,
        quantity: 1000,
        materials: [],
      });
    expect(created.status).toBe(201);

    const badSorting = await agent
      .post(`/api/production-orders/${created.body.id}/sorting`)
      .send({
        quantity: 1200,
        employee_id: employeeOne.body.id,
        machine_id: machineId,
        started_at: '2026-04-08T08:00:00Z',
        completed_at: '2026-04-08T10:00:00Z',
      });
    expect(badSorting.status).toBe(400);
    expect(badSorting.body.error).toMatch(/Sorting quantity cannot exceed input quantity/i);

    const badSortingTime = await agent
      .post(`/api/production-orders/${created.body.id}/sorting`)
      .send({
        quantity: 900,
        employee_id: employeeOne.body.id,
        machine_id: machineId,
        started_at: '2026-04-08T10:00:00Z',
        completed_at: '2026-04-08T09:00:00Z',
      });
    expect(badSortingTime.status).toBe(400);
    expect(badSortingTime.body.error).toMatch(/Validation failed/i);

    const badFinalBeforeSorting = await agent
      .post(`/api/production-orders/${created.body.id}/final`)
      .send({
        quantity: 800,
        employee_id: employeeTwo.body.id,
        started_at: '2026-04-08T11:00:00Z',
        completed_at: '2026-04-08T12:00:00Z',
      });
    expect(badFinalBeforeSorting.status).toBe(400);
    expect(badFinalBeforeSorting.body.error).toMatch(/Outsourcing phase must be recorded before final phase/i);

    const sorting = await agent
      .post(`/api/production-orders/${created.body.id}/sorting`)
      .send({
        quantity: 800,
        loss_reason: 'Damaged fabric',
        employee_id: employeeOne.body.id,
        machine_id: machineId,
        started_at: '2026-04-08T08:00:00Z',
        completed_at: '2026-04-08T10:00:00Z',
      });
    expect(sorting.status).toBe(201);
    expect(sorting.body.status).toBe('sorting');
    expect(sorting.body.sorting_loss).toBe(200);

    const badOutsourcing = await agent
      .post(`/api/production-orders/${created.body.id}/outsourcing`)
      .send({
        quantity: 850,
        employee_id: employeeThree.body.id,
        started_at: '2026-04-08T10:30:00Z',
        completed_at: '2026-04-08T11:30:00Z',
      });
    expect(badOutsourcing.status).toBe(400);
    expect(badOutsourcing.body.error).toMatch(/Outsourcing quantity cannot exceed sorting quantity/i);

    const outsourcing = await agent
      .post(`/api/production-orders/${created.body.id}/outsourcing`)
      .send({
        quantity: 700,
        loss_reason: 'External finishing loss',
        employee_id: employeeThree.body.id,
        partner_factory_id: partnerFactoryId,
        started_at: '2026-04-08T10:30:00Z',
        completed_at: '2026-04-08T11:30:00Z',
      });
    expect(outsourcing.status).toBe(201);
    expect(outsourcing.body.status).toBe('outsourcing');
    expect(outsourcing.body.sorting_loss).toBe(200);
    expect(outsourcing.body.outsourcing_loss).toBe(100);

    const duplicateSorting = await agent
      .post(`/api/production-orders/${created.body.id}/sorting`)
      .send({
        quantity: 910,
        employee_id: employeeOne.body.id,
        machine_id: machineId,
        started_at: '2026-04-08T10:00:00Z',
        completed_at: '2026-04-08T12:00:00Z',
      });
    expect(duplicateSorting.status).toBe(409);

    const badFinal = await agent
      .post(`/api/production-orders/${created.body.id}/final`)
      .send({
          quantity: 710,
        employee_id: employeeTwo.body.id,
        started_at: '2026-04-08T10:30:00Z',
        completed_at: '2026-04-08T12:00:00Z',
      });
    expect(badFinal.status).toBe(400);
      expect(badFinal.body.error).toMatch(/Final quantity cannot exceed outsourcing quantity/i);

    const final = await agent
      .post(`/api/production-orders/${created.body.id}/final`)
      .send({
          quantity: 600,
        loss_reason: 'Stitching defects',
        employee_id: employeeTwo.body.id,
        started_at: '2026-04-08T11:00:00Z',
        completed_at: '2026-04-08T13:00:00Z',
      });
    expect(final.status).toBe(201);
    expect(final.body.status).toBe('completed');
      expect(final.body.sorting_loss).toBe(200);
      expect(final.body.outsourcing_loss).toBe(100);
      expect(final.body.final_loss).toBe(100);
      expect(final.body.total_loss).toBe(400);
      expect(Number(final.body.efficiency)).toBeCloseTo(60, 2);

    const list = await agent.get('/api/production-orders?limit=1000');
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.data)).toBe(true);

    const listedOrder = list.body.data.find((row) => row.id === created.body.id);
    expect(listedOrder).toBeDefined();
    expect(listedOrder.phases.input).toBe(1000);
    expect(listedOrder.phases.sorting).toBe(800);
    expect(listedOrder.phases.outsourcing).toBe(700);
    expect(listedOrder.phases.final).toBe(600);
    expect(listedOrder.total_loss).toBe(400);

    const report = await agent.get(`/api/production-orders/${created.body.id}/report`);
    expect(report.status).toBe(200);
    expect(report.body.input).toBe(1000);
    expect(report.body.sorting).toBe(800);
    expect(report.body.outsourcing).toBe(700);
    expect(report.body.final).toBe(600);
    expect(report.body.sorting_loss).toBe(200);
    expect(report.body.outsourcing_loss).toBe(100);
    expect(report.body.final_loss).toBe(100);
    expect(report.body.total_loss).toBe(400);
    expect(Number(report.body.efficiency)).toBeCloseTo(60, 2);
    expect(Array.isArray(report.body.phases)).toBe(true);
    expect(report.body.phases).toHaveLength(4);

    const sortingPhase = report.body.phases.find((p) => p.phase === 'sorting');
    expect(sortingPhase.employee).toBe('Sorter 1');
    expect(sortingPhase.machine).toBe('Sorting Machine A');
    expect(sortingPhase.loss_reason).toBe('Damaged fabric');
    expect(sortingPhase.duration_minutes).toBe(120);

    const outsourcingPhase = report.body.phases.find((p) => p.phase === 'outsourcing');
    expect(outsourcingPhase.employee).toBe('Outsourcing 1');
    expect(outsourcingPhase.partner_factory).toBe('Al-Nour Textiles');
    expect(outsourcingPhase.loss_reason).toBe('External finishing loss');
    expect(outsourcingPhase.duration_minutes).toBe(60);

    const finalPhase = report.body.phases.find((p) => p.phase === 'final');
    expect(finalPhase.employee).toBe('Final 1');
    expect(finalPhase.loss_reason).toBe('Stitching defects');
    expect(finalPhase.duration_minutes).toBe(120);

    expect(Array.isArray(report.body.alerts)).toBe(true);
    expect(report.body.alerts.some((a) => a.type === 'HIGH_LOSS')).toBe(true);
    expect(report.body.alerts.some((a) => /Outsourcing phase/i.test(a.message))).toBe(true);
  });
});
