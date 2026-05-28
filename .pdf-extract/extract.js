const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('../capstone-paper.pdf');

pdf(dataBuffer).then(function(data) {
    fs.writeFileSync('extracted.txt', data.text);
    console.log('Extraction complete');
});
