const fs = require("fs");
const path = require("path");

const data = JSON.parse(fs.readFileSync(path.join(__dirname, "guild_dump.json"), "utf8"));
const { source, dest } = data;

// Filter unmanaged roles
const sRoles = source.roles.filter(r => !r.managed);
const dRoles = dest.roles.filter(r => !r.managed);

console.log("Unmanaged Source roles:", sRoles.length);
console.log("Unmanaged Dest roles:", dRoles.length);

const mismatches = [];
for (let i = 0; i < sRoles.length; i++) {
  const sr = sRoles[i];
  const dr = dRoles.find(r => r.name === sr.name && (r.name !== "Social" || (sr.color === r.color)));
  if (!dr) {
    console.log("Missing role in dest:", sr.name);
    continue;
  }
  const diff = [];
  if (sr.color !== dr.color) diff.push(`color: ${sr.color} vs ${dr.color}`);
  if (sr.hoist !== dr.hoist) diff.push(`hoist: ${sr.hoist} vs ${dr.hoist}`);
  if (sr.mentionable !== dr.mentionable) diff.push(`mentionable: ${sr.mentionable} vs ${dr.mentionable}`);
  if (sr.permissions !== dr.permissions) diff.push(`perms: ${sr.permissions} vs ${dr.permissions}`);
  if (diff.length > 0) {
    mismatches.push({ name: sr.name, diff });
  }
}

console.log(`Mismatches: ${mismatches.length}`);
mismatches.forEach(m => console.log(`- ${m.name}: ${m.diff.join(", ")}`));
