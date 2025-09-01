class ClinePanel {
  constructor() {
    this.currentSessionId = null;
    this.sessionInterval = null;
    this.startTime = null;
    this.isPanelVisible = true;
    
    this.initializeElements();
    this.bindEvents();
    this.loadInitialState();
  }

  initializeElements() {
    // Panel elements
    this.panel = document.getElementById('clinePanel');
    this.toggleBtn = document.getElementById('clineToggle');
    this.panelContent = this.panel.querySelector('.panel-content');
    
    // Session elements
    this.sessionStatus = document.getElementById('sessionStatus');
    this.sessionDuration = document.getElementById('sessionDuration');
    this.sessionOperations = document.getElementById('sessionOperations');
    
    // Token elements
    this.totalTokens = document.getElementById('totalTokens');
    this.promptTokens = document.getElementById('promptTokens');
    this.completionTokens = document.getElementById('completionTokens');
    this.estimatedCost = document.getElementById('estimatedCost');
    
    // Thinking process elements
    this.thinkingSteps = document.getElementById('thinkingSteps');
    
    // Performance elements
    this.avgResponseTime = document.getElementById('avgResponseTime');
    this.successRate = document.getElementById('successRate');
    this.totalOperations = document.getElementById('totalOperations');
    
    // Context elements
    this.contextBar = document.getElementById('contextBar');
    this.contextSize = document.getElementById('contextSize');
    
    // Control buttons
    this.startSessionBtn = document.getElementById('startSessionBtn');
    this.endSessionBtn = document.getElementById('endSessionBtn');
    this.clearSessionsBtn = document.getElementById('clearSessionsBtn');
  }

  bindEvents() {
    // Panel toggle
    this.toggleBtn.addEventListener('click', () => this.togglePanel());
    
    // Session controls
    this.startSessionBtn.addEventListener('click', () => this.startSession());
    this.endSessionBtn.addEventListener('click', () => this.endSession());
    this.clearSessionsBtn.addEventListener('click', () => this.clearSessions());
    
    // Listen for Cline service events (simulated for now)
    this.setupEventListeners();
  }

  async loadInitialState() {
    try {
      const tokenUsage = await window.api.clineGetTokenUsage();
      const performanceMetrics = await window.api.clineGetPerformanceMetrics();
      const currentSession = await window.api.clineGetCurrentSession();
      
      this.updateTokenUsage(tokenUsage);
      this.updatePerformanceMetrics(performanceMetrics);
      
      if (currentSession) {
        this.currentSessionId = currentSession.id;
        this.updateSessionStatus(currentSession);
        this.startSessionTimer();
      }
    } catch (error) {
      console.error('Failed to load initial Cline state:', error);
    }
  }

  async startSession() {
    try {
      const sessionId = await window.api.clineStartSession('document-editing');
      this.currentSessionId = sessionId;
      
      this.updateSessionStatus({ status: 'active', operations: [] });
      this.startSessionTimer();
      
      this.startSessionBtn.disabled = true;
      this.endSessionBtn.disabled = false;
      
      // Add initial thinking step
      await this.addThinkingStep({
        type: 'session_start',
        content: 'Document editing session started',
        tokens: 0
      });
      
    } catch (error) {
      console.error('Failed to start session:', error);
      alert('Failed to start session: ' + error.message);
    }
  }

  async endSession(status = 'completed') {
    try {
      await window.api.clineEndSession(this.currentSessionId, status);
      
      this.stopSessionTimer();
      this.updateSessionStatus({ status: 'completed' });
      
      this.startSessionBtn.disabled = false;
      this.endSessionBtn.disabled = true;
      this.currentSessionId = null;
      
      // Add final thinking step
      await this.addThinkingStep({
        type: 'session_end',
        content: `Session ${status}`,
        tokens: 0
      });
      
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  }

  async addThinkingStep(step) {
    if (!this.currentSessionId) return;
    
    try {
      const thinkingStep = await window.api.clineAddThinkingStep(this.currentSessionId, step);
      this.addThinkingStepToUI(thinkingStep);
    } catch (error) {
      console.error('Failed to add thinking step:', error);
    }
  }

  async addThinkingProcess(thinkingContent) {
    if (!this.currentSessionId) return;
    
    try {
      // Parse the thinking content (which should be in <thinking> tags)
      const thinkingText = thinkingContent.replace(/<\/?thinking>/g, '').trim();
      
      // Split into individual steps/lines
      const steps = thinkingText.split('\n').filter(line => line.trim().length > 0);
      
      // Add each step in the thinking process
      for (const step of steps) {
        const thinkingStep = await window.api.clineAddThinkingStep(this.currentSessionId, {
          type: 'thinking',
          content: step.trim(),
          tokens: 0
        });
        this.addThinkingStepToUI(thinkingStep);
        
        // Add a small delay between steps for better visualization
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (error) {
      console.error('Failed to add thinking process:', error);
    }
  }

  async trackTokenUsage(usage) {
    if (!this.currentSessionId) return;
    
    try {
      await window.api.clineTrackTokenUsage(this.currentSessionId, usage);
      
      // Update global token usage display
      const tokenUsage = await window.api.clineGetTokenUsage();
      this.updateTokenUsage(tokenUsage);
    } catch (error) {
      console.error('Failed to track token usage:', error);
    }
  }

  async trackOperation(operation) {
    if (!this.currentSessionId) return;
    
    try {
      const op = await window.api.clineTrackOperation(this.currentSessionId, operation);
      this.updateSessionOperations();
      return op;
    } catch (error) {
      console.error('Failed to track operation:', error);
    }
  }

  async completeOperation(operationId, result) {
    if (!this.currentSessionId) return;
    
    try {
      await window.api.clineCompleteOperation(this.currentSessionId, operationId, result);
      this.updateSessionOperations();
    } catch (error) {
      console.error('Failed to complete operation:', error);
    }
  }

  async updateContextSize(size) {
    if (!this.currentSessionId) return;
    
    try {
      await window.api.clineUpdateContextSize(this.currentSessionId, size);
      this.updateContextDisplay(size);
    } catch (error) {
      console.error('Failed to update context size:', error);
    }
  }

  async trackPerformance(metrics) {
    try {
      await window.api.clineTrackPerformance(metrics);
      
      // Update performance display
      const performanceMetrics = await window.api.clineGetPerformanceMetrics();
      this.updatePerformanceMetrics(performanceMetrics);
    } catch (error) {
      console.error('Failed to track performance:', error);
    }
  }

  async clearSessions() {
    if (confirm('Clear all sessions and reset statistics?')) {
      try {
        await window.api.clineClearSessions();
        await window.api.clineResetTokenUsage();
        
        this.currentSessionId = null;
        this.stopSessionTimer();
        
        this.updateSessionStatus({ status: 'inactive', operations: [] });
        this.updateTokenUsage({ total: 0, prompt: 0, completion: 0, estimatedCost: 0 });
        this.clearThinkingSteps();
        this.updatePerformanceMetrics({ averageResponseTime: 0, successRate: 100, totalOperations: 0 });
        this.updateContextDisplay(0);
        
        this.startSessionBtn.disabled = false;
        this.endSessionBtn.disabled = true;
        
      } catch (error) {
        console.error('Failed to clear sessions:', error);
      }
    }
  }

  startSessionTimer() {
    this.startTime = Date.now();
    this.stopSessionTimer();
    
    this.sessionInterval = setInterval(() => {
      if (this.startTime) {
        const elapsed = Date.now() - this.startTime;
        this.sessionDuration.textContent = this.formatDuration(elapsed);
      }
    }, 1000);
  }

  stopSessionTimer() {
    if (this.sessionInterval) {
      clearInterval(this.sessionInterval);
      this.sessionInterval = null;
    }
  }

  updateSessionStatus(session) {
    this.sessionStatus.textContent = session.status || 'inactive';
    this.sessionStatus.className = `status-indicator ${session.status === 'active' ? 'active' : 'inactive'}`;
    
    const operationCount = session.operations ? session.operations.length : 0;
    this.sessionOperations.textContent = `${operationCount} ops`;
  }

  updateTokenUsage(usage) {
    this.totalTokens.textContent = usage.total.toLocaleString();
    this.promptTokens.textContent = usage.prompt.toLocaleString();
    this.completionTokens.textContent = usage.completion.toLocaleString();
    this.estimatedCost.textContent = `$${usage.estimatedCost.toFixed(2)}`;
  }

  addThinkingStepToUI(step) {
    // Clear empty state if it exists
    const emptyState = this.thinkingSteps.querySelector('.empty-state');
    if (emptyState) {
      emptyState.remove();
    }
    
    const stepElement = document.createElement('div');
    stepElement.className = 'thinking-step';
    stepElement.innerHTML = `
      <div class="step-type">${step.type}</div>
      <div class="step-content">${step.content}</div>
      ${step.tokens > 0 ? `<div class="step-tokens">${step.tokens} tokens</div>` : ''}
    `;
    
    this.thinkingSteps.appendChild(stepElement);
    this.thinkingSteps.scrollTop = this.thinkingSteps.scrollHeight;
  }

  clearThinkingSteps() {
    this.thinkingSteps.innerHTML = '<div class="empty-state">No thinking steps recorded</div>';
  }

  updateSessionOperations() {
    // This would be updated when we get session data
    // For now, we'll keep the simple count from session status
  }

  updatePerformanceMetrics(metrics) {
    this.avgResponseTime.textContent = `${Math.round(metrics.averageResponseTime)}ms`;
    this.successRate.textContent = `${Math.round(metrics.successRate * 100)}%`;
    this.totalOperations.textContent = metrics.totalOperations.toLocaleString();
  }

  updateContextDisplay(size) {
    const maxContext = 32000; // Typical context window size
    const percentage = Math.min((size / maxContext) * 100, 100);
    
    this.contextBar.style.width = `${percentage}%`;
    this.contextSize.textContent = `${size.toLocaleString()} tokens`;
    
    // Change color based on usage
    if (percentage > 80) {
      this.contextBar.style.background = 'var(--error)';
    } else if (percentage > 60) {
      this.contextBar.style.background = 'var(--warning)';
    } else {
      this.contextBar.style.background = 'var(--accent)';
    }
  }

  togglePanel() {
    this.isPanelVisible = !this.isPanelVisible;
    
    if (this.isPanelVisible) {
      this.panel.style.height = '400px';
      this.panelContent.style.display = 'block';
      this.toggleBtn.textContent = '−';
    } else {
      this.panel.style.height = '40px';
      this.panelContent.style.display = 'none';
      this.toggleBtn.textContent = '+';
    }
  }

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    } else {
      return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
    }
  }

  setupEventListeners() {
    // Simulated event listeners - in a real implementation, these would
    // listen to the ClineService events via IPC or other means
    
    // For now, we'll manually trigger updates when operations occur
  }

  // Public API methods for other components to use
  async onAIRequestStart(operationData) {
    if (!this.currentSessionId) {
      await this.startSession();
    }
    
    const operation = await this.trackOperation({
      type: 'ai_request',
      name: operationData.mode || 'unknown',
      description: `AI ${operationData.mode} operation`
    });
    
    await this.addThinkingStep({
      type: 'ai_request_start',
      content: `Starting AI ${operationData.mode} operation`,
      tokens: 0
    });
    
    return operation;
  }

  async onAIRequestComplete(operationId, result, tokenUsage) {
    await this.completeOperation(operationId, result);
    
    if (tokenUsage) {
      await this.trackTokenUsage(tokenUsage);
    }
    
    await this.addThinkingStep({
      type: 'ai_request_complete',
      content: `AI operation completed: ${result.substring(0, 100)}...`,
      tokens: tokenUsage ? tokenUsage.total : 0
    });
    
    await this.trackPerformance({
      responseTime: result.responseTime || 0,
      success: true
    });
  }

  async onAIRequestError(operationId, error) {
    await this.completeOperation(operationId, { error: error.message });
    
    await this.addThinkingStep({
      type: 'ai_request_error',
      content: `AI operation failed: ${error.message}`,
      tokens: 0
    });
    
    await this.trackPerformance({
      responseTime: 0,
      success: false
    });
  }
}

// Export for use in other modules
export default ClinePanel;
