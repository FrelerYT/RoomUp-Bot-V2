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

// Map channels: sourceChannelId -> destChannelId
const channelMap = {};
for (const sc of source.channels) {
  // If orphan ticket/voice, skip
  if (!sc.parent_id && (sc.name.startsWith("ticket-") || sc.name.startsWith("partnership-"))) continue;
  if (sc.name.startsWith("🔒・Stanza")) continue;

  const dc = dest.channels.find(c => c.name === sc.name && c.type === sc.type);
  if (dc) {
    channelMap[sc.id] = dc.id;
  }
}

console.log("Channel mapping count:", Object.keys(channelMap).length);

// Compare permission overwrites for each mapped channel / category
let overwriteMismatches = 0;
for (const [sId, dId] of Object.entries(channelMap)) {
  const sc = source.channels.find(c => c.id === sId);
  const dc = dest.channels.find(c => c.id === dId);
  if (!sc || !dc) continue;

  const sOverwrites = sc.permission_overwrites || [];
  const dOverwrites = dc.permission_overwrites || [];

  // Map source overwrites to expected dest overwrites
  const expectedOverwrites = [];
  for (const so of sOverwrites) {
    let targetId = so.id;
    if (so.type === 0) { // role
      targetId = roleMap[so.id];
      if (!targetId) {
        // console.log(`Unmapped source role in overwrite for channel "${sc.name}":`, so.id);
        continue;
      }
    } // else type === 1 (member)
    expectedOverwrites.push({
      id: targetId,
      type: so.type,
      allow: so.allow,
      deny: so.deny
    });
  }

  // Compare expected with dOverwrites
  let diff = false;
  if (expectedOverwrites.length !== dOverwrites.length) {
    diff = true;
  } else {
    for (const exp of expectedOverwrites) {
      const match = dOverwrites.find(o => o.id === exp.id && o.type === exp.type);
      if (!match || match.allow !== exp.allow || match.deny !== exp.deny) {
        diff = true;
        break;
      }
    }
  }

  if (diff) {
    overwriteMismatches++;
    console.log(`\nOverwrite diff in "${sc.name}" (${sc.type === 4 ? "CATEGORY" : "channel"}):`);
    console.log("  Source overwrites count:", sOverwrites.length, "Expected mapped:", expectedOverwrites.length);
    console.log("  Dest overwrites count:  ", dOverwrites.length);
  }
}

console.log(`\nTotal overwrite mismatches: ${overwriteMismatches} / ${Object.keys(channelMap).length}`);
