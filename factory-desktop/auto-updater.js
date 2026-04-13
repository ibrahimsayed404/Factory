// Auto-update logic for Electron (main process)
const { app, autoUpdater, dialog } = require('electron');
const isDev = require('electron-is-dev');

function setupAutoUpdater() {
  if (isDev) return;

  // Electron's built-in autoUpdater on Windows requires a Squirrel-installed app.
  // This project ships a portable .exe, so update checks must be skipped there.
  if (process.platform === 'win32') return;

  const server = 'https://update.electronjs.org';
  const feed = `${server}/ibrahimsayed404/Factory/${process.platform}-${process.arch}/${app.getVersion()}`;
  autoUpdater.setFeedURL({ url: feed });

  autoUpdater.on('update-available', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update available',
      message: 'A new update is available. Downloading now...'
    });
  });

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update ready',
      message: 'A new update is ready. The app will now restart to apply the update.'
    }).then(() => {
      autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.on('error', () => {
    // Ignore updater errors to avoid interrupting users during normal app usage.
  });

  autoUpdater.checkForUpdates();
}

module.exports = setupAutoUpdater;
