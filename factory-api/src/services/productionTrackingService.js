const { randomBytes } = require('node:crypto');
const pool = require('../../config/db');
const ApiError = require('../utils/ApiError');

const PHASE_INPUT = 'input';
const PHASE_SORTING = 'sorting';
const PHASE_FINAL = 'final';
const HIGH_LOSS_THRESHOLD_PERCENT = 10;

let schemaEnsured = false;

const ensureTrackingSchema = async () => {
  if (schemaEnsured) return;

  await pool.query(`
    ALTER TABLE production_orders
      ADD COLUMN IF NOT EXISTS model_number VARCHAR(100),
      ADD COLUMN IF NOT EXISTS planned_quantity INT
  `);

  await pool.query(`
    UPDATE production_orders
    SET model_number = COALESCE(model_number, product_name)
    WHERE model_number IS NULL
  `);

  await pool.query(`
    UPDATE production_orders
    SET planned_quantity = COALESCE(planned_quantity, quantity)
    WHERE planned_quantity IS NULL
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'production_phase_name'
      ) THEN
        CREATE TYPE production_phase_name AS ENUM ('input', 'sorting', 'final');
      END IF;
    END $$;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS machines (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL UNIQUE,
      code VARCHAR(60) UNIQUE,
      status VARCHAR(30) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS production_phases (
      id SERIAL PRIMARY KEY,
      order_id INT NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
      phase_name production_phase_name NOT NULL,
      quantity INT NOT NULL CHECK (quantity >= 0),
      loss_reason TEXT,
      employee_id INT REFERENCES employees(id) ON DELETE SET NULL,
      machine_id INT REFERENCES machines(id) ON DELETE SET NULL,
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE production_phases
      ADD COLUMN IF NOT EXISTS loss_reason TEXT,
      ADD COLUMN IF NOT EXISTS employee_id INT,
      ADD COLUMN IF NOT EXISTS machine_id INT,
      ADD COLUMN IF NOT EXISTS started_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'production_phases_employee_id_fkey'
      ) THEN
        ALTER TABLE production_phases
          ADD CONSTRAINT production_phases_employee_id_fkey
          FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'production_phases_machine_id_fkey'
      ) THEN
        ALTER TABLE production_phases
          ADD CONSTRAINT production_phases_machine_id_fkey
          FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_production_phases_order_phase_created
      ON production_phases(order_id, phase_name, created_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_production_phases_order_phase_time
      ON production_phases(order_id, phase_name, completed_at DESC)
  `);

  schemaEnsured = true;
};

