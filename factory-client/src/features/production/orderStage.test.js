import {
  colorStageQty,
  orderStageQty,
  orderCutQty,
  daysInStage,
  stageStepIndex,
  machineInputQty,
} from './orderStage';

const color = (over = {}) => ({
  id: 1,
  cut_quantity: 100,
  sorted_quantity: null,
  print_sent_quantity: null,
  print_received_quantity: null,
  machine_quantity: null,
  delivered_quantity: null,
  ...over,
});

describe('orderStage quantities', () => {
  test('machine input is print output, else sorted, else cut', () => {
    expect(machineInputQty(color())).toBe(100);
    expect(machineInputQty(color({ sorted_quantity: 98 }))).toBe(98);
    expect(machineInputQty(color({ sorted_quantity: 98, print_received_quantity: 95 }))).toBe(95);
  });

  test('each stage shows the pieces actually at that stage', () => {
    const c = color({ sorted_quantity: 98, print_sent_quantity: 98, print_received_quantity: 95, machine_quantity: 93, delivered_quantity: 93 });
    expect(colorStageQty(c, { current_stage: 'cutting' })).toBe(100);
    expect(colorStageQty(c, { current_stage: 'printing', print_sent_at: null })).toBe(98);
    expect(colorStageQty(c, { current_stage: 'printing', print_sent_at: '2026-09-01' })).toBe(98);
    expect(colorStageQty(c, { current_stage: 'machines' })).toBe(95);
    expect(colorStageQty(c, { current_stage: 'ready_for_delivery' })).toBe(93);
    expect(colorStageQty(c, { current_stage: 'delivered' })).toBe(93);
  });

  test('orders delivered before the machines stage fall back to earlier quantities', () => {
    const c = color({ sorted_quantity: 97 });
    expect(colorStageQty(c, { current_stage: 'ready_for_delivery' })).toBe(97);
  });

  test('order totals and loss come from the colors', () => {
    const order = {
      current_stage: 'machines',
      colors: [color({ sorted_quantity: 98 }), color({ id: 2, cut_quantity: 50, sorted_quantity: 50 })],
    };
    expect(orderStageQty(order)).toBe(148);
    expect(orderCutQty(order)).toBe(150);
  });
});

describe('orderStage timing and steps', () => {
  test('days in stage uses stage_entered_at', () => {
    const now = new Date('2026-09-28T12:00:00Z').getTime();
    expect(daysInStage({ stage_entered_at: '2026-09-28T08:00:00Z' }, now)).toBe(0);
    expect(daysInStage({ stage_entered_at: '2026-09-21T11:00:00Z' }, now)).toBe(7);
    expect(daysInStage({}, now)).toBeNull();
  });

  test('ready and delivered orders sit on the last step', () => {
    expect(stageStepIndex('cutting')).toBe(0);
    expect(stageStepIndex('machines')).toBe(3);
    expect(stageStepIndex('ready_for_delivery')).toBe(4);
    expect(stageStepIndex('delivered')).toBe(4);
  });
});
