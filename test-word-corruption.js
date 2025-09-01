const fs = require('fs');
const path = require('path');
const FileHandler = require('./src/main/services/file-handler');
const AIService = require('./src/main/services/ai-service');

async function testWordCorruption() {
  console.log('=== Testing Word Document Corruption Issue ===\n');
  
  const fileHandler = new FileHandler();
  const aiService = new AIService({ 
    trackOperation: () => Promise.resolve('test-op'),
    completeOperation: () => Promise.resolve(),
    getCurrentSession: () => ({ id: 'test-session' }),
    updateContextSize: () => Promise.resolve()
  });

  // Create test directory
  const testDir = path.join(__dirname, 'test-corruption-files');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // Test document content (based on your sample)
  const testContent = `Key:	 ScreenShot (SS) different - may need attention

	ScreenShot (SS) a little different - probably does not need attention.

Change all 20.3 or 20.3.x references to 23.4.

Slide 18 change URL to this: https://techdocs.broadcom.com/us/en/ca-enterprise-software/it-operations-management/unified-infrastructure-management/23-4/getting-started/ca-uim-overview/ca-uim-architecture.html

Slide 27 change URL to this: https://techdocs.broadcom.com/us/en/ca-enterprise-software/it-operations-management/unified-infrastructure-management/23-4/getting-started/ca-uim-overview/ca-uim-architecture.html

Slide 30: The OC or Operator Console is not "Optional". Its mandatory.

Slide 34 change URL to this: https://techdocs.broadcom.com/us/en/ca-enterprise-software/it-operations-management/unified-infrastructure-management/23-4/upgrading/ca-uim-upgrade-step-1-evaluate-the-existing-environment.html

Slide 35 change URL to this: https://techdocs.broadcom.com/us/en/ca-enterprise-software/it-operations-management/unified-infrastructure-management/23-4/upgrading/ca-uim-upgrade-step-2-prepare-for-the-upgrade.html

Slide 36 change URL to this: https://techdocs.broadcom.com/us/en/ca-enterprise-software/it-operations-management/unified-infrastructure-management/23-4/upgrading/ca-uim-upgrade-step-3-deploy-the-upgrade.html

Slide 37 change URL to this: https://techdocs.broadcom.com/us/en/ca-enterprise-software/it-operations-management/unified-infrastructure-management/23-4/upgrading/ca-uim-upgrade-step-4-perform-post-upgrade-verification-and-configuration.html

Slide 54 change URL to this: https://techdocs.broadcom.com/us/en/ca-enterprise-software/it-operations-management/unified-infrastructure-management/23-4/upgrading/ca-uim-upgrade-step-4-perform-post-upgrade-verification-and-configuration.html

Slide 54 License no longer needed in 23.4

Slide 55 change URL to this: https://techdocs.broadcom.com/us/en/ca-enterprise-software/it-operations-management/unified-infrastructure-management/23-4/administering/working-with-admin-console/configure-a-probe.html

Slide 61 OC Landing Page different.

Slide 65 ScreenShot (SS) different.

Slide 72 change URL to this: https://techdocs.broadcom.com/us/en/ca-enterprise-software/it-operations-management/unified-infrastructure-management/23-4/configuring-and-viewing-monitoring-data/manage-groups.html

Slide 77 SS a little different.

Slide 91 SS different. Setup Wizard under Inventory Management now.

Slide 100 change URL to this: https://techdocs.broadcom.com/us/en/ca-enterprise-software/it-operations-management/unified-infrastructure-management/23-4/installing/discover-systems-to-monitor/configuring-discovery/define-scopes/best-practices-for-creating-scopes.html

Slide 106 change URL to this: https://techdocs.broadcom.com/us/en/ca-enterprise-software/it-operations-management/unified-infrastructure-management/23-4/configuring-and-viewing-monitoring-data/monitoring-configuration-service.html

Slide 108 change URL to this: https://techdocs.broadcom.com/us/en/ca-enterprise-software/it-operations-management/unified-infrastructure-management/23-4/configuring-and-viewing-monitoring-data/monitoring-configuration-service.html

Slide 110 SS a little different.

Slide 115 change URL to this: https://techdocs.broadcom.com/us/en/ca-enterprise-software/it-operations-management/ca-unified-infrastructure-management-probes/GA/monitoring/clouds-containers-and-virtualization/nutanix-monitor-nutanix-monitoring/nutanix-monitor-nutanix-monitoring-release-notes.html

Slide 121 SS a little different.

Slide 123 change URL to this: https://techdocs.broadcom.com/us/en/ca-enterprise-software/it-operations-management/unified-infrastructure-management/23-4/configuring-and-viewing-monitoring-data/run-discovery-in-usm/use-application-discovery.html

Slide 124,126,131-134 SS a little different

Slide 135 YouTube could be OK but for 20.3. IMS has for 23.4 here: https://imsacademy.broadcom.com/enrollments/262063180/page/991664340

Slide 182-183,191-194,196,205-206 SS a little different`;

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

  // Step 3: Simulate AI processing (improve mode)
  console.log('\n3. Simulating AI processing...');
  
  // Simulate AI processing without API call
  const aiResult = {
    content: originalData.content + " [AI Enhanced]", // Simple enhancement simulation
    metadata: {
      responseTime: 1000,
      tokenUsage: { prompt: 100, completion: 50, total: 150 },
      model: 'gpt-3.5-turbo',
      mode: 'improve',
      thinkingProcess: '<thinking>Simulated AI enhancement</thinking>',
      xmlAware: true
    },
    xmlStructure: originalData.xmlStructure // Preserve XML structure
  };
  
  console.log('✓ AI processing simulated');
  console.log(`   AI content length: ${aiResult.content.length} characters`);
  console.log(`   XML aware processing: ${aiResult.metadata.xmlAware}`);

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

  console.log('\n=== Test Complete ===');
  console.log('\nPlease try opening these files in Microsoft Word:');
  console.log(`1. ${originalPath}`);
  console.log(`2. ${updatedPath}`);
  console.log('\nIf the updated file shows "unreadable content" warning, we need to fix the XML structure preservation.');
}

testWordCorruption().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
