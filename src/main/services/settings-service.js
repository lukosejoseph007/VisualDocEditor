const fs = require('fs');
const path = require('path');

class SettingsService {
  constructor(app) {
    this.settingsFile = path.join(app.getPath('userData'), 'settings.json');
    this.contextCacheFile = path.join(app.getPath('userData'), 'context-cache.json');
    
    // Default settings with models list
    this.defaultSettings = {
      apiKey: '',
      provider: 'openrouter',
      lastModel: 'deepseek/deepseek-r1-0528:free',
      aiMode: 'append',
      models: [
        'deepseek/deepseek-r1-0528:free',
        'anthropic/claude-3-haiku:beta',
        'openai/gpt-4o-mini',
        'google/gemini-flash-1.5',
        'meta-llama/llama-3.1-8b-instruct:free'
      ]
    };
  }

  loadSettings() {
    try {
      const settings = JSON.parse(fs.readFileSync(this.settingsFile, 'utf-8'));
      // Ensure models array exists and has defaults
      if (!settings.models || settings.models.length === 0) {
        settings.models = [...this.defaultSettings.models];
      }
      return { ...this.defaultSettings, ...settings };
    } catch {
      return { ...this.defaultSettings };
    }
  }

  saveSettings(settings) {
    const current = this.loadSettings();
    const updated = { ...current, ...settings };
    fs.writeFileSync(this.settingsFile, JSON.stringify(updated, null, 2));
    return updated;
  }

  addModel(model) {
    const settings = this.loadSettings();
    if (!settings.models.includes(model)) {
      settings.models.unshift(model); // Add to beginning
      // Keep only last 20 models
      if (settings.models.length > 20) {
        settings.models = settings.models.slice(0, 20);
      }
    }
    return this.saveSettings(settings);
  }

  removeModel(model) {
    const settings = this.loadSettings();
    settings.models = settings.models.filter(m => m !== model);
    return this.saveSettings(settings);
  }

  clearModels() {
    const settings = this.loadSettings();
    settings.models = [...this.defaultSettings.models]; // Reset to defaults
    return this.saveSettings(settings);
  }

  // Context cache methods
  loadContextCache() {
    let contextCache = { files: {}, lastUpdate: 0 };
    try { 
      contextCache = JSON.parse(fs.readFileSync(this.contextCacheFile, 'utf-8')); 
    } catch { /* ignore */ }
    return contextCache;
  }

  saveContextCache(contextCache) {
    fs.writeFileSync(this.contextCacheFile, JSON.stringify(contextCache, null, 2));
  }
}

module.exports = SettingsService;
