const productService = require('../services/productService');
const { extractReqContext } = require('../services/auditService');

const getAll = async (req, res, next) => {
  try {
    const result = await productService.listProducts();
    res.json(result);
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const result = await productService.getProduct(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const result = await productService.addProduct(req.user.id, req.body, extractReqContext(req));
    res.status(201).json(result);
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const result = await productService.updateProduct(req.user.id, req.params.id, req.body, extractReqContext(req));
    res.json(result);
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await productService.removeProduct(req.user.id, req.params.id, extractReqContext(req));
    res.json({ message: 'Product deleted' });
  } catch (err) { next(err); }
};

module.exports = { getAll, getOne, create, update, remove };