const buildOrderNumber = (prefix = 'PTO') => {
  const ts = Date.now().toString().slice(-8);
  const rand = randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${ts}-${rand}`;
};

const calculateMetrics = ({ inputQty, sortingQty, finalQty }) => {
  const hasInput = Number.isFinite(inputQty);
  const hasSorting = Number.isFinite(sortingQty);
  const hasFinal = Number.isFinite(finalQty);

  const sortingLoss = hasInput && hasSorting ? inputQty - sortingQty : null;
  const finalLoss = hasSorting && hasFinal ? sortingQty - finalQty : null;
  const totalLoss = hasInput && hasFinal ? inputQty - finalQty : null;
  const efficiency = hasInput && hasFinal && inputQty > 0
    ? Number(((finalQty / inputQty) * 100).toFixed(2))
    : null;
  const lossPercentage = hasInput && hasFinal && inputQty > 0
    ? Number((((inputQty - finalQty) / inputQty) * 100).toFixed(2))
    : null;

  const alerts = [];
  if (lossPercentage !== null && lossPercentage > HIGH_LOSS_THRESHOLD_PERCENT) {
    alerts.push({
      type: 'HIGH_LOSS',
      message: 'High loss detected in production order',
    });
  }

  return {
    sorting_loss: sortingLoss,
    final_loss: finalLoss,
    total_loss: totalLoss,
    efficiency,
    loss_percentage: lossPercentage,
    alerts,
  };
};

const mapOrderReport = (row) => {
  const inputQty = row.input_quantity !== null && row.input_quantity !== undefined
    ? Number(row.input_quantity)
    : Number(row.planned_quantity || row.quantity || 0);
  const sortingQty = row.sorting_quantity !== null && row.sorting_quantity !== undefined
    ? Number(row.sorting_quantity)
    : null;
  const finalQty = row.final_quantity !== null && row.final_quantity !== undefined
    ? Number(row.final_quantity)
    : null;

  return {
    id: row.id,
    order_number: row.order_number,
    model_number: row.model_number || row.product_name,
    planned_quantity: Number(row.planned_quantity || row.quantity || 0),
    status: row.status,
    phases: {
      input: inputQty,
      sorting: sortingQty,
      final: finalQty,
    },
    ...calculateMetrics({ inputQty, sortingQty, finalQty }),
    created_at: row.created_at,
  };
};

const getPhaseDurationMinutes = (startedAt, completedAt) => {
  if (!startedAt || !completedAt) return null;
  const start = new Date(startedAt);
  const end = new Date(completedAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return null;
  return Math.round(diffMs / 60000);
};

const formatPhaseRow = (phase) => ({
  id: phase.id,
  phase: phase.phase_name,
  quantity: Number(phase.quantity),
  employee_id: phase.employee_id !== null ? Number(phase.employee_id) : null,
  employee: phase.employee_name || null,
  machine_id: phase.machine_id !== null ? Number(phase.machine_id) : null,
  machine: phase.machine_name || null,
  loss_reason: phase.loss_reason || null,
  started_at: phase.started_at,
  completed_at: phase.completed_at,
  duration_minutes: getPhaseDurationMinutes(phase.started_at, phase.completed_at),
});

const buildDetailedReport = (orderRow, phaseRows) => {
  const latestByPhase = new Map();
  for (const phase of phaseRows) {
    latestByPhase.set(phase.phase_name, phase);
  }

  const inputQty = latestByPhase.has(PHASE_INPUT)
    ? Number(latestByPhase.get(PHASE_INPUT).quantity)
    : Number(orderRow.planned_quantity || orderRow.quantity || 0);
  const sortingQty = latestByPhase.has(PHASE_SORTING)
    ? Number(latestByPhase.get(PHASE_SORTING).quantity)
    : null;
  const finalQty = latestByPhase.has(PHASE_FINAL)
    ? Number(latestByPhase.get(PHASE_FINAL).quantity)
    : null;

  const metrics = calculateMetrics({ inputQty, sortingQty, finalQty });
  const alerts = metrics.alerts.map((alert) => ({ ...alert, order_id: Number(orderRow.id) }));

  if (sortingQty !== null && inputQty > 0) {
    const sortingLossPct = Number((((inputQty - sortingQty) / inputQty) * 100).toFixed(2));
    if (sortingLossPct > HIGH_LOSS_THRESHOLD_PERCENT) {
      alerts.push({
        type: 'HIGH_LOSS',
        message: 'High loss detected in Sorting phase',
        order_id: Number(orderRow.id),
      });
    }
  }

  if (finalQty !== null && sortingQty !== null && sortingQty > 0) {
    const finalLossPct = Number((((sortingQty - finalQty) / sortingQty) * 100).toFixed(2));
    if (finalLossPct > HIGH_LOSS_THRESHOLD_PERCENT) {
      alerts.push({
        type: 'HIGH_LOSS',
        message: 'High loss detected in Final phase',
        order_id: Number(orderRow.id),
      });
    }
  }

  return {
    id: Number(orderRow.id),
    order_id: Number(orderRow.id),
    order_number: orderRow.order_number,
    model_number: orderRow.model_number || orderRow.product_name,
    input: inputQty,
    sorting: sortingQty,
    final: finalQty,
    sorting_loss: metrics.sorting_loss,
    final_loss: metrics.final_loss,
    total_loss: metrics.total_loss,
    efficiency: metrics.efficiency,
    loss_percentage: metrics.loss_percentage,
    alerts,
    phases: phaseRows.map(formatPhaseRow),
  };
};

const getOrderWithLatestPhases = async (client, orderId) => {
  const result = await client.query(
    `WITH latest_phases AS (
       SELECT DISTINCT ON (pp.order_id, pp.phase_name)
         pp.order_id,
         pp.phase_name,
         pp.quantity
       FROM production_phases pp
       WHERE pp.order_id = $1
       ORDER BY pp.order_id, pp.phase_name, pp.created_at DESC, pp.id DESC
     )
     SELECT
       po.*,
       MAX(CASE WHEN lp.phase_name = 'input' THEN lp.quantity END) AS input_quantity,
       MAX(CASE WHEN lp.phase_name = 'sorting' THEN lp.quantity END) AS sorting_quantity,
       MAX(CASE WHEN lp.phase_name = 'final' THEN lp.quantity END) AS final_quantity
     FROM production_orders po
     LEFT JOIN latest_phases lp ON lp.order_id = po.id
     WHERE po.id = $1
     GROUP BY po.id`,
    [orderId]
  );

  return result.rows[0] || null;
};

const listProductionOrders = async ({ page = 1, limit = 50 }) => {
  await ensureTrackingSchema();
  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const pageSize = Math.min(1000, Math.max(1, Number.parseInt(limit, 10) || 50));
  const offset = (pageNum - 1) * pageSize;

  const [countResult, dataResult] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM production_orders'),
    pool.query(
      `WITH latest_phases AS (
         SELECT DISTINCT ON (pp.order_id, pp.phase_name)
           pp.order_id,
           pp.phase_name,
           pp.quantity
         FROM production_phases pp
         ORDER BY pp.order_id, pp.phase_name, pp.created_at DESC, pp.id DESC
       )
       SELECT
         po.*,
         MAX(CASE WHEN lp.phase_name = 'input' THEN lp.quantity END) AS input_quantity,
         MAX(CASE WHEN lp.phase_name = 'sorting' THEN lp.quantity END) AS sorting_quantity,
         MAX(CASE WHEN lp.phase_name = 'final' THEN lp.quantity END) AS final_quantity
       FROM production_orders po
       LEFT JOIN latest_phases lp ON lp.order_id = po.id
       GROUP BY po.id
       ORDER BY po.created_at DESC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    ),
  ]);

  const total = Number.parseInt(countResult.rows[0].count, 10);
  return {
    data: dataResult.rows.map(mapOrderReport),
    total,
    page: pageNum,
    limit: pageSize,
  };
};

