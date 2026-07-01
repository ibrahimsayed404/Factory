const pool = require('../db/pool');

const queryWithPagination = async (baseQuery, filters, orderBy, { limit, offset }, client = pool) => {
  const params = [];
  let query = baseQuery;

  for (const filter of filters) {
    if (filter.value !== undefined && filter.value !== null && filter.value !== '') {
      params.push(filter.value);
      query += ` AND ${filter.sql} $${params.length}`;
    }
  }

  const dataParams = [...params, limit, offset];
  query += ` ${orderBy} LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`;
  const result = await client.query(query, dataParams);
  return result.rows;
};

const countRows = async (baseQuery, filters, client = pool) => {
  const params = [];
  let query = baseQuery;

  for (const filter of filters) {
    if (filter.value !== undefined && filter.value !== null && filter.value !== '') {
      params.push(filter.value);
      query += ` AND ${filter.sql} $${params.length}`;
    }
  }

  const result = await client.query(query, params);
  return Number.parseInt(result.rows[0].count, 10);
};

const getCustomerPayments = async (client, customerId) => {
  const result = await client.query(
    `SELECT COALESCE(SUM(amount), 0)::float AS total
     FROM customer_payments
     WHERE customer_id = $1`,
    [customerId]
  );
  return result.rows[0]?.total || 0;
};

const getCustomerOrders = async (client, customerId) => {
  const result = await client.query(
    `SELECT id, total_amount, status
     FROM sales_orders
     WHERE customer_id = $1
       AND status != 'cancelled'
     ORDER BY order_date ASC, id ASC`,
    [customerId]
  );
  return result.rows;
};

const updateOrderPaymentStatus = async (client, id, appliedAmount, paymentStatus) => {
  await client.query(
    `UPDATE sales_orders
     SET paid_amount = $1,
         payment_status = $2,
         updated_at = NOW()
     WHERE id = $3`,
    [appliedAmount, paymentStatus, id]
  );
};

