const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const employeeRoutes = require('../../src/modules/employees/employee.routes');

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

  test('POST /api/employees rejects invalid salary_type with 400', async () => {
    const res = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Invalid Salary Type',
        salary_type: 'crypto',
      });
    expect(res.statusCode).toBe(400);
  });

  test('POST /api/employees rejects negative hourly_rate with 400', async () => {
    const res = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Negative Rate Employee',
        hourly_rate: -10,
      });
    expect(res.statusCode).toBe(400);
  });

  test('POST /api/employees rejects negative fixed_salary with 400', async () => {
    const res = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Negative Salary Employee',
        fixed_salary: -500,
      });
    expect(res.statusCode).toBe(400);
  });

  test('POST /api/employees rejects emergency_contact longer than 100 chars with 400', async () => {
    const res = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Long Contact Employee',
        emergency_contact: 'a'.repeat(101),
      });
    expect(res.statusCode).toBe(400);
  });
});
