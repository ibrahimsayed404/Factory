const express = require('express');
const router = express.Router();
const qcController = require('../controllers/qcController');
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const { qcPhotoUpload, validateEvidenceSignature } = require('../middleware/upload');

const path = require('node:path');
const fsPromises = require('node:fs').promises;
const storageService = require('../services/storageService');

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

// Authenticated QC photo download
router.get('/uploads/qc-photos/:filename', authenticate, async (req, res, next) => {
  try {
    const { filename } = req.params;
    if (!filename || /[/\\]/.test(filename) || filename.includes('..')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    const filePath = path.join(__dirname, '..', '..', 'uploads', 'qc-photos', filename);
    try {
      await fsPromises.access(filePath);
      return res.sendFile(filePath);
    } catch {
      // Local file not found — try Supabase cloud redirect
      const cloudUrl = storageService.getCloudUrl('qc-photos', filename);
      if (cloudUrl) return res.redirect(cloudUrl);
      return res.status(404).json({ error: 'File not found' });
    }
  } catch (err) {
    next(err);
  }
});

// Reports - might need higher privileges
router.get('/qc/reports', authenticate, qcController.getReports);

module.exports = router;

