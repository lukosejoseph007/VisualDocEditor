const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const PizZip = require('pizzip');
const xml2js = require('xml2js');
const Docxtemplater = require('docxtemplater');
const pdfParse = require('pdf-parse');
const pptxgen = require('pptxgenjs');
const TurndownService = require('turndown');
const showdown = require('showdown');

class FileHandler {
  constructor() {
    this.turndownService = new TurndownService();
    this.converter = new showdown.Converter();
    this.xmlParser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
    this.xmlBuilder = new xml2js.Builder();
  }

  async readDocx(filePath) {
    try {
      const data = fs.readFileSync(filePath);
      const zip = await JSZip.loadAsync(data);
      
      // Extract document.xml for text content
      const documentXml = await zip.file('word/document.xml').async('string');
      const result = await this.xmlParser.parseStringPromise(documentXml);
      
      // Extract text nodes (<w:t> elements)
      const textContent = this.extractTextFromDocxXml(result);
      
      return { 
        content: textContent, 
        format: 'docx',
        xmlStructure: result, // Preserve XML structure for editing
        zipData: data // Keep zip data for media preservation
      };
    } catch (err) {
      throw new Error(`DOCX reading failed: ${err.message}`);
    }
  }

  async readPptx(filePath) {
    try {
      const data = fs.readFileSync(filePath);
      const zip = await JSZip.loadAsync(data);
      
      const slides = await this.extractSlidesFromPPTX(zip);
      const textContent = slides.map(slide => `Slide ${slide.number}:\n${slide.text}`).join('\n\n');
      
      return {
        content: textContent,
        format: 'pptx',
        slides, // Preserve slide structure
        zipData: data // Keep zip data for media preservation
      };
    } catch (err) {
      throw new Error(`PPTX reading failed: ${err.message}`);
    }
  }

  async extractSlidesFromPPTX(zip) {
    const slides = [];
    let slideCount = 0;
    
    // Count slides
    zip.forEach((relativePath, file) => {
      if (relativePath.startsWith('ppt/slides/slide') && relativePath.endsWith('.xml')) {
        slideCount++;
      }
    });

    // Process each slide
    for (let i = 1; i <= slideCount; i++) {
      const slidePath = `ppt/slides/slide${i}.xml`;
      if (!zip.files[slidePath]) continue;

      const slideContent = await zip.file(slidePath).async('string');
      const result = await this.xmlParser.parseStringPromise(slideContent);
      
      const slideText = this.extractTextFromPptxXml(result);
      slides.push({
        number: i,
        text: slideText,
        xml: result // Preserve XML structure
      });
    }

    return slides;
  }

