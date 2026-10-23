const fs = require("fs");
const path = require("path");

const data = JSON.parse(fs.readFileSync(path.join(__dirname, "guild_dump.json"), "utf8"));
const { source, dest } = data;

const userOverwrites = new Set();
const roleOverwrites = new Set();

for (const sc of source.channels) {
  for (const o of (sc.permission_overwrites || [])) {
    if (o.type === 1) userOverwrites.add(o.id);
    if (o.type === 0) roleOverwrites.add(o.id);
  }
}

console.log("Distinct user IDs in source overwrites:", [...userOverwrites]);
console.log("Distinct role IDs in source overwrites:", [...roleOverwrites]);

// Check which roles they are
for (const rid of roleOverwrites) {
  const r = source.roles.find(sr => sr.id === rid);
  console.log(`Role overwrite: ${r ? r.name : "UNKNOWN"} (${rid})`);
}
