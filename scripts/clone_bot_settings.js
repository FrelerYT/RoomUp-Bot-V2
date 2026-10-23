const fs = require("fs");
const path = require("path");

const settingsPath = path.join(__dirname, "../data/settings.json");
const allSettings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
const dump = JSON.parse(fs.readFileSync(path.join(__dirname, "guild_dump.json"), "utf8"));

const sourceId = "1429445691452948524";
const destId = "965378975675322438";

const sCfg = allSettings[sourceId];
if (!sCfg) {
  throw new Error("Source guild settings not found in data/settings.json");
}

const { source, dest } = dump;

// Map roles: sourceRoleId -> destRoleId
const roleMap = { [sourceId]: destId };
for (const sr of source.roles) {
  if (sr.id === sourceId) continue;
  const dr = dest.roles.find(r => r.name === sr.name && (r.name !== "Social" || r.color === sr.color));
  if (dr) roleMap[sr.id] = dr.id;
}

// Map channels: sourceChannelId -> destChannelId
const sCats = source.channels.filter(c => c.type === 4);
const dCats = dest.channels.filter(c => c.type === 4);

const channelMap = {};
for (const sc of source.channels) {
  if (sc.type === 4) {
    const dc = dCats.find(c => c.name === sc.name);
    if (dc) channelMap[sc.id] = dc.id;
    continue;
  }
  if (!sc.parent_id && (sc.name.startsWith("ticket-") || sc.name.startsWith("partnership-"))) continue;
  if (sc.name.startsWith("🔒・Stanza")) continue;

  const sParent = source.channels.find(p => p.id === sc.parent_id);
  const sParentName = sParent ? sParent.name : null;

  const dc = dest.channels.find(c => {
    if (c.name !== sc.name || c.type !== sc.type) return false;
    if (sc.name === "🤝・partnership") {
      return (sc.position <= 15 && c.id === "1554969756614926488") ||
             (sc.position > 15 && c.id === "1554969801175334942");
    }
    const dParent = dest.channels.find(p => p.id === c.parent_id);
    return dParent?.name === sParentName;
  });

  if (dc) channelMap[sc.id] = dc.id;
}

// Combined remap dictionary
const idMap = {
  [sourceId]: destId,
  ...roleMap,
  ...channelMap
};

console.log(`Total ID mapping dictionary size: ${Object.keys(idMap).length}`);

// Deep clone and remap
function remapValue(val) {
  if (typeof val === "string") {
    // If exact match of a mapped ID
    if (idMap[val]) return idMap[val];
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(item => remapValue(item));
  }
  if (val !== null && typeof val === "object") {
    const res = {};
    for (const [k, v] of Object.entries(val)) {
      // If key itself is a mapped ID (e.g. role rewards or warn levels)
      const mappedKey = idMap[k] || k;
      res[mappedKey] = remapValue(v);
    }
    return res;
  }
  return val;
}

const clonedConfig = remapValue(sCfg);

// Explicit updates
clonedConfig.guildId = destId;
clonedConfig.guildName = "RoomUp! 2";

// Reset ephemeral counters for fresh server
if (clonedConfig.counting) {
  clonedConfig.counting.currentCount = 0;
  clonedConfig.counting.highestScore = 0;
  clonedConfig.counting.lastUserId = "";
}
clonedConfig.ticketCounter = 1;
clonedConfig.isLockdownActive = false;

// Save to settings.json
allSettings[destId] = clonedConfig;
fs.writeFileSync(settingsPath, JSON.stringify(allSettings, null, 2), "utf8");
console.log("✅ Successfully cloned and remapped settings for guild 965378975675322438 into data/settings.json!");

// Verify all mapped channel IDs in the cloned config actually exist in Dest
const dChannelIds = new Set(dest.channels.map(c => c.id));
const dRoleIds = new Set(dest.roles.map(r => r.id));

console.log("\n--- Verification of Cloned Settings ---");
console.log("Logs global channel:", clonedConfig.logs?.globalChannelId, "Exists in Dest:", dChannelIds.has(clonedConfig.logs?.globalChannelId));
console.log("Verification channel:", clonedConfig.verification?.channelId, "Exists in Dest:", dChannelIds.has(clonedConfig.verification?.channelId));
console.log("Verified role:", clonedConfig.verification?.verifiedRoleId, "Exists in Dest:", dRoleIds.has(clonedConfig.verification?.verifiedRoleId));
console.log("Tickets panel channel:", clonedConfig.tickets?.panels?.[0]?.channelId, "Exists in Dest:", dChannelIds.has(clonedConfig.tickets?.panels?.[0]?.channelId));
console.log("Voice hub channel:", clonedConfig.voice?.hubChannelId, "Exists in Dest:", dChannelIds.has(clonedConfig.voice?.hubChannelId));
console.log("Voice category:", clonedConfig.voice?.categoryId, "Exists in Dest:", dChannelIds.has(clonedConfig.voice?.categoryId));
console.log("Partnership public channel:", clonedConfig.partnerships?.partnerChannelId, "Exists in Dest:", dChannelIds.has(clonedConfig.partnerships?.partnerChannelId));
console.log("Partnership log channel:", clonedConfig.partnerships?.logChannelId, "Exists in Dest:", dChannelIds.has(clonedConfig.partnerships?.logChannelId));
console.log("Counting channel:", clonedConfig.counting?.channelId, "Exists in Dest:", dChannelIds.has(clonedConfig.counting?.channelId));
console.log("Starboard channel:", clonedConfig.starboard?.channelId, "Exists in Dest:", dChannelIds.has(clonedConfig.starboard?.channelId));
console.log("Music allowed text channel:", clonedConfig.music?.allowedTextChannelId, "Exists in Dest:", dChannelIds.has(clonedConfig.music?.allowedTextChannelId));
console.log("Music DJ role:", clonedConfig.music?.djRoleId, "Exists in Dest:", dRoleIds.has(clonedConfig.music?.djRoleId));
console.log("Level up channel:", clonedConfig.levels?.levelUpChannelId, "Exists in Dest:", dChannelIds.has(clonedConfig.levels?.levelUpChannelId));
