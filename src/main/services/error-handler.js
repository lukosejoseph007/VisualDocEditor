class ErrorHandler {
  constructor() {
    this.errorLog = [];
    this.maxLogSize = 1000; // Keep last 1000 errors
  }

  logError(error, context = {}) {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      error: this.serializeError(error),
      context,
      stack: error.stack || new Error().stack
    };

    this.errorLog.push(errorEntry);
    
    // Keep log size manageable
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }

    console.error('Error logged:', errorEntry);
    return errorEntry;
  }

  serializeError(error) {
    if (error instanceof Error) {
      return {
        message: error.message,
        name: error.name,
        code: error.code,
        status: error.status,
        type: error.type
      };
    }
    return {
      message: String(error),
      name: 'UnknownError'
    };
  }

  getErrorSummary() {
    const errorCounts = {};
    this.errorLog.forEach(entry => {
      const errorType = entry.error.name || 'Unknown';
      errorCounts[errorType] = (errorCounts[errorType] || 0) + 1;
    });

    return {
      totalErrors: this.errorLog.length,
      errorCounts,
      recentErrors: this.errorLog.slice(-10)
    };
  }

  clearLog() {
    this.errorLog = [];
  }

  // Enhanced error handling for common scenarios
  handleFileError(error, filePath) {
    const context = { filePath, operation: 'file_operation' };
    
    if (error.code === 'ENOENT') {
      return this.createUserFriendlyError('File not found', `The file "${filePath}" does not exist.`, context);
    }
    
    if (error.code === 'EACCES') {
      return this.createUserFriendlyError('Permission denied', `You don't have permission to access "${filePath}".`, context);
    }
    
    if (error.code === 'EPERM') {
      return this.createUserFriendlyError('Operation not permitted', `Operation not permitted on "${filePath}".`, context);
    }
    
    return this.createUserFriendlyError('File operation failed', `Failed to process file: ${error.message}`, context);
  }

  handleAIError(error, context = {}) {
    const aiContext = { ...context, operation: 'ai_operation' };
    
    if (error.status === 429) {
      return this.createUserFriendlyError(
        'Rate limit exceeded', 
        'The AI service is currently rate limited. Please try again later or use a different API key.',
        aiContext
      );
    }
    
    if (error.status === 401) {
      return this.createUserFriendlyError(
        'Authentication failed',
        'Invalid API key. Please check your API credentials.',
        aiContext
      );
    }
    
    if (error.status === 500) {
      return this.createUserFriendlyError(
        'AI service unavailable',
        'The AI service is temporarily unavailable. Please try again later.',
        aiContext
      );
    }
    
    return this.createUserFriendlyError(
      'AI processing failed',
      `AI request failed: ${error.message}`,
      aiContext
    );
  }

  createUserFriendlyError(title, message, context = {}) {
    const friendlyError = {
      title,
      message,
      timestamp: new Date().toISOString(),
      context,
      isUserFriendly: true
    };

    this.logError(new Error(title), { ...context, userMessage: message });
    return friendlyError;
  }

  // Validation errors
  validateSettings(settings) {
    const errors = [];
    
    if (settings.provider === 'openai' && !settings.openaiApiKey) {
      errors.push(this.createUserFriendlyError(
        'OpenAI API Key Required',
        'Please provide an OpenAI API key to use this provider.',
        { setting: 'openaiApiKey' }
      ));
    }
    
    if (settings.provider === 'openrouter' && !settings.openrouterApiKey) {
      errors.push(this.createUserFriendlyError(
        'OpenRouter API Key Required',
        'Please provide an OpenRouter API key to use this provider.',
        { setting: 'openrouterApiKey' }
      ));
    }
    
    if (!settings.modelId) {
      errors.push(this.createUserFriendlyError(
        'Model Selection Required',
        'Please select an AI model to use.',
        { setting: 'modelId' }
      ));
    }
    
    return errors;
  }

  // File validation
  validateFile(filePath, expectedFormats = []) {
    const errors = [];
    const path = require('path');
    
    if (!filePath) {
      errors.push(this.createUserFriendlyError(
        'No file selected',
        'Please select a file to process.',
        { operation: 'file_validation' }
      ));
      return errors;
    }
    
    const ext = path.extname(filePath).toLowerCase();
    
    if (expectedFormats.length > 0 && !expectedFormats.includes(ext)) {
      errors.push(this.createUserFriendlyError(
        'Unsupported file format',
        `File format ${ext} is not supported. Supported formats: ${expectedFormats.join(', ')}`,
        { filePath, extension: ext, expectedFormats }
      ));
    }
    
    return errors;
  }

  // Performance monitoring
  startPerformanceMonitor(operationName) {
    return {
      name: operationName,
      startTime: Date.now(),
      end: () => {
        const duration = Date.now() - this.startTime;
        if (duration > 1000) { // Log slow operations
          this.logError(new Error('Slow operation'), {
            operation: operationName,
            durationMs: duration,
            warning: 'Operation took longer than 1 second'
          });
        }
        return duration;
      }
    };
  }
}

module.exports = ErrorHandler;
