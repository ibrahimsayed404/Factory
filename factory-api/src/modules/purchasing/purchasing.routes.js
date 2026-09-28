const express = require('express');
const router = express.Router();
const purchasingController = require('./purchasing.controller');
const { authenticate, authorizeAdmin } = require('../../middleware/auth');

// Purchasing (suppliers, requests, orders, receipts, supplier payments) is admin-only.
router.use(authenticate, authorizeAdmin);

// =======================
// SUPPLIERS
// =======================
router.post('/suppliers', purchasingController.createSupplier);
router.get('/suppliers', purchasingController.getSuppliers);
router.get('/suppliers/:id/ledger', purchasingController.getSupplierLedger);
router.get('/suppliers/:id/performance', purchasingController.getSupplierPerformance);

// =======================
// PURCHASE REQUESTS
// =======================
router.post('/requests', purchasingController.createPurchaseRequest);
router.get('/requests', purchasingController.getPurchaseRequests);
router.get('/requests/:id', purchasingController.getPurchaseRequestById);
router.post('/requests/:id/approve', purchasingController.approvePurchaseRequest);

// =======================
// PURCHASE ORDERS
// =======================
router.post('/orders', purchasingController.createPurchaseOrder);
router.get('/orders', purchasingController.getPurchaseOrders);
router.get('/orders/:id', purchasingController.getPurchaseOrderById);
router.post('/orders/:id/approve', purchasingController.approvePurchaseOrder);
router.post('/orders/:id/order', purchasingController.markOrderAsOrdered);

// =======================
// GOODS RECEIPT
// =======================
router.post('/orders/:id/receive', purchasingController.receiveGoods);

// =======================
// PAYMENTS
// =======================
router.post('/payments', purchasingController.paySupplier);

module.exports = router;
