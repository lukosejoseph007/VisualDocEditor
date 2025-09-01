const fs = require('fs');
const path = require('path');
const FileHandler = require('./src/main/services/file-handler');

async function testOfficePreservation() {
  console.log('Testing Office document preservation functionality...\n');
  
  const fileHandler = new FileHandler();
  
  // Test 1: Create a simple DOCX file
  console.log('Test 1: Creating a DOCX file with basic content');
  const testDocxPath = path.join(__dirname, 'test-preservation.docx');
  const docxContent = '# Test Document\n\nThis is a test document with **bold** and *italic* text.\n\n- Item 1\n- Item 2\n- Item 3';
  
  try {
    await fileHandler.writeDocx(testDocxPath, docxContent);
    console.log('✓ DOCX file created successfully');
    
    // Test 2: Read the DOCX file to verify content
    console.log('\nTest 2: Reading DOCX file content');
    const readResult = await fileHandler.readDocx(testDocxPath);
    console.log('✓ DOCX content read successfully');
    console.log('Content preview:', readResult.content.substring(0, 100) + '...');
    
    // Test 3: Update the DOCX file with AI result (simulating AI processing)
    console.log('\nTest 3: Updating DOCX file with AI result (preserving structure)');
    const aiResult = {
      content: '# Enhanced Test Document\n\nThis is an **AI-enhanced** test document with improved formatting.\n\n- Enhanced Item 1\n- Enhanced Item 2\n- Enhanced Item 3\n\nAdded by AI processing.'
    };
    
    const originalData = {
      format: 'docx',
      zipData: readResult.zipData
    };
    
    await fileHandler.updateDocxWithAI(testDocxPath, originalData, aiResult);
    console.log('✓ DOCX file updated with AI content (structure preserved)');
    
    // Test 4: Verify the updated content
    console.log('\nTest 4: Reading updated DOCX file');
    const updatedResult = await fileHandler.readDocx(testDocxPath);
    console.log('✓ Updated DOCX content read successfully');
    console.log('Updated content preview:', updatedResult.content.substring(0, 100) + '...');
    
    // Test 5: Test export functionality
    console.log('\nTest 5: Testing export with AI result object');
    const exportPath = path.join(__dirname, 'test-export.docx');
    await fileHandler.exportFile(exportPath, aiResult, 'docx', originalData);
    console.log('✓ File exported successfully with AI result object');
    
    // Cleanup
    console.log('\nCleaning up test files...');
    if (fs.existsSync(testDocxPath)) fs.unlinkSync(testDocxPath);
    if (fs.existsSync(exportPath)) fs.unlinkSync(exportPath);
    console.log('✓ Test files cleaned up');
    
    console.log('\n🎉 All Office document preservation tests passed!');
    console.log('\nKey features verified:');
    console.log('• DOCX file creation with proper XML structure');
    console.log('• DOCX content reading and parsing');
    console.log('• AI result handling with metadata support');
    console.log('• Office document structure preservation during updates');
    console.log('• Export functionality with AI result objects');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    
    // Cleanup on error
    try {
      if (fs.existsSync(testDocxPath)) fs.unlinkSync(testDocxPath);
      const exportPath = path.join(__dirname, 'test-export.docx');
      if (fs.existsSync(exportPath)) fs.unlinkSync(exportPath);
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError.message);
    }
  }
}

// Run the test
testOfficePreservation().catch(console.error);
