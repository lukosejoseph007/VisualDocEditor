function injectStyles() {
  if (document.getElementById('diff-editor-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'diff-editor-styles';
  style.textContent = `
    #diff-editor-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(15, 23, 42, 0.95);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }
    
    #diff-editor-container .editor-content {
      background-color: var(--panel);
      color: var(--text);
      border-radius: 12px;
      width: 95%;
      height: 95%;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      border: 1px solid var(--border);
    }
    
    #diff-editor-container .header {
      padding: 20px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background-color: var(--accent-dark);
    }
    
    #diff-editor-container .header h2 {
      color: white;
      margin: 0;
      font-size: 1.5rem;
      font-weight: 600;
    }
    
    #diff-editor-container .header p {
      color: rgba(255, 255, 255, 0.8);
      margin: 0;
      font-size: 14px;
    }
    
    #diff-editor-container .diff-container {
      display: flex;
      flex: 1;
      background-color: var(--panel);
    }
    
    #diff-editor-container .diff-side {
      flex: 1;
      padding: 20px;
      overflow: auto;
      font-family: 'Fira Code', 'Consolas', monospace;
      font-size: 14px;
      line-height: 1.6;
      white-space: pre;
      color: var(--text);
      background-color: var(--panel);
    }
    
    #diff-editor-container .original-side {
      border-right: 1px solid var(--border);
      background-color: var(--panel);
    }
    
    .line-removed {
      background-color: rgba(239, 68, 68, 0.15) !important;
      text-decoration: line-through;
      color: #fca5a5 !important;
      padding: 2px 8px;
      margin: 2px 0;
      border-radius: 3px;
      border-left: 3px solid var(--error);
    }
    
    .line-added {
      background-color: rgba(34, 197, 94, 0.15) !important;
      color: #86efac !important;
      padding: 2px 8px;
      margin: 2px 0;
      border-radius: 3px;
      border-left: 3px solid var(--success);
    }
    
    #diff-editor-container .footer {
      padding: 20px;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      background-color: var(--panel);
    }
    
    #diff-editor-container button {
      padding: 12px 24px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s;
      font-size: 1rem;
      border: none;
    }
    
    #diff-editor-container .reject-btn {
      background-color: var(--panel);
      border: 1px solid var(--border);
      color: var(--text);
    }
    
    #diff-editor-container .reject-btn:hover {
      background-color: var(--hover);
    }
    
    #diff-editor-container .accept-btn {
      background-color: var(--accent);
      color: white;
    }
    
    #diff-editor-container .accept-btn:hover {
      background-color: var(--accent-light);
    }
  `;
  document.head.appendChild(style);
}

class DiffEditor {
  constructor() {
    this.container = null;
    this.originalContent = '';
    this.modifiedContent = '';
    this.onAccept = () => {};
  }

  show(original, modified, onAccept) {
    injectStyles();
    this.originalContent = original;
    this.modifiedContent = modified;
    this.onAccept = onAccept;

    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'diff-editor-container';
      document.body.appendChild(this.container);
    } else {
      this.container.style.display = 'flex';
    }

    this.container.innerHTML = '';

    const editorContent = document.createElement('div');
    editorContent.className = 'editor-content';
    this.container.appendChild(editorContent);

    const header = document.createElement('div');
    header.className = 'header';
    header.innerHTML = '<h2>Review Changes</h2><p>Original ↔ Modified</p>';
    editorContent.appendChild(header);

    const diffContainer = document.createElement('div');
    diffContainer.className = 'diff-container';
    editorContent.appendChild(diffContainer);

    const originalContainer = document.createElement('div');
    originalContainer.className = 'diff-side original-side';
    originalContainer.innerHTML = this.highlightRemovedLines(original, modified);
    diffContainer.appendChild(originalContainer);

    const modifiedContainer = document.createElement('div');
    modifiedContainer.className = 'diff-side';
    modifiedContainer.innerHTML = this.highlightAddedLines(original, modified);
    diffContainer.appendChild(modifiedContainer);

    const footer = document.createElement('div');
    footer.className = 'footer';
    editorContent.appendChild(footer);

    const rejectBtn = document.createElement('button');
    rejectBtn.className = 'reject-btn';
    rejectBtn.textContent = 'Reject';
    rejectBtn.addEventListener('click', () => this.hide());
    footer.appendChild(rejectBtn);

    const acceptBtn = document.createElement('button');
    acceptBtn.className = 'accept-btn';
    acceptBtn.textContent = 'Accept Changes';
    acceptBtn.addEventListener('click', () => {
      this.onAccept();
      this.hide();
    });
    footer.appendChild(acceptBtn);
  }

  highlightRemovedLines(original, modified) {
    const origLines = original.split('\n');
    const modLines = modified.split('\n');
    let html = '';
    
    for (let i = 0; i < origLines.length; i++) {
      const origLine = origLines[i] || '';
      const modLine = modLines[i] || '';
      
      if (origLine !== modLine) {
        html += `<div class="line-removed">${this.escapeHtml(origLine)}</div>`;
      } else {
        html += `<div>${this.escapeHtml(origLine)}</div>`;
      }
    }
    
    return html;
  }

  highlightAddedLines(original, modified) {
    const origLines = original.split('\n');
    const modLines = modified.split('\n');
    let html = '';
    
    for (let i = 0; i < modLines.length; i++) {
      const origLine = origLines[i] || '';
      const modLine = modLines[i] || '';
      
      if (origLine !== modLine) {
        html += `<div class="line-added">${this.escapeHtml(modLine)}</div>`;
      } else {
        html += `<div>${this.escapeHtml(modLine)}</div>`;
      }
    }
    
    return html;
  }

  escapeHtml(text) {
    const replacements = {
      '&': '&',
      '<': '<',
      '>': '>',
      '"': '"',
      "'": '&#39;',
      '`': '&#96;',
      '=': '&#61;'
    };
    return text.replace(/[&<>"'`=]/g, char => replacements[char]);
  }

  hide() {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }
}

export const diffEditor = new DiffEditor();
