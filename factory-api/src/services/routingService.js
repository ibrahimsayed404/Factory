const manufacturingRepository = require('../repositories/manufacturingRepository');
const pool = require('../db/pool');
const ApiError = require('../utils/ApiError');

// =======================
// STAGES
// =======================
const getProductionStages = async () => {
  return await manufacturingRepository.getProductionStages();
};

const createProductionStage = async (stageData) => {
  if (!stageData.name) throw new ApiError(400, 'Stage name is required');
  return await manufacturingRepository.createProductionStage(stageData);
};

// =======================
// ROUTINGS
// =======================
const createRouting = async (routingData, steps) => {
  if (!steps || steps.length === 0) {
    throw new ApiError(400, 'Routing must contain at least one step.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const routing = await manufacturingRepository.createRouting(routingData, steps, client);
    await client.query('COMMIT');
    return routing;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const getRoutings = async (productId) => {
  return await manufacturingRepository.getRoutings(productId);
};

const getRoutingById = async (id) => {
  const routing = await manufacturingRepository.getRoutingById(id);
  if (!routing) throw new ApiError(404, 'Routing not found');
  return routing;
};

module.exports = {
  getProductionStages,
  createProductionStage,
  createRouting,
  getRoutings,
  getRoutingById
};
