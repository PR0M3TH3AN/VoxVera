const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('voxvera', {
  quickstart: () => ipcRenderer.invoke('run-quickstart')
});
