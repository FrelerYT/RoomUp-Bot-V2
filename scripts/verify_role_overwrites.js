const fs = require("fs");
const path = require("path");

const data = JSON.parse(fs.readFileSync(path.join(__dirname, "guild_dump.json"), "utf8"));
const { source, dest } = data;

const roleMap = { [source.guild.id]: dest.guild.id };
for (const sr of source.roles) {
  if (sr.id === source.guild.id) continue;
  const dr = dest.roles.find(r => r.name === sr.name && (r.name !== "Social" || r.color === sr.color));
  if (dr) roleMap[sr.id] = dr.id;
}

let mismatchedRolesCount = 0;

for (const sc of source.channels) {
  if (!sc.parent_id && (sc.name.startsWith("ticket-") || sc.name.startsWith("partnership-"))) continue;
  if (sc.name.startsWith("🔒・Stanza")) continue;

  const sParent = source.channels.find(p => p.id === sc.parent_id);
  const sParentName = sParent ? sParent.name : null;

  const dc = dest.channels.find(c => {
    if (c.name !== sc.name || c.type !== sc.type) return false;
    if (sc.type === 4) return true;
    const dParent = dest.channels.find(p => p.id === c.parent_id);
    return dParent?.name === sParentName;
  });

  if (!dc) {
    console.log(`❌ Could not find dest channel for "${sc.name}" (parent: ${sParentName})`);
    mismatchedRolesCount++;
    continue;
  }

  const sRoleOverwrites = (sc.permission_overwrites || []).filter(o => o.type === 0);
  const dRoleOverwrites = (dc.permission_overwrites || []).filter(o => o.type === 0);

  for (const sro of sRoleOverwrites) {
    const expectedDestRoleId = roleMap[sro.id];
    const dro = dRoleOverwrites.find(o => o.id === expectedDestRoleId);

    if (!dro) {
      console.log(`❌ Missing role overwrite in "${sc.name}" for role ${sro.id}`);
      mismatchedRolesCount++;
    } else if (dro.allow !== sro.allow || dro.deny !== sro.deny) {
      console.log(`⚠️ Perm bits mismatch in "${sc.name}": allow ${dro.allow} vs ${sro.allow}, deny ${dro.deny} vs ${sro.deny}`);
      mismatchedRolesCount++;
    }
  }

  for (const dro of dRoleOverwrites) {
    const sourceRoleId = Object.keys(roleMap).find(k => roleMap[k] === dro.id);
    if (!sRoleOverwrites.some(o => o.id === sourceRoleId)) {
      console.log(`➕ Extra role overwrite in Dest "${dc.name}" for role ${dro.id}`);
      mismatchedRolesCount++;
    }
  }
}

console.log(`Total role overwrite mismatches across all channels: ${mismatchedRolesCount}`);
