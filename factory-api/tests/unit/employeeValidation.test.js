const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const employeeRoutes = require('../../src/routes/employee.routes');

const secret = process.env.JWT_SECRET || 'factory-jwt-secret-key-2026';
const adminToken = jwt.sign({ id: 1, role: 'admin' }, secret);

describe('Employee Routes & Middleware Validation Unit Tests', () => {
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

  test('POST /api/employees rejects future hire_date with 400', async () => {
    const res = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Future Employee',
        hire_date: '2030-01-01',
      });
    expect(res.statusCode).toBe(400);
  });

  test('POST /api/employees rejects termination_date < hire_date with 400', async () => {
    const res = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Invalid Date Employee',
        hire_date: '2026-06-01',
        termination_date: '2026-01-01',
      });
    expect(res.statusCode).toBe(400);
  });
});
