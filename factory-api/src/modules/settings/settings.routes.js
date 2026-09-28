const express = require('express');
const router = express.Router();
const { authenticate, authorizeAdmin } = require('../../middleware/auth');

const settings = require('./settings.controller');

router.get('/settings/attendance-payroll', authenticate, settings.getAttendancePayroll);
router.put('/settings/attendance-payroll', authenticate, authorizeAdmin, settings.updateAttendancePayroll);

module.exports = router;
