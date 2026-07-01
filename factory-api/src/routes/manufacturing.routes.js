const { Router } = require('express');
const manufacturingController = require('../controllers/manufacturingController');
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const { handleValidation } = require('../middleware/validation');
const { body } = require('express-validator');

const router = Router();
router.use(authenticate);

// BOMs
router.post(
  '/boms',
  authorizeAdmin,
  [
    body('product_id').isInt(),
    body('name').notEmpty().trim(),
    body('materials').isArray({ min: 1 })
  ],
  handleValidation,
  manufacturingController.createBom
);
router.get('/boms', manufacturingController.getBoms);
router.get('/boms/:id', manufacturingController.getBomById);

// Stages
router.post(
  '/stages',
  authorizeAdmin,
  [
    body('name').notEmpty().trim()
  ],
  handleValidation,
  manufacturingController.createProductionStage
);
router.get('/stages', manufacturingController.getProductionStages);

// Routings
router.post(
  '/routings',
  authorizeAdmin,
  [
    body('product_id').isInt(),
    body('name').notEmpty().trim(),
    body('steps').isArray({ min: 1 })
  ],
  handleValidation,
  manufacturingController.createRouting
);
router.get('/routings', manufacturingController.getRoutings);
router.get('/routings/:id', manufacturingController.getRoutingById);

module.exports = router;
