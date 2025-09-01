const fs = require('fs');
const path = require('path');
const FileHandler = require('./src/main/services/file-handler');

async function testComprehensivePreservation() {
  console.log('=== Comprehensive Office File Preservation Test ===\n');
  
  const fileHandler = new FileHandler();

  // Create test directory
  const testDir = path.join(__dirname, 'test-preservation-files');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // Test content with various elements
  const testContent = `Document Title

This is a test document with various elements.

Section 1: Text Formatting
- Bold text and italic text
- Underlined text and strikethrough
- Code snippets and URLs: https://example.com

Section 2: Lists
1. Numbered list item 1
2. Numbered list item 2
3. Numbered list item 3

- Bullet list item 1
- Bullet list item 2
- Bullet list item 3

Section 3: Special Characters
- Quotes: "Hello world"
- Symbols: Copyright, Registered, Trademark
- Math: 2 squared = 4, pi approximately 3.14

Section 4: Long Content
This is a longer paragraph that should test how the system handles content that spans multiple lines and contains various punctuation marks, including commas, periods, exclamation points! And question marks?`;

  // Test 1: DOCX Preservation
  console.log('1. Testing DOCX Preservation...');
  await testDocxPreservation(fileHandler, testDir, testContent);
  
  // Test 2: PPTX Preservation  
  console.log('\n2. Testing PPTX Preservation...');
  await testPptxPreservation(fileHandler, testDir, testContent);
  
  console.log('\n=== Test Complete ===');
  console.log('\nPlease open the generated files in Microsoft Office applications');
  console.log('and verify they open without "unreadable content" warnings.');
}

async function testDocxPreservation(fileHandler, testDir, content) {
  const originalPath = path.join(testDir, 'docx-original.docx');
  console.log('   Creating original DOCX...');
  await fileHandler.writeDocx(originalPath, content);
  console.log('   ✓ Original DOCX created');

  // Read original DOCX
  console.log('   Reading original DOCX...');
  const originalData = await fileHandler.readDocx(originalPath);
  console.log('   ✓ Original DOCX read successfully');

  // Simulate AI processing with XML structure modification
  console.log('   Simulating AI processing...');
  const modifiedXml = JSON.parse(JSON.stringify(originalData.xmlStructure));
  
  // Modify some text content
  const modifyTextNodes = (obj) => {
    if (!obj) return;
    
    if (typeof obj === 'object') {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          if (key === 'w:t' && typeof obj[key] === 'string') {
            // Enhance some text
            obj[key] = obj[key]
              .replace('Document Title', 'Enhanced Document Title')
              .replace('test document', 'comprehensive test document')
              .replace('Various elements', 'Multiple document elements');
          }
          
          if (typeof obj[key] === 'object' && obj[key] !== null) {
            modifyTextNodes(obj[key]);
          }
        }
      }
    }
  };
  
  modifyTextNodes(modifiedXml);
  
  const aiResult = {
    content: content
      .replace('Document Title', 'Enhanced Document Title')
      .replace('test document', 'comprehensive test document')
      .replace('Various elements', 'Multiple document elements'),
    metadata: {
      responseTime: 1200,
      tokenUsage: { prompt: 150, completion: 80, total: 230 },
      model: 'gpt-4',
      mode: 'enhance',
      xmlAware: true
    },
    xmlStructure: modifiedXml
  };

  // Update DOCX with AI result
  const updatedPath = path.join(testDir, 'docx-updated.docx');
  console.log('   Updating DOCX with AI result...');
  await fileHandler.updateDocxWithAI(updatedPath, originalData, aiResult);
  console.log('   ✓ DOCX updated successfully');

  // Verify the update worked
  const updatedData = await fileHandler.readDocx(updatedPath);
  console.log('   ✓ Updated DOCX read successfully');
  console.log(`   Content modified: ${updatedData.content.includes('Enhanced Document Title')}`);

  // Check file sizes
  const originalStats = fs.statSync(originalPath);
  const updatedStats = fs.statSync(updatedPath);
  console.log(`   File sizes - Original: ${originalStats.size} bytes, Updated: ${updatedStats.size} bytes`);

  console.log('   ✓ DOCX preservation test completed');
}

async function testPptxPreservation(fileHandler, testDir, content) {
  const originalPath = path.join(testDir, 'pptx-original.pptx');
  console.log('   Creating original PPTX...');
  await fileHandler.writePptx(originalPath, content);
  console.log('   ✓ Original PPTX created');

  // Read original PPTX
  console.log('   Reading original PPTX...');
  const originalData = await fileHandler.readPptx(originalPath);
  console.log('   ✓ Original PPTX read successfully');

  // Simulate AI processing with XML structure modification
  console.log('   Simulating AI processing...');
  const modifiedSlides = JSON.parse(JSON.stringify(originalData.slides));
  
  // Modify slide content
  modifiedSlides.forEach(slide => {
    if (slide.xml && slide.xml['p:sld']) {
      const modifyPptxText = (obj) => {
        if (!obj) return;
        
        if (typeof obj === 'object') {
          for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
              if (key === 'a:t' && typeof obj[key] === 'string') {
                // Enhance slide titles
                obj[key] = obj[key]
                  .replace('Document Title', 'Enhanced Presentation')
                  .replace('Section', 'Enhanced Section');
              }
              
              if (typeof obj[key] === 'object' && obj[key] !== null) {
                modifyPptxText(obj[key]);
              }
            }
          }
        }
      };
      
      modifyPptxText(slide.xml['p:sld']);
    }
  });

  const aiResult = {
    content: content
      .replace('Document Title', 'Enhanced Presentation')
      .replace('Section', 'Enhanced Section'),
    metadata: {
      responseTime: 1000,
      tokenUsage: { prompt: 120, completion: 60, total: 180 },
      model: 'gpt-4',
      mode: 'enhance',
      xmlAware: true
    },
    xmlStructure: modifiedSlides.map(slide => slide.xml)
  };

  // Update PPTX with AI result
  const updatedPath = path.join(testDir, 'pptx-updated.pptx');
  console.log('   Updating PPTX with AI result...');
  await fileHandler.updatePptxWithAI(updatedPath, originalData, aiResult);
  console.log('   ✓ PPTX updated successfully');

  // Verify the update worked
  const updatedData = await fileHandler.readPptx(updatedPath);
  console.log('   ✓ Updated PPTX read successfully');
  console.log(`   Content modified: ${updatedData.content.includes('Enhanced Presentation')}`);

  // Check file sizes
  const originalStats = fs.statSync(originalPath);
  const updatedStats = fs.statSync(updatedPath);
  console.log(`   File sizes - Original: ${originalStats.size} bytes, Updated: ${updatedStats.size} bytes`);

  console.log('   ✓ PPTX preservation test completed');
}

testComprehensivePreservation().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
