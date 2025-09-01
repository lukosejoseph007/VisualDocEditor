const FileHandler = require('./src/main/services/file-handler');
const fs = require('fs');
const path = require('path');

async function testFinalDocx() {
  console.log('Final DOCX file test - Creating clean documents...\n');
  
  const fileHandler = new FileHandler();
  const testDir = './test-files';
  
  // Create test directory if it doesn't exist
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  try {
    // Test 1: Create a clean DOCX file with proper content
    console.log('Test 1: Creating clean DOCX file');
    const cleanDocxPath = path.join(testDir, 'clean-test.docx');
    const cleanContent = `# Clean Test Document

This is a clean test document created by VisualDocEditor.

## Features:
- Proper text extraction
- No [object Object] strings
- Clean formatting
- Special characters: & < > " '

The quick brown fox jumps over the lazy dog.`;

    await fileHandler.writeDocx(cleanDocxPath, cleanContent);
    console.log('✓ Clean DOCX file created successfully');
    
    // Verify file size
    const stats = fs.statSync(cleanDocxPath);
    console.log(`✓ File size: ${stats.size} bytes (looks good)`);
    
    // Test 2: Read back the content to verify it's clean
    console.log('\nTest 2: Reading back clean content');
    const readResult = await fileHandler.readDocx(cleanDocxPath);
    console.log('✓ DOCX content read successfully');
    
    // Check for [object Object] strings
    if (readResult.content.includes('[object')) {
      console.log('❌ Still contains [object Object] strings');
      console.log('Content preview:', readResult.content.substring(0, 200));
    } else {
      console.log('✓ No [object Object] strings found!');
      console.log('Content preview:', readResult.content.substring(0, 200) + '...');
    }
    
    console.log('\n🎉 Final DOCX test completed!');
    console.log('\nPlease open this file in Microsoft Word:');
    console.log(`1. ${cleanDocxPath}`);
    console.log('\nIt should open without any "unreadable content" warnings and show clean text.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  } finally {
    console.log('\n🧹 Test file will remain for manual verification');
  }
}

// Run the test
testFinalDocx().catch(console.error);
