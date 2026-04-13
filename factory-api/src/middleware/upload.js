const fs = require('fs');
const path = require('path');
const multer = require('multer');

const evidenceDir = path.join(__dirname, '..', '..', 'uploads', 'payment-evidence');
fs.mkdirSync(evidenceDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, evidenceDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ext || '.bin';
    cb(null, `payment-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  },
});

const allowedMimes = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

const paymentEvidenceUpload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (allowedMimes.has(file.mimetype)) return cb(null, true);
    const err = new Error('Evidence file must be a PDF or image (png, jpg, jpeg, webp)');
    err.status = 400;
    return cb(err);
  },
});

// Magic-byte signatures for each allowed MIME type.
// Returns true when the header Buffer matches the expected signature.
const signatureMatches = (buf, mime) => {
  if (mime === 'application/pdf') {
    // %PDF
    return buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;
  }
  if (mime === 'image/jpeg' || mime === 'image/jpg') {
    // FF D8 FF
    return buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
  }
  if (mime === 'image/png') {
    // 89 50 4E 47 0D 0A 1A 0A
    return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47
      && buf[4] === 0x0D && buf[5] === 0x0A && buf[6] === 0x1A && buf[7] === 0x0A;
  }
  if (mime === 'image/webp') {
    // RIFF????WEBP
    const riff = buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46;
    const webp = buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
    return riff && webp;
  }
  return false;
};

// Post-upload middleware: validates the file bytes against the declared MIME type.
// Must run after paymentEvidenceUpload.single().
const validateEvidenceSignature = (req, res, next) => {
  if (!req.file) return next(); // no file uploaded — validation skipped (optional field)
  const { path: filePath, mimetype } = req.file;
  try {
    const fd = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(12);
    fs.readSync(fd, header, 0, 12, 0);
    fs.closeSync(fd);
    if (!signatureMatches(header, mimetype)) {
      fs.unlinkSync(filePath);
      const err = new Error('Uploaded file content does not match its declared type');
      err.status = 400;
      return next(err);
    }
    next();
  } catch (e) {
    try { fs.unlinkSync(filePath); } catch (_) { void 0; }
    next(e);
  }
};

module.exports = {
  paymentEvidenceUpload,
  validateEvidenceSignature,
};
