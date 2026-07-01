const pool = require('../db/pool');
const productRepository = require('../repositories/productRepository');
const auditService = require('./auditService');
const ApiError = require('../utils/ApiError');

const listProducts = async () => {
  return await productRepository.getAllProducts();
};

const getProduct = async (id) => {
  const product = await productRepository.getProductById(id);
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }
  return product;
};

const addProduct = async (userId, data, reqContext = null) => {
  try {
    const newProduct = await productRepository.createProduct(data);
    await auditService.log(userId, 'CREATE', 'products', newProduct.id, { name: newProduct.name }, reqContext);
    return newProduct;
  } catch (err) {
    if (err.code === '23505') {
      throw new ApiError(409, 'Product name or SKU already exists');
    }
    throw err;
  }
};

const updateProduct = async (userId, id, data, reqContext = null) => {
  try {
    const updatedProduct = await productRepository.updateProduct(id, data);
    if (!updatedProduct) {
      throw new ApiError(404, 'Product not found');
    }
    await auditService.log(userId, 'UPDATE', 'products', updatedProduct.id, { name: updatedProduct.name }, reqContext);
    return updatedProduct;
  } catch (err) {
    if (err.code === '23505') {
      throw new ApiError(409, 'Product name or SKU already exists');
    }
    throw err;
  }
};

const removeProduct = async (userId, id, reqContext = null) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const deletedProduct = await productRepository.deleteProduct(id, client);
    if (!deletedProduct) {
      throw new ApiError(404, 'Product not found');
    }
    await auditService.log(userId, 'DELETE', 'products', id, { name: deletedProduct.name }, reqContext);
    await client.query('COMMIT');
    return deletedProduct;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  listProducts,
  getProduct,
  addProduct,
  updateProduct,
  removeProduct,
};
