const purchasingService = require('../services/purchasingService');
const ApiError = require('../utils/ApiError');

// =======================
// SUPPLIERS
// =======================
exports.createSupplier = async (req, res, next) => {
  try {
    const supplier = await purchasingService.createSupplier(req.body);
    res.status(201).json(supplier);
  } catch (err) {
    next(err);
  }
};

exports.getSuppliers = async (req, res, next) => {
  try {
    const suppliers = await purchasingService.getSuppliers();
    res.json(suppliers);
  } catch (err) {
    next(err);
  }
};

exports.getSupplierLedger = async (req, res, next) => {
  try {
    const ledger = await purchasingService.getSupplierLedger(req.params.id);
    res.json(ledger);
  } catch (err) {
    next(err);
  }
};

exports.getSupplierPerformance = async (req, res, next) => {
  try {
    const perf = await purchasingService.getSupplierPerformance(req.params.id);
    res.json(perf);
  } catch (err) {
    next(err);
  }
};

// =======================
// PURCHASE REQUESTS
// =======================
exports.createPurchaseRequest = async (req, res, next) => {
  try {
    const prData = {
      ...req.body,
      requested_by: req.user.id
    };
    const pr = await purchasingService.createPurchaseRequest(prData, req.body.items);
    res.status(201).json(pr);
  } catch (err) {
    next(err);
  }
};

exports.getPurchaseRequests = async (req, res, next) => {
  try {
    const prs = await purchasingService.getPurchaseRequests();
    res.json(prs);
  } catch (err) {
    next(err);
  }
};

exports.getPurchaseRequestById = async (req, res, next) => {
  try {
    const pr = await purchasingService.getPurchaseRequestById(req.params.id);
    res.json(pr);
  } catch (err) {
    next(err);
  }
};

exports.approvePurchaseRequest = async (req, res, next) => {
  try {
    const pr = await purchasingService.approvePurchaseRequest(req.params.id);
    res.json(pr);
  } catch (err) {
    next(err);
  }
};

// =======================
// PURCHASE ORDERS
// =======================
exports.createPurchaseOrder = async (req, res, next) => {
  try {
    const poData = {
      ...req.body,
      created_by: req.user.id
    };
    const po = await purchasingService.createPurchaseOrder(poData, req.body.items);
    res.status(201).json(po);
  } catch (err) {
    next(err);
  }
};

exports.getPurchaseOrders = async (req, res, next) => {
  try {
    const pos = await purchasingService.getPurchaseOrders();
    res.json(pos);
  } catch (err) {
    next(err);
  }
};

exports.getPurchaseOrderById = async (req, res, next) => {
  try {
    const po = await purchasingService.getPurchaseOrderById(req.params.id);
    res.json(po);
  } catch (err) {
    next(err);
  }
};

exports.approvePurchaseOrder = async (req, res, next) => {
  try {
    const po = await purchasingService.approvePurchaseOrder(req.params.id);
    res.json(po);
  } catch (err) {
    next(err);
  }
};

exports.markOrderAsOrdered = async (req, res, next) => {
  try {
    const po = await purchasingService.markOrderAsOrdered(req.params.id);
    res.json(po);
  } catch (err) {
    next(err);
  }
};

// =======================
// GOODS RECEIPT
// =======================
exports.receiveGoods = async (req, res, next) => {
  try {
    const { receiptItems, warehouseId, locationId } = req.body;
    const result = await purchasingService.receiveGoods(
      req.params.id, 
      receiptItems, 
      warehouseId, 
      locationId, 
      req.user.id
    );
    res.json({ message: 'Goods received successfully', ...result });
  } catch (err) {
    next(err);
  }
};

// =======================
// PAYMENTS
// =======================
exports.paySupplier = async (req, res, next) => {
  try {
    const paymentData = {
      ...req.body,
      created_by: req.user.id
    };
    const payment = await purchasingService.paySupplier(paymentData);
    res.status(201).json(payment);
  } catch (err) {
    next(err);
  }
};
