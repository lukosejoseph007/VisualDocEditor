# Step 5 — Folder Navigation & Multi‑File Support

You already have a working Electron + Monaco app with AI actions (Steps 1–4). In Step 5, you’ll add **Open Folder**, display a **sidebar file list**, and let users **switch between multiple Markdown files** in a chosen folder.

---

## 🎯 Goals

* New **Open Folder** action
* Show a **sidebar** listing `.md` files in the selected folder (recursively)
* Click a file → load it into Monaco
* Preserve existing **Open/Save**, **AI actions**, and **Replace/Append** behavior
* Optional safeguard: warn when switching files with **unsaved changes**

---

## 📦 Resulting Structure (unchanged files omitted)

```
VisualDocEditor/
├── main.js              # UPDATED: add folder scanning + readFile handler
├── preload.js           # UPDATED: expose openFolder/readFile
├── index.html           # UPDATED: sidebar + Open Folder UI
├── renderer.mjs         # UPDATED: folder state, list render, file switching
├── package.json
├── vite.config.js
└── ...
```

> Tip (Windows): run all commands from your project root folder:
>
> `C:\Users\SRINSHA\Desktop\Lukose\Startup Project\VisualDocEditor`
> In PowerShell: `cd "C:\Users\SRINSHA\Desktop\Lukose\Startup Project\VisualDocEditor"`

---

## 1) **index.html** — Add Open Folder button and sidebar

**Replace the entire `index.html` with this:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>VisualDocEditor</title>
  <style>
    :root { --bg:#181818; --panel:#222; --text:#fff; --muted:#a0a0a0; }
    html, body { margin:0; padding:0; height:100vh; width:100vw; font-family:system-ui, sans-serif; background:var(--bg); color:var(--text); }
    #toolbar { background:var(--panel); padding:8px; display:flex; flex-wrap:wrap; align-items:center; gap:10px; border-bottom:1px solid #333; }
    #toolbar section { display:flex; align-items:center; gap:8px; }
    button, select, input { padding:4px 8px; font-size:14px; border-radius:6px; border:1px solid #444; background:#2a2a2a; color:var(--text); }
    input[type="text"], input[type="password"] { min-width:180px; }
    #main { display:flex; height:calc(100vh - 56px); width:100vw; }
    #sidebar { width:280px; background:#1b1b1b; border-right:1px solid #333; display:flex; flex-direction:column; }
    #folderHeader { padding:10px; border-bottom:1px solid #333; font-size:12px; color:var(--muted); word-break:break-all; }
    #fileSearchWrap { padding:8px; border-bottom:1px solid #333; }
    #fileList { flex:1; overflow:auto; list-style:none; margin:0; padding:4px 0; }
    .fileItem { padding:8px 10px; cursor:pointer; border-bottom:1px solid #232323; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .fileItem:hover { background:#262626; }
    .fileItem.active { background:#313131; border-left:3px solid #7aa2f7; }
    #editor { flex:1; min-width:0; }
    .pill { font-size:11px; color:#ccc; background:#333; padding:2px 6px; border-radius:999px; }
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

    <!-- AI Actions -->
    <section>
      <button id="aiImprove">Improve</button>
      <button id="aiSummarize">Summarize</button>
      <input id="aiQuestion" type="text" placeholder="Ask a question..." />
      <button id="aiAsk">Ask</button>
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

## 2) **preload.js** — Expose new APIs

**Replace the entire `preload.js` with this:**

```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Files (existing)
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (filePath, content) => ipcRenderer.invoke('dialog:saveFile', { filePath, content }),

  // AI (existing)
  aiAction: (data) => ipcRenderer.invoke('ai:action', data),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

  // NEW: folder + file reading
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', { filePath })
});
```

---

## 3) **main.js** — Add folder scanning + `readFile`

**Replace the entire `main.js` with this:**

```js
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');

const settingsFile = path.join(app.getPath('userData'), 'settings.json');

// ---- Settings helpers ----
function loadSettings() {
  try { return JSON.parse(fs.readFileSync(settingsFile, 'utf-8')); } catch { return { apiKey: '' }; }
}
function saveSettings(settings) {
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
}

// ---- Window ----
function createWindow() {
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

// ---- NEW: Open Folder + scan recursively for .md ----
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
  // sort by name asc
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

// ---- NEW: read file by path (used when clicking in sidebar) ----
ipcMain.handle('fs:readFile', async (event, { filePath }) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { ok: true, content };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

// ---- AI (existing from Step 4) ----
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

// ---- Settings (existing) ----
ipcMain.handle('settings:load', () => loadSettings());
ipcMain.handle('settings:save', (event, settings) => { saveSettings(settings); return true; });

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
```

---

## 4) **renderer.mjs** — Manage folder state, render list, switch files

**Replace the entire `renderer.mjs` with this:**

```js
import * as monaco from 'monaco-editor';

// --- Editor setup ---
const editorContainer = document.getElementById('editor');
let currentFilePath = null;
let currentFolderPath = null;
let lastLoadedContent = ''; // for unsaved-change checks
let files = []; // sidebar list

const editor = monaco.editor.create(editorContainer, {
  value: '# Hello VisualDocEditor\n\nNow with folder navigation and a sidebar!',
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

// --- Utility: confirm if unsaved changes ---
function hasUnsavedChanges() {
  return editor.getValue() !== lastLoadedContent;
}
async function confirmLoseChanges() {
  if (!hasUnsavedChanges()) return true;
  return confirm('You have unsaved changes in the current file. Continue?');
}

// --- Sidebar rendering ---
const fileListEl = document.getElementById('fileList');
const folderHeaderEl = document.getElementById('folderHeader');
const fileSearchEl = document.getElementById('fileSearch');

function renderFiles(list) {
  fileListEl.innerHTML = '';
  list.forEach((f) => {
    const li = document.createElement('li');
    li.className = 'fileItem' + (f.path === currentFilePath ? ' active' : '');
    li.title = f.path;
    li.textContent = f.name;
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
  const match = [...document.querySelectorAll('.fileItem')].find((el) => el.title === path);
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

// --- Toolbar: File operations ---
document.getElementById('openFolderBtn').addEventListener('click', async () => {
  const ok = await confirmLoseChanges();
  if (!ok) return;

  const result = await window.api.openFolder();
  if (!result || result.canceled) return;

  currentFolderPath = result.folderPath;
  files = result.files || [];
  folderHeaderEl.textContent = currentFolderPath + '  ' + (files.length ? `· ${files.length} files` : '· 0 files');
  renderFiles(files);

  if (files.length > 0) {
    await loadFileIntoEditor(files[0].path);
    highlightActive(files[0].path);
  } else {
    currentFilePath = null;
    editor.setValue('# (Empty folder) No .md files found.');
    lastLoadedContent = editor.getValue();
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

document.getElementById('aiImprove').addEventListener('click', () => runAI('improve'));
document.getElementById('aiSummarize').addEventListener('click', () => runAI('summarize'));
document.getElementById('aiAsk').addEventListener('click', () => {
  const q = document.getElementById('aiQuestion').value;
  if (!q.trim()) return alert('Please enter a question!');
  runAI('ask', `\n\nQuestion: ${q}`);
});


```