export const getOrderDisplayNumber = (order) => {
  if (!order) return '—';
  return order.model_number || order.order_number || '—';
};

export const buildProductNameLookup = (products) => (
  Object.fromEntries((products || []).map((p) => [String(p.id), p.name]))
);

export const getOrderProductName = (order, productNameById = {}) => {
  if (!order) return '—';
  const model = String(order.model_number || order.display_order_number || '').trim();

  const catalog = String(order.catalog_product_name || '').trim();
  if (catalog) return catalog;

  if (order.product_id && productNameById[String(order.product_id)]) {
    return productNameById[String(order.product_id)];
  }

  const fromApi = String(order.product_name || '').trim();
  if (fromApi && (!model || fromApi !== model)) return fromApi;

  return '—';
};

export const formatOrderOptionLabel = (order) => {
  const num = getOrderDisplayNumber(order);
  const qty = order.phases?.final ?? order.phases?.outsourcing ?? order.phases?.sorting ?? order.phases?.input ?? order.planned_quantity ?? order.quantity ?? '';
  return `#${num}${qty ? ` — ${qty} pcs` : ''}`;
};
