// Copies only what the API needs at runtime into .stage/factory-api and installs
// production dependencies there. electron-builder packages that folder, so .env
// files, backups, uploads, tests and one-off scripts never end up in the installer.
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const apiDir = path.join(__dirname, '..', '..', 'factory-api');
const stageDir = path.join(__dirname, '..', '.stage', 'factory-api');

const ALLOWLIST = ['src', 'migrations'];

// factory-api is an npm workspace: its own package-lock.json is stale and the
// root lock is what is actually installed. Pin every runtime dependency to the
// exact version installed in the repo (what the tests ran against).
const installedVersion = (name) => {
  for (const base of [path.join(apiDir, 'node_modules'), path.join(apiDir, '..', 'node_modules')]) {
    const pkg = path.join(base, name, 'package.json');
    if (fs.existsSync(pkg)) return JSON.parse(fs.readFileSync(pkg, 'utf8')).version;
  }
  throw new Error(`${name} is not installed; run npm install at the repo root first`);
};

fs.rmSync(stageDir, { recursive: true, force: true });
fs.mkdirSync(stageDir, { recursive: true });
for (const entry of ALLOWLIST) {
  fs.cpSync(path.join(apiDir, entry), path.join(stageDir, entry), { recursive: true });
}

const apiPkg = JSON.parse(fs.readFileSync(path.join(apiDir, 'package.json'), 'utf8'));
const dependencies = Object.fromEntries(Object.keys(apiPkg.dependencies).map((name) => [name, installedVersion(name)]));
fs.writeFileSync(path.join(stageDir, 'package.json'), JSON.stringify({
  name: apiPkg.name, version: apiPkg.version, private: true, main: apiPkg.main, dependencies,
}, null, 2));
execSync('npm install --omit=dev --no-audit --no-fund --no-package-lock', { cwd: stageDir, stdio: 'inherit' });

// Belt and braces: refuse to package anything that looks like a secret.
const leaks = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'node_modules') walk(p);
    } else if (/^\.env/.test(e.name) || /\.(dump|sql\.gz|csv|xlsx)$/.test(e.name)) {
      leaks.push(path.relative(stageDir, p));
    }
  }
};
walk(stageDir);
if (leaks.length) {
  console.error(`Refusing to package possible secrets/data:\n${leaks.join('\n')}`);
  process.exit(1);
}
console.log(`Staged API into ${stageDir}`);
