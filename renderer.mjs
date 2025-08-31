import * as monaco from 'monaco-editor';
import * as path from 'path';

// --- Editor setup ---
const editorContainer = document.getElementById('editor');
let currentFilePath = null;
let currentFolderPath = null;
let currentFileFormat = 'md';
let lastLoadedContent = '';
let files = [];
let contextReady = false;

const editor = monaco.editor.create(editorContainer, {
  value: '# Hello VisualDocEditor\n\nNow with multi-format support and persistent model selection!\n\nSupported formats:\n- Markdown (.md)\n- Text files (.txt)\n- Word documents (.docx)\n- PDF files (.pdf)',
  language: 'markdown',
  theme: 'vs-dark',
  automaticLayout: true,
  minimap: { enabled: false },
  fontSize: 16
});

// --- Settings and Model Management ---
let currentSettings = {};

async function loadAndApplySettings() {
  currentSettings = await window.api.loadSettings();
  
  // Apply settings to UI
  if (currentSettings.apiKey) {
    document.getElementById('apiKey').value = currentSettings.apiKey;
  }
  if (currentSettings.provider) {
    document.getElementById('provider').value = currentSettings.provider;
  }
  if (currentSettings.aiMode) {
    document.getElementById('aiMode').value = currentSettings.aiMode;
  }
  
  // Populate model dropdown
  updateModelDropdown();
  
  // Set last used model
  if (currentSettings.lastModel) {
    document.getElementById('modelInput').value = currentSettings.lastModel;
  }
}

function updateModelDropdown() {
  const dropdown = document.getElementById('modelDropdown');
  dropdown.innerHTML = '<option value="">Select or type model...</option>';
  
  currentSettings.models.forEach(model => {
    const option = document.createElement('option');
    option.value = model;
    option.textContent = model;
    dropdown.appendChild(option);
  });
}

async function saveCurrentSettings() {
  const newSettings = {
    apiKey: document.getElementById('apiKey').value,
    provider: document.getElementById('provider').value,
    lastModel: document.getElementById('modelInput').value,
    aiMode: document.getElementById('aiMode').value
  };
  
  currentSettings = await window.api.saveSettings(newSettings);
}

// --- Model dropdown functionality ---
document.getElementById('modelDropdown').addEventListener('change', (e) => {
  if (e.target.value) {
    document.getElementById('modelInput').value = e.target.value;
    saveCurrentSettings();
  }
});

document.getElementById('modelInput').addEventListener('change', () => {
  saveCurrentSettings();
});

document.getElementById('addModelBtn').addEventListener('click', async () => {
  const modelName = document.getElementById('modelInput').value.trim();
  if (!modelName) {
    alert('Please enter a model name first!');
    return;
  }
  
  currentSettings = await window.api.addModel(modelName);
  updateModelDropdown();
  alert(`Model "${modelName}" added to list!`);
});

document.getElementById('clearModelsBtn').addEventListener('click', async () => {
  if (confirm('Clear all models and reset to defaults?')) {
    currentSettings = await window.api.clearModels();
    updateModelDropdown();
  }
});

// Save settings when AI settings change
['apiKey', 'provider', 'aiMode'].forEach(id => {
  document.getElementById(id).addEventListener('change', saveCurrentSettings);
});

// --- Initialize settings ---
loadAndApplySettings();

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
}

function getFormatDisplayName(format) {
  const formats = {
    md: 'Markdown',
    txt: 'Text',
    docx: 'Word',
    pdf: 'PDF',
    html: 'HTML',
    pptx: 'PowerPoint'
  };
  return formats[format] || format.toUpperCase();
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
    
    // Format badge
    const formatBadge = document.createElement('span');
    formatBadge.className = 'format-badge';
    formatBadge.textContent = f.format.toUpperCase();
    li.appendChild(formatBadge);
    
    // Word count for processed files
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
  currentFileFormat = resp.format || 'md';
  
  // Set appropriate language for Monaco
  const languageMap = {
    md: 'markdown',
    txt: 'plaintext',
    docx: 'plaintext',
    pdf: 'plaintext',
    html: 'html',
    pptx: 'plaintext'
  };
  
  monaco.editor.setModelLanguage(editor.getModel(), languageMap[currentFileFormat] || 'plaintext');
  
  editor.setValue(resp.content);
  lastLoadedContent = resp.content;
  
    // Update window title with format info
    document.title = `VisualDocEditor - ${path.basename(filePath)} (${getFormatDisplayName(currentFileFormat)})`;
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
  folderHeaderEl.textContent = `${currentFolderPath}  · ${files.length} files`;
  renderFiles(files);

  if (files.length > 0) {
    await loadFileIntoEditor(files[0].path);
    highlightActive(files[0].path);
    
    // Build context for the folder
    await buildFolderContext(currentFolderPath);
  } else {
    currentFilePath = null;
    currentFileFormat = 'md';
    editor.setValue('# (Empty folder)\nNo supported files found.\n\nSupported formats: .md, .txt, .docx, .pdf');
    lastLoadedContent = editor.getValue();
    updateContextIndicator('No files');
    document.title = 'VisualDocEditor';
  }
});

