const express = require('express');
const router = express.Router();
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const printShop = require('../controllers/printShopController');

router.get('/print-shops', authenticate, printShop.list);
router.get('/print-shops/:id', authenticate, printShop.getById);
router.post('/print-shops', authenticate, authorizeAdmin, printShop.create);
router.put('/print-shops/:id', authenticate, authorizeAdmin, printShop.update);
router.delete('/print-shops/:id', authenticate, authorizeAdmin, printShop.remove);

module.exports = router;
