const app = require('../factory-api/src/app');

module.exports = (req, res) => {
  return app(req, res);
};