const createProductionOrder = async ({ modelNumber, quantity, materials = [] }) => {
  await ensureTrackingSchema();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const plannedQuantity = Number.parseInt(quantity, 10);
    let order = null;

    for (let i = 0; i < 5; i += 1) {
      const orderNumber = buildOrderNumber();
      try {
        const orderResult = await client.query(
          `INSERT INTO production_orders
           (order_number, model_number, planned_quantity, product_name, quantity, status)
           VALUES ($1, $2, $3, $4, $5, 'pending')
           RETURNING *`,
          [orderNumber, modelNumber, plannedQuantity, modelNumber, plannedQuantity]
        );
        order = orderResult.rows[0];
        break;
      } catch (err) {
        if (err.code !== '23505') throw err;
      }
    }

    if (!order) {
      throw new ApiError(500, 'Could not generate unique production order number');
    }

    for (const material of materials) {
      const materialId = Number.parseInt(material.material_id, 10);
      const requiredQty = Number(material.quantity);

      const materialResult = await client.query(
        'SELECT id, name, quantity FROM materials WHERE id = $1 FOR UPDATE',
        [materialId]
      );

      if (!materialResult.rows.length) {
        throw new ApiError(400, `Material ${materialId} not found`);
      }

      const availableQty = Number(materialResult.rows[0].quantity || 0);
      if (requiredQty > availableQty) {
        throw new ApiError(
          400,
          `Insufficient stock for ${materialResult.rows[0].name}. Required ${requiredQty}, available ${availableQty}`
        );
      }

      await client.query(
        `INSERT INTO production_materials (production_order_id, material_id, quantity_used)
         VALUES ($1, $2, $3)`,
        [order.id, materialId, requiredQty]
      );

      await client.query(
        'UPDATE materials SET quantity = quantity - $1, updated_at = NOW() WHERE id = $2',
        [requiredQty, materialId]
      );
    }

    await client.query(
      `INSERT INTO production_phases (order_id, phase_name, quantity)
       VALUES ($1, $2, $3)`,
      [order.id, PHASE_INPUT, plannedQuantity]
    );

    await client.query('COMMIT');

    const reportRow = await getOrderWithLatestPhases(client, order.id);
    return mapOrderReport(reportRow);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const addProductionPhase = async ({
  orderId,
  phaseName,
  quantity,
  lossReason = null,
  employeeId,
  machineId = null,
  startedAt,
  completedAt,
}) => {
  await ensureTrackingSchema();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const startedAtDate = new Date(startedAt);
    const completedAtDate = new Date(completedAt);
    if (Number.isNaN(startedAtDate.getTime()) || Number.isNaN(completedAtDate.getTime())) {
      throw new ApiError(400, 'started_at and completed_at must be valid ISO timestamps');
    }
    if (completedAtDate <= startedAtDate) {
      throw new ApiError(400, 'completed_at must be greater than started_at');
    }

    const order = await getOrderWithLatestPhases(client, orderId);
    if (!order) {
      throw new ApiError(404, 'Production order not found');
    }

    const nextQty = Number.parseInt(quantity, 10);
    const inputQty = order.input_quantity !== null && order.input_quantity !== undefined
      ? Number(order.input_quantity)
      : Number(order.planned_quantity || order.quantity || 0);
    const sortingQty = order.sorting_quantity !== null && order.sorting_quantity !== undefined
      ? Number(order.sorting_quantity)
      : null;

    if (phaseName === PHASE_SORTING) {
      if (nextQty > inputQty) {
        throw new ApiError(400, 'Sorting quantity cannot exceed input quantity');
      }
    }

    if (phaseName === PHASE_FINAL) {
      if (sortingQty === null) {
        throw new ApiError(400, 'Sorting phase must be recorded before final phase');
      }
      if (nextQty > sortingQty) {
        throw new ApiError(400, 'Final quantity cannot exceed sorting quantity');
      }
    }

    const existingPhase = await client.query(
      `SELECT id
       FROM production_phases
       WHERE order_id = $1 AND phase_name = $2
       LIMIT 1`,
      [orderId, phaseName]
    );
    if (existingPhase.rows.length) {
      throw new ApiError(409, `${phaseName} phase is already recorded for this order`);
    }

    const employeeCheck = await client.query(
      'SELECT id FROM employees WHERE id = $1',
      [employeeId]
    );
    if (!employeeCheck.rows.length) {
      throw new ApiError(400, 'Employee not found');
    }

    if (machineId !== null && machineId !== undefined) {
      const machineCheck = await client.query(
        'SELECT id FROM machines WHERE id = $1',
        [machineId]
      );
      if (!machineCheck.rows.length) {
        throw new ApiError(400, 'Machine not found');
      }
    }

    await client.query(
      `INSERT INTO production_phases
       (order_id, phase_name, quantity, loss_reason, employee_id, machine_id, started_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [orderId, phaseName, nextQty, lossReason, employeeId, machineId || null, startedAtDate.toISOString(), completedAtDate.toISOString()]
    );

    if (phaseName === PHASE_SORTING) {
      await client.query(
        `UPDATE production_orders
         SET status = 'sorting', updated_at = NOW()
         WHERE id = $1`,
        [orderId]
      );
    }

    if (phaseName === PHASE_FINAL) {
      await client.query(
        `UPDATE production_orders
         SET status = 'completed', produced_qty = $2, updated_at = NOW()
         WHERE id = $1`,
        [orderId, nextQty]
      );
    }

    await client.query('COMMIT');

    const reportRow = await getOrderWithLatestPhases(client, orderId);
    return mapOrderReport(reportRow);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const getProductionOrderReport = async (orderId) => {
  await ensureTrackingSchema();
  const row = await getOrderWithLatestPhases(pool, orderId);
  if (!row) {
    throw new ApiError(404, 'Production order not found');
  }

  const phasesResult = await pool.query(
    `SELECT
       pp.id,
       pp.phase_name,
       pp.quantity,
       pp.loss_reason,
       pp.employee_id,
       pp.machine_id,
       pp.started_at,
       pp.completed_at,
       pp.created_at,
       e.name AS employee_name,
       m.name AS machine_name
     FROM production_phases pp
     LEFT JOIN employees e ON e.id = pp.employee_id
     LEFT JOIN machines m ON m.id = pp.machine_id
     WHERE pp.order_id = $1
     ORDER BY pp.created_at ASC, pp.id ASC`,
    [orderId]
  );

  return buildDetailedReport(row, phasesResult.rows);
};

const listMachines = async () => {
  await ensureTrackingSchema();
  const result = await pool.query(
    `SELECT id, name, code, status
     FROM machines
     WHERE status = 'active'
     ORDER BY name ASC`
  );
  return result.rows;
};

module.exports = {
  listProductionOrders,
  createProductionOrder,
  addProductionPhase,
  getProductionOrderReport,
  listMachines,
  PHASE_SORTING,
  PHASE_FINAL,
};
