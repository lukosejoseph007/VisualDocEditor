const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const FileHandler = require('./services/file-handler');
const SettingsService = require('./services/settings-service');
const AIService = require('./services/ai-service');
const MultiFileAIService = require('./services/multi-file-ai-service');
const ErrorHandler = require('./services/error-handler');
const PerformanceService = require('./services/performance-service');
const ClineService = require('./services/cline-service');

class VisualDocEditor {
  constructor() {
    this.fileHandler = new FileHandler();
    this.clineService = new ClineService();
    this.aiService = new AIService(this.clineService);
    this.multiFileAIService = new MultiFileAIService();
    this.errorHandler = new ErrorHandler();
    this.performanceService = new PerformanceService();
    this.settingsService = null;
    this.contextCache = { files: {}, lastUpdate: 0 };
  }

  initialize() {
    app.whenReady().then(() => {
      this.settingsService = new SettingsService(app);
      this.contextCache = this.settingsService.loadContextCache();
      this.createWindow();
      
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) this.createWindow();
      });
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') app.quit();
    });

    this.setupIPC();
  }

  createWindow() {
    const win = new BrowserWindow({
      width: 1600,
      height: 1000,
      frame: false, // Remove default window frame
      titleBarStyle: 'hidden', // Hide title bar but keep window controls on macOS
      titleBarOverlay: {
        color: '#0f766e', // Match our accent-dark color
        symbolColor: '#ffffff', // White symbols
        height: 32 // Match our titlebar height
      },
      webPreferences: { 
        preload: path.join(__dirname, '../../preload.js'),
        webSecurity: false // Allow local file access for document processing
      }
    });
    
    if (process.env.NODE_ENV === 'development') {
      win.loadURL('http://localhost:5173');
    } else {
      win.loadFile(path.join(__dirname, '../../dist/index.html'));
    }
  }

  setupIPC() {
    // File Operations
    ipcMain.handle('dialog:openFile', async () => {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        filters: [
          { name: 'All Supported', extensions: ['md', 'txt', 'docx', 'pdf', 'pptx'] },
          { name: 'Markdown Files', extensions: ['md'] },
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'Word Documents', extensions: ['docx'] },
          { name: 'PDF Files', extensions: ['pdf'] },
          { name: 'PowerPoint Files', extensions: ['pptx'] }
        ],
        properties: ['openFile']
      });
      
      if (canceled || filePaths.length === 0) return { canceled: true };
      
      const filePath = filePaths[0];
      try {
        const result = await this.fileHandler.readFile(filePath);
        return { 
          canceled: false, 
          filePath, 
          content: result.content, 
          format: result.format,
          originalFormat: result.format
        };
      } catch (err) {
        return { canceled: false, filePath, content: `Error reading file: ${err.message}`, format: 'error' };
      }
    });

    ipcMain.handle('dialog:saveFile', async (event, { filePath, content }) => {
      if (!filePath) {
        const { canceled, filePath: newFile } = await dialog.showSaveDialog({
          filters: [{ name: 'Markdown Files', extensions: ['md'] }]
        });
        if (canceled) return { canceled: true };
        filePath = newFile;
      }
      fs.writeFileSync(filePath, content, 'utf-8');
      return { canceled: false, filePath };
    });

    ipcMain.handle('dialog:exportFile', async (event, { filePath, aiResult, format, originalData }) => {
      const filters = {
        md: [{ name: 'Markdown Files', extensions: ['md'] }],
        docx: [{ name: 'Word Documents', extensions: ['docx'] }],
        pptx: [{ name: 'PowerPoint Files', extensions: ['pptx'] }],
        html: [{ name: 'HTML Files', extensions: ['html'] }],
        txt: [{ name: 'Text Files', extensions: ['txt'] }]
      };

      const { canceled, filePath: exportPath } = await dialog.showSaveDialog({
        filters: filters[format] || filters.md
      });
      
      if (canceled) return { canceled: true };
      
      try {
        await this.fileHandler.exportFile(exportPath, aiResult, format, originalData);
        return { canceled: false, filePath: exportPath };
      } catch (err) {
        return { canceled: false, error: err.message };
      }
    });

    // Folder Operations
    ipcMain.handle('dialog:openFolder', async () => {
      const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] });
      if (canceled || filePaths.length === 0) return { canceled: true };
      const folderPath = filePaths[0];
      const files = this.fileHandler.scanSupportedFiles(folderPath);
      return { canceled: false, folderPath, files };
    });

    ipcMain.handle('fs:readFile', async (event, { filePath }) => {
      try {
        const result = await this.fileHandler.readFile(filePath);
        return { ok: true, content: result.content, format: result.format };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    });

    // Settings Management
    ipcMain.handle('settings:load', async () => {
      return this.settingsService.loadSettings();
    });

    ipcMain.handle('settings:save', async (event, newSettings) => {
      return this.settingsService.saveSettings(newSettings);
    });

    // Model Management
    ipcMain.handle('models:add', async (event, { model }) => {
      return this.settingsService.addModel(model);
    });

    ipcMain.handle('models:remove', async (event, { model }) => {
      return this.settingsService.removeModel(model);
    });

    ipcMain.handle('models:clear', async () => {
      return this.settingsService.clearModels();
    });

    // AI Actions
    ipcMain.handle('ai:action', async (event, { provider, apiKey, modelId, mode, text }) => {
      const result = await this.aiService.performAction({ provider, apiKey, modelId, mode, text });
      
      // Track performance metrics with Cline service
      if (result.metadata) {
        await this.clineService.trackPerformance({
          responseTime: result.metadata.responseTime,
          success: !result.metadata.error
        });
        
        // Track token usage if available
        if (result.metadata.tokenUsage) {
          await this.clineService.trackTokenUsage(this.clineService.getCurrentSession()?.id, result.metadata.tokenUsage);
        }
      }
      
      return result;
    });

    // AI Multi-File Actions
    ipcMain.handle('aiMultiFileAction', async (event, { provider, apiKey, modelId, mode, currentFile, relatedFiles, query }) => {
      return await this.multiFileAIService.performMultiFileAction({ provider, apiKey, modelId, mode, currentFile, relatedFiles, query });
    });

    // Context Building
    ipcMain.handle('context:build', async (event, { folderPath }) => {
      console.log('Context building started for folder:', folderPath);
      try {
        const files = this.fileHandler.scanSupportedFiles(folderPath);
        console.log('Found', files.length, 'supported files');
        
        const processedFiles = [];
        
        for (const file of files) {
          try {
            console.log('Processing file:', file.path);
            let content;
            const ext = path.extname(file.path).toLowerCase();
            
            // Only process text-based files for context
            if (['.md', '.txt'].includes(ext)) {
              content = fs.readFileSync(file.path, 'utf-8');
              console.log('Read text file:', file.path, 'content length:', content.length);
            } else if (ext === '.docx') {
              console.log('Reading DOCX file:', file.path);
              const result = await this.fileHandler.readDocx(file.path);
              content = result.content;
              console.log('DOCX content length:', content.length);
            } else if (ext === '.pdf') {
              console.log('Reading PDF file:', file.path);
              const result = await this.fileHandler.readPdf(file.path);
              content = result.content;
              console.log('PDF content length:', content.length);
            } else if (ext === '.pptx') {
              console.log('Reading PPTX file:', file.path);
              const result = await this.fileHandler.readPptx(file.path);
              content = result.content;
              console.log('PPTX content length:', content.length);
            } else {
              console.log('Skipping unsupported format:', ext);
              continue; // Skip unsupported formats for context
            }
            
            console.log('Processing content for NLP analysis...');
            const processed = this.aiService.processFileContent(content, file.path);
            this.contextCache.files[file.path] = {
              ...processed,
              mtime: file.mtime,
              size: file.size,
              format: file.format
            };
            processedFiles.push({
              path: file.path,
              name: file.name,
              format: file.format,
              hasContext: true,
              wordCount: processed.wordCount,
              keyTerms: processed.keyTerms.slice(0, 5)
            });
            console.log('Successfully processed:', file.path);
          } catch (err) {
            console.error('Error processing file:', file.path, err);
            processedFiles.push({
              path: file.path,
              name: file.name,
              format: file.format,
              hasContext: false,
              error: err.message
            });
          }
        }
        
        this.contextCache.lastUpdate = Date.now();
        this.settingsService.saveContextCache(this.contextCache);
        
        console.log('Context building completed. Processed', processedFiles.length, 'files');
        
        return {
          success: true,
          filesProcessed: processedFiles.length,
          files: processedFiles
        };
      } catch (error) {
        console.error('Context building failed completely:', error);
        return {
          success: false,
          error: error.message,
          filesProcessed: 0,
          files: []
        };
      }
    });

    ipcMain.handle('context:related', async (event, { filePath, query }) => {
      return this.aiService.findRelatedFiles(this.contextCache, filePath, query);
    });

    // Error Management
    ipcMain.handle('errors:getSummary', async () => {
      return this.errorHandler.getErrorSummary();
    });

    ipcMain.handle('errors:clear', async () => {
      this.errorHandler.clearLog();
      return { success: true };
    });

    ipcMain.handle('errors:validateSettings', async (event, settings) => {
      return this.errorHandler.validateSettings(settings);
    });

    ipcMain.handle('errors:validateFile', async (event, { filePath, expectedFormats }) => {
      return this.errorHandler.validateFile(filePath, expectedFormats);
    });

    // Performance Monitoring
    ipcMain.handle('performance:getSummary', async () => {
      return this.performanceService.getPerformanceSummary();
    });

    ipcMain.handle('performance:getSuggestions', async () => {
      return this.performanceService.getOptimizationSuggestions();
    });

    ipcMain.handle('performance:reset', async () => {
      this.performanceService.reset();
      return { success: true };
    });

    ipcMain.handle('performance:trackMemory', async () => {
      return this.performanceService.trackMemoryUsage();
    });

    // Cline Service Operations
    ipcMain.handle('cline:startSession', async (event, { sessionType }) => {
      return this.clineService.startNewSession(sessionType);
    });

    ipcMain.handle('cline:endSession', async (event, { sessionId, status }) => {
      this.clineService.endSession(sessionId, status);
      return { success: true };
    });

    ipcMain.handle('cline:addThinkingStep', async (event, { sessionId, step }) => {
      return this.clineService.addThinkingStep(sessionId, step);
    });

    ipcMain.handle('cline:trackTokenUsage', async (event, { sessionId, usage }) => {
      this.clineService.trackTokenUsage(sessionId, usage);
      return { success: true };
    });

    ipcMain.handle('cline:trackOperation', async (event, { sessionId, operation }) => {
      return this.clineService.trackOperation(sessionId, operation);
    });

    ipcMain.handle('cline:completeOperation', async (event, { sessionId, operationId, result }) => {
      this.clineService.completeOperation(sessionId, operationId, result);
      return { success: true };
    });

    ipcMain.handle('cline:updateContextSize', async (event, { sessionId, size }) => {
      this.clineService.updateContextSize(sessionId, size);
      return { success: true };
    });

    ipcMain.handle('cline:trackPerformance', async (event, metrics) => {
      this.clineService.trackPerformance(metrics);
      return { success: true };
    });

    ipcMain.handle('cline:getSession', async (event, { sessionId }) => {
      return this.clineService.getSession(sessionId);
    });

    ipcMain.handle('cline:getAllSessions', async () => {
      return this.clineService.getAllSessions();
    });

    ipcMain.handle('cline:getCurrentSession', async () => {
      return this.clineService.getCurrentSession();
    });

    ipcMain.handle('cline:getTokenUsage', async () => {
      return this.clineService.getTokenUsage();
    });

    ipcMain.handle('cline:getPerformanceMetrics', async () => {
      return this.clineService.getPerformanceMetrics();
    });

    ipcMain.handle('cline:clearSessions', async () => {
      this.clineService.clearSessions();
      return { success: true };
    });

    ipcMain.handle('cline:resetTokenUsage', async () => {
      this.clineService.resetTokenUsage();
      return { success: true };
    });

    // Window Controls
    ipcMain.handle('window:minimize', async (event) => {
      const win = BrowserWindow.getFocusedWindow();
      if (win) win.minimize();
      return { success: true };
    });

    ipcMain.handle('window:maximize', async (event) => {
      const win = BrowserWindow.getFocusedWindow();
      if (win) {
        if (win.isMaximized()) {
          win.unmaximize();
        } else {
          win.maximize();
        }
      }
      return { success: true };
    });

    ipcMain.handle('window:close', async (event) => {
      const win = BrowserWindow.getFocusedWindow();
      if (win) win.close();
      return { success: true };
    });
  }
}

// Initialize the application
const visualDocEditor = new VisualDocEditor();
visualDocEditor.initialize();
