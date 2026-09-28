// Shared payroll formatting helpers used by both the on-screen breakdown and the
// PDF export so the two never drift apart.

/**
 * Format a minute count as "Nh Nm" (or "Nm" under an hour). Negative and
 * non-finite inputs are clamped to 0.
 * @param {number} minutes
 * @returns {string}
 */
export const formatMinutes = (minutes) => {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  if (total === 0) return '0';
  if (total < 60) return `${total}m`;
  const hours = Math.floor(total / 60);
  const remainingMinutes = total % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
};

/**
 * Format a numeric amount as USD currency with a fixed 2 decimal places,
 * independent of the browser's runtime locale.
 * @param {number} amount
 * @returns {string} e.g. "$1,234.50"
 */
export const formatCurrency = (amount) => {
  const value = Number(amount) || 0;
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};
