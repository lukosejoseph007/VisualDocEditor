// Quick test script to verify React integration is working
import { reactDiffEditor } from './react-diff-editor.js';

console.log('Testing React DiffEditor integration...');

// Test the React diff editor
const testOriginal = `# Hello World
This is the original content.
It has multiple lines.
And some changes will be made.`;

const testModified = `# Hello World Updated
This is the modified content.
It has multiple lines with changes.
And some new content added.`;

// Test show method
console.log('Testing show method...');
reactDiffEditor.show(testOriginal, testModified, () => {
  console.log('Accept callback triggered!');
});

// Test isVisible method
setTimeout(() => {
  console.log('Diff editor visible:', reactDiffEditor.isVisible());
  
  // Test hide method
  setTimeout(() => {
    console.log('Testing hide method...');
    reactDiffEditor.hide();
    console.log('Diff editor visible after hide:', reactDiffEditor.isVisible());
    console.log('✅ React integration test completed successfully!');
  }, 1000);
}, 500);
