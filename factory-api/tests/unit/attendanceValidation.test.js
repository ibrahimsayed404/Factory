const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const employeeRoutes = require('../../src/routes/employee.routes');

const secret = process.env.JWT_SECRET || 'factory-jwt-secret-key-2026';
const adminToken = jwt.sign({ id: 1, role: 'admin' }, secret);
const staffToken = jwt.sign({ id: 2, role: 'staff' }, secret);

describe('Attendance Routes & Middleware Validation Unit Tests', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.t = (key, fallback) => fallback || key;
      next();
    });
    app.use('/api', employeeRoutes);
  });

  test('GET /api/employees/:id/attendance rejects non-admin users with 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/employees/12/attendance')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.statusCode).toBe(403);
  });

  test('POST /api/employees/:id/attendance rejects check_out before check_in with 400', async () => {
    const res = await request(app)
      .post('/api/employees/12/attendance')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        date: '2026-08-01',
        check_in: '17:00',
        check_out: '09:00',
      });
    expect(res.statusCode).toBe(400);
  });

  test('POST /api/employees/:id/attendance rejects future dates with 400', async () => {
    const res = await request(app)
      .post('/api/employees/12/attendance')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        date: '2030-01-01',
        check_in: '09:00',
        check_out: '17:00',
      });
    expect(res.statusCode).toBe(400);
  });

  test('POST /api/employees/:id/attendance rejects invalid time format with 400', async () => {
    const res = await request(app)
      .post('/api/employees/12/attendance')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        date: '2026-08-01',
        check_in: 'invalid-time',
        check_out: '17:00',
      });
    expect(res.statusCode).toBe(400);
  });
});
