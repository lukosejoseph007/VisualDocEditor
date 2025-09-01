const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const xml2js = require('xml2js');

class TemplateService {
  constructor() {
    this.templatesDir = path.join(__dirname, '../templates');
    this.mappingsDir = path.join(__dirname, '../mappings');
    this.xmlParser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
    this.xmlBuilder = new xml2js.Builder();
    
    // Ensure directories exist
    this.ensureDirExists(this.templatesDir);
    this.ensureDirExists(this.mappingsDir);
  }

  ensureDirExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  async saveTemplate(filePath, templateName, type) {
    try {
      const data = fs.readFileSync(filePath);
      const targetPath = path.join(this.templatesDir, `${templateName}.${type}`);
      fs.writeFileSync(targetPath, data);
      
      // Extract template metadata
      const metadata = await this.extractTemplateMetadata(data, type);
      
      // Save mapping configuration
      const mappingPath = path.join(this.mappingsDir, `${templateName}.json`);
      fs.writeFileSync(mappingPath, JSON.stringify(metadata, null, 2));
      
      return { success: true, metadata };
    } catch (err) {
      throw new Error(`Template save failed: ${err.message}`);
    }
  }

  async extractTemplateMetadata(templateData, type) {
    const zip = await JSZip.loadAsync(templateData);
    const metadata = { type, styles: [], placeholders: [] };
    
    if (type === 'docx') {
      // Extract styles from Word template
      const stylesXml = await zip.file('word/styles.xml').async('string');
      const stylesResult = await this.xmlParser.parseStringPromise(stylesXml);
      metadata.styles = this.extractDocxStyles(stylesResult);
      
      // Extract content types and structure
      const documentXml = await zip.file('word/document.xml').async('string');
      const documentResult = await this.xmlParser.parseStringPromise(documentXml);
      metadata.placeholders = this.extractDocxPlaceholders(documentResult);
      
    } else if (type === 'pptx') {
      // Extract slide masters and layouts from PowerPoint template
      const presentationXml = await zip.file('ppt/presentation.xml').async('string');
      const presentationResult = await this.xmlParser.parseStringPromise(presentationXml);
      
      // Process slide masters
      const slideMasters = [];
      zip.forEach((relativePath, file) => {
        if (relativePath.startsWith('ppt/slideMasters/slideMaster') && relativePath.endsWith('.xml')) {
          slideMasters.push(relativePath);
        }
      });
      
      for (const masterPath of slideMasters) {
        const masterXml = await zip.file(masterPath).async('string');
        const masterResult = await this.xmlParser.parseStringPromise(masterXml);
        metadata.styles.push(...this.extractPptxStyles(masterResult));
        metadata.placeholders.push(...this.extractPptxPlaceholders(masterResult));
      }
    }
    
    return metadata;
  }

  extractDocxStyles(stylesXml) {
    const styles = [];
    if (stylesXml['w:styles'] && stylesXml['w:styles']['w:style']) {
      const styleArray = Array.isArray(stylesXml['w:styles']['w:style']) 
        ? stylesXml['w:styles']['w:style'] 
        : [stylesXml['w:styles']['w:style']];
      
      styleArray.forEach(style => {
        if (style['$'] && style['$']['w:type'] === 'paragraph') {
          styles.push({
            id: style['$']['w:styleId'],
            name: style['w:name'] ? style['w:name']['$']['w:val'] : 'Unknown',
            type: 'paragraph'
          });
        }
      });
    }
    return styles;
  }

  extractDocxPlaceholders(documentXml) {
    const placeholders = [];
    // Simple placeholder extraction - in real implementation, this would be more sophisticated
    if (documentXml['w:document'] && documentXml['w:document']['w:body']) {
      const body = documentXml['w:document']['w:body'];
      this.traverseDocxElements(body, placeholders);
    }
    return placeholders;
  }

  traverseDocxElements(element, placeholders, path = '') {
    if (!element) return;
    
    if (typeof element === 'object') {
      for (const key in element) {
        if (element.hasOwnProperty(key)) {
          const value = element[key];
          const currentPath = path ? `${path}.${key}` : key;
          
          if (key === 'w:t' && typeof value === 'string' && value.trim()) {
            placeholders.push({
              path: currentPath,
              text: value,
              type: 'text'
            });
          } else if (typeof value === 'object') {
            this.traverseDocxElements(value, placeholders, currentPath);
          }
        }
      }
    }
  }

