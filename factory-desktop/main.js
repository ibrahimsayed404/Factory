const { app, BrowserWindow } = require('electron');
const setupAutoUpdater = require('./auto-updater');
const path = require('path');
const { spawn } = require('child_process');

let backendProcess = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  // Load the static React build for production/standalone use
  win.loadFile(path.join(__dirname, '../factory-client/build/index.html'));
}

function startBackend() {
  // Path to backend entry point
  const backendPath = path.join(__dirname, '../factory-api/src/index.js');
  backendProcess = spawn('node', [backendPath], {
    cwd: path.join(__dirname, '../factory-api'),
    env: {
      ...process.env,
      JWT_SECRET: 'factory_local_dev_super_secret',
      JWT_EXPIRES_IN: '7d',
      NODE_ENV: 'production',
      DB_HOST: 'localhost',
      DB_PORT: '5432',
      DB_NAME: 'factory_db',
      REACT_APP_API_URL: 'http://localhost:5000/api',
    },
    stdio: 'inherit',
    shell: false,
  });
  backendProcess.on('close', (code) => {
    console.log(`Backend process exited with code ${code}`);
  });
}

app.whenReady().then(() => {
  setupAutoUpdater();
  startBackend();
  setTimeout(createWindow, 4000); // Wait for backend to start
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (backendProcess) backendProcess.kill();
    app.quit();
  }
});
