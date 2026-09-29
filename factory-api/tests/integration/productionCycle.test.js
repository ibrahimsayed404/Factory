/* eslint-env jest */
require('dotenv').config();
require('./dbSafetyGuard');

const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/db/pool');

const schemaSql = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'db', 'schema.sql'), 'utf8');
const ADMIN_EMAIL = 'cycle-admin@test.com';
let agent;
let customerId;

beforeAll(async () => {
  await pool.query(schemaSql);
  await pool.query('DELETE FROM users WHERE email = $1', [ADMIN_EMAIL]);
  await pool.query(
    "INSERT INTO users (name, email, password, role) VALUES ('Cycle Admin', $1, $2, 'admin')",
    [ADMIN_EMAIL, await bcrypt.hash('CyclePass123!', 10)]
  );
  agent = request.agent(app);
  const login = await agent.post('/api/auth/login').send({ email: ADMIN_EMAIL, password: 'CyclePass123!' });
  agent.set('Authorization', `Bearer ${login.body.token}`);

  const cust = await pool.query("INSERT INTO customers (name) VALUES ('Machines Stage Customer') RETURNING id");
  customerId = cust.rows[0].id;
});

afterAll(async () => {
  await pool.query("DELETE FROM production_orders WHERE model_number LIKE 'MCH-%'");
  await pool.query('DELETE FROM sales_order_items WHERE sales_order_id IN (SELECT id FROM sales_orders WHERE customer_id = $1)', [customerId]);
  await pool.query('DELETE FROM sales_orders WHERE customer_id = $1', [customerId]);
  await pool.query('DELETE FROM customers WHERE id = $1', [customerId]);
  await pool.query('DELETE FROM users WHERE email = $1', [ADMIN_EMAIL]);
  await pool.end();
});

const createOrder = async (model) => {
  const res = await agent.post('/api/production-cycle/orders/cutting').send({
    modelNumber: model,
    orderName: 'Machines test',
    colors: [{ color: 'أسود', quantity: 100 }, { color: 'أبيض', quantity: 50 }],
  });
  expect(res.status).toBe(201);
  return res.body;
};

test('plain order: cutting -> sorting -> machines -> delivery, delivering the machines output', async () => {
  const order = await createOrder('MCH-1');
  const [black, white] = order.colors;

  const sorted = await agent.put(`/api/production-cycle/orders/${order.id}/sorting`).send({
    colors: [{ id: black.id, sorted_quantity: 98 }, { id: white.id, sorted_quantity: 50 }],
    next_action: 'delivery',
  });
  expect(sorted.status).toBe(200);
  expect(sorted.body.current_stage).toBe('machines');

  // Cannot skip the machines stage.
  const early = await agent.put(`/api/production-cycle/orders/${order.id}/deliver`).send({ customer_id: customerId, unit_price: 10 });
  expect(early.status).toBe(400);

  // More out of the machines than went in is rejected.
  const tooMany = await agent.put(`/api/production-cycle/orders/${order.id}/machines`).send({
    colors: [{ id: black.id, machine_quantity: 99 }, { id: white.id, machine_quantity: 50 }],
  });
  expect(tooMany.status).toBe(400);

  const machines = await agent.put(`/api/production-cycle/orders/${order.id}/machines`).send({
    colors: [{ id: black.id, machine_quantity: 95, machine_note: '3 تالف' }, { id: white.id, machine_quantity: 50 }],
    machine_notes: 'خلص المكن',
  });
  expect(machines.status).toBe(200);
  expect(machines.body.current_stage).toBe('ready_for_delivery');
  expect(machines.body.total_machine_quantity).toBe(145);
  expect(machines.body.colors.find((c) => c.id === black.id).machine_quantity).toBe(95);

  // Submitting the machines stage twice is rejected (order already moved on).
  const again = await agent.put(`/api/production-cycle/orders/${order.id}/machines`).send({
    colors: [{ id: black.id, machine_quantity: 95 }, { id: white.id, machine_quantity: 50 }],
  });
  expect(again.status).toBe(400);

  const delivered = await agent.put(`/api/production-cycle/orders/${order.id}/deliver`).send({ customer_id: customerId, unit_price: 10 });
  expect(delivered.status).toBe(200);
  expect(delivered.body.current_stage).toBe('delivered');
  expect(delivered.body.total_delivered_quantity).toBe(145);
  expect(Number(delivered.body.total_price)).toBe(1450);
});

test('printed order: print receive and skip both lead to machines; KPIs count the stage', async () => {
  const printed = await createOrder('MCH-2');
  await agent.put(`/api/production-cycle/orders/${printed.id}/sorting`).send({
    colors: printed.colors.map((c) => ({ id: c.id, sorted_quantity: c.cut_quantity })),
    next_action: 'printing',
  });
  const shop = await pool.query("INSERT INTO print_shops (name) VALUES ('MCH print shop') RETURNING id");
  const sent = await agent.put(`/api/production-cycle/orders/${printed.id}/print/send`).send({
    print_shop_id: shop.rows[0].id,
    colors: printed.colors.map((c) => ({ id: c.id, print_sent_quantity: c.cut_quantity })),
  });
  expect(sent.status).toBe(200);
  const received = await agent.put(`/api/production-cycle/orders/${printed.id}/print/receive`).send({
    colors: printed.colors.map((c) => ({ id: c.id, print_received_quantity: c.cut_quantity - 10 })),
  });
  expect(received.status).toBe(200);
  expect(received.body.current_stage).toBe('machines');

  // Input for the machines is now the print-shop output (90 black), not the cut (100).
  const overPrint = await agent.put(`/api/production-cycle/orders/${printed.id}/machines`).send({
    colors: printed.colors.map((c) => ({ id: c.id, machine_quantity: c.cut_quantity - 5 })),
  });
  expect(overPrint.status).toBe(400);

  const skipped = await createOrder('MCH-3');
  await agent.put(`/api/production-cycle/orders/${skipped.id}/sorting`).send({
    colors: skipped.colors.map((c) => ({ id: c.id, sorted_quantity: c.cut_quantity })),
    next_action: 'printing',
  });
  const skip = await agent.put(`/api/production-cycle/orders/${skipped.id}/print/skip`).send({});
  expect(skip.body.current_stage).toBe('machines');

  const kpis = await agent.get('/api/production-cycle/kpis');
  expect(kpis.status).toBe(200);
  expect(Number(kpis.body.machines_orders)).toBeGreaterThanOrEqual(2);

  await pool.query("DELETE FROM production_orders WHERE model_number IN ('MCH-2', 'MCH-3')");
  await pool.query("DELETE FROM print_shops WHERE name = 'MCH print shop'");
});
