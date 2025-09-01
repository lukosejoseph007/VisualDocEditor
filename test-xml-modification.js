const fs = require('fs');
const path = require('path');
const FileHandler = require('./src/main/services/file-handler');

async function testXmlModification() {
  console.log('=== Testing XML Structure Modification ===\n');
  
  const fileHandler = new FileHandler();

  // Create test directory
  const testDir = path.join(__dirname, 'test-xml-files');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // Test document content
  const testContent = `Key: ScreenShot (SS) different - may need attention

ScreenShot (SS) a little different - probably does not need attention.

Change all 20.3 or 20.3.x references to 23.4.

Slide 18 change URL to this: https://techdocs.broadcom.com/us/en/ca-enterprise-software/it-operations-management/unified-infrastructure-management/23-4/getting-started/ca-uim-overview/ca-uim-architecture.html

Slide 27 change URL to this: https://techdocs.broadcom.com/us/en/ca-enterprise-software/it-operations-management/unified-infrastructure-management/23-4/getting-started/ca-uim-overview/ca-uim-architecture.html`;

  // Step 1: Create original DOCX
  const originalPath = path.join(testDir, 'original.docx');
  console.log('1. Creating original DOCX file...');
  await fileHandler.writeDocx(originalPath, testContent);
  console.log('✓ Original DOCX created');

  // Step 2: Read original DOCX
  console.log('\n2. Reading original DOCX...');
  const originalData = await fileHandler.readDocx(originalPath);
  console.log('✓ Original DOCX read successfully');
  console.log(`   Content length: ${originalData.content.length} characters`);
  console.log(`   Has XML structure: ${!!originalData.xmlStructure}`);

  // Step 3: Modify XML structure to simulate AI processing
  console.log('\n3. Modifying XML structure...');
  
  // Deep clone the XML structure to avoid modifying the original
  const modifiedXml = JSON.parse(JSON.stringify(originalData.xmlStructure));
  
  // Find and modify text nodes to simulate AI enhancement
  const modifyTextNodes = (obj) => {
    if (!obj) return;
    
    if (typeof obj === 'object') {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          // Modify text content
          if (key === 'w:t' && typeof obj[key] === 'string') {
            // Simulate AI enhancement - add some improvements
            obj[key] = obj[key].replace('ScreenShot', 'Screenshot')
                              .replace('may need attention', 'requires attention')
                              .replace('probably does not need attention', 'likely acceptable');
          }
          
          // Recursively process nested objects
          if (typeof obj[key] === 'object' && obj[key] !== null) {
            modifyTextNodes(obj[key]);
          }
        }
      }
    }
  };
  
  modifyTextNodes(modifiedXml);
  
  // Create AI result with modified XML
  const aiResult = {
    content: originalData.content.replace('ScreenShot', 'Screenshot')
                                .replace('may need attention', 'requires attention')
                                .replace('probably does not need attention', 'likely acceptable'),
    metadata: {
      responseTime: 1000,
      tokenUsage: { prompt: 100, completion: 50, total: 150 },
      model: 'gpt-3.5-turbo',
      mode: 'improve',
      thinkingProcess: '<thinking>Simulated AI enhancement</thinking>',
      xmlAware: true
    },
    xmlStructure: modifiedXml
  };
  
  console.log('✓ XML structure modified');
  console.log(`   AI content length: ${aiResult.content.length} characters`);

  // Step 4: Update DOCX with AI result
  const updatedPath = path.join(testDir, 'updated.docx');
  console.log('\n4. Updating DOCX with AI result...');
  await fileHandler.updateDocxWithAI(updatedPath, originalData, aiResult);
  console.log('✓ DOCX updated with AI content');

  // Step 5: Read updated DOCX
  console.log('\n5. Reading updated DOCX...');
  const updatedData = await fileHandler.readDocx(updatedPath);
  console.log('✓ Updated DOCX read successfully');
  console.log(`   Updated content length: ${updatedData.content.length} characters`);

  // Step 6: Compare content
  console.log('\n6. Comparing content...');
  console.log('Original content preview:');
  console.log(originalData.content.substring(0, 200) + '...');
  console.log('\nUpdated content preview:');
  console.log(updatedData.content.substring(0, 200) + '...');

  // Step 7: Check file sizes
  const originalStats = fs.statSync(originalPath);
  const updatedStats = fs.statSync(updatedPath);
  console.log(`\n7. File sizes:`);
  console.log(`   Original: ${originalStats.size} bytes`);
  console.log(`   Updated:  ${updatedStats.size} bytes`);

  // Step 8: Check if content was actually modified
  console.log(`\n8. Content modifications:`);
  console.log(`   Screenshot -> Screenshot: ${updatedData.content.includes('Screenshot')}`);
  console.log(`   requires attention: ${updatedData.content.includes('requires attention')}`);
  console.log(`   likely acceptable: ${updatedData.content.includes('likely acceptable')}`);

  console.log('\n=== Test Complete ===');
  console.log('\nPlease try opening these files in Microsoft Word:');
  console.log(`1. ${originalPath}`);
  console.log(`2. ${updatedPath}`);
  console.log('\nCheck if the updated file opens without "unreadable content" warnings.');
}

testXmlModification().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
