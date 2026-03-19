const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const which = require('which');
const fs = require('fs');
const { extractOnionUrl } = require('./runtime-utils');

let mainWindow;
let onionProc;

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

function getVoxveraPath() {
  const voxveraPath = which.sync('voxvera', { nothrow: true });
  if (!voxveraPath) {
    throw new Error('Install the voxvera CLI and ensure it is in your PATH.');
  }
  return voxveraPath;
}

function runJsonCommand(args) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const proc = spawn(getVoxveraPath(), args);
    proc.stdout.on('data', data => {
      stdout += data.toString();
    });
    proc.stderr.on('data', data => {
      stderr += data.toString();
    });
    proc.on('close', code => {
      if (code !== 0) {
        reject(new Error(stderr || `voxvera exited with code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (err) {
        reject(new Error(`Could not parse VoxVera JSON output: ${err.message}`));
      }
    });
    proc.on('error', reject);
  });
}

app.whenReady().then(() => {
  createWindow();
});

function getConfigPath() {
  const userDir = app.getPath('userData');
  const cfgPath = path.join(userDir, 'config.json');
  if (!fs.existsSync(cfgPath)) {
    try {
      fs.mkdirSync(userDir, { recursive: true });
      const defaultCfg = path.join(__dirname, '..', '..', 'voxvera', 'src', 'config.json');
      fs.copyFileSync(defaultCfg, cfgPath);
    } catch (err) {
      dialog.showErrorBox('Config error', err.message);
    }
  }
  return cfgPath;
}

ipcMain.handle('load-config', async () => {
  const p = getConfigPath();
  const raw = fs.readFileSync(p, 'utf8');
  const config = JSON.parse(raw);
  if (config.footer_message === undefined && config.binary_message !== undefined) {
    config.footer_message = config.binary_message;
  }
  delete config.binary_message;
  return config;
});

ipcMain.handle('load-runtime-status', async () => {
  try {
    const platformStatus = await runJsonCommand(['platform-status', '--json']);
    const doctor = await runJsonCommand(['doctor', '--json']);
    let autostart = null;
    try {
      autostart = await runJsonCommand(['autostart', 'status', '--json']);
    } catch (err) {
      autostart = { error: err.message };
    }
    return {
      ok: true,
      platformStatus,
      doctor,
      autostart
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message
    };
  }
});

ipcMain.handle('run-quickstart', async (_, config) => {
  const configPath = getConfigPath();
  if (config && typeof config === 'object') {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }
  let voxveraPath;
  try {
    voxveraPath = getVoxveraPath();
  } catch (err) {
    dialog.showErrorBox('voxvera not found', err.message);
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
      const onionUrl = extractOnionUrl(line);
      if (onionUrl && mainWindow) {
        mainWindow.webContents.send('onion-url', onionUrl);
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
