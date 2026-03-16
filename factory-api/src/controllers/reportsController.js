const pool = require('../../config/db');

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
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
};

// GET /api/reports/sales?year=2026
const salesOverview = async (req, res, next) => {
  try {
    const year = req.query.year || new Date().getFullYear();

    const [monthly, topCustomers, paymentBreakdown, orderStatuses, expenseSummary] = await Promise.all([
      // Monthly full sales cashflow report (booked revenue, collections, spend, and net)
      pool.query(`
        WITH months AS (
          SELECT generate_series(1, 12)::int AS month
        ),
        order_stats AS (
          SELECT
            EXTRACT(MONTH FROM order_date)::int AS month,
            COUNT(*)::int AS orders,
            COALESCE(SUM(total_amount), 0)::float AS revenue
          FROM sales_orders
          WHERE order_date >= make_date($1::int, 1, 1)
            AND order_date <  make_date($1::int + 1, 1, 1)
            AND status != 'cancelled'
          GROUP BY 1
        ),
        collections AS (
          SELECT
            EXTRACT(MONTH FROM payment_date)::int AS month,
            COALESCE(SUM(amount), 0)::float AS collected
          FROM customer_payments
          WHERE payment_date >= make_date($1::int, 1, 1)
            AND payment_date <  make_date($1::int + 1, 1, 1)
          GROUP BY 1
        ),
        payroll_spend AS (
          SELECT
            EXTRACT(MONTH FROM paid_at)::int AS month,
            COALESCE(SUM(net_salary), 0)::float AS payroll_spent
          FROM payroll
          WHERE status = 'paid'
            AND paid_at IS NOT NULL
            AND paid_at >= make_date($1::int, 1, 1)::timestamp
            AND paid_at <  make_date($1::int + 1, 1, 1)::timestamp
          GROUP BY 1
        ),
        material_spend AS (
          SELECT
            EXTRACT(MONTH FROM po.created_at)::int AS month,
            COALESCE(SUM(pm.quantity_used * COALESCE(m.cost_per_unit, 0)), 0)::float AS materials_spent
          FROM production_materials pm
          JOIN production_orders po ON po.id = pm.production_order_id
          LEFT JOIN materials m ON m.id = pm.material_id
          WHERE po.created_at >= make_date($1::int, 1, 1)::timestamp
            AND po.created_at <  make_date($1::int + 1, 1, 1)::timestamp
          GROUP BY 1
        ),
        extra_spend AS (
          SELECT
            EXTRACT(MONTH FROM expense_date)::int AS month,
            COALESCE(SUM(amount), 0)::float AS extra_spent
          FROM business_expenses
          WHERE expense_date >= make_date($1::int, 1, 1)
            AND expense_date <  make_date($1::int + 1, 1, 1)
          GROUP BY 1
        )
        SELECT
          m.month,
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
        LEFT JOIN order_stats os ON os.month = m.month
        LEFT JOIN collections c ON c.month = m.month
        LEFT JOIN payroll_spend ps ON ps.month = m.month
        LEFT JOIN material_spend ms ON ms.month = m.month
        LEFT JOIN extra_spend es ON es.month = m.month
        ORDER BY m.month
      `, [year]),

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
         AND so.order_date >= make_date($1::int, 1, 1)
         AND so.order_date <  make_date($1::int + 1, 1, 1)
        LEFT JOIN (
          SELECT customer_id, COALESCE(SUM(amount),0)::float AS collected
          FROM customer_payments
          WHERE payment_date >= make_date($1::int, 1, 1)
            AND payment_date <  make_date($1::int + 1, 1, 1)
          GROUP BY customer_id
        ) cp ON cp.customer_id = c.id
        WHERE so.id IS NOT NULL OR cp.customer_id IS NOT NULL
        GROUP BY c.id, c.name, cp.collected
        ORDER BY collected DESC, revenue DESC
        LIMIT 5
      `, [year]),

      // Payment status breakdown
      pool.query(`
        SELECT payment_status AS status, COUNT(*)::int AS count,
               COALESCE(SUM(total_amount),0)::float AS amount
        FROM sales_orders
        WHERE order_date >= make_date($1::int, 1, 1)
          AND order_date <  make_date($1::int + 1, 1, 1)
        GROUP BY payment_status
      `, [year]),

      // Order status breakdown
      pool.query(`
        SELECT status, COUNT(*)::int AS count
        FROM sales_orders
        WHERE order_date >= make_date($1::int, 1, 1)
          AND order_date <  make_date($1::int + 1, 1, 1)
        GROUP BY status
      `, [year]),

      // Yearly spend and net summary
      pool.query(`
        SELECT
          COALESCE((
            SELECT SUM(amount)
            FROM customer_payments
            WHERE payment_date >= make_date($1::int, 1, 1)
              AND payment_date <  make_date($1::int + 1, 1, 1)
          ),0)::float AS total_collected,
          COALESCE((
            SELECT SUM(total_amount)
            FROM sales_orders
            WHERE order_date >= make_date($1::int, 1, 1)
              AND order_date <  make_date($1::int + 1, 1, 1)
              AND status != 'cancelled'
          ),0)::float AS total_revenue,
          COALESCE((
            SELECT SUM(net_salary)
            FROM payroll
            WHERE status = 'paid'
              AND paid_at IS NOT NULL
              AND paid_at >= make_date($1::int, 1, 1)::timestamp
              AND paid_at <  make_date($1::int + 1, 1, 1)::timestamp
          ),0)::float AS payroll_spent,
          COALESCE((
            SELECT SUM(pm.quantity_used * COALESCE(m.cost_per_unit, 0))
            FROM production_materials pm
            JOIN production_orders po ON po.id = pm.production_order_id
            LEFT JOIN materials m ON m.id = pm.material_id
            WHERE po.created_at >= make_date($1::int, 1, 1)::timestamp
              AND po.created_at <  make_date($1::int + 1, 1, 1)::timestamp
          ),0)::float AS materials_spent,
          COALESCE((
            SELECT SUM(amount)
            FROM business_expenses
            WHERE expense_date >= make_date($1::int, 1, 1)
              AND expense_date <  make_date($1::int + 1, 1, 1)
          ),0)::float AS extra_spent
      `, [year]),
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

// GET /api/reports/production?year=2026
const productionOverview = async (req, res, next) => {
  try {
    const year = req.query.year || new Date().getFullYear();

    const [monthly, byEmployee, statusBreakdown, completion, productProgress, lateProducts] = await Promise.all([
      // Monthly orders created + completed
      pool.query(`
        SELECT
          EXTRACT(MONTH FROM created_at)::int AS month,
          COUNT(*)::int AS total,
          SUM(CASE WHEN status IN ('done','shipped') THEN 1 ELSE 0 END)::int AS completed,
          COALESCE(SUM(quantity), 0)::int AS units_ordered,
          COALESCE(SUM(produced_qty), 0)::int AS units_produced
        FROM production_orders
        WHERE created_at >= make_date($1::int, 1, 1)::timestamp
          AND created_at <  make_date($1::int + 1, 1, 1)::timestamp
        GROUP BY month ORDER BY month
      `, [year]),

      // Top 5 employees by orders assigned
      pool.query(`
        SELECT e.name,
               COUNT(po.id)::int AS orders,
               COALESCE(SUM(po.produced_qty),0)::int AS units_produced
        FROM employees e
        JOIN production_orders po ON po.assigned_to = e.id
        WHERE po.created_at >= make_date($1::int, 1, 1)::timestamp
          AND po.created_at <  make_date($1::int + 1, 1, 1)::timestamp
        GROUP BY e.id, e.name
        ORDER BY orders DESC LIMIT 5
      `, [year]),

      // Status breakdown
      pool.query(`
        SELECT status, COUNT(*)::int AS count
        FROM production_orders
        WHERE created_at >= make_date($1::int, 1, 1)::timestamp
          AND created_at <  make_date($1::int + 1, 1, 1)::timestamp
        GROUP BY status
      `, [year]),

      // Overall completion rate
      pool.query(`
        SELECT
          COUNT(*)::int AS total,
          SUM(CASE WHEN status IN ('done','shipped') THEN 1 ELSE 0 END)::int AS done,
          COALESCE(SUM(quantity),0)::int    AS total_units,
          COALESCE(SUM(produced_qty),0)::int AS produced_units
        FROM production_orders
        WHERE created_at >= make_date($1::int, 1, 1)::timestamp
          AND created_at <  make_date($1::int + 1, 1, 1)::timestamp
      `, [year]),

      // Detailed product progress for the year
      pool.query(`
        SELECT
          product_name,
          COUNT(*)::int AS orders,
          COALESCE(SUM(quantity),0)::int AS units_ordered,
          COALESCE(SUM(produced_qty),0)::int AS units_produced,
          GREATEST(COALESCE(SUM(quantity),0) - COALESCE(SUM(produced_qty),0), 0)::int AS units_remaining,
          CASE
            WHEN COALESCE(SUM(quantity),0) > 0
              THEN ROUND((COALESCE(SUM(produced_qty),0)::numeric / NULLIF(COALESCE(SUM(quantity),0),0)) * 100, 1)
            ELSE 0
          END::float AS completion_rate,
          SUM(CASE
            WHEN due_date IS NOT NULL
             AND due_date < CURRENT_DATE
             AND status NOT IN ('done','shipped')
              THEN 1
            ELSE 0
          END)::int AS late_orders,
          COALESCE(SUM(CASE
            WHEN due_date IS NOT NULL
             AND due_date < CURRENT_DATE
             AND status NOT IN ('done','shipped')
              THEN GREATEST(quantity - produced_qty, 0)
            ELSE 0
          END), 0)::int AS late_units,
          MIN(due_date) FILTER (
            WHERE due_date IS NOT NULL
              AND due_date < CURRENT_DATE
              AND status NOT IN ('done','shipped')
          )::date AS earliest_late_due_date
        FROM production_orders
        WHERE created_at >= make_date($1::int, 1, 1)::timestamp
          AND created_at <  make_date($1::int + 1, 1, 1)::timestamp
        GROUP BY product_name
        ORDER BY units_remaining DESC, product_name ASC
      `, [year]),

      // Late products snapshot
      pool.query(`
        SELECT
          product_name,
          COUNT(*)::int AS late_orders,
          COALESCE(SUM(GREATEST(quantity - produced_qty, 0)),0)::int AS late_units,
          MIN(due_date)::date AS oldest_due_date
        FROM production_orders
        WHERE created_at >= make_date($1::int, 1, 1)::timestamp
          AND created_at <  make_date($1::int + 1, 1, 1)::timestamp
          AND due_date IS NOT NULL
          AND due_date < CURRENT_DATE
          AND status NOT IN ('done','shipped')
        GROUP BY product_name
        ORDER BY oldest_due_date ASC, late_units DESC
      `, [year]),
    ]);

    res.json({
      monthly:          monthly.rows,
      by_employee:      byEmployee.rows,
      status_breakdown: statusBreakdown.rows,
      completion:       completion.rows[0],
      product_progress: productProgress.rows,
      late_products:    lateProducts.rows,
    });
  } catch (err) { next(err); }
};

// GET /api/reports/hr?year=2026&month=3
const hrOverview = async (req, res, next) => {
  try {
    const year  = req.query.year  || new Date().getFullYear();
    const month = req.query.month || new Date().getMonth() + 1;

    const [attendanceSummary, byDepartment, payrollSummary, topHours, payrollHistory] = await Promise.all([
      // Attendance breakdown for month â€” date range avoids function wrapper on indexed date column
      pool.query(`
        SELECT status, COUNT(*)::int AS count
        FROM attendance
        WHERE date >= make_date($2::int, $1::int, 1)
          AND date <  make_date($2::int, $1::int, 1) + INTERVAL '1 month'
        GROUP BY status
      `, [month, year]),

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
        WHERE a.date >= make_date($2::int, $1::int, 1)
          AND a.date <  make_date($2::int, $1::int, 1) + INTERVAL '1 month'
        GROUP BY d.id, d.name
        ORDER BY present DESC
      `, [month, year]),

      // Payroll summary for month (month/year are integer columns â€” no EXTRACT needed)
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
        WHERE month = $1 AND year = $2
      `, [month, year]),

      // Top 5 employees by hours worked
      pool.query(`
        SELECT e.name,
               COALESCE(SUM(a.hours_worked),0)::float AS total_hours,
               COUNT(a.id)::int AS days_logged
        FROM employees e
        LEFT JOIN attendance a ON a.employee_id = e.id
          AND a.date >= make_date($2::int, $1::int, 1)
          AND a.date <  make_date($2::int, $1::int, 1) + INTERVAL '1 month'
        GROUP BY e.id, e.name
        ORDER BY total_hours DESC LIMIT 5
      `, [month, year]),

      // Monthly payroll spend history for the selected year (integer columns â€” no EXTRACT needed)
      pool.query(`
        SELECT
          month::int,
          COUNT(*)::int AS total_records,
          SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END)::int AS paid_records,
          COALESCE(SUM(net_salary),0)::float AS total_payout,
          COALESCE(SUM(CASE WHEN status='paid' THEN net_salary ELSE 0 END),0)::float AS paid_payout,
          COALESCE(SUM(CASE WHEN status='pending' THEN net_salary ELSE 0 END),0)::float AS pending_payout
        FROM payroll
        WHERE year = $1
        GROUP BY month
        ORDER BY month
      `, [year]),
    ]);

    res.json({
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

module.exports = { salesOverview, createSalesExpense, productionOverview, hrOverview, inventoryOverview };
