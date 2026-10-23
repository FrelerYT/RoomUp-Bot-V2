const fs = require("fs");
const path = require("path");

const settings = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/settings.json"), "utf8"));
const sCfg = settings["1429445691452948524"];

console.log("=== SOURCE GUILD CONFIG IN SETTINGS.JSON ===");
console.log(JSON.stringify(sCfg, null, 2));
