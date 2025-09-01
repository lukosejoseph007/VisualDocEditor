const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Files (enhanced for multiple formats)
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (filePath, content) => ipcRenderer.invoke('dialog:saveFile', { filePath, content }),
  exportFile: (filePath, aiResult, format, originalData) => ipcRenderer.invoke('dialog:exportFile', { filePath, aiResult, format, originalData }),
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
  getRelatedFiles: (filePath, query) => ipcRenderer.invoke('context:related', { filePath, query }),

  // Cline Service Operations
  clineStartSession: (sessionType) => ipcRenderer.invoke('cline:startSession', { sessionType }),
  clineEndSession: (sessionId, status) => ipcRenderer.invoke('cline:endSession', { sessionId, status }),
  clineAddThinkingStep: (sessionId, step) => ipcRenderer.invoke('cline:addThinkingStep', { sessionId, step }),
  clineTrackTokenUsage: (sessionId, usage) => ipcRenderer.invoke('cline:trackTokenUsage', { sessionId, usage }),
  clineTrackOperation: (sessionId, operation) => ipcRenderer.invoke('cline:trackOperation', { sessionId, operation }),
  clineCompleteOperation: (sessionId, operationId, result) => ipcRenderer.invoke('cline:completeOperation', { sessionId, operationId, result }),
  clineUpdateContextSize: (sessionId, size) => ipcRenderer.invoke('cline:updateContextSize', { sessionId, size }),
  clineTrackPerformance: (metrics) => ipcRenderer.invoke('cline:trackPerformance', metrics),
  clineGetSession: (sessionId) => ipcRenderer.invoke('cline:getSession', { sessionId }),
  clineGetAllSessions: () => ipcRenderer.invoke('cline:getAllSessions'),
  clineGetCurrentSession: () => ipcRenderer.invoke('cline:getCurrentSession'),
  clineGetTokenUsage: () => ipcRenderer.invoke('cline:getTokenUsage'),
  clineGetPerformanceMetrics: () => ipcRenderer.invoke('cline:getPerformanceMetrics'),
  clineClearSessions: () => ipcRenderer.invoke('cline:clearSessions'),
  clineResetTokenUsage: () => ipcRenderer.invoke('cline:resetTokenUsage'),

  // Window Controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close')
});
