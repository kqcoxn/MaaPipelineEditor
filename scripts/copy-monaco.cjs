const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'node_modules', 'monaco-editor', 'min', 'vs');
const destDir = path.join(__dirname, '..', 'public', 'monaco-editor', 'min', 'vs');

if (!fs.existsSync(srcDir)) {
  console.log('monaco-editor not found in node_modules, skipping copy');
  process.exit(0);
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('Copying monaco-editor assets to public/...');
copyRecursive(srcDir, destDir);
console.log('Done.');
