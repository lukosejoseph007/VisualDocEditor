const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const xml2js = require('xml2js');

class DocxFormatter {
  constructor() {
    this.xmlParser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
    this.xmlBuilder = new xml2js.Builder();
  }

  /**
   * Creates a properly formatted DOCX document with proper paragraph structure
   */
  async createFormattedDocx(filePath, content) {
    const zip = new JSZip();
    
    // Split content into paragraphs based on double newlines
    const paragraphs = content.split(/\n\n+/).filter(p => p.trim());
    
    // Create proper document.xml with paragraph structure
    const documentXml = this.buildDocumentXml(paragraphs);
    
    zip.file('word/document.xml', documentXml);
    
    // Add all necessary supporting files
    this.addSupportingFiles(zip);
    
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    fs.writeFileSync(filePath, buffer);
    return true;
  }

  /**
   * Builds proper document.xml with paragraph structure
   */
  buildDocumentXml(paragraphs) {
    const paragraphXml = paragraphs.map(paragraph => {
      const escapedText = this.escapeXml(paragraph);
      return `
    <w:p>
      <w:r>
        <w:t>${escapedText}</w:t>
      </w:r>
    </w:p>`;
    }).join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
${paragraphXml}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
      <w:cols w:space="720"/>
      <w:docGrid w:linePitch="360"/>
    </w:sectPr>
  </w:body>
</w:document>`;
  }

  /**
   * Proper XML escaping function
   */
  escapeXml(text) {
    return text
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"')
      .replace(/'/g, ''');
  }

  /**
   * Adds all necessary supporting files for a valid DOCX
   */
  addSupportingFiles(zip) {
    // Content_Types.xml
    const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
    zip.file('[Content_Types].xml', contentTypesXml);

    // _rels/.rels
    const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
    zip.file('_rels/.rels', relsXml);

    // word/_rels/document.xml.rels
    const documentRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
    zip.file('word/_rels/document.xml.rels', documentRelsXml);

    // word/styles.xml
    const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
</w:styles>`;
    zip.file('word/styles.xml', stylesXml);

    // word/settings.xml
    const settingsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:zoom w:percent="100"/>
</w:settings>`;
    zip.file('word/settings.xml', settingsXml);

    // word/fontTable.xml
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
  }

  /**
   * Repairs malformed DOCX documents by recreating them with proper structure
   */
  async repairDocxStructure(inputPath, outputPath) {
    try {
      // Read the original content
      const data = fs.readFileSync(inputPath);
      const zip = await JSZip.loadAsync(data);
      
      // Extract text content
      const documentXml = await zip.file('word/document.xml').async('string');
      const result = await this.xmlParser.parseStringPromise(documentXml);
      
      // Extract text content
      const textContent = this.extractTextContent(result);
      
      // Create a new properly formatted document
      await this.createFormattedDocx(outputPath, textContent);
      
      return true;
    } catch (err) {
      throw new Error(`DOCX repair failed: ${err.message}`);
    }
  }

  /**
   * Extracts text content from XML structure
   */
  extractTextContent(xmlObj) {
    const extractText = (obj) => {
      if (!obj) return '';
      if (typeof obj === 'string') return obj;
      
      if (obj['w:t'] && typeof obj['w:t'] === 'string') {
        return obj['w:t'];
      }
      
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
}

module.exports = DocxFormatter;
