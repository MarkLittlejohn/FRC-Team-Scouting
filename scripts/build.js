const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const jsDirectory = path.join(root, 'js');

if (!fs.existsSync(indexPath)) {
    throw new Error('Build input missing: index.html');
}

const JavaScriptFiles = fs.readdirSync(jsDirectory)
    .filter(file => file.endsWith('.js'))
    .sort();

if (JavaScriptFiles.length === 0) {
    throw new Error('Build input missing: no JavaScript files found in js/');
}

for (const file of JavaScriptFiles) {
    execFileSync(process.execPath, ['--check', path.join(jsDirectory, file)], {
        stdio: 'inherit',
    });
}

console.log(`Build validation passed for index.html and ${JavaScriptFiles.length} JavaScript files.`);