  extractPptxStyles(masterXml) {
    const styles = [];
    // Extract color scheme, font scheme, etc.
    if (masterXml['p:clrMap']) {
      styles.push({
        type: 'colorScheme',
        mapping: masterXml['p:clrMap']['$']
      });
    }
    return styles;
  }

  extractPptxPlaceholders(masterXml) {
    const placeholders = [];
    // Extract shape placeholders from slide master
    if (masterXml['p:spTree'] && masterXml['p:spTree']['p:sp']) {
      const shapes = Array.isArray(masterXml['p:spTree']['p:sp'])
        ? masterXml['p:spTree']['p:sp']
        : [masterXml['p:spTree']['p:sp']];
      
      shapes.forEach((shape, index) => {
        if (shape['p:txBody'] && shape['p:txBody']['a:p']) {
          const text = this.extractTextFromPptxShape(shape['p:txBody']['a:p']);
          if (text) {
            placeholders.push({
              index,
              text,
              type: 'shape'
            });
          }
        }
      });
    }
    return placeholders;
  }

  extractTextFromPptxShape(paragraph) {
    if (Array.isArray(paragraph)) {
      return paragraph.map(p => this.extractTextFromPptxShape(p)).join(' ');
    }
    if (paragraph['a:r'] && paragraph['a:r']['a:t']) {
      return paragraph['a:r']['a:t'];
    }
    return '';
  }

  /**
   * Extract text nodes from DOCX XML structure with parent references
   */
  extractTextNodesFromDocx(xmlStructure, path = '', parent = null, keyInParent = null, nodes = []) {
    if (!xmlStructure) return nodes;
    
    if (typeof xmlStructure === 'object') {
      for (const key in xmlStructure) {
        if (xmlStructure.hasOwnProperty(key)) {
          const value = xmlStructure[key];
          const currentPath = path ? `${path}.${key}` : key;
          
          // Skip XML namespace objects and metadata
          if (key === '$' || key.startsWith('xmlns:')) {
            continue;
          }
          
          // Look for text nodes in DOCX XML
          if (key === 'w:t' && typeof value === 'string') {
            nodes.push({
              path: currentPath,
              text: value,
              type: key,
              parent: xmlStructure,
              keyInParent: key
            });
          } else if (typeof value === 'object' && value !== null) {
            // Recursively process nested objects
            this.extractTextNodesFromDocx(value, currentPath, xmlStructure, key, nodes);
          }
        }
      }
    }
    
    return nodes;
  }

  /**
   * Extract text nodes from PPTX XML structure with parent references
   */
  extractTextNodesFromPptx(xmlStructure, path = '', parent = null, keyInParent = null, nodes = []) {
    if (!xmlStructure) return nodes;
    
    if (typeof xmlStructure === 'object') {
      for (const key in xmlStructure) {
        if (xmlStructure.hasOwnProperty(key)) {
          const value = xmlStructure[key];
          const currentPath = path ? `${path}.${key}` : key;
          
          // Skip XML namespace objects and metadata
          if (key === '$' || key.startsWith('xmlns:')) {
            continue;
          }
          
          // Look for text nodes in PPTX XML
          if (key === 'a:t' && typeof value === 'string') {
            nodes.push({
              path: currentPath,
              text: value,
              type: key,
              parent: xmlStructure,
              keyInParent: key
            });
          } else if (typeof value === 'object' && value !== null) {
            // Recursively process nested objects
            this.extractTextNodesFromPptx(value, currentPath, xmlStructure, key, nodes);
          }
        }
      }
    }
    
    return nodes;
  }

  async createMapping(sourceTemplate, targetTemplate) {
    try {
      const sourceMapping = await this.loadMapping(sourceTemplate);
      const targetMapping = await this.loadMapping(targetTemplate);
      
      const mapping = {
        source: sourceTemplate,
        target: targetTemplate,
        styleMappings: this.mapStyles(sourceMapping.styles, targetMapping.styles),
        placeholderMappings: this.mapPlaceholders(sourceMapping.placeholders, targetMapping.placeholders),
        createdAt: new Date().toISOString()
      };
      
      const mappingPath = path.join(this.mappingsDir, `${sourceTemplate}_to_${targetTemplate}.json`);
      fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
      
      return mapping;
    } catch (err) {
      throw new Error(`Mapping creation failed: ${err.message}`);
    }
  }

