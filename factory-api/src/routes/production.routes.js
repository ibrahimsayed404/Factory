const express = require('express');
const router = express.Router();
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const v = require('../middleware/validation');

const production = require('../controllers/productionController');

router.get('/production', authenticate, production.getAll);
router.get('/production/:id', authenticate, production.getOne);
router.post('/production', authenticate, authorizeAdmin, v.productionCreate, production.create);
router.put('/production/:id/status', authenticate, authorizeAdmin, v.productionStatusUpdate, production.updateStatus);
router.put('/production/work-orders/:workOrderId/complete', authenticate, authorizeAdmin, production.completeWorkOrder);

module.exports = router;
