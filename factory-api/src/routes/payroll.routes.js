const express = require('express');
const router = express.Router();
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const v = require('../middleware/validation');

const payroll = require('../controllers/payrollController');

router.get('/payroll', authenticate, payroll.getAll);
router.post('/payroll', authenticate, authorizeAdmin, v.payrollCreate, payroll.create);
router.post('/payroll/monthly', authenticate, authorizeAdmin, payroll.generateMonthly);
router.put('/payroll/:id/pay', authenticate, authorizeAdmin, v.idParam, payroll.markPaid);

module.exports = router;
