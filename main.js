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

// ---- IPC: File Open/Save ----
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

// ---- IPC: AI Action ----
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

// ---- IPC: Settings ----
ipcMain.handle("settings:load", () => loadSettings());
ipcMain.handle("settings:save", (event, settings) => {
  saveSettings(settings);
  return true;
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
