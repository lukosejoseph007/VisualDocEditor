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