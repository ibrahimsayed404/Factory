const { detectLanguage, translate } = require('../utils/i18n');

const i18n = (req, res, next) => {
  req.lang = detectLanguage(req);
  req.t = (key, fallback = '') => translate(req.lang, key, fallback);
  res.setHeader('Content-Language', req.lang);
  next();
};

module.exports = i18n;
