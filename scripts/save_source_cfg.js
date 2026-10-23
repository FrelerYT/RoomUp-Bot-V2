const fs = require("fs");
const path = require("path");

const settings = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/settings.json"), "utf8"));
const sCfg = settings["1429445691452948524"];

fs.writeFileSync(path.join(__dirname, "source_config.json"), JSON.stringify(sCfg, null, 2), "utf8");
console.log("Source config written to scripts/source_config.json. Keys count:", Object.keys(sCfg).length);
