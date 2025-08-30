---

# 📘 VisualDocEditor — Step 3 Documentation (AI Integration with OpenRouter)

---

## 📂 Project Overview

**Goal of Step 3:**

* Integrate **AI assistance** into the editor via **OpenRouter API**
* Add toolbar buttons for **AI Improve, AI Summarize, AI Ask**
* Use `.env` for storing your API key securely
* Append AI responses into the Monaco editor

---

## 📂 Folder Structure After Step 3

```
VisualDocEditor/
│
├── package.json
├── vite.config.js
├── main.js
├── preload.js
├── index.html
├── renderer.mjs
├── .env                 # stores your OpenRouter API key
└── node_modules/
```

---

## ⚙️ Dependencies

### Installed

```powershell
npm install electron monaco-editor dotenv openai
npm install --save-dev vite
```

* **electron** → desktop runtime
* **monaco-editor** → editor engine
* **dotenv** → load `.env` variables
* **openai** → client for OpenRouter API
* **vite** → bundler for renderer

---

## 📄 Code Files

### 1. `.env`

```ini
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

⚠️ Never commit this file to GitHub. Add `.env` to `.gitignore`.

---

### 2. `package.json`

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
    "openai": "^4.0.0"
  },
  "devDependencies": {
    "electron": "^31.0.0",
    "vite": "^5.0.0"
  }
}
```

---

### 3. `vite.config.js`

```javascript
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
```

---

### 4. `main.js`

```javascript
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const OpenAI = require('openai');
const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1"
});

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

// ---------- File Open/Save ----------
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

// ---------- AI Integration ----------
ipcMain.handle('ai:action', async (event, { mode, text }) => {
  let systemPrompt = "";
  if (mode === "improve") {
    systemPrompt = "Improve this text while keeping the original meaning and style.";
  } else if (mode === "summarize") {
    systemPrompt = "Summarize this text concisely.";
  } else if (mode === "ask") {
    systemPrompt = "Answer the question based on the provided text.";
  }

  try {
    const completion = await client.chat.completions.create({
      model: "deepseek/deepseek-r1-0528:free", // or any OpenRouter-supported model
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text }
      ]
    });
    return completion.choices[0].message.content;
  } catch (err) {
    console.error("AI error:", err);
    return `Error: ${err.message}`;
  }
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

### 5. `preload.js`

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (filePath, content) =>
    ipcRenderer.invoke('dialog:saveFile', { filePath, content }),
  aiAction: (mode, text) => ipcRenderer.invoke('ai:action', { mode, text })
});
```

---

### 6. `index.html`

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
    input {
      padding: 5px;
    }
  </style>
</head>
<body>
  <div id="toolbar">
    <button id="openBtn">Open File</button>
    <button id="saveBtn">Save File</button>
    <button id="aiImprove">AI Improve</button>
    <button id="aiSummarize">AI Summarize</button>
    <input id="aiQuestion" type="text" placeholder="Ask a question..." style="width:200px;" />
    <button id="aiAsk">AI Ask</button>
  </div>
  <div id="editor"></div>
  <script type="module" src="./renderer.mjs"></script>
</body>
</html>
```

---

### 7. `renderer.mjs`

```javascript
import * as monaco from 'monaco-editor';

console.log("Monaco loaded, creating editor...");

const editorContainer = document.getElementById('editor');
let currentFilePath = null;

// Create Monaco editor
const editor = monaco.editor.create(editorContainer, {
  value: "# Hello VisualDocEditor\n\nTry the AI buttons to improve or summarize text!",
  language: "markdown",
  theme: "vs-dark",
  automaticLayout: true,
  minimap: { enabled: false },
  fontSize: 16
});

console.log("Editor created successfully!");

// -------- File Operations --------
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

// -------- AI Helpers --------
function getSelectedOrAllText() {
  const selection = editor.getModel().getValueInRange(editor.getSelection());
  return selection || editor.getValue();
}

// AI buttons
document.getElementById('aiImprove').addEventListener('click', async () => {
  const text = getSelectedOrAllText();
  const result = await window.api.aiAction("improve", text);
  editor.trigger('keyboard', 'type', { text: `\n\n[AI Improved]\n${result}` });
});

document.getElementById('aiSummarize').addEventListener('click', async () => {
  const text = getSelectedOrAllText();
  const result = await window.api.aiAction("summarize", text);
  editor.trigger('keyboard', 'type', { text: `\n\n[AI Summary]\n${result}` });
});

document.getElementById('aiAsk').addEventListener('click', async () => {
  const text = getSelectedOrAllText();
  const question = document.getElementById('aiQuestion').value;
  if (!question.trim()) {
    alert("Please enter a question first!");
    return;
  }
  const result = await window.api.aiAction("ask", `${text}\n\nQuestion: ${question}`);
  editor.trigger('keyboard', 'type', { text: `\n\n[AI Answer]\n${result}` });
});
```

---

## 🚀 Running the App

### Development Mode

```powershell
npm run dev
$env:NODE_ENV="development"
npm start
```

### Production Mode

```powershell
npm run build
npm start
```

---

## ✅ Expected Behavior

* Open `.md` files → edit → save
* Highlight text → click **AI Improve / Summarize** → results appended
* Type a question → click **AI Ask** → answer inserted
* All AI requests go through **OpenRouter** using your `.env` key

---

## ⚠️ Known Warnings (Safe in Dev)

* **Electron CSP Warning** → ignorable, fix later in packaging
* **Monaco Worker Warning** → ignorable, fix later when optimizing large files

---

## ✅ Step 3 Status

* [x] File open/save working
* [x] AI integrated (Improve, Summarize, Ask)
* [x] Toolbar supports input for questions
* [x] OpenRouter API hooked up

---

## 🔜 Step 4 Preview

Next we can **polish AI UX**:

* Dropdown for model selection (GPT, Claude, Mistral, DeepSeek, etc.)
* Mode selection (Improve, Summarize, Expand, Rewrite)
* Option to **replace selected text** instead of always appending

---