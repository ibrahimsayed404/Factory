const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const payrollRoutes = require('../../src/routes/payroll.routes');

const secret = process.env.JWT_SECRET || 'factory-jwt-secret-key-2026';
const adminToken = jwt.sign({ id: 1, role: 'admin' }, secret);
const staffToken = jwt.sign({ id: 2, role: 'staff' }, secret);

describe('Payroll Routes & Middleware Validation Unit Tests', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    // Attach translation helper mock
    app.use((req, res, next) => {
      req.t = (key, fallback) => fallback || key;
      next();
    });
    app.use('/api', payrollRoutes);
  });

  test('GET /api/payroll rejects non-admin users with 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/payroll')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.statusCode).toBe(403);
  });

  test('PUT /api/payroll/:id/manual rejects negative bonus/deductions with 400', async () => {
    const res = await request(app)
      .put('/api/payroll/123/manual')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ manual_bonus: -50, manual_deductions: 10 });
    expect(res.statusCode).toBe(400);
  });

  test('DELETE /api/payroll/week/:weekStart rejects non-ISO date string with 400', async () => {
    const res = await request(app)
      .delete('/api/payroll/week/invalid-date')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(400);
  });
});
