const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : null;
  const cookieToken = req.cookies?.token;
  const token = bearerToken || cookieToken;

  if (!token) {
    return res.status(401).json({ error: req.t('errors.no_token', 'No token provided') });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: req.t('errors.invalid_or_expired_token', 'Invalid or expired token') });
  }
};

const authorizeAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: req.t('errors.admin_required', 'Admin access required') });
  }
  next();
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: req.t('errors.forbidden', 'Forbidden: Insufficient privileges') });
    }
    next();
  };
};

// Allow a request from the Vercel Cron (which sends `Authorization: Bearer
// <CRON_SECRET>` when CRON_SECRET is configured) OR an authenticated admin.
// Blocks anonymous callers — the point of securing /payroll/auto-run — while
// keeping the scheduled cron working.
const authorizeCronOrAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (process.env.CRON_SECRET && bearer && bearer === process.env.CRON_SECRET) {
    return next();
  }
  return authenticate(req, res, () => authorizeAdmin(req, res, next));
};

module.exports = { authenticate, authorizeAdmin, authorize, authorizeCronOrAdmin };
