const fs = require('fs');
const path = require('path');

function walk(dir) {
  let files = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) files.push(...walk(full));
    else if (full.endsWith('.ts') || full.endsWith('.tsx') || full.endsWith('.js')) files.push(full);
  }
  return files;
}

const all = walk('src');
const found = [];
all.forEach(file => {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((l, i) => {
    const m = l.match(/([a-zA-Z0-9_$]+)\.startsWith\(/g);
    if (m) {
      m.forEach(call => {
        const varName = call.replace('.startsWith(', '');
        found.push({ file: path.relative('.', file), line: i + 1, varName, code: l.trim() });
      });
    }
  });
});

console.log('Total non-literal startsWith:', found.length);
fs.writeFileSync('all_startswith.txt', found.map(f => `${f.file}:${f.line} [${f.varName}] -> ${f.code}`).join('\n'));
console.log('Written to all_startswith.txt');
