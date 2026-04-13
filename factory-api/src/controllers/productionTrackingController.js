const productionTrackingService = require('../services/productionTrackingService');

const list = async (req, res, next) => {
  try {
    const data = await productionTrackingService.listProductionOrders(req.query || {});
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const createOrder = async (req, res, next) => {
  try {
    const { model_number: modelNumber, quantity, materials } = req.body;
    const data = await productionTrackingService.createProductionOrder({
      modelNumber,
      quantity,
      materials,
    });
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
};

const addSortingPhase = async (req, res, next) => {
  try {
    const data = await productionTrackingService.addProductionPhase({
      orderId: req.params.id,
      phaseName: productionTrackingService.PHASE_SORTING,
      quantity: req.body.quantity,
      lossReason: req.body.loss_reason,
      employeeId: req.body.employee_id,
      machineId: req.body.machine_id,
      startedAt: req.body.started_at,
      completedAt: req.body.completed_at,
    });
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
};

const addFinalPhase = async (req, res, next) => {
  try {
    const data = await productionTrackingService.addProductionPhase({
      orderId: req.params.id,
      phaseName: productionTrackingService.PHASE_FINAL,
      quantity: req.body.quantity,
      lossReason: req.body.loss_reason,
      employeeId: req.body.employee_id,
      machineId: req.body.machine_id,
      startedAt: req.body.started_at,
      completedAt: req.body.completed_at,
    });
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
};

const listMachines = async (req, res, next) => {
  try {
    const data = await productionTrackingService.listMachines();
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

const getReport = async (req, res, next) => {
  try {
    const data = await productionTrackingService.getProductionOrderReport(req.params.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  list,
  createOrder,
  addSortingPhase,
  addFinalPhase,
  getReport,
  listMachines,
};
