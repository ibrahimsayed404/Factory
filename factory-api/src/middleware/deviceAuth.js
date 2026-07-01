const crypto = require('crypto');

// SECURITY: Use crypto.timingSafeEqual() for API key comparison
// to prevent timing attacks that could leak the key character by character.
const deviceAuthenticate = (req, res, next) => {
  const expected = process.env.DEVICE_INGEST_API_KEY;
  if (!expected) {
    return res.status(500).json({ error: 'DEVICE_INGEST_API_KEY is not configured' });
  }

  const provided = req.headers['x-device-api-key'];
  if (!provided) {
    return res.status(401).json({ error: 'Invalid device API key' });
  }

  // Both buffers must be the same length for timingSafeEqual
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(String(provided));

  if (expectedBuf.length !== providedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, providedBuf)) {
    return res.status(401).json({ error: 'Invalid device API key' });
  }

  next();
};

module.exports = { deviceAuthenticate };
