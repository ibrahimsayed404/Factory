let app;
let initError;

try {
  app = require('../factory-api/src/app');
} catch (err) {
  initError = err;
  console.error('Failed to load Express app:', err);
}

module.exports = (req, res) => {
  if (initError || !app) {
    return res.status(500).json({
      error: 'Failed to initialize application',
      details: initError ? initError.message : 'App module not loaded',
      stack: initError ? initError.stack : null,
    });
  }
  return app(req, res);
};
