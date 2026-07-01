const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const pool = require('../db/pool');
const salesRepository = require('../repositories/salesRepository');
const auditService = require('./auditService');
const inventoryService = require('./inventoryService');
const accountingService = require('./accountingService');
const productionTrackingService = require('./productionTrackingService');
const ApiError = require('../utils/ApiError');

const buildOrderNumber = (prefix) => {
  const ts = Date.now().toString().slice(-8);
  const rand = randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${ts}-${rand}`;
};

const round2 = (value) => Number(Number(value || 0).toFixed(2));

const paginate = ({ page, limit }) => {
  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const pageSize = Math.min(1000, Math.max(1, Number.parseInt(limit, 10) || 50));
  return { pageNum, pageSize, offset: (pageNum - 1) * pageSize };
};

const recalculateCustomerOrderBalances = async (client, customerId) => {
  const totalPaid = await salesRepository.getCustomerPayments(client, customerId);
  let remainingCredit = Number(totalPaid);
  const orders = await salesRepository.getCustomerOrders(client, customerId);

  for (const order of orders) {
    const totalAmount = Number(order.total_amount || 0);
    const appliedAmount = Math.max(0, Math.min(totalAmount, remainingCredit));
    remainingCredit -= appliedAmount;

    let paymentStatus = 'pending';
    if (appliedAmount >= totalAmount && totalAmount > 0) paymentStatus = 'paid';
    else if (appliedAmount > 0) paymentStatus = 'invoiced';

    await salesRepository.updateOrderPaymentStatus(client, order.id, appliedAmount, paymentStatus);
  }
};

const createProductionOrderForItem = async (client, salesOrder, item, notes) => {
  for (let i = 0; i < 5; i += 1) {
    try {
      return await productionTrackingService.createProductionOrder({
        modelNumber: item.product_name,
        quantity: item.quantity,
        product_id: item.product_id || null,
        materials: [],
        salesOrderId: salesOrder.id,
        deliveryDate: salesOrder.delivery_date || null,
        notes,
        client,
      });
    } catch (err) {
      if (err.code !== '23505') throw err;
    }
  }
  throw new ApiError(500, 'Could not generate unique production order number');
};

const prepareSalesItems = async (client, items) => {
  if (!Array.isArray(items) || !items.length) throw new ApiError(400, 'Sales order must have items');
  const prepared = [];
  const requirements = new Map();

  for (const raw of items) {
    const quantity = Number(raw.quantity || 0);
    const unitPrice = Number(raw.unit_price || 0);
    if (quantity <= 0) throw new ApiError(400, 'Item quantity must be positive');
    if (unitPrice < 0) throw new ApiError(400, 'Item unit price must be >= 0');

    let product = null;
    if (raw.product_id) {
      product = await salesRepository.getProductByIdForUpdate(client, raw.product_id);
      if (!product) throw new ApiError(400, `Invalid product_id: ${raw.product_id}`);
    } else if (raw.product_name) {
      product = await salesRepository.getProductByNameForUpdate(client, raw.product_name);
    }

    const item = {
      product_id: product?.id || raw.product_id || null,
      product_name: raw.product_name || product?.name,
      quantity,
      unit_price: unitPrice,
      make_to_order: raw.make_to_order === true,
    };
    if (!item.product_name) throw new ApiError(400, 'product_name is required');
    prepared.push(item);

    if (product && !item.make_to_order) {
      const current = requirements.get(product.id) || { product, quantity: 0 };
      current.quantity += quantity;
      requirements.set(product.id, current);
    }
  }

  for (const { product, quantity } of requirements.values()) {
    const reserved = await salesRepository.getProductReservedQuantityForUpdate(client, product.id);
    const available = Number(product.quantity || 0) - reserved;
    if (available < quantity) {
      throw new ApiError(400, `Insufficient stock for ${product.name}. Required ${quantity}, available ${available}`);
    }
  }

  return prepared;
};

const releaseOrderReservations = async (client, order, items, userId) => {
  for (const item of items) {
    if (!item.product_id) continue;
    const reserved = await salesRepository.getProductReservedForOrder(client, order.id, item.product_id);
    if (reserved > 0) {
      await inventoryService.releaseReservation({
        item_type: 'product',
        item_id: item.product_id,
        warehouse_id: 1,
        location_id: 1,
        quantity: reserved,
        reference_type: 'sales_order',
        reference_id: order.id,
        user_id: userId,
        notes: `Released reservation for sales order ${order.order_number}`,
      }, client);
    }
  }
};

const issueOrderStock = async (client, order, items, userId) => {
  for (const item of items) {
    if (!item.product_id) continue;
    const quantity = Number(item.quantity || 0);
    const product = await salesRepository.getProductByIdForUpdate(client, item.product_id);
    const ownReserved = Math.max(0, await salesRepository.getProductReservedForOrder(client, order.id, item.product_id));
    const totalReserved = await salesRepository.getProductReservedQuantityForUpdate(client, item.product_id);
    const unreservedNeeded = Math.max(0, quantity - ownReserved);
    const availableOutsideReservations = Number(product.quantity || 0) - totalReserved;

    if (availableOutsideReservations < unreservedNeeded) {
      throw new ApiError(400, `Insufficient stock for ${product.name}. Required ${quantity}, available ${availableOutsideReservations + ownReserved}`);
    }

    if (ownReserved > 0) {
      await inventoryService.releaseReservation({
        item_type: 'product',
        item_id: item.product_id,
        warehouse_id: 1,
        location_id: 1,
        quantity: Math.min(quantity, ownReserved),
        reference_type: 'sales_order',
        reference_id: order.id,
        user_id: userId,
        notes: `Released reservation for sales order ${order.order_number}`,
      }, client);
    }

    await inventoryService.issueStock({
      item_type: 'product',
      item_id: item.product_id,
      warehouse_id: 1,
      location_id: 1,
      quantity,
      reference_type: 'sales_order',
      reference_id: order.id,
      user_id: userId,
      notes: `Sales order ${order.order_number} shipped`,
    }, client);
  }
};

const listCustomers = async ({ page, limit }) => {
  const { pageNum, pageSize, offset } = paginate({ page, limit });
  const total = await salesRepository.getCustomersCount();
  const data = await salesRepository.getCustomers({ limit: pageSize, offset });
  return { data, total, page: pageNum, limit: pageSize };
};

const addCustomer = async (userId, data, reqContext = null) => {
  const newCustomer = await salesRepository.createCustomer(data);
  await auditService.log(userId, 'CREATE', 'customers', newCustomer.id, { name: data.name, email: data.email }, reqContext);
  return newCustomer;
};

const getCustomerLedger = async (id) => {
  const customer = await salesRepository.getCustomerById(id);
  if (!customer) throw new ApiError(404, 'Customer not found');

  const { orders, invoices, payments, returns, credits, summary: totals } = await salesRepository.getCustomerLedgerDetails(id);
  const totalOrdered = Number(totals.total_ordered || 0);
  const totalInvoiced = Number(totals.total_invoiced || 0);
  const totalPaid = Number(totals.total_paid || 0);
  const totalCredited = Number(totals.total_credited || 0);
  const billableTotal = totalInvoiced > 0 ? totalInvoiced - totalCredited : totalOrdered;
  const remainingBalance = Math.max(0, billableTotal - totalPaid);
  const creditBalance = Math.max(0, totalPaid - billableTotal);

  return {
    customer,
    summary: {
      total_ordered: totalOrdered,
      total_invoiced: totalInvoiced,
      delivered_value: Number(totals.delivered_value || 0),
      applied_paid: Number(totals.applied_paid || 0),
      total_paid: totalPaid,
      total_returned: Number(totals.total_returned || 0),
      total_credited: totalCredited,
      total_products: Number(totals.total_products || 0),
      remaining_balance: remainingBalance,
      credit_balance: creditBalance,
    },
    orders,
    invoices,
    payments,
    returns,
    credits,
  };
};

const addCustomerPayment = async (userId, customerId, file, data, reqContext = null) => {
  const client = await pool.connect();
  const uploadedFilePath = file ? file.path : null;
  try {
    await client.query('BEGIN');

    const customer = await salesRepository.getCustomerById(customerId, client);
    if (!customer) throw new ApiError(404, 'Customer not found');

    const evidenceUrl = file ? `/api/uploads/payment-evidence/${file.filename}` : null;
    const evidenceName = file ? file.originalname : null;
    const evidenceMime = file ? file.mimetype : null;

    const newPayment = await salesRepository.insertCustomerPayment(client, {
      customerId,
      invoiceId: data.invoice_id,
      payment_date: data.payment_date,
      amount: data.amount,
      payment_method: data.payment_method,
      reference_number: data.reference_number,
      notes: data.notes,
      evidenceUrl,
      evidenceName,
      evidenceMime,
      created_by: userId,
    });

    let remaining = Number(data.amount || 0);
    const invoices = await salesRepository.getOpenInvoicesForCustomer(client, customerId, data.invoice_id);
    if (data.invoice_id && !invoices.length) throw new ApiError(400, 'Invoice not found or already settled');
    for (const invoice of invoices) {
      if (remaining <= 0) break;
      const outstanding = Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0) - Number(invoice.credited_amount || 0);
      const applied = Math.min(outstanding, remaining);
      if (applied <= 0) continue;
      await salesRepository.insertPaymentAllocation(client, newPayment.id, invoice.id, applied);
      await salesRepository.incrementInvoicePaid(client, invoice.id, applied);
      remaining -= applied;
    }

    await recalculateCustomerOrderBalances(client, customerId);
    await accountingService.postCustomerPayment(newPayment, client);
    await auditService.log(userId, 'CREATE', 'customer_payments', newPayment.id, { amount: data.amount }, reqContext);
    await client.query('COMMIT');

    return newPayment;
  } catch (err) {
    await client.query('ROLLBACK');
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      try { fs.unlinkSync(uploadedFilePath); } catch (unlinkErr) { console.warn('Failed to remove uploaded evidence:', unlinkErr.message); }
    }
    throw err;
  } finally {
    client.release();
  }
};

const listSalesOrders = async ({ status, payment_status, customer_id, page, limit }) => {
  const { pageNum, pageSize, offset } = paginate({ page, limit });
  const total = await salesRepository.getSalesOrdersCount({ status, payment_status, customer_id });
  const data = await salesRepository.getSalesOrders({ status, payment_status, customer_id, limit: pageSize, offset });
  return { data, total, page: pageNum, limit: pageSize };
};

const getSalesOrder = async (id) => {
  const order = await salesRepository.getSalesOrderById(id);
  if (!order) throw new ApiError(404, 'Order not found');
  const items = await salesRepository.getSalesOrderItems(id);
  return { ...order, items };
};

const createSalesOrder = async (userId, data, reqContext = null) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { customer_id, delivery_date, notes, items = [] } = data;
    const preparedItems = await prepareSalesItems(client, items);
    const subtotal = round2(preparedItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0));
    const discountAmount = round2(data.discount_amount || 0);
    const taxAmount = round2(data.tax_amount || 0);
    const total = round2(subtotal - discountAmount + taxAmount);

    let order = null;
    for (let i = 0; i < 5; i += 1) {
      try {
        order = await salesRepository.createSalesOrderRecord(client, {
          orderNum: buildOrderNumber('SO'),
          quotation_id: data.quotation_id,
          customer_id,
          delivery_date,
          notes,
          created_by: userId,
          subtotal,
          discount_amount: discountAmount,
          tax_amount: taxAmount,
          total_amount: total,
        });
        break;
      } catch (err) {
        if (err.code !== '23505') throw err;
      }
    }
    if (!order) throw new ApiError(500, 'Could not generate unique sales order number');

    for (const item of preparedItems) {
      await salesRepository.insertSalesOrderItem(client, {
        sales_order_id: order.id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        product_id: item.product_id,
      });

      if (item.product_id && !item.make_to_order) {
        await inventoryService.reserveStock({
          item_type: 'product',
          item_id: item.product_id,
          warehouse_id: 1,
          location_id: 1,
          quantity: item.quantity,
          reference_type: 'sales_order',
          reference_id: order.id,
          user_id: userId,
          notes: `Reserved for sales order ${order.order_number}`,
        }, client);
      } else {
        await createProductionOrderForItem(client, order, item, `Auto-created from sales order ${order.order_number}`);
      }
    }

    await salesRepository.markSalesOrderReserved(client, order.id);
    if (customer_id) await recalculateCustomerOrderBalances(client, customer_id);
    await auditService.log(userId, 'CREATE', 'sales_orders', order.id, { order_number: order.order_number, total }, reqContext);
    await client.query('COMMIT');

    return { ...order, subtotal, discount_amount: discountAmount, tax_amount: taxAmount, total_amount: total };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const updateOrderStatus = async (userId, id, data, reqContext = null) => {
  const { status, payment_status, paid_amount } = data;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const order = await salesRepository.getSalesOrderById(id, client);
    if (!order) throw new ApiError(404, 'Order not found');
    const items = await salesRepository.getSalesOrderItems(id, client);

    const isShipping = status === 'shipped' || status === 'delivered';
    const wasNotShipped = order.status !== 'shipped' && order.status !== 'delivered';
    if (isShipping && wasNotShipped) await issueOrderStock(client, order, items, userId);
    if (status === 'cancelled' && order.status !== 'cancelled') await releaseOrderReservations(client, order, items, userId);

    const result = await salesRepository.updateSalesOrderStatus(id, status, payment_status, paid_amount, client);
    await auditService.log(userId, 'UPDATE_STATUS', 'sales_orders', id, { status, payment_status, paid_amount }, reqContext);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const removeOrder = async (userId, id, reqContext = null) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const order = await salesRepository.getSalesOrderById(id, client);
    if (!order) throw new ApiError(404, 'Order not found');
    if (order.payment_status === 'paid' || order.status === 'shipped' || order.status === 'delivered') {
      throw new ApiError(400, 'Cannot delete a paid or shipped order');
    }

    const items = await salesRepository.getSalesOrderItems(id, client);
    await releaseOrderReservations(client, order, items, userId);
    await salesRepository.deleteSalesOrderItems(client, id);
    await salesRepository.deleteSalesOrderRecord(client, id);

    await auditService.log(userId, 'DELETE', 'sales_orders', id, null, reqContext);
    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const listQuotations = async ({ status, customer_id, page, limit }) => {
  const { pageNum, pageSize, offset } = paginate({ page, limit });
  const total = await salesRepository.getQuotationsCount({ status, customer_id });
  const data = await salesRepository.getQuotations({ status, customer_id, limit: pageSize, offset });
  return { data, total, page: pageNum, limit: pageSize };
};

const createQuotation = async (userId, data, reqContext = null) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const items = await prepareSalesItems(client, data.items || []);
    const subtotal = round2(items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0));
    const discountAmount = round2(data.discount_amount || 0);
    const taxAmount = round2(data.tax_amount || 0);
    const total = round2(subtotal - discountAmount + taxAmount);

    let quotation = null;
    for (let i = 0; i < 5; i += 1) {
      try {
        quotation = await salesRepository.createQuotationRecord(client, {
          quotation_number: buildOrderNumber('QT'),
          customer_id: data.customer_id,
          valid_until: data.valid_until,
          subtotal,
          discount_amount: discountAmount,
          tax_amount: taxAmount,
          total_amount: total,
          status: data.status || 'draft',
          notes: data.notes,
          created_by: userId,
        });
        break;
      } catch (err) {
        if (err.code !== '23505') throw err;
      }
    }
    if (!quotation) throw new ApiError(500, 'Could not generate unique quotation number');

    for (const item of items) {
      await salesRepository.insertQuotationItem(client, { ...item, quotation_id: quotation.id });
    }
    await auditService.log(userId, 'CREATE', 'quotations', quotation.id, { quotation_number: quotation.quotation_number, total }, reqContext);
    await client.query('COMMIT');
    return { ...quotation, items };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const convertQuotationToOrder = async (userId, id, reqContext = null) => {
  const quotation = await salesRepository.getQuotationById(id);
  if (!quotation) throw new ApiError(404, 'Quotation not found');
  const items = await salesRepository.getQuotationItems(id);
  const order = await createSalesOrder(userId, {
    quotation_id: quotation.id,
    customer_id: quotation.customer_id,
    delivery_date: null,
    notes: quotation.notes,
    discount_amount: quotation.discount_amount,
    tax_amount: quotation.tax_amount,
    items: items.map((item) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
    })),
  }, reqContext);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await salesRepository.updateQuotationStatus(client, id, 'converted');
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return order;
};

const listInvoices = async ({ status, customer_id, page, limit }) => {
  const { pageNum, pageSize, offset } = paginate({ page, limit });
  const total = await salesRepository.getInvoicesCount({ status, customer_id });
  const data = await salesRepository.getInvoices({ status, customer_id, limit: pageSize, offset });
  return { data, total, page: pageNum, limit: pageSize };
};

const createInvoiceFromOrder = async (userId, data, reqContext = null) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const order = await salesRepository.getSalesOrderById(data.sales_order_id, client);
    if (!order) throw new ApiError(404, 'Sales order not found');
    if (order.status === 'cancelled') throw new ApiError(400, 'Cannot invoice a cancelled order');
    const items = await salesRepository.getSalesOrderItems(order.id, client);
    if (!items.length) throw new ApiError(400, 'Sales order has no items');

    const customer = order.customer_id ? await salesRepository.getCustomerById(order.customer_id, client) : null;
    const invoiceDate = data.invoice_date || new Date().toISOString().slice(0, 10);
    const dueDate = data.due_date || (() => {
      const d = new Date(`${invoiceDate}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + Number(customer?.payment_terms_days || 30));
      return d.toISOString().slice(0, 10);
    })();

    let invoice = null;
    for (let i = 0; i < 5; i += 1) {
      try {
        invoice = await salesRepository.createInvoiceRecord(client, {
          invoice_number: buildOrderNumber('INV'),
          sales_order_id: order.id,
          customer_id: order.customer_id,
          invoice_date: invoiceDate,
          due_date: dueDate,
          subtotal: order.subtotal || order.total_amount,
          discount_amount: order.discount_amount || 0,
          tax_amount: order.tax_amount || 0,
          total_amount: order.total_amount,
          status: 'issued',
          notes: data.notes || order.notes,
          created_by: userId,
        });
        break;
      } catch (err) {
        if (err.code !== '23505') throw err;
      }
    }
    if (!invoice) throw new ApiError(500, 'Could not generate unique invoice number');

    for (const item of items) {
      await salesRepository.insertInvoiceItem(client, {
        invoice_id: invoice.id,
        sales_order_item_id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
      });
    }
    await salesRepository.updateSalesOrderStatus(order.id, null, 'invoiced', null, client);
    await accountingService.postSalesInvoice(invoice, client);
    await auditService.log(userId, 'CREATE', 'invoices', invoice.id, { invoice_number: invoice.invoice_number }, reqContext);
    await client.query('COMMIT');
    return { ...invoice, items };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const listDeliveryNotes = async ({ status, customer_id, page, limit }) => {
  const { pageNum, pageSize, offset } = paginate({ page, limit });
  const total = await salesRepository.getDeliveryNotesCount({ status, customer_id });
  const data = await salesRepository.getDeliveryNotes({ status, customer_id, limit: pageSize, offset });
  return { data, total, page: pageNum, limit: pageSize };
};