const createProductionOrder = async (client, orderNum, productName, quantity, salesOrderId, deliveryDate, notes, productId = null) => {
  const result = await client.query(
    `INSERT INTO production_orders
     (order_number, product_name, quantity, sales_order_id, assigned_to, due_date, notes, product_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [orderNum, productName, quantity, salesOrderId, null, deliveryDate, notes, productId]
  );
  return result.rows[0];
};

const getCustomersCount = async () => {
  const result = await pool.query('SELECT COUNT(*) FROM customers');
  return Number.parseInt(result.rows[0].count, 10);
};

const getCustomers = async ({ limit, offset }) => {
  const result = await pool.query(
    `SELECT
       c.*,
       COALESCE(so.total_ordered, 0)::float AS total_ordered,
       COALESCE(inv.total_invoiced, 0)::float AS total_invoiced,
       COALESCE(cp.total_paid, 0)::float AS total_paid,
       COALESCE(cn.total_credited, 0)::float AS total_credited,
       GREATEST(
         CASE WHEN COALESCE(inv.total_invoiced, 0) > 0
           THEN COALESCE(inv.total_invoiced, 0) - COALESCE(cp.total_paid, 0) - COALESCE(cn.total_credited, 0)
           ELSE COALESCE(so.total_ordered, 0) - COALESCE(cp.total_paid, 0)
         END,
         0
       )::float AS remaining_balance,
       GREATEST(
         COALESCE(cp.total_paid, 0) + COALESCE(cn.total_credited, 0) -
         CASE WHEN COALESCE(inv.total_invoiced, 0) > 0 THEN COALESCE(inv.total_invoiced, 0) ELSE COALESCE(so.total_ordered, 0) END,
         0
       )::float AS credit_balance
     FROM customers c
     LEFT JOIN (
       SELECT customer_id, SUM(total_amount)::float AS total_ordered
       FROM sales_orders
       WHERE status != 'cancelled'
       GROUP BY customer_id
     ) so ON so.customer_id = c.id
     LEFT JOIN (
       SELECT customer_id, SUM(total_amount)::float AS total_invoiced
       FROM invoices
       WHERE status != 'void'
       GROUP BY customer_id
     ) inv ON inv.customer_id = c.id
     LEFT JOIN (
       SELECT customer_id, SUM(amount)::float AS total_paid
       FROM customer_payments
       GROUP BY customer_id
     ) cp ON cp.customer_id = c.id
     LEFT JOIN (
       SELECT customer_id, SUM(total_amount)::float AS total_credited
       FROM credit_notes
       WHERE status != 'void'
       GROUP BY customer_id
     ) cn ON cn.customer_id = c.id
     ORDER BY c.name
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return result.rows;
};

const createCustomer = async ({
  name,
  email,
  phone,
  address,
  city,
  country,
  tax_number,
  payment_terms_days,
  credit_limit,
  status,
}) => {
  const result = await pool.query(
    `INSERT INTO customers (
      name, email, phone, address, city, country, tax_number, payment_terms_days, credit_limit, status
    )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [
      name,
      email,
      phone,
      address,
      city,
      country,
      tax_number,
      payment_terms_days || 30,
      credit_limit || 0,
      status || 'active',
    ]
  );
  return result.rows[0];
};

const getCustomerById = async (id, client = pool) => {
  const result = await client.query('SELECT * FROM customers WHERE id = $1', [id]);
  return result.rows[0] || null;
};

const getCustomerLedgerDetails = async (id) => {
  const [orders, invoices, payments, returns, credits, summary] = await Promise.all([
    pool.query(
      `SELECT so.*, COALESCE(SUM(soi.quantity), 0)::int AS total_products
       FROM sales_orders so
       LEFT JOIN sales_order_items soi ON soi.sales_order_id = so.id
       WHERE so.customer_id = $1
       GROUP BY so.id
       ORDER BY so.order_date DESC, so.id DESC`,
      [id]
    ),
    pool.query(
      `SELECT *
       FROM invoices
       WHERE customer_id = $1
       ORDER BY invoice_date DESC, id DESC`,
      [id]
    ),
    pool.query(
      `SELECT id, customer_id, invoice_id, payment_date::text AS payment_date, amount,
              payment_method, reference_number, notes, evidence_url, evidence_name,
              evidence_mime, created_at
       FROM customer_payments
       WHERE customer_id = $1
       ORDER BY payment_date DESC, id DESC`,
      [id]
    ),
    pool.query(
      `SELECT *
       FROM sales_returns
       WHERE customer_id = $1
       ORDER BY return_date DESC, id DESC`,
      [id]
    ),
    pool.query(
      `SELECT *
       FROM credit_notes
       WHERE customer_id = $1
       ORDER BY credit_date DESC, id DESC`,
      [id]
    ),
    pool.query(
      `SELECT
         COALESCE((SELECT SUM(total_amount) FROM sales_orders WHERE customer_id = $1 AND status != 'cancelled'), 0)::float AS total_ordered,
         COALESCE((SELECT SUM(total_amount) FROM invoices WHERE customer_id = $1 AND status != 'void'), 0)::float AS total_invoiced,
         COALESCE((SELECT SUM(total_amount) FROM invoices WHERE customer_id = $1 AND status IN ('issued','partially_paid','overdue')), 0)::float AS open_invoiced,
         COALESCE((SELECT SUM(total_amount) FROM sales_orders WHERE customer_id = $1 AND status IN ('shipped','delivered')), 0)::float AS delivered_value,
         COALESCE((SELECT SUM(paid_amount) FROM sales_orders WHERE customer_id = $1 AND status != 'cancelled'), 0)::float AS applied_paid,
         COALESCE((SELECT SUM(amount) FROM customer_payments WHERE customer_id = $1), 0)::float AS total_paid,
         COALESCE((SELECT SUM(total_amount) FROM sales_returns WHERE customer_id = $1 AND status != 'rejected'), 0)::float AS total_returned,
         COALESCE((SELECT SUM(total_amount) FROM credit_notes WHERE customer_id = $1 AND status != 'void'), 0)::float AS total_credited,
         COALESCE((SELECT SUM(soi.quantity)
                  FROM sales_order_items soi
                  JOIN sales_orders so2 ON so2.id = soi.sales_order_id
                  WHERE so2.customer_id = $1 AND so2.status != 'cancelled'), 0)::int AS total_products`,
      [id]
    ),
  ]);

  return {
    orders: orders.rows,
    invoices: invoices.rows,
    payments: payments.rows,
    returns: returns.rows,
    credits: credits.rows,
    summary: summary.rows[0] || {},
  };
};

const insertCustomerPayment = async (client, {
  customerId,
  invoiceId,
  payment_date,
  amount,
  payment_method,
  reference_number,
  notes,
  evidenceUrl,
  evidenceName,
  evidenceMime,
  created_by,
}) => {
  const result = await client.query(
    `INSERT INTO customer_payments (
      customer_id, invoice_id, payment_date, amount, payment_method, reference_number,
      notes, evidence_url, evidence_name, evidence_mime, created_by
    )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id, customer_id, invoice_id, payment_date::text AS payment_date, amount,
               payment_method, reference_number, notes, evidence_url, evidence_name,
               evidence_mime, created_by, created_at`,
    [
      customerId,
      invoiceId || null,
      payment_date || new Date().toISOString().slice(0, 10),
      amount,
      payment_method || null,
      reference_number || null,
      notes || null,
      evidenceUrl,
      evidenceName,
      evidenceMime,
      created_by || null,
    ]
  );
  return result.rows[0];
};

const getProductByIdForUpdate = async (client, productId) => {
  const result = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [productId]);
  return result.rows[0] || null;
};

const getProductByNameForUpdate = async (client, name) => {
  const result = await client.query('SELECT * FROM products WHERE name = $1 FOR UPDATE', [name]);
  return result.rows[0] || null;
};

const getProductReservedQuantityForUpdate = async (client, productId) => {
  const result = await client.query(
    `SELECT quantity_reserved
     FROM inventory_balances
     WHERE item_type = 'product' AND item_id = $1
     FOR UPDATE`,
    [productId]
  );
  return result.rows.reduce((sum, row) => sum + Number(row.quantity_reserved || 0), 0);
};

const getProductReservedForOrder = async (client, salesOrderId, productId) => {
  const result = await client.query(
    `SELECT COALESCE(SUM(quantity), 0)::float AS reserved
     FROM inventory_transactions
     WHERE item_type = 'product'
       AND item_id = $1
       AND transaction_type = 'reserve'
       AND reference_type = 'sales_order'
       AND reference_id = $2`,
    [productId, salesOrderId]
  );
  return Number(result.rows[0]?.reserved || 0);
};

const getSalesOrdersCount = async ({ status, payment_status, customer_id }) => countRows(
  'SELECT COUNT(*) FROM sales_orders so WHERE 1=1',
  [
    { value: status, sql: 'so.status =' },
    { value: payment_status, sql: 'so.payment_status =' },
    { value: customer_id, sql: 'so.customer_id =' },
  ]
);

const getSalesOrders = async ({ status, payment_status, customer_id, limit, offset }) => queryWithPagination(
  `SELECT so.*, c.name AS customer_name
   FROM sales_orders so
   LEFT JOIN customers c ON so.customer_id = c.id
   WHERE 1=1`,
  [
    { value: status, sql: 'so.status =' },
    { value: payment_status, sql: 'so.payment_status =' },
    { value: customer_id, sql: 'so.customer_id =' },
  ],
  'ORDER BY so.created_at DESC',
  { limit, offset }
);

const getSalesOrderById = async (id, client = pool) => {
  const result = await client.query(
    `SELECT so.*, c.name AS customer_name
     FROM sales_orders so
     LEFT JOIN customers c ON so.customer_id = c.id
     WHERE so.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const getSalesOrderItems = async (orderId, client = pool) => {
  const result = await client.query('SELECT * FROM sales_order_items WHERE sales_order_id = $1 ORDER BY id ASC', [orderId]);
  return result.rows;
};

const createSalesOrderRecord = async (client, {
  orderNum,
  quotation_id,
  customer_id,
  delivery_date,
  notes,
  created_by,
  subtotal,
  discount_amount,
  tax_amount,
  total_amount,
}) => {
  const result = await client.query(
    `INSERT INTO sales_orders (
      order_number, quotation_id, customer_id, delivery_date, notes, created_by,
      subtotal, discount_amount, tax_amount, total_amount
    )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [
      orderNum,
      quotation_id || null,
      customer_id || null,
      delivery_date || null,
      notes || null,
      created_by || null,
      subtotal || 0,
      discount_amount || 0,
      tax_amount || 0,
      total_amount || 0,
    ]
  );
  return result.rows[0];
};

const insertSalesOrderItem = async (client, {
  sales_order_id,
  product_name,
  quantity,
  unit_price,
  product_id = null,
}) => {
  const result = await client.query(
    `INSERT INTO sales_order_items (sales_order_id, product_name, quantity, unit_price, product_id)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [sales_order_id, product_name, quantity, unit_price, product_id]
  );
  return result.rows[0];
};

const updateSalesOrderTotal = async (client, id, total, subtotal = total, discountAmount = 0, taxAmount = 0) => {
  await client.query(
    `UPDATE sales_orders
     SET subtotal = $1,
         discount_amount = $2,
         tax_amount = $3,
         total_amount = $4,
         updated_at = NOW()
     WHERE id = $5`,
    [subtotal, discountAmount, taxAmount, total, id]
  );
};

const markSalesOrderReserved = async (client, id) => {
  await client.query('UPDATE sales_orders SET reserved_at = NOW(), updated_at = NOW() WHERE id = $1', [id]);
};

const updateSalesOrderStatus = async (id, status, payment_status, paid_amount, client = pool) => {
  const result = await client.query(
    `UPDATE sales_orders SET status=COALESCE($1,status),
     payment_status=COALESCE($2,payment_status),
     paid_amount=COALESCE($3,paid_amount),
     updated_at=NOW()
     WHERE id=$4 RETURNING *`,
    [status, payment_status, paid_amount, id]
  );
  return result.rows[0] || null;
};

const updateSalesOrderFulfillmentStatus = async (client, orderId) => {
  const items = await getSalesOrderItems(orderId, client);
  const allFulfilled = items.length > 0 && items.every((item) => Number(item.fulfilled_quantity || 0) >= Number(item.quantity || 0));
  const anyFulfilled = items.some((item) => Number(item.fulfilled_quantity || 0) > 0);
  const status = allFulfilled ? 'delivered' : anyFulfilled ? 'shipped' : 'confirmed';
  return updateSalesOrderStatus(orderId, status, null, null, client);
};

const incrementSalesOrderItemFulfilled = async (client, itemId, quantity) => {
  const result = await client.query(
    `UPDATE sales_order_items
     SET fulfilled_quantity = fulfilled_quantity + $1
     WHERE id = $2
     RETURNING *`,
    [quantity, itemId]
  );
  return result.rows[0] || null;
};

const incrementSalesOrderItemReturned = async (client, itemId, quantity) => {
  const result = await client.query(
    `UPDATE sales_order_items
     SET returned_quantity = returned_quantity + $1
     WHERE id = $2
     RETURNING *`,
    [quantity, itemId]
  );
  return result.rows[0] || null;
};

const deleteSalesOrderItems = async (client, orderId) => {
  await client.query('DELETE FROM sales_order_items WHERE sales_order_id = $1', [orderId]);
};

const deleteSalesOrderRecord = async (client, orderId) => {
  await client.query('DELETE FROM sales_orders WHERE id = $1', [orderId]);
};

const getQuotationsCount = async ({ status, customer_id }) => countRows(
  'SELECT COUNT(*) FROM quotations q WHERE 1=1',
  [
    { value: status, sql: 'q.status =' },
    { value: customer_id, sql: 'q.customer_id =' },
  ]
);

const getQuotations = async ({ status, customer_id, limit, offset }) => queryWithPagination(
  `SELECT q.*, c.name AS customer_name
   FROM quotations q
   LEFT JOIN customers c ON q.customer_id = c.id
   WHERE 1=1`,
  [
    { value: status, sql: 'q.status =' },
    { value: customer_id, sql: 'q.customer_id =' },
  ],
  'ORDER BY q.created_at DESC',
  { limit, offset }
);

const createQuotationRecord = async (client, {
  quotation_number,
  customer_id,
  valid_until,
  subtotal,
  discount_amount,
  tax_amount,
  total_amount,
  status,
  notes,
  created_by,
}) => {
  const result = await client.query(
    `INSERT INTO quotations (
      quotation_number, customer_id, valid_until, subtotal, discount_amount,
      tax_amount, total_amount, status, notes, created_by
    )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      quotation_number,
      customer_id || null,
      valid_until || null,
      subtotal || 0,
      discount_amount || 0,
      tax_amount || 0,
      total_amount || 0,
      status || 'draft',
      notes || null,
      created_by || null,
    ]
  );
  return result.rows[0];
};

const insertQuotationItem = async (client, item) => {
  const result = await client.query(
    `INSERT INTO quotation_items (
      quotation_id, product_id, product_name, quantity, unit_price, discount_percent
    )
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [
      item.quotation_id,
      item.product_id || null,
      item.product_name,
      item.quantity,
      item.unit_price,
      item.discount_percent || 0,
    ]
  );
  return result.rows[0];
};

const getQuotationById = async (id, client = pool) => {
  const result = await client.query(
    `SELECT q.*, c.name AS customer_name
     FROM quotations q
     LEFT JOIN customers c ON q.customer_id = c.id
     WHERE q.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const getQuotationItems = async (id, client = pool) => {
  const result = await client.query('SELECT * FROM quotation_items WHERE quotation_id = $1 ORDER BY id ASC', [id]);
  return result.rows;
};

const updateQuotationStatus = async (client, id, status) => {
  const result = await client.query(
    `UPDATE quotations SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [status, id]
  );
  return result.rows[0] || null;
};

const getInvoicesCount = async ({ status, customer_id }) => countRows(
  'SELECT COUNT(*) FROM invoices i WHERE 1=1',
  [
    { value: status, sql: 'i.status =' },
    { value: customer_id, sql: 'i.customer_id =' },
  ]
);

const getInvoices = async ({ status, customer_id, limit, offset }) => queryWithPagination(
  `SELECT i.*, c.name AS customer_name, so.order_number AS sales_order_number
   FROM invoices i
   LEFT JOIN customers c ON i.customer_id = c.id
   LEFT JOIN sales_orders so ON i.sales_order_id = so.id
   WHERE 1=1`,
  [
    { value: status, sql: 'i.status =' },
    { value: customer_id, sql: 'i.customer_id =' },
  ],
  'ORDER BY i.invoice_date DESC, i.id DESC',
  { limit, offset }
);

const createInvoiceRecord = async (client, {
  invoice_number,
  sales_order_id,
  customer_id,
  invoice_date,
  due_date,
  subtotal,
  discount_amount,
  tax_amount,
  total_amount,
  status,
  notes,
  created_by,
}) => {
  const result = await client.query(
    `INSERT INTO invoices (
      invoice_number, sales_order_id, customer_id, invoice_date, due_date,
      subtotal, discount_amount, tax_amount, total_amount, status, notes, created_by
    )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      invoice_number,
      sales_order_id || null,
      customer_id || null,
      invoice_date || new Date().toISOString().slice(0, 10),
      due_date || null,
      subtotal || 0,
      discount_amount || 0,
      tax_amount || 0,
      total_amount || 0,
      status || 'issued',
      notes || null,
      created_by || null,
    ]
  );
  return result.rows[0];
};

const insertInvoiceItem = async (client, item) => {
  const result = await client.query(
    `INSERT INTO invoice_items (
      invoice_id, sales_order_item_id, product_id, product_name, quantity,
      unit_price, discount_percent, tax_rate
    )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      item.invoice_id,
      item.sales_order_item_id || null,
      item.product_id || null,
      item.product_name,
      item.quantity,
      item.unit_price,
      item.discount_percent || 0,
      item.tax_rate || 0,
    ]
  );
  return result.rows[0];
};

const getInvoiceById = async (id, client = pool) => {
  const result = await client.query(
    `SELECT i.*, c.name AS customer_name, so.order_number AS sales_order_number
     FROM invoices i
     LEFT JOIN customers c ON i.customer_id = c.id
     LEFT JOIN sales_orders so ON i.sales_order_id = so.id
     WHERE i.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const getInvoiceItems = async (id, client = pool) => {
  const result = await client.query('SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY id ASC', [id]);
  return result.rows;
};

const getOpenInvoicesForCustomer = async (client, customerId, invoiceId = null) => {
  const params = [customerId];
  let query = `
    SELECT *
    FROM invoices
    WHERE customer_id = $1
      AND status != 'void'
      AND total_amount > paid_amount + credited_amount
  `;
  if (invoiceId) {
    params.push(invoiceId);
    query += ` AND id = $${params.length}`;
  }
  query += ' ORDER BY invoice_date ASC, id ASC FOR UPDATE';
  const result = await client.query(query, params);
  return result.rows;
};

const insertPaymentAllocation = async (client, paymentId, invoiceId, amount) => {
  const result = await client.query(
    `INSERT INTO customer_payment_allocations (customer_payment_id, invoice_id, amount)
     VALUES ($1,$2,$3)
     RETURNING *`,
    [paymentId, invoiceId, amount]
  );
  return result.rows[0];
};

const incrementInvoicePaid = async (client, invoiceId, amount) => {
  const result = await client.query(
    `UPDATE invoices
     SET paid_amount = paid_amount + $1,
         status = CASE
           WHEN paid_amount + $1 + credited_amount >= total_amount THEN 'paid'
           ELSE 'partially_paid'
         END,
         updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [amount, invoiceId]
  );
  return result.rows[0] || null;
};

const incrementInvoiceCredited = async (client, invoiceId, amount) => {
  const result = await client.query(
    `UPDATE invoices
     SET credited_amount = credited_amount + $1,
         status = CASE
           WHEN paid_amount + credited_amount + $1 >= total_amount THEN 'paid'
           ELSE status
         END,
         updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [amount, invoiceId]
  );
  return result.rows[0] || null;
};

const getDeliveryNotesCount = async ({ status, customer_id }) => countRows(
  'SELECT COUNT(*) FROM delivery_notes dn WHERE 1=1',
  [
    { value: status, sql: 'dn.status =' },
    { value: customer_id, sql: 'dn.customer_id =' },
  ]
);

const getDeliveryNotes = async ({ status, customer_id, limit, offset }) => queryWithPagination(
  `SELECT dn.*, c.name AS customer_name, so.order_number AS sales_order_number
   FROM delivery_notes dn
   LEFT JOIN customers c ON dn.customer_id = c.id
   LEFT JOIN sales_orders so ON dn.sales_order_id = so.id
   WHERE 1=1`,
  [
    { value: status, sql: 'dn.status =' },
    { value: customer_id, sql: 'dn.customer_id =' },
  ],
  'ORDER BY dn.delivery_date DESC, dn.id DESC',
  { limit, offset }
);

const createDeliveryNoteRecord = async (client, {
  delivery_number,
  sales_order_id,
  customer_id,
  delivery_date,
  status,
  notes,
  created_by,
}) => {
  const result = await client.query(
    `INSERT INTO delivery_notes (
      delivery_number, sales_order_id, customer_id, delivery_date, status, notes, created_by
    )
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      delivery_number,
      sales_order_id,
      customer_id || null,
      delivery_date || new Date().toISOString().slice(0, 10),
      status || 'delivered',
      notes || null,
      created_by || null,
    ]
  );
  return result.rows[0];
};

const insertDeliveryNoteItem = async (client, item) => {
  const result = await client.query(
    `INSERT INTO delivery_note_items (
      delivery_note_id, sales_order_item_id, product_id, product_name, quantity
    )
     VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [
      item.delivery_note_id,
      item.sales_order_item_id || null,
      item.product_id || null,
      item.product_name,
      item.quantity,
    ]
  );
  return result.rows[0];
};

const getReturnsCount = async ({ status, customer_id }) => countRows(
  'SELECT COUNT(*) FROM sales_returns sr WHERE 1=1',
  [
    { value: status, sql: 'sr.status =' },
    { value: customer_id, sql: 'sr.customer_id =' },
  ]
);

const getReturns = async ({ status, customer_id, limit, offset }) => queryWithPagination(
  `SELECT sr.*, c.name AS customer_name, so.order_number AS sales_order_number, i.invoice_number
   FROM sales_returns sr
   LEFT JOIN customers c ON sr.customer_id = c.id
   LEFT JOIN sales_orders so ON sr.sales_order_id = so.id
   LEFT JOIN invoices i ON sr.invoice_id = i.id
   WHERE 1=1`,
  [
    { value: status, sql: 'sr.status =' },
    { value: customer_id, sql: 'sr.customer_id =' },
  ],
  'ORDER BY sr.return_date DESC, sr.id DESC',
  { limit, offset }
);

const createReturnRecord = async (client, {
  return_number,
  sales_order_id,
  invoice_id,
  customer_id,
  return_date,
  total_amount,
  status,
  reason,
  notes,
  created_by,
}) => {
  const result = await client.query(
    `INSERT INTO sales_returns (
      return_number, sales_order_id, invoice_id, customer_id, return_date,
      total_amount, status, reason, notes, created_by
    )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      return_number,
      sales_order_id || null,
      invoice_id || null,
      customer_id || null,
      return_date || new Date().toISOString().slice(0, 10),
      total_amount || 0,
      status || 'received',
      reason || null,
      notes || null,
      created_by || null,
    ]
  );
  return result.rows[0];
};

