---

# 📘 VisualDocEditor — Step 4 Documentation (AI UX Polish)

---

## 🎯 Step 4 Goals

In this step we polished the **AI user experience (UX)**:

* ✅ **API Provider Switcher** (OpenRouter, OpenAI … future extensibility)
* ✅ **Enter API Key directly from toolbar** (instead of `.env`)
* ✅ **Persist API Key** (stored locally in `settings.json`, auto-loads on startup)
* ✅ **Free model ID input** (e.g., `deepseek/deepseek-r1-0528:free`)
* ✅ **Replace vs Append toggle**

  * **Replace:** Overwrites selected text (or whole doc if none selected)
  * **Append:** Adds AI result below, with `[AI Result]` label
* ✅ **Cleaner Toolbar Layout** (File | AI | Settings sections)

---

## 📂 Project Structure (Step 4)

```
VisualDocEditor/
├── dist/                 # built frontend (from Vite/Webpack)
├── main.js               # Electron main process
├── preload.js            # API bridge
├── renderer.mjs          # Renderer logic
├── index.html            # App UI
├── package.json
└── settings.json         # Auto-created, stores API key
```

---

## 🖼️ Toolbar UI

* **Left section:** File operations (Open, Save)
* **Middle section:** AI actions (Improve, Summarize, Ask question)
* **Right section:** Provider, API Key, Model ID, Replace/Append mode

---

## 📄 Code Listings

### `index.html`

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
      font-family: sans-serif;
    }
    #toolbar {
      background: #222;
      color: #fff;
      padding: 8px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
    }
    #toolbar section {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-right: 20px;
    }
    #editor {
      flex: 1;
      width: 100%;
    }
    button, select, input {
      padding: 4px 8px;
      font-size: 14px;
    }
    input[type="text"], input[type="password"] {
      min-width: 180px;
    }
  </style>
</head>
<body>
  <div id="toolbar">
    <!-- File -->
    <section>
      <button id="openBtn">Open</button>
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

  <div id="editor"></div>
  <script type="module" src="./renderer.mjs"></script>
</body>
</html>
```

---

### `renderer.mjs`

```js
import * as monaco from 'monaco-editor';

const editorContainer = document.getElementById('editor');
let currentFilePath = null;

const editor = monaco.editor.create(editorContainer, {
  value: "# Hello VisualDocEditor\n\nNow with Replace/Append toggle and API persistence!",
  language: "markdown",
  theme: "vs-dark",
  automaticLayout: true,
  minimap: { enabled: false },
  fontSize: 16
});

// --- Load persisted API key ---
window.api.loadSettings().then(settings => {
  if (settings.apiKey) {
    document.getElementById("apiKey").value = settings.apiKey;
  }
});

// --- Save API key when changed ---
document.getElementById("apiKey").addEventListener("change", () => {
  const apiKey = document.getElementById("apiKey").value;
  window.api.saveSettings({ apiKey });
});

// --- File Ops ---
document.getElementById('openBtn').addEventListener('click', async () => {
  const result = await window.api.openFile();
  if (!result.canceled) {
    currentFilePath = result.filePath;
    editor.setValue(result.content);
  }
});

document.getElementById('saveBtn').addEventListener('click', async () => {
  const content = editor.getValue();
  const result = await window.api.saveFile(currentFilePath, content);
  if (!result.canceled) currentFilePath = result.filePath;
});

// --- AI Helpers ---
function getSelectedOrAllText() {
  const selection = editor.getModel().getValueInRange(editor.getSelection());
  return selection || editor.getValue();
}

function applyAIResponse(response) {
  const mode = document.getElementById('aiMode').value;
  if (mode === "replace") {
    const selection = editor.getSelection();
    if (selection && !selection.isEmpty()) {
      editor.executeEdits("", [
        { range: selection, text: response, forceMoveMarkers: true }
      ]);
    } else {
      editor.setValue(response);
    }
  } else {
    editor.trigger('keyboard', 'type', { text: `\n\n[AI Result]\n${response}` });
  }
}

// --- AI Buttons ---
async function runAI(mode, extra = "") {
  const text = getSelectedOrAllText();
  const provider = document.getElementById("provider").value;
  const apiKey = document.getElementById("apiKey").value;
  const modelId = document.getElementById("modelId").value;

  const result = await window.api.aiAction({
    provider, apiKey, modelId, mode, text: text + extra
  });
  applyAIResponse(result);
}

document.getElementById('aiImprove').addEventListener('click', () => runAI("improve"));
document.getElementById('aiSummarize').addEventListener('click', () => runAI("summarize"));
document.getElementById('aiAsk').addEventListener('click', () => {
  const q = document.getElementById('aiQuestion').value;
  if (!q.trim()) return alert("Please enter a question!");
  runAI("ask", `\n\nQuestion: ${q}`);
});
```

---

### `main.js`

```js
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');

const settingsFile = path.join(app.getPath("userData"), "settings.json");

// ---- Helpers for settings persistence ----
function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
  } catch {
    return { apiKey: "" }; // default
  }
}
function saveSettings(settings) {
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
}

// ---- Electron Window ----
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

// ---- File Open/Save ----
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

// ---- AI Actions ----
ipcMain.handle('ai:action', async (event, { provider, apiKey, modelId, mode, text }) => {
  let systemPrompt = "";
  if (mode === "improve") systemPrompt = "Improve this text while keeping the meaning.";
  else if (mode === "summarize") systemPrompt = "Summarize this text concisely.";
  else if (mode === "ask") systemPrompt = "Answer the question based on the provided text.";

  let baseURL = "https://api.openai.com/v1"; // default
  if (provider === "openrouter") baseURL = "https://openrouter.ai/api/v1";

  const client = new OpenAI({ apiKey, baseURL });

  try {
    const completion = await client.chat.completions.create({
      model: modelId,
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

// ---- Settings Persistence ----
ipcMain.handle("settings:load", () => loadSettings());
ipcMain.handle("settings:save", (event, settings) => {
  saveSettings(settings);
  return true;
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

---

### `preload.js`

```js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (filePath, content) => ipcRenderer.invoke('dialog:saveFile', { filePath, content }),
  aiAction: (data) => ipcRenderer.invoke('ai:action', data),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings)
});
```

---

## ✅ Expected Behavior

1. When you start the app:

   * Editor loads with sample markdown.
   * API Key auto-fills from previous session.

2. Toolbar lets you:

   * Switch provider (OpenRouter / OpenAI).
   * Enter/edit API Key (saved automatically).
   * Enter model ID (`deepseek/deepseek-r1-0528:free`).
   * Switch between Append vs Replace mode.

3. AI Actions:

   * **Improve:** Cleans up writing.
   * **Summarize:** Shortens text.
   * **Ask:** Answers a question based on text.

4. AI output:

   * **Append:** Adds below with `[AI Result]`.
   * **Replace:** Overwrites selection (or full doc if no selection).

---

## 📝 Notes

* API Key is stored **unencrypted** in `settings.json` (safe for dev).
* For production, add **encryption** (Step 5+).
* Replace/Append makes editor workflow flexible (inline vs brainstorming).

---