const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "../src/web/views/dashboard.ejs"), "utf8");

const fetchCalls = [];
const regex = /fetch\(\s*([^\,\)]+)(?:,\s*(\{[\s\S]*?\}))?\s*\)/g;
let m;
while ((m = regex.exec(html)) !== null) {
  fetchCalls.push({
    urlExpr: m[1].trim(),
    hasOptions: Boolean(m[2]),
    optionsSnippet: m[2] ? m[2].slice(0, 100).replace(/\s+/g, ' ') : ''
  });
}

console.log(`Found ${fetchCalls.length} fetch() calls in dashboard.ejs:`);
fetchCalls.forEach((f, i) => {
  console.log(`${i + 1}: ${f.urlExpr} [opts: ${f.hasOptions ? f.optionsSnippet : 'none'}]`);
});
