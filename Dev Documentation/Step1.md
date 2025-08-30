---

# 📘 VisualDocEditor — Step 1 Documentation (Electron + Vite + Monaco)

---

## 📂 Project Overview

**Goal of Step 1:**

* Create an Electron app that opens a window
* Bundle the renderer with **Vite**
* Display a **Monaco editor** inside the Electron window
* Preload with sample Markdown text

This forms the foundation for later features: file handling, AI integration, etc.

---

## 📂 Folder Structure After Step 1

```
VisualDocEditor/
│
├── package.json           # Project metadata + scripts
├── vite.config.js         # Vite bundler config
├── main.js                # Electron backend entry
├── preload.js             # API bridge to renderer
├── index.html             # App HTML shell
├── renderer.mjs           # Renderer code (bundled by Vite)
└── node_modules/          # Installed packages
```

---

## ⚙️ Dependencies

### Installed Dependencies

```powershell
npm install electron monaco-editor dotenv
npm install --save-dev vite
```

* **electron** → Desktop runtime
* **monaco-editor** → Editor engine
* **dotenv** → For managing API keys (future AI integration)
* **vite** → Bundles renderer (so `import "monaco-editor"` works)

---

## 📄 Code Files

### 1. `package.json`

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
    "monaco-editor": "^0.52.2"
  },
  "devDependencies": {
    "electron": "^31.0.0",
    "vite": "^5.0.0"
  }
}
```

---

### 2. `vite.config.js`

```javascript
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',          // project root
  base: './',         // relative paths
  build: {
    outDir: 'dist',   // output folder
    emptyOutDir: true
  }
});
```

---

### 3. `main.js` (Electron backend)

```javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load dev server in dev mode, dist in prod
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, 'dist/index.html'));
  }
}

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

### 4. `preload.js`

```javascript
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Future AI functions go here
});
```

---

### 5. `index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>VisualDocEditor MVP</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      height: 100vh;
      width: 100vw;
    }
    #editor {
      height: 100%;
      width: 100%;
    }
  </style>
</head>
<body>
  <div id="editor"></div>
  <script type="module" src="./renderer.mjs"></script>
</body>
</html>
```

---

### 6. `renderer.mjs` (Renderer with Monaco)

```javascript
import * as monaco from 'monaco-editor';

console.log("Monaco loaded, creating editor...");

const editorContainer = document.getElementById('editor');

// Create the editor
const editor = monaco.editor.create(editorContainer, {
  value: "# Hello VisualDocEditor\n\nThis is your first editor window!",
  language: "markdown",
  theme: "vs-dark",
  automaticLayout: true,
  minimap: { enabled: false },
  fontSize: 16
});

console.log("Editor created successfully!");
```

---

## 🚀 Running the App

### Development Mode (recommended)

Run Vite and Electron in separate terminals:

1. Start Vite dev server:

   ```powershell
   npm run dev
   ```

   (Runs on [http://localhost:5173](http://localhost:5173))

2. Start Electron pointing to dev server:

   ```powershell
   $env:NODE_ENV="development"
   npm start
   ```

---

### Production Mode

1. Build renderer:

   ```powershell
   npm run build
   ```

   (Generates `dist/`)

2. Start Electron:

   ```powershell
   npm start
   ```

---

## ✅ Expected Result

When you run the app:

* An **Electron window** opens
* A **Monaco editor** fills the window
* Starter text appears:

  ```
  # Hello VisualDocEditor

  This is your first editor window!
  ```

---

## ⚠️ Common Warnings in Step 1 (Safe to Ignore)

1. **Electron Security Warning (CSP)**

   ```
   Electron Security Warning (Insecure Content-Security-Policy)
   ```

   * Normal in dev (no CSP set).
   * Will be fixed in packaging step.

2. **Monaco Worker Warning**

   ```
   Could not create web worker(s). Falling back to main thread...
   You must define MonacoEnvironment.getWorkerUrl...
   ```

   * Normal because Monaco workers aren’t configured yet.
   * Editor still works fine.
   * Will fix in later steps (when handling larger files).

---

## ✅ Step 1 Status

* [x] Project scaffolding complete
* [x] Vite bundling works
* [x] Electron opens window
* [x] Monaco editor visible with starter text
* [x] Warnings explained (safe to ignore for now)

---

## 🔜 Step 2 Preview

Next, we’ll add **file open/save support**:

* Open a local `.md` file into the editor
* Edit it with Monaco
* Save changes back to disk

---