document.getElementById('openBtn').addEventListener('click', async () => {
  const ok = await confirmLoseChanges();
  if (!ok) return;

  const result = await window.api.openFile();
  if (!result.canceled) {
    currentFilePath = result.filePath;
    currentFileFormat = result.originalFormat || result.format || 'md';
    
    // Set Monaco language
    const languageMap = {
      md: 'markdown',
      txt: 'plaintext', 
      docx: 'plaintext',
      pdf: 'plaintext',
      html: 'html'
    };
    monaco.editor.setModelLanguage(editor.getModel(), languageMap[currentFileFormat] || 'plaintext');
    
    editor.setValue(result.content);
    lastLoadedContent = result.content;
    document.title = `VisualDocEditor - ${path.basename(currentFilePath)} (${getFormatDisplayName(currentFileFormat)})`;

    // Update sidebar if file is in current folder
    if (currentFolderPath && currentFilePath.startsWith(currentFolderPath)) {
      if (!files.find((f) => f.path === currentFilePath)) {
        const ext = path.extname(currentFilePath).toLowerCase();
        files.push({ 
          name: path.basename(currentFilePath), 
          path: currentFilePath, 
          size: result.content.length, 
          mtime: Date.now(),
          format: ext.slice(1) || 'md'
        });
        files.sort((a, b) => a.name.localeCompare(b.name));
      }
      renderFiles(files);
      highlightActive(currentFilePath);
    } else {
      folderHeaderEl.textContent = `No folder open (single file: ${getFormatDisplayName(currentFileFormat)})`;
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
    document.title = `VisualDocEditor - ${path.basename(currentFilePath)} (${getFormatDisplayName(currentFileFormat)})`;
    
    if (currentFolderPath && currentFilePath.startsWith(currentFolderPath)) {
      if (!files.find((f) => f.path === currentFilePath)) {
        const ext = path.extname(currentFilePath).toLowerCase();
        files.push({ 
          name: path.basename(currentFilePath), 
          path: currentFilePath, 
          size: content.length, 
          mtime: Date.now(),
          format: ext.slice(1) || 'md'
        });
        files.sort((a, b) => a.name.localeCompare(b.name));
        renderFiles(files);
      }
      highlightActive(currentFilePath);
    }
  }
});

document.getElementById('exportBtn').addEventListener('click', async () => {
  const content = editor.getValue();
  const format = document.getElementById('exportFormat').value;
  const result = await window.api.exportFile(currentFilePath, content, format);
  
  if (result.canceled) return;
  if (result.error) {
    alert(`Export failed: ${result.error}`);
  } else {
    alert(`Successfully exported to: ${result.filePath}`);
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

import { reactDiffEditor } from './src/renderer/react-diff-editor.js';

async function runAI(mode, extra = '') {
  const text = getSelectedOrAllText();
  const provider = document.getElementById('provider').value;
  const apiKey = document.getElementById('apiKey').value;
  const modelId = document.getElementById('modelInput').value;
  
  if (!apiKey.trim()) {
    alert('Please enter an API key first!');
    return;
  }
  if (!modelId.trim()) {
    alert('Please select or enter a model name!');
    return;
  }
  
  const result = await window.api.aiAction({ provider, apiKey, modelId, mode, text: text + extra });
  
  // For improve/summarize actions, show diff editor
  if (mode === 'improve' || mode === 'summarize') {
    reactDiffEditor.show(text, result, () => {
      applyAIResponse(result);
    });
  } else {
    applyAIResponse(result);
  }
  
  // Add model to recent list if not already there
  if (!currentSettings.models.includes(modelId)) {
    currentSettings = await window.api.addModel(modelId);
    updateModelDropdown();
  }
}

async function runMultiFileAI(mode, query = '') {
  if (!contextReady) {
    alert('Context not ready. Please wait for folder indexing to complete.');
    return;
  }

  const currentContent = editor.getValue();
  const provider = document.getElementById('provider').value;
  const apiKey = document.getElementById('apiKey').value;
  const modelId = document.getElementById('modelInput').value;
  
  if (!apiKey.trim()) {
    alert('Please enter an API key first!');
    return;
  }
  if (!modelId.trim()) {
    alert('Please select or enter a model name!');
    return;
  }
  
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
  
  // Add model to recent list if not already there
  if (!currentSettings.models.includes(modelId)) {
    currentSettings = await window.api.addModel(modelId);
    updateModelDropdown();
  }
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
