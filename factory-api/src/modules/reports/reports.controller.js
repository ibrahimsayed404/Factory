const pool = require('../../db/pool');
const ApiError = require('../../utils/ApiError');
const auditService = require('../../services/auditService');


const toIsoDate = (date) => date.toISOString().slice(0, 10);

const parseIsoDate = (value) => {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const getYearRange = (yearInput) => {
  const year = Number.parseInt(yearInput, 10) || new Date().getUTCFullYear();
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31));
  return { startDate: toIsoDate(start), endDate: toIsoDate(end) };
};

const getMonthRange = (yearInput, monthInput) => {
  const year = Number.parseInt(yearInput, 10) || new Date().getUTCFullYear();
  const month = Number.parseInt(monthInput, 10) || (new Date().getUTCMonth() + 1);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { startDate: toIsoDate(start), endDate: toIsoDate(end) };
};

const resolveDateRange = ({ startDateInput, endDateInput, yearInput, monthInput, fallback = 'year' }) => {
  if (startDateInput || endDateInput) {
    const start = parseIsoDate(startDateInput);
    const end = parseIsoDate(endDateInput);
    if (!start || !end) {
      const err = new Error('start_date and end_date must be valid dates in YYYY-MM-DD format');
      err.status = 400;
      throw err;
    }
    if (start > end) {
      const err = new Error('start_date must be before or equal to end_date');
      err.status = 400;
      throw err;
    }
    return { startDate: toIsoDate(start), endDate: toIsoDate(end) };
  }

  if (fallback === 'month') {
    return getMonthRange(yearInput, monthInput);
  }

  return getYearRange(yearInput);
};

