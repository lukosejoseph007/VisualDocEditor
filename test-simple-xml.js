// Simple XML escaping test
function escapeXml(text) {
  return text
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>');
}

// Test the XML escaping
const testText = 'This & that < > test';
const escaped = escapeXml(testText);

console.log('Original:', testText);
console.log('Escaped: ', escaped);
console.log('Valid XML:', escaped === 'This & that < > test');
