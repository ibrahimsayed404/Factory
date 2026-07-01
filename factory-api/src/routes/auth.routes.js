const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { deviceAuthenticate } = require('../middleware/deviceAuth');
const v = require('../middleware/validation');

const auth = require('../controllers/authController');
const device = require('../controllers/deviceController');

// Device ingestion (API-key protected)
router.post('/device/punch-events', deviceAuthenticate, device.ingestPunchEvents);

// Auth (public)
router.post('/auth/register', v.authRegister, auth.register);
router.post('/auth/login', v.authLogin, auth.login);
router.post('/auth/refresh', v.authRefresh, auth.refresh);
router.get('/auth/me', authenticate, auth.me);
router.post('/auth/logout', authenticate, auth.logout);

module.exports = router;
