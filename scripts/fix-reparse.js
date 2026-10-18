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
    if (entry.name === '.git') continue;
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

function patchMetroFileMap() {
  const crawlerPath = path.resolve(__dirname, '../node_modules/@expo/metro-file-map/build/crawlers/node/index.js');
  if (fs.existsSync(crawlerPath)) {
    let content = fs.readFileSync(crawlerPath, 'utf8');
    if (!content.includes('// ONEDRIVE_CRAWLER_PATCH')) {
      content = content.replace(
        `const isSymbolicLink = entry.isSymbolicLink();`,
        `let isSymbolicLink = entry.isSymbolicLink(); // ONEDRIVE_CRAWLER_PATCH\n                    if (isSymbolicLink && process.platform === 'win32') {\n                        try { fs.readlinkSync(file); } catch { isSymbolicLink = false; }\n                    }`
      );
      fs.writeFileSync(crawlerPath, content);
      console.log('Patched @expo/metro-file-map/build/crawlers/node/index.js for OneDrive reparse points.');
    }
  }

  const fallbackPath = path.resolve(__dirname, '../node_modules/@expo/metro-file-map/build/crawlers/node/fallback.js');
  if (fs.existsSync(fallbackPath)) {
    let content = fs.readFileSync(fallbackPath, 'utf8');
    if (!content.includes('// ONEDRIVE_FALLBACK_PATCH')) {
      content = content.replace(
        `else if (entry.isSymbolicLink()) {`,
        `else if (entry.isSymbolicLink()) { // ONEDRIVE_FALLBACK_PATCH\n                let isRealSymlink = true;\n                if (process.platform === 'win32') {\n                    try { fs_1.default.readlinkSync(childAbsolutePath); } catch { isRealSymlink = false; }\n                }\n                if (!isRealSymlink) {\n                    const ext = path_1.default.extname(name).slice(1);\n                    if (exts[ext] && !result.has(name)) {\n                        result.set(name, [null, 0, 0, null, 0, null]);\n                    }\n                    continue;\n                }`
      );
      fs.writeFileSync(fallbackPath, content);
      console.log('Patched @expo/metro-file-map/build/crawlers/node/fallback.js for OneDrive reparse points.');
    }
  }
}

console.log('Scanning node_modules and project for OneDrive reparse points...');
const start = Date.now();
clean(path.resolve(__dirname, '../node_modules'));
patchMetroFileMap();
console.log(`Scan completed in ${((Date.now() - start) / 1000).toFixed(2)}s.`);
console.log(`Fixed directories: ${fixedDirs}`);
console.log(`Fixed files: ${fixedFiles}`);
