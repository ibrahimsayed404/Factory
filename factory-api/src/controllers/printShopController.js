const printShopService = require('../services/printShopService');

const list = async (req, res, next) => {
  try {
    const shops = await printShopService.listPrintShops();
    res.json(shops);
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const shop = await printShopService.getPrintShopById(req.params.id);
    res.json(shop);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const shop = await printShopService.createPrintShop(req.body);
    res.status(201).json(shop);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const shop = await printShopService.updatePrintShop(req.params.id, req.body);
    res.json(shop);
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await printShopService.deletePrintShop(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
};
