---

# 📘 VisualDocEditor — Step 2 Documentation (File Open/Save)

---

## 📂 Project Overview

**Goal of Step 2:**

* Add **Open File** and **Save File** options
* Use Electron’s `dialog` to pick files
* Use Node’s `fs` to read/write file content
* Expose file functions securely from backend (`preload.js`) to frontend (`renderer.mjs`)

---

## 📂 Updated Folder Structure

```
VisualDocEditor/
│
├── package.json
├── vite.config.js
├── main.js
├── preload.js
├── index.html
├── renderer.mjs
└── node_modules/
```

---

## 📄 Code Changes

### 1. `main.js` (update to handle file operations)

```javascript
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, 'dist/index.html'));
  }
}

// Handle file open
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

// Handle file save
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

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

---

### 2. `preload.js` (expose file APIs)

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (filePath, content) =>
    ipcRenderer.invoke('dialog:saveFile', { filePath, content })
});
```

---

### 3. `index.html` (add buttons for file operations)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>VisualDocEditor MVP</title>
  <style>
    body, html {
      margin: 0;
      padding: 0;
      height: 100vh;
      width: 100vw;
      display: flex;
      flex-direction: column;
    }
    #toolbar {
      background: #222;
      color: #fff;
      padding: 10px;
    }
    #editor {
      flex: 1;
      width: 100%;
    }
    button {
      margin-right: 10px;
      padding: 5px 10px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div id="toolbar">
    <button id="openBtn">Open File</button>
    <button id="saveBtn">Save File</button>
  </div>
  <div id="editor"></div>
  <script type="module" src="./renderer.mjs"></script>
</body>
</html>
```

---

### 4. `renderer.mjs` (hook up editor + file actions)

```javascript
import * as monaco from 'monaco-editor';

console.log("Monaco loaded, creating editor...");

const editorContainer = document.getElementById('editor');
let currentFilePath = null;

// Create Monaco editor
const editor = monaco.editor.create(editorContainer, {
  value: "# Hello VisualDocEditor\n\nUse the toolbar to open or save a file.",
  language: "markdown",
  theme: "vs-dark",
  automaticLayout: true,
  minimap: { enabled: false },
  fontSize: 16
});

console.log("Editor created successfully!");

// Hook up buttons
document.getElementById('openBtn').addEventListener('click', async () => {
  const result = await window.api.openFile();
  if (!result.canceled) {
    currentFilePath = result.filePath;
    editor.setValue(result.content);
    console.log(`Opened file: ${currentFilePath}`);
  }
});

document.getElementById('saveBtn').addEventListener('click', async () => {
  const content = editor.getValue();
  const result = await window.api.saveFile(currentFilePath, content);
  if (!result.canceled) {
    currentFilePath = result.filePath;
    console.log(`Saved file: ${currentFilePath}`);
  }
});
```

---

## 🚀 Running the App

1. Start Vite dev server:

   ```powershell
   npm run dev
   ```
2. In another terminal:

   ```powershell
   $env:NODE_ENV="development"
   npm start
   ```

---

## ✅ Expected Behavior

* App window opens with Monaco editor + toolbar
* Toolbar has **Open File** and **Save File** buttons
* Clicking **Open File** → choose a `.md` file → its contents load into Monaco
* Clicking **Save File** → saves changes back to the same file (or lets you pick new file if none opened yet)

---

## ⚠️ Notes

* Still see CSP + worker warnings → ✅ safe to ignore in dev.
* For now, only supports **Markdown (`.md`)**. Later we’ll add TXT, DOCX, etc.

---

## ✅ Step 2 Status

* [x] Editor works
* [x] Open local `.md` file into editor
* [x] Save edits back to disk
* [x] Toolbar UI for file actions

---

## 🔜 Step 3 Preview

Next step will be:

* **AI integration (OpenRouter API)** so you can highlight text, click “Improve” or “Summarize,” and get AI-powered edits directly inside the editor.

---