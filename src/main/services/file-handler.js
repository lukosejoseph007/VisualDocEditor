const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const JSZip = require('jszip');
const xml2js = require('xml2js');
const officegen = require('officegen');
const TurndownService = require('turndown');
const showdown = require('showdown');
const pptxgen = require('pptxgenjs');

class FileHandler {
  constructor() {
    this.turndownService = new TurndownService();
    this.converter = new showdown.Converter();
  }

  async readDocx(filePath) {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      return { content: result.value, format: 'docx' };
    } catch (err) {
      throw new Error(`DOCX reading failed: ${err.message}`);
    }
  }

  async readPptx(filePath) {
    try {
      const content = await this.extractTextFromPPTX(filePath);
      return { content, format: 'pptx' };
    } catch (err) {
      throw new Error(`PPTX reading failed: ${err.message}`);
    }
  }

  async extractTextFromPPTX(filePath) {
    const data = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(data);
    
    let textContent = [];
    let slideCount = 0;
    
    // Find all slide files
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
      const parser = new xml2js.Parser();
      const result = await parser.parseStringPromise(slideContent);
      
      // Extract text from slide
      const extractText = (obj) => {
        if (typeof obj === 'string') return obj;
        if (obj['a:t']) return obj['a:t'].map(t => t._ || t).join(' ');
        if (obj['a:r']) return obj['a:r'].map(extractText).join(' ');
        if (obj['a:p']) return obj['a:p'].map(extractText).join('\n');
        return Object.values(obj).map(extractText).join(' ');
      };

      const slideText = extractText(result);
      textContent.push(`Slide ${i}:\n${slideText}\n`);
    }

    return textContent.join('\n');
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
    return new Promise((resolve, reject) => {
      const docx = officegen('docx');
      
      // Convert markdown to plain text for now (basic implementation)
      const plainText = this.turndownService.turndown(content);
      
      const pObj = docx.createP();
      pObj.addText(plainText);
      
      const output = fs.createWriteStream(filePath);
      docx.generate(output);
      
      output.on('close', () => resolve(true));
      output.on('error', reject);
    });
  }

  async writePptx(filePath, content) {
    try {
      const pptx = new pptxgen();
      
      // Create a slide and add the content as text
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

  async exportFile(filePath, content, format) {
    switch (format) {
      case 'docx':
        await this.writeDocx(filePath, content);
        break;
      case 'pptx':
        await this.writePptx(filePath, content);
        break;
      case 'html':
        this.writeHtml(filePath, content);
        break;
      case 'txt':
        // Convert markdown to plain text
        const plainText = content.replace(/#{1,6}\s+/g, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
        fs.writeFileSync(filePath, plainText, 'utf-8');
        break;
      case 'md':
      default:
        fs.writeFileSync(filePath, content, 'utf-8');
        break;
    }
  }
}

module.exports = FileHandler;
