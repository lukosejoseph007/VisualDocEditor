const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
const natural = require('natural');

const settingsFile = path.join(app.getPath('userData'), 'settings.json');
const contextCacheFile = path.join(app.getPath('userData'), 'context-cache.json');

// ---- Settings helpers ----
function loadSettings() {
  try { return JSON.parse(fs.readFileSync(settingsFile, 'utf-8')); } catch { return { apiKey: '' }; }
}
function saveSettings(settings) {
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
}

// ---- Context cache helpers ----
let contextCache = { files: {}, lastUpdate: 0 };
function loadContextCache() {
  try { contextCache = JSON.parse(fs.readFileSync(contextCacheFile, 'utf-8')); } catch { /* ignore */ }
}
function saveContextCache() {
  fs.writeFileSync(contextCacheFile, JSON.stringify(contextCache, null, 2));
}

// ---- Window ----
function createWindow() {
  loadContextCache();
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: { preload: path.join(__dirname, 'preload.js') }
  });
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, 'dist/index.html'));
  }
}

// ---- File Open/Save (existing) ----
ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    filters: [{ name: 'Markdown Files', extensions: ['md'] }],
    properties: ['openFile']
  });
  if (canceled || filePaths.length === 0) return { canceled: true };
  const filePath = filePaths[0];
  const content = fs.readFileSync(filePath, 'utf-8');
  return { canceled: false, filePath, content };
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

// ---- Folder (existing) ----
ipcMain.handle('dialog:openFolder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (canceled || filePaths.length === 0) return { canceled: true };
  const folderPath = filePaths[0];
  const files = scanMarkdownFiles(folderPath);
  return { canceled: false, folderPath, files };
});

function scanMarkdownFiles(root) {
  const out = [];
  function walk(dir) {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (e.isFile() && full.toLowerCase().endsWith('.md')) {
        let stat = null;
        try { stat = fs.statSync(full); } catch { stat = { size: 0, mtimeMs: 0 }; }
        out.push({
          name: e.name,
          path: full,
          size: stat.size,
          mtime: stat.mtimeMs
        });
      }
    }
  }
  walk(root);
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

ipcMain.handle('fs:readFile', async (event, { filePath }) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { ok: true, content };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

// ---- NEW: Context building ----
ipcMain.handle('context:build', async (event, { folderPath }) => {
  const files = scanMarkdownFiles(folderPath);
  const processedFiles = [];
  
  for (const file of files) {
    try {
      const content = fs.readFileSync(file.path, 'utf-8');
      const processed = processFileContent(content, file.path);
      contextCache.files[file.path] = {
        ...processed,
        mtime: file.mtime,
        size: file.size
      };
      processedFiles.push({
        path: file.path,
        name: file.name,
        hasContext: true,
        wordCount: processed.wordCount,
        keyTerms: processed.keyTerms.slice(0, 5)
      });
    } catch (err) {
      console.error('Error processing file:', file.path, err);
      processedFiles.push({
        path: file.path,
        name: file.name,
        hasContext: false,
        error: err.message
      });
    }
  }
  
  contextCache.lastUpdate = Date.now();
  saveContextCache();
  
  return {
    success: true,
    filesProcessed: processedFiles.length,
    files: processedFiles
  };
});

function processFileContent(content, filePath) {
  // Basic text processing
  const words = natural.WordTokenizer.tokenize(content.toLowerCase()) || [];
  const sentences = natural.SentenceTokenizer.tokenize(content) || [];
  
  // Extract key terms (filter out common words)
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them']);
  const filteredWords = words.filter(word => 
    word && word.length > 2 && !stopWords.has(word) && !/^\d+$/.test(word)
  );
  
  // Count word frequency
  const wordFreq = {};
  filteredWords.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });
  
  // Get key terms by frequency
  const keyTerms = Object.entries(wordFreq)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 20)
    .map(([word]) => word);
  
  // Simple TF-IDF vector (we'll use word frequency as a simple vector)
  const vector = keyTerms.reduce((vec, term) => {
    vec[term] = wordFreq[term] || 0;
    return vec;
  }, {});
  
  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    keyTerms,
    vector,
    summary: sentences.slice(0, 2).join(' ').substring(0, 200) + '...',
    headings: extractHeadings(content)
  };
}

