const escapeXml = (text) => {
  let result = text.replace(/&/g, '&');
  result = result.replace(/</g, '<');
  result = result.replace(/>/g, '>');
  result = result.replace(/"/g, '"');
  // Skip single quote escaping for now to avoid syntax issues
  return result;
};

console.log('=== Testing XML Escaping ===');
console.log('Original:', 'test & < > " content');
console.log('Escaped:', escapeXml('test & < > " content'));
console.log('=== Test Complete ===');
