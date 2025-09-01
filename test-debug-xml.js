const fs = require('fs');
const path = require('path');
const FileHandler = require('./src/main/services/file-handler');

async function debugXmlStructure() {
  console.log('=== Debugging XML Structure ===\n');
  
  const fileHandler = new FileHandler();

  // Create test directory
  const testDir = path.join(__dirname, 'test-debug-files');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // Test content
  const testContent = `Key: ScreenShot (SS) different - may need attention

ScreenShot (SS) a little different - probably does not need attention.

Change all 20.3 or 20.3.x references to 23.4.`;

  // Step 1: Create original DOCX
  const originalPath = path.join(testDir, 'debug-original.docx');
  console.log('1. Creating original DOCX...');
  await fileHandler.writeDocx(originalPath, testContent);
  console.log('✓ Original DOCX created');

  // Step 2: Read original DOCX and analyze structure
  console.log('\n2. Reading original DOCX...');
  const originalData = await fileHandler.readDocx(originalPath);
  console.log('✓ Original DOCX read successfully');
  console.log(`   Content length: ${originalData.content.length} characters`);
  console.log(`   Has XML structure: ${!!originalData.xmlStructure}`);

  // Step 3: Deep analyze XML structure
  console.log('\n3. Deep analyzing XML structure...');
  console.log('XML structure type:', typeof originalData.xmlStructure);
  console.log('XML structure keys:', Object.keys(originalData.xmlStructure || {}));
  
  if (originalData.xmlStructure) {
    // Check if we have the document structure
    if (originalData.xmlStructure['w:document']) {
      console.log('Found w:document structure');
      const document = originalData.xmlStructure['w:document'];
      console.log('Document keys:', Object.keys(document));
      
      if (document['w:body']) {
        console.log('Found w:body structure');
        const body = document['w:body'];
        console.log('Body keys:', Object.keys(body));
        
        if (body['w:p']) {
          console.log('Found w:p (paragraph) structure');
          const paragraphs = Array.isArray(body['w:p']) ? body['w:p'] : [body['w:p']];
          console.log(`Number of paragraphs: ${paragraphs.length}`);
          
          paragraphs.forEach((paragraph, index) => {
            console.log(`\nParagraph ${index + 1}:`);
            console.log('Paragraph keys:', Object.keys(paragraph));
            
            if (paragraph['w:r']) {
              const runs = Array.isArray(paragraph['w:r']) ? paragraph['w:r'] : [paragraph['w:r']];
              console.log(`Number of runs: ${runs.length}`);
              
              runs.forEach((run, runIndex) => {
                console.log(`  Run ${runIndex + 1} keys:`, Object.keys(run));
                
                if (run['w:t']) {
                  const texts = Array.isArray(run['w:t']) ? run['w:t'] : [run['w:t']];
                  console.log(`  Number of text elements: ${texts.length}`);
                  
                  texts.forEach((text, textIndex) => {
                    console.log(`    Text ${textIndex + 1}:`, typeof text === 'string' ? `"${text}"` : `[${typeof text}]`);
                  });
                }
              });
            }
          });
        }
      }
    }
  }

  // Step 4: Try to modify the XML structure
  console.log('\n4. Attempting to modify XML structure...');
  if (originalData.xmlStructure && originalData.xmlStructure['w:document']) {
    const modifiedXml = JSON.parse(JSON.stringify(originalData.xmlStructure));
    
    // Try to modify some text content
    const modifyTextNodes = (obj) => {
      if (!obj) return;
      
      if (typeof obj === 'object') {
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            if (key === 'w:t' && typeof obj[key] === 'string') {
              console.log(`Found text node: "${obj[key]}"`);
              // Modify the text
              obj[key] = obj[key]
                .replace('may need attention', 'REQUIRES ATTENTION')
                .replace('probably does not need attention', 'LIKELY ACCEPTABLE');
            }
            
            if (typeof obj[key] === 'object' && obj[key] !== null) {
              modifyTextNodes(obj[key]);
            }
          }
        }
      }
    };
    
    modifyTextNodes(modifiedXml);
    console.log('✓ XML structure modified');
    
    // Step 5: Update DOCX with modified XML
    const updatedPath = path.join(testDir, 'debug-updated.docx');
    console.log('\n5. Updating DOCX with modified XML...');
    
    const aiResult = {
      content: testContent
        .replace('may need attention', 'REQUIRES ATTENTION')
        .replace('probably does not need attention', 'LIKELY ACCEPTABLE'),
      metadata: {
        responseTime: 1000,
        tokenUsage: { prompt: 100, completion: 50, total: 150 },
        model: 'gpt-4',
        mode: 'enhance',
        xmlAware: true
      },
      xmlStructure: modifiedXml
    };
    
    await fileHandler.updateDocxWithAI(updatedPath, originalData, aiResult);
    console.log('✓ DOCX updated with modified XML');
    
    // Step 6: Verify the update
    console.log('\n6. Verifying the update...');
    const updatedData = await fileHandler.readDocx(updatedPath);
    console.log('✓ Updated DOCX read successfully');
    console.log(`   Updated content length: ${updatedData.content.length} characters`);
    console.log(`   Content contains "REQUIRES ATTENTION": ${updatedData.content.includes('REQUIRES ATTENTION')}`);
    console.log(`   Content contains "LIKELY ACCEPTABLE": ${updatedData.content.includes('LIKELY ACCEPTABLE')}`);
  }

  console.log('\n=== Debug Complete ===');
}

debugXmlStructure().catch(err => {
  console.error('Debug failed:', err);
  process.exit(1);
});
