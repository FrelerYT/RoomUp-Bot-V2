const fs = require('fs');
const path = require('path');

const dashContent = fs.readFileSync(path.join(__dirname, '../src/web/views/dashboard.ejs'), 'utf8');
const scriptMatch = dashContent.match(/<script>([\s\S]*?)<\/script>/i);
if (!scriptMatch) {
  console.log('No script found');
  process.exit(1);
}

const js = scriptMatch[1].split('<%= guildId %>').join('123456789');

// Extract all function definitions
const defs = new Set([
  // standard globals
  'fetch', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'confirm', 'prompt', 'alert',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent',
  'Math', 'Date', 'JSON', 'Array', 'Object', 'String', 'Number', 'Boolean', 'RegExp', 'Map', 'Set',
  'document', 'window', 'navigator', 'location', 'console', 'EventSource', 'Promise', 'BigInt'
]);

// Find all functions defined
const fnRegex = /(?:function\s+([a-zA-Z0-9_$]+)|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:\([^)]*\)|[a-zA-Z0-9_$]+)\s*=>|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*function)/g;
let m;
while ((m = fnRegex.exec(js)) !== null) {
  const name = m[1] || m[2] || m[3];
  if (name) defs.add(name);
}

// Also find variable declarations
const varRegex = /(?:const|let|var)\s+([a-zA-Z0-9_$]+)/g;
while ((m = varRegex.exec(js)) !== null) {
  defs.add(m[1]);
}

// Find all standalone function calls: identifier( NOT preceded by a dot
const callRegex = /(?:^|[^.a-zA-Z0-9_$])([a-zA-Z0-9_$]+)\s*\(/g;
const missing = new Set();
while ((m = callRegex.exec(js)) !== null) {
  const fn = m[1];
  // keywords
  if (['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'typeof', 'new', 'await'].includes(fn)) continue;
  if (!defs.has(fn)) {
    missing.add(fn);
  }
}

console.log('Potentially undefined standalone function calls in dashboard.ejs <script>:');
for (const fn of missing) {
  console.log('  ', fn);
}


console.log('Potentially undefined function calls in dashboard.ejs <script>:');
for (const fn of missing) {
  console.log('  ', fn);
}
