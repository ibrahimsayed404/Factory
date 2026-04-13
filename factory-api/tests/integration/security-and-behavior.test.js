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
const pool = require('../../config/db');

const schemaPath = path.join(__dirname, '..', '..', 'src', 'db', 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');

const resetData = async () => {
  await pool.query(`
    TRUNCATE TABLE
      production_materials,
      production_orders,
      sales_order_items,
      sales_orders,
      customers,
      payroll,
      attendance,
      employees,
      materials,
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
  await pool.query('ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS evidence_url TEXT');
  await pool.query('ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS evidence_name VARCHAR(255)');
  await pool.query('ALTER TABLE customer_payments ADD COLUMN IF NOT EXISTS evidence_mime VARCHAR(100)');
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

    expect(salesOrder.status).toBe(201);

    const production = await agent.get('/api/production');
    expect(production.status).toBe(200);

    const linkedOrders = production.body.data.filter((row) => row.sales_order_id === salesOrder.body.id);
    expect(linkedOrders).toHaveLength(2);
    expect(linkedOrders.every((row) => row.assigned_to === null)).toBe(true);
    expect(linkedOrders.map((row) => row.product_name).sort()).toEqual(['1231-t-shirt', 'Polo Shirt']);
    expect(linkedOrders.map((row) => Number(row.quantity)).sort((a, b) => a - b)).toEqual([500, 3500]);
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

    const attendanceRows = [
      { date: '2026-03-01', check_in: '09:30', check_out: '17:00', status: 'present' },
      { date: '2026-03-02', check_in: '09:00', check_out: '17:00', status: 'absent' },
      { date: '2026-03-03', check_in: '09:00', check_out: '18:00', status: 'present' },
      { date: '2026-03-04', check_in: '09:00', check_out: '17:00', status: 'half-day' },
    ];

    for (const row of attendanceRows) {
      const resp = await agent
        .post(`/api/employees/${employeeId}/attendance`)
        .send(row);
      expect([200, 201]).toContain(resp.status);
    }

    const payroll = await agent
      .post('/api/payroll')
      .send({ employee_id: employeeId, month: 3, year: 2026, bonus: 10, deductions: 5 });

    expect(payroll.status).toBe(201);
    expect(payroll.body.payroll_breakdown).toBeDefined();
    expect(payroll.body.payroll_breakdown.late_minutes).toBe(20);
    expect(payroll.body.payroll_breakdown.overtime_minutes).toBe(60);
    expect(payroll.body.payroll_breakdown.regular_overtime_minutes).toBe(60);
    expect(payroll.body.payroll_breakdown.weekend_overtime_minutes).toBe(0);
    expect(payroll.body.payroll_breakdown.absent_days).toBe(1);
    expect(payroll.body.payroll_breakdown.half_days).toBe(1);

    // salary=3000 => daily=100, minute~=0.2083
    // weighted late = first 15m at 1x + remaining 5m at 1.5x => 22.5m
    // auto deductions = weighted-late(22.5m)=4.69 + absent(1d)=100 + half-day(0.5d)=50 => 154.69
    // auto bonus = overtime(60m)*minute*1.5 => 18.75
    // final bonus = 18.75 + 10(manual) => 28.75
    // final deductions = 154.69 + 5(manual) => 159.69
    // net = 3000 + 28.75 - 159.69 => 2869.06
    expect(Number(payroll.body.bonus)).toBeCloseTo(28.75, 2);
    expect(Number(payroll.body.deductions)).toBeCloseTo(159.69, 2);
    expect(Number(payroll.body.net_salary)).toBeCloseTo(2869.06, 2);

    const list = await agent.get('/api/payroll?month=3&year=2026');
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].payroll_breakdown).toBeDefined();
    expect(Number(list.body.data[0].payroll_breakdown.auto_bonus)).toBeCloseTo(18.75, 2);
    expect(Number(list.body.data[0].payroll_breakdown.auto_deductions)).toBeCloseTo(154.69, 2);
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

    const attendance = await agent
      .post(`/api/employees/${emp.body.id}/attendance`)
      .send({
        date: '2026-03-15',
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

    const payroll = await agent
      .post('/api/payroll')
      .send({ employee_id: emp.body.id, month: 3, year: 2026, bonus: 0, deductions: 0 });

    expect(payroll.status).toBe(201);
    expect(payroll.body.payroll_breakdown.overtime_minutes).toBe(480);
    expect(payroll.body.payroll_breakdown.regular_overtime_minutes).toBe(0);
    expect(payroll.body.payroll_breakdown.weekend_overtime_minutes).toBe(480);
    expect(Number(payroll.body.bonus)).toBeCloseTo(100, 2);
    expect(Number(payroll.body.net_salary)).toBeCloseTo(3100, 2);

    const list = await agent.get('/api/payroll?month=3&year=2026');
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

    const rows = [
      { date: '2026-03-17', check_in: '09:00', check_out: '17:00', status: 'present' },
      { date: '2026-03-19', check_in: '09:00', check_out: '17:00', status: 'present' },
    ];

    for (const row of rows) {
      const resp = await agent
        .post(`/api/employees/${employeeId}/attendance`)
        .send(row);
      expect([200, 201]).toContain(resp.status);
    }

    const payroll = await agent
      .post('/api/payroll')
      .send({ employee_id: employeeId, month: 3, year: 2026, bonus: 0, deductions: 0 });

    expect(payroll.status).toBe(201);
    expect(payroll.body.payroll_breakdown).toBeDefined();
    expect(payroll.body.payroll_breakdown.absent_days).toBe(1);
    expect(payroll.body.payroll_breakdown.inferred_absent_days).toBe(1);
    expect(Number(payroll.body.deductions)).toBeCloseTo(100, 2);
    expect(Number(payroll.body.net_salary)).toBeCloseTo(2900, 2);
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

    const payroll = await agent
      .post('/api/payroll')
      .send({ employee_id: emp.body.id, month: 3, year: 2026, bonus: 0, deductions: 0 });
    expect(payroll.status).toBe(201);

    const beforePayDashboard = await agent.get('/api/dashboard/stats');
    expect(beforePayDashboard.status).toBe(200);
    expect(Number(beforePayDashboard.body.monthly_spent)).toBeCloseTo(0, 2);

    const markPaid = await agent.put(`/api/payroll/${payroll.body.id}/pay`);
    expect(markPaid.status).toBe(200);

    const afterPayDashboard = await agent.get('/api/dashboard/stats');
    expect(afterPayDashboard.status).toBe(200);
    expect(Number(afterPayDashboard.body.monthly_spent)).toBeCloseTo(3000, 2);
    expect(Number(afterPayDashboard.body.paid_payroll_spent)).toBeCloseTo(3000, 2);

    const hr = await agent.get('/api/reports/hr?month=3&year=2026');
    expect(hr.status).toBe(200);
    expect(Number(hr.body.payroll_summary.total_payout)).toBeCloseTo(3000, 2);
    expect(Number(hr.body.payroll_summary.paid_payout)).toBeCloseTo(3000, 2);
    expect(Number(hr.body.payroll_summary.pending_payout)).toBeCloseTo(0, 2);
    expect(Number(hr.body.payroll_summary.paid_count)).toBe(1);
    const marchHistory = (hr.body.payroll_history || []).find((row) => Number(row.month) === 3);
    expect(marchHistory).toBeDefined();
    expect(Number(marchHistory.paid_payout)).toBeCloseTo(3000, 2);
    expect(Number(marchHistory.pending_payout)).toBeCloseTo(0, 2);
    expect(Number(marchHistory.total_payout)).toBeCloseTo(3000, 2);
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
