import * as monaco from 'monaco-editor';

const editorContainer = document.getElementById('editor');
let currentFilePath = null;

const editor = monaco.editor.create(editorContainer, {
  value: "# Hello VisualDocEditor\n\nNow with API persistence and Replace/Append toggle!",
  language: "markdown",
  theme: "vs-dark",
  automaticLayout: true,
  minimap: { enabled: false },
  fontSize: 16
});

// --- Restore API Key on startup ---
window.api.loadSettings().then(settings => {
  if (settings.apiKey) {
    document.getElementById("apiKey").value = settings.apiKey;
  }
});

// --- Save API Key on change ---
document.getElementById("apiKey").addEventListener("change", () => {
  const apiKey = document.getElementById("apiKey").value;
  window.api.saveSettings({ apiKey });
});

// --- File Ops (same as before) ---
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
