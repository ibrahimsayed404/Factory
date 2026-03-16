const deviceAuthenticate = (req, res, next) => {
  const expected = process.env.DEVICE_INGEST_API_KEY;
  if (!expected) {
    return res.status(500).json({ error: 'DEVICE_INGEST_API_KEY is not configured' });
  }

  const provided = req.headers['x-device-api-key'];
  if (!provided || provided !== expected) {
    return res.status(401).json({ error: 'Invalid device API key' });
  }

  next();
};

module.exports = { deviceAuthenticate };
