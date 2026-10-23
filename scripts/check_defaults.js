const path = require('path');
const { getDefaultGuildConfig } = require(path.join(__dirname, '../src/config/settingsManager'));
const cfg = getDefaultGuildConfig();
for (const [key, val] of Object.entries(cfg)) {
  if (val && typeof val === 'object') {
    console.log(`\n--- ${key} ---`);
    console.log(Object.keys(val).join(', '));
  }
}
