const ApiError = require('../utils/ApiError');
const {
  getAttendancePayrollPolicy,
  updateAttendancePayrollPolicy,
} = require('../utils/policySettings');

const getAttendancePayroll = async (_req, res, next) => {
  try {
    const policy = await getAttendancePayrollPolicy();
    res.json(policy);
  } catch (err) {
    next(err);
  }
};

const updateAttendancePayroll = async (req, res, next) => {
  try {
    const payload = {
      attendanceLateGraceMinutes: req.body.attendance_late_grace_minutes,
      payrollOvertimeMultiplier: req.body.payroll_overtime_multiplier,
      payrollVacationOvertimeMultiplier: req.body.payroll_vacation_overtime_multiplier,
      payrollWeeksPerMonth: req.body.payroll_weeks_per_month,
    };

    const hasAtLeastOne = Object.values(payload).some((value) => value !== undefined);
    if (!hasAtLeastOne) {
      throw new ApiError(400, 'Provide at least one policy field to update');
    }

    const policy = await updateAttendancePayrollPolicy(payload);
    res.json(policy);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAttendancePayroll,
  updateAttendancePayroll,
};
