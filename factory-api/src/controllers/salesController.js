const salesService = require('../services/salesService');
const { extractReqContext } = require('../services/auditService');
const { verifyUserPassword } = require('../utils/verifyPassword');

const getCustomers = async (req, res, next) => {
  try {
    const result = await salesService.listCustomers(req.query);
    res.json(result);
  } catch (err) { next(err); }
};

const createCustomer = async (req, res, next) => {
  try {
    const result = await salesService.addCustomer(req.user.id, req.body, extractReqContext(req));
    res.status(201).json(result);
  } catch (err) { next(err); }
};

const getCustomerLedger = async (req, res, next) => {
  try {
    const result = await salesService.getCustomerLedger(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
};

const createCustomerPayment = async (req, res, next) => {
  try {
    const result = await salesService.addCustomerPayment(req.user.id, req.params.id, req.file, req.body, extractReqContext(req));
    res.status(201).json(result);
  } catch (err) { next(err); }
};

const getOrders = async (req, res, next) => {
  try {
    const result = await salesService.listSalesOrders(req.query);
    res.json(result);
  } catch (err) { next(err); }
};

const getOrder = async (req, res, next) => {
  try {
    const result = await salesService.getSalesOrder(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
};

const createOrder = async (req, res, next) => {
  try {
    const result = await salesService.createSalesOrder(req.user.id, req.body, extractReqContext(req));
    res.status(201).json(result);
  } catch (err) { next(err); }
};

const updateStatus = async (req, res, next) => {
  try {
    const result = await salesService.updateOrderStatus(req.user.id, req.params.id, req.body, extractReqContext(req));
    res.json(result);
  } catch (err) { next(err); }
};

const deleteOrder = async (req, res, next) => {
  try {
    await verifyUserPassword(req.user.id, req.body.password);
    const result = await salesService.removeOrder(req.user.id, req.params.id, extractReqContext(req));
    res.json(result);
  } catch (err) { next(err); }
};

const getQuotations = async (req, res, next) => {
  try {
    res.json(await salesService.listQuotations(req.query));
  } catch (err) { next(err); }
};

const createQuotation = async (req, res, next) => {
  try {
    res.status(201).json(await salesService.createQuotation(req.user.id, req.body, extractReqContext(req)));
  } catch (err) { next(err); }
};

const convertQuotation = async (req, res, next) => {
  try {
    res.status(201).json(await salesService.convertQuotationToOrder(req.user.id, req.params.id, extractReqContext(req)));
  } catch (err) { next(err); }
};

const getInvoices = async (req, res, next) => {
  try {
    res.json(await salesService.listInvoices(req.query));
  } catch (err) { next(err); }
};

const createInvoice = async (req, res, next) => {
  try {
    res.status(201).json(await salesService.createInvoiceFromOrder(req.user.id, req.body, extractReqContext(req)));
  } catch (err) { next(err); }
};

const getDeliveryNotes = async (req, res, next) => {
  try {
    res.json(await salesService.listDeliveryNotes(req.query));
  } catch (err) { next(err); }
};

const createDeliveryNote = async (req, res, next) => {
  try {
    res.status(201).json(await salesService.createDeliveryNote(req.user.id, req.body, extractReqContext(req)));
  } catch (err) { next(err); }
};

const getReturns = async (req, res, next) => {
  try {
    res.json(await salesService.listReturns(req.query));
  } catch (err) { next(err); }
};

const createReturn = async (req, res, next) => {
  try {
    res.status(201).json(await salesService.createReturn(req.user.id, req.body, extractReqContext(req)));
  } catch (err) { next(err); }
};

const getCreditNotes = async (req, res, next) => {
  try {
    res.json(await salesService.listCreditNotes(req.query));
  } catch (err) { next(err); }
};

const createCreditNote = async (req, res, next) => {
  try {
    res.status(201).json(await salesService.createCreditNote(req.user.id, req.body, extractReqContext(req)));
  } catch (err) { next(err); }
};

const getOutstandingBalances = async (req, res, next) => {
  try {
    res.json(await salesService.getOutstandingBalances());
  } catch (err) { next(err); }
};

const getAnalytics = async (req, res, next) => {
  try {
    res.json(await salesService.getCustomerAnalytics());
  } catch (err) { next(err); }
};

module.exports = {
  getCustomers,
  createCustomer,
  getCustomerLedger,
  createCustomerPayment,
  getOrders,
  getOrder,
  createOrder,
  updateStatus,
  deleteOrder,
  getQuotations,
  createQuotation,
  convertQuotation,
  getInvoices,
  createInvoice,
  getDeliveryNotes,
  createDeliveryNote,
  getReturns,
  createReturn,
  getCreditNotes,
  createCreditNote,
  getOutstandingBalances,
  getAnalytics,
};
