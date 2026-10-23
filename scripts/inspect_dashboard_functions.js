const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "../src/web/views/dashboard.ejs"), "utf8");

// 1. Find all inline handlers
const inlineFunctions = new Set();
const regex = /on(?:click|submit|change|input|keyup|keydown)\s*=\s*["']([^"']+)["']/g;
let match;
while ((match = regex.exec(html)) !== null) {
  const expr = match[1].trim();
  // match function name before (
  const parts = expr.split(";");
  for (const part of parts) {
    const fnMatch = part.trim().match(/^([a-zA-Z0-9_$]+)\s*\(/);
    if (fnMatch) {
      inlineFunctions.add(fnMatch[1]);
    }
  }
}

// 2. Find all function definitions in <script> blocks
const definedFunctions = new Set();
const scriptBlocks = [];
const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
while ((match = scriptRegex.exec(html)) !== null) {
  scriptBlocks.push(match[1]);
}

const allScripts = scriptBlocks.join("\n");

// Regex to find functions
const fnRegex1 = /function\s+([a-zA-Z0-9_$]+)\s*\(/g;
while ((match = fnRegex1.exec(allScripts)) !== null) {
  definedFunctions.add(match[1]);
}

const fnRegex2 = /(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\(/g;
while ((match = fnRegex2.exec(allScripts)) !== null) {
  definedFunctions.add(match[1]);
}

const fnRegex3 = /window\.([a-zA-Z0-9_$]+)\s*=/g;
while ((match = fnRegex3.exec(allScripts)) !== null) {
  definedFunctions.add(match[1]);
}

// Built-in functions to ignore
const builtins = new Set(["alert", "confirm", "prompt", "fetch", "parseInt", "parseFloat", "encodeURIComponent", "decodeURIComponent", "event", "console", "setTimeout", "clearTimeout"]);

const missingFunctions = [];
for (const fn of inlineFunctions) {
  if (!definedFunctions.has(fn) && !builtins.has(fn)) {
    missingFunctions.push(fn);
  }
}

console.log("Total inline function calls found:", inlineFunctions.size);
console.log("Total defined functions found:", definedFunctions.size);
console.log("Missing functions (called in HTML but not defined):", missingFunctions);

// 3. Find all fetch() endpoints in <script> tags
const fetchRegex = /fetch\(["'`](\/[^"'`\?]+)/g;
const endpoints = new Set();
while ((match = fetchRegex.exec(allScripts)) !== null) {
  endpoints.add(match[1]);
}
console.log("Fetch endpoints found:", Array.from(endpoints).sort());
