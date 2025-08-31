const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Files (enhanced for multiple formats)
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (filePath, content) => ipcRenderer.invoke('dialog:saveFile', { filePath, content }),
  exportFile: (filePath, content, format) => ipcRenderer.invoke('dialog:exportFile', { filePath, content, format }),
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', { filePath }),

  // Document processing
  processDocument: (filePath) => ipcRenderer.invoke('doc:process', { filePath }),
  convertDocument: (content, fromFormat, toFormat) => ipcRenderer.invoke('doc:convert', { content, fromFormat, toFormat }),

  // AI
  aiAction: (data) => ipcRenderer.invoke('ai:action', data),
  aiMultiFileAction: (data) => ipcRenderer.invoke('aiMultiFileAction', data),

  // Settings & Models
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  addModel: (model) => ipcRenderer.invoke('models:add', { model }),
  removeModel: (model) => ipcRenderer.invoke('models:remove', { model }),
  clearModels: () => ipcRenderer.invoke('models:clear'),

  // Context (existing from Step 6)
  buildContext: (folderPath) => ipcRenderer.invoke('context:build', { folderPath }),
  getRelatedFiles: (filePath, query) => ipcRenderer.invoke('context:related', { filePath, query })
});
