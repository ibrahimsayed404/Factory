/* eslint-env jest */
require('dotenv').config();
if (process.env.DB_HOST && (process.env.DB_HOST.includes('supabase') || process.env.DB_HOST.includes('pooler'))) {
  throw new Error('SAFETY BLOCK: Integration tests are disabled on cloud Supabase DB to prevent data deletion.');
}
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

jest.setTimeout(30000);

const app = require('../../src/app');
const pool = require('../../src/db/pool');

const schemaPath = path.join(__dirname, '..', '..', 'src', 'db', 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');

const resetData = async () => {
  if (process.env.DB_HOST && (process.env.DB_HOST.includes('supabase') || process.env.DB_HOST.includes('pooler'))) {
    return;
  }
  await pool.query(`
    TRUNCATE TABLE
      inventory_transactions,
      inventory_balances,
      warehouse_locations,
      warehouses,
      production_materials,
      production_orders,
      sales_order_items,
      sales_orders,
      customers,
      payroll,
      attendance,
      employees,
      machines,
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

beforeAll(async () => {
  await pool.query(schemaSql);
  await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS weekend_days VARCHAR(20) DEFAULT '0,6'`);
  await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS termination_date DATE`);
  await pool.query(`ALTER TABLE payroll ADD COLUMN IF NOT EXISTS week_start DATE, ADD COLUMN IF NOT EXISTS week_end DATE, ADD COLUMN IF NOT EXISTS loan_deduction NUMERIC(10,2) DEFAULT 0, ADD COLUMN IF NOT EXISTS manual_bonus NUMERIC(10,2) DEFAULT 0, ADD COLUMN IF NOT EXISTS manual_deductions NUMERIC(10,2) DEFAULT 0, ADD COLUMN IF NOT EXISTS auto_bonus NUMERIC(10,2) DEFAULT 0, ADD COLUMN IF NOT EXISTS auto_deductions NUMERIC(10,2) DEFAULT 0, ADD COLUMN IF NOT EXISTS hr_bonus NUMERIC(10,2) DEFAULT 0, ADD COLUMN IF NOT EXISTS hr_penalty NUMERIC(10,2) DEFAULT 0, ADD COLUMN IF NOT EXISTS hr_overtime NUMERIC(10,2) DEFAULT 0`);
  await pool.query('ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS evidence_url TEXT');
  await pool.query('ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS evidence_name VARCHAR(255)');
  await pool.query('ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS evidence_mime VARCHAR(100)');
  await pool.query(`ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS product_id INT REFERENCES products(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS product_id INT REFERENCES products(id) ON DELETE SET NULL`);
  await resetData();
});

afterAll(async () => {
  await pool.end();
});

describe('Auth flow', () => {
  beforeEach(async () => {
    await resetData();
  });

  test('register always creates staff role and supports cookie auth me endpoint', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Staff User',
        email: 'staff@test.com',
        password: 'Password123!',
        invite: process.env.REGISTER_INVITE_CODE,
        role: 'admin',
      });

    expect(reg.status).toBe(201);
    expect(reg.body.user.role).toBe('staff');

    const agent = request.agent(app);
    const login = await agent
      .post('/api/auth/login')
      .send({ email: 'staff@test.com', password: 'Password123!' });

    expect(login.status).toBe(200);
    expect(Array.isArray(login.headers['set-cookie'])).toBe(true);

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.email).toBe('staff@test.com');
    expect(me.body.role).toBe('staff');
  });
});

describe('Attendance upsert behavior', () => {
  beforeEach(async () => {
    await resetData();
  });

  test('second log for same employee/date updates existing row instead of inserting duplicate', async () => {
    const agent = await createAdminAndLogin();

    const emp = await agent
      .post('/api/employees')
      .send({
        name: 'Worker One',
        email: 'worker1@test.com',
        role: 'Operator',
        shift: 'morning',
        salary: 1000,
      });

    expect(emp.status).toBe(201);
    const employeeId = emp.body.id;

    const first = await agent
      .post(`/api/employees/${employeeId}/attendance`)
      .send({
        date: '2026-03-10',
        check_in: '08:00',
        check_out: '17:00',
        hours_worked: 8,
        status: 'present',
      });

    expect(first.status).toBe(201);

    const second = await agent
      .post(`/api/employees/${employeeId}/attendance`)
      .send({
        date: '2026-03-10',
        check_in: '09:00',
        check_out: '16:00',
        hours_worked: 7,
        status: 'late',
        notes: 'Traffic',
      });

    expect(second.status).toBe(200);

    const list = await agent.get(`/api/employees/${employeeId}/attendance?month=3&year=2026`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].status).toBe('present');
    expect(Number(list.body[0].hours_worked)).toBe(7);
    expect(Number(list.body[0].late_minutes || 0)).toBe(0);
    expect(Number(list.body[0].early_leave_minutes || 0)).toBe(60);
    expect(list.body[0].notes).toBe('Traffic');
  });
});

describe('Production stock deduction safety', () => {
  beforeEach(async () => {
    await resetData();
  });

  test('deducts stock on success and blocks order that would create negative stock', async () => {
    const agent = await createAdminAndLogin();

    const material = await agent
      .post('/api/inventory')
      .send({
        name: 'Cotton Roll',
        category: 'fabric',
        unit: 'meters',
        quantity: 10,
        min_quantity: 2,
        cost_per_unit: 5,
      });

    expect(material.status).toBe(201);
    const materialId = material.body.id;

    const okOrder = await agent
      .post('/api/production')
      .send({
        product_name: 'Shirt Batch A',
        quantity: 20,
        materials: [{ material_id: materialId, quantity_used: 4 }],
      });

    expect(okOrder.status).toBe(201);

    const afterFirst = await agent.get(`/api/inventory/${materialId}`);
    expect(afterFirst.status).toBe(200);
    expect(Number(afterFirst.body.quantity)).toBe(6);

    const badOrder = await agent
      .post('/api/production')
      .send({
        product_name: 'Shirt Batch B',
        quantity: 20,
        materials: [{ material_id: materialId, quantity_used: 7 }],
      });

    expect(badOrder.status).toBe(400);
    expect(badOrder.body.error).toMatch(/Insufficient stock/i);

    const afterSecond = await agent.get(`/api/inventory/${materialId}`);
    expect(afterSecond.status).toBe(200);
    expect(Number(afterSecond.body.quantity)).toBe(6);
  });

  test('updates produced quantity and auto-advances production status from progress', async () => {
    const agent = await createAdminAndLogin();

    const order = await agent
      .post('/api/production')
      .send({
        product_name: 'Shirt Batch Progress',
        quantity: 20,
        materials: [],
      });

    expect(order.status).toBe(201);

    const partial = await agent
      .put(`/api/production/${order.body.id}/status`)
      .send({ produced_qty: 8 });

    expect(partial.status).toBe(200);
    expect(Number(partial.body.produced_qty)).toBe(8);
    expect(partial.body.status).toBe('in_progress');

    const complete = await agent
      .put(`/api/production/${order.body.id}/status`)
      .send({ produced_qty: 20 });

    expect(complete.status).toBe(200);
    expect(Number(complete.body.produced_qty)).toBe(20);
    expect(complete.body.status).toBe('done');
  });

  test('creates shared production orders automatically from customer sales items', async () => {
    const agent = await createAdminAndLogin();

    const customer = await agent
      .post('/api/customers')
      .send({ name: 'Auto Production Customer', email: 'auto-production@test.com' });
    expect(customer.status).toBe(201);

    const salesOrder = await agent
      .post('/api/sales')
      .send({
        customer_id: customer.body.id,
        delivery_date: '2026-04-15',
        notes: 'Customer requested production',
        items: [
          { product_name: '1231-t-shirt', quantity: 3500, unit_price: 10 },
          { product_name: 'Polo Shirt', quantity: 500, unit_price: 12 },
        ],
      });

    if (salesOrder.status !== 201) console.log(salesOrder.body);
    expect(salesOrder.status).toBe(201);

    const production = await agent.get('/api/production');
    expect(production.status).toBe(200);

    const linkedOrders = production.body.data.filter((row) => row.sales_order_id === salesOrder.body.id);
    expect(linkedOrders).toHaveLength(2);
    expect(linkedOrders.every((row) => row.assigned_to === null)).toBe(true);
    expect(linkedOrders.every((row) => /^PTO-/.test(row.order_number))).toBe(true);
    expect(linkedOrders.map((row) => row.product_name).sort()).toEqual(['1231-t-shirt', 'Polo Shirt']);
    expect(linkedOrders.map((row) => Number(row.quantity)).sort((a, b) => a - b)).toEqual([500, 3500]);

    const report = await agent.get(`/api/production-orders/${linkedOrders[0].id}/report`);
    expect(report.status).toBe(200);
    expect(report.body.phases.some((phase) => phase.phase === 'input' && Number(phase.quantity) === Number(linkedOrders[0].quantity))).toBe(true);
  });

  test('sales-triggered production orders keep sales linkage and accept sorting immediately', async () => {
    const agent = await createAdminAndLogin();

    const employee = await agent
      .post('/api/employees')
      .send({ name: 'Sales Sorter', email: 'sales-sorting@test.com', role: 'Sorter', shift: 'morning', salary: 1200 });
    expect(employee.status).toBe(201);

    const machineInsert = await pool.query(
      `INSERT INTO machines (name, code) VALUES ($1, $2) RETURNING id`,
      ['Sales Sorting Machine', 'SSM-1']
    );
    const machineId = machineInsert.rows[0].id;

    const customer = await agent
      .post('/api/customers')
      .send({ name: 'Sales Tracking Customer', email: 'sales-tracking@test.com' });
    expect(customer.status).toBe(201);

    const salesOrder = await agent
      .post('/api/sales')
      .send({
        customer_id: customer.body.id,
        delivery_date: '2026-04-18',
        notes: 'Make to order tracking order',
        items: [
          { product_name: 'Tracking MTO Shirt', quantity: 120, unit_price: 15, make_to_order: true },
        ],
      });

    expect(salesOrder.status).toBe(201);

    const production = await agent.get('/api/production');
    expect(production.status).toBe(200);

    const order = production.body.data.find((row) => row.sales_order_id === salesOrder.body.id);
    expect(order).toBeDefined();
    expect(order.order_number).toMatch(/^PTO-/);
    expect(order.sales_order_id).toBe(salesOrder.body.id);

    const reportBeforeSorting = await agent.get(`/api/production-orders/${order.id}/report`);
    expect(reportBeforeSorting.status).toBe(200);
    expect(reportBeforeSorting.body.phases.some((phase) => phase.phase === 'input' && Number(phase.quantity) === 120)).toBe(true);

    const sorting = await agent
      .post(`/api/production-orders/${order.id}/sorting`)
      .send({
        quantity: 100,
        employee_id: employee.body.id,
        machine_id: machineId,
        started_at: '2026-04-18T08:00:00Z',
        completed_at: '2026-04-18T09:00:00Z',
      });

    expect(sorting.status).toBe(201);
    expect(sorting.body.phases.sorting).toBe(100);
  });
});

describe('Payroll auto-adjustments', () => {
  beforeEach(async () => {
    await resetData();
  });

  test('generates payroll with attendance-based overtime and deduction math', async () => {
    const agent = await createAdminAndLogin();

    const emp = await agent
      .post('/api/employees')
      .send({
        name: 'Payroll Worker',
        email: 'payroll-worker@test.com',
        role: 'Operator',
        shift: 'morning',
        weekend_days: '5,6',
        salary: 3000,
      });
    expect(emp.status).toBe(201);

    const employeeId = emp.body.id;
    // Fully employed for the whole week (no proration): weekend_days '5,6' => 5
    // working days (Sun–Thu). Week Sat 2026-07-04 → Fri 2026-07-10.
    await pool.query("UPDATE employees SET hire_date = '2020-01-01', termination_date = NULL WHERE id = $1", [employeeId]);

    const attendanceRows = [
      { date: '2026-07-05', check_in: '09:30', check_out: '17:00', status: 'present' }, // Sun: 30 - 10 grace = 20 late
      { date: '2026-07-06', check_in: '09:00', check_out: '17:00', status: 'absent' },  // Mon: absent
      { date: '2026-07-07', check_in: '09:00', check_out: '18:00', status: 'present' }, // Tue: 60 overtime
      { date: '2026-07-08', check_in: '09:00', check_out: '17:00', status: 'half-day' }, // Wed: half-day (metrics zeroed)
      { date: '2026-07-09', check_in: '09:00', check_out: '17:00', status: 'present' }, // Thu: clean
    ];

    for (const row of attendanceRows) {
      const resp = await agent
        .post(`/api/employees/${employeeId}/attendance`)
        .send(row);
      expect([200, 201]).toContain(resp.status);
    }

    const payroll = await agent
      .post('/api/payroll')
      .send({ employee_id: employeeId, week_start: '2026-07-04', bonus: 10, deductions: 5 });

    expect(payroll.status).toBe(201);
    expect(payroll.body.payroll_breakdown).toBeDefined();
    expect(payroll.body.payroll_breakdown.late_minutes).toBe(20);
    expect(payroll.body.payroll_breakdown.overtime_minutes).toBe(60);
    expect(payroll.body.payroll_breakdown.regular_overtime_minutes).toBe(60);
    expect(payroll.body.payroll_breakdown.weekend_overtime_minutes).toBe(0);
    expect(payroll.body.payroll_breakdown.absent_days).toBe(1);
    expect(payroll.body.payroll_breakdown.half_days).toBe(1);

    // weekly salary=3000, 5 working days => daily=600, minute=1.25
    // one day late 20 (>10) => weighted 20*1.5 = 30
    // auto deductions = late(30m)*1.25=37.5 + absent(1d)=600 + half-day(0.5d)=300 => 937.5
    // auto bonus = overtime(60m)*1.25*1.5 => 112.5
    // final bonus = 112.5 + 10(manual) => 122.5
    // final deductions = 937.5 + 5(manual) => 942.5
    // net = 3000 + 122.5 - 942.5 => 2180
    expect(Number(payroll.body.bonus)).toBeCloseTo(122.5, 2);
    expect(Number(payroll.body.deductions)).toBeCloseTo(942.5, 2);
    expect(Number(payroll.body.net_salary)).toBeCloseTo(2180, 2);
    expect(Number(payroll.body.payroll_breakdown.late_weighted_minutes)).toBeCloseTo(30, 2);

    const list = await agent.get('/api/payroll?week_start=2026-07-04');
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].payroll_breakdown).toBeDefined();
    expect(Number(list.body.data[0].payroll_breakdown.auto_bonus)).toBeCloseTo(112.5, 2);
    expect(Number(list.body.data[0].payroll_breakdown.auto_deductions)).toBeCloseTo(937.5, 2);
  });

  test('weights late minutes per day, not on the weekly total', async () => {
    const agent = await createAdminAndLogin();

    const emp = await agent
      .post('/api/employees')
      .send({
        name: 'Late Per Day Worker',
        email: 'late-per-day@test.com',
        role: 'Operator',
        shift: 'morning',
        weekend_days: '5',
        salary: 2400,
      });
    expect(emp.status).toBe(201);
    const employeeId = emp.body.id;

    // Saturday 5 late (<=10 => x1), Sunday 40 late (>10 => x1.5) => 5 + 60 = 65
    for (const row of [
      { date: '2026-07-04', check_in: '09:15', check_out: '17:00', status: 'present' }, // after 10 grace => 5 late
      { date: '2026-07-05', check_in: '09:50', check_out: '17:00', status: 'present' }, // after 10 grace => 40 late
    ]) {
      const resp = await agent.post(`/api/employees/${employeeId}/attendance`).send(row);
      expect([200, 201]).toContain(resp.status);
    }

    const payroll = await agent
      .post('/api/payroll')
      .send({ employee_id: employeeId, week_start: '2026-07-04', bonus: 0, deductions: 0 });

    expect(payroll.status).toBe(201);
    expect(Number(payroll.body.payroll_breakdown.late_minutes)).toBe(45);
    expect(Number(payroll.body.payroll_breakdown.late_weighted_minutes)).toBeCloseTo(65, 2);
  });

  test('generates payroll for all active employees when week_start is provided and no employee selected', async () => {
    const agent = await createAdminAndLogin();

    const emp1 = await agent.post('/api/employees').send({
      name: 'Batch Worker 1',
      email: 'batch1@test.com',
      role: 'Operator',
      weekend_days: '5,6',
      salary: 2000,
    });
    expect(emp1.status).toBe(201);

    const emp2 = await agent.post('/api/employees').send({
      name: 'Batch Worker 2',
      email: 'batch2@test.com',
      role: 'Operator',
      weekend_days: '5,6',
      salary: 2500,
    });
    expect(emp2.status).toBe(201);

    const payroll = await agent
      .post('/api/payroll')
      .send({ week_start: '2026-03-07', bonus: 0, deductions: 0 });

    // Bulk generation returns a per-employee result summary, not a bare array.
    expect(payroll.status).toBe(201);
    expect(Array.isArray(payroll.body.generated)).toBe(true);
    expect(Array.isArray(payroll.body.failed)).toBe(true);
    expect(payroll.body.failed).toHaveLength(0);
    expect(payroll.body.generated).toHaveLength(2);
    expect(payroll.body.generated.map((row) => row.employee_id).sort()).toEqual([emp1.body.id, emp2.body.id].sort());

    const list = await agent.get('/api/payroll?week_start=2026-03-07');
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBeGreaterThanOrEqual(2);
  });

  test('treats weekend attendance as overtime bonus and marks note as present vacation', async () => {
    const agent = await createAdminAndLogin();

    const emp = await agent
      .post('/api/employees')
      .send({
        name: 'Weekend Worker',
        email: 'weekend-worker@test.com',
        role: 'Operator',
        shift: 'morning',
        weekend_days: '0,6',
        salary: 3000,
      });
    expect(emp.status).toBe(201);
    // weekend_days '0,6' (Sun+Sat). Fully employed. Week Sat 2026-07-04 → Fri
    // 2026-07-10; Sat 07-04 is a weekend day worked (overtime).
    await pool.query("UPDATE employees SET hire_date = '2020-01-01', termination_date = NULL WHERE id = $1", [emp.body.id]);

    const attendance = await agent
      .post(`/api/employees/${emp.body.id}/attendance`)
      .send({
        date: '2026-07-04', // Saturday (weekend) worked
        check_in: '09:00',
        check_out: '17:00',
        status: 'present',
      });

    expect(attendance.status).toBe(201);
    expect(attendance.body.status).toBe('present');
    expect(attendance.body.notes).toBe('present vacation');
    expect(Number(attendance.body.late_minutes)).toBe(0);
    expect(Number(attendance.body.early_leave_minutes)).toBe(0);
    expect(Number(attendance.body.overtime_minutes)).toBe(480);

    // Record the five regular working days (Mon–Fri) present so there is no
    // inferred absence noise.
    for (const date of ['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10']) {
      const resp = await agent.post(`/api/employees/${emp.body.id}/attendance`).send({ date, check_in: '09:00', check_out: '17:00', status: 'present' });
      expect([200, 201]).toContain(resp.status);
    }

    const payroll = await agent
      .post('/api/payroll')
      .send({ employee_id: emp.body.id, week_start: '2026-07-04', bonus: 0, deductions: 0 });

    expect(payroll.status).toBe(201);
    expect(payroll.body.payroll_breakdown.overtime_minutes).toBe(480);
    expect(payroll.body.payroll_breakdown.regular_overtime_minutes).toBe(0);
    expect(payroll.body.payroll_breakdown.weekend_overtime_minutes).toBe(480);
    // daily=3000/5=600, minute=1.25, weekend OT bonus = 480*1.25*1 = 600
    expect(Number(payroll.body.bonus)).toBeCloseTo(600, 2);
    expect(Number(payroll.body.net_salary)).toBeCloseTo(3600, 2);

    const list = await agent.get('/api/payroll?week_start=2026-07-04');
    expect(list.status).toBe(200);
    expect(list.body.data[0].payroll_breakdown.weekend_overtime_minutes).toBe(480);
    expect(list.body.data[0].payroll_breakdown.regular_overtime_minutes).toBe(0);
  });

  test('infers missing non-weekend gap day as absent for payroll deductions', async () => {
    const agent = await createAdminAndLogin();

    const emp = await agent
      .post('/api/employees')
      .send({
        name: 'Gap Worker',
        email: 'gap-worker@test.com',
        role: 'Operator',
        shift: 'morning',
        weekend_days: '0,6',
        salary: 3000,
      });
    expect(emp.status).toBe(201);

    const employeeId = emp.body.id;
    // Fully employed. weekend_days '0,6' => working days Mon–Fri. Record four of
    // the five; the unrecorded Wed 2026-07-08 must be inferred absent.
    await pool.query("UPDATE employees SET hire_date = '2020-01-01', termination_date = NULL WHERE id = $1", [employeeId]);

    const rows = [
      { date: '2026-07-06', check_in: '09:00', check_out: '17:00', status: 'present' }, // Mon
      { date: '2026-07-07', check_in: '09:00', check_out: '17:00', status: 'present' }, // Tue
      // 2026-07-08 (Wed) intentionally missing -> inferred absent
      { date: '2026-07-09', check_in: '09:00', check_out: '17:00', status: 'present' }, // Thu
      { date: '2026-07-10', check_in: '09:00', check_out: '17:00', status: 'present' }, // Fri
    ];

    for (const row of rows) {
      const resp = await agent
        .post(`/api/employees/${employeeId}/attendance`)
        .send(row);
      expect([200, 201]).toContain(resp.status);
    }

    const payroll = await agent
      .post('/api/payroll')
      .send({ employee_id: employeeId, week_start: '2026-07-04', bonus: 0, deductions: 0 });

    expect(payroll.status).toBe(201);
    expect(payroll.body.payroll_breakdown).toBeDefined();
    expect(payroll.body.payroll_breakdown.absent_days).toBe(1);
    expect(payroll.body.payroll_breakdown.inferred_absent_days).toBe(1);
    // daily = 3000/5 = 600; one inferred absent day => 600 deduction
    expect(Number(payroll.body.deductions)).toBeCloseTo(600, 2);
    expect(Number(payroll.body.net_salary)).toBeCloseTo(2400, 2);
  });

  test('half-day is charged only the half-day penalty, not also early-leave minutes', async () => {
    const agent = await createAdminAndLogin();

    const emp = await agent.post('/api/employees').send({
      name: 'Half Day Worker', email: 'half-day-worker@test.com', role: 'Operator',
      shift: 'morning', weekend_days: '5,6', salary: 3000,
    });
    expect(emp.status).toBe(201);
    await pool.query("UPDATE employees SET hire_date = '2020-01-01', termination_date = NULL WHERE id = $1", [emp.body.id]);

    // Present Sun–Wed, then a half-day on Thu with a real early checkout (12:00).
    // The early checkout must NOT also generate early-leave minutes.
    const days = [
      { date: '2026-07-05', check_in: '09:00', check_out: '17:00', status: 'present' },
      { date: '2026-07-06', check_in: '09:00', check_out: '17:00', status: 'present' },
      { date: '2026-07-07', check_in: '09:00', check_out: '17:00', status: 'present' },
      { date: '2026-07-08', check_in: '09:00', check_out: '17:00', status: 'present' },
      { date: '2026-07-09', check_in: '09:00', check_out: '12:00', status: 'half-day' },
    ];
    for (const d of days) {
      const resp = await agent.post(`/api/employees/${emp.body.id}/attendance`).send(d);
      expect([200, 201]).toContain(resp.status);
    }

    const payroll = await agent.post('/api/payroll').send({ employee_id: emp.body.id, week_start: '2026-07-04' });
    expect(payroll.status).toBe(201);
    expect(payroll.body.payroll_breakdown.half_days).toBe(1);
    expect(Number(payroll.body.payroll_breakdown.early_leave_minutes)).toBe(0);
    // daily = 600; only the half-day penalty (300) is deducted, not early-leave.
    expect(Number(payroll.body.deductions)).toBeCloseTo(300, 2);
    expect(Number(payroll.body.net_salary)).toBeCloseTo(2700, 2);
  });

  test('approved unpaid leave is deducted like an absence; paid leave is not', async () => {
    const agent = await createAdminAndLogin();

    const emp = await agent.post('/api/employees').send({
      name: 'Leave Worker', email: 'leave-worker@test.com', role: 'Operator',
      shift: 'morning', weekend_days: '5,6', salary: 3000,
    });
    expect(emp.status).toBe(201);
    await pool.query("UPDATE employees SET hire_date = '2020-01-01', termination_date = NULL WHERE id = $1", [emp.body.id]);

    // Present Sun–Wed. Thu 2026-07-09 has no attendance but is covered by leave.
    for (const date of ['2026-07-05', '2026-07-06', '2026-07-07', '2026-07-08']) {
      const resp = await agent.post(`/api/employees/${emp.body.id}/attendance`).send({ date, check_in: '09:00', check_out: '17:00', status: 'present' });
      expect([200, 201]).toContain(resp.status);
    }

    // Approved PAID leave for Thu -> no deduction (net 3000).
    await pool.query(
      "INSERT INTO hr_leave_requests (employee_id, leave_type, start_date, end_date, status) VALUES ($1,'vacation','2026-07-09','2026-07-09','approved')",
      [emp.body.id]
    );
    const paid = await agent.post('/api/payroll').send({ employee_id: emp.body.id, week_start: '2026-07-04' });
    expect(paid.status).toBe(201);
    expect(paid.body.payroll_breakdown.inferred_absent_days).toBe(0);
    expect(Number(paid.body.net_salary)).toBeCloseTo(3000, 2);

    // Switch the same leave to UNPAID -> Thu now counts as an absence (net 2400).
    await pool.query("UPDATE hr_leave_requests SET leave_type = 'unpaid' WHERE employee_id = $1", [emp.body.id]);
    const unpaid = await agent.post('/api/payroll').send({ employee_id: emp.body.id, week_start: '2026-07-04' });
    expect(unpaid.status).toBe(201);
    expect(unpaid.body.payroll_breakdown.inferred_absent_days).toBe(1);
    expect(Number(unpaid.body.net_salary)).toBeCloseTo(2400, 2);
  });

  test('prorates base salary for an employee hired mid-week', async () => {
    const agent = await createAdminAndLogin();

    const emp = await agent.post('/api/employees').send({
      name: 'Midweek Hire', email: 'midweek-hire@test.com', role: 'Operator',
      shift: 'morning', weekend_days: '5,6', salary: 3000,
    });
    expect(emp.status).toBe(201);
    // Hired Wed 2026-07-08: working days Sun,Mon,Tue are before hire (excluded);
    // employed working days = Wed, Thu = 2 of 5 => base = 3000 * 2/5 = 1200.
    await pool.query("UPDATE employees SET hire_date = '2026-07-08', termination_date = NULL WHERE id = $1", [emp.body.id]);
    for (const date of ['2026-07-08', '2026-07-09']) {
      const resp = await agent.post(`/api/employees/${emp.body.id}/attendance`).send({ date, check_in: '09:00', check_out: '17:00', status: 'present' });
      expect([200, 201]).toContain(resp.status);
    }

    const payroll = await agent.post('/api/payroll').send({ employee_id: emp.body.id, week_start: '2026-07-04' });
    expect(payroll.status).toBe(201);
    expect(Number(payroll.body.base_salary)).toBeCloseTo(1200, 2);
    expect(Number(payroll.body.payroll_breakdown.inferred_absent_days)).toBe(0);
    expect(Number(payroll.body.net_salary)).toBeCloseTo(1200, 2);
  });
});

describe('Device punch ingestion', () => {
  beforeEach(async () => {
    await resetData();
  });

  test('ingests punch events and auto-upserts attendance by employee device id', async () => {
    const agent = await createAdminAndLogin();

    const emp = await agent
      .post('/api/employees')
      .send({
        name: 'Device Worker',
        email: 'device-worker@test.com',
        role: 'Operator',
        shift: 'morning',
        shift_start: '09:00',
        shift_end: '17:00',
        weekend_days: '5,6',
        device_user_id: 'DVC-1001',
        salary: 2000,
      });
    expect(emp.status).toBe(201);

    const ingest = await request(app)
      .post('/api/device/punch-events')
      .set('x-device-api-key', process.env.DEVICE_INGEST_API_KEY)
      .send({
        events: [
          {
            external_event_id: 'evt-1',
            device_id: 'scanner-a',
            device_user_id: 'DVC-1001',
            punched_at: '2026-03-15T09:30:00',
            direction: 'in',
          },
          {
            external_event_id: 'evt-2',
            device_id: 'scanner-a',
            device_user_id: 'DVC-1001',
            punched_at: '2026-03-15T17:45:00',
            direction: 'out',
          },
        ],
      });

    expect(ingest.status).toBe(207);
    expect(ingest.body.accepted).toBe(2);

    const list = await agent.get(`/api/employees/${emp.body.id}/attendance?month=3&year=2026`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].status).toBe('late');
    expect(Number(list.body[0].late_minutes)).toBe(20);
    expect(Number(list.body[0].overtime_minutes)).toBe(45);
  });

  test('marks weekend device attendance as present vacation and full overtime', async () => {
    const agent = await createAdminAndLogin();

    const emp = await agent
      .post('/api/employees')
      .send({
        name: 'Weekend Device Worker',
        email: 'weekend-device-worker@test.com',
        role: 'Operator',
        shift: 'morning',
        shift_start: '09:00',
        shift_end: '17:00',
        weekend_days: '0,6',
        device_user_id: 'DVC-2001',
        salary: 2000,
      });
    expect(emp.status).toBe(201);

    const ingest = await request(app)
      .post('/api/device/punch-events')
      .set('x-device-api-key', process.env.DEVICE_INGEST_API_KEY)
      .send({
        events: [
          {
            external_event_id: 'evt-weekend-1',
            device_id: 'scanner-b',
            device_user_id: 'DVC-2001',
            punched_at: '2026-03-15T09:00:00',
            direction: 'in',
          },
          {
            external_event_id: 'evt-weekend-2',
            device_id: 'scanner-b',
            device_user_id: 'DVC-2001',
            punched_at: '2026-03-15T17:00:00',
            direction: 'out',
          },
        ],
      });

    expect(ingest.status).toBe(207);
    expect(ingest.body.accepted).toBe(2);

    const list = await agent.get(`/api/employees/${emp.body.id}/attendance?month=3&year=2026`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].status).toBe('present');
    expect(list.body[0].notes).toBe('present vacation');
    expect(Number(list.body[0].late_minutes)).toBe(0);
    expect(Number(list.body[0].early_leave_minutes)).toBe(0);
    expect(Number(list.body[0].overtime_minutes)).toBe(480);
  });
});

describe('Paid payroll spend reporting', () => {
  beforeEach(async () => {
    await resetData();
  });

  test('includes only paid payroll in dashboard spending and HR paid payout', async () => {
    const agent = await createAdminAndLogin();

    const emp = await agent
      .post('/api/employees')
      .send({
        name: 'Paid Payroll Worker',
        email: 'paid-payroll-worker@test.com',
        role: 'Operator',
        shift: 'morning',
        weekend_days: '5,6',
        salary: 3000,
      });
    expect(emp.status).toBe(201);
    // Fully employed, all working days present -> deterministic net = 3000.
    await pool.query("UPDATE employees SET hire_date = '2020-01-01', termination_date = NULL WHERE id = $1", [emp.body.id]);
    for (const date of ['2026-07-05', '2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09']) {
      const resp = await agent.post(`/api/employees/${emp.body.id}/attendance`).send({ date, check_in: '09:00', check_out: '17:00', status: 'present' });
      expect([200, 201]).toContain(resp.status);
    }

    const payroll = await agent
      .post('/api/payroll')
      .send({ employee_id: emp.body.id, week_start: '2026-07-04', bonus: 0, deductions: 0 });
    expect(payroll.status).toBe(201);
    expect(Number(payroll.body.net_salary)).toBeCloseTo(3000, 2);

    const beforePayDashboard = await agent.get('/api/dashboard/stats');
    expect(beforePayDashboard.status).toBe(200);
    expect(Number(beforePayDashboard.body.monthly_spent)).toBeCloseTo(0, 2);

    const markPaid = await agent.put(`/api/payroll/${payroll.body.id}/pay`);
    expect(markPaid.status).toBe(200);

    const afterPayDashboard = await agent.get('/api/dashboard/stats');
    expect(afterPayDashboard.status).toBe(200);
    expect(Number(afterPayDashboard.body.monthly_spent)).toBeCloseTo(3000, 2);
    expect(Number(afterPayDashboard.body.paid_payroll_spent)).toBeCloseTo(3000, 2);

    const hr = await agent.get('/api/reports/hr?month=7&year=2026');
    expect(hr.status).toBe(200);
    expect(Number(hr.body.payroll_summary.total_payout)).toBeCloseTo(3000, 2);
    expect(Number(hr.body.payroll_summary.paid_payout)).toBeCloseTo(3000, 2);
    expect(Number(hr.body.payroll_summary.pending_payout)).toBeCloseTo(0, 2);
    expect(Number(hr.body.payroll_summary.paid_count)).toBe(1);
    const julyHistory = (hr.body.payroll_history || []).find((row) => Number(row.month) === 7);
    expect(julyHistory).toBeDefined();
    expect(Number(julyHistory.paid_payout)).toBeCloseTo(3000, 2);
    expect(Number(julyHistory.pending_payout)).toBeCloseTo(0, 2);
    expect(Number(julyHistory.total_payout)).toBeCloseTo(3000, 2);
  });
});

describe('Dashboard stage efficiency reporting', () => {
  beforeEach(async () => {
    await resetData();
  });

  test('aggregates phase quantities, loss percentages, and latest-phase counts from tracking orders only', async () => {
    const agent = await createAdminAndLogin();

    const sortingEmployee = await agent
      .post('/api/employees')
      .send({ name: 'Dashboard Sorter', email: 'dashboard-sorter@test.com', role: 'Sorter', shift: 'morning', salary: 1200 });
    expect(sortingEmployee.status).toBe(201);

    const outsourcingEmployee = await agent
      .post('/api/employees')
      .send({ name: 'Dashboard Outsourcing', email: 'dashboard-outsourcing@test.com', role: 'Operator', shift: 'morning', salary: 1200 });
    expect(outsourcingEmployee.status).toBe(201);

    const finalEmployee = await agent
      .post('/api/employees')
      .send({ name: 'Dashboard Final', email: 'dashboard-final@test.com', role: 'Operator', shift: 'morning', salary: 1200 });
    expect(finalEmployee.status).toBe(201);

    const machineInsert = await pool.query(
      `INSERT INTO machines (name, code) VALUES ($1, $2) RETURNING id`,
      ['Dashboard Machine', 'DASH-1']
    );
    const machineId = machineInsert.rows[0].id;

    const manualTrackingOrder = await agent
      .post('/api/production-orders')
      .send({
        model_number: 'MANUAL-TRACK-100',
        product_name: 'Manual Track Product',
        quantity: 100,
        materials: [],
      });
    expect(manualTrackingOrder.status).toBe(201);

    const customer = await agent
      .post('/api/customers')
      .send({ name: 'Stage Dashboard Customer', email: 'stage-dashboard@test.com' });
    expect(customer.status).toBe(201);

    const salesOrder = await agent
      .post('/api/sales')
      .send({
        customer_id: customer.body.id,
        delivery_date: '2026-05-01',
        notes: 'Tracking dashboard sales order',
        items: [
          { product_name: 'DASH-SALES-200', quantity: 200, unit_price: 15, make_to_order: true },
        ],
      });
    expect(salesOrder.status).toBe(201);

    const production = await agent.get('/api/production');
    expect(production.status).toBe(200);

    const salesTrackingOrder = production.body.data.find((row) => row.sales_order_id === salesOrder.body.id);
    expect(salesTrackingOrder).toBeDefined();

    const sortingOnly = await agent
      .post(`/api/production-orders/${manualTrackingOrder.body.id}/sorting`)
      .send({
        quantity: 80,
        employee_id: sortingEmployee.body.id,
        machine_id: machineId,
        started_at: '2026-05-01T08:00:00Z',
        completed_at: '2026-05-01T09:00:00Z',
      });
    expect(sortingOnly.status).toBe(201);

    const sorting = await agent
      .post(`/api/production-orders/${salesTrackingOrder.id}/sorting`)
      .send({
        quantity: 180,
        employee_id: sortingEmployee.body.id,
        machine_id: machineId,
        started_at: '2026-05-01T08:30:00Z',
        completed_at: '2026-05-01T09:30:00Z',
      });
    expect(sorting.status).toBe(201);

    const outsourcing = await agent
      .post(`/api/production-orders/${salesTrackingOrder.id}/outsourcing`)
      .send({
        quantity: 170,
        employee_id: outsourcingEmployee.body.id,
        machine_id: machineId,
        started_at: '2026-05-01T10:00:00Z',
        completed_at: '2026-05-01T11:00:00Z',
      });
    expect(outsourcing.status).toBe(201);

    const final = await agent
      .post(`/api/production-orders/${salesTrackingOrder.id}/final`)
      .send({
        quantity: 160,
        employee_id: finalEmployee.body.id,
        machine_id: machineId,
        started_at: '2026-05-01T11:30:00Z',
        completed_at: '2026-05-01T12:30:00Z',
      });
    expect(final.status).toBe(201);

    const dashboard = await agent.get('/api/dashboard/stage-efficiency');
    expect(dashboard.status).toBe(200);

    // Expected by hand:
    // input: total_quantity=300, average_loss_percentage=0.00, current_order_count=0
    // sorting: total_quantity=260, average_loss_percentage=15.00, current_order_count=1
    // outsourcing: total_quantity=170, average_loss_percentage=5.56, current_order_count=0
    // final: total_quantity=160, average_loss_percentage=5.88, current_order_count=1
    expect(dashboard.body.input.total_quantity).toBe(300);
    expect(Number(dashboard.body.input.average_loss_percentage)).toBeCloseTo(0, 2);
    expect(dashboard.body.input.current_order_count).toBe(0);

    expect(dashboard.body.sorting.total_quantity).toBe(260);
    expect(Number(dashboard.body.sorting.average_loss_percentage)).toBeCloseTo(15, 2);
    expect(dashboard.body.sorting.current_order_count).toBe(1);

    expect(dashboard.body.outsourcing.total_quantity).toBe(170);
    expect(Number(dashboard.body.outsourcing.average_loss_percentage)).toBeCloseTo(5.56, 2);
    expect(dashboard.body.outsourcing.current_order_count).toBe(0);

    expect(dashboard.body.final.total_quantity).toBe(160);
    expect(Number(dashboard.body.final.average_loss_percentage)).toBeCloseTo(5.88, 2);
    expect(dashboard.body.final.current_order_count).toBe(1);
  });
});

describe('Customer payment ledger', () => {
  beforeEach(async () => {
    await resetData();
  });

  test('tracks weekly payments, allocates them FIFO across orders, and reports remaining balance', async () => {
    const agent = await createAdminAndLogin();

    const customer = await agent
      .post('/api/customers')
      .send({ name: 'Ledger Customer', email: 'ledger-customer@test.com' });
    expect(customer.status).toBe(201);

    const firstOrder = await agent
      .post('/api/sales')
      .send({
        customer_id: customer.body.id,
        delivery_date: '2026-04-01',
        items: [
          { product_name: 'T-Shirt', quantity: 10, unit_price: 10 },
        ],
      });
    expect(firstOrder.status).toBe(201);

    const secondOrder = await agent
      .post('/api/sales')
      .send({
        customer_id: customer.body.id,
        delivery_date: '2026-04-08',
        items: [
          { product_name: 'Polo', quantity: 5, unit_price: 30 },
        ],
      });
    expect(secondOrder.status).toBe(201);

    const firstPayment = await agent
      .post(`/api/customers/${customer.body.id}/payments`)
      .send({ payment_date: '2026-04-03', amount: 120, notes: 'Week 1 payment' });
    expect(firstPayment.status).toBe(201);

    const ledgerAfterFirstPayment = await agent.get(`/api/customers/${customer.body.id}/ledger`);
    expect(ledgerAfterFirstPayment.status).toBe(200);
    expect(Number(ledgerAfterFirstPayment.body.summary.total_ordered)).toBeCloseTo(250, 2);
    expect(Number(ledgerAfterFirstPayment.body.summary.total_paid)).toBeCloseTo(120, 2);
    expect(Number(ledgerAfterFirstPayment.body.summary.remaining_balance)).toBeCloseTo(130, 2);
    expect(Number(ledgerAfterFirstPayment.body.summary.credit_balance)).toBeCloseTo(0, 2);
    expect(ledgerAfterFirstPayment.body.payments).toHaveLength(1);

    const firstOrderLedger = ledgerAfterFirstPayment.body.orders.find((row) => row.id === firstOrder.body.id);
    const secondOrderLedger = ledgerAfterFirstPayment.body.orders.find((row) => row.id === secondOrder.body.id);
    expect(Number(firstOrderLedger.paid_amount)).toBeCloseTo(100, 2);
    expect(firstOrderLedger.payment_status).toBe('paid');
    expect(Number(secondOrderLedger.paid_amount)).toBeCloseTo(20, 2);
    expect(secondOrderLedger.payment_status).toBe('invoiced');

    const secondPayment = await agent
      .post(`/api/customers/${customer.body.id}/payments`)
      .send({ payment_date: '2026-04-10', amount: 200, notes: 'Week 2 payment' });
    expect(secondPayment.status).toBe(201);

    const ledgerAfterSecondPayment = await agent.get(`/api/customers/${customer.body.id}/ledger`);
    expect(ledgerAfterSecondPayment.status).toBe(200);
    expect(Number(ledgerAfterSecondPayment.body.summary.total_paid)).toBeCloseTo(320, 2);
    expect(Number(ledgerAfterSecondPayment.body.summary.remaining_balance)).toBeCloseTo(0, 2);
    expect(Number(ledgerAfterSecondPayment.body.summary.credit_balance)).toBeCloseTo(70, 2);
    expect(ledgerAfterSecondPayment.body.payments).toHaveLength(2);

    const finalFirstOrder = ledgerAfterSecondPayment.body.orders.find((row) => row.id === firstOrder.body.id);
    const finalSecondOrder = ledgerAfterSecondPayment.body.orders.find((row) => row.id === secondOrder.body.id);
    expect(Number(finalFirstOrder.paid_amount)).toBeCloseTo(100, 2);
    expect(finalFirstOrder.payment_status).toBe('paid');
    expect(Number(finalSecondOrder.paid_amount)).toBeCloseTo(150, 2);
    expect(finalSecondOrder.payment_status).toBe('paid');
  });

  test('stores PDF/image evidence for customer payments and exposes it in ledger', async () => {
    const agent = await createAdminAndLogin();

    const customer = await agent
      .post('/api/customers')
      .send({ name: 'Evidence Customer', email: 'evidence-customer@test.com' });
    expect(customer.status).toBe(201);

    const order = await agent
      .post('/api/sales')
      .send({
        customer_id: customer.body.id,
        delivery_date: '2026-04-20',
        items: [{ product_name: 'Proof Item', quantity: 2, unit_price: 50 }],
      });
    expect(order.status).toBe(201);

    const fixturePath = path.join(__dirname, 'tmp-payment-evidence.pdf');
    fs.writeFileSync(fixturePath, '%PDF-1.1\n1 0 obj\n<<>>\nendobj\n%%EOF');

    const payment = await agent
      .post(`/api/customers/${customer.body.id}/payments`)
      .field('payment_date', '2026-04-21')
      .field('amount', '30')
      .field('notes', 'evidence upload')
      .attach('evidence', fixturePath, {
        filename: 'proof.pdf',
        contentType: 'application/pdf',
      });

    fs.unlinkSync(fixturePath);

    expect(payment.status).toBe(201);
    expect(payment.body.evidence_url).toMatch(/^\/api\/uploads\/payment-evidence\//);
    expect(payment.body.evidence_name).toBe('proof.pdf');
    expect(payment.body.evidence_mime).toBe('application/pdf');

    const ledger = await agent.get(`/api/customers/${customer.body.id}/ledger`);
    expect(ledger.status).toBe(200);
    expect(ledger.body.payments).toHaveLength(1);
    expect(ledger.body.payments[0].evidence_url).toBe(payment.body.evidence_url);
    expect(ledger.body.payments[0].evidence_name).toBe('proof.pdf');
  });
});