const insertReturnItem = async (client, item) => {
  const result = await client.query(
    `INSERT INTO sales_return_items (
      sales_return_id, sales_order_item_id, product_id, product_name,
      quantity, unit_price, restock
    )
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      item.sales_return_id,
      item.sales_order_item_id || null,
      item.product_id || null,
      item.product_name,
      item.quantity,
      item.unit_price,
      item.restock !== false,
    ]
  );
  return result.rows[0];
};

const getReturnById = async (id, client = pool) => {
  const result = await client.query('SELECT * FROM sales_returns WHERE id = $1', [id]);
  return result.rows[0] || null;
};

const getReturnItems = async (id, client = pool) => {
  const result = await client.query('SELECT * FROM sales_return_items WHERE sales_return_id = $1 ORDER BY id ASC', [id]);
  return result.rows;
};

const getCreditNotesCount = async ({ status, customer_id }) => countRows(
  'SELECT COUNT(*) FROM credit_notes cn WHERE 1=1',
  [
    { value: status, sql: 'cn.status =' },
    { value: customer_id, sql: 'cn.customer_id =' },
  ]
);

const getCreditNotes = async ({ status, customer_id, limit, offset }) => queryWithPagination(
  `SELECT cn.*, c.name AS customer_name, i.invoice_number
   FROM credit_notes cn
   LEFT JOIN customers c ON cn.customer_id = c.id
   LEFT JOIN invoices i ON cn.invoice_id = i.id
   WHERE 1=1`,
  [
    { value: status, sql: 'cn.status =' },
    { value: customer_id, sql: 'cn.customer_id =' },
  ],
  'ORDER BY cn.credit_date DESC, cn.id DESC',
  { limit, offset }
);

const createCreditNoteRecord = async (client, {
  credit_note_number,
  customer_id,
  invoice_id,
  sales_return_id,
  credit_date,
  total_amount,
  applied_amount,
  status,
  reason,
  notes,
  created_by,
}) => {
  const result = await client.query(
    `INSERT INTO credit_notes (
      credit_note_number, customer_id, invoice_id, sales_return_id, credit_date,
      total_amount, applied_amount, status, reason, notes, created_by
    )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      credit_note_number,
      customer_id || null,
      invoice_id || null,
      sales_return_id || null,
      credit_date || new Date().toISOString().slice(0, 10),
      total_amount || 0,
      applied_amount || 0,
      status || 'issued',
      reason || null,
      notes || null,
      created_by || null,
    ]
  );
  return result.rows[0];
};

