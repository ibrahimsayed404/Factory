const { translateKnownErrorMessage } = require('../utils/i18n');

const errorHandler = (err, req, res, _next) => { // eslint-disable-line no-unused-vars
  // Use a logger here in production (e.g., winston or pino)
  if (process.env.NODE_ENV !== 'test') {
    console.error(err.stack);
  }
  const status = err.status || 500;
  const fallbackError = req.t('errors.internal', 'Internal server error');
  const response = {
    error: translateKnownErrorMessage(req.lang, err.message || fallbackError),
  };
  if (err.details !== undefined) {
    response.details = err.details;
  }
  // Only show stack in development
  if (process.env.NODE_ENV === 'development' && err.stack) {
    response.stack = err.stack;
  }
  res.status(status).json(response);
};

module.exports = errorHandler;
