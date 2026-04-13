
const { body, param, validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');
const { translateValidationMessage } = require('../utils/i18n');

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Optionally log validation errors here
    return next(
      new ApiError(
        400,
        req.t('errors.validation_failed', 'Validation failed'),
        errors.array().map((e) => ({ field: e.path, message: translateValidationMessage(req.lang, e.msg) }))
      )
    );
  }
  next();
};

const idParam = [
  param('id').isInt({ min: 1 }).withMessage('id must be a positive integer'),
  handleValidation,
];

const authRegister = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('name is required'),
  body('email').isEmail().withMessage('valid email is required').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('password must be at least 8 characters'),
  handleValidation,
];

const authLogin = [
  body('email').isEmail().withMessage('valid email is required').normalizeEmail(),
  body('password').isString().notEmpty().withMessage('password is required'),
  handleValidation,
];

const authRefresh = [
  body('refreshToken').isString().notEmpty().withMessage('refreshToken is required'),
  handleValidation,
];

const inventoryUpsert = [
  body('name').trim().isLength({ min: 2, max: 150 }).withMessage('name is required'),
  body('unit').trim().isLength({ min: 1, max: 30 }).withMessage('unit is required'),
  body('quantity').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('quantity must be >= 0'),
  body('min_quantity').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('min_quantity must be >= 0'),
  body('cost_per_unit').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('cost_per_unit must be >= 0'),
  handleValidation,
];

const employeeUpsert = [
  body('name').trim().isLength({ min: 2, max: 150 }).withMessage('name is required'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('email must be valid').normalizeEmail(),
  body('department_id').optional({ checkFalsy: true }).isInt({ min: 1 }).withMessage('department_id must be valid'),
  body('shift').optional({ checkFalsy: true }).isIn(['morning', 'evening', 'night']).withMessage('invalid shift'),
  body('shift_start').optional({ checkFalsy: true }).matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('shift_start must be HH:MM'),
  body('shift_end').optional({ checkFalsy: true }).matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('shift_end must be HH:MM'),
  body('weekend_days').optional({ checkFalsy: true }).matches(/^[0-6](,[0-6])*$/).withMessage('weekend_days must be comma-separated day indexes (0-6)'),
  body('device_user_id').optional({ checkFalsy: true }).isLength({ max: 100 }).withMessage('device_user_id is too long'),
  body('salary').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('salary must be >= 0'),
  body('status').optional({ checkFalsy: true }).isIn(['active', 'inactive']).withMessage('invalid status'),
  handleValidation,
];

const attendanceUpsert = [
  body('date').isISO8601().withMessage('date must be ISO format (YYYY-MM-DD)'),
  body('status').optional({ checkFalsy: true }).isIn(['present', 'absent', 'late', 'half-day']).withMessage('invalid attendance status'),
  body('hours_worked').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0, max: 24 }).withMessage('hours_worked must be between 0 and 24'),
  handleValidation,
];

const payrollCreate = [
  body('employee_id').isInt({ min: 1 }).withMessage('employee_id is required'),
  body('week_start').optional({ checkFalsy: true }).isISO8601().withMessage('week_start must be YYYY-MM-DD'),
  body('month').optional({ checkFalsy: true }).isInt({ min: 1, max: 12 }).withMessage('month must be between 1 and 12'),
  body('year').optional({ checkFalsy: true }).isInt({ min: 2000, max: 2100 }).withMessage('year must be valid'),
  body().custom((value) => {
    const hasWeekStart = Boolean(value.week_start);
    const hasMonth = value.month !== undefined && value.month !== null && value.month !== '';
    const hasYear = value.year !== undefined && value.year !== null && value.year !== '';
    if (!hasWeekStart && hasMonth !== hasYear) {
      throw new Error('Provide both month and year together, or omit both for default weekly Saturday period');
    }
    return true;
  }),
  body('bonus').optional({ nullable: true }).isFloat().withMessage('bonus must be numeric'),
  body('deductions').optional({ nullable: true }).isFloat().withMessage('deductions must be numeric'),
  handleValidation,
];

const customerCreate = [
  body('name').trim().isLength({ min: 2, max: 150 }).withMessage('name is required'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('email must be valid').normalizeEmail(),
  handleValidation,
];

const customerPaymentCreate = [
  body('payment_date').optional({ checkFalsy: true }).isISO8601().withMessage('payment_date must be YYYY-MM-DD'),
  body('amount').isFloat({ min: 0.01 }).withMessage('amount must be greater than 0'),
  body('notes').optional({ nullable: true }).isLength({ max: 500 }).withMessage('notes is too long'),
  handleValidation,
];

const salesExpenseCreate = [
  body('expense_date').optional({ checkFalsy: true }).isISO8601().withMessage('expense_date must be YYYY-MM-DD'),
  body('amount').isFloat({ min: 0.01 }).withMessage('amount must be greater than 0'),
  body('category').optional({ nullable: true }).isLength({ max: 100 }).withMessage('category is too long'),
  body('notes').optional({ nullable: true }).isLength({ max: 500 }).withMessage('notes is too long'),
  handleValidation,
];

const salesCreate = [
  body('customer_id').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }).withMessage('customer_id must be valid'),
  body('delivery_date').optional({ checkFalsy: true }).isISO8601().withMessage('delivery_date must be YYYY-MM-DD'),
  body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array'),
  body('items.*.product_name').trim().isLength({ min: 1, max: 150 }).withMessage('product_name is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('quantity must be at least 1'),
  body('items.*.unit_price').isFloat({ min: 0 }).withMessage('unit_price must be >= 0'),
  handleValidation,
];

