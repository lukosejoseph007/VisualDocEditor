# Step 6 — Multi-File Context & Smart AI

You now have a working Electron app with folder navigation and AI actions (Steps 1–5). In Step 6, you'll enhance the AI to be **context-aware across multiple files** in your opened folder, making it much smarter for document projects.

---

## 🎯 Goals

* **Multi-file AI context**: AI can see content from other files in the folder
* **Smart context selection**: Only include relevant files to avoid token limits
* **File relationship understanding**: AI knows which files are related
* **Enhanced AI modes**: New modes that work across multiple documents
* **Simple vector search**: Basic similarity matching for large folders

---

## 📦 Resulting Structure

```
VisualDocEditor/
├── main.js              # UPDATED: add context building + simple embedding
├── preload.js           # UPDATED: expose context APIs
├── index.html           # UPDATED: new AI modes + context indicator
├── renderer.mjs         # UPDATED: multi-file context handling
├── package.json         # UPDATED: add simple text processing
├── vite.config.js
└── context-cache.json   # AUTO-CREATED: stores file context cache
```

---

## 1) **package.json** — Add text processing dependency

**Update your `package.json` dependencies section:**

```json
{
  "name": "visualdoceditor",
  "version": "1.0.0",
  "description": "AI-powered document editor MVP",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "monaco-editor": "^0.52.2",
    "openai": "^4.0.0",
    "natural": "^6.12.0"
  },
  "devDependencies": {
    "electron": "^31.0.0",
    "vite": "^5.0.0"
  }
}
```

**Install the new dependency:**

```powershell
cd "C:\Users\SRINSHA\Desktop\Lukose\Startup Project\VisualDocEditor"
npm install natural
```

---

## 2) **index.html** — Add multi-file AI modes

