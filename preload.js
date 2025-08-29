const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Files
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (filePath, content) => ipcRenderer.invoke('dialog:saveFile', { filePath, content }),
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', { filePath }),

  // AI
  aiAction: (data) => ipcRenderer.invoke('ai:action', data),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

  // NEW: Multi-file context
  buildContext: (folderPath) => ipcRenderer.invoke('context:build', { folderPath }),
  getRelatedFiles: (filePath, query) => ipcRenderer.invoke('context:related', { filePath, query }),
  aiMultiFileAction: (data) => ipcRenderer.invoke('ai:multifile', data)
});