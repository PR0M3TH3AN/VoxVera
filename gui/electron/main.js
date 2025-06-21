const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const which = require('which');
const fs = require('fs');
const { launchTor } = require('./tor.js');

let mainWindow;
let onionProc;
// 🔧 merged conflicting changes from codex/start-onionshare-and-generate-static-site vs main
let restarting = false;

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

// 🔧 merged conflicting changes from codex/start-onionshare-and-generate-static-site vs main
function startOnionShare() {
  const configPath = getConfigPath();
  const voxveraPath = which.sync('voxvera', { nothrow: true });
  if (!voxveraPath) {
    dialog.showErrorBox(
      'voxvera not found',
      'Install the voxvera CLI and ensure it is in your PATH.'
    );
    return;
  }
  const build = spawn(voxveraPath, ['--config', configPath, 'build']);
  build.on('error', err => {
    dialog.showErrorBox('voxvera build error', err.message);
  });
  build.on('close', code => {
    if (code !== 0) {
      dialog.showErrorBox('voxvera build error', `build exited with code ${code}.`);
      return;
    }
    runServe();
  });
}

async function runServe (retry = false) {
  const { torProc, socksPort, controlPort } = await launchTor();

  const env = { ...process.env,
                TOR_SOCKS_PORT:   socksPort.toString(),
                TOR_CONTROL_PORT: controlPort.toString() };

  const configPath = getConfigPath();
  const voxveraPath = which.sync('voxvera', { nothrow: true });
  onionProc = spawn(voxveraPath, ['--config', configPath, 'serve'], { env });

  let gotURL = false;
  const softTimeout = setTimeout(() => {
    if (!gotURL) {
      mainWindow.webContents.send('log',
        { text: 'Tor timed out, retrying…', isError: true });
      onionProc.kill(); torProc.kill();
      runServe(true);
    }
  }, 90_000);

  onionProc.stdout.on('data', buf => {
    const line = buf.toString();
    const m = line.match(/OnionShare is hosting at (http.*\.onion)/);
    if (m) { gotURL = true; clearTimeout(softTimeout); }
    mainWindow.webContents.send('log', { text: line });
  });

  onionProc.on('exit', () => torProc.kill());
}

app.whenReady().then(() => {
  createWindow();
  startOnionShare();
});

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
  return new Promise((resolve) => {
    if (onionProc) {
      onionProc.kill();
      onionProc = null;
    }
    const args = ['--config', configPath, 'quickstart', '--non-interactive'];
    const proc = spawn(voxveraPath, args);
    proc.stdout.on('data', data => {
      const line = data.toString();
      process.stdout.write(line);
      if (mainWindow) {
        mainWindow.webContents.send('log', { text: line, isError: false });
      }
      const m = line.match(/Onion URL:\s*(https?:\/\/[a-z0-9.-]+\.onion)/i);
      if (m && mainWindow) {
        mainWindow.webContents.send('onion-url', m[1]);
      }
    });
    proc.stderr.on('data', data => {
      const line = data.toString();
      process.stderr.write(line);
      if (mainWindow) {
        mainWindow.webContents.send('log', { text: line, isError: true });
      }
    });
    proc.on('close', code => {
      if (code !== 0) {
        dialog.showErrorBox('voxvera error', `voxvera exited with code ${code}.`);
      }
      resolve(code);
    });
    proc.on('error', err => {
      dialog.showErrorBox('voxvera error', err.message);
      resolve(-1);
    });
  });
});

app.on('window-all-closed', () => {
  if (onionProc) {
    onionProc.kill();
    onionProc = null;
  }
  if (process.platform !== 'darwin') app.quit();
});