const salesStatusUpdate = [
  body('status').optional().isIn(['new', 'confirmed', 'shipped', 'delivered', 'cancelled']).withMessage('invalid status'),
  body('payment_status').optional().isIn(['pending', 'invoiced', 'paid']).withMessage('invalid payment_status'),
  body('paid_amount').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('paid_amount must be >= 0'),
  handleValidation,
];

const productionCreate = [
  body('product_name').trim().isLength({ min: 1, max: 150 }).withMessage('product_name is required'),
  body('quantity').isInt({ min: 1 }).withMessage('quantity must be at least 1'),
  body('assigned_to').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }).withMessage('assigned_to must be valid'),
  body('sales_order_id').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }).withMessage('sales_order_id must be valid'),
  body('materials').optional().isArray().withMessage('materials must be an array'),
  body('materials.*.material_id').optional().isInt({ min: 1 }).withMessage('material_id must be valid'),
  body('materials.*.quantity_used').optional().isFloat({ min: 0.01 }).withMessage('quantity_used must be > 0'),
  handleValidation,
];

const productionStatusUpdate = [
  body('status').optional().isIn(['pending', 'in_progress', 'done', 'shipped']).withMessage('invalid status'),
  body('produced_qty').optional({ nullable: true }).isInt({ min: 0 }).withMessage('produced_qty must be >= 0'),
  handleValidation,
];

const productionTrackingCreate = [
  body('model_number').trim().isLength({ min: 1, max: 100 }).withMessage('model_number is required'),
  body('quantity').isInt({ min: 1 }).withMessage('quantity must be at least 1'),
  body('materials').optional().isArray().withMessage('materials must be an array'),
  body('materials.*.material_id').optional().isInt({ min: 1 }).withMessage('material_id must be valid'),
  body('materials.*.quantity').optional().isFloat({ min: 0.01 }).withMessage('quantity must be > 0'),
  handleValidation,
];

const productionTrackingPhase = [
  body('quantity').isInt({ min: 0 }).withMessage('quantity must be >= 0'),
  body('loss_reason').optional({ nullable: true, checkFalsy: true }).isLength({ max: 500 }).withMessage('loss_reason is too long'),
  body('employee_id').isInt({ min: 1 }).withMessage('employee_id is required'),
  body('machine_id').optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }).withMessage('machine_id must be valid'),
  body('started_at').isISO8601().withMessage('started_at must be a valid ISO timestamp'),
  body('completed_at').isISO8601().withMessage('completed_at must be a valid ISO timestamp'),
  body().custom((value) => {
    const started = new Date(value.started_at);
    const completed = new Date(value.completed_at);
    if (Number.isNaN(started.getTime()) || Number.isNaN(completed.getTime())) {
      throw new TypeError('started_at and completed_at must be valid ISO timestamps');
    }
    if (completed <= started) {
      throw new Error('completed_at must be greater than started_at');
    }
    return true;
  }),
  handleValidation,
];

const settingsAttendancePayrollUpdate = [
  body('attendance_late_grace_minutes').optional().isInt({ min: 0, max: 180 }).withMessage('attendance_late_grace_minutes must be between 0 and 180'),
  body('payroll_overtime_multiplier').optional().isFloat({ min: 1, max: 5 }).withMessage('payroll_overtime_multiplier must be between 1 and 5'),
  body('payroll_vacation_overtime_multiplier').optional().isFloat({ min: 0, max: 5 }).withMessage('payroll_vacation_overtime_multiplier must be between 0 and 5'),
  body('payroll_weeks_per_month').optional().isFloat({ min: 1, max: 6 }).withMessage('payroll_weeks_per_month must be between 1 and 6'),
  handleValidation,
];

module.exports = {
  handleValidation,
  idParam,
  authRegister,
  authLogin,
  authRefresh,
  inventoryUpsert,
  employeeUpsert,
  attendanceUpsert,
  payrollCreate,
  customerCreate,
  customerPaymentCreate,
  salesExpenseCreate,
  salesCreate,
  salesStatusUpdate,
  productionCreate,
  productionStatusUpdate,
  productionTrackingCreate,
  productionTrackingPhase,
  settingsAttendancePayrollUpdate,
};