const insertCreditNoteItem = async (client, item) => {
  const result = await client.query(
    `INSERT INTO credit_note_items (
      credit_note_id, product_id, description, quantity, unit_price
    )
     VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [
      item.credit_note_id,
      item.product_id || null,
      item.description,
      item.quantity,
      item.unit_price,
    ]
  );
  return result.rows[0];
};

const createJournalEntry = async (client, {
  entry_number,
  entry_date,
  source_type,
  source_id,
  memo,
  created_by,
}) => {
  const result = await client.query(
    `INSERT INTO accounting_journal_entries (
      entry_number, entry_date, source_type, source_id, memo, created_by
    )
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [
      entry_number,
      entry_date || new Date().toISOString().slice(0, 10),
      source_type,
      source_id,
      memo || null,
      created_by || null,
    ]
  );
  return result.rows[0];
};

const insertJournalLine = async (client, {
  journal_entry_id,
  account_code,
  account_name,
  debit,
  credit,
  customer_id,
}) => {
  const result = await client.query(
    `INSERT INTO accounting_journal_lines (
      journal_entry_id, account_code, account_name, debit, credit, customer_id
    )
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [
      journal_entry_id,
      account_code,
      account_name,
      debit || 0,
      credit || 0,
      customer_id || null,
    ]
  );
  return result.rows[0];
};

const getOutstandingBalances = async () => {
  const result = await pool.query(
    `SELECT
       c.id,
       c.name,
       c.email,
       c.phone,
       COALESCE(inv.total_invoiced, 0)::float AS total_invoiced,
       COALESCE(so.total_ordered, 0)::float AS total_ordered,
       COALESCE(pay.total_paid, 0)::float AS total_paid,
       COALESCE(cn.total_credited, 0)::float AS total_credited,
       GREATEST(
         CASE WHEN COALESCE(inv.total_invoiced, 0) > 0
           THEN COALESCE(inv.total_invoiced, 0) - COALESCE(pay.total_paid, 0) - COALESCE(cn.total_credited, 0)
           ELSE COALESCE(so.total_ordered, 0) - COALESCE(pay.total_paid, 0)
         END,
         0
       )::float AS outstanding_balance,
       MIN(open_inv.due_date) AS oldest_due_date
     FROM customers c
     LEFT JOIN (
       SELECT customer_id, SUM(total_amount) AS total_invoiced
       FROM invoices
       WHERE status != 'void'
       GROUP BY customer_id
     ) inv ON inv.customer_id = c.id
     LEFT JOIN (
       SELECT customer_id, SUM(total_amount) AS total_ordered
       FROM sales_orders
       WHERE status != 'cancelled'
       GROUP BY customer_id
     ) so ON so.customer_id = c.id
     LEFT JOIN (
       SELECT customer_id, SUM(amount) AS total_paid
       FROM customer_payments
       GROUP BY customer_id
     ) pay ON pay.customer_id = c.id
     LEFT JOIN (
       SELECT customer_id, SUM(total_amount) AS total_credited
       FROM credit_notes
       WHERE status != 'void'
       GROUP BY customer_id
     ) cn ON cn.customer_id = c.id
     LEFT JOIN invoices open_inv
       ON open_inv.customer_id = c.id
      AND open_inv.status != 'void'
      AND open_inv.total_amount > open_inv.paid_amount + open_inv.credited_amount
     GROUP BY c.id, inv.total_invoiced, so.total_ordered, pay.total_paid, cn.total_credited
     HAVING GREATEST(
       CASE WHEN COALESCE(inv.total_invoiced, 0) > 0
         THEN COALESCE(inv.total_invoiced, 0) - COALESCE(pay.total_paid, 0) - COALESCE(cn.total_credited, 0)
         ELSE COALESCE(so.total_ordered, 0) - COALESCE(pay.total_paid, 0)
       END,
       0
     ) > 0
     ORDER BY outstanding_balance DESC, c.name ASC`
  );
  return result.rows;
};

const getCustomerAnalytics = async () => {
  const [summary, topCustomers, monthlySales, productMix, quoteStats] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(*)::int AS total_customers,
         COUNT(*) FILTER (WHERE status = 'active')::int AS active_customers,
         COALESCE((SELECT SUM(total_amount) FROM invoices WHERE status != 'void'), 0)::float AS invoiced_revenue,
         COALESCE((SELECT SUM(amount) FROM customer_payments), 0)::float AS collected_cash,
         COALESCE((SELECT SUM(total_amount) FROM credit_notes WHERE status != 'void'), 0)::float AS credited_amount`
    ),
    pool.query(
      `SELECT c.id, c.name,
              COALESCE(SUM(i.total_amount), 0)::float AS revenue,
              COALESCE(SUM(i.total_amount - i.paid_amount - i.credited_amount), 0)::float AS outstanding
       FROM customers c
       LEFT JOIN invoices i ON i.customer_id = c.id AND i.status != 'void'
       GROUP BY c.id
       ORDER BY revenue DESC
       LIMIT 10`
    ),
    pool.query(
      `SELECT to_char(date_trunc('month', invoice_date), 'YYYY-MM') AS month,
              COALESCE(SUM(total_amount), 0)::float AS revenue,
              COUNT(*)::int AS invoice_count
       FROM invoices
       WHERE status != 'void'
         AND invoice_date >= CURRENT_DATE - INTERVAL '12 months'
       GROUP BY date_trunc('month', invoice_date)
       ORDER BY month`
    ),
    pool.query(
      `SELECT ii.product_id, ii.product_name,
              COALESCE(SUM(ii.quantity), 0)::float AS quantity_sold,
              COALESCE(SUM(ii.total_price), 0)::float AS revenue
       FROM invoice_items ii
       JOIN invoices i ON i.id = ii.invoice_id
       WHERE i.status != 'void'
       GROUP BY ii.product_id, ii.product_name
       ORDER BY revenue DESC
       LIMIT 10`
    ),
    pool.query(
      `SELECT
         COUNT(*)::int AS total_quotes,
         COUNT(*) FILTER (WHERE status = 'converted')::int AS converted_quotes,
         COUNT(*) FILTER (WHERE status IN ('accepted','converted'))::int AS accepted_quotes,
         COALESCE(SUM(total_amount), 0)::float AS quoted_value
       FROM quotations`
    ),
  ]);

  return {
    summary: summary.rows[0] || {},
    top_customers: topCustomers.rows,
    monthly_sales: monthlySales.rows,
    product_mix: productMix.rows,
    quotations: quoteStats.rows[0] || {},
  };
};