  async loadMapping(templateName) {
    const mappingPath = path.join(this.mappingsDir, `${templateName}.json`);
    if (fs.existsSync(mappingPath)) {
      return JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
    }
    throw new Error(`Mapping not found for template: ${templateName}`);
  }

  mapStyles(sourceStyles, targetStyles) {
    const mappings = [];
    
    // Simple style mapping - match by type and name similarity
    sourceStyles.forEach(sourceStyle => {
      const targetStyle = targetStyles.find(ts => 
        ts.type === sourceStyle.type && 
        ts.name.toLowerCase().includes(sourceStyle.name.toLowerCase())
      );
      
      if (targetStyle) {
        mappings.push({
          source: sourceStyle.id,
          target: targetStyle.id,
          confidence: 0.8
        });
      }
    });
    
    return mappings;
  }

  mapPlaceholders(sourcePlaceholders, targetPlaceholders) {
    const mappings = [];
    
    // Simple placeholder mapping - match by text content similarity
    sourcePlaceholders.forEach(sourcePlaceholder => {
      const targetPlaceholder = targetPlaceholders.find(tp =>
        tp.text && sourcePlaceholder.text &&
        this.calculateSimilarity(tp.text, sourcePlaceholder.text) > 0.6
      );
      
      if (targetPlaceholder) {
        mappings.push({
          source: sourcePlaceholder.path || sourcePlaceholder.index,
          target: targetPlaceholder.path || targetPlaceholder.index,
          confidence: this.calculateSimilarity(sourcePlaceholder.text, targetPlaceholder.text)
        });
      }
    });
    
    return mappings;
  }

  calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);
    
    const commonWords = words1.filter(word => words2.includes(word));
    return commonWords.length / Math.max(words1.length, words2.length);
  }

  async migrateContent(sourceData, sourceTemplate, targetTemplate, mappingName = null) {
    try {
      let mapping;
      if (mappingName) {
        mapping = await this.loadMapping(mappingName);
      } else {
        mapping = await this.createMapping(sourceTemplate, targetTemplate);
      }
      
      // Load target template
      const targetTemplatePath = path.join(this.templatesDir, `${targetTemplate}.${sourceData.format}`);
      const targetData = fs.readFileSync(targetTemplatePath);
      
      if (sourceData.format === 'docx') {
        return await this.migrateDocxContent(sourceData, targetData, mapping);
      } else if (sourceData.format === 'pptx') {
        return await this.migratePptxContent(sourceData, targetData, mapping);
      }
      
      throw new Error(`Unsupported format for migration: ${sourceData.format}`);
    } catch (err) {
      throw new Error(`Content migration failed: ${err.message}`);
    }
  }

  async migrateDocxContent(sourceData, targetData, mapping) {
    const sourceZip = await JSZip.loadAsync(sourceData.zipData);
    const targetZip = await JSZip.loadAsync(targetData);
    
    // Extract source document content
    const sourceDocumentXml = await sourceZip.file('word/document.xml').async('string');
    const sourceDocument = await this.xmlParser.parseStringPromise(sourceDocumentXml);
    
    // Extract target document structure
    const targetDocumentXml = await targetZip.file('word/document.xml').async('string');
    const targetDocument = await this.xmlParser.parseStringPromise(targetDocumentXml);
    
    // Apply style mappings
    const targetStylesXml = await targetZip.file('word/styles.xml').async('string');
    const targetStyles = await this.xmlParser.parseStringPromise(targetStylesXml);
    
    mapping.styleMappings.forEach(styleMapping => {
      // Apply style mapping by updating target styles with source style properties
      if (targetStyles['w:styles'] && targetStyles['w:styles']['w:style']) {
        const styles = Array.isArray(targetStyles['w:styles']['w:style']) 
          ? targetStyles['w:styles']['w:style'] 
          : [targetStyles['w:styles']['w:style']];
        
        const targetStyle = styles.find(s => s['$'] && s['$']['w:styleId'] === styleMapping.target);
        if (targetStyle) {
          // Apply style mapping logic (simplified - would need more complex implementation)
          // This would copy style properties from source to target
        }
      }
    });
    
    // Migrate content based on placeholder mappings
    const sourceTextNodes = this.extractTextNodesFromDocx(sourceDocument);
    const targetTextNodes = this.extractTextNodesFromDocx(targetDocument);
    
    mapping.placeholderMappings.forEach(placeholderMapping => {
      const sourceNode = sourceTextNodes.find(n => n.path === placeholderMapping.source);
      const targetNode = targetTextNodes.find(n => n.path === placeholderMapping.target);
      
      if (sourceNode && targetNode) {
        // Copy content from source to target placeholder
        targetNode.parent[targetNode.keyInParent] = sourceNode.text;
      }
    });
    
    // Update target document XML
    const updatedTargetDocumentXml = this.xmlBuilder.buildObject(targetDocument);
    targetZip.file('word/document.xml', updatedTargetDocumentXml);
    
    // Update target styles XML
    const updatedStylesXml = this.xmlBuilder.buildObject(targetStyles);
    targetZip.file('word/styles.xml', updatedStylesXml);
    
    // Preserve media files and other resources
    sourceZip.forEach((relativePath, file) => {
      if (relativePath.startsWith('word/media/') || 
          relativePath.startsWith('word/theme/') ||
          relativePath.startsWith('word/_rels/')) {
        targetZip.file(relativePath, file);
      }
    });
    
    const buffer = await targetZip.generateAsync({ type: 'nodebuffer' });
    return buffer;
  }

  async migratePptxContent(sourceData, targetData, mapping) {
    const sourceZip = await JSZip.loadAsync(sourceData.zipData);
    const targetZip = await JSZip.loadAsync(targetData);
    
    // Process each source slide
    for (let i = 0; i < sourceData.slides.length; i++) {
      const sourceSlide = sourceData.slides[i];
      const targetSlidePath = `ppt/slides/slide${i + 1}.xml`;
      
      if (targetZip.files[targetSlidePath]) {
        // Get target slide XML
        const targetSlideXml = await targetZip.file(targetSlidePath).async('string');
        const targetSlide = await this.xmlParser.parseStringPromise(targetSlideXml);
        
        // Extract text nodes from both slides
        const sourceTextNodes = this.extractTextNodesFromPptx(sourceSlide.xml);
        const targetTextNodes = this.extractTextNodesFromPptx(targetSlide);
        
        // Apply content migration based on mapping
        mapping.placeholderMappings.forEach(placeholderMapping => {
          const sourceNode = sourceTextNodes.find(n => n.index === placeholderMapping.source);
          const targetNode = targetTextNodes.find(n => n.index === placeholderMapping.target);
          
          if (sourceNode && targetNode) {
            // Copy content from source to target placeholder
            targetNode.parent[targetNode.keyInParent] = sourceNode.text;
          }
        });
        
        // Update target slide XML
        const updatedSlideXml = this.xmlBuilder.buildObject(targetSlide);
        targetZip.file(targetSlidePath, updatedSlideXml);
      }
    }
    
    // Preserve media files and presentation structure
    sourceZip.forEach((relativePath, file) => {
      if (relativePath.startsWith('ppt/media/') || 
          relativePath.startsWith('ppt/theme/') ||
          relativePath.startsWith('ppt/slideMasters/') ||
          relativePath.startsWith('ppt/slideLayouts/')) {
        targetZip.file(relativePath, file);
      }
    });
    
    const buffer = await targetZip.generateAsync({ type: 'nodebuffer' });
    return buffer;
  }

  listTemplates() {
    const templates = [];
    
    if (fs.existsSync(this.templatesDir)) {
      const files = fs.readdirSync(this.templatesDir);
      files.forEach(file => {
        const ext = path.extname(file).slice(1);
        if (['docx', 'pptx'].includes(ext)) {
          const name = path.basename(file, `.${ext}`);
          templates.push({ name, type: ext });
        }
      });
    }
    
    return templates;
  }

  listMappings() {
    const mappings = [];
    
    if (fs.existsSync(this.mappingsDir)) {
      const files = fs.readdirSync(this.mappingsDir);
      files.forEach(file => {
        if (file.endsWith('.json')) {
          const content = fs.readFileSync(path.join(this.mappingsDir, file), 'utf-8');
          try {
            const mapping = JSON.parse(content);
            mappings.push({
              name: path.basename(file, '.json'),
              source: mapping.source,
              target: mapping.target,
              createdAt: mapping.createdAt
            });
          } catch (err) {
            // Skip invalid JSON files
          }
        }
      });
    }
    
    return mappings;
  }
}

module.exports = TemplateService;
