const express = require('express');
const router = express.Router();
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const v = require('../middleware/validation');

const productionTracking = require('../controllers/productionTrackingController');

router.get('/production-orders', authenticate, productionTracking.list);
router.get('/production-orders/machines', authenticate, productionTracking.listMachines);
router.get('/production-orders/:id/report', authenticate, v.idParam, productionTracking.getReport);
router.post('/production-orders', authenticate, authorizeAdmin, v.productionTrackingCreate, productionTracking.createOrder);
router.post('/production-orders/:id/sorting', authenticate, authorizeAdmin, v.idParam, v.productionTrackingPhase, productionTracking.addSortingPhase);
router.post('/production-orders/:id/outsourcing', authenticate, authorizeAdmin, v.idParam, v.productionTrackingPhase, productionTracking.addOutsourcingPhase);
router.post('/production-orders/:id/final', authenticate, authorizeAdmin, v.idParam, v.productionTrackingPhase, productionTracking.addFinalPhase);
router.delete('/production-orders/:id', authenticate, authorizeAdmin, v.idParam, productionTracking.deleteOrder);

module.exports = router;
