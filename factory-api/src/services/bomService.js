const manufacturingRepository = require('../repositories/manufacturingRepository');
const pool = require('../db/pool');
const ApiError = require('../utils/ApiError');

const createBom = async (bomData, materials) => {
  if (!materials || materials.length === 0) {
    throw new ApiError(400, 'BOM must contain at least one material.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const bom = await manufacturingRepository.createBom(bomData, materials, client);
    await client.query('COMMIT');
    return bom;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const getBoms = async (productId) => {
  return await manufacturingRepository.getBoms(productId);
};

const getBomById = async (id) => {
  const bom = await manufacturingRepository.getBomById(id);
  if (!bom) throw new ApiError(404, 'BOM not found');
  return bom;
};

module.exports = {
  createBom,
  getBoms,
  getBomById
};
