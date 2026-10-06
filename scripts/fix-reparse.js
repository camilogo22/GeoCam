const fs = require('fs');
const path = require('path');

let fixedFiles = 0;
let fixedDirs = 0;

function clean(targetPath) {
  let entries;
  try {
    entries = fs.readdirSync(targetPath, { withFileTypes: true });
  } catch (err) {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(targetPath, entry.name);
    try {
      if (entry.isSymbolicLink()) {
        let isRealSymlink = false;
        try {
          fs.readlinkSync(fullPath);
          isRealSymlink = true;
        } catch (e) {
          isRealSymlink = false;
        }

        if (!isRealSymlink) {
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            const tempDir = fullPath + '_cleantmp_' + Math.random().toString(36).substring(2, 8);
            fs.cpSync(fullPath, tempDir, { recursive: true });
            fs.rmSync(fullPath, { recursive: true, force: true });
            fs.cpSync(tempDir, fullPath, { recursive: true });
            fs.rmSync(tempDir, { recursive: true, force: true });
            fixedDirs++;
            clean(fullPath);
          } else if (stat.isFile()) {
            const content = fs.readFileSync(fullPath);
            fs.unlinkSync(fullPath);
            fs.writeFileSync(fullPath, content);
            fixedFiles++;
          }
        }
      } else if (entry.isDirectory()) {
        clean(fullPath);
      }
    } catch (e) {
      // ignore
    }
  }
}

console.log('Scanning node_modules for OneDrive reparse points (files and dirs)...');
const start = Date.now();
clean(path.resolve(__dirname, '../node_modules'));
console.log(`Scan completed in ${((Date.now() - start) / 1000).toFixed(2)}s.`);
console.log(`Fixed directories: ${fixedDirs}`);
console.log(`Fixed files: ${fixedFiles}`);

