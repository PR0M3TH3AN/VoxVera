const { spawn } = require('child_process');
const path = require('path');
const getPort = require('get-port');

async function launchTor() {
  const socks = await getPort();
  const control = await getPort();
  const exe = path.join(__dirname, 'resources', 'tor', process.platform,
                        process.platform === 'win32' ? 'tor.exe' : 'tor');
  const obfs4 = path.join(__dirname, 'resources', 'tor', process.platform,
                         process.platform === 'win32' ? 'obfs4proxy.exe' : 'obfs4proxy');

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