const createDeliveryNote = async (userId, data, reqContext = null) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const order = await salesRepository.getSalesOrderById(data.sales_order_id, client);
    if (!order) throw new ApiError(404, 'Sales order not found');
    const orderItems = await salesRepository.getSalesOrderItems(order.id, client);
    const requested = Array.isArray(data.items) && data.items.length
      ? data.items
      : orderItems.map((item) => ({ sales_order_item_id: item.id, quantity: Number(item.quantity) - Number(item.fulfilled_quantity || 0) }));
    const deliveryItems = [];

    for (const reqItem of requested) {
      const source = orderItems.find((item) => item.id === Number(reqItem.sales_order_item_id));
      if (!source) throw new ApiError(400, `Invalid sales_order_item_id: ${reqItem.sales_order_item_id}`);
      const qty = Number(reqItem.quantity || 0);
      const remaining = Number(source.quantity || 0) - Number(source.fulfilled_quantity || 0);
      if (qty <= 0 || qty > remaining) throw new ApiError(400, `Invalid delivery quantity for ${source.product_name}`);
      deliveryItems.push({ ...source, quantity: qty });
    }

    await issueOrderStock(client, order, deliveryItems, userId);

    let delivery = null;
    for (let i = 0; i < 5; i += 1) {
      try {
        delivery = await salesRepository.createDeliveryNoteRecord(client, {
          delivery_number: buildOrderNumber('DN'),
          sales_order_id: order.id,
          customer_id: order.customer_id,
          delivery_date: data.delivery_date,
          status: 'delivered',
          notes: data.notes,
          created_by: userId,
        });
        break;
      } catch (err) {
        if (err.code !== '23505') throw err;
      }
    }
    if (!delivery) throw new ApiError(500, 'Could not generate unique delivery number');

    for (const item of deliveryItems) {
      await salesRepository.insertDeliveryNoteItem(client, {
        delivery_note_id: delivery.id,
        sales_order_item_id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
      });
      await salesRepository.incrementSalesOrderItemFulfilled(client, item.id, item.quantity);
    }
    await salesRepository.updateSalesOrderFulfillmentStatus(client, order.id);
    await auditService.log(userId, 'CREATE', 'delivery_notes', delivery.id, { delivery_number: delivery.delivery_number }, reqContext);
    await client.query('COMMIT');
    return { ...delivery, items: deliveryItems };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const listReturns = async ({ status, customer_id, page, limit }) => {
  const { pageNum, pageSize, offset } = paginate({ page, limit });
  const total = await salesRepository.getReturnsCount({ status, customer_id });
  const data = await salesRepository.getReturns({ status, customer_id, limit: pageSize, offset });
  return { data, total, page: pageNum, limit: pageSize };
};

