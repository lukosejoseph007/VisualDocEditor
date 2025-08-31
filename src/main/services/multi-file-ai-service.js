const OpenAI = require('openai');
const FileHandler = require('./file-handler');

class MultiFileAIService {
  constructor() {
    this.fileHandler = new FileHandler();
  }

  async performMultiFileAction({ provider, apiKey, modelId, mode, currentFile, relatedFiles, query }) {
    try {
      // Create OpenAI client based on provider
      const openai = new OpenAI({
        apiKey,
        baseURL: provider === 'openrouter' 
          ? 'https://openrouter.ai/api/v1' 
          : undefined
      });

      // Build context from multiple files
      const context = await this.buildMultiFileContext(currentFile, relatedFiles);
      
      // Create system prompt based on action mode
      let systemPrompt;
      switch (mode) {
        case 'analyze':
          systemPrompt = 'You are a document analysis assistant. Analyze the following documents and provide insights:';
          break;
        case 'compare':
          systemPrompt = 'You are a comparison assistant. Compare the following documents and highlight similarities/differences:';
          break;
        case 'synthesize':
          systemPrompt = 'You are a synthesis assistant. Combine insights from the following documents:';
          break;
        default:
          systemPrompt = 'You are a helpful assistant. Perform the requested multi-file analysis:';
      }

      // Call the AI API with multi-file context
      const response = await openai.chat.completions.create({
        model: modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Context from multiple files:\n${context}\n\nQuery: ${query}` }
        ],
        max_tokens: 3000
      });

      return response.choices[0].message.content;
    } catch (err) {
      console.error('Multi-file AI request failed:', err);
      return `Multi-file AI Error: ${err.message}`;
    }
  }

  async buildMultiFileContext(currentFile, relatedFiles) {
    let context = `CURRENT FILE: ${currentFile.name}\n`;
    context += `Content: ${currentFile.content.substring(0, 1000)}...\n\n`;
    
    context += `RELATED FILES (${relatedFiles.length}):\n`;
    
    for (const [index, file] of relatedFiles.entries()) {
      try {
        // Read each related file
        const content = await this.readFileContent(file.path);
        context += `\n${index + 1}. ${file.name} (Similarity: ${file.similarity})\n`;
        context += `Key Terms: ${file.keyTerms.join(', ')}\n`;
        context += `Summary: ${file.summary}\n`;
        context += `Content Preview: ${content.substring(0, 500)}...\n`;
      } catch (err) {
        context += `\n${index + 1}. ${file.name} - Error reading file: ${err.message}\n`;
      }
    }
    
    return context;
  }

  async readFileContent(filePath) {
    try {
      const result = await this.fileHandler.readFile(filePath);
      return result.content;
    } catch (err) {
      console.error('Error reading file for multi-file context:', filePath, err);
      return `[Error reading file: ${err.message}]`;
    }
  }

  generateCrossFileInsights(currentFile, relatedFiles) {
    const insights = [];
    
    // Analyze relationships between files
    relatedFiles.forEach(relatedFile => {
      const commonTerms = this.findCommonTerms(currentFile.keyTerms, relatedFile.keyTerms);
      if (commonTerms.length > 0) {
        insights.push({
          files: [currentFile.name, relatedFile.name],
          commonTerms,
          similarity: relatedFile.similarity,
          insight: `These files share ${commonTerms.length} key terms: ${commonTerms.join(', ')}`
        });
      }
    });
    
    return insights;
  }

  findCommonTerms(terms1, terms2) {
    return terms1.filter(term => terms2.includes(term));
  }

  async createDocumentMap(files) {
    // Create a semantic map of document relationships
    const map = {
      nodes: [],
      edges: []
    };
    
    // Add current file as central node
    map.nodes.push({
      id: 'current',
      label: files.current.name,
      type: 'current',
      size: files.current.wordCount,
      keyTerms: files.current.keyTerms.slice(0, 5)
    });
    
    // Add related files as nodes
    files.related.forEach((file, index) => {
      map.nodes.push({
        id: `related-${index}`,
        label: file.name,
        type: 'related',
        size: file.wordCount,
        similarity: file.similarity,
        keyTerms: file.keyTerms.slice(0, 3)
      });
      
      // Add edges between current and related files
      map.edges.push({
        from: 'current',
        to: `related-${index}`,
        label: `Similarity: ${file.similarity}`,
        strength: file.similarity / 10 // Normalize for visualization
      });
    });
    
    return map;
  }
}

module.exports = MultiFileAIService;
