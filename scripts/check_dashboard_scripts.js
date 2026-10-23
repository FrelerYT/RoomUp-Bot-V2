const fs = require("fs");
const vm = require("vm");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "../src/web/views/dashboard.ejs"), "utf8");
const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let idx = 0;
let errors = 0;

while ((match = scriptRegex.exec(html)) !== null) {
  idx++;
  const code = match[1];
  // replace EJS tags with safe dummy literals
  // <%= ... %> or <%- ... %> -> "test_string"
  // <% ... %> (code statements) -> /* ejs */
  const cleanCode = code
    .replace(/["']<%[=-]([\s\S]*?)%>["']/g, '"dummy_val"')
    .replace(/<%[=-]([\s\S]*?)%>/g, '0')
    .replace(/<%([\s\S]*?)%>/g, '/* ejs */');

  try {
    new vm.Script(cleanCode, { filename: `dashboard_script_${idx}.js` });
    console.log(`Script block ${idx}: SYNTAX OK (${cleanCode.length} chars)`);
  } catch (err) {
    errors++;
    console.error(`Script block ${idx} SYNTAX ERROR:`, err.message);
    const lines = cleanCode.split("\n");
    const errLine = err.stack.match(/dashboard_script_\d+\.js:(\d+)/);
    if (errLine) {
      const lineNum = parseInt(errLine[1], 10);
      console.error(`Around line ${lineNum}:`);
      for (let l = Math.max(0, lineNum - 5); l < Math.min(lines.length, lineNum + 5); l++) {
        console.error(`${l + 1}: ${lines[l]}`);
      }
    }
  }
}

if (errors === 0) {
  console.log("ALL SCRIPT BLOCKS HAVE VALID SYNTAX!");
} else {
  process.exit(1);
}