const createReturn = async (userId, data, reqContext = null) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const order = await salesRepository.getSalesOrderById(data.sales_order_id, client);
    if (!order) throw new ApiError(404, 'Sales order not found');
    const orderItems = await salesRepository.getSalesOrderItems(order.id, client);
    const returnItems = [];
    let total = 0;
    for (const reqItem of data.items || []) {
      const source = orderItems.find((item) => item.id === Number(reqItem.sales_order_item_id));
      if (!source) throw new ApiError(400, `Invalid sales_order_item_id: ${reqItem.sales_order_item_id}`);
      const qty = Number(reqItem.quantity || 0);
      const returnable = Number(source.fulfilled_quantity || 0) - Number(source.returned_quantity || 0);
      if (qty <= 0 || qty > returnable) throw new ApiError(400, `Invalid return quantity for ${source.product_name}`);
      const unitPrice = Number(reqItem.unit_price || source.unit_price || 0);
      total += qty * unitPrice;
      returnItems.push({ ...source, quantity: qty, unit_price: unitPrice, restock: reqItem.restock !== false });
    }
    if (!returnItems.length) throw new ApiError(400, 'Return must include items');

    let salesReturn = null;
    for (let i = 0; i < 5; i += 1) {
      try {
        salesReturn = await salesRepository.createReturnRecord(client, {
          return_number: buildOrderNumber('SR'),
          sales_order_id: order.id,
          invoice_id: data.invoice_id,
          customer_id: order.customer_id,
          return_date: data.return_date,
          total_amount: round2(total),
          status: 'received',
          reason: data.reason,
          notes: data.notes,
          created_by: userId,
        });
        break;
      } catch (err) {
        if (err.code !== '23505') throw err;
      }
    }
    if (!salesReturn) throw new ApiError(500, 'Could not generate unique return number');

    for (const item of returnItems) {
      await salesRepository.insertReturnItem(client, {
        sales_return_id: salesReturn.id,
        sales_order_item_id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        restock: item.restock,
      });
      await salesRepository.incrementSalesOrderItemReturned(client, item.id, item.quantity);
      if (item.restock && item.product_id) {
        await inventoryService.receiveStock({
          item_type: 'product',
          item_id: item.product_id,
          warehouse_id: 1,
          location_id: 1,
          quantity: item.quantity,
          reference_type: 'sales_return',
          reference_id: salesReturn.id,
          user_id: userId,
          notes: `Returned from sales order ${order.order_number}`,
        }, client);
      }
    }
    await accountingService.postSalesCredit(salesReturn, client);
    await auditService.log(userId, 'CREATE', 'sales_returns', salesReturn.id, { return_number: salesReturn.return_number }, reqContext);
    await client.query('COMMIT');
    return { ...salesReturn, items: returnItems };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const listCreditNotes = async ({ status, customer_id, page, limit }) => {
  const { pageNum, pageSize, offset } = paginate({ page, limit });
  const total = await salesRepository.getCreditNotesCount({ status, customer_id });
  const data = await salesRepository.getCreditNotes({ status, customer_id, limit: pageSize, offset });
  return { data, total, page: pageNum, limit: pageSize };
};

