const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
const natural = require('natural');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const officegen = require('officegen');
const TurndownService = require('turndown');
const showdown = require('showdown');
const JSZip = require('jszip');
const xml2js = require('xml2js');
const pptxgen = require('pptxgenjs');

// Will be initialized after app is ready
let settingsFile, contextCacheFile;

// ---- Default settings with models list ----
const defaultSettings = {
  apiKey: '',
  provider: 'openrouter',
  lastModel: 'deepseek/deepseek-r1-0528:free',
  aiMode: 'append',
  models: [
    'deepseek/deepseek-r1-0528:free',
    'anthropic/claude-3-haiku:beta',
    'openai/gpt-4o-mini',
    'google/gemini-flash-1.5',
    'meta-llama/llama-3.1-8b-instruct:free'
  ]
};

// ---- Settings helpers ----
function loadSettings() {
  try {
    const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
    // Ensure models array exists and has defaults
    if (!settings.models || settings.models.length === 0) {
      settings.models = [...defaultSettings.models];
    }
    return { ...defaultSettings, ...settings };
  } catch {
    return { ...defaultSettings };
  }
}

function saveSettings(settings) {
  const current = loadSettings();
  const updated = { ...current, ...settings };
  fs.writeFileSync(settingsFile, JSON.stringify(updated, null, 2));
  return updated;
}

// ---- Context cache helpers (from Step 6) ----
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
    width: 1400,
    height: 900,
    webPreferences: { 
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false // Allow local file access for document processing
    }
  });
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, 'dist/index.html'));
  }
}

// Initialize app paths after Electron is ready
app.whenReady().then(() => {
  settingsFile = path.join(app.getPath('userData'), 'settings.json');
  contextCacheFile = path.join(app.getPath('userData'), 'context-cache.json');
  
  // Create window after paths are initialized
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---- Document processing helpers ----
async function readDocx(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return { content: result.value, format: 'docx' };
  } catch (err) {
    throw new Error(`DOCX reading failed: ${err.message}`);
  }
}

async function readPptx(filePath) {
  try {
    const content = await extractTextFromPPTX(filePath);
    return { content, format: 'pptx' };
  } catch (err) {
    throw new Error(`PPTX reading failed: ${err.message}`);
  }
}

async function extractTextFromPPTX(filePath) {
  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);
  
  let textContent = [];
  let slideCount = 0;
  
  // Find all slide files
  zip.forEach((relativePath, file) => {
    if (relativePath.startsWith('ppt/slides/slide') && relativePath.endsWith('.xml')) {
      slideCount++;
    }
  });

  // Process each slide
  for (let i = 1; i <= slideCount; i++) {
    const slidePath = `ppt/slides/slide${i}.xml`;
    if (!zip.files[slidePath]) continue;

    const slideContent = await zip.file(slidePath).async('string');
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(slideContent);
    
    // Extract text from slide
    const extractText = (obj) => {
      if (typeof obj === 'string') return obj;
      if (obj['a:t']) return obj['a:t'].map(t => t._ || t).join(' ');
      if (obj['a:r']) return obj['a:r'].map(extractText).join(' ');
      if (obj['a:p']) return obj['a:p'].map(extractText).join('\n');
      return Object.values(obj).map(extractText).join(' ');
    };

    const slideText = extractText(result);
    textContent.push(`Slide ${i}:\n${slideText}\n`);
  }

  return textContent.join('\n');
}

async function readPdf(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return { content: data.text, format: 'pdf' };
  } catch (err) {
    throw new Error(`PDF reading failed: ${err.message}`);
  }
}

function readTxt(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { content, format: 'txt' };
  } catch (err) {
    throw new Error(`TXT reading failed: ${err.message}`);
  }
}

function readMarkdown(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { content, format: 'md' };
  } catch (err) {
    throw new Error(`Markdown reading failed: ${err.message}`);
  }
}

async function writeDocx(filePath, content) {
  return new Promise((resolve, reject) => {
    const docx = officegen('docx');
    
    // Convert markdown to plain text for now (basic implementation)
    const turndownService = new TurndownService();
    const plainText = turndownService.turndown(content);
    
    const pObj = docx.createP();
    pObj.addText(plainText);
    
    const output = fs.createWriteStream(filePath);
    docx.generate(output);
    
    output.on('close', () => resolve(true));
    output.on('error', reject);
  });
}

