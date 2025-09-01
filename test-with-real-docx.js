const fs = require('fs');
const path = require('path');
const FileHandler = require('./src/main/services/file-handler');

async function testWithRealDocx() {
  console.log('=== Testing with Real Word Document ===\n');
  
  const fileHandler = new FileHandler();

  // Create test directory
  const testDir = path.join(__dirname, 'test-real-files');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // Step 1: Copy the user's sample document to test directory
  const samplePath = path.join(testDir, 'user-sample.docx');
  const userSamplePath = 'c:/Users/SRINSHA/Downloads/sample word.docx';
  
  console.log('1. Copying user sample document...');
  try {
    if (fs.existsSync(userSamplePath)) {
      fs.copyFileSync(userSamplePath, samplePath);
      console.log('✓ User sample document copied');
    } else {
      console.log('❌ User sample document not found, creating test document');
      // Create a test document if user sample doesn't exist
      const testContent = `Key: ScreenShot (SS) different - may need attention

ScreenShot (SS) a little different - probably does not need attention.

Change all 20.3 or 20.3.x references to 23.4.

Slide 18 change URL to this: https://techdocs.example.com/slide18

Slide 54 License no longer needed in 23.4

Slide 61 OC Landing Page different.

ScreenShot (SS) different

Slide 77 SS a little different.

Slide 91 SS different. Setup Wizard under Inventory Management now.

SS a little different.

Slide 121 SS a little different.

Slide 124,126,131-134 SS a little different

Slide 182-183,191-194,196,205-206`;
      await fileHandler.writeDocx(samplePath, testContent);
      console.log('✓ Test document created');
    }
  } catch (err) {
    console.log('❌ Could not access user document, creating test document');
    const testContent = `Key: ScreenShot (SS) different - may need attention

ScreenShot (SS) a little different - probably does not need attention.

Change all 20.3 or 20.3.x references to 23.4.`;
    await fileHandler.writeDocx(samplePath, testContent);
    console.log('✓ Test document created');
  }

  // Step 2: Read the document and analyze structure
  console.log('\n2. Reading document structure...');
  const originalData = await fileHandler.readDocx(samplePath);
  console.log('✓ Document read successfully');
  console.log(`   Content length: ${originalData.content.length} characters`);
  console.log(`   Has XML structure: ${!!originalData.xmlStructure}`);

  // Step 3: Analyze the XML structure in detail
  console.log('\n3. Analyzing XML structure in detail...');
  
  if (originalData.xmlStructure && originalData.xmlStructure['w:document']) {
    const document = originalData.xmlStructure['w:document'];
    
    if (document['w:body']) {
      const body = document['w:body'];
      
      if (body['w:p']) {
        const paragraphs = Array.isArray(body['w:p']) ? body['w:p'] : [body['w:p']];
        console.log(`Number of paragraphs: ${paragraphs.length}`);
        
        paragraphs.forEach((paragraph, index) => {
          console.log(`\nParagraph ${index + 1}:`);
          console.log('Paragraph keys:', Object.keys(paragraph));
          
          if (paragraph['w:r']) {
            const runs = Array.isArray(paragraph['w:r']) ? paragraph['w:r'] : [paragraph['w:r']];
            console.log(`  Number of runs: ${runs.length}`);
            
            runs.forEach((run, runIndex) => {
              console.log(`  Run ${runIndex + 1} keys:`, Object.keys(run));
              
              if (run['w:t']) {
                const texts = Array.isArray(run['w:t']) ? run['w:t'] : [run['w:t']];
                console.log(`    Number of text elements: ${texts.length}`);
                
                texts.forEach((text, textIndex) => {
                  if (typeof text === 'string') {
                    console.log(`    Text ${textIndex + 1}: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
                  } else {
                    console.log(`    Text ${textIndex + 1}: [${typeof text}]`);
                  }
                });
              }
            });
          }
        });
      }
    }
  }

  // Step 4: Simulate AI processing with proper XML modification
  console.log('\n4. Simulating AI processing with XML structure modification...');
  
  const modifiedXml = JSON.parse(JSON.stringify(originalData.xmlStructure));
  
  // Modify specific text content while preserving structure
  const modifyTextNodes = (obj) => {
    if (!obj) return;
    
    if (typeof obj === 'object') {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          if (key === 'w:t' && typeof obj[key] === 'string') {
            // Only modify specific text patterns
            if (obj[key].includes('may need attention')) {
              obj[key] = obj[key].replace('may need attention', 'REQUIRES ATTENTION');
            }
            if (obj[key].includes('probably does not need attention')) {
              obj[key] = obj[key].replace('probably does not need attention', 'LIKELY ACCEPTABLE');
            }
            if (obj[key].includes('slide18')) {
              obj[key] = obj[key].replace('slide18', 'slide18-updated');
            }
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

  // Step 5: Update document with AI result
  const updatedPath = path.join(testDir, 'real-updated.docx');
  console.log('\n5. Updating document with AI result...');
  
  const aiResult = {
    content: originalData.content
      .replace('may need attention', 'REQUIRES ATTENTION')
      .replace('probably does not need attention', 'LIKELY ACCEPTABLE')
      .replace('slide18', 'slide18-updated'),
    metadata: {
      responseTime: 1200,
      tokenUsage: { prompt: 150, completion: 80, total: 230 },
      model: 'gpt-4',
      mode: 'enhance',
      xmlAware: true
    },
    xmlStructure: modifiedXml
  };
  
  await fileHandler.updateDocxWithAI(updatedPath, originalData, aiResult);
  console.log('✓ Document updated with AI content');

  // Step 6: Verify the update
  console.log('\n6. Verifying the update...');
  const updatedData = await fileHandler.readDocx(updatedPath);
  console.log('✓ Updated document read successfully');
  console.log(`   Updated content length: ${updatedData.content.length} characters`);

  // Check if AI enhancements are present
  const enhancements = [
    'REQUIRES ATTENTION',
    'LIKELY ACCEPTABLE', 
    'slide18-updated'
  ];

  enhancements.forEach(enhancement => {
    console.log(`   "${enhancement}": ${updatedData.content.includes(enhancement)}`);
  });

  // Step 7: Check file integrity
  console.log('\n7. Checking file integrity...');
  const originalStats = fs.statSync(samplePath);
  const updatedStats = fs.statSync(updatedPath);
  console.log(`   Original file size: ${originalStats.size} bytes`);
  console.log(`   Updated file size:  ${updatedStats.size} bytes`);
  console.log(`   Size difference:    ${updatedStats.size - originalStats.size} bytes`);

  console.log('\n=== Test Complete ===');
  console.log('\nPlease open these files in Microsoft Word:');
  console.log(`1. ${samplePath}`);
  console.log(`2. ${updatedPath}`);
  console.log('\nCheck if:');
  console.log('1. Formatting is preserved (paragraph structure, line breaks)');
  console.log('2. No "unreadable content" warnings appear');
  console.log('3. AI enhancements are visible');
  console.log('4. The document looks properly formatted');
}

testWithRealDocx().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
