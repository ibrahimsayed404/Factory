const express = require('express');
const router = express.Router();
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const v = require('../middleware/validation');

const payroll = require('../controllers/payrollController');

router.get('/payroll', authenticate, payroll.getAll);
router.post('/payroll', authenticate, authorizeAdmin, v.payrollCreate, payroll.create);
router.post('/payroll/monthly', authenticate, authorizeAdmin, payroll.generateMonthly);
router.put('/payroll/:id/pay', authenticate, authorizeAdmin, v.idParam, payroll.markPaid);
router.put('/payroll/:id/manual', authenticate, authorizeAdmin, v.idParam, payroll.updateManual);
router.delete('/payroll/week/:weekStart', authenticate, authorizeAdmin, payroll.deleteWeek);

const { runAutoPayrollForCurrentWeek } = require('../services/autoPayrollScheduler');
router.get('/payroll/auto-run', async (req, res) => {
  try {
    await runAutoPayrollForCurrentWeek();
    res.json({ success: true, message: 'Auto payroll check completed.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
