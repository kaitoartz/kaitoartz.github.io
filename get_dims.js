const fs = require('fs');
const path = require('path');

// Minimal PNG size parser
function getPngDimensions(filePath) {
    const buffer = fs.readFileSync(filePath);
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    // IHDR chunk starts at byte 8
    // Width at byte 16 (4 bytes), Height at byte 20 (4 bytes)
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
}

const dir = 'assets/decals';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));

const dimensions = {};
files.forEach(file => {
    try {
        const dim = getPngDimensions(path.join(dir, file));
        dimensions[file] = dim;
    } catch (e) {
        console.error(`Error reading ${file}:`, e.message);
    }
});

console.log(JSON.stringify(dimensions, null, 2));
