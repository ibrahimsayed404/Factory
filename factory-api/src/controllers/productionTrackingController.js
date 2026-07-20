const productionTrackingService = require('../services/productionTrackingService');
const auditService = require('../services/auditService');
const { verifyUserPassword } = require('../utils/verifyPassword');

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
    const { model_number: modelNumber, product_name: productName, product_id: productId, quantity, materials, color_breakdown: colorBreakdown } = req.body;
    const data = await productionTrackingService.createProductionOrder({
      modelNumber,
      productName,
      product_id: productId,
      quantity,
      materials,
      colorBreakdown,
    });
    await auditService.log(req.user.id, 'CREATE', 'production_orders', data.id, { model_number: modelNumber, product_name: productName, quantity, color_breakdown: colorBreakdown }, auditService.extractReqContext(req));
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
      colorBreakdown: req.body.color_breakdown,
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
      colorBreakdown: req.body.color_breakdown,
      lossReason: req.body.loss_reason,
      employeeId: req.body.employee_id,
      partnerFactoryId: req.body.partner_factory_id,
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
      colorBreakdown: req.body.color_breakdown,
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

const listPartnerFactories = async (req, res, next) => {
  try {
    const data = await productionTrackingService.listPartnerFactories();
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

const createPartnerFactory = async (req, res, next) => {
  try {
    const data = await productionTrackingService.createPartnerFactory({
      name: req.body.name,
      code: req.body.code,
      contactPerson: req.body.contact_person,
      phone: req.body.phone,
      notes: req.body.notes,
    });
    await auditService.log(req.user.id, 'CREATE', 'partner_factories', data.id, { name: data.name }, auditService.extractReqContext(req));
    res.status(201).json(data);
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
    const password = req.body?.password || req.query?.password || req.headers['x-confirm-password'] || req.headers['x-password'];
    await verifyUserPassword(req.user.id, password);
    const data = await productionTrackingService.deleteOrder(req.params.id, { force: true });
    await auditService.log(req.user.id, 'DELETE', 'production_orders', req.params.id, { order_number: data.order_number }, auditService.extractReqContext(req));
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
  listPartnerFactories,
  createPartnerFactory,
  deleteOrder,
};
