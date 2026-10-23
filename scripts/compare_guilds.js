const fs = require("fs");
const path = require("path");

const data = JSON.parse(fs.readFileSync(path.join(__dirname, "guild_dump.json"), "utf8"));
const { source, dest } = data;

console.log("=== GUILD COMPARISON ===");
console.log(`Source: "${source.guild.name}" (${source.guild.id})`);
console.log(`Dest:   "${dest.guild.name}" (${dest.guild.id})`);

// Check bot permissions
const botRole = dest.roles.find(r => dest.botMember.roles.includes(r.id));
console.log("\nBot Role in Dest:", botRole ? `${botRole.name} (pos: ${botRole.position}, perms: ${botRole.permissions})` : "None");
const isAdmin = (BigInt(botRole?.permissions || 0) & BigInt(0x8)) === BigInt(0x8);
console.log("Bot has Admin in Dest:", isAdmin);

// Roles comparison
console.log("\n=== ROLES ===");
console.log(`Source roles count: ${source.roles.length}`);
console.log(`Dest roles count:   ${dest.roles.length}`);

const sRoleNames = source.roles.map(r => r.name);
const dRoleNames = dest.roles.map(r => r.name);

const missingInDest = source.roles.filter(r => !dest.roles.some(dr => dr.name === r.name));
const extraInDest = dest.roles.filter(r => !source.roles.some(sr => sr.name === r.name));

console.log("Roles missing in Dest:", missingInDest.map(r => r.name));
console.log("Extra roles in Dest:", extraInDest.map(r => r.name));

// For matching roles, check differences (color, hoist, mentionable, permissions)
const roleDiffs = [];
for (const sr of source.roles) {
  if (sr.name === "@everyone") continue;
  const dr = dest.roles.find(r => r.name === sr.name);
  if (!dr) continue;
  const diffs = [];
  if (sr.color !== dr.color) diffs.push(`color: ${sr.color} -> ${dr.color}`);
  if (sr.hoist !== dr.hoist) diffs.push(`hoist: ${sr.hoist} -> ${dr.hoist}`);
  if (sr.mentionable !== dr.mentionable) diffs.push(`mentionable: ${sr.mentionable} -> ${dr.mentionable}`);
  if (sr.permissions !== dr.permissions) diffs.push(`perms: ${sr.permissions} -> ${dr.permissions}`);
  if (diffs.length > 0) {
    roleDiffs.push({ name: sr.name, diffs });
  }
}
console.log(`Role differences found in ${roleDiffs.length} roles:`);
roleDiffs.slice(0, 10).forEach(d => console.log(`  - ${d.name}: ${d.diffs.join(", ")}`));
if (roleDiffs.length > 10) console.log(`  ... and ${roleDiffs.length - 10} more`);

// Channels comparison
console.log("\n=== CHANNELS ===");
console.log(`Source channels count: ${source.channels.length}`);
console.log(`Dest channels count:   ${dest.channels.length}`);

const missingChannelsInDest = source.channels.filter(sc => !dest.channels.some(dc => dc.name === sc.name && dc.type === sc.type));
const extraChannelsInDest = dest.channels.filter(dc => !source.channels.some(sc => sc.name === dc.name && sc.type === dc.type));

console.log("Channels missing in Dest:", missingChannelsInDest.map(c => `${c.name} (${c.type})`));
console.log("Extra channels in Dest:", extraChannelsInDest.map(c => `${c.name} (${c.type})`));

// Compare categories and channels structure
const sCategories = source.channels.filter(c => c.type === 4);
const dCategories = dest.channels.filter(c => c.type === 4);
console.log(`Source categories: ${sCategories.length}, Dest categories: ${dCategories.length}`);
