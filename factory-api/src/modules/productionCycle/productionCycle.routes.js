const express = require('express');
const router = express.Router();
const { authenticate, authorizeAdmin } = require('../../middleware/auth');
const productionCycle = require('./productionCycle.controller');

router.get('/production-cycle/orders', authenticate, productionCycle.listOrders);
router.get('/production-cycle/orders/:id', authenticate, productionCycle.getOrder);
router.post('/production-cycle/orders/cutting', authenticate, authorizeAdmin, productionCycle.createCuttingOrder);
router.put('/production-cycle/orders/:id/sorting', authenticate, authorizeAdmin, productionCycle.submitSortingPhase);
router.put('/production-cycle/orders/:id/print/send', authenticate, authorizeAdmin, productionCycle.sendToPrint);
router.put('/production-cycle/orders/:id/print/receive', authenticate, authorizeAdmin, productionCycle.receiveFromPrint);
router.put('/production-cycle/orders/:id/print/skip', authenticate, authorizeAdmin, productionCycle.skipPrint);
router.put('/production-cycle/orders/:id/machines', authenticate, authorizeAdmin, productionCycle.submitMachinesPhase);
router.put('/production-cycle/orders/:id/deliver', authenticate, authorizeAdmin, productionCycle.deliverToCustomer);
router.delete('/production-cycle/orders/:id', authenticate, authorizeAdmin, productionCycle.deleteOrder);
router.get('/production-cycle/kpis', authenticate, productionCycle.getKPIs);

module.exports = router;
