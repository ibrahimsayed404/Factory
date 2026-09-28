// electron-builder never copies node_modules through extraResources, so copy the
// staged API's production dependencies into the packaged app ourselves.
const fs = require('node:fs');
const path = require('node:path');

exports.default = async (context) => {
  const from = path.join(__dirname, '..', '.stage', 'factory-api', 'node_modules');
  const to = path.join(context.appOutDir, 'resources', 'factory-api', 'node_modules');
  if (!fs.existsSync(from)) throw new Error('Staged API dependencies missing; run node scripts/stage-api.js');
  fs.cpSync(from, to, { recursive: true });
};
