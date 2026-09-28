const fs = require('fs');
const path = require('path');

const target = (process.argv[2] || '').toLowerCase();
const root = path.join(__dirname, '..');

if (target === 'local') {
  if (!fs.existsSync(path.join(root, '.env.local'))) {
    console.error('.env.local not found');
    process.exit(1);
  }
  if (fs.existsSync(path.join(root, '.env')) && !fs.existsSync(path.join(root, '.env.production'))) {
    fs.copyFileSync(path.join(root, '.env'), path.join(root, '.env.production'));
  }
  fs.copyFileSync(path.join(root, '.env.local'), path.join(root, '.env'));
  console.log('Switched to LOCAL test environment (.env.local -> .env). Database: localhost:5432/factory_db');
} else if (target === 'live' || target === 'production') {
  if (!fs.existsSync(path.join(root, '.env.production'))) {
    console.error('.env.production not found');
    process.exit(1);
  }
  fs.copyFileSync(path.join(root, '.env.production'), path.join(root, '.env'));
  console.log('Switched to LIVE production environment (.env.production -> .env).');
} else {
  console.log('Usage: node scripts/switch-env.js [local|live]');
}
