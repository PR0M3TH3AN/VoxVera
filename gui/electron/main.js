const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });
  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

ipcMain.handle('run-quickstart', async () => {
  return new Promise((resolve, reject) => {
    const proc = spawn('voxvera', ['quickstart'], { stdio: 'inherit' });
    proc.on('close', code => resolve(code));
    proc.on('error', err => reject(err));
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
