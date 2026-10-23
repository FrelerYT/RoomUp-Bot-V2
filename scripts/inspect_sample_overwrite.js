const fs = require("fs");
const path = require("path");

const data = JSON.parse(fs.readFileSync(path.join(__dirname, "guild_dump.json"), "utf8"));
const { source, dest } = data;

// Map roles: sourceRoleId -> destRoleId
const roleMap = {
  [source.guild.id]: dest.guild.id // @everyone
};
for (const sr of source.roles) {
  if (sr.id === source.guild.id) continue;
  const dr = dest.roles.find(r => r.name === sr.name && (r.name !== "Social" || r.color === sr.color));
  if (dr) roleMap[sr.id] = dr.id;
}

const sCh = source.channels.find(c => c.name === "☑️ ᴠᴇʀɪꜰɪᴄᴀ ☑️");
const dCh = dest.channels.find(c => c.name === "☑️ ᴠᴇʀɪꜰɪᴄᴀ ☑️");

console.log("Source Category Overwrites for ☑️ ᴠᴇʀɪꜰɪᴄᴀ ☑️:");
for (const o of sCh.permission_overwrites) {
  const r = source.roles.find(sr => sr.id === o.id);
  console.log(`  Target: ${r ? r.name : o.id} (type: ${o.type}), allow: ${o.allow}, deny: ${o.deny}`);
}

console.log("\nDest Category Overwrites for ☑️ ᴠᴇʀɪꜰɪᴄᴀ ☑️:");
for (const o of dCh.permission_overwrites) {
  const r = dest.roles.find(dr => dr.id === o.id);
  console.log(`  Target: ${r ? r.name : o.id} (type: ${o.type}), allow: ${o.allow}, deny: ${o.deny}`);
}
