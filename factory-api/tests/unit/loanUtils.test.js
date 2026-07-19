const { normalizeLoanPayload, normalizeLoanUpdatePayload } = require('../../src/utils/loanUtils');

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

  it('rejects invalid numeric inputs instead of silently coercing to zero', () => {
    expect(() => normalizeLoanPayload({ employee_id: 3, principal_amount: 'abc', monthly_installment: '' }))
      .toThrow(/principal_amount must be a non-negative number/);
  });

  it('rejects a zero monthly installment', () => {
    expect(() => normalizeLoanPayload({ employee_id: 3, principal_amount: 1000, monthly_installment: 0 }))
      .toThrow(/monthly_installment must be greater than 0/);
  });

  it('rejects an invalid employee id', () => {
    expect(() => normalizeLoanPayload({ employee_id: 0, principal_amount: 1000, monthly_installment: 100 }))
      .toThrow(/employee_id must be a valid positive integer/);
  });

  it('rejects an unknown status', () => {
    expect(() => normalizeLoanPayload({ employee_id: 3, principal_amount: 1000, monthly_installment: 100, status: 'paid_off' }))
      .toThrow(/status must be one of/);
  });
});

describe('normalizeLoanUpdatePayload', () => {
  it('returns only the provided fields', () => {
    expect(normalizeLoanUpdatePayload({ remaining_amount: '500', status: 'closed' }))
      .toEqual({ remaining_amount: 500, status: 'closed' });
  });

  it('rejects an empty update', () => {
    expect(() => normalizeLoanUpdatePayload({})).toThrow(/No valid loan fields to update/);
  });

  it('rejects an unknown status on update', () => {
    expect(() => normalizeLoanUpdatePayload({ status: 'weird' })).toThrow(/status must be one of/);
  });
});
