const express = require('express');
const router = express.Router();
const qcController = require('../controllers/qcController');
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const { qcPhotoUpload, validateEvidenceSignature } = require('../middleware/upload');

// Public or basic authenticated routes for inspectors
router.get('/qc/defect-categories', authenticate, qcController.getDefectCategories);
router.get('/qc/inspections', authenticate, qcController.getAll);
router.get('/qc/inspections/:id', authenticate, qcController.getById);
router.post('/qc/inspections', authenticate, qcController.create);
router.put('/qc/inspections/:id/results', authenticate, qcController.updateResults);

// Photo upload endpoint
router.post(
  '/qc/inspections/:id/photos',
  authenticate,
  qcPhotoUpload.single('photo'),
  validateEvidenceSignature,
  qcController.addPhoto
);

// Reports - might need higher privileges
router.get('/qc/reports', authenticate, qcController.getReports);

module.exports = router;
