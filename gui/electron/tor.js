const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const which = require('which');
const getPort = (...args) => import('get-port').then(m => m.default(...args));

async function launchTor() {
  const socks = await getPort();
  const control = await getPort();
  const torBase = path.join(__dirname, '..', '..', 'voxvera', 'resources', 'tor');
  let exe = path.join(torBase, process.platform,
                      process.platform === 'win32' ? 'tor.exe' : 'tor');
  let obfs4 = path.join(torBase, process.platform,
                        process.platform === 'win32' ? 'obfs4proxy.exe' : 'obfs4proxy');

  const missing = p => {
    try {
      const data = fs.readFileSync(p, 'utf8');
      return data.includes('placeholder');
    } catch (e) {
      return true;
    }
  };

  if (missing(exe)) {
    const sysTor = which.sync('tor', { nothrow: true });
    if (sysTor) exe = sysTor;
  }
  if (missing(obfs4)) {
    const sysObfs = which.sync('obfs4proxy', { nothrow: true });
    if (sysObfs) obfs4 = sysObfs;
  }

  if (missing(exe) || missing(obfs4)) {
    throw new Error('Tor or obfs4proxy not found; install them first.');
  }

  const args = [
    'SocksPort', socks,
    'ControlPort', control,
    'Log', 'notice stdout',
    'UseBridges', '1',
    'ClientTransportPlugin', `obfs4 exec ${obfs4}`,
    'BridgeBootstrap', '1'
  ];

  return new Promise((res, rej) => {
    const tor = spawn(exe, args, { stdio: ['ignore', 'pipe', 'inherit'] });
    tor.stdout.on('data', b => {
      const line = b.toString();
      if (global.mainWindow)
        global.mainWindow.webContents.send('log', { text: `[tor] ${line.trim()}` });
      if (line.includes('Bootstrapped 100%'))
        res({ torProc: tor, socksPort: socks, controlPort: control });
    });
    tor.on('error', rej);
  });
}

module.exports = { launchTor };
