const OpenAI = require('openai');
const natural = require('natural');
const path = require('path');

class AIService {
  constructor() {
    this.natural = natural;
    this.wordTokenizer = new natural.WordTokenizer();
    this.sentenceTokenizer = new natural.SentenceTokenizer();
  }

  async performAction({ provider, apiKey, modelId, mode, text }) {
    try {
      // Create OpenAI client based on provider
      const openai = new OpenAI({
        apiKey,
        baseURL: provider === 'openrouter' 
          ? 'https://openrouter.ai/api/v1' 
          : undefined
      });

      // Create system prompt based on action mode
      let systemPrompt;
      switch (mode) {
        case 'improve':
          systemPrompt = 'You are a writing assistant. Improve the following text while preserving its meaning:';
          break;
        case 'summarize':
          systemPrompt = 'You are a summarization assistant. Create a concise summary of the following text:';
          break;
        case 'ask':
          systemPrompt = 'You are a helpful assistant. Answer the user\'s question based on the provided context:';
          break;
        default:
          systemPrompt = 'You are a helpful assistant. Perform the requested action:';
      }

      // Call the AI API
      const response = await openai.chat.completions.create({
        model: modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        max_tokens: 2000
      });

      return response.choices[0].message.content;
    } catch (err) {
      console.error('AI request failed:', err);
      return `AI Error: ${err.message}`;
    }
  }

  processFileContent(content, filePath) {
    const words = this.wordTokenizer.tokenize(content.toLowerCase()) || [];
    const sentences = this.sentenceTokenizer.tokenize(content) || [];
    
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them']);
    const filteredWords = words.filter(word => 
      word && word.length > 2 && !stopWords.has(word) && !/^\d+$/.test(word)
    );
    
    const wordFreq = {};
    filteredWords.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });
    
    const keyTerms = Object.entries(wordFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20)
      .map(([word]) => word);
    
    const vector = keyTerms.reduce((vec, term) => {
      vec[term] = wordFreq[term] || 0;
      return vec;
    }, {});
    
    return {
      wordCount: words.length,
      sentenceCount: sentences.length,
      keyTerms,
      vector,
      summary: sentences.slice(0, 2).join(' ').substring(0, 200) + '...',
      headings: this.extractHeadings(content)
    };
  }

  extractHeadings(content) {
    const headings = [];
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      const match = line.match(/^(#{1,6})\s+(.+)/);
      if (match) {
        headings.push({
          level: match[1].length,
          text: match[2],
          line: index
        });
      }
    });
    return headings;
  }

  findRelatedFiles(contextCache, filePath, query) {
    const currentFile = contextCache.files[filePath];
    if (!currentFile) return { files: [] };
    
    const queryWords = this.wordTokenizer.tokenize(query.toLowerCase()) || [];
    const relatedFiles = [];
    
    for (const [fPath, fileData] of Object.entries(contextCache.files)) {
      if (fPath === filePath) continue;
      
      let similarity = 0;
      
      queryWords.forEach(word => {
        if (fileData.keyTerms.includes(word)) {
          similarity += 2;
        }
        if (fileData.vector[word]) {
          similarity += fileData.vector[word];
        }
      });
      
      currentFile.keyTerms.forEach(term => {
        if (fileData.keyTerms.includes(term)) {
          similarity += 1;
        }
      });
      
      if (similarity > 0) {
        relatedFiles.push({
          path: fPath,
          name: path.basename(fPath),
          similarity,
          keyTerms: fileData.keyTerms.slice(0, 3),
          summary: fileData.summary
        });
      }
    }
    
    relatedFiles.sort((a, b) => b.similarity - a.similarity);
    return { files: relatedFiles.slice(0, 5) };
  }

  async performMultiFileAction({ provider, apiKey, modelId, mode, currentFile, relatedFiles, query }) {
    // Placeholder for multi-file AI functionality
    return "Multi-file AI features are not implemented in this version.";
  }
}

module.exports = AIService;
