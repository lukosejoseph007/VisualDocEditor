const fs = require('fs');
const path = require('path');
const DocxFormatter = require('./src/main/services/docx-formatter');

async function testDocxFormatter() {
  console.log('=== Testing DOCX Formatter ===\n');
  
  const formatter = new DocxFormatter();

  // Create test directory
  const testDir = path.join(__dirname, 'test-formatter-files');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // Test content with proper paragraph structure
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

  // Step 1: Create properly formatted DOCX
  const formattedPath = path.join(testDir, 'formatted.docx');
  console.log('1. Creating properly formatted DOCX...');
  await formatter.createFormattedDocx(formattedPath, testContent);
  console.log('✓ Formatted DOCX created');

  // Step 2: Read and analyze the formatted document
  console.log('\n2. Reading formatted document...');
  const data = fs.readFileSync(formattedPath);
  const zip = await require('jszip').loadAsync(data);
  const documentXml = await zip.file('word/document.xml').async('string');
  console.log('✓ Document XML extracted');
  
  // Count paragraphs in XML
  const paragraphCount = (documentXml.match(/<w:p>/g) || []).length;
  console.log(`   Number of paragraphs: ${paragraphCount}`);
  
  // Check if content is properly escaped
  const hasAmpersands = documentXml.includes('&');
  const hasLtGt = documentXml.includes('<') || documentXml.includes('>');
  console.log(`   Proper XML escaping: ${hasAmpersands && !hasLtGt}`);

  // Step 3: Test repair functionality
  console.log('\n3. Testing repair functionality...');
  const repairPath = path.join(testDir, 'repaired.docx');
  await formatter.repairDocxStructure(formattedPath, repairPath);
  console.log('✓ Document repaired');

  // Step 4: Verify repair
  console.log('\n4. Verifying repair...');
  const repairData = fs.readFileSync(repairPath);
  const repairZip = await require('jszip').loadAsync(repairData);
  const repairXml = await repairZip.file('word/document.xml').async('string');
  const repairParagraphCount = (repairXml.match(/<w:p>/g) || []).length;
  console.log(`   Repaired paragraphs: ${repairParagraphCount}`);
  console.log(`   Repair successful: ${repairParagraphCount === paragraphCount}`);

  console.log('\n=== Test Complete ===');
  console.log('\nPlease open these files in Microsoft Word:');
  console.log(`1. ${formattedPath}`);
  console.log(`2. ${repairPath}`);
  console.log('\nCheck if:');
  console.log('1. Documents open without "unreadable content" warnings');
  console.log('2. Paragraph structure is preserved');
  console.log('3. Formatting looks correct');
}

testDocxFormatter().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
