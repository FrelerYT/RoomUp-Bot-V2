const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "../src/web/views/dashboard.ejs"), "utf8");

// Check all tab IDs defined in html
const tabPanes = [];
const paneRegex = /id="(tab-[^"]+)"/g;
let m;
while ((m = paneRegex.exec(html)) !== null) {
  tabPanes.push(m[1]);
}

// Check all data-tab buttons in sidebar
const navButtons = [];
const navRegex = /data-tab="(tab-[^"]+)"/g;
while ((m = navRegex.exec(html)) !== null) {
  navButtons.push(m[1]);
}

console.log(`Found ${tabPanes.length} tab panes.`);
console.log(`Found ${navButtons.length} nav buttons.`);

// Check for nav buttons without matching panes
const missingPanes = navButtons.filter(t => !tabPanes.includes(t));
console.log("Nav buttons pointing to missing tab panes:", missingPanes);

// Check for tab panes without nav buttons
const unlinkedPanes = tabPanes.filter(t => !navButtons.includes(t));
console.log("Tab panes without nav buttons:", unlinkedPanes);

// Check all switchTab(...) calls
const switchTabCalls = [];
const switchRegex = /switchTab\(['"]([^'"]+)['"]\)/g;
while ((m = switchRegex.exec(html)) !== null) {
  switchTabCalls.push(m[1]);
}
const invalidSwitchTabs = switchTabCalls.filter(t => !tabPanes.includes(t));
console.log("switchTab calls to invalid tabs:", invalidSwitchTabs);
