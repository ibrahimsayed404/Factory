const bomService = require('../services/bomService');
const routingService = require('../services/routingService');

// BOMs
const createBom = async (req, res, next) => {
  try {
    const { materials, ...bomData } = req.body;
    const result = await bomService.createBom(bomData, materials);
    res.status(201).json(result);
  } catch (err) { next(err); }
};

const getBoms = async (req, res, next) => {
  try {
    const result = await bomService.getBoms(req.query.product_id);
    res.json(result);
  } catch (err) { next(err); }
};

const getBomById = async (req, res, next) => {
  try {
    const result = await bomService.getBomById(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
};

// Stages
const getProductionStages = async (req, res, next) => {
  try {
    const result = await routingService.getProductionStages();
    res.json(result);
  } catch (err) { next(err); }
};

const createProductionStage = async (req, res, next) => {
  try {
    const result = await routingService.createProductionStage(req.body);
    res.status(201).json(result);
  } catch (err) { next(err); }
};

// Routings
const createRouting = async (req, res, next) => {
  try {
    const { steps, ...routingData } = req.body;
    const result = await routingService.createRouting(routingData, steps);
    res.status(201).json(result);
  } catch (err) { next(err); }
};

const getRoutings = async (req, res, next) => {
  try {
    const result = await routingService.getRoutings(req.query.product_id);
    res.json(result);
  } catch (err) { next(err); }
};

const getRoutingById = async (req, res, next) => {
  try {
    const result = await routingService.getRoutingById(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
};

module.exports = {
  createBom,
  getBoms,
  getBomById,
  getProductionStages,
  createProductionStage,
  createRouting,
  getRoutings,
  getRoutingById
};
