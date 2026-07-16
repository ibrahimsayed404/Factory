const { randomBytes } = require('node:crypto');
const pool = require('../db/pool');
const ApiError = require('../utils/ApiError');
const inventoryService = require('./inventoryService');

const PHASE_INPUT = 'input';
const PHASE_SORTING = 'sorting';
const PHASE_OUTSOURCING = 'outsourcing';
const PHASE_FINAL = 'final';
const HIGH_LOSS_THRESHOLD_PERCENT = 10;

let schemaEnsured = false;

const normalizeModelNumber = (value) => String(value || '').trim().toLowerCase();

const isModelNumberConstraintError = (err) => (
  err?.code === '23505'
  && (
    String(err.constraint || '').includes('model_number')
    || String(err.detail || '').includes('model_number')
  )
);

const assertModelNumberAvailable = async (client, modelNumber) => {
  const normalized = normalizeModelNumber(modelNumber);
  if (!normalized) throw new ApiError(400, 'model_number is required');

  // Advisory lock keyed on model_number hash to serialize concurrent checks
  await client.query(
    `SELECT pg_advisory_xact_lock(hashtext($1))`,
    [normalized]
  );

  const existing = await client.query(
    `SELECT id
     FROM production_orders
     WHERE model_number IS NOT NULL
       AND LOWER(TRIM(model_number)) = $1
     LIMIT 1`,
    [normalized]
  );

  if (existing.rows.length) {
    throw new ApiError(409, `Order number ${String(modelNumber).trim()} is already in use`);
  }
};

