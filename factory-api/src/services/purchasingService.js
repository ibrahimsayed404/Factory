const purchasingRepository = require('../repositories/purchasingRepository');
const inventoryService = require('./inventoryService');
const accountingService = require('./accountingService');
const pool = require('../db/pool');
const ApiError = require('../utils/ApiError');

// =======================
// SUPPLIERS
// =======================
const createSupplier = async (supplierData) => {
  return await purchasingRepository.createSupplier(supplierData);
};

const getSuppliers = async () => {
  return await purchasingRepository.getSuppliers();
};

const getSupplierLedger = async (supplierId) => {
  return await purchasingRepository.getSupplierLedger(supplierId);
};

// =======================
// PURCHASE REQUESTS
// =======================
const createPurchaseRequest = async (prData, items) => {
  if (!items || items.length === 0) throw new ApiError(400, 'Purchase request must have items');
  
  // Calculate total estimated amount
  const totalAmount = items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.estimated_unit_price || 0)), 0);
  prData.total_estimated_amount = totalAmount;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pr = await purchasingRepository.createPurchaseRequest(prData, items, client);
    await client.query('COMMIT');
    return pr;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const getPurchaseRequests = async () => {
  return await purchasingRepository.getPurchaseRequests();
};

const getPurchaseRequestById = async (id) => {
  const pr = await purchasingRepository.getPurchaseRequestById(id);
  if (!pr) throw new ApiError(404, 'Purchase request not found');
  return pr;
};

const approvePurchaseRequest = async (id) => {
  return await purchasingRepository.updatePurchaseRequestStatus(id, 'approved');
};

// =======================
// PURCHASE ORDERS
// =======================
const createPurchaseOrder = async (poData, items) => {
  if (!items || items.length === 0) throw new ApiError(400, 'Purchase order must have items');

  const totalAmount = items.reduce((sum, item) => sum + (Number(item.ordered_quantity) * Number(item.unit_price || 0)), 0);
  poData.total_amount = totalAmount;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const po = await purchasingRepository.createPurchaseOrder(poData, items, client);
    
    // If linked to PR, update PR status
    if (poData.purchase_request_id) {
      await purchasingRepository.updatePurchaseRequestStatus(poData.purchase_request_id, 'ordered', client);
    }

    await client.query('COMMIT');
    return po;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const getPurchaseOrders = async () => {
  return await purchasingRepository.getPurchaseOrders();
};

const getPurchaseOrderById = async (id) => {
  const po = await purchasingRepository.getPurchaseOrderById(id);
  if (!po) throw new ApiError(404, 'Purchase order not found');
  return po;
};

const approvePurchaseOrder = async (id) => {
  return await purchasingRepository.updatePurchaseOrderStatus(id, 'approved');
};

const markOrderAsOrdered = async (id) => {
  return await purchasingRepository.updatePurchaseOrderStatus(id, 'ordered');
};

// =======================
// GOODS RECEIPT
// =======================
const receiveGoods = async (poId, receiptItems, warehouseId, locationId, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const po = await purchasingRepository.getPurchaseOrderById(poId, client);
    if (!po) throw new ApiError(404, 'Purchase order not found');
    if (po.status !== 'ordered' && po.status !== 'partially_received') {
      throw new ApiError(400, `Cannot receive goods for PO in status: ${po.status}`);
    }

    let allFullyReceived = true;

    for (const receipt of receiptItems) {
      const poItem = po.items.find(i => i.id === receipt.po_item_id);
      if (!poItem) throw new ApiError(400, `Invalid PO item ID: ${receipt.po_item_id}`);

      const qty = Number(receipt.received_quantity);
      if (qty <= 0) continue;

      // Update PO Item received quantity
      const updatedItem = await purchasingRepository.updatePurchaseOrderItemReceived(poItem.id, qty, client);

      if (Number(updatedItem.received_quantity) < Number(updatedItem.ordered_quantity)) {
        allFullyReceived = false;
      }

      // Automatically update Inventory Ledger
      await inventoryService.receiveStock({
        item_type: 'material', // Purchasing is typically for materials, but could be product
        item_id: poItem.material_id,
        quantity: qty,
        warehouse_id: warehouseId,
        location_id: locationId,
        batch_number: receipt.batch_number,
        lot_number: receipt.lot_number,
        reference_type: 'purchase_order',
        reference_id: po.id,
        user_id: userId,
        notes: `Received against PO ${po.order_number}`
      }, client);
    }

    // Determine new status
    const updatedPo = await purchasingRepository.getPurchaseOrderById(poId, client);
    const isFullyReceived = updatedPo.items.every(item => Number(item.received_quantity) >= Number(item.ordered_quantity));
    
    const newStatus = isFullyReceived ? 'received' : 'partially_received';
    await purchasingRepository.updatePurchaseOrderStatus(poId, newStatus, client);

    if (isFullyReceived) {
      await purchasingRepository.updatePurchaseOrderDeliveryDate(poId, client);
    }

    if (newStatus === 'received') {
      const finalPo = await purchasingRepository.getPurchaseOrderById(poId, client);
      await accountingService.postPurchaseReceipt(finalPo, client);
    }

    await client.query('COMMIT');
    return { status: newStatus };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// =======================
// SUPPLIER PAYMENTS
// =======================
const paySupplier = async (paymentData) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const payment = await purchasingRepository.createSupplierPayment(paymentData, client);
    await accountingService.postSupplierPayment(payment, client);
    await client.query('COMMIT');
    return payment;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// =======================
// SUPPLIER PERFORMANCE
// =======================
const getSupplierPerformance = async (supplierId) => {
  const result = await pool.query(
    `SELECT 
       COUNT(id) as total_orders,
       SUM(CASE WHEN status = 'received' AND actual_delivery_date <= expected_delivery_date THEN 1 ELSE 0 END) as on_time_orders
     FROM purchase_orders
     WHERE supplier_id = $1 AND status = 'received'`,
    [supplierId]
  );
  
  const total = Number(result.rows[0].total_orders);
  const onTime = Number(result.rows[0].on_time_orders);
  
  const onTimePercentage = total > 0 ? ((onTime / total) * 100).toFixed(2) : 100;

  return {
    total_orders: total,
    on_time_orders: onTime,
    on_time_delivery_rate: onTimePercentage + '%'
  };
};

module.exports = {
  createSupplier,
  getSuppliers,
  getSupplierLedger,
  createPurchaseRequest,
  getPurchaseRequests,
  getPurchaseRequestById,
  approvePurchaseRequest,
  createPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrderById,
  approvePurchaseOrder,
  markOrderAsOrdered,
  receiveGoods,
  paySupplier,
  getSupplierPerformance
};
