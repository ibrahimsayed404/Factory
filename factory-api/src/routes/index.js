const express = require('express');
const router = express.Router();
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const { deviceAuthenticate } = require('../middleware/deviceAuth');
const { paymentEvidenceUpload, validateEvidenceSignature } = require('../middleware/upload');
const v = require('../middleware/validation');

const path = require('node:path');

const auth = require('../controllers/authController');
const inventory = require('../controllers/inventoryController');
const employees = require('../controllers/employeeController');
const payroll = require('../controllers/payrollController');
const sales = require('../controllers/salesController');
const production = require('../controllers/productionController');
const productionTracking = require('../controllers/productionTrackingController');
const settings = require('../controllers/settingsController');
const dashboard = require('../controllers/dashboardController');
const reports   = require('../controllers/reportsController');
const device = require('../controllers/deviceController');

// Device ingestion (API-key protected)
router.post('/device/punch-events', deviceAuthenticate, device.ingestPunchEvents);

// Auth (public)
router.post('/auth/register', v.authRegister, auth.register);
router.post('/auth/login', v.authLogin, auth.login);
router.post('/auth/refresh', v.authRefresh, auth.refresh);
router.get('/auth/me', authenticate, auth.me);
router.post('/auth/logout', authenticate, auth.logout);

// Dashboard (protected)
router.get('/dashboard/stats', authenticate, dashboard.getStats);

// Reports (protected)
router.get('/reports/sales',       authenticate, reports.salesOverview);
router.post('/reports/sales/expenses', authenticate, authorizeAdmin, v.salesExpenseCreate, reports.createSalesExpense);
router.get('/reports/production',  authenticate, reports.productionOverview);
router.get('/reports/hr',          authenticate, reports.hrOverview);
router.get('/reports/inventory',   authenticate, reports.inventoryOverview);

// Inventory (protected)
router.get('/inventory', authenticate, inventory.getAll);
router.get('/inventory/:id', authenticate, inventory.getOne);
router.post('/inventory', authenticate, authorizeAdmin, v.inventoryUpsert, inventory.create);
router.put('/inventory/:id', authenticate, authorizeAdmin, v.idParam, v.inventoryUpsert, inventory.update);
router.delete('/inventory/:id', authenticate, authorizeAdmin, v.idParam, inventory.remove);

// Employees (protected)
router.get('/departments', authenticate, employees.getDepartments);
router.get('/employees', authenticate, employees.getAll);
router.get('/employees/:id', authenticate, employees.getOne);
router.post('/employees', authenticate, authorizeAdmin, v.employeeUpsert, employees.create);
router.put('/employees/:id', authenticate, authorizeAdmin, v.idParam, v.employeeUpsert, employees.update);
router.delete('/employees/:id', authenticate, authorizeAdmin, v.idParam, employees.remove);
router.post('/employees/:id/attendance', authenticate, authorizeAdmin, v.idParam, v.attendanceUpsert, employees.logAttendance);
router.get('/employees/:id/attendance', authenticate, employees.getAttendance);

// Payroll (protected)
router.get('/payroll', authenticate, payroll.getAll);
router.post('/payroll', authenticate, authorizeAdmin, v.payrollCreate, payroll.create);
router.put('/payroll/:id/pay', authenticate, authorizeAdmin, v.idParam, payroll.markPaid);

// Settings (protected)
router.get('/settings/attendance-payroll', authenticate, settings.getAttendancePayroll);
router.put('/settings/attendance-payroll', authenticate, authorizeAdmin, settings.updateAttendancePayroll);

// Customers & Sales (protected)
router.get('/customers', authenticate, sales.getCustomers);
router.post('/customers', authenticate, authorizeAdmin, v.customerCreate, sales.createCustomer);
router.get('/customers/:id/ledger', authenticate, v.idParam, sales.getCustomerLedger);
router.post('/customers/:id/payments', authenticate, authorizeAdmin, paymentEvidenceUpload.single('evidence'), validateEvidenceSignature, v.idParam, v.customerPaymentCreate, sales.createCustomerPayment);
router.get('/sales', authenticate, sales.getOrders);
router.get('/sales/:id', authenticate, sales.getOrder);
router.post('/sales', authenticate, authorizeAdmin, v.salesCreate, sales.createOrder);
router.put('/sales/:id/status', authenticate, authorizeAdmin, v.idParam, v.salesStatusUpdate, sales.updateStatus);
router.delete('/sales/:id', authenticate, authorizeAdmin, v.idParam, sales.deleteOrder);

// Production (protected)
router.get('/production', authenticate, production.getAll);
router.get('/production/:id', authenticate, production.getOne);
router.post('/production', authenticate, authorizeAdmin, v.productionCreate, production.create);
router.put('/production/:id/status', authenticate, authorizeAdmin, v.idParam, v.productionStatusUpdate, production.updateStatus);

// Production tracking (multi-phase)
router.get('/production-orders', authenticate, productionTracking.list);
router.get('/production-orders/machines', authenticate, productionTracking.listMachines);
router.get('/production-orders/:id/report', authenticate, v.idParam, productionTracking.getReport);
router.post('/production-orders', authenticate, authorizeAdmin, v.productionTrackingCreate, productionTracking.createOrder);
router.post('/production-orders/:id/sorting', authenticate, authorizeAdmin, v.idParam, v.productionTrackingPhase, productionTracking.addSortingPhase);
router.post('/production-orders/:id/final', authenticate, authorizeAdmin, v.idParam, v.productionTrackingPhase, productionTracking.addFinalPhase);



// Authenticated evidence file download (admin only)
const fsPromises = require('node:fs').promises;
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
    } catch {
      return res.status(404).json({ error: 'File not found' });
    }
    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
