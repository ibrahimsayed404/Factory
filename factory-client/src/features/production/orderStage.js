// Shared stage/quantity rules for production-cycle orders.

export const STAGE_STEPS = [
  { key: 'cutting', label: 'قص', color: '#0284c7' },
  { key: 'sorting', label: 'فرز', color: '#d97706' },
  { key: 'printing', label: 'مطبعة', color: '#7c3aed' },
  { key: 'machines', label: 'مكن', color: '#4f46e5' },
  { key: 'delivery', label: 'تسليم', color: '#059669' },
];

const STEP_INDEX = {
  cutting: 0,
  sorting: 1,
  printing: 2,
  machines: 3,
  ready_for_delivery: 4,
  delivered: 4,
};

export const stageStepIndex = (stage) => STEP_INDEX[stage] ?? 0;

const has = (v) => v !== null && v !== undefined;

// Pieces entering the machines for a color: print-shop output, else sorted, else cut.
export const machineInputQty = (c) => {
  if (has(c.print_received_quantity)) return Number(c.print_received_quantity);
  if (has(c.sorted_quantity)) return Number(c.sorted_quantity);
  return Number(c.cut_quantity || 0);
};

// Pieces of one color at the order's current stage.
export const colorStageQty = (c, order) => {
  switch (order.current_stage) {
    case 'delivered':
      if (has(c.delivered_quantity)) return Number(c.delivered_quantity);
      return has(c.machine_quantity) ? Number(c.machine_quantity) : machineInputQty(c);
    case 'ready_for_delivery':
      return has(c.machine_quantity) ? Number(c.machine_quantity) : machineInputQty(c);
    case 'machines':
      return machineInputQty(c);
    case 'printing':
      if (order.print_sent_at && has(c.print_sent_quantity)) return Number(c.print_sent_quantity);
      return has(c.sorted_quantity) ? Number(c.sorted_quantity) : Number(c.cut_quantity || 0);
    case 'sorting':
      return has(c.sorted_quantity) ? Number(c.sorted_quantity) : Number(c.cut_quantity || 0);
    default:
      return Number(c.cut_quantity || 0);
  }
};

// Pieces of the whole order at its current stage.
export const orderStageQty = (order) => {
  const colors = Array.isArray(order.colors) ? order.colors : [];
  if (colors.length) return colors.reduce((sum, c) => sum + colorStageQty(c, order), 0);
  return Number(order.total_delivered_quantity || order.total_cut_quantity || order.quantity || 0);
};

export const orderCutQty = (order) => {
  const colors = Array.isArray(order.colors) ? order.colors : [];
  if (colors.length) return colors.reduce((sum, c) => sum + Number(c.cut_quantity || 0), 0);
  return Number(order.total_cut_quantity || order.quantity || 0);
};

// Whole days the order has been in its current stage (null if unknown).
export const daysInStage = (order, now = Date.now()) => {
  const since = order.stage_entered_at || order.updated_at || order.created_at;
  if (!since) return null;
  const t = new Date(since).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now - t) / 86400000));
};

// Waiting this long in one stage is worth a look (amber) / is late (red).
export const STAGE_AGE_WARN_DAYS = 3;
export const STAGE_AGE_LATE_DAYS = 7;
