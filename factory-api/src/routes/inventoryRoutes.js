const express = require('express');
const inventoryController = require('../controllers/inventoryController');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validation');
const { body, query } = require('express-validator');

const router = express.Router();

router.use(authenticate);

// Middleware to log audit for inventory
const auditInventory = async (req, res, next) => {
  req.auditAction = req.method;
  req.auditEntity = 'inventory';
  next();
};

router.use(auditInventory);

// Warehouses
router.post('/warehouses', 
  authorize('admin', 'manager'),
  validate([
    body('name').notEmpty().withMessage('Name is required'),
    body('type').optional().isString()
  ]),
  inventoryController.createWarehouse
);

router.get('/warehouses', inventoryController.getWarehouses);

// Locations
router.post('/locations', 
  authorize('admin', 'manager'),
  validate([
    body('warehouse_id').isInt().withMessage('warehouse_id is required'),
    body('code').notEmpty().withMessage('code is required')
  ]),
  inventoryController.createLocation
);

router.get('/locations', inventoryController.getLocations);

// Transactions
router.post('/receive',
  authorize('admin', 'manager'),
  validate([
    body('item_type').isIn(['material', 'product']),
    body('item_id').isInt(),
    body('quantity').isNumeric()
  ]),
  inventoryController.receiveStock
);

router.post('/issue',
  authorize('admin', 'manager'),
  validate([
    body('item_type').isIn(['material', 'product']),
    body('item_id').isInt(),
    body('quantity').isNumeric()
  ]),
  inventoryController.issueStock
);

router.post('/transfer',
  authorize('admin', 'manager'),
  validate([
    body('item_type').isIn(['material', 'product']),
    body('item_id').isInt(),
    body('quantity').isNumeric(),
    body('from_warehouse_id').isInt(),
    body('to_warehouse_id').isInt()
  ]),
  inventoryController.transferStock
);

router.post('/adjust',
  authorize('admin', 'manager'),
  validate([
    body('item_type').isIn(['material', 'product']),
    body('item_id').isInt(),
    body('actual_quantity').isNumeric()
  ]),
  inventoryController.adjustStock
);

// Reports
router.get('/balances', inventoryController.getBalances);
router.get('/ledger', inventoryController.getLedger);

module.exports = router;
