const path = require('path');

// Root folder for uploaded files. UPLOADS_DIR lets the desktop app keep uploads
// in a persistent, writable per-user folder instead of next to the app code.
const uploadsRoot = () => process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads');

const uploadsPath = (...parts) => path.join(uploadsRoot(), ...parts);

module.exports = { uploadsRoot, uploadsPath };
