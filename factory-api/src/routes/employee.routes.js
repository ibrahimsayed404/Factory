const express = require('express');
const router = express.Router();
const { authenticate, authorizeAdmin, authorizeCronOrAdmin } = require('../middleware/auth');
const v = require('../middleware/validation');

const employees = require('../controllers/employeeController');

router.get('/departments', authenticate, employees.getDepartments);

// ── Vercel Cron targets ────────────────────────────────────────────────────
// Secured with authorizeCronOrAdmin (CRON_SECRET header or logged-in admin).
// Placed before /:id routes so 'attendance' is not matched as an employee ID.
//
// Schedule (Cairo = UTC+3 in summer EEST):
//   auto-absence : 0 9 * * *   → 12:00 Cairo (09:00 UTC)
//   auto-checkout: 0 17 * * *  → 20:00 Cairo (17:00 UTC)
router.get('/attendance/auto-absence',  authorizeCronOrAdmin, employees.triggerAutoAbsence);
router.get('/attendance/auto-checkout', authorizeCronOrAdmin, employees.triggerAutoCheckout);
// ──────────────────────────────────────────────────────────────────────
router.get('/employees', authenticate, employees.getAll);
router.get('/employees/:id', authenticate, employees.getOne);
router.post('/employees', authenticate, authorizeAdmin, v.employeeUpsert, employees.create);
router.put('/employees/:id', authenticate, authorizeAdmin, v.idParam, v.employeeUpsert, employees.update);
router.delete('/employees/:id', authenticate, authorizeAdmin, v.idParam, employees.remove);
router.post('/employees/:id/attendance', authenticate, authorizeAdmin, v.idParam, v.attendanceUpsert, employees.logAttendance);
router.get('/employees/:id/attendance', authenticate, authorizeAdmin, v.idParam, employees.getAttendance);

module.exports = router;
