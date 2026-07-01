const productionTrackingService = require('../services/productionTrackingService');
const auditService = require('../services/auditService');

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
    await auditService.log(req.user.id, 'CREATE', 'production_orders', data.id, { model_number: modelNumber, quantity }, auditService.extractReqContext(req));
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
    await auditService.log(req.user.id, 'CREATE_PHASE', 'production_phases', req.params.id, { phase: 'sorting', quantity: req.body.quantity }, auditService.extractReqContext(req));
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
};

const addOutsourcingPhase = async (req, res, next) => {
  try {
    const data = await productionTrackingService.addProductionPhase({
      orderId: req.params.id,
      phaseName: productionTrackingService.PHASE_OUTSOURCING,
      quantity: req.body.quantity,
      lossReason: req.body.loss_reason,
      employeeId: req.body.employee_id,
      machineId: req.body.machine_id,
      startedAt: req.body.started_at,
      completedAt: req.body.completed_at,
    });
    await auditService.log(req.user.id, 'CREATE_PHASE', 'production_phases', req.params.id, { phase: 'outsourcing', quantity: req.body.quantity }, auditService.extractReqContext(req));
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
    await auditService.log(req.user.id, 'CREATE_PHASE', 'production_phases', req.params.id, { phase: 'final', quantity: req.body.quantity }, auditService.extractReqContext(req));
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

const deleteOrder = async (req, res, next) => {
  try {
    const data = await productionTrackingService.deleteOrder(req.params.id);
    await auditService.log(req.user.id, 'DELETE', 'production_orders', req.params.id, null, auditService.extractReqContext(req));
    res.json(data);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  list,
  createOrder,
  addSortingPhase,
  addOutsourcingPhase,
  addFinalPhase,
  getReport,
  listMachines,
  deleteOrder,
};
