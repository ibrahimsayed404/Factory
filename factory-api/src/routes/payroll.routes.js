const express = require('express');
const router = express.Router();
const { authenticate, authorizeAdmin, authorizeCronOrAdmin } = require('../middleware/auth');
const v = require('../middleware/validation');

const payroll = require('../controllers/payrollController');

router.get('/payroll', authenticate, payroll.getAll);
router.post('/payroll', authenticate, authorizeAdmin, v.payrollCreate, payroll.create);
router.put('/payroll/:id/pay', authenticate, authorizeAdmin, v.idParam, payroll.markPaid);
router.put('/payroll/:id/manual', authenticate, authorizeAdmin, v.idParam, payroll.updateManual);
router.delete('/payroll/week/:weekStart', authenticate, authorizeAdmin, payroll.deleteWeek);

// Auto-run triggers full-company payroll generation (a financial side effect), so
// it must never be reachable anonymously. It accepts the Vercel Cron secret
// (Authorization: Bearer <CRON_SECRET>) or an authenticated admin.
router.get('/payroll/auto-run', authorizeCronOrAdmin, payroll.autoRun);

module.exports = router;
