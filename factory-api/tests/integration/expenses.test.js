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
const ADMIN = 'expenses-admin@test.com';
const STAFF = 'expenses-staff@test.com';
let admin;
let staff;

const loginAs = async (email, role) => {
  await pool.query(
    'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)',
    [role === 'admin' ? 'Expenses Admin' : 'Expenses Staff', email, await bcrypt.hash('ExpPass123!', 10), role]
  );
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password: 'ExpPass123!' });
  agent.set('Authorization', `Bearer ${res.body.token}`);
  return agent;
};

beforeAll(async () => {
  await pool.query(schemaSql);
  await pool.query("DELETE FROM business_expenses WHERE category LIKE 'EXP-TEST%'");
  await pool.query('DELETE FROM users WHERE email = ANY($1)', [[ADMIN, STAFF]]);
  admin = await loginAs(ADMIN, 'admin');
  staff = await loginAs(STAFF, 'staff');
});

afterAll(async () => {
  await pool.query("DELETE FROM business_expenses WHERE category LIKE 'EXP-TEST%'");
  await pool.query("DELETE FROM audit_logs WHERE entity_name = 'business_expenses'");
  await pool.query('DELETE FROM users WHERE email = ANY($1)', [[ADMIN, STAFF]]);
  await pool.end();
});

test('added expenses are listed with who added them, filtered by date', async () => {
  await admin.post('/api/reports/sales/expenses').send({ expense_date: '2026-09-10', amount: 1200, category: 'EXP-TEST ابر', notes: 'مكن 2' });
  await admin.post('/api/reports/sales/expenses').send({ expense_date: '2026-08-01', amount: 500, category: 'EXP-TEST شريط' });

  const res = await admin.get('/api/reports/sales/expenses?start_date=2026-09-01&end_date=2026-09-30');
  expect(res.status).toBe(200);
  const mine = res.body.filter((e) => e.category.startsWith('EXP-TEST'));
  expect(mine).toHaveLength(1);
  expect(mine[0]).toMatchObject({ expense_date: '2026-09-10', amount: 1200, category: 'EXP-TEST ابر', notes: 'مكن 2', created_by_name: 'Expenses Admin' });
  expect(mine[0].created_at).toBeTruthy();

  const all = await admin.get('/api/reports/sales/expenses');
  expect(all.body.filter((e) => e.category.startsWith('EXP-TEST'))).toHaveLength(2);
});

test('editing an expense keeps the old values in the audit log', async () => {
  const created = await admin.post('/api/reports/sales/expenses').send({ expense_date: '2020-01-01', amount: 900, category: 'EXP-TEST typo' });
  const updated = await admin.put(`/api/reports/sales/expenses/${created.body.id}`).send({ expense_date: '2026-09-01', amount: 950, category: 'EXP-TEST fixed', notes: '' });
  expect(updated.status).toBe(200);
  expect(updated.body).toMatchObject({ expense_date: '2026-09-01', amount: 950, category: 'EXP-TEST fixed' });

  const audit = await pool.query("SELECT details FROM audit_logs WHERE entity_name = 'business_expenses' AND action = 'UPDATE' AND entity_id = $1", [String(created.body.id)]);
  expect(audit.rows[0].details.before).toMatchObject({ expense_date: '2020-01-01', amount: 900 });
});

test('deleting an expense removes it and records it in the audit log', async () => {
  const created = await admin.post('/api/reports/sales/expenses').send({ expense_date: '2026-09-02', amount: 75, category: 'EXP-TEST delete me' });
  const del = await admin.delete(`/api/reports/sales/expenses/${created.body.id}`);
  expect(del.status).toBe(200);
  expect((await pool.query('SELECT 1 FROM business_expenses WHERE id = $1', [created.body.id])).rowCount).toBe(0);
  const audit = await pool.query("SELECT details FROM audit_logs WHERE entity_name = 'business_expenses' AND action = 'DELETE' AND entity_id = $1", [String(created.body.id)]);
  expect(Number(audit.rows[0].details.amount)).toBe(75);

  expect((await admin.delete(`/api/reports/sales/expenses/${created.body.id}`)).status).toBe(404);
});

test('only admins can see or change expenses', async () => {
  expect((await staff.get('/api/reports/sales/expenses')).status).toBe(403);
  expect((await staff.put('/api/reports/sales/expenses/1').send({ amount: 1 })).status).toBe(403);
  expect((await staff.delete('/api/reports/sales/expenses/1')).status).toBe(403);
});
