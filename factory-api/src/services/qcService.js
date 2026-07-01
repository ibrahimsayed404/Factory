const pool = require('../db/pool');

class QCService {
  async getDefectCategories() {
    const { rows } = await pool.query(`SELECT * FROM qc_defect_categories ORDER BY name`);
    return rows;
  }

  async getAll(filters = {}) {
    let query = `
      SELECT q.*, 
             e.name AS inspector_name,
             (SELECT COUNT(*) FROM qc_inspection_photos p WHERE p.inspection_id = q.id) AS photo_count,
             (SELECT COUNT(*) FROM qc_inspection_defects d WHERE d.inspection_id = q.id) AS defect_count
      FROM qc_inspections q
      LEFT JOIN employees e ON q.inspector_id = e.id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (filters.status) {
      query += ` AND q.status = $${idx++}`;
      params.push(filters.status);
    }
    if (filters.inspection_type) {
      query += ` AND q.inspection_type = $${idx++}`;
      params.push(filters.inspection_type);
    }
    if (filters.reference_type) {
      query += ` AND q.reference_type = $${idx++}`;
      params.push(filters.reference_type);
    }
    if (filters.reference_id) {
      query += ` AND q.reference_id = $${idx++}`;
      params.push(filters.reference_id);
    }

    query += ` ORDER BY q.created_at DESC`;
    const { rows } = await pool.query(query, params);
    return rows;
  }

  async getById(id) {
    const { rows } = await pool.query(`
      SELECT q.*, e.name AS inspector_name
      FROM qc_inspections q
      LEFT JOIN employees e ON q.inspector_id = e.id
      WHERE q.id = $1
    `, [id]);
    
    if (!rows[0]) throw new Error('Inspection not found');
    const inspection = rows[0];

    const defectsRes = await pool.query(`
      SELECT d.*, c.name AS category_name
      FROM qc_inspection_defects d
      JOIN qc_defect_categories c ON d.defect_category_id = c.id
      WHERE d.inspection_id = $1
    `, [id]);
    inspection.defects = defectsRes.rows;

    const photosRes = await pool.query(`SELECT id, file_path, created_at FROM qc_inspection_photos WHERE inspection_id = $1`, [id]);
    inspection.photos = photosRes.rows;

    return inspection;
  }

  async create(data, inspectorId) {
    const { inspection_type, reference_type, reference_id, total_quantity, notes } = data;
    
    // Check if total_quantity is provided, else try to fetch from reference
    let qty = total_quantity;
    if (!qty) {
      if (reference_type === 'purchase_order') {
        const { rows } = await pool.query(`SELECT SUM(quantity) as qty FROM purchase_order_items WHERE purchase_order_id = $1`, [reference_id]);
        qty = rows[0]?.qty || 0;
      } else if (reference_type === 'work_order') {
        const { rows } = await pool.query(`SELECT produced_quantity as qty FROM work_orders WHERE id = $1`, [reference_id]);
        qty = rows[0]?.qty || 0;
      } else if (reference_type === 'production_order') {
        const { rows } = await pool.query(`SELECT quantity as qty FROM production_orders WHERE id = $1`, [reference_id]);
        qty = rows[0]?.qty || 0;
      }
    }

    if (!qty || qty <= 0) throw new Error('Total quantity must be greater than 0');

    const { rows } = await pool.query(`
      INSERT INTO qc_inspections (inspection_type, reference_type, reference_id, inspector_id, total_quantity, status, notes)
      VALUES ($1, $2, $3, $4, $5, 'pending', $6)
      RETURNING *
    `, [inspection_type, reference_type, reference_id, inspectorId, qty, notes]);

    return rows[0];
  }

  async updateResults(id, data) {
    const { passed_quantity, failed_quantity, rework_quantity, notes, defects } = data;
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const { rows } = await client.query(`SELECT * FROM qc_inspections WHERE id = $1 FOR UPDATE`, [id]);
      if (!rows[0]) throw new Error('Inspection not found');
      const inspection = rows[0];

      const total = passed_quantity + failed_quantity + rework_quantity;
      if (total !== inspection.total_quantity) {
        throw new Error(`Total quantities (${total}) must equal inspection total quantity (${inspection.total_quantity})`);
      }

      let status = 'passed';
      if (failed_quantity === inspection.total_quantity) status = 'failed';
      else if (failed_quantity > 0 || rework_quantity > 0) status = 'partial';
      if (rework_quantity > 0 && failed_quantity === 0 && passed_quantity === 0) status = 'rework';

      await client.query(`
        UPDATE qc_inspections 
        SET passed_quantity = $1, failed_quantity = $2, rework_quantity = $3, status = $4, notes = COALESCE($5, notes), updated_at = NOW()
        WHERE id = $6
      `, [passed_quantity, failed_quantity, rework_quantity, status, notes, id]);

      // If rework is requested on a work order, update the work order
      if (inspection.reference_type === 'work_order' && rework_quantity > 0) {
        await client.query(`
          UPDATE work_orders 
          SET rework_quantity = rework_quantity + $1, status = 'rework', updated_at = NOW()
          WHERE id = $2
        `, [rework_quantity, inspection.reference_id]);
      }

      // Add defects if provided
      if (defects && Array.isArray(defects)) {
        for (const defect of defects) {
          await client.query(`
            INSERT INTO qc_inspection_defects (inspection_id, defect_category_id, quantity, notes)
            VALUES ($1, $2, $3, $4)
          `, [id, defect.defect_category_id, defect.quantity, defect.notes]);
        }
      }

      await client.query('COMMIT');
      return await this.getById(id);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async addPhoto(id, file) {
    // Assuming file is an object with a path/filename
    const { rows } = await pool.query(`
      INSERT INTO qc_inspection_photos (inspection_id, file_path)
      VALUES ($1, $2)
      RETURNING *
    `, [id, file.filename]);
    return rows[0];
  }

  async getReports() {
    // Basic QC Reports: yield rate, top defects
    const summaryRes = await pool.query(`
      SELECT 
        COUNT(*) as total_inspections,
        SUM(total_quantity) as total_inspected_qty,
        SUM(passed_quantity) as total_passed_qty,
        SUM(failed_quantity) as total_failed_qty,
        SUM(rework_quantity) as total_rework_qty
      FROM qc_inspections
    `);
    
    const defectsRes = await pool.query(`
      SELECT c.name as category, SUM(d.quantity) as total_quantity
      FROM qc_inspection_defects d
      JOIN qc_defect_categories c ON d.defect_category_id = c.id
      GROUP BY c.name
      ORDER BY total_quantity DESC
      LIMIT 10
    `);

    return {
      summary: summaryRes.rows[0],
      top_defects: defectsRes.rows
    };
  }
}

module.exports = new QCService();
