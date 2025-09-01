const EventEmitter = require('events');

class ClineService extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map();
    this.currentSessionId = null;
    this.tokenUsage = {
      total: 0,
      prompt: 0,
      completion: 0,
      estimatedCost: 0
    };
    this.performanceMetrics = {
      responseTimes: [],
      errorRate: 0,
      successRate: 0
    };
  }

  startNewSession(sessionType = 'document-editing') {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.currentSessionId = sessionId;
    
    const session = {
      id: sessionId,
      type: sessionType,
      startTime: Date.now(),
      endTime: null,
      operations: [],
      contextSize: 0,
      tokenUsage: {
        total: 0,
        prompt: 0,
        completion: 0,
        estimatedCost: 0
      },
      thinkingProcess: [],
      status: 'active'
    };
    
    this.sessions.set(sessionId, session);
    this.emit('sessionStarted', session);
    
    return sessionId;
  }

  endSession(sessionId, status = 'completed') {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.endTime = Date.now();
      session.status = status;
      session.duration = session.endTime - session.startTime;
      
      this.emit('sessionEnded', session);
    }
  }

  addThinkingStep(sessionId, step) {
    const session = this.sessions.get(sessionId);
    if (session) {
      const thinkingStep = {
        id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        timestamp: Date.now(),
        ...step,
        tokens: step.tokens || 0
      };
      
      session.thinkingProcess.push(thinkingStep);
      this.emit('thinkingStepAdded', { sessionId, step: thinkingStep });
      
      return thinkingStep;
    }
  }

  trackTokenUsage(sessionId, usage) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.tokenUsage.total += usage.total || 0;
      session.tokenUsage.prompt += usage.prompt || 0;
      session.tokenUsage.completion += usage.completion || 0;
      
      // Estimate cost (very rough approximation)
      const costPerToken = 0.00002; // $0.02 per 1000 tokens
      session.tokenUsage.estimatedCost += (usage.total || 0) * costPerToken / 1000;
      
      // Update global usage
      this.tokenUsage.total += usage.total || 0;
      this.tokenUsage.prompt += usage.prompt || 0;
      this.tokenUsage.completion += usage.completion || 0;
      this.tokenUsage.estimatedCost += (usage.total || 0) * costPerToken / 1000;
      
      this.emit('tokenUsageUpdated', { sessionId, usage: session.tokenUsage });
    }
  }

  trackOperation(sessionId, operation) {
    const session = this.sessions.get(sessionId);
    if (session) {
      const op = {
        id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        timestamp: Date.now(),
        ...operation,
        status: 'started'
      };
      
      session.operations.push(op);
      this.emit('operationStarted', { sessionId, operation: op });
      
      return op;
    }
  }

  completeOperation(sessionId, operationId, result) {
    const session = this.sessions.get(sessionId);
    if (session) {
      const op = session.operations.find(o => o.id === operationId);
      if (op) {
        op.endTime = Date.now();
        op.duration = op.endTime - op.timestamp;
        op.status = 'completed';
        op.result = result;
        
        this.emit('operationCompleted', { sessionId, operation: op });
      }
    }
  }

  updateContextSize(sessionId, size) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.contextSize = size;
      this.emit('contextSizeUpdated', { sessionId, size });
    }
  }

  trackPerformance(metrics) {
    if (metrics.responseTime) {
      this.performanceMetrics.responseTimes.push(metrics.responseTime);
      // Keep only last 100 measurements
      if (this.performanceMetrics.responseTimes.length > 100) {
        this.performanceMetrics.responseTimes.shift();
      }
    }
    
    if (metrics.success !== undefined) {
      // Update success/error rates
      const totalOps = this.performanceMetrics.responseTimes.length;
      if (metrics.success) {
        this.performanceMetrics.successRate = 
          ((this.performanceMetrics.successRate * (totalOps - 1) + 1) / totalOps) || 1;
      } else {
        this.performanceMetrics.errorRate = 
          ((this.performanceMetrics.errorRate * (totalOps - 1) + 1) / totalOps) || 0;
      }
    }
    
    this.emit('performanceUpdated', this.performanceMetrics);
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  getAllSessions() {
    return Array.from(this.sessions.values());
  }

  getCurrentSession() {
    return this.sessions.get(this.currentSessionId);
  }

  getTokenUsage() {
    return this.tokenUsage;
  }

  getPerformanceMetrics() {
    const avgResponseTime = this.performanceMetrics.responseTimes.length > 0
      ? this.performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) / this.performanceMetrics.responseTimes.length
      : 0;
    
    return {
      ...this.performanceMetrics,
      averageResponseTime: avgResponseTime,
      totalOperations: this.performanceMetrics.responseTimes.length
    };
  }

  clearSessions() {
    this.sessions.clear();
    this.currentSessionId = null;
    this.emit('sessionsCleared');
  }

  resetTokenUsage() {
    this.tokenUsage = {
      total: 0,
      prompt: 0,
      completion: 0,
      estimatedCost: 0
    };
    this.emit('tokenUsageReset');
  }
}

module.exports = ClineService;
