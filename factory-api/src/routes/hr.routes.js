const express = require('express');
const router = express.Router();
const hrController = require('../controllers/hrController');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authenticate);

// Positions
router.get('/positions', hrController.getPositions);
router.post('/positions', authorize('admin', 'hr'), hrController.createPosition);

// Shifts
router.get('/shifts', hrController.getShifts);
router.post('/shifts', authorize('admin', 'hr'), hrController.createShift);

// Leaves
router.get('/leaves', hrController.getLeaves);
router.post('/leaves', hrController.createLeave);
router.put('/leaves/:id/status', authorize('admin', 'hr'), hrController.updateLeaveStatus);

// Transactions
router.get('/transactions', authorize('admin', 'hr', 'finance'), hrController.getTransactions);
router.post('/transactions', authorize('admin', 'hr', 'finance'), hrController.createTransaction);
router.delete('/transactions/:id', authorize('admin', 'hr', 'finance'), hrController.deleteTransaction);

// Loans
router.get('/loans', authorize('admin', 'hr', 'finance'), hrController.getLoans);
router.post('/loans', authorize('admin', 'hr', 'finance'), hrController.createLoan);

// Documents
router.get('/employees/:employeeId/documents', hrController.getDocuments);
router.post('/employees/:employeeId/documents', authorize('admin', 'hr'), upload.single('document'), hrController.uploadDocument);

module.exports = router;