module.exports = {
  getCustomerPayments,
  getCustomerOrders,
  updateOrderPaymentStatus,
  createProductionOrder,
  getCustomersCount,
  getCustomers,
  createCustomer,
  getCustomerById,
  getCustomerLedgerDetails,
  insertCustomerPayment,
  getProductByIdForUpdate,
  getProductByNameForUpdate,
  getProductReservedQuantityForUpdate,
  getProductReservedForOrder,
  getSalesOrdersCount,
  getSalesOrders,
  getSalesOrderById,
  getSalesOrderItems,
  createSalesOrderRecord,
  insertSalesOrderItem,
  updateSalesOrderTotal,
  markSalesOrderReserved,
  updateSalesOrderStatus,
  updateSalesOrderFulfillmentStatus,
  incrementSalesOrderItemFulfilled,
  incrementSalesOrderItemReturned,
  deleteSalesOrderItems,
  deleteSalesOrderRecord,
  getQuotationsCount,
  getQuotations,
  createQuotationRecord,
  insertQuotationItem,
  getQuotationById,
  getQuotationItems,
  updateQuotationStatus,
  getInvoicesCount,
  getInvoices,
  createInvoiceRecord,
  insertInvoiceItem,
  getInvoiceById,
  getInvoiceItems,
  getOpenInvoicesForCustomer,
  insertPaymentAllocation,
  incrementInvoicePaid,
  incrementInvoiceCredited,
  getDeliveryNotesCount,
  getDeliveryNotes,
  createDeliveryNoteRecord,
  insertDeliveryNoteItem,
  getReturnsCount,
  getReturns,
  createReturnRecord,
  insertReturnItem,
  getReturnById,
  getReturnItems,
  getCreditNotesCount,
  getCreditNotes,
  createCreditNoteRecord,
  insertCreditNoteItem,
  createJournalEntry,
  insertJournalLine,
  getOutstandingBalances,
  getCustomerAnalytics,
};
