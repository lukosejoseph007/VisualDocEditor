# VisualDocEditor - Comprehensive Documentation

## Overview

VisualDocEditor is an AI-powered document editor built with Electron that provides advanced document processing capabilities with AI integration. It features a modern VS Code-like interface and supports multiple document formats with intelligent processing.

## Project Structure

```
VisualDocEditor/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── main.js          # Main application entry point
│   │   └── services/        # Backend services
│   │       ├── ai-service.js              # AI integration service
│   │       ├── cline-service.js          # Cline tracking service
│   │       ├── docx-formatter.js          # DOCX processing
│   │       ├── file-handler.js           # File operations
│   │       ├── multi-file-ai-service.js   # Multi-file AI
│   │       ├── settings-service.js        # Settings management
│   │       └── error-handler.js           # Error handling
│   └── renderer/            # Frontend components
│       ├── components/      # React components
│       ├── diffEditor.js    # Diff editor functionality
│       ├── monaco-theme.js  # Monaco editor theme
│       └── renderer.mjs     # Main renderer script
├── test-files/              # Test documents
├── Dev Documentation/       # Development documentation
├── package.json             # Project dependencies
├── index.html              # Main HTML file
├── preload.js              # Electron preload script
└── renderer.mjs            # Renderer entry point
```

## Key Features

### 1. Multi-Format Document Support
- **Markdown (.md)** - Full editing support
- **Text Files (.txt)** - Basic text editing
- **Word Documents (.docx)** - XML-aware processing with formatting preservation
- **PDF Files (.pdf)** - Text extraction and editing
- **PowerPoint (.pptx)** - Slide content processing
- **HTML Files (.html)** - Web content editing

### 2. AI Integration
- **OpenAI Integration** - Direct API access
- **OpenRouter Support** - Alternative AI provider
- **Multiple AI Models** - Configurable model selection
- **Thinking Process Tracking** - Cline service integration

### 3. Advanced Document Processing
- **XML-Aware Processing** - Preserves Office document structure
- **Format Preservation** - Maintains original formatting during AI operations
- **Multi-File Context** - Builds context across folder contents
- **Intelligent Export** - Export to various formats

### 4. User Interface
- **VS Code-like Ribbon Interface** - Modern tab-based UI
- **Custom Title Bar** - Frameless Electron window
- **Monaco Editor** - Professional code editor integration
- **Sidebar Navigation** - File browser with context indicators
- **Diff Editor** - Visual comparison of AI modifications

## Technical Architecture

### Electron Application Structure

**Main Process (src/main/main.js)**
- Handles window creation and management
- Manages IPC communication between renderer and main process
- Coordinates all backend services

**Renderer Process (src/renderer/)**
- Monaco editor integration
- UI rendering and user interactions
- Frontend logic and state management

### Backend Services

#### AI Service (ai-service.js)
- OpenAI/OpenRouter client management
- XML-aware text processing for Office documents
- Token usage calculation and tracking
- Thinking process generation for Cline integration

#### Cline Service (cline-service.js)
- Session management and tracking
- Performance metrics collection
- Token usage monitoring
- Operation tracking and analytics

#### File Handler (file-handler.js)
- Multi-format file reading/writing
- Office document XML processing
- Format conversion and export
- File system operations

#### Multi-File AI Service (multi-file-ai-service.js)
- Context building across multiple files
- Related file discovery and analysis
- Cross-document AI operations

## AI Capabilities

### Single File Operations
- **Improve** - Enhance writing quality while preserving meaning
- **Summarize** - Create concise summaries of content
- **Ask** - Answer questions based on document content

### Multi-File Operations
- **Explain** - Provide explanations across multiple documents
- **Connect** - Find connections between different files
- **Find** - Search for similar content across files
- **Overview** - Generate comprehensive overviews of folder content

### XML-Aware Processing
The application intelligently processes Office documents by:
1. Extracting text nodes from XML structure
2. Applying AI processing to individual text elements
3. Preserving document formatting and structure
4. Reconstructing the document with AI-enhanced content

## User Interface Components

### Ribbon Interface
- **File Tab** - Open, save, export operations
- **AI Tools Tab** - Single and multi-file AI actions
- **AI Settings Tab** - Provider configuration and model management

### Sidebar
- File browser with format indicators
- Context readiness indicators
- Search functionality (Ctrl+K)
- File metadata display

### Editor Area
- Monaco editor with custom teal theme
- Language-specific syntax highlighting
- Real-time editing with change detection

### Cline Panel
- AI usage statistics and metrics
- Session tracking and management
- Token usage monitoring
- Performance analytics
- Thinking process visualization

## Installation and Setup

### Prerequisites
- Node.js (v16+)
- npm or yarn

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

## Configuration

### AI Providers
- **OpenRouter** (default) - https://openrouter.ai/api/v1
- **OpenAI** - Direct API access

### Model Management
- Persistent model selection
- Custom model addition
- Model list management

### Settings Persistence
- API key storage
- Provider preferences
- Last used model memory
- AI mode settings (append/replace)

## File Processing Pipeline

1. **File Loading**
   - Detect file format
   - Extract content using appropriate parser
   - Convert to editable text format

2. **AI Processing**
   - XML extraction (for Office documents)
   - Text node processing
   - Structure preservation
   - Content enhancement

3. **Export/Conversion**
   - Format selection
   - Structure reconstruction
   - File generation

## Error Handling

### Comprehensive Error Management
- File read/write errors
- AI API failures
- Format conversion issues
- Network connectivity problems

### User Feedback
- Clear error messages
- Operation status indicators
- Recovery suggestions

## Performance Features

### Monitoring
- Response time tracking
- Memory usage monitoring
- Operation success rates
- Token usage analytics

### Optimization
- Caching mechanisms
- Background processing
- Efficient file operations
- Memory management

## Development Notes

### Key Dependencies
- **electron** - Desktop application framework
- **monaco-editor** - Code editor component
- **openai** - AI API client
- **docxtemplater** - DOCX processing
- **mammoth** - DOCX to HTML conversion
- **pptxgenjs** - PPTX generation
- **natural** - NLP for context building

### Testing Strategy
- Comprehensive test files for all formats
- XML processing validation
- Format preservation testing
- AI integration verification

## Future Enhancements

### Planned Features
- Real-time collaboration
- Plugin system for format extensions
- Enhanced multi-file analysis
- Advanced AI model support
- Cloud synchronization
- Version control integration

### Technical Improvements
- Performance optimization
- Memory efficiency
- Better error recovery
- Enhanced user experience

## Usage Examples

### Basic Document Editing
1. Open a document (File → Open)
2. Edit content in Monaco editor
3. Use AI tools for enhancement
4. Save or export to desired format

### AI-Powered Workflow
1. Open folder for multi-file context
2. Build context for AI operations
3. Use multi-file AI tools for analysis
4. Export results with preserved formatting

### Office Document Processing
1. Open DOCX/PPTX file
2. AI operations preserve formatting
3. Export maintains original structure
4. XML-aware processing ensures quality

## Contributing

This project demonstrates advanced Electron application development with:
- Modern UI/UX design patterns
- Complex file format handling
- AI integration best practices
- Performance monitoring implementation
- Professional development workflows

The codebase serves as a reference for building sophisticated desktop applications with AI capabilities and multi-format document processing.
