const express = require('express');
const router = express.Router();
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const v = require('../middleware/validation');

const reports = require('../controllers/reportsController');

router.get('/reports/sales',       authenticate, reports.salesOverview);
router.post('/reports/sales/expenses', authenticate, authorizeAdmin, v.salesExpenseCreate, reports.createSalesExpense);
router.get('/reports/production',  authenticate, reports.productionOverview);
router.get('/reports/hr',          authenticate, reports.hrOverview);
router.get('/reports/inventory',   authenticate, reports.inventoryOverview);

module.exports = router;
