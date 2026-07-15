const { normalizeLoanPayload } = require('../../src/utils/loanUtils');

describe('normalizeLoanPayload', () => {
  it('converts and defaults loan values for a new loan', () => {
    const payload = normalizeLoanPayload({
      employee_id: 7,
      principal_amount: '12000',
      monthly_installment: '1000',
      status: 'active',
    });

    expect(payload).toEqual({
      employee_id: 7,
      principal_amount: 12000,
      remaining_amount: 12000,
      monthly_installment: 1000,
      status: 'active',
    });
  });

  it('uses zero values when numeric inputs are invalid', () => {
    const payload = normalizeLoanPayload({ employee_id: 3, principal_amount: 'abc', monthly_installment: '' });

    expect(payload).toEqual({
      employee_id: 3,
      principal_amount: 0,
      remaining_amount: 0,
      monthly_installment: 0,
      status: 'active',
    });
  });
});
