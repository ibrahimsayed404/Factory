const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/db/pool');
const jwt = require('jsonwebtoken');

describe('Quality Control API Integration Tests', () => {
  let token;
  let inspectorId;

  beforeAll(async () => {
    // Insert a test user
    const userRes = await pool.query(`
      INSERT INTO users (name, email, password, role)
      VALUES ('QC Inspector', 'qc@test.com', 'password', 'staff')
      RETURNING id
    `);
    const userId = userRes.rows[0].id;
    
    // Insert a test employee for the inspector
    const empRes = await pool.query(`
      INSERT INTO employees (name, email)
      VALUES ('QC Inspector', 'qc@test.com')
      RETURNING id
    `);
    inspectorId = empRes.rows[0].id;

    token = jwt.sign({ id: userId, role: 'staff' }, process.env.JWT_SECRET || 'your_super_secret_jwt_key');
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email = $1', ['qc@test.com']);
    await pool.query('DELETE FROM employees WHERE email = $1', ['qc@test.com']);
  });

  it('should fetch defect categories', async () => {
    const res = await request(app)
      .get('/api/qc/defect-categories')
      .set('Authorization', `Bearer ${token}`);
      
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('should create and update a QC inspection', async () => {
    // 1. Create inspection
    const createRes = await request(app)
      .post('/api/qc/inspections')
      .set('Authorization', `Bearer ${token}`)
      .send({
        inspection_type: 'final',
        reference_type: 'production_order',
        reference_id: 9999, // dummy ID
        total_quantity: 100,
        notes: 'Test inspection'
      });
      
    expect(createRes.status).toBe(201);
    expect(createRes.body.status).toBe('pending');
    expect(createRes.body.total_quantity).toBe(100);

    const inspectionId = createRes.body.id;

    // 2. Fetch categories to get an ID
    const catRes = await request(app)
      .get('/api/qc/defect-categories')
      .set('Authorization', `Bearer ${token}`);
    const categoryId = catRes.body[0].id;

    // 3. Update Results (Pass 90, Fail 5, Rework 5)
    const updateRes = await request(app)
      .put(`/api/qc/inspections/${inspectionId}/results`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        passed_quantity: 90,
        failed_quantity: 5,
        rework_quantity: 5,
        notes: 'Completed with minor defects',
        defects: [
          { defect_category_id: categoryId, quantity: 5, notes: 'Bad stitching' }
        ]
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.status).toBe('partial');
    expect(updateRes.body.passed_quantity).toBe(90);
    expect(updateRes.body.defects.length).toBe(1);
    expect(updateRes.body.defects[0].quantity).toBe(5);

    // Clean up
    await pool.query('DELETE FROM qc_inspections WHERE id = $1', [inspectionId]);
  });
});
