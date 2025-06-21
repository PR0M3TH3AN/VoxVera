const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const which = require('which');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });
  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

ipcMain.handle('run-quickstart', async () => {
  const voxveraPath = which.sync('voxvera', { nothrow: true });
  if (!voxveraPath) {
    dialog.showErrorBox(
      'voxvera not found',
      'Install the voxvera CLI and ensure it is in your PATH.'
    );
    return -1;
  }
  return new Promise((resolve, reject) => {
    const proc = spawn(voxveraPath, ['quickstart']);
    proc.stdout.on('data', data => {
      const line = data.toString();
      process.stdout.write(line);
      const m = line.match(/Onion URL:\s*(https?:\/\/[a-z0-9.-]+\.onion)/i);
      if (m && mainWindow) {
        mainWindow.webContents.send('onion-url', m[1]);
      }
    });
    proc.stderr.on('data', data => {
      process.stderr.write(data);
    });
    proc.on('close', code => resolve(code));
    proc.on('error', err => reject(err));
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
