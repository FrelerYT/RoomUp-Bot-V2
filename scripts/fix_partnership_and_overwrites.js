require("dotenv").config();
const { REST, Routes } = require("discord.js");

async function main() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const rest = new REST({ version: "10" }).setToken(token);

  const sourceId = "1429445691452948524";
  const destId = "965378975675322438";

  console.log("Fetching channels and roles...");
  const [sRoles, dRoles, sChannels, dChannels] = await Promise.all([
    rest.get(Routes.guildRoles(sourceId)),
    rest.get(Routes.guildRoles(destId)),
    rest.get(Routes.guildChannels(sourceId)),
    rest.get(Routes.guildChannels(destId))
  ]);

  // Role map
  const roleMap = { [sourceId]: destId };
  for (const sr of sRoles) {
    if (sr.id === sourceId) continue;
    const dr = dRoles.find(r => r.name === sr.name && (r.name !== "Social" || r.color === sr.color));
    if (dr) roleMap[sr.id] = dr.id;
  }

  // Category map
  const sCats = sChannels.filter(c => c.type === 4);
  const dCats = dChannels.filter(c => c.type === 4);
  const catMap = {}; // sCatId -> dCatId
  for (const sc of sCats) {
    const dc = dCats.find(c => c.name === sc.name);
    if (dc) catMap[sc.id] = dc.id;
  }

  // Accurate channel map using (parent category name, channel name, channel type)
  const channelMap = {}; // sChId -> dChId
  for (const sc of sChannels) {
    if (sc.type === 4) {
      const dc = dCats.find(c => c.name === sc.name);
      if (dc) channelMap[sc.id] = dc.id;
      continue;
    }
    if (!sc.parent_id && (sc.name.startsWith("ticket-") || sc.name.startsWith("partnership-"))) continue;
    if (sc.name.startsWith("🔒・Stanza")) continue;

    const sParent = sChannels.find(p => p.id === sc.parent_id);
    const sParentName = sParent ? sParent.name : null;

    const dc = dChannels.find(c => {
      if (c.name !== sc.name || c.type !== sc.type) return false;
      const dParent = dChannels.find(p => p.id === c.parent_id);
      const dParentName = dParent ? dParent.name : null;
      // Match by parent name or by position closeness
      if (sc.name === "🤝・partnership") {
        return (sc.position <= 15 && c.id === "1554969756614926488") ||
               (sc.position > 15 && c.id === "1554969801175334942");
      }
      return true;
    });

    if (dc) {
      channelMap[sc.id] = dc.id;
    }
  }

  console.log(`Mapped ${Object.keys(channelMap).length} channels.`);

  // Fix partnership channels parent and position:
  const communityCatId = dCats.find(c => c.name === "🌎 ᴄᴏᴍᴍᴜɴɪᴛʏ 🌍").id;
  const logisticCatId = dCats.find(c => c.name === "🕵️ ʟᴏɢɪꜱᴛɪᴄ ᴢᴏɴᴇ 🕵️").id;

  console.log("Fixing public partnership channel...");
  await rest.patch(Routes.channel("1554969756614926488"), {
    body: { parent_id: communityCatId, position: 8 }
  });

  console.log("Fixing logs partnership channel...");
  await rest.patch(Routes.channel("1554969801175334942"), {
    body: { parent_id: logisticCatId, position: 26 }
  });

  // Re-sync permission overwrites for all channels with the correct mapping
  const dMembers = await rest.get(Routes.guildMembers(destId), { query: new URLSearchParams({ limit: 1000 }) });
  const dMemberIds = new Set(dMembers.map(m => m.user.id));

  for (const [sId, dId] of Object.entries(channelMap)) {
    const sc = sChannels.find(c => c.id === sId);
    if (!sc) continue;

    const newOverwrites = [];
    for (const so of (sc.permission_overwrites || [])) {
      if (so.type === 0) {
        const destRoleId = roleMap[so.id];
        if (destRoleId) {
          newOverwrites.push({ id: destRoleId, type: 0, allow: so.allow, deny: so.deny });
        }
      } else if (so.type === 1) {
        if (dMemberIds.has(so.id)) {
          newOverwrites.push({ id: so.id, type: 1, allow: so.allow, deny: so.deny });
        }
      }
    }

    await rest.patch(Routes.channel(dId), {
      body: { permission_overwrites: newOverwrites }
    });
  }

  console.log("✅ Fixed partnership channels and synchronized all overwrites accurately!");
}

main().catch(console.error);
