const { translateKnownErrorMessage } = require('../utils/i18n');

const errorHandler = (err, req, res, _next) => { // eslint-disable-line no-unused-vars
  if (process.env.NODE_ENV !== 'test') {
    console.error(err.stack || err);
  }
  const status = err.status || 500;
  const fallbackError = typeof req?.t === 'function' ? req.t('errors.internal', 'Internal server error') : 'Internal server error';
  const rawMessage = err.message || fallbackError;
  const errorMsg = req?.lang ? translateKnownErrorMessage(req.lang, rawMessage) : rawMessage;
  const response = { error: errorMsg };

  if (err.details !== undefined) {
    response.details = err.details;
  }
  if (process.env.NODE_ENV === 'development' && err.stack) {
    response.stack = err.stack;
  }
  res.status(status).json(response);
};

module.exports = errorHandler;
