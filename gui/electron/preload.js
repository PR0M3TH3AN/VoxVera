const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('voxvera', {
  loadConfig: () => ipcRenderer.invoke('load-config'),
  quickstart: (config) => ipcRenderer.invoke('run-quickstart', config),
  onOnionUrl: (cb) => ipcRenderer.on('onion-url', (_, url) => cb(url))
});
