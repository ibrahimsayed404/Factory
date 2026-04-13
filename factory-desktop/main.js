const { app, BrowserWindow } = require('electron');
const setupAutoUpdater = require('./auto-updater');
const path = require('node:path');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');

let backendProcess = null;

function getClientBuildIndexPath() {
  if (!app.isPackaged) {
    return path.join(__dirname, '../factory-client/build/index.html');
  }

  return path.join(process.resourcesPath, 'factory-client', 'build', 'index.html');
}

function getBackendEntryPath() {
  if (!app.isPackaged) {
    return path.join(__dirname, '../factory-api/src/index.js');
  }

  return path.join(process.resourcesPath, 'factory-api', 'src', 'index.js');
}

function createWindow() {
  const runtimeApiUrl = process.env.VITE_API_URL || 'http://localhost:5000/api';
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  // Load the static React build for production/standalone use
  win.loadFile(getClientBuildIndexPath(), {
    query: {
      apiUrl: runtimeApiUrl,
    },
  });
}

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
      const value = isQuoted ? rawValue.slice(1, -1) : rawValue;
      acc[key] = value;
      return acc;
    }, {});
}

function startBackend() {
  // Path to backend entry point
  const backendPath = getBackendEntryPath();
  // Load secrets from .env or environment
  const dotenvPath = app.isPackaged
    ? path.join(process.resourcesPath, '.env')
    : path.join(__dirname, '../.env');
  let envVars = { ...process.env };
  if (fs.existsSync(dotenvPath)) {
    envVars = { ...envVars, ...parseDotEnv(fs.readFileSync(dotenvPath, 'utf8')) };
  }
  // Use VITE_API_SECRET for JWT_SECRET, and VITE_API_URL for frontend
  envVars.JWT_SECRET = envVars.VITE_API_SECRET || envVars.JWT_SECRET;
  envVars.JWT_EXPIRES_IN = envVars.JWT_EXPIRES_IN || '7d';
  envVars.NODE_ENV = 'production';
  envVars.DB_HOST = envVars.DB_HOST || 'localhost';
  envVars.DB_PORT = envVars.DB_PORT || '5432';
  envVars.DB_NAME = envVars.DB_NAME || 'factory_db';
  envVars.VITE_API_URL = envVars.VITE_API_URL || 'http://localhost:5000/api';
  process.env.VITE_API_URL = envVars.VITE_API_URL;
  backendProcess = spawn('node', [backendPath], {
    cwd: path.join(__dirname, '../factory-api'),
    env: envVars,
    stdio: 'inherit',
    shell: false,
  });
  backendProcess.on('close', (code) => {
    console.log(`Backend process exited with code ${code}`);
  });
}


function waitForBackend(url, timeout = 15000, interval = 500) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const healthUrl = URL.canParse(url)
      ? (() => {
        const parsed = new URL(url);
        parsed.pathname = '/api/auth/login';
        parsed.search = '';
        return parsed.toString();
      })()
      : 'http://localhost:5000/api/auth/login';
    const check = () => {
      http.get(healthUrl, (res) => {
        if (res.statusCode < 500) return resolve();
        if (Date.now() - start > timeout) return reject(new Error('Backend did not start in time'));
        setTimeout(check, interval);
      }).on('error', () => {
        if (Date.now() - start > timeout) return reject(new Error('Backend did not start in time'));
        setTimeout(check, interval);
      });
    };
    check();
  });
}

app.whenReady().then(async () => {
  setupAutoUpdater();
  startBackend();
  // Wait for backend to be ready before opening window
  try {
    await waitForBackend(process.env.VITE_API_URL || 'http://localhost:5000/api');
  } catch (e) {
    console.error('Backend did not start in time:', e);
  }
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (backendProcess) backendProcess.kill();
    app.quit();
  }
});
