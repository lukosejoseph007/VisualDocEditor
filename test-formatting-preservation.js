const fs = require('fs');
const path = require('path');
const FileHandler = require('./src/main/services/file-handler');

async function testFormattingPreservation() {
  console.log('=== Testing Formatting Preservation ===\n');
  
  const fileHandler = new FileHandler();

  // Create test directory
  const testDir = path.join(__dirname, 'test-formatting-files');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // Test content with various formatting elements
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

  // Step 1: Create original DOCX
  const originalPath = path.join(testDir, 'formatting-original.docx');
  console.log('1. Creating original DOCX...');
  await fileHandler.writeDocx(originalPath, testContent);
  console.log('✓ Original DOCX created');

  // Step 2: Read original DOCX and analyze structure
  console.log('\n2. Reading original DOCX...');
  const originalData = await fileHandler.readDocx(originalPath);
  console.log('✓ Original DOCX read successfully');
  console.log(`   Content length: ${originalData.content.length} characters`);
  console.log(`   Has XML structure: ${!!originalData.xmlStructure}`);

  // Step 3: Analyze XML structure
  console.log('\n3. Analyzing XML structure...');
  analyzeXmlStructure(originalData.xmlStructure);

  // Step 4: Simulate AI processing with proper formatting preservation
  console.log('\n4. Simulating AI processing with formatting preservation...');
  
  const aiResult = {
    content: `Key: ScreenShot (SS) different - requires attention

ScreenShot (SS) a little different - likely acceptable.

Change all 20.3 or 20.3.x references to 23.4.

Slide 18 change URL to this: https://techdocs.example.com/slide18-updated

Slide 54 License no longer needed in 23.4

Slide 61 OC Landing Page different.

ScreenShot (SS) different

Slide 77 SS a little different.

Slide 91 SS different. Setup Wizard under Inventory Management now.

SS a little different.

Slide 121 SS a little different.

Slide 124,126,131-134 SS a little different

Slide 182-183,191-194,196,205-206`,
    metadata: {
      responseTime: 1200,
      tokenUsage: { prompt: 150, completion: 80, total: 230 },
      model: 'gpt-4',
      mode: 'enhance',
      xmlAware: true
    },
    xmlStructure: JSON.parse(JSON.stringify(originalData.xmlStructure)) // Preserve structure
  };

  // Step 5: Update DOCX with AI result
  const updatedPath = path.join(testDir, 'formatting-updated.docx');
  console.log('\n5. Updating DOCX with AI result...');
  await fileHandler.updateDocxWithAI(updatedPath, originalData, aiResult);
  console.log('✓ DOCX updated with AI content');

  // Step 6: Verify the update
  console.log('\n6. Verifying the update...');
  const updatedData = await fileHandler.readDocx(updatedPath);
  console.log('✓ Updated DOCX read successfully');
  console.log(`   Updated content length: ${updatedData.content.length} characters`);

  // Check if AI enhancements are present
  const enhancements = [
    'requires attention',
    'likely acceptable',
    'slide18-updated'
  ];

  enhancements.forEach(enhancement => {
    console.log(`   "${enhancement}": ${updatedData.content.includes(enhancement)}`);
  });

  console.log('\n=== Formatting Test Complete ===');
  console.log('\nPlease open these files in Microsoft Word:');
  console.log(`1. ${originalPath}`);
  console.log(`2. ${updatedPath}`);
  console.log('\nCheck if:');
  console.log('1. Formatting is preserved (line breaks, spacing, etc.)');
  console.log('2. No "unreadable content" warnings appear');
  console.log('3. AI enhancements are visible');
}

function analyzeXmlStructure(xmlObj, depth = 0, path = '') {
  if (!xmlObj || depth > 5) return; // Limit depth to avoid excessive output
  
  const indent = '  '.repeat(depth);
  
  if (typeof xmlObj === 'object') {
    for (const key in xmlObj) {
      if (xmlObj.hasOwnProperty(key)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (key === 'w:t' && typeof xmlObj[key] === 'string') {
          console.log(`${indent}${currentPath}: "${xmlObj[key].substring(0, 50)}..."`);
        } else if (key === 'w:p' || key === 'w:r' || key === 'w:body') {
          console.log(`${indent}${currentPath}: [structure]`);
        } else if (typeof xmlObj[key] === 'object' && xmlObj[key] !== null) {
          if (Object.keys(xmlObj[key]).length > 0) {
            console.log(`${indent}${currentPath}:`);
            analyzeXmlStructure(xmlObj[key], depth + 1, currentPath);
          }
        }
      }
    }
  }
}

testFormattingPreservation().catch(err => {
  console.error('Formatting test failed:', err);
  process.exit(1);
});