const createCreditNote = async (userId, data, reqContext = null) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const items = data.sales_return_id
      ? await salesRepository.getReturnItems(data.sales_return_id, client)
      : data.items || [];
    const sourceReturn = data.sales_return_id ? await salesRepository.getReturnById(data.sales_return_id, client) : null;
    if (!items.length) throw new ApiError(400, 'Credit note must include items');
    const total = round2(items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0));
    let credit = null;
    for (let i = 0; i < 5; i += 1) {
      try {
        credit = await salesRepository.createCreditNoteRecord(client, {
          credit_note_number: buildOrderNumber('CN'),
          customer_id: data.customer_id || sourceReturn?.customer_id,
          invoice_id: data.invoice_id || sourceReturn?.invoice_id,
          sales_return_id: data.sales_return_id || null,
          credit_date: data.credit_date,
          total_amount: total,
          applied_amount: data.invoice_id || sourceReturn?.invoice_id ? total : 0,
          status: 'issued',
          reason: data.reason || sourceReturn?.reason,
          notes: data.notes,
          created_by: userId,
        });
        break;
      } catch (err) {
        if (err.code !== '23505') throw err;
      }
    }
    if (!credit) throw new ApiError(500, 'Could not generate unique credit note number');

    for (const item of items) {
      await salesRepository.insertCreditNoteItem(client, {
        credit_note_id: credit.id,
        product_id: item.product_id || null,
        description: item.description || item.product_name || 'Credit',
        quantity: item.quantity,
        unit_price: item.unit_price,
      });
    }
    if (credit.invoice_id) await salesRepository.incrementInvoiceCredited(client, credit.invoice_id, total);
    await accountingService.postSalesCredit(credit, client);
    await auditService.log(userId, 'CREATE', 'credit_notes', credit.id, { credit_note_number: credit.credit_note_number }, reqContext);
    await client.query('COMMIT');
    return { ...credit, items };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const getOutstandingBalances = () => salesRepository.getOutstandingBalances();
const getCustomerAnalytics = () => salesRepository.getCustomerAnalytics();

module.exports = {
  listCustomers,
  addCustomer,
  getCustomerLedger,
  addCustomerPayment,
  listSalesOrders,
  getSalesOrder,
  createSalesOrder,
  updateOrderStatus,
  removeOrder,
  listQuotations,
  createQuotation,
  convertQuotationToOrder,
  listInvoices,
  createInvoiceFromOrder,
  listDeliveryNotes,
  createDeliveryNote,
  listReturns,
  createReturn,
  listCreditNotes,
  createCreditNote,
  getOutstandingBalances,
  getCustomerAnalytics,
};