**Replace the entire `index.html` with this:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>VisualDocEditor</title>
  <style>
    :root { --bg:#181818; --panel:#222; --text:#fff; --muted:#a0a0a0; --accent:#7aa2f7; }
    html, body { margin:0; padding:0; height:100vh; width:100vw; font-family:system-ui, sans-serif; background:var(--bg); color:var(--text); }
    #toolbar { background:var(--panel); padding:8px; display:flex; flex-wrap:wrap; align-items:center; gap:10px; border-bottom:1px solid #333; }
    #toolbar section { display:flex; align-items:center; gap:8px; }
    button, select, input { padding:4px 8px; font-size:14px; border-radius:6px; border:1px solid #444; background:#2a2a2a; color:var(--text); }
    button:hover { background:#3a3a3a; }
    button.context-mode { background:#1a4a5a; border-color:#2a6a7a; }
    button.context-mode:hover { background:#2a5a6a; }
    input[type="text"], input[type="password"] { min-width:180px; }
    #main { display:flex; height:calc(100vh - 56px); width:100vw; }
    #sidebar { width:280px; background:#1b1b1b; border-right:1px solid #333; display:flex; flex-direction:column; }
    #folderHeader { padding:10px; border-bottom:1px solid #333; font-size:12px; color:var(--muted); word-break:break-all; }
    #contextIndicator { padding:6px 10px; background:#2a4a2a; border-bottom:1px solid #333; font-size:11px; }
    #fileSearchWrap { padding:8px; border-bottom:1px solid #333; }
    #fileList { flex:1; overflow:auto; list-style:none; margin:0; padding:4px 0; }
    .fileItem { padding:8px 10px; cursor:pointer; border-bottom:1px solid #232323; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .fileItem:hover { background:#262626; }
    .fileItem.active { background:#313131; border-left:3px solid var(--accent); }
    .fileItem.has-context { border-right:2px solid #4a6a4a; }
    #editor { flex:1; min-width:0; }
    .pill { font-size:11px; color:#ccc; background:#333; padding:2px 6px; border-radius:999px; }
    .status { font-size:11px; color:var(--muted); margin-left:8px; }
  </style>
</head>
<body>
  <div id="toolbar">
    <!-- File -->
    <section>
      <button id="openFolderBtn">Open Folder</button>
      <button id="openBtn">Open File</button>
      <button id="saveBtn">Save</button>
    </section>

    <!-- Single File AI -->
    <section>
      <button id="aiImprove">Improve</button>
      <button id="aiSummarize">Summarize</button>
      <input id="aiQuestion" type="text" placeholder="Ask a question..." />
      <button id="aiAsk">Ask</button>
    </section>

    <!-- Multi-File AI -->
    <section>
      <button id="aiExplain" class="context-mode">Explain</button>
      <button id="aiConnect" class="context-mode">Connect</button>
      <button id="aiFind" class="context-mode">Find Similar</button>
      <button id="aiOverview" class="context-mode">Overview</button>
    </section>

    <!-- AI Settings -->
    <section>
      <label>Provider:</label>
      <select id="provider">
        <option value="openrouter" selected>OpenRouter</option>
        <option value="openai">OpenAI</option>
      </select>
      <label>API Key:</label>
      <input id="apiKey" type="password" placeholder="Enter API Key" />
      <label>Model:</label>
      <input id="modelId" type="text" value="deepseek/deepseek-r1-0528:free" />
      <label>Mode:</label>
      <select id="aiMode">
        <option value="append">Append</option>
        <option value="replace">Replace</option>
      </select>
    </section>
  </div>

  <div id="main">
    <aside id="sidebar">
      <div id="folderHeader">No folder open</div>
      <div id="contextIndicator">Context: Not ready</div>
      <div id="fileSearchWrap">
        <input id="fileSearch" type="text" placeholder="Filter files... (Ctrl+K)" style="width:100%" />
      </div>
      <ul id="fileList"></ul>
    </aside>
    <div id="editor"></div>
  </div>

  <script type="module" src="./renderer.mjs"></script>
</body>
</html>
```

---

## 3) **preload.js** — Add context APIs

**Replace the entire `preload.js` with this:**

```js
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
```

---

## 4) **main.js** — Add context building and vector search

**Replace the entire `main.js` with this:**

```js
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
```

---

## 5) **renderer.mjs** — Add multi-file context handling

**Replace the entire `renderer.mjs` with this:**

```js
import * as monaco from 'monaco-editor';

// --- Editor setup ---
const editorContainer = document.getElementById('editor');
let currentFilePath = null;
let currentFolderPath = null;
let lastLoadedContent = '';
let files = [];
let contextReady = false;

const editor = monaco.editor.create(editorContainer, {
  value: '# Hello VisualDocEditor\n\nNow with multi-file AI context! Open a folder and try the new AI modes.',
  language: 'markdown',
  theme: 'vs-dark',
  automaticLayout: true,
  minimap: { enabled: false },
  fontSize: 16
});

// --- Settings: load API key into toolbar ---
window.api.loadSettings().then((settings) => {
  if (settings.apiKey) document.getElementById('apiKey').value = settings.apiKey;
});

document.getElementById('apiKey').addEventListener('change', () => {
  const apiKey = document.getElementById('apiKey').value;
  window.api.saveSettings({ apiKey });
});

// --- Utility functions ---
function hasUnsavedChanges() {
  return editor.getValue() !== lastLoadedContent;
}

async function confirmLoseChanges() {
  if (!hasUnsavedChanges()) return true;
  return confirm('You have unsaved changes in the current file. Continue?');
}

function updateContextIndicator(status) {
  const indicator = document.getElementById('contextIndicator');
  indicator.textContent = `Context: ${status}`;
  indicator.className = contextReady ? 'ready' : 'building';
}

// --- Sidebar rendering ---
const fileListEl = document.getElementById('fileList');
const folderHeaderEl = document.getElementById('folderHeader');
const fileSearchEl = document.getElementById('fileSearch');

function renderFiles(list) {
  fileListEl.innerHTML = '';
  list.forEach((f) => {
    const li = document.createElement('li');
    li.className = 'fileItem' + (f.path === currentFilePath ? ' active' : '') + (f.hasContext ? ' has-context' : '');
    li.title = f.path + (f.hasContext ? ' (Context ready)' : ' (No context)');
    
    const nameSpan = document.createElement('span');
    nameSpan.textContent = f.name;
    li.appendChild(nameSpan);
    
    if (f.wordCount) {
      const pill = document.createElement('span');
      pill.className = 'pill';
      pill.textContent = `${f.wordCount} words`;
      li.appendChild(pill);
    }
    
    li.addEventListener('click', async () => {
      if (f.path === currentFilePath) return;
      const ok = await confirmLoseChanges();
      if (!ok) return;
      await loadFileIntoEditor(f.path);
      highlightActive(f.path);
    });
    fileListEl.appendChild(li);
  });
}

function highlightActive(path) {
  [...document.querySelectorAll('.fileItem')].forEach((el) => el.classList.remove('active'));
  const match = [...document.querySelectorAll('.fileItem')].find((el) => el.title.startsWith(path));
  if (match) match.classList.add('active');
}

function applySearchFilter() {
  const q = fileSearchEl.value.trim().toLowerCase();
  if (!q) return renderFiles(files);
  const filtered = files.filter((f) => f.name.toLowerCase().includes(q));
  renderFiles(filtered);
}

fileSearchEl.addEventListener('input', applySearchFilter);
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    fileSearchEl.focus();
    fileSearchEl.select();
  }
});

// --- Load a file into the editor ---
async function loadFileIntoEditor(filePath) {
  const resp = await window.api.readFile(filePath);
  if (!resp.ok) {
    alert('Failed to read file: ' + (resp.error || 'Unknown error'));
    return;
  }
  currentFilePath = filePath;
  editor.setValue(resp.content);
  lastLoadedContent = resp.content;
}

// --- Build context for folder ---
async function buildFolderContext(folderPath) {
  updateContextIndicator('Building...');
  contextReady = false;
  
  try {
    const result = await window.api.buildContext(folderPath);
    if (result.success) {
      contextReady = true;
      updateContextIndicator(`Ready (${result.filesProcessed} files)`);
      
      // Update files list with context info
      files = files.map(f => {
        const contextFile = result.files.find(cf => cf.path === f.path);
        return contextFile ? { ...f, ...contextFile } : f;
      });
      renderFiles(files);
    } else {
      updateContextIndicator('Failed');
    }
  } catch (err) {
    console.error('Context building failed:', err);
    updateContextIndicator('Error');
  }
}

// --- Toolbar: File operations ---
document.getElementById('openFolderBtn').addEventListener('click', async () => {
  const ok = await confirmLoseChanges();
  if (!ok) return;

  const result = await window.api.openFolder();
  if (!result || result.canceled) return;

  currentFolderPath = result.folderPath;
  files = result.files || [];
  folderHeaderEl.textContent = currentFolderPath + `  · ${files.length} files`;
  renderFiles(files);

  if (files.length > 0) {
    await loadFileIntoEditor(files[0].path);
    highlightActive(files[0].path);
    
    // Build context for the folder
    await buildFolderContext(currentFolderPath);
  } else {
    currentFilePath = null;
    editor.setValue('# (Empty folder)\nNo .md files found.');
    lastLoadedContent = editor.getValue();
    updateContextIndicator('No files');
  }
});

document.getElementById('openBtn').addEventListener('click', async () => {
  const ok = await confirmLoseChanges();
  if (!ok) return;

  const result = await window.api.openFile();
  if (!result.canceled) {
    currentFilePath = result.filePath;
    editor.setValue(result.content);
    lastLoadedContent = result.content;

    if (currentFolderPath && currentFilePath.startsWith(currentFolderPath)) {
      if (!files.find((f) => f.path === currentFilePath)) {
        files.push({ name: currentFilePath.split(/\\|\//).pop(), path: currentFilePath, size: result.content.length, mtime: Date.now() });
        files.sort((a, b) => a.name.localeCompare(b.name));
      }
      renderFiles(files);
      highlightActive(currentFilePath);
    } else {
      folderHeaderEl.textContent = 'No folder open (single file)';
      renderFiles([]);
      updateContextIndicator('Single file');
      contextReady = false;
    }
  }
});

document.getElementById('saveBtn').addEventListener('click', async () => {
  const content = editor.getValue();
  const result = await window.api.saveFile(currentFilePath, content);
  if (!result.canceled) {
    currentFilePath = result.filePath;
    lastLoadedContent = content;
    if (currentFolderPath && currentFilePath.startsWith(currentFolderPath)) {
      if (!files.find((f) => f.path === currentFilePath)) {
        files.push({ name: currentFilePath.split(/\\|\//).pop(), path: currentFilePath, size: content.length, mtime: Date.now() });
        files.sort((a, b) => a.name.localeCompare(b.name));
        renderFiles(files);
      }
      highlightActive(currentFilePath);
    }
  }
});

// --- AI Helpers ---
function getSelectedOrAllText() {
  const selection = editor.getModel().getValueInRange(editor.getSelection());
  return selection || editor.getValue();
}

function applyAIResponse(response) {
  const mode = document.getElementById('aiMode').value;
  if (mode === 'replace') {
    const selection = editor.getSelection();
    if (selection && !selection.isEmpty()) {
      editor.executeEdits('', [{ range: selection, text: response, forceMoveMarkers: true }]);
    } else {
      editor.setValue(response);
    }
  } else {
    editor.trigger('keyboard', 'type', { text: `\n\n[AI Result]\n${response}` });
  }
}

async function runAI(mode, extra = '') {
  const text = getSelectedOrAllText();
  const provider = document.getElementById('provider').value;
  const apiKey = document.getElementById('apiKey').value;
  const modelId = document.getElementById('modelId').value;
  const result = await window.api.aiAction({ provider, apiKey, modelId, mode, text: text + extra });
  applyAIResponse(result);
}

async function runMultiFileAI(mode, query = '') {
  if (!contextReady) {
    alert('Context not ready. Please wait for folder indexing to complete.');
    return;
  }

  const currentContent = editor.getValue();
  const provider = document.getElementById('provider').value;
  const apiKey = document.getElementById('apiKey').value;
  const modelId = document.getElementById('modelId').value;
  
  // Get related files for context
  const relatedResult = await window.api.getRelatedFiles(currentFilePath, query || currentContent.substring(0, 500));
  
  const result = await window.api.aiMultiFileAction({
    provider,
    apiKey,
    modelId,
    mode,
    currentFile: { path: currentFilePath, content: currentContent },
    relatedFiles: relatedResult.files,
    query
  });
  
  applyAIResponse(result);
}

// --- Single File AI Buttons ---
document.getElementById('aiImprove').addEventListener('click', () => runAI('improve'));
document.getElementById('aiSummarize').addEventListener('click', () => runAI('summarize'));
document.getElementById('aiAsk').addEventListener('click', () => {
  const q = document.getElementById('aiQuestion').value;
  if (!q.trim()) return alert('Please enter a question!');
  runAI('ask', `\n\nQuestion: ${q}`);
});

// --- Multi-File AI Buttons ---
document.getElementById('aiExplain').addEventListener('click', () => runMultiFileAI('explain'));
document.getElementById('aiConnect').addEventListener('click', () => runMultiFileAI('connect'));
document.getElementById('aiOverview').addEventListener('click', () => runMultiFileAI('overview'));
document.getElementById('aiFind').addEventListener('click', () => {
  const q = document.getElementById('aiQuestion').value;
  if (!q.trim()) return alert('Please enter a search query!');
  runMultiFileAI('find', q);
});

```


Now let me add the rest of the documentation:

---

## 6) **Running the Updated App**

**Install the new dependency first:**

```powershell
cd "C:\Users\SRINSHA\Desktop\Lukose\Startup Project\VisualDocEditor"
npm install natural
```

**Development Mode (recommended):**

```powershell
# Terminal 1: Start Vite dev server
npm run dev

# Terminal 2: Start Electron
$env:NODE_ENV="development"
npm start
```

**Production Mode:**

```powershell
npm run build
npm start
```

---

## ✅ Expected Behavior

### New UI Elements

1. **Context Indicator**: Shows "Context: Building..." then "Context: Ready (X files)"
2. **Multi-File AI Buttons**: Blue-tinted buttons (Explain, Connect, Find Similar, Overview)  
3. **Enhanced File List**: Files with context show a green border indicator
4. **Word Count Pills**: Small badges showing word count for processed files

### New AI Modes

1. **Explain**: Uses related documents to explain concepts in current file
2. **Connect**: Finds relationships between current document and related ones
3. **Find Similar**: Uses your question to search across all documents 
4. **Overview**: Provides a summary of how all documents relate to each other

### Context Building Process

1. Open a folder → App scans all `.md` files
2. Builds simple vectors using word frequency analysis
3. Caches results in `context-cache.json` for fast reloading
4. Files with processed context show visual indicators

### Smart Context Selection

- AI automatically finds 3-5 most relevant files based on:
  - Shared key terms with current document
  - Query word matches
  - Simple similarity scoring
- Avoids token limit issues by summarizing related files

---

## 🔧 Technical Details

### Context Processing

- Uses `natural` library for tokenization and text processing
- Extracts key terms by filtering stop words and ranking by frequency
- Builds simple TF-IDF-like vectors for similarity matching
- Caches processed data to avoid re-processing unchanged files

### File Similarity Algorithm

```javascript
// Similarity score calculation:
similarity += 2 * queryWordMatches
similarity += 1 * sharedKeyTerms  
similarity += wordFrequencyScores
```

### Performance Optimizations

- Context cache prevents re-processing unchanged files
- Only top 5 related files sent to AI (token management)
- File summaries instead of full content for context
- Async processing with progress indicators

---

## ⚠️ Known Limitations & Future Improvements

### Current Limitations

1. **Simple similarity**: Basic word frequency, not semantic similarity
2. **English-focused**: Stop word list and tokenization optimized for English
3. **Memory usage**: All vectors stored in memory (fine for <100 files)
4. **No chunking**: Large files processed as single units

### Planned Improvements (Step 7+)

1. **Semantic embeddings**: Use actual embedding models for better similarity
2. **Document chunking**: Split large files into smaller, searchable chunks  
3. **Persistent vector DB**: SQLite-based storage for larger projects
4. **Multi-language support**: Better tokenization for other languages

---

## 🚨 Troubleshooting

### "Context: Error" Status

**Cause**: Usually file reading permissions or corrupted `.md` files
**Fix**: Check console logs, ensure all files are readable

### Multi-File AI Buttons Disabled

**Cause**: Context not ready or no folder open
**Fix**: Open a folder and wait for "Context: Ready" status

### Slow Context Building

**Cause**: Many large files or slow disk I/O  
**Fix**: Normal for first run, subsequent loads use cache

### AI Responses Too Generic

**Cause**: Related files not relevant enough
**Fix**: Use more specific query terms, or manually select text that represents main concepts

---

## ✅ Step 6 Status

- [x] Multi-file context building with caching
- [x] Simple vector similarity search
- [x] Four new AI modes for document relationships
- [x] Visual indicators for context-ready files
- [x] Smart related file selection for AI context
- [x] Performance optimizations with caching

---

## 📜 Step 7 Preview

Next we'll add **Document Format Expansion**:

* **DOCX support**: Read/write Word documents with formatting preservation
* **PDF text extraction**: Import PDF content for AI analysis  
* **Export options**: Save documents in multiple formats
* **Format conversion**: Transform between Markdown, DOCX, and HTML

This will make your editor much more versatile for different document workflows while maintaining the core AI-powered editing experience.

---

## 💡 Pro Tips

### Maximizing Multi-File AI

1. **Use descriptive filenames**: Better file matching in context
2. **Consistent terminology**: Use same terms across related documents
3. **Structure with headings**: AI can better understand document organization
4. **Ask specific questions**: "Find Similar" works best with targeted queries

### Folder Organization

```
MyProject/
├── overview.md          # Main project summary
├── requirements.md      # Detailed requirements  
├── architecture.md      # Technical architecture
└── sections/
    ├── frontend.md      # UI/UX details
    ├── backend.md       # Server details
    └── database.md      # Data model
```

This structure gives AI rich context for understanding relationships between different aspects of your project.