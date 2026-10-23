const fs = require("fs");
const path = require("path");

const data = JSON.parse(fs.readFileSync(path.join(__dirname, "guild_dump.json"), "utf8"));
const { source, dest } = data;

// Sort roles by position descending
const sRolesSorted = [...source.roles].sort((a, b) => b.position - a.position);
const dRolesSorted = [...dest.roles].sort((a, b) => b.position - a.position);

console.log("=== SOURCE ROLES (Top to Bottom) ===");
sRolesSorted.forEach(r => {
  console.log(`[${r.position}] ${r.name} (id: ${r.id}, color: ${r.color}, hoist: ${r.hoist}, mention: ${r.mentionable}, perms: ${r.permissions}, managed: ${r.managed})`);
});

console.log("\n=== DEST ROLES (Top to Bottom) ===");
dRolesSorted.forEach(r => {
  console.log(`[${r.position}] ${r.name} (id: ${r.id}, color: ${r.color}, hoist: ${r.hoist}, mention: ${r.mentionable}, perms: ${r.permissions}, managed: ${r.managed})`);
});
