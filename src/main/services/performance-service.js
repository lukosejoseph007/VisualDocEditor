class PerformanceService {
  constructor() {
    this.metrics = {
      fileOperations: [],
      aiOperations: [],
      uiOperations: [],
      memoryUsage: []
    };
    this.startTime = Date.now();
    this.lastMemoryCheck = 0;
  }

  // File operation tracking
  trackFileOperation(operation, filePath, size, duration) {
    const metric = {
      type: 'file',
      operation,
      filePath,
      size,
      duration,
      timestamp: Date.now()
    };
    
    this.metrics.fileOperations.push(metric);
    this.cleanupOldMetrics();
    
    return metric;
  }

  // AI operation tracking
  trackAIOperation(operation, model, tokenCount, duration) {
    const metric = {
      type: 'ai',
      operation,
      model,
      tokenCount,
      duration,
      timestamp: Date.now()
    };
    
    this.metrics.aiOperations.push(metric);
    this.cleanupOldMetrics();
    
    return metric;
  }

  // UI operation tracking
  trackUIOperation(operation, elementCount, duration) {
    const metric = {
      type: 'ui',
      operation,
      elementCount,
      duration,
      timestamp: Date.now()
    };
    
    this.metrics.uiOperations.push(metric);
    this.cleanupOldMetrics();
    
    return metric;
  }

  // Memory usage monitoring
  trackMemoryUsage() {
    const now = Date.now();
    // Only check memory every 30 seconds to avoid performance impact
    if (now - this.lastMemoryCheck < 30000) {
      return;
    }

    this.lastMemoryCheck = now;
    
    try {
      const memoryUsage = process.memoryUsage();
      const metric = {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        timestamp: now
      };
      
      this.metrics.memoryUsage.push(metric);
      this.cleanupOldMetrics();
      
      return metric;
    } catch (err) {
      console.warn('Memory tracking failed:', err);
      return null;
    }
  }

  // Cleanup old metrics to prevent memory bloat
  cleanupOldMetrics() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    Object.keys(this.metrics).forEach(key => {
      this.metrics[key] = this.metrics[key].filter(
        metric => metric.timestamp > oneHourAgo
      );
    });
  }

  // Performance analysis methods
  getPerformanceSummary() {
    const now = Date.now();
    const oneMinuteAgo = now - (60 * 1000);
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    
    return {
      uptime: Math.round((now - this.startTime) / 1000),
      fileOperations: this.analyzeFileOperations(),
      aiOperations: this.analyzeAIOperations(),
      uiOperations: this.analyzeUIOperations(),
      memoryUsage: this.analyzeMemoryUsage(),
      recentMetrics: {
        lastMinute: this.getRecentMetrics(oneMinuteAgo),
        last5Minutes: this.getRecentMetrics(fiveMinutesAgo)
      }
    };
  }

  analyzeFileOperations() {
    const ops = this.metrics.fileOperations;
    if (ops.length === 0) return { count: 0, averageDuration: 0 };
    
    const durations = ops.map(op => op.duration);
    const totalSize = ops.reduce((sum, op) => sum + (op.size || 0), 0);
    
    return {
      count: ops.length,
      averageDuration: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      maxDuration: Math.max(...durations),
      minDuration: Math.min(...durations),
      totalSize,
      averageSize: Math.round(totalSize / ops.length)
    };
  }

  analyzeAIOperations() {
    const ops = this.metrics.aiOperations;
    if (ops.length === 0) return { count: 0, averageDuration: 0 };
    
    const durations = ops.map(op => op.duration);
    const totalTokens = ops.reduce((sum, op) => sum + (op.tokenCount || 0), 0);
    
    return {
      count: ops.length,
      averageDuration: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      maxDuration: Math.max(...durations),
      minDuration: Math.min(...durations),
      totalTokens,
      averageTokens: Math.round(totalTokens / ops.length)
    };
  }

  analyzeUIOperations() {
    const ops = this.metrics.uiOperations;
    if (ops.length === 0) return { count: 0, averageDuration: 0 };
    
    const durations = ops.map(op => op.duration);
    
    return {
      count: ops.length,
      averageDuration: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      maxDuration: Math.max(...durations),
      minDuration: Math.min(...durations)
    };
  }

  analyzeMemoryUsage() {
    const usage = this.metrics.memoryUsage;
    if (usage.length === 0) return { averageRSS: 0, averageHeap: 0 };
    
    const rssValues = usage.map(u => u.rss);
    const heapValues = usage.map(u => u.heapUsed);
    
    return {
      samples: usage.length,
      averageRSS: Math.round(rssValues.reduce((a, b) => a + b, 0) / rssValues.length),
      averageHeap: Math.round(heapValues.reduce((a, b) => a + b, 0) / heapValues.length),
      maxRSS: Math.max(...rssValues),
      maxHeap: Math.max(...heapValues)
    };
  }

  getRecentMetrics(since) {
    const recent = {};
    
    Object.keys(this.metrics).forEach(key => {
      recent[key] = this.metrics[key].filter(metric => metric.timestamp > since);
    });
    
    return recent;
  }

  // Performance optimization suggestions
  getOptimizationSuggestions() {
    const suggestions = [];
    const summary = this.getPerformanceSummary();
    
    // File operation suggestions
    if (summary.fileOperations.averageDuration > 1000) {
      suggestions.push({
        type: 'file',
        severity: 'warning',
        message: 'File operations are slow. Consider implementing caching for frequently accessed files.',
        metric: `Average file operation time: ${summary.fileOperations.averageDuration}ms`
      });
    }
    
    // AI operation suggestions
    if (summary.aiOperations.averageDuration > 5000) {
      suggestions.push({
        type: 'ai',
        severity: 'warning',
        message: 'AI operations are taking too long. Consider using smaller models or optimizing prompts.',
        metric: `Average AI operation time: ${summary.aiOperations.averageDuration}ms`
      });
    }
    
    // Memory usage suggestions
    const memory = summary.memoryUsage;
    if (memory.averageRSS > 500 * 1024 * 1024) { // 500MB
      suggestions.push({
        type: 'memory',
        severity: 'critical',
        message: 'High memory usage detected. Consider implementing memory management strategies.',
        metric: `Average RSS memory: ${Math.round(memory.averageRSS / (1024 * 1024))}MB`
      });
    }
    
    return suggestions;
  }

  // Reset all metrics
  reset() {
    this.metrics = {
      fileOperations: [],
      aiOperations: [],
      uiOperations: [],
      memoryUsage: []
    };
    this.startTime = Date.now();
    this.lastMemoryCheck = 0;
  }
}

module.exports = PerformanceService;
