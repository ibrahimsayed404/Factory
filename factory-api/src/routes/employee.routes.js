const express = require('express');
const router = express.Router();
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const v = require('../middleware/validation');

const employees = require('../controllers/employeeController');

router.get('/departments', authenticate, employees.getDepartments);
router.get('/employees', authenticate, employees.getAll);
router.get('/employees/:id', authenticate, employees.getOne);
router.post('/employees', authenticate, authorizeAdmin, v.employeeUpsert, employees.create);
router.put('/employees/:id', authenticate, authorizeAdmin, v.idParam, v.employeeUpsert, employees.update);
router.delete('/employees/:id', authenticate, authorizeAdmin, v.idParam, employees.remove);
router.post('/employees/:id/attendance', authenticate, authorizeAdmin, v.idParam, v.attendanceUpsert, employees.logAttendance);
router.get('/employees/:id/attendance', authenticate, employees.getAttendance);

module.exports = router;
