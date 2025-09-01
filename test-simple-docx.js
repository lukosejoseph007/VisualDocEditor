const DocxFormatter = require('./src/main/services/docx-formatter.js');
const formatter = new DocxFormatter();

async function testSimpleDocx() {
  console.log('=== Testing Simple DOCX Creation ===');
  
  const content = `This is a test document with special characters: & < > " '
  
Second paragraph with line breaks.

Third paragraph with URLs: https://example.com?param=value&other=test`;

  try {
    console.log('1. Creating DOCX with special characters...');
    await formatter.createFormattedDocx('./test-simple.docx', content);
    console.log('✓ DOCX created successfully');
    
    console.log('2. Testing XML escaping...');
    const escaped = formatter.escapeXml('test & < > " \' content');
    console.log('Escaped result:', escaped);
    
    console.log('=== Test Complete ===');
    console.log('Please check test-simple.docx for proper formatting');
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testSimpleDocx();
