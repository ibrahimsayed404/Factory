const productionCycleService = require('./productionCycle.service');

const listOrders = async (req, res, next) => {
  try {
    const orders = await productionCycleService.listProductionOrders(req.query);
    res.json(orders);
  } catch (err) {
    next(err);
  }
};

const getOrder = async (req, res, next) => {
  try {
    const order = await productionCycleService.getProductionOrderById(req.params.id);
    res.json(order);
  } catch (err) {
    next(err);
  }
};

const createCuttingOrder = async (req, res, next) => {
  try {
    const { modelNumber, orderName, colors, notes } = req.body;
    const order = await productionCycleService.createCuttingOrder({
      modelNumber,
      orderName,
      colors,
      notes,
      userId: req.user?.id,
    });
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
};

const submitSortingPhase = async (req, res, next) => {
  try {
    const { colors, sorting_notes, next_action } = req.body;
    const order = await productionCycleService.submitSortingPhase(req.params.id, {
      colors,
      sorting_notes,
      next_action,
    });
    res.json(order);
  } catch (err) {
    next(err);
  }
};

const sendToPrint = async (req, res, next) => {
  try {
    const { print_shop_id, colors, print_notes, sent_at } = req.body;
    const order = await productionCycleService.sendToPrintShop(req.params.id, {
      print_shop_id,
      colors,
      print_notes,
      sent_at,
    });
    res.json(order);
  } catch (err) {
    next(err);
  }
};

const receiveFromPrint = async (req, res, next) => {
  try {
    const { colors, print_notes, received_at } = req.body;
    const order = await productionCycleService.receiveFromPrintShop(req.params.id, {
      colors,
      print_notes,
      received_at,
    });
    res.json(order);
  } catch (err) {
    next(err);
  }
};

const submitMachinesPhase = async (req, res, next) => {
  try {
    const { colors, machine_notes, completed_at } = req.body;
    const order = await productionCycleService.submitMachinesPhase(req.params.id, {
      colors,
      machine_notes,
      completed_at,
    });
    res.json(order);
  } catch (err) {
    next(err);
  }
};

const skipPrint = async (req, res, next) => {
  try {
    const order = await productionCycleService.skipPrint(req.params.id);
    res.json(order);
  } catch (err) {
    next(err);
  }
};

const deliverToCustomer = async (req, res, next) => {
  try {
    const { customer_id, unit_price, delivery_notes, delivered_at } = req.body;
    const order = await productionCycleService.deliverToCustomer(req.params.id, {
      customer_id,
      unit_price,
      delivery_notes,
      delivered_at,
      user_id: req.user?.id,
    });
    res.json(order);
  } catch (err) {
    next(err);
  }
};

const deleteOrder = async (req, res, next) => {
  try {
    const result = await productionCycleService.deleteProductionOrder(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getKPIs = async (req, res, next) => {
  try {
    const kpis = await productionCycleService.getProductionKPIs();
    res.json(kpis);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listOrders,
  getOrder,
  createCuttingOrder,
  submitSortingPhase,
  sendToPrint,
  receiveFromPrint,
  skipPrint,
  submitMachinesPhase,
  deliverToCustomer,
  deleteOrder,
  getKPIs,
};
