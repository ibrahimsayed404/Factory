const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const dashboardRoutes = require('./dashboard.routes');
const reportsRoutes = require('./reports.routes');
const inventoryRoutes = require('./inventory.routes');
const employeeRoutes = require('./employee.routes');
const payrollRoutes = require('./payroll.routes');
const productRoutes = require('./product.routes');
const settingsRoutes = require('./settings.routes');
const salesRoutes = require('./sales.routes');
const productionRoutes = require('./production.routes');
const productionTrackingRoutes = require('./productionTracking.routes');
const purchasingRoutes = require('./purchasing.routes');
const manufacturingRoutes = require('./manufacturing.routes');
const qcRoutes = require('./qc.routes');
const hrRoutes = require('./hr.routes');
const accountingRoutes = require('./accounting.routes');

router.use('/', authRoutes);
router.use('/', dashboardRoutes);
router.use('/', employeeRoutes);
router.use('/', salesRoutes);
router.use('/', productRoutes);
router.use('/', productionRoutes);
router.use('/', productionTrackingRoutes);
router.use('/', payrollRoutes);
router.use('/', qcRoutes);
router.use('/', reportsRoutes);
router.use('/', settingsRoutes);
router.use('/', inventoryRoutes);
router.use('/purchasing', purchasingRoutes);
router.use('/manufacturing', manufacturingRoutes);
router.use('/hr', hrRoutes);
router.use('/accounting', accountingRoutes);

module.exports = router;