function extractHeadings(content) {
  const headings = [];
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    const match = line.match(/^(#{1,6})\s+(.+)/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2],
        line: index
      });
    }
  });
  return headings;
}

// ---- NEW: Find related files ----
ipcMain.handle('context:related', async (event, { filePath, query }) => {
  const currentFile = contextCache.files[filePath];
  if (!currentFile) return { files: [] };
  
  const queryWords = natural.WordTokenizer.tokenize(query.toLowerCase()) || [];
  const relatedFiles = [];
  
  for (const [fPath, fileData] of Object.entries(contextCache.files)) {
    if (fPath === filePath) continue;
    
    let similarity = 0;
    
    // Check for query word matches
    queryWords.forEach(word => {
      if (fileData.keyTerms.includes(word)) {
        similarity += 2;
      }
      if (fileData.vector[word]) {
        similarity += fileData.vector[word];
      }
    });
    
    // Check for key term overlap with current file
    currentFile.keyTerms.forEach(term => {
      if (fileData.keyTerms.includes(term)) {
        similarity += 1;
      }
    });
    
    if (similarity > 0) {
      relatedFiles.push({
        path: fPath,
        name: path.basename(fPath),
        similarity,
        keyTerms: fileData.keyTerms.slice(0, 3),
        summary: fileData.summary
      });
    }
  }
  
  relatedFiles.sort((a, b) => b.similarity - a.similarity);
  return { files: relatedFiles.slice(0, 5) };
});

// ---- AI Actions (existing) ----
ipcMain.handle('ai:action', async (event, { provider, apiKey, modelId, mode, text }) => {
  let systemPrompt = '';
  if (mode === 'improve') systemPrompt = 'Improve this text while keeping the meaning.';
  else if (mode === 'summarize') systemPrompt = 'Summarize this text concisely.';
  else if (mode === 'ask') systemPrompt = 'Answer the question based on the provided text.';

  let baseURL = 'https://api.openai.com/v1';
  if (provider === 'openrouter') baseURL = 'https://openrouter.ai/api/v1';

  const client = new OpenAI({ apiKey, baseURL });
  try {
    const completion = await client.chat.completions.create({
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ]
    });
    return completion.choices[0].message.content;
  } catch (err) {
    console.error('AI error:', err);
    return `Error: ${err.message}`;
  }
});

// ---- NEW: Multi-file AI Actions ----
ipcMain.handle('ai:multifile', async (event, { provider, apiKey, modelId, mode, currentFile, relatedFiles, query }) => {
  let systemPrompt = '';
  let contextText = '';
  
  // Build context from related files
  if (relatedFiles && relatedFiles.length > 0) {
    contextText = 'RELATED DOCUMENTS:\n\n';
    relatedFiles.forEach(file => {
      const fileData = contextCache.files[file.path];
      if (fileData) {
        contextText += `FILE: ${file.name}\n`;
        contextText += `${fileData.summary}\n`;
        contextText += `Key concepts: ${fileData.keyTerms.slice(0, 5).join(', ')}\n\n`;
      }
    });
    contextText += `CURRENT DOCUMENT: ${path.basename(currentFile.path)}\n`;
    contextText += `${currentFile.content}\n\n`;
  }
  
  if (mode === 'explain') {
    systemPrompt = 'Explain the concepts in the current document using context from related documents. Focus on connections and relationships.';
  } else if (mode === 'connect') {
    systemPrompt = 'Find and explain connections between the current document and the related documents provided.';
  } else if (mode === 'overview') {
    systemPrompt = 'Provide an overview of all the documents, showing how they relate to each other and what the main themes are.';
  } else if (mode === 'find') {
    systemPrompt = 'Find information related to the query across all provided documents and summarize the findings.';
  }

  let baseURL = 'https://api.openai.com/v1';
  if (provider === 'openrouter') baseURL = 'https://openrouter.ai/api/v1';

  const client = new OpenAI({ apiKey, baseURL });
  try {
    const completion = await client.chat.completions.create({
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: contextText + (query ? `\n\nQuery: ${query}` : '') }
      ]
    });
    return completion.choices[0].message.content;
  } catch (err) {
    console.error('Multi-file AI error:', err);
    return `Error: ${err.message}`;
  }
});

// ---- Settings (existing) ----
ipcMain.handle('settings:load', () => loadSettings());
ipcMain.handle('settings:save', (event, settings) => { saveSettings(settings); return true; });

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });