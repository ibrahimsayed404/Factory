const pool = require('../../config/db');

const getStats = async (req, res, next) => {
  try {
    const [orders, revenue, employees, lowStock, production, monthlySpend] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM sales_orders WHERE status NOT IN ('cancelled','delivered')`),
      pool.query(`SELECT COALESCE(SUM(amount),0) AS total FROM customer_payments
                  WHERE date_trunc('month', payment_date) = date_trunc('month', NOW())`),
      pool.query(`SELECT COUNT(*) FROM employees WHERE status='active'`),
      pool.query(`SELECT COUNT(*) FROM materials WHERE quantity <= min_quantity`),
      pool.query(`SELECT status, COUNT(*) FROM production_orders GROUP BY status`),
      // Monthly spend = paid payroll + material cost + extra expenses (mirrors Reports formula)
      pool.query(`
        SELECT
          COALESCE((
            SELECT SUM(net_salary)
            FROM payroll
            WHERE status = 'paid'
              AND paid_at IS NOT NULL
              AND date_trunc('month', paid_at) = date_trunc('month', NOW())
          ), 0)::float AS payroll_spent,
          COALESCE((
            SELECT SUM(pm.quantity_used * COALESCE(m.cost_per_unit, 0))
            FROM production_materials pm
            JOIN production_orders po ON po.id = pm.production_order_id
            LEFT JOIN materials m ON m.id = pm.material_id
            WHERE date_trunc('month', po.created_at) = date_trunc('month', NOW())
          ), 0)::float AS materials_spent,
          COALESCE((
            SELECT SUM(amount)
            FROM business_expenses
            WHERE date_trunc('month', expense_date) = date_trunc('month', NOW())
          ), 0)::float AS extra_spent
      `),
    ]);

    const monthlyRevenue = parseFloat(revenue.rows[0].total);
    const spend = monthlySpend.rows[0];
    const payrollSpent    = parseFloat(spend.payroll_spent);
    const materialsSpent  = parseFloat(spend.materials_spent);
    const extraSpent      = parseFloat(spend.extra_spent);
    const totalSpent      = payrollSpent + materialsSpent + extraSpent;

    res.json({
      active_orders:     parseInt(orders.rows[0].count),
      monthly_revenue:   monthlyRevenue,
      monthly_spent:     totalSpent,
      payroll_spent:     payrollSpent,
      paid_payroll_spent: payrollSpent,
      materials_spent:   materialsSpent,
      extra_spent:       extraSpent,
      monthly_net:       monthlyRevenue - totalSpent,
      active_employees:  parseInt(employees.rows[0].count),
      low_stock_alerts:  parseInt(lowStock.rows[0].count),
      production_summary: production.rows,
    });
  } catch (err) { next(err); }
};

module.exports = { getStats };