// POST /api/reports/sales/expenses
const createSalesExpense = async (req, res, next) => {
  try {
    const { expense_date, amount, category, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO business_expenses (expense_date, amount, category, notes, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, expense_date::text AS expense_date, amount, category, notes, created_by, created_at`,
      [
        expense_date || new Date().toISOString().slice(0, 10),
        amount,
        category || null,
        notes || null,
        req.user?.id || null,
      ]
    );
    await auditService.log(req.user?.id, 'CREATE', 'business_expenses', result.rows[0].id, result.rows[0], auditService.extractReqContext(req));
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
};

const EXPENSE_COLUMNS = `
  e.id, e.expense_date::text AS expense_date, e.amount::float AS amount, e.category, e.notes,
  e.created_by, u.name AS created_by_name, e.created_at`;

// GET /api/reports/sales/expenses?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
// Every expense entry in the period, newest first, with who added it and when.
const listSalesExpenses = async (req, res, next) => {
  try {
    const start = parseIsoDate(req.query.start_date) ? String(req.query.start_date) : null;
    const end = parseIsoDate(req.query.end_date) ? String(req.query.end_date) : null;
    const result = await pool.query(
      `SELECT ${EXPENSE_COLUMNS}
       FROM business_expenses e
       LEFT JOIN users u ON u.id = e.created_by
       WHERE ($1::date IS NULL OR e.expense_date >= $1::date)
         AND ($2::date IS NULL OR e.expense_date <= $2::date)
       ORDER BY e.expense_date DESC, e.id DESC`,
      [start, end]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
};

const getExpenseRow = async (id) => {
  const result = await pool.query(
    `SELECT ${EXPENSE_COLUMNS}
     FROM business_expenses e
     LEFT JOIN users u ON u.id = e.created_by
     WHERE e.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

// PUT /api/reports/sales/expenses/:id — fix a wrong entry; old values go to the audit log.
const updateSalesExpense = async (req, res, next) => {
  try {
    const before = await getExpenseRow(req.params.id);
    if (!before) throw new ApiError(404, 'المصروف غير موجود');
    const { expense_date, amount, category, notes } = req.body;
    await pool.query(
      `UPDATE business_expenses
       SET expense_date = $1, amount = $2, category = $3, notes = $4
       WHERE id = $5`,
      [expense_date || before.expense_date, amount, category || null, notes || null, req.params.id]
    );
    const after = await getExpenseRow(req.params.id);
    await auditService.log(req.user?.id, 'UPDATE', 'business_expenses', req.params.id, { before, after }, auditService.extractReqContext(req));
    res.json(after);
  } catch (err) { next(err); }
};

// DELETE /api/reports/sales/expenses/:id — the deleted row is kept in the audit log.
const deleteSalesExpense = async (req, res, next) => {
  try {
    const before = await getExpenseRow(req.params.id);
    if (!before) throw new ApiError(404, 'المصروف غير موجود');
    await pool.query('DELETE FROM business_expenses WHERE id = $1', [req.params.id]);
    await auditService.log(req.user?.id, 'DELETE', 'business_expenses', req.params.id, before, auditService.extractReqContext(req));
    res.json({ success: true });
  } catch (err) { next(err); }
};

// GET /api/reports/sales?start_date=2026-01-01&end_date=2026-03-31
const salesOverview = async (req, res, next) => {
  try {
    const { startDate, endDate } = resolveDateRange({
      startDateInput: req.query.start_date,
      endDateInput: req.query.end_date,
      yearInput: req.query.year,
      fallback: 'year',
    });

    const [monthly, topCustomers, paymentBreakdown, orderStatuses, expenseSummary] = await Promise.all([
      // Monthly full sales cashflow report, limited to selected date range.
      pool.query(`
        WITH months AS (
          SELECT generate_series(
            date_trunc('month', $1::date),
            date_trunc('month', $2::date),
            interval '1 month'
          )::date AS month_start
        ),
        order_stats AS (
          SELECT
            date_trunc('month', order_date)::date AS month_start,
            COUNT(*)::int AS orders,
            COALESCE(SUM(total_amount), 0)::float AS revenue
          FROM sales_orders
          WHERE order_date >= $1::date
            AND order_date <  ($2::date + interval '1 day')
            AND status != 'cancelled'
          GROUP BY 1
        ),
        collections AS (
          SELECT
            date_trunc('month', payment_date)::date AS month_start,
            COALESCE(SUM(amount), 0)::float AS collected
          FROM customer_payments
          WHERE payment_date >= $1::date
            AND payment_date <  ($2::date + interval '1 day')
          GROUP BY 1
        ),
        payroll_spend AS (
          SELECT
            date_trunc('month', paid_at)::date AS month_start,
            COALESCE(SUM(net_salary), 0)::float AS payroll_spent
          FROM payroll
          WHERE status = 'paid'
            AND paid_at IS NOT NULL
            AND paid_at >= $1::date
            AND paid_at <  ($2::date + interval '1 day')
          GROUP BY 1
        ),
        material_spend AS (
          SELECT
            date_trunc('month', po.created_at)::date AS month_start,
            COALESCE(SUM(pm.quantity_used * COALESCE(m.cost_per_unit, 0)), 0)::float AS materials_spent
          FROM production_materials pm
          JOIN production_orders po ON po.id = pm.production_order_id
          LEFT JOIN materials m ON m.id = pm.material_id
          WHERE po.created_at >= $1::date
            AND po.created_at <  ($2::date + interval '1 day')
          GROUP BY 1
        ),
        extra_spend AS (
          SELECT
            date_trunc('month', expense_date)::date AS month_start,
            COALESCE(SUM(amount), 0)::float AS extra_spent
          FROM business_expenses
          WHERE expense_date >= $1::date
            AND expense_date <  ($2::date + interval '1 day')
          GROUP BY 1
        )
        SELECT
          m.month_start::text AS month_start,
          to_char(m.month_start, 'Mon YYYY') AS month_label,
          COALESCE(os.orders, 0)::int AS orders,
          COALESCE(os.revenue, 0)::float AS revenue,
          COALESCE(c.collected, 0)::float AS collected,
          COALESCE(ps.payroll_spent, 0)::float AS payroll_spent,
          COALESCE(ms.materials_spent, 0)::float AS materials_spent,
          COALESCE(es.extra_spent, 0)::float AS extra_spent,
          (COALESCE(ps.payroll_spent, 0) + COALESCE(ms.materials_spent, 0) + COALESCE(es.extra_spent, 0))::float AS total_spent,
          (COALESCE(c.collected, 0) - (COALESCE(ps.payroll_spent, 0) + COALESCE(ms.materials_spent, 0) + COALESCE(es.extra_spent, 0)))::float AS net_value,
          (COALESCE(os.revenue, 0) - (COALESCE(ps.payroll_spent, 0) + COALESCE(ms.materials_spent, 0) + COALESCE(es.extra_spent, 0)))::float AS accrual_net_value
        FROM months m
        LEFT JOIN order_stats os ON os.month_start = m.month_start
        LEFT JOIN collections c ON c.month_start = m.month_start
        LEFT JOIN payroll_spend ps ON ps.month_start = m.month_start
        LEFT JOIN material_spend ms ON ms.month_start = m.month_start
        LEFT JOIN extra_spend es ON es.month_start = m.month_start
        ORDER BY m.month_start
      `, [startDate, endDate]),

      // Top 5 customers by collections (with booked revenue too)
      pool.query(`
        SELECT
          c.name,
          COUNT(so.id)::int AS orders,
          COALESCE(SUM(CASE WHEN so.status != 'cancelled' THEN so.total_amount ELSE 0 END),0)::float AS revenue,
          COALESCE(cp.collected,0)::float AS collected,
          COALESCE(SUM(CASE WHEN so.status != 'cancelled' THEN so.total_amount ELSE 0 END),0)::float AS total
        FROM customers c
        LEFT JOIN sales_orders so
          ON so.customer_id = c.id
           AND so.order_date >= $1::date
           AND so.order_date <  ($2::date + interval '1 day')
        LEFT JOIN (
          SELECT customer_id, COALESCE(SUM(amount),0)::float AS collected
          FROM customer_payments
            WHERE payment_date >= $1::date
              AND payment_date <  ($2::date + interval '1 day')
          GROUP BY customer_id
        ) cp ON cp.customer_id = c.id
        WHERE so.id IS NOT NULL OR cp.customer_id IS NOT NULL
        GROUP BY c.id, c.name, cp.collected
        ORDER BY collected DESC, revenue DESC
        LIMIT 5
        `, [startDate, endDate]),

      // Payment status breakdown
      pool.query(`
        SELECT payment_status AS status, COUNT(*)::int AS count,
               COALESCE(SUM(total_amount),0)::float AS amount
        FROM sales_orders
        WHERE order_date >= $1::date
          AND order_date <  ($2::date + interval '1 day')
        GROUP BY payment_status
      `, [startDate, endDate]),

      // Order status breakdown
      pool.query(`
        SELECT status, COUNT(*)::int AS count
        FROM sales_orders
        WHERE order_date >= $1::date
          AND order_date <  ($2::date + interval '1 day')
        GROUP BY status
      `, [startDate, endDate]),

      // Yearly spend and net summary
      pool.query(`
        SELECT
          COALESCE((
            SELECT SUM(amount)
            FROM customer_payments
            WHERE payment_date >= $1::date
              AND payment_date <  ($2::date + interval '1 day')
          ),0)::float AS total_collected,
          COALESCE((
            SELECT SUM(total_amount)
            FROM sales_orders
            WHERE order_date >= $1::date
              AND order_date <  ($2::date + interval '1 day')
              AND status != 'cancelled'
          ),0)::float AS total_revenue,
          COALESCE((
            SELECT SUM(net_salary)
            FROM payroll
            WHERE status = 'paid'
              AND paid_at IS NOT NULL
              AND paid_at >= $1::date
              AND paid_at <  ($2::date + interval '1 day')
          ),0)::float AS payroll_spent,
          COALESCE((
            SELECT SUM(pm.quantity_used * COALESCE(m.cost_per_unit, 0))
            FROM production_materials pm
            JOIN production_orders po ON po.id = pm.production_order_id
            LEFT JOIN materials m ON m.id = pm.material_id
            WHERE po.created_at >= $1::date
              AND po.created_at <  ($2::date + interval '1 day')
          ),0)::float AS materials_spent,
          COALESCE((
            SELECT SUM(amount)
            FROM business_expenses
            WHERE expense_date >= $1::date
              AND expense_date <  ($2::date + interval '1 day')
          ),0)::float AS extra_spent
      `, [startDate, endDate]),
    ]);

    const summary = expenseSummary.rows[0] || {};
    const payrollSpent = Number(summary.payroll_spent || 0);
    const materialsSpent = Number(summary.materials_spent || 0);
    const extraSpent = Number(summary.extra_spent || 0);
    const totalRevenue = Number(summary.total_revenue || 0);
    const totalCollected = Number(summary.total_collected || 0);
    const totalSpent = payrollSpent + materialsSpent + extraSpent;

    res.json({
      monthly:          monthly.rows,
      top_customers:    topCustomers.rows,
      payment_breakdown: paymentBreakdown.rows,
      order_statuses:   orderStatuses.rows,
      summary: {
        start_date: startDate,
        end_date: endDate,
        total_revenue: totalRevenue,
        total_collected: totalCollected,
        payroll_spent: payrollSpent,
        materials_spent: materialsSpent,
        extra_spent: extraSpent,
        total_spent: totalSpent,
        net_value: totalCollected - totalSpent,
        accrual_net_value: totalRevenue - totalSpent,
      },
    });
  } catch (err) { next(err); }
};

// GET /api/reports/production?start_date=2026-01-01&end_date=2026-03-31
const productionOverview = async (req, res, next) => {
  try {
    const { startDate, endDate } = resolveDateRange({
      startDateInput: req.query.start_date,
      endDateInput: req.query.end_date,
      yearInput: req.query.year,
      fallback: 'year',
    });

    const [pipelineSummaryRes, stageBreakdownRes, printShopsRes, modelsRes, monthlyRes] = await Promise.all([
      // 1. Overall Pipeline Totals
      pool.query(`
        SELECT
          COUNT(*)::int AS total_orders,
          COUNT(CASE WHEN current_stage = 'delivered' THEN 1 END)::int AS delivered_orders,
          COALESCE(SUM(total_cut_quantity), 0)::int AS total_cut_units,
          COALESCE(SUM(total_sorted_quantity), 0)::int AS total_sorted_units,
          COALESCE(SUM(total_print_sent_quantity), 0)::int AS total_print_sent_units,
          COALESCE(SUM(total_print_received_quantity), 0)::int AS total_print_received_units,
          COALESCE(SUM(total_machine_quantity), 0)::int AS total_machine_units,
          COALESCE(SUM(total_delivered_quantity), 0)::int AS total_delivered_units,
          COALESCE(SUM(total_price), 0)::float AS total_delivered_revenue
        FROM production_orders
        WHERE created_at >= $1::date AND created_at < ($2::date + interval '1 day')
      `, [startDate, endDate]),

      // 2. Stage Breakdown
      pool.query(`
        SELECT
          current_stage AS stage,
          COUNT(*)::int AS orders,
          -- Stage totals default to 0 rather than NULL, so skip zeros to reach the
          -- quantity the order actually has at its current stage.
          COALESCE(SUM(COALESCE(NULLIF(total_delivered_quantity, 0), total_machine_quantity, NULLIF(total_print_received_quantity, 0),
                                NULLIF(total_sorted_quantity, 0), NULLIF(total_cut_quantity, 0), quantity, 0)), 0)::int AS units
        FROM production_orders
        WHERE created_at >= $1::date AND created_at < ($2::date + interval '1 day')
        GROUP BY current_stage
        ORDER BY orders DESC
      `, [startDate, endDate]),

      // 3. Print Shops Performance
      pool.query(`
        SELECT
          ps.id,
          ps.name AS print_shop_name,
          ps.phone,
          COUNT(po.id)::int AS orders,
          COALESCE(SUM(po.total_print_sent_quantity), 0)::int AS sent_units,
          COALESCE(SUM(po.total_print_received_quantity), 0)::int AS received_units,
          GREATEST(COALESCE(SUM(po.total_print_sent_quantity), 0) - COALESCE(SUM(po.total_print_received_quantity), 0), 0)::int AS loss_units,
          CASE
            WHEN COALESCE(SUM(po.total_print_sent_quantity), 0) > 0
            THEN ROUND((GREATEST(COALESCE(SUM(po.total_print_sent_quantity), 0) - COALESCE(SUM(po.total_print_received_quantity), 0), 0)::numeric / SUM(po.total_print_sent_quantity)) * 100, 1)
            ELSE 0
          END::float AS loss_rate
        FROM print_shops ps
        JOIN production_orders po ON po.print_shop_id = ps.id
        WHERE po.created_at >= $1::date AND po.created_at < ($2::date + interval '1 day')
        GROUP BY ps.id, ps.name, ps.phone
        ORDER BY orders DESC, sent_units DESC
      `, [startDate, endDate]),

      // 4. Models Performance
      pool.query(`
        SELECT
          COALESCE(NULLIF(po.model_number, ''), po.order_number) AS model_number,
          COALESCE(po.order_name, po.product_name) AS model_name,
          COUNT(*)::int AS orders,
          COALESCE(SUM(po.total_cut_quantity), 0)::int AS cut_units,
          COALESCE(SUM(po.total_sorted_quantity), 0)::int AS sorted_units,
          COALESCE(SUM(po.total_delivered_quantity), 0)::int AS delivered_units,
          GREATEST(COALESCE(SUM(po.total_cut_quantity), 0) - COALESCE(SUM(po.total_delivered_quantity), 0), 0)::int AS loss_units,
          COALESCE(SUM(po.total_price), 0)::float AS revenue
        FROM production_orders po
        WHERE po.created_at >= $1::date AND po.created_at < ($2::date + interval '1 day')
        GROUP BY 1, 2
        ORDER BY cut_units DESC, orders DESC
      `, [startDate, endDate]),

      // 5. Monthly Trend
      pool.query(`
        SELECT
          date_trunc('month', po.created_at)::date AS month_start,
          to_char(date_trunc('month', po.created_at), 'Mon YYYY') AS month_label,
          COUNT(*)::int AS total,
          SUM(CASE WHEN po.current_stage = 'delivered' THEN 1 ELSE 0 END)::int AS completed,
          COALESCE(SUM(po.total_cut_quantity), 0)::int AS units_ordered,
          COALESCE(SUM(po.total_delivered_quantity), 0)::int AS units_produced,
          COALESCE(SUM(po.total_price), 0)::float AS revenue
        FROM production_orders po
        WHERE po.created_at >= $1::date AND po.created_at < ($2::date + interval '1 day')
        GROUP BY 1, 2
        ORDER BY 1
      `, [startDate, endDate]),
    ]);

    const summary = pipelineSummaryRes.rows[0] || {};
    const totalCut = summary.total_cut_units || 0;
    const totalDelivered = summary.total_delivered_units || 0;
    const yieldRate = totalCut > 0 ? Number(((totalDelivered / totalCut) * 100).toFixed(1)) : 0;

    res.json({
      start_date: startDate,
      end_date: endDate,
      summary: {
        total_orders: summary.total_orders || 0,
        delivered_orders: summary.delivered_orders || 0,
        total_cut_units: totalCut,
        total_sorted_units: summary.total_sorted_units || 0,
        cutting_loss_units: Math.max(0, totalCut - (summary.total_sorted_units || totalCut)),
        total_print_sent_units: summary.total_print_sent_units || 0,
        total_print_received_units: summary.total_print_received_units || 0,
        printing_loss_units: Math.max(0, (summary.total_print_sent_units || 0) - (summary.total_print_received_units || 0)),
        total_delivered_units: totalDelivered,
        total_delivered_revenue: summary.total_delivered_revenue || 0,
        yield_rate: yieldRate,
      },
      monthly: monthlyRes.rows,
      stage_breakdown: stageBreakdownRes.rows,
      print_shops: printShopsRes.rows,
      models: modelsRes.rows,
      // Backwards-compatible mappings for legacy/shared UI components:
      completion: {
        total: summary.total_orders || 0,
        done: summary.delivered_orders || 0,
        total_units: totalCut,
        produced_units: totalDelivered,
      },
      status_breakdown: stageBreakdownRes.rows.map(r => ({ status: r.stage, count: r.orders })),
      product_progress: modelsRes.rows.map(m => ({
        product_name: `${m.model_number} - ${m.model_name}`,
        orders: m.orders,
        units_ordered: m.cut_units,
        units_produced: m.delivered_units,
        units_remaining: Math.max(0, m.cut_units - m.delivered_units),
        completion_rate: m.cut_units > 0 ? Number(((m.delivered_units / m.cut_units) * 100).toFixed(1)) : 0,
        late_orders: 0,
        late_units: 0,
      })),
      by_employee: [],
      late_products: [],
    });
  } catch (err) { next(err); }
};

// GET /api/reports/hr?start_date=2026-03-01&end_date=2026-03-31
const hrOverview = async (req, res, next) => {
  try {
    const { startDate, endDate } = resolveDateRange({
      startDateInput: req.query.start_date,
      endDateInput: req.query.end_date,
      yearInput: req.query.year,
      monthInput: req.query.month,
      fallback: 'month',
    });

    const [attendanceSummary, byDepartment, payrollSummary, topHours, payrollHistory] = await Promise.all([
      // Attendance breakdown for selected date range.
      pool.query(`
        SELECT status, COUNT(*)::int AS count
        FROM attendance
        WHERE date >= $1::date
          AND date <  ($2::date + interval '1 day')
        GROUP BY status
      `, [startDate, endDate]),

      // Attendance by department
      pool.query(`
        SELECT d.name AS department,
               COUNT(a.id)::int AS records,
               SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END)::int AS present,
               SUM(CASE WHEN a.status='absent'  THEN 1 ELSE 0 END)::int AS absent,
               COALESCE(SUM(a.hours_worked),0)::float AS hours
        FROM attendance a
        JOIN employees e ON a.employee_id = e.id
        JOIN departments d ON e.department_id = d.id
        WHERE a.date >= $1::date
          AND a.date <  ($2::date + interval '1 day')
        GROUP BY d.id, d.name
        ORDER BY present DESC
      `, [startDate, endDate]),

      // Payroll summary for the selected date range.
      pool.query(`
        SELECT
          COUNT(*)::int AS total_records,
          COALESCE(SUM(net_salary),0)::float AS total_payout,
          COALESCE(SUM(CASE WHEN status='paid' THEN net_salary ELSE 0 END),0)::float AS paid_payout,
          COALESCE(SUM(CASE WHEN status='pending' THEN net_salary ELSE 0 END),0)::float AS pending_payout,
          COALESCE(SUM(bonus),0)::float      AS total_bonuses,
          COALESCE(SUM(deductions),0)::float AS total_deductions,
          SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END)::int AS paid_count
        FROM payroll
        WHERE status != 'void' AND (
          (
            week_start IS NOT NULL
            AND week_start <= $2::date
            AND COALESCE(week_end, week_start) >= $1::date
          ) OR (
            week_start IS NULL
            AND make_date(year, month, 1) <= $2::date
            AND (make_date(year, month, 1) + interval '1 month' - interval '1 day') >= $1::date
          )
        )
      `, [startDate, endDate]),

      // Top 5 employees by hours worked
      pool.query(`
        SELECT e.name,
               COALESCE(SUM(a.hours_worked),0)::float AS total_hours,
               COUNT(a.id)::int AS days_logged
        FROM employees e
        LEFT JOIN attendance a ON a.employee_id = e.id
          AND a.date >= $1::date
          AND a.date <  ($2::date + interval '1 day')
        GROUP BY e.id, e.name
        ORDER BY total_hours DESC LIMIT 5
      `, [startDate, endDate]),

      // Monthly payroll history inside selected date range.
      pool.query(`
        SELECT
          EXTRACT(MONTH FROM COALESCE(week_start, make_date(year, month, 1)))::int AS month,
          date_trunc('month', COALESCE(week_start, make_date(year, month, 1)))::date::text AS month_start,
          to_char(date_trunc('month', COALESCE(week_start, make_date(year, month, 1))), 'Mon YYYY') AS month_label,
          COUNT(*)::int AS total_records,
          SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END)::int AS paid_records,
          COALESCE(SUM(net_salary),0)::float AS total_payout,
          COALESCE(SUM(CASE WHEN status='paid' THEN net_salary ELSE 0 END),0)::float AS paid_payout,
          COALESCE(SUM(CASE WHEN status='pending' THEN net_salary ELSE 0 END),0)::float AS pending_payout
        FROM payroll
        WHERE status != 'void' AND (
          (
            week_start IS NOT NULL
            AND week_start <= $2::date
            AND COALESCE(week_end, week_start) >= $1::date
          ) OR (
            week_start IS NULL
            AND make_date(year, month, 1) <= $2::date
            AND (make_date(year, month, 1) + interval '1 month' - interval '1 day') >= $1::date
          )
        )
        GROUP BY 1, 2, 3
        ORDER BY 2
      `, [startDate, endDate]),
    ]);

    res.json({
      start_date:         startDate,
      end_date:           endDate,
      attendance_summary: attendanceSummary.rows,
      by_department:      byDepartment.rows,
      payroll_summary:    payrollSummary.rows[0],
      payroll_history:    payrollHistory.rows,
      top_hours:          topHours.rows,
    });
  } catch (err) { next(err); }
};

// GET /api/reports/inventory
const inventoryOverview = async (req, res, next) => {
  try {
    const [byCategory, lowStock, topByValue, usageByProduction] = await Promise.all([
      // Stock by category
      pool.query(`
        SELECT category,
               COUNT(*)::int AS items,
               COALESCE(SUM(quantity),0)::float AS total_qty,
               COALESCE(SUM(quantity * cost_per_unit),0)::float AS total_value
        FROM materials
        WHERE category IS NOT NULL
        GROUP BY category ORDER BY total_value DESC
      `),

      // Low stock items
      pool.query(`
        SELECT name, category, quantity::float, min_quantity::float,
               (quantity / NULLIF(min_quantity,0) * 100)::float AS pct
        FROM materials
        WHERE quantity <= min_quantity
        ORDER BY pct ASC LIMIT 8
      `),

      // Top items by value
      pool.query(`
        SELECT name, category,
               (quantity * cost_per_unit)::float AS value,
               quantity::float, unit
        FROM materials
        WHERE cost_per_unit IS NOT NULL
        ORDER BY value DESC LIMIT 6
      `),

      // Most used materials in production
      pool.query(`
        SELECT m.name, m.unit,
               COALESCE(SUM(pm.quantity_used),0)::float AS total_used,
               COUNT(DISTINCT pm.production_order_id)::int AS orders
        FROM materials m
        LEFT JOIN production_materials pm ON pm.material_id = m.id
        GROUP BY m.id, m.name, m.unit
        ORDER BY total_used DESC LIMIT 6
      `),
    ]);

    res.json({
      by_category:       byCategory.rows,
      low_stock:         lowStock.rows,
      top_by_value:      topByValue.rows,
      usage_by_production: usageByProduction.rows,
    });
  } catch (err) { next(err); }
};

// GET /api/reports/print-shops?start_date=2026-01-01&end_date=2026-03-31
const printShopsOverview = async (req, res, next) => {
  try {
    const { startDate, endDate } = resolveDateRange({
      startDateInput: req.query.start_date,
      endDateInput: req.query.end_date,
      yearInput: req.query.year,
      fallback: 'year',
    });

    const [shopsRes, recentDispatchesRes, summaryRes] = await Promise.all([
      // 1. Performance per Print Shop
      pool.query(`
        SELECT
          ps.id,
          ps.name AS print_shop_name,
          ps.phone,
          ps.contact_person,
          COUNT(po.id)::int AS total_orders,
          SUM(CASE WHEN po.current_stage = 'printing' THEN 1 ELSE 0 END)::int AS active_orders,
          COALESCE(SUM(po.total_print_sent_quantity), 0)::int AS sent_units,
          COALESCE(SUM(po.total_print_received_quantity), 0)::int AS received_units,
          GREATEST(COALESCE(SUM(po.total_print_sent_quantity), 0) - COALESCE(SUM(po.total_print_received_quantity), 0), 0)::int AS loss_units,
          CASE
            WHEN COALESCE(SUM(po.total_print_sent_quantity), 0) > 0
            THEN ROUND((GREATEST(COALESCE(SUM(po.total_print_sent_quantity), 0) - COALESCE(SUM(po.total_print_received_quantity), 0), 0)::numeric / SUM(po.total_print_sent_quantity)) * 100, 1)
            ELSE 0
          END::float AS loss_rate
        FROM print_shops ps
        LEFT JOIN production_orders po ON po.print_shop_id = ps.id
          AND po.created_at >= $1::date AND po.created_at < ($2::date + interval '1 day')
        GROUP BY ps.id, ps.name, ps.phone, ps.contact_person
        ORDER BY sent_units DESC, total_orders DESC
      `, [startDate, endDate]),

      // 2. Recent Dispatches / Slips
      pool.query(`
        SELECT
          po.id,
          po.order_number,
          po.model_number,
          po.order_name,
          ps.name AS print_shop_name,
          po.total_print_sent_quantity,
          po.total_print_received_quantity,
          po.print_sent_at,
          po.print_received_at,
          po.current_stage
        FROM production_orders po
        JOIN print_shops ps ON po.print_shop_id = ps.id
        WHERE po.created_at >= $1::date AND po.created_at < ($2::date + interval '1 day')
        ORDER BY po.print_sent_at DESC NULLS LAST, po.created_at DESC
        LIMIT 25
      `, [startDate, endDate]),

      // 3. Totals
      pool.query(`
        SELECT
          COUNT(DISTINCT po.id)::int AS orders_with_print,
          COALESCE(SUM(po.total_print_sent_quantity), 0)::int AS total_sent,
          COALESCE(SUM(po.total_print_received_quantity), 0)::int AS total_received,
          GREATEST(COALESCE(SUM(po.total_print_sent_quantity), 0) - COALESCE(SUM(po.total_print_received_quantity), 0), 0)::int AS total_loss
        FROM production_orders po
        WHERE po.print_shop_id IS NOT NULL
          AND po.created_at >= $1::date AND po.created_at < ($2::date + interval '1 day')
      `, [startDate, endDate]),
    ]);

    const totals = summaryRes.rows[0] || {};
    const sent = totals.total_sent || 0;
    const loss = totals.total_loss || 0;
    const lossRate = sent > 0 ? Number(((loss / sent) * 100).toFixed(1)) : 0;

    res.json({
      start_date: startDate,
      end_date: endDate,
      summary: {
        total_shops: shopsRes.rows.length,
        orders_with_print: totals.orders_with_print || 0,
        total_sent_units: sent,
        total_received_units: totals.total_received || 0,
        total_loss_units: loss,
        loss_rate: lossRate,
      },
      print_shops: shopsRes.rows,
      recent_dispatches: recentDispatchesRes.rows,
    });
  } catch (err) { next(err); }
};

module.exports = { salesOverview, createSalesExpense, listSalesExpenses, updateSalesExpense, deleteSalesExpense, productionOverview, hrOverview, inventoryOverview, printShopsOverview };
