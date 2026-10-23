const fs = require('fs');
const path = require('path');

const dashContent = fs.readFileSync(path.join(__dirname, '../src/web/views/dashboard.ejs'), 'utf8');
const serverContent = fs.readFileSync(path.join(__dirname, '../src/web/server.js'), 'utf8');

// Find all server routes
const serverRoutes = [];
const routeRegex = /app\.(get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/g;
let m;
while ((m = routeRegex.exec(serverContent)) !== null) {
  serverRoutes.push({ method: m[1].toUpperCase(), path: m[2] });
}

console.log(`Server defines ${serverRoutes.length} routes:`);
serverRoutes.forEach(r => console.log(`  ${r.method.padEnd(6)} ${r.path}`));

// Find all fetch calls in dashboard.ejs
// Matches fetch(`/api/...`, { method: 'POST' }) or fetch("/api/...")
const fetchRegex = /fetch\s*\(\s*([`'"][^`'"]+[`'"])(?:\s*,\s*(\{[\s\S]*?\}))?/g;
const clientCalls = [];
while ((m = fetchRegex.exec(dashContent)) !== null) {
  let urlExpr = m[1];
  let options = m[2] || '';
  let method = 'GET';
  const methodMatch = options.match(/method\s*:\s*["']([^"']+)["']/i);
  if (methodMatch) method = methodMatch[1].toUpperCase();

  clientCalls.push({ urlExpr, method, rawOptions: options });
}

console.log(`\nClient makes ${clientCalls.length} fetch calls:`);
clientCalls.forEach(c => console.log(`  ${c.method.padEnd(6)} ${c.urlExpr}`));

// Compare client calls with server routes
// Find all onclick attributes
const onclickRegex = /onclick\s*=\s*["']([^("'>\s]+)\s*\(/g;
const onclicks = new Set();
while ((m = onclickRegex.exec(dashContent)) !== null) {
  onclicks.add(m[1].trim());
}

console.log(`\nFound ${onclicks.size} unique onclick function calls in HTML:`);
for (const fn of Array.from(onclicks).sort()) {
  // Check if fn is defined in the script
  const fnDefRegex = new RegExp(`(function\\s+${fn}\\s*\\(|const\\s+${fn}\\s*=|let\\s+${fn}\\s*=|var\\s+${fn}\\s*=|window\\.${fn}\\s*=)`);
  const isDefined = fnDefRegex.test(dashContent);
  if (isDefined) {
    console.log(`  [OK] ${fn}()`);
  } else {
    console.log(`  [MISSING / UNDEFINED FUNCTION!] ${fn}()`);
  }
}

// Check href links in HTML
const hrefRegex = /href\s*=\s*["']([^"']+)["']/g;
const hrefs = new Set();
while ((m = hrefRegex.exec(dashContent)) !== null) {
  hrefs.add(m[1].trim());
}
console.log(`\nFound ${hrefs.size} unique hrefs in dashboard.ejs:`);
for (const h of hrefs) {
  console.log(`  href: ${h}`);
}

// Find modals
console.log('\n--- Modals in dashboard.ejs ---');
const modalRegex = /<div[^>]+id=["']([^"']*modal[^"']*)["'][^>]*>/gi;
while ((m = modalRegex.exec(dashContent)) !== null) {
  console.log(`  Modal ID: ${m[1]}`);
}

// Check Tabs consistency
console.log('\n--- Tabs Consistency ---');
const navMatches = dashContent.match(/switchTab\s*\(\s*['"]([^'"]+)['"]/g) || [];
const navTabs = new Set(navMatches.map(str => {
  const match = str.match(/switchTab\s*\(\s*['"]([^'"]+)['"]/);
  return match ? match[1] : null;
}).filter(Boolean));

const paneMatches = dashContent.match(/id=["'](tab-[^'"]+)["']/g) || [];
const panes = new Set(paneMatches.map(str => {
  const match = str.match(/id=["'](tab-[^'"]+)["']/);
  return match ? match[1] : null;
}).filter(Boolean));

console.log(`Found ${navTabs.size} tabs called via switchTab:`);
for (const t of navTabs) {
  const paneId = 'tab-' + t;
  const exists = panes.has(paneId);
  if (exists) {
    console.log(`  [OK] tab '${t}' -> #${paneId}`);
  } else {
    console.log(`  [BROKEN TAB!] tab '${t}' has NO corresponding #${paneId} pane!`);
  }
}

console.log(`\nFound ${panes.size} tab panes in HTML:`);
for (const p of panes) {
  const tabName = p.replace(/^tab-/, '');
  if (!navTabs.has(tabName)) {
    console.log(`  [ORPHAN PANE] #${p} has no switchTab('${tabName}') button`);
  }
}

// Check local static assets
console.log('\n--- Checking Static Assets ---');
const publicDir = path.join(__dirname, '../src/web/public');
const viewsDir = path.join(__dirname, '../src/web/views');

['dashboard.ejs', 'index.ejs', 'forbidden.ejs'].forEach(viewName => {
  const content = fs.readFileSync(path.join(viewsDir, viewName), 'utf8');
  console.log(`\nAssets in ${viewName}:`);
  const matches = content.match(/(?:src|href)\s*=\s*["']([^"']+)["']/g) || [];
  const assets = new Set();
  matches.forEach(m => {
    const val = m.replace(/^(?:src|href)\s*=\s*["']/, '').replace(/["']$/, '');
    assets.add(val);
  });

  assets.forEach(val => {
    // If it is a relative local path starting with / or not http
    if (!val.startsWith('http://') && !val.startsWith('https://') && !val.startsWith('#') && !val.startsWith('javascript:')) {
      if (val.startsWith('/dashboard/') || val === '/' || val === '/login' || val === '/logout' || val === '/invite') {
        // route link, ignore
        return;
      }
      const localFile = path.join(publicDir, val.startsWith('/') ? val.slice(1) : val);
      const exists = fs.existsSync(localFile);
      if (exists) {
        console.log(`  [FOUND ASSET] ${val}`);
      } else {
        console.log(`  [MISSING LOCAL ASSET!] ${val} (file: ${localFile})`);
      }
    }
  });
});





