const fs = require('fs');
const path = require('path');
const FileHandler = require('./src/main/services/file-handler');
const AIService = require('./src/main/services/ai-service');

async function testIntegration() {
  console.log('=== Integration Test: AI Service + File Handler ===\n');
  
  const fileHandler = new FileHandler();
  const aiService = new AIService();

  // Create test directory
  const testDir = path.join(__dirname, 'test-integration-files');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // Test content
  const testContent = `Document Analysis Report

This document contains important information about system performance.

Key Findings:
1. CPU utilization is within acceptable limits
2. Memory usage shows occasional spikes
3. Network throughput meets requirements

Recommendations:
- Monitor memory usage more closely
- Consider adding additional RAM
- Review network configuration for optimization

Conclusion:
The system is performing well overall, with minor areas for improvement.`;

  // Step 1: Create original DOCX
  const originalPath = path.join(testDir, 'integration-original.docx');
  console.log('1. Creating original DOCX...');
  await fileHandler.writeDocx(originalPath, testContent);
  console.log('✓ Original DOCX created');

  // Step 2: Read original DOCX
  console.log('\n2. Reading original DOCX...');
  const originalData = await fileHandler.readDocx(originalPath);
  console.log('✓ Original DOCX read successfully');
  console.log(`   Content length: ${originalData.content.length} characters`);
  console.log(`   Has XML structure: ${!!originalData.xmlStructure}`);

  // Step 3: Simulate AI processing with XML awareness
  console.log('\n3. Simulating AI processing...');
  
  // Mock AI response that includes XML structure awareness
  const mockAIResponse = {
    content: `Enhanced Document Analysis Report

This comprehensive document contains critical information about system performance metrics.

Key Findings:
1. CPU utilization remains within optimal operational limits
2. Memory usage demonstrates occasional performance spikes requiring attention
3. Network throughput consistently meets established requirements

Strategic Recommendations:
- Implement enhanced memory usage monitoring protocols
- Evaluate the addition of supplementary RAM capacity
- Conduct thorough network configuration review for performance optimization

Executive Conclusion:
The system demonstrates robust overall performance, with identified opportunities for strategic enhancement.`,
    metadata: {
      responseTime: 1500,
      tokenUsage: { prompt: 200, completion: 100, total: 300 },
      model: 'gpt-4',
      mode: 'enhance',
      xmlAware: true,
      thinkingProcess: '<thinking>Enhanced document structure while preserving original formatting elements</thinking>'
    },
    xmlStructure: JSON.parse(JSON.stringify(originalData.xmlStructure)) // Preserve structure
  };

  // Modify the XML structure to reflect AI enhancements
  const modifyXmlForAI = (xmlObj) => {
    if (!xmlObj) return;
    
    const modifyTextNodes = (obj) => {
      if (!obj) return;
      
      if (typeof obj === 'object') {
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            if (key === 'w:t' && typeof obj[key] === 'string') {
              // Apply AI enhancements to text content
              obj[key] = obj[key]
                .replace('Document Analysis Report', 'Enhanced Document Analysis Report')
                .replace('important information', 'critical information')
                .replace('system performance', 'system performance metrics')
                .replace('acceptable limits', 'optimal operational limits')
                .replace('occasional spikes', 'occasional performance spikes')
                .replace('meets requirements', 'consistently meets established requirements')
                .replace('more closely', 'enhanced monitoring protocols')
                .replace('additional RAM', 'supplementary RAM capacity')
                .replace('network configuration', 'network configuration review')
                .replace('performing well', 'demonstrates robust performance')
                .replace('minor areas', 'identified opportunities');
            }
            
            if (typeof obj[key] === 'object' && obj[key] !== null) {
              modifyTextNodes(obj[key]);
            }
          }
        }
      }
    };
    
    modifyTextNodes(xmlObj);
  };

  modifyXmlForAI(mockAIResponse.xmlStructure);
  console.log('✓ AI processing simulated with XML structure preservation');

  // Step 4: Update DOCX with AI result
  const updatedPath = path.join(testDir, 'integration-updated.docx');
  console.log('\n4. Updating DOCX with AI result...');
  await fileHandler.updateDocxWithAI(updatedPath, originalData, mockAIResponse);
  console.log('✓ DOCX updated with AI content');

  // Step 5: Verify the update
  console.log('\n5. Verifying the update...');
  const updatedData = await fileHandler.readDocx(updatedPath);
  console.log('✓ Updated DOCX read successfully');
  console.log(`   Updated content length: ${updatedData.content.length} characters`);

  // Check if AI enhancements are present
  const enhancements = [
    'Enhanced Document Analysis Report',
    'critical information',
    'system performance metrics',
    'optimal operational limits',
    'performance spikes',
    'established requirements',
    'monitoring protocols',
    'supplementary RAM capacity',
    'strategic enhancement'
  ];

  enhancements.forEach(enhancement => {
    console.log(`   "${enhancement}": ${updatedData.content.includes(enhancement)}`);
  });

  // Step 6: Check file integrity
  console.log('\n6. Checking file integrity...');
  const originalStats = fs.statSync(originalPath);
  const updatedStats = fs.statSync(updatedPath);
  console.log(`   Original file size: ${originalStats.size} bytes`);
  console.log(`   Updated file size:  ${updatedStats.size} bytes`);
  console.log(`   Size difference:    ${updatedStats.size - originalStats.size} bytes`);

  console.log('\n=== Integration Test Complete ===');
  console.log('\nPlease open these files in Microsoft Word:');
  console.log(`1. ${originalPath}`);
  console.log(`2. ${updatedPath}`);
  console.log('\nVerify that:');
  console.log('1. The updated file opens without corruption warnings');
  console.log('2. The content enhancements are visible');
  console.log('3. The document formatting is preserved');
}

testIntegration().catch(err => {
  console.error('Integration test failed:', err);
  process.exit(1);
});