async function writePptx(filePath, content) {
  try {
    const pptx = new pptxgen();
    
    // Create a slide and add the content as text
    const slide = pptx.addSlide();
    slide.addText(content, {
      x: 0.5,
      y: 0.5,
      w: 9,
      h: 6.5,
      fontSize: 12,
      align: 'left',
      valign: 'top'
    });
    
    await pptx.writeFile(filePath);
    return true;
  } catch (err) {
    throw new Error(`PPTX writing failed: ${err.message}`);
  }
}

function writeHtml(filePath, content) {
  const converter = new showdown.Converter();
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Document</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
           max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
    pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
  </style>
</head>
<body>
${converter.makeHtml(content)}
</body>
</html>`;
  fs.writeFileSync(filePath, html, 'utf-8');
}

// ---- Enhanced File Operations ----
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
  const ext = path.extname(filePath).toLowerCase();
  
  try {
    let result;
    switch (ext) {
      case '.docx':
        result = await readDocx(filePath);
        break;
      case '.pdf':
        result = await readPdf(filePath);
        break;
      case '.pptx':
        result = await readPptx(filePath);
        break;
      case '.txt':
        result = readTxt(filePath);
        break;
      case '.md':
      default:
        result = readMarkdown(filePath);
        break;
    }
    
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

ipcMain.handle('dialog:exportFile', async (event, { filePath, content, format }) => {
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
    switch (format) {
      case 'docx':
        await writeDocx(exportPath, content);
        break;
      case 'pptx':
        await writePptx(exportPath, content);
        break;
      case 'html':
        writeHtml(exportPath, content);
        break;
      case 'txt':
        // Convert markdown to plain text
        const turndownService = new TurndownService();
        const plainText = content.replace(/#{1,6}\s+/g, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
        fs.writeFileSync(exportPath, plainText, 'utf-8');
        break;
      case 'md':
      default:
        fs.writeFileSync(exportPath, content, 'utf-8');
        break;
    }
    return { canceled: false, filePath: exportPath };
  } catch (err) {
    return { canceled: false, error: err.message };
  }
});

// ---- Enhanced Folder Operations ----
ipcMain.handle('dialog:openFolder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (canceled || filePaths.length === 0) return { canceled: true };
  const folderPath = filePaths[0];
  const files = scanSupportedFiles(folderPath);
  return { canceled: false, folderPath, files };
});

function scanSupportedFiles(root) {
  const out = [];
  const supportedExts = ['.md', '.txt', '.docx', '.pdf', '.pptx'];
  
  function walk(dir) {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (e.isFile()) {
        const ext = path.extname(full).toLowerCase();
        if (supportedExts.includes(ext)) {
          let stat = null;
          try { stat = fs.statSync(full); } catch { stat = { size: 0, mtimeMs: 0 }; }
          out.push({
            name: e.name,
            path: full,
            size: stat.size,
            mtime: stat.mtimeMs,
            format: ext.slice(1) // remove dot
          });
        }
      }
    }
  }
  walk(root);
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

ipcMain.handle('fs:readFile', async (event, { filePath }) => {
  try {
    const ext = path.extname(filePath).toLowerCase();
    let result;
    
    switch (ext) {
      case '.docx':
        result = await readDocx(filePath);
        break;
      case '.pdf':
        result = await readPdf(filePath);
        break;
      case '.pptx':
        result = await readPptx(filePath);
        break;
      case '.txt':
        result = readTxt(filePath);
        break;
      case '.md':
      default:
        result = readMarkdown(filePath);
        break;
    }
    
    return { ok: true, content: result.content, format: result.format };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

// ---- Settings Management ----
ipcMain.handle('settings:load', async () => {
  return loadSettings();
});

ipcMain.handle('settings:save', async (event, newSettings) => {
  return saveSettings(newSettings);
});

// ---- Model Management ----
ipcMain.handle('models:add', async (event, { model }) => {
  const settings = loadSettings();
  if (!settings.models.includes(model)) {
    settings.models.unshift(model); // Add to beginning
    // Keep only last 20 models
    if (settings.models.length > 20) {
      settings.models = settings.models.slice(0, 20);
    }
  }
  return saveSettings(settings);
});

ipcMain.handle('models:remove', async (event, { model }) => {
  const settings = loadSettings();
  settings.models = settings.models.filter(m => m !== model);
  return saveSettings(settings);
});

ipcMain.handle('models:clear', async () => {
  const settings = loadSettings();
  settings.models = [...defaultSettings.models]; // Reset to defaults
  return saveSettings(settings);
});

// ---- AI Actions ----
ipcMain.handle('ai:action', async (event, { provider, apiKey, modelId, mode, text }) => {
  try {
    // Create OpenAI client based on provider
    const openai = new OpenAI({
      apiKey,
      baseURL: provider === 'openrouter' 
        ? 'https://openrouter.ai/api/v1' 
        : undefined
    });

    // Create system prompt based on action mode
    let systemPrompt;
    switch (mode) {
      case 'improve':
        systemPrompt = 'You are a writing assistant. Improve the following text while preserving its meaning:';
        break;
      case 'summarize':
        systemPrompt = 'You are a summarization assistant. Create a concise summary of the following text:';
        break;
      case 'ask':
        systemPrompt = 'You are a helpful assistant. Answer the user\'s question based on the provided context:';
        break;
      default:
        systemPrompt = 'You are a helpful assistant. Perform the requested action:';
    }

    // Call the AI API
    const response = await openai.chat.completions.create({
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text }
      ],
      max_tokens: 2000
    });

    return response.choices[0].message.content;
  } catch (err) {
    console.error('AI request failed:', err);
    return `AI Error: ${err.message}`;
  }
});

// ---- AI Multi-File Actions (placeholder) ----
ipcMain.handle('aiMultiFileAction', async (event, { provider, apiKey, modelId, mode, currentFile, relatedFiles, query }) => {
  return "Multi-file AI features are not implemented in this version.";
});

// ---- Context Building (from Step 6) ----
ipcMain.handle('context:build', async (event, { folderPath }) => {
  const files = scanSupportedFiles(folderPath);
  const processedFiles = [];
  
  for (const file of files) {
    try {
      let content;
      const ext = path.extname(file.path).toLowerCase();
      
      // Only process text-based files for context
      if (['.md', '.txt'].includes(ext)) {
        content = fs.readFileSync(file.path, 'utf-8');
      } else if (ext === '.docx') {
        const result = await readDocx(file.path);
        content = result.content;
      } else if (ext === '.pdf') {
        const result = await readPdf(file.path);
        content = result.content;
      } else {
        continue; // Skip unsupported formats for context
      }
      
      const processed = processFileContent(content, file.path);
      contextCache.files[file.path] = {
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
  
  contextCache.lastUpdate = Date.now();
  saveContextCache();
  
  return {
    success: true,
    filesProcessed: processedFiles.length,
    files: processedFiles
  };
});

function processFileContent(content, filePath) {
  // Same as Step 6
  const words = natural.WordTokenizer.tokenize(content.toLowerCase()) || [];
  const sentences = natural.SentenceTokenizer.tokenize(content) || [];
  
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them']);
  const filteredWords = words.filter(word => 
    word && word.length > 2 && !stopWords.has(word) && !/^\d+$/.test(word)
  );
  
  const wordFreq = {};
  filteredWords.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });
  
  const keyTerms = Object.entries(wordFreq)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 20)
    .map(([word]) => word);
  
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

ipcMain.handle('context:related', async (event, { filePath, query }) => {
  const currentFile = contextCache.files[filePath];
  if (!currentFile) return { files: [] };
  
  const queryWords = natural.WordTokenizer.tokenize(query.toLowerCase()) || [];
  const relatedFiles = [];
  
  for (const [fPath, fileData] of Object.entries(contextCache.files)) {
    if (fPath === filePath) continue;
    
    let similarity = 0;
    
    queryWords.forEach(word => {
      if (fileData.keyTerms.includes(word)) {
        similarity += 2;
      }
      if (fileData.vector[word]) {
        similarity += fileData.vector[word];
      }
    });
    
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