const ensureTrackingSchema = async () => {
  if (schemaEnsured) return;

  await pool.query(`
    ALTER TABLE production_orders
      ADD COLUMN IF NOT EXISTS model_number VARCHAR(100),
      ADD COLUMN IF NOT EXISTS planned_quantity INT,
      ADD COLUMN IF NOT EXISTS product_id INT REFERENCES products(id) ON DELETE SET NULL
  `);

  await pool.query(`
    UPDATE production_orders
    SET model_number = COALESCE(model_number, product_name)
    WHERE model_number IS NULL;
    
    UPDATE production_orders po
    SET product_id = p.id
    FROM products p
    WHERE po.product_name = p.name AND po.product_id IS NULL;
  `);

  await pool.query(`
    UPDATE production_orders
    SET planned_quantity = COALESCE(planned_quantity, quantity)
    WHERE planned_quantity IS NULL
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'production_materials'
          AND table_schema = 'public'
      ) THEN
        ALTER TABLE production_materials
          ADD COLUMN IF NOT EXISTS color VARCHAR(80);
      END IF;
    END
    $$;
  `);

  await pool.query(`
    UPDATE production_orders po
    SET product_name = p.name
    FROM products p
    WHERE po.product_id = p.id
      AND (
        po.product_name IS NULL
        OR TRIM(po.product_name) = ''
        OR po.product_name = po.model_number
        OR po.product_name IS DISTINCT FROM p.name
      )
  `);

  await pool.query(`
    UPDATE production_orders po
    SET
      product_name = p.name,
      product_id = p.id
    FROM audit_logs al
    JOIN products p ON p.name = TRIM(al.details->>'product_name')
    WHERE al.action = 'CREATE'
      AND al.entity_name = 'production_orders'
      AND al.entity_id = po.id::text
      AND po.product_id IS NULL
      AND po.product_name = po.model_number
      AND al.details->>'product_name' IS NOT NULL
      AND TRIM(al.details->>'product_name') <> ''
      AND TRIM(al.details->>'product_name') IS DISTINCT FROM po.model_number
      AND al.id = (
        SELECT MAX(id)
        FROM audit_logs
        WHERE action = 'CREATE'
          AND entity_name = 'production_orders'
          AND entity_id = po.id::text
      )
  `);

  // De-duplicate any existing model_number values before creating the unique index
  await pool.query(`
    DO $$
    DECLARE
      dup RECORD;
      r   RECORD;
      seq INT;
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_production_orders_model_number_unique'
          AND n.nspname = 'public'
      ) THEN
        -- Fix duplicates by appending a numeric suffix to all but the first occurrence
        FOR dup IN
          SELECT LOWER(TRIM(model_number)) AS norm
          FROM production_orders
          WHERE model_number IS NOT NULL AND TRIM(model_number) <> ''
          GROUP BY LOWER(TRIM(model_number))
          HAVING COUNT(*) > 1
        LOOP
          seq := 2;
          FOR r IN
            SELECT id, model_number
            FROM production_orders
            WHERE LOWER(TRIM(model_number)) = dup.norm
            ORDER BY created_at ASC
            OFFSET 1
          LOOP
            UPDATE production_orders
            SET model_number = model_number || '-' || seq
            WHERE id = r.id;
            seq := seq + 1;
          END LOOP;
        END LOOP;

        CREATE UNIQUE INDEX idx_production_orders_model_number_unique
          ON production_orders (LOWER(TRIM(model_number)))
          WHERE model_number IS NOT NULL AND TRIM(model_number) <> '';
      END IF;
    END $$;
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
    ALTER TYPE production_phase_name
      ADD VALUE IF NOT EXISTS 'outsourcing' BEFORE 'final'
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
    CREATE TABLE IF NOT EXISTS partner_factories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL UNIQUE,
      code VARCHAR(60) UNIQUE,
      contact_person VARCHAR(120),
      phone VARCHAR(40),
      notes TEXT,
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
      color_breakdown JSONB DEFAULT '[]'::jsonb,
      loss_reason TEXT,
      employee_id INT REFERENCES employees(id) ON DELETE SET NULL,
      machine_id INT REFERENCES machines(id) ON DELETE SET NULL,
      partner_factory_id INT REFERENCES partner_factories(id) ON DELETE SET NULL,
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE production_phases
      ADD COLUMN IF NOT EXISTS loss_reason TEXT,
      ADD COLUMN IF NOT EXISTS color_breakdown JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS employee_id INT,
      ADD COLUMN IF NOT EXISTS machine_id INT,
      ADD COLUMN IF NOT EXISTS partner_factory_id INT,
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

      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'production_phases_partner_factory_id_fkey'
      ) THEN
        ALTER TABLE production_phases
          ADD CONSTRAINT production_phases_partner_factory_id_fkey
          FOREIGN KEY (partner_factory_id) REFERENCES partner_factories(id) ON DELETE SET NULL;
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

const calculateMetrics = ({ inputQty, sortingQty, outsourcingQty, finalQty }) => {
  const hasInput = Number.isFinite(inputQty);
  const hasSorting = Number.isFinite(sortingQty);
  const hasOutsourcing = Number.isFinite(outsourcingQty);
  const hasFinal = Number.isFinite(finalQty);

  const sortingLoss = hasInput && hasSorting ? inputQty - sortingQty : null;
  const sortingLossPercentage = hasInput && hasSorting && inputQty > 0
    ? Number(((sortingLoss / inputQty) * 100).toFixed(2))
    : null;
  const outsourcingLoss = hasSorting && hasOutsourcing ? sortingQty - outsourcingQty : null;
  const outsourcingLossPercentage = hasSorting && hasOutsourcing && sortingQty > 0
    ? Number(((outsourcingLoss / sortingQty) * 100).toFixed(2))
    : null;
  const finalLoss = hasOutsourcing && hasFinal ? outsourcingQty - finalQty : null;
  const finalLossPercentage = hasOutsourcing && hasFinal && outsourcingQty > 0
    ? Number(((finalLoss / outsourcingQty) * 100).toFixed(2))
    : null;
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
    sorting_loss_percentage: sortingLossPercentage,
    outsourcing_loss: outsourcingLoss,
    outsourcing_loss_percentage: outsourcingLossPercentage,
    final_loss: finalLoss,
    final_loss_percentage: finalLossPercentage,
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
  const outsourcingQty = row.outsourcing_quantity !== null && row.outsourcing_quantity !== undefined
    ? Number(row.outsourcing_quantity)
    : null;
  const finalQty = row.final_quantity !== null && row.final_quantity !== undefined
    ? Number(row.final_quantity)
    : null;

  return {
    id: row.id,
    order_number: row.order_number,
    display_order_number: row.model_number || row.order_number,
    model_number: row.model_number ?? '',
    product_id: row.product_id || null,
    catalog_product_name: row.catalog_product_name ? String(row.catalog_product_name).trim() : null,
    product_name: resolveOrderProductName(row),
    planned_quantity: Number(row.planned_quantity || row.quantity || 0),
    quantity: Number(row.quantity || row.planned_quantity || 0),
    produced_qty: row.produced_qty !== null && row.produced_qty !== undefined ? Number(row.produced_qty) : null,
    sales_order_id: row.sales_order_id || null,
    sales_order_number: row.sales_order_number || null,
    assigned_to_name: row.assigned_to_name || null,
    due_date: row.due_date || null,
    status: row.status,
    phases: {
      input: inputQty,
      sorting: sortingQty,
      outsourcing: outsourcingQty,
      final: finalQty,
    },
    ...calculateMetrics({ inputQty, sortingQty, outsourcingQty, finalQty }),
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

const resolveOrderProductName = (row) => {
  const catalog = String(row.catalog_product_name || '').trim();
  if (catalog) return catalog;
  const stored = String(row.product_name || '').trim();
  const model = String(row.model_number || '').trim();
  if (stored && model && stored === model) return '';
  if (stored) return stored;
  return '';
};

const formatPhaseRow = (phase) => ({
  id: phase.id,
  phase: phase.phase_name,
  quantity: Number(phase.quantity),
  color_breakdown: Array.isArray(phase.color_breakdown)
    ? phase.color_breakdown
    : (() => {
      try {
        return phase.color_breakdown ? JSON.parse(phase.color_breakdown) : [];
      } catch {
        return [];
      }
    })(),
  employee_id: phase.employee_id !== null ? Number(phase.employee_id) : null,
  employee: phase.employee_name || null,
  machine_id: phase.machine_id !== null ? Number(phase.machine_id) : null,
  machine: phase.machine_name || null,
  partner_factory_id: phase.partner_factory_id !== null ? Number(phase.partner_factory_id) : null,
  partner_factory: phase.partner_factory_name || null,
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
  const outsourcingQty = latestByPhase.has(PHASE_OUTSOURCING)
    ? Number(latestByPhase.get(PHASE_OUTSOURCING).quantity)
    : null;
  const finalQty = latestByPhase.has(PHASE_FINAL)
    ? Number(latestByPhase.get(PHASE_FINAL).quantity)
    : null;

  const metrics = calculateMetrics({ inputQty, sortingQty, outsourcingQty, finalQty });
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

  if (outsourcingQty !== null && sortingQty !== null && sortingQty > 0) {
    const outsourcingLossPct = Number((((sortingQty - outsourcingQty) / sortingQty) * 100).toFixed(2));
    if (outsourcingLossPct > HIGH_LOSS_THRESHOLD_PERCENT) {
      alerts.push({
        type: 'HIGH_LOSS',
        message: 'High loss detected in Outsourcing phase',
        order_id: Number(orderRow.id),
      });
    }
  }

  if (finalQty !== null && outsourcingQty !== null && outsourcingQty > 0) {
    const finalLossPct = Number((((outsourcingQty - finalQty) / outsourcingQty) * 100).toFixed(2));
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
    display_order_number: orderRow.model_number || orderRow.order_number,
    model_number: orderRow.model_number ?? '',
    catalog_product_name: orderRow.catalog_product_name ? String(orderRow.catalog_product_name).trim() : null,
    product_name: resolveOrderProductName(orderRow),
    input: inputQty,
    sorting: sortingQty,
    outsourcing: outsourcingQty,
    final: finalQty,
    sorting_loss: metrics.sorting_loss,
    outsourcing_loss: metrics.outsourcing_loss,
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
       p.name AS catalog_product_name,
       MAX(CASE WHEN lp.phase_name = 'input' THEN lp.quantity END) AS input_quantity,
       MAX(CASE WHEN lp.phase_name = 'sorting' THEN lp.quantity END) AS sorting_quantity,
       MAX(CASE WHEN lp.phase_name = 'outsourcing' THEN lp.quantity END) AS outsourcing_quantity,
       MAX(CASE WHEN lp.phase_name = 'final' THEN lp.quantity END) AS final_quantity
     FROM production_orders po
     LEFT JOIN latest_phases lp ON lp.order_id = po.id
     LEFT JOIN products p ON po.product_id = p.id
     WHERE po.id = $1
     GROUP BY po.id, p.name`,
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
         p.name AS catalog_product_name,
         so.order_number AS sales_order_number,
         e.name AS assigned_to_name,
         MAX(CASE WHEN lp.phase_name = 'input' THEN lp.quantity END) AS input_quantity,
         MAX(CASE WHEN lp.phase_name = 'sorting' THEN lp.quantity END) AS sorting_quantity,
         MAX(CASE WHEN lp.phase_name = 'outsourcing' THEN lp.quantity END) AS outsourcing_quantity,
         MAX(CASE WHEN lp.phase_name = 'final' THEN lp.quantity END) AS final_quantity
       FROM production_orders po
       LEFT JOIN latest_phases lp ON lp.order_id = po.id
       LEFT JOIN products p ON po.product_id = p.id
       LEFT JOIN sales_orders so ON po.sales_order_id = so.id
       LEFT JOIN employees e ON po.assigned_to = e.id
       GROUP BY po.id, p.name, so.order_number, e.name
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

const createProductionOrder = async ({ modelNumber, productName, quantity, product_id, materials = [], colorBreakdown = [], salesOrderId = null, client: providedClient = null, deliveryDate = null, notes = null }) => {
  await ensureTrackingSchema();
  const client = providedClient || await pool.connect();
  const manageTransaction = !providedClient;
  try {
    if (manageTransaction) {
      await client.query('BEGIN');
    }

    const resolvedModelNumber = String(modelNumber || '').trim();
    if (!resolvedModelNumber) throw new ApiError(400, 'model_number is required');

    let productId = product_id || null;
    let resolvedProductName = String(productName || '').trim();

    if (productId) {
      const pRes = await client.query('SELECT id, name FROM products WHERE id = $1', [productId]);
      if (!pRes.rows.length) throw new ApiError(400, 'Product not found');
      productId = pRes.rows[0].id;
      resolvedProductName = pRes.rows[0].name;
    } else if (resolvedProductName) {
      const pRes = await client.query('SELECT id, name FROM products WHERE name = $1', [resolvedProductName]);
      if (pRes.rows.length) {
        productId = pRes.rows[0].id;
        resolvedProductName = pRes.rows[0].name;
      } else {
        const inserted = await client.query(
          `INSERT INTO products (name, default_price) VALUES ($1, 0) RETURNING id, name`,
          [resolvedProductName]
        );
        productId = inserted.rows[0].id;
        resolvedProductName = inserted.rows[0].name;
      }
    }

    if (!productId || !resolvedProductName) throw new ApiError(400, 'product_id is required');

    await assertModelNumberAvailable(client, resolvedModelNumber);

    const normalizedBreakdown = (Array.isArray(colorBreakdown) ? colorBreakdown : [])
      .map((row) => ({
        color: String(row?.color || '').trim(),
        quantity: Number(row?.quantity),
      }))
      .filter((row) => row.color && Number.isFinite(row.quantity) && row.quantity > 0);

    const plannedQuantity = normalizedBreakdown.length > 0
      ? normalizedBreakdown.reduce((sum, row) => sum + row.quantity, 0)
      : Number.parseInt(quantity, 10);

    if (!Number.isFinite(plannedQuantity) || plannedQuantity <= 0) {
      throw new ApiError(400, 'At least one color quantity is required');
    }

    let order = null;

    for (let i = 0; i < 5; i += 1) {
      const orderNumber = buildOrderNumber();
      try {
        const orderResult = await client.query(
          `INSERT INTO production_orders
           (order_number, model_number, planned_quantity, product_name, quantity, status, product_id, sales_order_id, due_date, notes)
           VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9)
           RETURNING *`,
          [orderNumber, resolvedModelNumber, plannedQuantity, resolvedProductName, plannedQuantity, productId, salesOrderId, deliveryDate, notes]
        );
        order = orderResult.rows[0];
        break;
      } catch (err) {
        if (isModelNumberConstraintError(err)) {
          throw new ApiError(409, `Order number ${resolvedModelNumber} is already in use`);
        }
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
          `INSERT INTO production_materials (production_order_id, material_id, quantity_used, color)
         VALUES ($1, $2, $3, $4)`,
        [order.id, materialId, requiredQty, material.color || null]
      );

      await inventoryService.issueStock({
        item_type: 'material',
        item_id: materialId,
        quantity: requiredQty,
        reference_type: 'production_order',
        reference_id: order.id,
        notes: `Production usage for order ${order.order_number}`
      }, client);
    }

    await client.query(
      `INSERT INTO production_phases (order_id, phase_name, quantity, color_breakdown)
       VALUES ($1, $2, $3, $4)`,
      [order.id, PHASE_INPUT, plannedQuantity, JSON.stringify(normalizedBreakdown)]
    );

    if (manageTransaction) {
      await client.query('COMMIT');
    }

    const reportRow = await getOrderWithLatestPhases(client, order.id);
    return mapOrderReport(reportRow);
  } catch (err) {
    if (manageTransaction) {
      await client.query('ROLLBACK');
    }
    throw err;
  } finally {
    if (manageTransaction) {
      client.release();
    }
  }
};

const addProductionPhase = async ({
  orderId,
  phaseName,
  quantity,
  colorBreakdown = [],
  lossReason = null,
  employeeId,
  machineId = null,
  partnerFactoryId = null,
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
    const outsourcingQty = order.outsourcing_quantity !== null && order.outsourcing_quantity !== undefined
      ? Number(order.outsourcing_quantity)
      : null;

    if (phaseName === PHASE_SORTING) {
      if (nextQty > inputQty) {
        throw new ApiError(400, 'Sorting quantity cannot exceed input quantity');
      }
    }

    if (phaseName === PHASE_OUTSOURCING) {
      if (sortingQty === null) {
        throw new ApiError(400, 'Sorting phase must be recorded before outsourcing phase');
      }
      if (nextQty > sortingQty) {
        throw new ApiError(400, 'Outsourcing quantity cannot exceed sorting quantity');
      }
    }

    if (phaseName === PHASE_FINAL) {
      if (outsourcingQty === null) {
        throw new ApiError(400, 'Outsourcing phase must be recorded before final phase');
      }
      if (nextQty > outsourcingQty) {
        throw new ApiError(400, 'Final quantity cannot exceed outsourcing quantity');
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

    if (partnerFactoryId !== null && partnerFactoryId !== undefined) {
      const factoryCheck = await client.query(
        'SELECT id FROM partner_factories WHERE id = $1',
        [partnerFactoryId]
      );
      if (!factoryCheck.rows.length) {
        throw new ApiError(400, 'Partner factory not found');
      }
    }

    if (phaseName === PHASE_OUTSOURCING && machineId) {
      throw new ApiError(400, 'Outsourcing phase must use partner_factory_id, not machine_id');
    }

    if (phaseName === PHASE_SORTING && partnerFactoryId) {
      throw new ApiError(400, 'Sorting phase must use machine_id, not partner_factory_id');
    }

    const resolvedMachineId = phaseName === PHASE_OUTSOURCING ? null : (machineId || null);
    const resolvedPartnerFactoryId = phaseName === PHASE_OUTSOURCING ? (partnerFactoryId || null) : null;

    await client.query(
      `INSERT INTO production_phases
       (order_id, phase_name, quantity, color_breakdown, loss_reason, employee_id, machine_id, partner_factory_id, started_at, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [orderId, phaseName, nextQty, JSON.stringify(colorBreakdown || []), lossReason, employeeId, resolvedMachineId, resolvedPartnerFactoryId, startedAtDate.toISOString(), completedAtDate.toISOString()]
    );

    if (phaseName === PHASE_SORTING) {
      await client.query(
        `UPDATE production_orders
         SET status = 'sorting', updated_at = NOW()
         WHERE id = $1`,
        [orderId]
      );
    }

    if (phaseName === PHASE_OUTSOURCING) {
      await client.query(
        `UPDATE production_orders
         SET status = 'outsourcing', updated_at = NOW()
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

      if (order.product_id) {
        await inventoryService.receiveStock({
          item_type: 'product',
          item_id: order.product_id,
          quantity: nextQty,
          reference_type: 'production_order',
          reference_id: orderId,
          notes: `Finished production for order ${order.order_number}`
        }, client);
      }
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
       pp.color_breakdown,
       pp.loss_reason,
       pp.employee_id,
       pp.machine_id,
       pp.partner_factory_id,
       pp.started_at,
       pp.completed_at,
       pp.created_at,
       e.name AS employee_name,
       m.name AS machine_name,
       pf.name AS partner_factory_name
     FROM production_phases pp
     LEFT JOIN employees e ON e.id = pp.employee_id
     LEFT JOIN machines m ON m.id = pp.machine_id
     LEFT JOIN partner_factories pf ON pf.id = pp.partner_factory_id
     WHERE pp.order_id = $1
     ORDER BY pp.created_at ASC, pp.id ASC`,
    [orderId]
  );

  return buildDetailedReport(row, phasesResult.rows);
};

const getDashboardEfficiencySummary = async () => {
  await ensureTrackingSchema();

  const { rows } = await pool.query(
    `WITH phase_rollup AS (
       SELECT
         pp.order_id,
         MAX(CASE WHEN pp.phase_name = 'input' THEN pp.quantity END) AS input_quantity,
         MAX(CASE WHEN pp.phase_name = 'sorting' THEN pp.quantity END) AS sorting_quantity,
         MAX(CASE WHEN pp.phase_name = 'outsourcing' THEN pp.quantity END) AS outsourcing_quantity,
         MAX(CASE WHEN pp.phase_name = 'final' THEN pp.quantity END) AS final_quantity
       FROM production_phases pp
       GROUP BY pp.order_id
     ), latest_phase AS (
       SELECT DISTINCT ON (pp.order_id)
         pp.order_id,
         pp.phase_name AS latest_phase_name
       FROM production_phases pp
       ORDER BY pp.order_id, pp.created_at DESC, pp.id DESC
     )
     SELECT
       po.id,
       pr.input_quantity,
       pr.sorting_quantity,
       pr.outsourcing_quantity,
       pr.final_quantity,
       lp.latest_phase_name
     FROM production_orders po
     JOIN phase_rollup pr ON pr.order_id = po.id
     JOIN latest_phase lp ON lp.order_id = po.id
     ORDER BY po.id`
  );

  const summary = {
    input: { total_quantity: 0, average_loss_percentage: 0, current_order_count: 0 },
    sorting: { total_quantity: 0, average_loss_percentage: 0, current_order_count: 0 },
    outsourcing: { total_quantity: 0, average_loss_percentage: 0, current_order_count: 0 },
    final: { total_quantity: 0, average_loss_percentage: 0, current_order_count: 0 },
  };

  const percentageSums = {
    input: 0,
    sorting: 0,
    outsourcing: 0,
    final: 0,
  };

  const percentageCounts = {
    input: 0,
    sorting: 0,
    outsourcing: 0,
    final: 0,
  };

  for (const row of rows) {
    const inputQty = Number(row.input_quantity || 0);
    const sortingQty = row.sorting_quantity !== null && row.sorting_quantity !== undefined
      ? Number(row.sorting_quantity)
      : null;
    const outsourcingQty = row.outsourcing_quantity !== null && row.outsourcing_quantity !== undefined
      ? Number(row.outsourcing_quantity)
      : null;
    const finalQty = row.final_quantity !== null && row.final_quantity !== undefined
      ? Number(row.final_quantity)
      : null;

    const metrics = calculateMetrics({ inputQty, sortingQty, outsourcingQty, finalQty });

    summary.input.total_quantity += inputQty;
    percentageCounts.input += 1;

    if (sortingQty !== null) {
      summary.sorting.total_quantity += sortingQty;
      if (metrics.sorting_loss_percentage !== null) {
        percentageSums.sorting += metrics.sorting_loss_percentage;
        percentageCounts.sorting += 1;
      }
    }

    if (outsourcingQty !== null) {
      summary.outsourcing.total_quantity += outsourcingQty;
      if (metrics.outsourcing_loss_percentage !== null) {
        percentageSums.outsourcing += metrics.outsourcing_loss_percentage;
        percentageCounts.outsourcing += 1;
      }
    }

    if (finalQty !== null) {
      summary.final.total_quantity += finalQty;
      if (metrics.final_loss_percentage !== null) {
        percentageSums.final += metrics.final_loss_percentage;
        percentageCounts.final += 1;
      }
    }

    if (row.latest_phase_name === PHASE_INPUT) summary.input.current_order_count += 1;
    if (row.latest_phase_name === PHASE_SORTING) summary.sorting.current_order_count += 1;
    if (row.latest_phase_name === PHASE_OUTSOURCING) summary.outsourcing.current_order_count += 1;
    if (row.latest_phase_name === PHASE_FINAL) summary.final.current_order_count += 1;
  }

  for (const phaseName of Object.keys(summary)) {
    const count = percentageCounts[phaseName];
    summary[phaseName].average_loss_percentage = count > 0
      ? Number((percentageSums[phaseName] / count).toFixed(2))
      : 0;
  }

  return summary;
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

const listPartnerFactories = async () => {
  await ensureTrackingSchema();
  const result = await pool.query(
    `SELECT id, name, code, contact_person, phone, notes, status
     FROM partner_factories
     WHERE status = 'active'
     ORDER BY name ASC`
  );
  return result.rows;
};

const createPartnerFactory = async ({ name, code = null, contactPerson = null, phone = null, notes = null }) => {
  await ensureTrackingSchema();
  const trimmedName = String(name || '').trim();
  if (!trimmedName) {
    throw new ApiError(400, 'Partner factory name is required');
  }

  const result = await pool.query(
    `INSERT INTO partner_factories (name, code, contact_person, phone, notes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, code, contact_person, phone, notes, status`,
    [trimmedName, code || null, contactPerson || null, phone || null, notes || null]
  );
  return result.rows[0];
};

const deleteOrder = async (orderId, { force = false } = {}) => {
  await ensureTrackingSchema();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const order = await client.query(
      'SELECT id, order_number, status, product_id, produced_qty FROM production_orders WHERE id = $1 FOR UPDATE',
      [orderId]
    );
    if (!order.rows.length) {
      throw new ApiError(404, 'Production order not found');
    }

    const orderRow = order.rows[0];

    if (!force) {
      const phases = await client.query(
        `SELECT id FROM production_phases WHERE order_id = $1 AND phase_name IN ('sorting', 'outsourcing', 'final') LIMIT 1`,
        [orderId]
      );
      if (phases.rows.length > 0) {
        throw new ApiError(400, 'Cannot delete order - sorting, outsourcing, or final phase has already started. You can only delete new orders.');
      }
    } else if (orderRow.status === 'completed' && orderRow.product_id && Number(orderRow.produced_qty) > 0) {
      await inventoryService.issueStock({
        item_type: 'product',
        item_id: orderRow.product_id,
        quantity: Number(orderRow.produced_qty),
        reference_type: 'production_order_cancel',
        reference_id: orderId,
        notes: `Reversed finished production for cancelled order ${orderRow.order_number}`,
      }, client);
    }

    const materials = await client.query(
      `SELECT material_id, quantity_used, color FROM production_materials WHERE production_order_id = $1`,
      [orderId]
    );

    for (const mat of materials.rows) {
      if (mat.material_id && mat.quantity_used) {
        await client.query(
          'UPDATE materials SET quantity = quantity + $1, updated_at = NOW() WHERE id = $2',
          [Number(mat.quantity_used), mat.material_id]
        );
      }
    }

    await client.query(
      'DELETE FROM production_orders WHERE id = $1',
      [orderId]
    );

    await client.query('COMMIT');

    return { id: orderId, order_number: orderRow.order_number, message: 'Production order deleted and inventory restored' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  listProductionOrders,
  createProductionOrder,
  addProductionPhase,
  getProductionOrderReport,
  getDashboardEfficiencySummary,
  listMachines,
  listPartnerFactories,
  createPartnerFactory,
  deleteOrder,
  PHASE_INPUT,
  PHASE_SORTING,
  PHASE_OUTSOURCING,
  PHASE_FINAL,
};
