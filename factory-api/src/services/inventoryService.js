const crypto = require('crypto');
const pool = require('../db/pool');
const inventoryRepository = require('../repositories/inventoryRepository');
const accountingService = require('./accountingService');
const ApiError = require('../utils/ApiError');

const DEFAULT_WAREHOUSE_ID = 1;
const DEFAULT_LOCATION_ID = 1;

/**
 * Generate a unique barcode if none is provided
 */
const generateBarcode = (itemType, itemId) => {
  const prefix = itemType === 'material' ? 'MAT' : 'PRD';
  const randomStr = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${itemId}-${randomStr}`;
};

/**
 * Helper to get default location if none provided
 */
const resolveLocationInfo = (warehouseId, locationId) => {
  return {
    wId: warehouseId || DEFAULT_WAREHOUSE_ID,
    lId: locationId || DEFAULT_LOCATION_ID
  };
};

const receiveStock = async ({
  item_type,
  item_id,
  quantity,
  warehouse_id,
  location_id,
  batch_number,
  lot_number,
  barcode,
  qr_code,
  reference_type,
  reference_id,
  user_id,
  notes
}, client) => {
  if (!quantity || quantity <= 0) {
    throw new ApiError(400, 'Receive quantity must be positive');
  }

  const { wId, lId } = resolveLocationInfo(warehouse_id, location_id);

  const tx = await inventoryRepository.insertTransaction({
    item_type,
    item_id,
    warehouse_id: wId,
    location_id: lId,
    quantity: Math.abs(quantity),
    transaction_type: 'in',
    batch_number,
    lot_number,
    barcode: barcode || generateBarcode(item_type, item_id),
    qr_code,
    reference_type,
    reference_id,
    user_id,
    notes
  }, client);
  await accountingService.postInventoryTransaction(tx, client);
  return tx;
};

const issueStock = async ({
  item_type,
  item_id,
  quantity,
  warehouse_id,
  location_id,
  batch_number,
  lot_number,
  reference_type,
  reference_id,
  user_id,
  notes
}, client) => {
  if (!quantity || quantity <= 0) {
    throw new ApiError(400, 'Issue quantity must be positive');
  }

  const { wId, lId } = resolveLocationInfo(warehouse_id, location_id);

  // Note: For strict inventory control, we should verify balance >= quantity here.
  // However, many ERPs allow negative inventory by default to not block production 
  // if counts are temporarily inaccurate. We'll allow it for now but in a production 
  // system we might query `inventory_balances` first and throw if insufficient.

  const tx = await inventoryRepository.insertTransaction({
    item_type,
    item_id,
    warehouse_id: wId,
    location_id: lId,
    quantity: -Math.abs(quantity), // OUT is negative
    transaction_type: 'out',
    batch_number,
    lot_number,
    reference_type,
    reference_id,
    user_id,
    notes
  }, client);
  await accountingService.postInventoryTransaction(tx, client);
  return tx;
};

const transferStock = async ({
  item_type,
  item_id,
  quantity,
  from_warehouse_id,
  from_location_id,
  to_warehouse_id,
  to_location_id,
  batch_number,
  lot_number,
  user_id,
  notes
}, client) => {
  if (!quantity || quantity <= 0) {
    throw new ApiError(400, 'Transfer quantity must be positive');
  }

  // 1. Issue from source
  await issueStock({
    item_type, item_id, quantity,
    warehouse_id: from_warehouse_id,
    location_id: from_location_id,
    batch_number, lot_number,
    reference_type: 'transfer',
    user_id,
    notes: `Transfer Out: ${notes || ''}`
  }, client);

  // 2. Receive to destination
  await receiveStock({
    item_type, item_id, quantity,
    warehouse_id: to_warehouse_id,
    location_id: to_location_id,
    batch_number, lot_number,
    reference_type: 'transfer',
    user_id,
    notes: `Transfer In: ${notes || ''}`
  }, client);
};

const reserveStock = async (data, client = pool) => {
  return await inventoryRepository.insertTransaction({
    ...data,
    transaction_type: 'reserve'
  }, client);
};

const releaseReservation = async (data, client = pool) => {
  if (!data.quantity || data.quantity <= 0) {
    throw new ApiError(400, 'Release quantity must be positive');
  }

  return await inventoryRepository.insertTransaction({
    ...data,
    quantity: -Math.abs(data.quantity),
    transaction_type: 'reserve'
  }, client);
};

const getAvailability = async (filters, client = pool) => {
  const balances = await inventoryRepository.getInventoryBalances(filters, client);
  const totals = balances.reduce((acc, row) => {
    acc.quantity_on_hand += Number(row.quantity_on_hand || 0);
    acc.quantity_reserved += Number(row.quantity_reserved || 0);
    return acc;
  }, { quantity_on_hand: 0, quantity_reserved: 0 });

  return {
    ...totals,
    quantity_available: totals.quantity_on_hand - totals.quantity_reserved,
  };
};

const adjustStock = async ({
  item_type,
  item_id,
  warehouse_id,
  location_id,
  actual_quantity,
  batch_number,
  lot_number,
  user_id,
  notes
}, client) => {
  const { wId, lId } = resolveLocationInfo(warehouse_id, location_id);

  // Get current balance
  const balances = await inventoryRepository.getInventoryBalances({
    item_type, item_id, warehouse_id: wId, location_id: lId
  });

  // Find matching lot
  let currentQty = 0;
  if (balances.length > 0) {
    const match = balances.find(b => 
      (b.batch_number || '') === (batch_number || '') && 
      (b.lot_number || '') === (lot_number || '')
    );
    if (match) currentQty = Number(match.quantity_on_hand);
  }

  const difference = actual_quantity - currentQty;
  if (difference === 0) return null; // No adjustment needed

  const tx = await inventoryRepository.insertTransaction({
    item_type,
    item_id,
    warehouse_id: wId,
    location_id: lId,
    quantity: difference,
    transaction_type: 'adjustment',
    batch_number,
    lot_number,
    reference_type: 'audit',
    user_id,
    notes: notes || `Audit Adjustment: Expected ${currentQty}, found ${actual_quantity}`
  }, client);
  await accountingService.postInventoryTransaction(tx, client);
  return tx;
};

const getLedger = async (filters) => {
  return await inventoryRepository.getLedgerHistory(filters);
};

const getBalances = async (filters) => {
  return await inventoryRepository.getInventoryBalances(filters);
};

const createWarehouse = async (data) => {
  return await inventoryRepository.createWarehouse(data);
};

const getWarehouses = async () => {
  return await inventoryRepository.getWarehouses();
};

const createLocation = async (data) => {
  return await inventoryRepository.createLocation(data);
};

const getLocations = async (warehouseId) => {
  return await inventoryRepository.getLocations(warehouseId);
};

module.exports = {
  receiveStock,
  issueStock,
  reserveStock,
  releaseReservation,
  transferStock,
  adjustStock,
  getLedger,
  getBalances,
  getAvailability,
  createWarehouse,
  getWarehouses,
  createLocation,
  getLocations
};
