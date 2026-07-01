const express = require('express');
const router = express.Router();
const purchasingController = require('../controllers/purchasingController');
const { authenticate, authorizeAdmin, authorizeManager } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');

const isManagerOrAdmin = (req, res, next) => {
  if (req.user.role === 'admin' || req.user.role === 'manager') {
    return next();
  }
  return res.status(403).json({ error: 'Requires manager or admin role' });
};

// =======================
// SUPPLIERS
// =======================
router.post('/suppliers', authenticate, isManagerOrAdmin, purchasingController.createSupplier);
router.get('/suppliers', authenticate, purchasingController.getSuppliers);
router.get('/suppliers/:id/ledger', authenticate, purchasingController.getSupplierLedger);
router.get('/suppliers/:id/performance', authenticate, purchasingController.getSupplierPerformance);

// =======================
// PURCHASE REQUESTS
// =======================
router.post('/requests', authenticate, purchasingController.createPurchaseRequest);
router.get('/requests', authenticate, purchasingController.getPurchaseRequests);
router.get('/requests/:id', authenticate, purchasingController.getPurchaseRequestById);
router.post('/requests/:id/approve', authenticate, isManagerOrAdmin, purchasingController.approvePurchaseRequest);

// =======================
// PURCHASE ORDERS
// =======================
router.post('/orders', authenticate, isManagerOrAdmin, purchasingController.createPurchaseOrder);
router.get('/orders', authenticate, purchasingController.getPurchaseOrders);
router.get('/orders/:id', authenticate, purchasingController.getPurchaseOrderById);
router.post('/orders/:id/approve', authenticate, isManagerOrAdmin, purchasingController.approvePurchaseOrder);
router.post('/orders/:id/order', authenticate, isManagerOrAdmin, purchasingController.markOrderAsOrdered);

// =======================
// GOODS RECEIPT
// =======================
router.post('/orders/:id/receive', authenticate, purchasingController.receiveGoods);

// =======================
// PAYMENTS
// =======================
router.post('/payments', authenticate, isManagerOrAdmin, purchasingController.paySupplier);

module.exports = router;
