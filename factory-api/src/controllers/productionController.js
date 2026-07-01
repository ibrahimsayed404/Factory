const productionService = require('../services/productionService');

const getAll = async (req, res, next) => {
  try {
    const result = await productionService.getProductionOrders(req.query);
    res.json(result);
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const result = await productionService.getProductionOrderById(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const result = await productionService.createProductionOrder(req.body, req.user.id);
    res.status(201).json(result);
  } catch (err) { next(err); }
};

const updateStatus = async (req, res, next) => {
  try {
    const result = await productionService.updateProductionStatus(req.params.id, req.body);
    res.json(result);
  } catch (err) { next(err); }
};

const completeWorkOrder = async (req, res, next) => {
  try {
    const result = await productionService.completeWorkOrder(req.params.workOrderId, req.body, req.user.id);
    res.json(result);
  } catch (err) { next(err); }
};

module.exports = { getAll, getOne, create, updateStatus, completeWorkOrder };
