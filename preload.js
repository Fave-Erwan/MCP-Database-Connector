const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    adminListPermissions: () => ipcRenderer.invoke('admin:list-permissions'),
    adminTogglePermission: (args) => ipcRenderer.invoke('admin:toggle-permission', args),
    onLog: (callback) => ipcRenderer.on('log-message', (event, value) => callback(value)),
});