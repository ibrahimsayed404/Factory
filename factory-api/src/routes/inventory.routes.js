const express = require('express');
const router = express.Router();
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const v = require('../middleware/validation');

const inventory = require('../controllers/inventoryController');

router.get('/inventory', authenticate, inventory.getAll);
router.get('/inventory/:id', authenticate, inventory.getOne);
router.post('/inventory', authenticate, authorizeAdmin, v.inventoryUpsert, inventory.create);
router.put('/inventory/:id', authenticate, authorizeAdmin, v.idParam, v.inventoryUpsert, inventory.update);
router.delete('/inventory/:id', authenticate, authorizeAdmin, v.idParam, inventory.remove);

// Ledger / Stock routes
router.post('/inventory/warehouses', authenticate, authorizeAdmin, inventory.createWarehouse);
router.get('/inventory/warehouses', authenticate, inventory.getWarehouses);

router.post('/inventory/locations', authenticate, authorizeAdmin, inventory.createLocation);
router.get('/inventory/locations', authenticate, inventory.getLocations);

router.post('/inventory/receive', authenticate, authorizeAdmin, inventory.receiveStock);
router.post('/inventory/issue', authenticate, authorizeAdmin, inventory.issueStock);
router.post('/inventory/transfer', authenticate, authorizeAdmin, inventory.transferStock);
router.post('/inventory/adjust', authenticate, authorizeAdmin, inventory.adjustStock);

router.get('/inventory-ledger/balances', authenticate, inventory.getBalances);
router.get('/inventory-ledger/history', authenticate, inventory.getLedger);

module.exports = router;
