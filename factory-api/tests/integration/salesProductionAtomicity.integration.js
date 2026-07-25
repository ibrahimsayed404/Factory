/**
 * Integration test: Sales + Production Order transaction atomicity
 * against a test PostgreSQL database.
 *
 * Environment variables (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)
 * are loaded from .env.test (gitignored) or pre-set in the environment.
 */

const path = require('node:path');
const dotenv = require('dotenv');

// Load .env.test if it exists, otherwise fallback to default .env / process.env
dotenv.config({ path: path.join(__dirname, '../../.env.test') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const requiredEnvVars = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const missing = requiredEnvVars.filter(v => !process.env[v]);
if (missing.length > 0) {
  throw new Error(`Integration test requires environment variables: ${missing.join(', ')}. Set them in .env.test or process.env.`);
}

const pool = require('../../src/db/pool');
const salesService = require('../../src/services/salesService');
const productionTrackingService = require('../../src/services/productionTrackingService');

const TEST_MARKER = '__ATOMICITY_INTEG_TEST__';

async function getCounts() {
  const so = await pool.query('SELECT COUNT(*)::int AS cnt FROM sales_orders');
  const po = await pool.query('SELECT COUNT(*)::int AS cnt FROM production_orders');
  return {
    salesOrders: so.rows[0].cnt,
    productionOrders: po.rows[0].cnt,
  };
}

async function ensureTestUser() {
  const res = await pool.query('SELECT id FROM users LIMIT 1');
  if (!res.rows.length) {
    const ins = await pool.query(
      "INSERT INTO users (name, email, password, role) VALUES ('Test User', 'atomicity-test@test.com', 'x', 'admin') RETURNING id"
    );
    return ins.rows[0].id;
  }
  return res.rows[0].id;
}

async function wipeStaleTestData() {
  const stale = await pool.query("SELECT id FROM sales_orders WHERE notes = $1", [TEST_MARKER]);
  for (const row of stale.rows) {
    const soId = row.id;
    await pool.query('DELETE FROM production_phases WHERE order_id IN (SELECT id FROM production_orders WHERE sales_order_id = $1)', [soId]);
    await pool.query('DELETE FROM production_orders WHERE sales_order_id = $1', [soId]);
    await pool.query('DELETE FROM sales_order_items WHERE sales_order_id = $1', [soId]);
    await pool.query('DELETE FROM audit_logs WHERE entity_name = $1 AND entity_id = $2', ['sales_orders', soId]);
    await pool.query('DELETE FROM sales_orders WHERE id = $1', [soId]);
  }
  await pool.query("DELETE FROM products WHERE name = $1", [TEST_MARKER]);
}

async function main() {
  console.log('=== INTEGRATION TEST: Sales/Production Transaction Atomicity ===\n');
  console.log(`Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME} (user: ${process.env.DB_USER})\n`);

  await wipeStaleTestData();

  const userId = await ensureTestUser();
  console.log('Test user ID:', userId);

  // ================================================================
  // BASELINE
  // ================================================================
  const baseline = await getCounts();
  console.log('\n--- BASELINE ROW COUNTS ---');
  console.log('  sales_orders:', baseline.salesOrders);
  console.log('  production_orders:', baseline.productionOrders);

  // ================================================================
  // FAILURE CASE
  // ================================================================
  console.log('\n--- FAILURE CASE ---');
  console.log('Injecting forced failure in createProductionOrder...');

  const originalCreate = productionTrackingService.createProductionOrder;
  productionTrackingService.createProductionOrder = async function failingCreate(args) {
    throw new Error('INJECTED_FAILURE: simulated production order DB crash');
  };

  try {
    await salesService.createSalesOrder(userId, {
      customer_id: null,
      delivery_date: '2026-12-31',
      notes: TEST_MARKER,
      items: [{
        product_name: TEST_MARKER,
        quantity: 1,
        unit_price: 1,
        make_to_order: true,
      }],
    });
    console.log('  ERROR: createSalesOrder did NOT throw — atomicity test invalid!');
  } catch (err) {
    console.log('  createSalesOrder threw as expected:', err.message);
  }

  // Restore original function
  productionTrackingService.createProductionOrder = originalCreate;

  const afterFailure = await getCounts();
  console.log('\n  Row counts AFTER failure:');
  console.log('    sales_orders:', afterFailure.salesOrders, '(baseline:', baseline.salesOrders + ')');
  console.log('    production_orders:', afterFailure.productionOrders, '(baseline:', baseline.productionOrders + ')');

  const soLeaked = afterFailure.salesOrders - baseline.salesOrders;
  const poLeaked = afterFailure.productionOrders - baseline.productionOrders;
  console.log('\n  Orphaned sales_orders rows:', soLeaked);
  console.log('  Orphaned production_orders rows:', poLeaked);

  if (soLeaked === 0 && poLeaked === 0) {
    console.log('  ✅ PASS: ROLLBACK prevented any orphaned rows.');
  } else {
    console.log('  ❌ FAIL: Orphaned rows detected! Transaction is NOT atomic.');
  }

  const markerSo = await pool.query("SELECT COUNT(*)::int AS cnt FROM sales_orders WHERE notes = $1", [TEST_MARKER]);
  const markerPo = await pool.query("SELECT COUNT(*)::int AS cnt FROM production_orders WHERE notes = $1", [TEST_MARKER]);
  console.log('  sales_orders with test marker:', markerSo.rows[0].cnt);
  console.log('  production_orders with test marker:', markerPo.rows[0].cnt);

  // ================================================================
  // SUCCESS CASE
  // ================================================================
  console.log('\n--- SUCCESS CASE ---');
  console.log('Creating a real sales order with production order...');

  let successResult;
  try {
    successResult = await salesService.createSalesOrder(userId, {
      customer_id: null,
      delivery_date: '2026-12-31',
      notes: TEST_MARKER,
      items: [{
        product_name: TEST_MARKER,
        quantity: 5,
        unit_price: 10,
        make_to_order: true,
      }],
    });
    console.log('  createSalesOrder succeeded. Sales order ID:', successResult.id, 'order_number:', successResult.order_number);
  } catch (err) {
    console.log('  ERROR: createSalesOrder threw unexpectedly:', err.message);
  }

  const afterSuccess = await getCounts();
  console.log('\n  Row counts AFTER success:');
  console.log('    sales_orders:', afterSuccess.salesOrders, '(baseline:', baseline.salesOrders + ')');
  console.log('    production_orders:', afterSuccess.productionOrders, '(baseline:', baseline.productionOrders + ')');

  const soCreated = afterSuccess.salesOrders - baseline.salesOrders;
  const poCreated = afterSuccess.productionOrders - baseline.productionOrders;
  console.log('\n  New sales_orders rows:', soCreated);
  console.log('  New production_orders rows:', poCreated);

  if (successResult) {
    const linkedPo = await pool.query(
      'SELECT id, order_number, sales_order_id FROM production_orders WHERE sales_order_id = $1',
      [successResult.id]
    );
    if (linkedPo.rows.length > 0) {
      console.log('  ✅ PASS: production_orders row links back to sales_orders.id =', successResult.id);
      console.log('    production_order record:', JSON.stringify(linkedPo.rows[0]));
    } else {
      console.log('  ❌ FAIL: No production_orders row found with sales_order_id =', successResult.id);
    }
  }

  // ================================================================
  // CLEANUP
  // ================================================================
  console.log('\n--- CLEANUP ---');
  await wipeStaleTestData();
  const afterCleanup = await getCounts();
  console.log('  Row counts after cleanup:');
  console.log('    sales_orders:', afterCleanup.salesOrders);
  console.log('    production_orders:', afterCleanup.productionOrders);
  console.log('  Counts match baseline?', afterCleanup.salesOrders === baseline.salesOrders && afterCleanup.productionOrders === baseline.productionOrders ? '✅ YES' : '❌ NO');

  console.log('\n=== INTEGRATION TEST COMPLETE ===');
  await pool.end();
}

main().catch(async (err) => {
  console.error('FATAL:', err);
  try { await wipeStaleTestData(); } catch (_) {}
  try { await pool.end(); } catch (_) {}
  process.exit(1);
});
