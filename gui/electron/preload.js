const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('voxvera', {
  quickstart: () => ipcRenderer.invoke('run-quickstart'),
  onOnionUrl: (cb) => ipcRenderer.on('onion-url', (_, url) => cb(url))
});
