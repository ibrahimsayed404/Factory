const { app, BrowserWindow, dialog, shell } = require('electron');
const setupAutoUpdater = require('./auto-updater');
const path = require('node:path');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');

// The desktop app runs its own copy of the API on this machine (local Postgres)
// and loads the client from that API, so it behaves exactly like the website.

let backendProcess = null;
let backendExited = false;
let isQuitting = false;

const CONFIG_FILE = () => path.join(app.getPath('userData'), 'config.env');
const LOG_FILE = () => path.join(app.getPath('userData'), 'logs', 'backend.log');

function parseDotEnv(text) {
  return String(text || '')
    .split(/\r?\n/)
    .reduce((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return acc;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx <= 0) return acc;
      const key = trimmed.slice(0, eqIdx).trim();
      const rawValue = trimmed.slice(eqIdx + 1).trim();
      const isQuoted = (rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'"));
      acc[key] = isQuoted ? rawValue.slice(1, -1) : rawValue;
      return acc;
    }, {});
}

// Per-user settings, created on first run. Secrets live here, never in the installer.
function loadConfig() {
  const file = CONFIG_FILE();
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, [
      '# Factory Desktop settings. Restart the app after editing.',
      'DB_HOST=localhost',
      'DB_PORT=5432',
      'DB_NAME=factory_db',
      'DB_USER=postgres',
      'DB_PASSWORD=',
      'PORT=5000',
      `JWT_SECRET=${crypto.randomBytes(48).toString('hex')}`,
      '',
    ].join('\n'));
  }
  return parseDotEnv(fs.readFileSync(file, 'utf8'));
}

function getPaths() {
  if (app.isPackaged) {
    return {
      apiDir: path.join(process.resourcesPath, 'factory-api'),
      clientBuildDir: path.join(process.resourcesPath, 'factory-client', 'build'),
      uploadsDir: path.join(app.getPath('userData'), 'uploads'),
    };
  }
  // Development (npm start from the repo): DB settings come from factory-api/.env
  // and uploads stay in factory-api/uploads, as before.
  return {
    apiDir: path.join(__dirname, '..', 'factory-api'),
    clientBuildDir: path.join(__dirname, '..', 'factory-client', 'build'),
    uploadsDir: null,
  };
}

function openLogStream() {
  const file = LOG_FILE();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try {
    if (fs.statSync(file).size > 5 * 1024 * 1024) fs.renameSync(file, `${file}.old`);
  } catch { /* no previous log */ }
  const stream = fs.createWriteStream(file, { flags: 'a' });
  stream.write(`\n===== ${new Date().toISOString()} starting backend =====\n`);
  return stream;
}

function startBackend(config, paths, port) {
  const env = {
    ...process.env,
    ...(app.isPackaged ? config : {}),
    NODE_ENV: 'production',
    PORT: String(port),
    HOST: '127.0.0.1',
    DB_SSL: config.DB_SSL || 'false',
    DISABLE_RATE_LIMIT: 'true',
    CLIENT_BUILD_DIR: paths.clientBuildDir,
    CLIENT_ORIGIN: `http://127.0.0.1:${port}`,
  };
  if (paths.uploadsDir) env.UPLOADS_DIR = config.UPLOADS_DIR || paths.uploadsDir;
  if (app.isPackaged) env.ELECTRON_RUN_AS_NODE = '1';

  const log = openLogStream();
  backendProcess = spawn(app.isPackaged ? process.execPath : 'node', [path.join(paths.apiDir, 'src', 'index.js')], {
    cwd: paths.apiDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  backendProcess.stdout.pipe(log);
  backendProcess.stderr.pipe(log);
  backendProcess.on('close', (code) => {
    backendExited = true;
    log.write(`===== backend exited with code ${code} =====\n`);
  });
  backendProcess.on('error', (err) => {
    backendExited = true;
    log.write(`===== backend failed to start: ${err.message} =====\n`);
  });
}

function waitForBackend(port, timeout = 30000, interval = 500) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (backendExited) return reject(new Error('backend exited'));
      http.get(`http://127.0.0.1:${port}/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) return resolve();
        retry();
      }).on('error', retry);
    };
    const retry = () => {
      if (Date.now() - start > timeout) return reject(new Error('timeout'));
      setTimeout(check, interval);
    };
    check();
  });
}

function createWindow(port) {
  const origin = `http://127.0.0.1:${port}`;
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Black Fox — Factory Management',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  // Print previews open about:blank popups; anything else external goes to the browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url === 'about:blank' || url.startsWith(origin)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.loadURL(`${origin}/`);
}

async function showStartupError() {
  const { response } = await dialog.showMessageBox({
    type: 'error',
    title: 'Factory Desktop',
    message: 'تعذّر تشغيل الخادم المحلي / The local server could not start.',
    detail: [
      'تأكد إن PostgreSQL شغال وإن بيانات قاعدة البيانات صحيحة في ملف الإعدادات.',
      'Make sure PostgreSQL is running and the database settings are correct.',
      '',
      `Settings: ${CONFIG_FILE()}`,
      `Log: ${LOG_FILE()}`,
    ].join('\n'),
    buttons: ['Open settings', 'Open log', 'Close'],
    defaultId: 0,
  });
  if (response === 0) await shell.openPath(CONFIG_FILE());
  if (response === 1) await shell.openPath(LOG_FILE());
}

function stopBackend() {
  if (backendProcess && !backendExited) backendProcess.kill();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(async () => {
    setupAutoUpdater();
    const config = loadConfig();
    const port = Number(config.PORT) || 5000;
    startBackend(config, getPaths(), port);
    try {
      await waitForBackend(port);
      // Another server already on this port would answer /health while ours dies
      // with EADDRINUSE; give it a moment and make sure ours is still alive.
      await new Promise((r) => setTimeout(r, 1000));
      if (backendExited) throw new Error('backend exited');
    } catch {
      await showStartupError();
      isQuitting = true;
      stopBackend();
      app.quit();
      return;
    }
    createWindow(port);
  });

  app.on('before-quit', () => {
    isQuitting = true;
    stopBackend();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' || isQuitting) {
      stopBackend();
      app.quit();
    }
  });
}
