const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

const dashboard = require('../controllers/dashboardController');

router.get('/dashboard/stats', authenticate, dashboard.getStats);
router.get('/dashboard/stage-efficiency', authenticate, dashboard.getStageEfficiency);

module.exports = router;
