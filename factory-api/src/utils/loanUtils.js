const normalizeLoanPayload = (data = {}) => {
  const employee_id = Number(data.employee_id);
  const principal_amount = Number(data.principal_amount);
  const monthly_installment = Number(data.monthly_installment);

  return {
    employee_id: Number.isFinite(employee_id) ? employee_id : 0,
    principal_amount: Number.isFinite(principal_amount) ? principal_amount : 0,
    remaining_amount: Number.isFinite(principal_amount) ? principal_amount : 0,
    monthly_installment: Number.isFinite(monthly_installment) ? monthly_installment : 0,
    status: data.status || 'active',
  };
};

module.exports = {
  normalizeLoanPayload,
};
