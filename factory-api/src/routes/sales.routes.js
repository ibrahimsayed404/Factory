const express = require('express');
const router = express.Router();
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const { paymentEvidenceUpload, validateEvidenceSignature } = require('../middleware/upload');
const v = require('../middleware/validation');

const path = require('node:path');
const fsPromises = require('node:fs').promises;
const storageService = require('../services/storageService');

const sales = require('../controllers/salesController');


// Customers
router.get('/customers', authenticate, sales.getCustomers);
router.post('/customers', authenticate, authorizeAdmin, v.customerCreate, sales.createCustomer);
router.get('/customers/:id/ledger', authenticate, v.idParam, sales.getCustomerLedger);
router.post('/customers/:id/payments', authenticate, authorizeAdmin, paymentEvidenceUpload.single('evidence'), validateEvidenceSignature, v.idParam, v.customerPaymentCreate, sales.createCustomerPayment);

// Sales Orders
router.get('/sales/analytics', authenticate, sales.getAnalytics);
router.get('/sales/outstanding-balances', authenticate, sales.getOutstandingBalances);
router.get('/sales', authenticate, sales.getOrders);
router.get('/sales/:id', authenticate, sales.getOrder);
router.post('/sales', authenticate, authorizeAdmin, v.salesCreate, sales.createOrder);
router.put('/sales/:id/status', authenticate, authorizeAdmin, v.idParam, v.salesStatusUpdate, sales.updateStatus);
router.delete('/sales/:id', authenticate, authorizeAdmin, v.idParam, sales.deleteOrder);

// Sales Documents
router.get('/sales-quotations', authenticate, sales.getQuotations);
router.post('/sales-quotations', authenticate, authorizeAdmin, v.salesCreate, sales.createQuotation);
router.post('/sales-quotations/:id/convert', authenticate, authorizeAdmin, v.idParam, sales.convertQuotation);

router.get('/sales-invoices', authenticate, sales.getInvoices);
router.post('/sales-invoices', authenticate, authorizeAdmin, sales.createInvoice);

router.get('/delivery-notes', authenticate, sales.getDeliveryNotes);
router.post('/delivery-notes', authenticate, authorizeAdmin, sales.createDeliveryNote);

router.get('/sales-returns', authenticate, sales.getReturns);
router.post('/sales-returns', authenticate, authorizeAdmin, sales.createReturn);

router.get('/credit-notes', authenticate, sales.getCreditNotes);
router.post('/credit-notes', authenticate, authorizeAdmin, sales.createCreditNote);

// Authenticated evidence file download (admin only)
router.get('/uploads/payment-evidence/:filename', authenticate, authorizeAdmin, async (req, res, next) => {
  try {
    const { filename } = req.params;
    // Prevent path traversal: reject any name that contains a path separator or dots leading to parent
    if (!filename || /[/\\]/.test(filename) || filename.includes('..')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    const filePath = path.join(__dirname, '..', '..', 'uploads', 'payment-evidence', filename);
    try {
      await fsPromises.access(filePath);
      return res.sendFile(filePath);
    } catch {
      // Local file not found — try Supabase cloud redirect
      const cloudUrl = storageService.getCloudUrl('payment-evidence', filename);
      if (cloudUrl) return res.redirect(cloudUrl);
      return res.status(404).json({ error: 'File not found' });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
