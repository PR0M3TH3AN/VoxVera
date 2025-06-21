const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const which = require('which');
const fs = require('fs');

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

function getConfigPath() {
  return path.join(__dirname, '..', '..', 'voxvera', 'src', 'config.json');
}

ipcMain.handle('load-config', async () => {
  const p = getConfigPath();
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw);
});

ipcMain.handle('run-quickstart', async (_, config) => {
  const configPath = getConfigPath();
  if (config && typeof config === 'object') {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }
  const voxveraPath = which.sync('voxvera', { nothrow: true });
  if (!voxveraPath) {
    dialog.showErrorBox(
      'voxvera not found',
      'Install the voxvera CLI and ensure it is in your PATH.'
    );
    return -1;
  }
  return new Promise((resolve, reject) => {
    const proc = spawn(voxveraPath, ['--config', configPath, 'quickstart']);
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
