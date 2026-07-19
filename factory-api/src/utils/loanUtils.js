const ApiError = require('./ApiError');

const LOAN_STATUSES = ['active', 'closed'];

const requirePositiveNumber = (value, field) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    throw new ApiError(400, `${field} must be a non-negative number`);
  }
  return num;
};

const normalizeLoanPayload = (data = {}) => {
  const employee_id = Number(data.employee_id);
  if (!Number.isInteger(employee_id) || employee_id <= 0) {
    throw new ApiError(400, 'employee_id must be a valid positive integer');
  }
  const principal_amount = requirePositiveNumber(data.principal_amount, 'principal_amount');
  const monthly_installment = requirePositiveNumber(data.monthly_installment, 'monthly_installment');
  if (monthly_installment <= 0) {
    throw new ApiError(400, 'monthly_installment must be greater than 0');
  }

  const status = data.status || 'active';
  if (!LOAN_STATUSES.includes(status)) {
    throw new ApiError(400, `status must be one of: ${LOAN_STATUSES.join(', ')}`);
  }

  return {
    employee_id,
    principal_amount,
    remaining_amount: principal_amount,
    monthly_installment,
    status,
  };
};

// Fields an existing loan may be updated with. remaining_amount is allowed so an
// admin can correct a balance; status is enum-checked.
const normalizeLoanUpdatePayload = (data = {}) => {
  const update = {};
  if (data.employee_id !== undefined) {
    const empId = Number(data.employee_id);
    if (!Number.isInteger(empId) || empId <= 0) {
      throw new ApiError(400, 'employee_id must be a valid positive integer');
    }
    update.employee_id = empId;
  }
  if (data.principal_amount !== undefined) update.principal_amount = requirePositiveNumber(data.principal_amount, 'principal_amount');
  if (data.remaining_amount !== undefined) update.remaining_amount = requirePositiveNumber(data.remaining_amount, 'remaining_amount');
  if (data.monthly_installment !== undefined) {
    const mi = requirePositiveNumber(data.monthly_installment, 'monthly_installment');
    if (mi <= 0) throw new ApiError(400, 'monthly_installment must be greater than 0');
    update.monthly_installment = mi;
  }
  if (data.status !== undefined) {
    if (!LOAN_STATUSES.includes(data.status)) {
      throw new ApiError(400, `status must be one of: ${LOAN_STATUSES.join(', ')}`);
    }
    update.status = data.status;
  }
  if (Object.keys(update).length === 0) {
    throw new ApiError(400, 'No valid loan fields to update');
  }
  return update;
};

module.exports = {
  LOAN_STATUSES,
  normalizeLoanPayload,
  normalizeLoanUpdatePayload,
};
