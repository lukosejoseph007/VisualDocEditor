// Simple XML escaping test
function escapeXml(text) {
  let result = text;
  result = result.replace(/&/g, '&');
  result = result.replace(/</g, '<');
  result = result.replace(/>/g, '>');
  result = result.replace(/"/g, '"');
  return result;
}

console.log('=== Testing XML Escaping ===');
console.log('Original:', 'test & < > " content');
console.log('Escaped:', escapeXml('test & < > " content'));
console.log('=== Test Complete ===');
