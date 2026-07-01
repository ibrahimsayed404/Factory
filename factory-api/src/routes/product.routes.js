const express = require('express');
const router = express.Router();
const { authenticate, authorizeAdmin } = require('../middleware/auth');

const products = require('../controllers/productController');

router.get('/products', authenticate, products.getAll);
router.get('/products/:id', authenticate, products.getOne);
router.post('/products', authenticate, authorizeAdmin, products.create);
router.put('/products/:id', authenticate, authorizeAdmin, products.update);
router.delete('/products/:id', authenticate, authorizeAdmin, products.remove);

module.exports = router;
