const fs = require('fs');
const JSZip = require('jszip');
const xml2js = require('xml2js');

async function extractTextFromPPTX(filePath) {
  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);
  
  let textContent = [];
  let slideCount = 0;
  
  // Find all slide files
  zip.forEach((relativePath, file) => {
    if (relativePath.startsWith('ppt/slides/slide') && relativePath.endsWith('.xml')) {
      slideCount++;
    }
  });

  // Process each slide
  for (let i = 1; i <= slideCount; i++) {
    const slidePath = `ppt/slides/slide${i}.xml`;
    if (!zip.files[slidePath]) continue;

    const slideContent = await zip.file(slidePath).async('string');
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(slideContent);
    
    // Extract text from slide
    const extractText = (obj) => {
      if (typeof obj === 'string') return obj;
      if (obj['a:t']) return obj['a:t'].map(t => t._ || t).join(' ');
      if (obj['a:r']) return obj['a:r'].map(extractText).join(' ');
      if (obj['a:p']) return obj['a:p'].map(extractText).join('\n');
      return Object.values(obj).map(extractText).join(' ');
    };

    const slideText = extractText(result);
    textContent.push(`Slide ${i}:\n${slideText}\n`);
  }

  return textContent.join('\n');
}

// Test the function
extractTextFromPPTX('test.pptx')
  .then(content => console.log('PPTX Content:\n' + content.slice(0, 500) + '...'))
  .catch(err => console.error('Error:', err));