  extractTextFromDocxXml(xmlObj) {
    const extractText = (obj) => {
      if (!obj) return '';
      if (typeof obj === 'string') return obj;
      
      // Handle text elements directly
      if (obj['w:t'] && typeof obj['w:t'] === 'string') {
        return obj['w:t'];
      }
      
      // Handle runs (text containers)
      if (obj['w:r']) {
        return this.extractTextFromRun(obj['w:r']);
      }
      
      // Handle paragraphs
      if (obj['w:p']) {
        return this.extractTextFromParagraph(obj['w:p']);
      }
      
      // Handle document body
      if (obj['w:body']) {
        return this.extractTextFromBody(obj['w:body']);
      }
      
      // Skip XML namespace objects and other metadata
      if (typeof obj === 'object' && obj !== null) {
        // Check if this looks like a namespace object (has $ attribute)
        if (obj['$'] || Object.keys(obj).some(key => key.startsWith('xmlns:'))) {
          return '';
        }
      }
      
      // For other objects, only extract known text properties
      let text = '';
      const textKeys = ['w:t', 'text', 'content', 'value'];
      
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          if (textKeys.includes(key) && typeof obj[key] === 'string') {
            text += obj[key] + ' ';
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            // Recursively extract text from nested objects, but avoid infinite recursion
            const nestedText = extractText(obj[key]);
            if (nestedText && !nestedText.includes('[object')) {
              text += nestedText + ' ';
            }
          }
        }
      }
      return text.trim();
    };

    return extractText(xmlObj);
  }

  extractTextFromRun(run) {
    if (Array.isArray(run)) {
      return run.map(r => this.extractTextFromRun(r)).join(' ');
    }
    if (run && typeof run === 'object') {
      // Extract text content from run
      if (run['w:t'] && typeof run['w:t'] === 'string') {
        return run['w:t'];
      }
      // Handle array of text elements
      if (Array.isArray(run['w:t'])) {
        return run['w:t'].filter(t => typeof t === 'string').join(' ');
      }
    }
    return '';
  }

  extractTextFromParagraph(paragraph) {
    if (Array.isArray(paragraph)) {
      return paragraph.map(p => this.extractTextFromParagraph(p)).join('\n');
    }
    if (paragraph && typeof paragraph === 'object') {
      const runText = paragraph['w:r'] ? this.extractTextFromRun(paragraph['w:r']) : '';
      return runText + '\n';
    }
    return '\n';
  }

  extractTextFromBody(body) {
    if (Array.isArray(body)) {
      return body.map(b => this.extractTextFromBody(b)).join('\n');
    }
    if (body && typeof body === 'object') {
      const paragraphText = body['w:p'] ? this.extractTextFromParagraph(body['w:p']) : '';
      return paragraphText;
    }
    return '';
  }

  extractTextFromPptxXml(xmlObj) {
    const extractText = (obj) => {
      if (!obj) return '';
      if (typeof obj === 'string') return obj;
      if (obj['a:t']) return obj['a:t'];
      if (obj['a:r']) return this.extractTextFromPptxRun(obj['a:r']);
      if (obj['a:p']) return this.extractTextFromPptxParagraph(obj['a:p']);
      
      let text = '';
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          text += extractText(obj[key]) + ' ';
        }
      }
      return text.trim();
    };

    return extractText(xmlObj);
  }

  extractTextFromPptxRun(run) {
    if (Array.isArray(run)) {
      return run.map(r => this.extractTextFromPptxRun(r)).join(' ');
    }
    return run['a:t'] || '';
  }

  extractTextFromPptxParagraph(paragraph) {
    if (Array.isArray(paragraph)) {
      return paragraph.map(p => this.extractTextFromPptxParagraph(p)).join('\n');
    }
    return (paragraph['a:r'] ? this.extractTextFromPptxRun(paragraph['a:r']) : '') + '\n';
  }

  async updateDocxWithAI(filePath, originalData, aiResult) {
    try {
      // Handle case where originalData is not provided (new file creation)
      if (!originalData || !originalData.zipData) {
        await this.writeDocx(filePath, aiResult.content);
        return true;
      }
      
      // Ensure zipData is in proper format for JSZip
      const zipData = originalData.zipData.buffer ? originalData.zipData.buffer : originalData.zipData;
      const zip = await JSZip.loadAsync(zipData);
      
      // If we have updated XML structure from AI, serialize it back
      if (aiResult.xmlStructure) {
        // Serialize the updated XML back to string
        const updatedDocumentXml = this.xmlBuilder.buildObject(aiResult.xmlStructure);
        
        // Update the document.xml in the ZIP
        zip.file('word/document.xml', updatedDocumentXml);
        
        // Preserve all media files and relationships
        const preservePromises = [];
        zip.forEach((relativePath, file) => {
          if (relativePath.startsWith('word/media/') || 
              relativePath.startsWith('word/_rels/') ||
              relativePath.startsWith('word/theme/') ||
              relativePath.startsWith('word/fontTable.xml') ||
              relativePath.startsWith('word/styles.xml') ||
              relativePath.startsWith('word/settings.xml')) {
            // Read the file content properly instead of using the file object directly
            preservePromises.push(
              file.async('nodebuffer').then(content => {
                zip.file(relativePath, content);
              })
            );
          }
        });
        
        // Wait for all file preservation operations to complete
        await Promise.all(preservePromises);
        
        const buffer = await zip.generateAsync({ type: 'nodebuffer' });
        fs.writeFileSync(filePath, buffer);
        return true;
      }
      
      // Fallback: use JSZip directly for plain text updates
      // Update document.xml with new content
      const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>${aiResult.content.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>')}</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;
      
      zip.file('word/document.xml', documentXml);
      
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });
      fs.writeFileSync(filePath, buffer);
      return true;
    } catch (err) {
      throw new Error(`DOCX update failed: ${err.message}`);
    }
  }

  async updatePptxWithAI(filePath, originalData, aiResult) {
    try {
      // Handle case where originalData is not provided (new file creation)
      if (!originalData || !originalData.zipData) {
        await this.writePptx(filePath, aiResult.content);
        return true;
      }
      
      // Ensure zipData is in proper format for JSZip
      const zipData = originalData.zipData.buffer ? originalData.zipData.buffer : originalData.zipData;
      const zip = await JSZip.loadAsync(zipData);
      
      // If we have updated XML structure from AI, serialize it back
      if (aiResult.xmlStructure) {
        // For PPTX, we need to update each slide XML
        const updatedSlides = aiResult.xmlStructure;
        
        // Update each slide XML in the ZIP
        for (let i = 0; i < updatedSlides.length; i++) {
          const slidePath = `ppt/slides/slide${i + 1}.xml`;
          if (zip.files[slidePath]) {
            const updatedSlideXml = this.xmlBuilder.buildObject(updatedSlides[i]);
            zip.file(slidePath, updatedSlideXml);
          }
        }
        
        // Preserve all media files and presentation structure
        const preservePromises = [];
        zip.forEach((relativePath, file) => {
          if (relativePath.startsWith('ppt/media/') || 
              relativePath.startsWith('ppt/theme/') ||
              relativePath.startsWith('ppt/slideMasters/') ||
              relativePath.startsWith('ppt/slideLayouts/') ||
              relativePath.startsWith('ppt/presentation.xml') ||
              relativePath.startsWith('ppt/_rels/')) {
            // Read the file content properly instead of using the file object directly
            preservePromises.push(
              file.async('nodebuffer').then(content => {
                zip.file(relativePath, content);
              })
            );
          }
        });
        
        // Wait for all file preservation operations to complete
        await Promise.all(preservePromises);
        
        const buffer = await zip.generateAsync({ type: 'nodebuffer' });
        fs.writeFileSync(filePath, buffer);
        return true;
      }
      
      // Fallback: use pptxgenjs for plain text updates
      const pptx = new pptxgen();
      const slideContents = aiResult.content.split(/\n\nSlide \d+:\n/).filter(Boolean);
      
      slideContents.forEach((content, index) => {
        const slide = pptx.addSlide();
        slide.addText(content, {
          x: 0.5,
          y: 0.5,
          w: 9,
          h: 6.5,
          fontSize: 12,
          align: 'left',
          valign: 'top'
        });
      });
      
      await pptx.writeFile(filePath);
      return true;
    } catch (err) {
      throw new Error(`PPTX update failed: ${err.message}`);
    }
  }

  async readPdf(filePath) {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      return { content: data.text, format: 'pdf' };
    } catch (err) {
      throw new Error(`PDF reading failed: ${err.message}`);
    }
  }

  readTxt(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return { content, format: 'txt' };
    } catch (err) {
      throw new Error(`TXT reading failed: ${err.message}`);
    }
  }

  readMarkdown(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return { content, format: 'md' };
    } catch (err) {
      throw new Error(`Markdown reading failed: ${err.message}`);
    }
  }

  async writeDocx(filePath, content) {
    // Use docxtemplater for proper DOCX generation
    const templatePath = path.join(__dirname, '../templates/default.docx');
    
    if (fs.existsSync(templatePath)) {
      // Use docxtemplater with PizZip for template-based generation
      const templateData = fs.readFileSync(templatePath);
      const zip = new PizZip(templateData);
      const doc = new Docxtemplater(zip);
      
      doc.setData({ content });
      doc.render();
      
      const buffer = doc.getZip().generate({ type: 'nodebuffer' });
      fs.writeFileSync(filePath, buffer);
    } else {
      // Fallback: create proper DOCX using JSZip with complete structure
      const zip = new JSZip();
      
      // Create proper document.xml with complete structure
      const escapedContent = content.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
      const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p>
      <w:r>
        <w:t>${escapedContent}</w:t>
      </w:r>
    </w:p>
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
      <w:cols w:space="720"/>
      <w:docGrid w:linePitch="360"/>
    </w:sectPr>
  </w:body>
</w:document>`;
      
      zip.file('word/document.xml', documentXml);
      
      // Create proper Content_Types.xml
      const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
      zip.file('[Content_Types].xml', contentTypesXml);
      
      // Create _rels/.rels file
      const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
      zip.file('_rels/.rels', relsXml);
      
      // Create word/_rels/document.xml.rels
      const documentRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
      zip.file('word/_rels/document.xml.rels', documentRelsXml);
      
      // Create word/styles.xml
      const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
</w:styles>`;
      zip.file('word/styles.xml', stylesXml);
      
      // Create word/settings.xml
      const settingsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:zoom w:percent="100"/>
</w:settings>`;
      zip.file('word/settings.xml', settingsXml);
      
      // Create word/fontTable.xml
      const fontTableXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:font w:name="Calibri">
    <w:panose1 w:val="020F0502020204030204"/>
    <w:charset w:val="00"/>
    <w:family w:val="swiss"/>
    <w:pitch w:val="variable"/>
    <w:sig w:usb0="E0002AFF" w:usb1="C000247B" w:usb2="00000009" w:usb3="00000000" w:csb0="000001FF" w:csb1="00000000"/>
  </w:font>
</w:fonts>`;
      zip.file('word/fontTable.xml', fontTableXml);
      
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });
      fs.writeFileSync(filePath, buffer);
    }
    return true;
  }

  async writePptx(filePath, content) {
    try {
      const pptx = new pptxgen();
      
      // Split content into slides based on markdown headers
      const slides = content.split(/(?=#+ )/).filter(Boolean);
      
      slides.forEach((slideContent, index) => {
        const slide = pptx.addSlide();
        const titleMatch = slideContent.match(/^#+ (.+)/);
        const title = titleMatch ? titleMatch[1] : `Slide ${index + 1}`;
        const body = slideContent.replace(/^#+ .+\n/, '').trim();
        
        slide.addText(title, {
          x: 0.5,
          y: 0.5,
          w: 9,
          h: 1,
          fontSize: 18,
          bold: true
        });
        
        if (body) {
          slide.addText(body, {
            x: 0.5,
            y: 1.5,
            w: 9,
            h: 5,
            fontSize: 12
          });
        }
      });
      
      await pptx.writeFile(filePath);
      return true;
    } catch (err) {
      throw new Error(`PPTX writing failed: ${err.message}`);
    }
  }

  writeHtml(filePath, content) {
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Document</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
           max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
    pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
  </style>
</head>
<body>
${this.converter.makeHtml(content)}
</body>
</html>`;
    fs.writeFileSync(filePath, html, 'utf-8');
  }

  scanSupportedFiles(root) {
    const out = [];
    const supportedExts = ['.md', '.txt', '.docx', '.pdf', '.pptx'];
    
    function walk(dir) {
      let entries = [];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) { walk(full); continue; }
        if (e.isFile()) {
          const ext = path.extname(full).toLowerCase();
          if (supportedExts.includes(ext)) {
            let stat = null;
            try { stat = fs.statSync(full); } catch { stat = { size: 0, mtimeMs: 0 }; }
            out.push({
              name: e.name,
              path: full,
              size: stat.size,
              mtime: stat.mtimeMs,
              format: ext.slice(1) // remove dot
            });
          }
        }
      }
    }
    walk(root);
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }

  async readFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    switch (ext) {
      case '.docx':
        return await this.readDocx(filePath);
      case '.pdf':
        return await this.readPdf(filePath);
      case '.pptx':
        return await this.readPptx(filePath);
      case '.txt':
        return this.readTxt(filePath);
      case '.md':
      default:
        return this.readMarkdown(filePath);
    }
  }

  async exportFile(filePath, aiResult, format, originalData = null) {
    switch (format) {
      case 'docx':
        if (originalData && originalData.format === 'docx') {
          await this.updateDocxWithAI(filePath, originalData, aiResult);
        } else {
          await this.writeDocx(filePath, aiResult.content);
        }
        break;
      case 'pptx':
        if (originalData && originalData.format === 'pptx') {
          await this.updatePptxWithAI(filePath, originalData, aiResult);
        } else {
          await this.writePptx(filePath, aiResult.content);
        }
        break;
      case 'html':
        this.writeHtml(filePath, aiResult.content);
        break;
      case 'txt':
        const plainText = aiResult.content.replace(/#{1,6}\s+/g, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
        fs.writeFileSync(filePath, plainText, 'utf-8');
        break;
      case 'md':
      default:
        fs.writeFileSync(filePath, aiResult.content, 'utf-8');
        break;
    }
  }
}

module.exports = FileHandler;
