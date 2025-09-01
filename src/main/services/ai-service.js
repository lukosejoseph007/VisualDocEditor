const OpenAI = require('openai');
const natural = require('natural');
const path = require('path');

class AIService {
  constructor(clineService) {
    this.natural = natural;
    this.wordTokenizer = new natural.WordTokenizer();
    this.sentenceTokenizer = new natural.SentenceTokenizer();
    this.clineService = clineService;
  }

  async performAction({ provider, apiKey, modelId, mode, text }) {
    const startTime = Date.now();
    let responseTime = 0;
    
    // Track AI operation with Cline service
    const operationId = await this.clineService.trackOperation(
      this.clineService.getCurrentSession()?.id,
      {
        type: 'ai_request',
        provider,
        model: modelId,
        mode,
        textLength: text.length
      }
    );
    
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

      responseTime = Date.now() - startTime;
      
      // Calculate token usage (approximate)
      const promptTokens = Math.ceil((systemPrompt.length + text.length) / 4);
      const completionTokens = Math.ceil(response.choices[0].message.content.length / 4);
      const totalTokens = promptTokens + completionTokens;
      
      // Calculate context size (system prompt + user input)
      const contextSize = systemPrompt.length + text.length;
      
      // Update context size in Cline service
      const sessionId = this.clineService.getCurrentSession()?.id;
      if (sessionId) {
        await this.clineService.updateContextSize(sessionId, contextSize);
      }
      
      // Complete the operation with success
      await this.clineService.completeOperation(
        sessionId,
        operationId,
        {
          success: true,
          responseTime,
          tokenUsage: {
            prompt: promptTokens,
            completion: completionTokens,
            total: totalTokens
          },
          contextSize: contextSize
        }
      );
      
      // Return enhanced result with metadata including thinking process
      const aiContent = response.choices[0].message.content;
      return {
        content: aiContent,
        metadata: {
          responseTime,
          tokenUsage: {
            prompt: promptTokens,
            completion: completionTokens,
            total: totalTokens
          },
          model: modelId,
          mode: mode,
          thinkingProcess: this.generateThinkingProcess(mode, text, aiContent)
        }
      };
    } catch (err) {
      responseTime = Date.now() - startTime;
      console.error('AI request failed:', err);
      
      // Complete the operation with failure
      await this.clineService.completeOperation(
        this.clineService.getCurrentSession()?.id,
        operationId,
        {
          success: false,
          responseTime,
          error: err.message
        }
      );
      
      return {
        content: `AI Error: ${err.message}`,
        metadata: {
          responseTime,
          error: err.message,
          success: false
        }
      };
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

  /**
   * Generate thinking process information for AI operations in Cline format
   */
  generateThinkingProcess(mode, input, output) {
    let thinkingContent = '';
    
    switch (mode) {
      case 'improve':
        thinkingContent = `<thinking>
Analyzing text structure and readability...
- Checking grammar and syntax
- Assessing coherence and flow
- Identifying areas for improvement
- Planning enhancements while preserving original meaning

Applying language improvements...
- Correcting grammatical errors
- Enhancing sentence structure
- Improving word choice and phrasing
- Maintaining original intent and tone

Reviewing changes...
- Ensuring coherence and quality
- Verifying meaning preservation
- Checking for consistency
- Finalizing improvements
</thinking>`;
        break;
      case 'summarize':
        thinkingContent = `<thinking>
Identifying key points and main ideas...
- Scanning for main themes
- Extracting essential information
- Determining core concepts
- Filtering out redundant content

Condensing content while maintaining meaning...
- Creating concise statements
- Preserving important details
- Removing unnecessary examples
- Structuring summary logically

Refining summary for clarity...
- Ensuring readability
- Checking coherence
- Verifying accuracy
- Finalizing concise output
</thinking>`;
        break;
      case 'ask':
        thinkingContent = `<thinking>
Understanding the question and context...
- Parsing the user's question
- Identifying key requirements
- Understanding the context provided
- Determining the scope of response

Retrieving relevant information...
- Accessing knowledge base
- Gathering relevant facts
- Organizing information logically
- Preparing comprehensive answer

Synthesizing information into coherent answer...
- Structuring the response
- Ensuring completeness
- Validating accuracy
- Finalizing the answer
</thinking>`;
        break;
      default:
        thinkingContent = `<thinking>
Processing the request...
- Analyzing input requirements
- Determining appropriate approach
- Planning execution strategy
- Preparing to perform operation

Executing the operation...
- Applying AI capabilities
- Generating appropriate response
- Ensuring quality output
- Completing the task successfully
</thinking>`;
    }

    return thinkingContent;
  }
}

module.exports = AIService;
