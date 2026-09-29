const express = require('express');
const router = express.Router();
const { authenticate, authorizeAdmin } = require('../../middleware/auth');
const v = require('../../middleware/validation');

const reports = require('./reports.controller');

router.get('/reports/sales',       authenticate, reports.salesOverview);
router.get('/reports/sales/expenses', authenticate, authorizeAdmin, reports.listSalesExpenses);
router.post('/reports/sales/expenses', authenticate, authorizeAdmin, v.salesExpenseCreate, reports.createSalesExpense);
router.put('/reports/sales/expenses/:id', authenticate, authorizeAdmin, v.salesExpenseUpdate, reports.updateSalesExpense);
router.delete('/reports/sales/expenses/:id', authenticate, authorizeAdmin, v.idParam, reports.deleteSalesExpense);
router.get('/reports/production',  authenticate, reports.productionOverview);
router.get('/reports/hr',          authenticate, reports.hrOverview);
router.get('/reports/inventory',   authenticate, reports.inventoryOverview);
router.get('/reports/print-shops', authenticate, reports.printShopsOverview);

module.exports = router;
