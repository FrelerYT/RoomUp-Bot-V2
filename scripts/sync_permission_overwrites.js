require("dotenv").config();
const { REST, Routes } = require("discord.js");

async function main() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const rest = new REST({ version: "10" }).setToken(token);

  const sourceId = "1429445691452948524";
  const destId = "965378975675322438";

  console.log("Fetching roles and channels for both guilds...");
  const [sRoles, dRoles, sChannels, dChannels] = await Promise.all([
    rest.get(Routes.guildRoles(sourceId)),
    rest.get(Routes.guildRoles(destId)),
    rest.get(Routes.guildChannels(sourceId)),
    rest.get(Routes.guildChannels(destId))
  ]);

  // Role map
  const roleMap = {
    [sourceId]: destId // @everyone
  };
  for (const sr of sRoles) {
    if (sr.id === sourceId) continue;
    const dr = dRoles.find(r => r.name === sr.name && (r.name !== "Social" || r.color === sr.color));
    if (dr) roleMap[sr.id] = dr.id;
  }

  // Fetch dest members to verify which member overwrites can be applied
  const dMembers = await rest.get(Routes.guildMembers(destId), { query: new URLSearchParams({ limit: 1000 }) });
  const dMemberIds = new Set(dMembers.map(m => m.user.id));
  console.log(`Dest guild has ${dMemberIds.size} members.`);

  let syncedChannels = 0;
  let skippedOverwrites = 0;

  for (const sc of sChannels) {
    // Skip orphan ticket channels or temp rooms
    if (!sc.parent_id && (sc.name.startsWith("ticket-") || sc.name.startsWith("partnership-"))) continue;
    if (sc.name.startsWith("🔒・Stanza")) continue;

    const sParent = sChannels.find(p => p.id === sc.parent_id);
    const sParentName = sParent ? sParent.name : null;

    const dc = dChannels.find(c => {
      if (c.name !== sc.name || c.type !== sc.type) return false;
      if (sc.type === 4) return true;
      const dParent = dChannels.find(p => p.id === c.parent_id);
      return dParent?.name === sParentName;
    });
    if (!dc) {
      console.warn(`Channel "${sc.name}" (${sc.type}) under "${sParentName}" not found in dest!`);
      continue;
    }

    const sOverwrites = sc.permission_overwrites || [];
    const newOverwrites = [];

    for (const so of sOverwrites) {
      if (so.type === 0) { // Role
        const destRoleId = roleMap[so.id];
        if (destRoleId) {
          newOverwrites.push({
            id: destRoleId,
            type: 0,
            allow: so.allow,
            deny: so.deny
          });
        } else {
          console.warn(`Unmapped role in "${sc.name}": ${so.id}`);
          skippedOverwrites++;
        }
      } else if (so.type === 1) { // Member
        if (dMemberIds.has(so.id)) {
          newOverwrites.push({
            id: so.id,
            type: 1,
            allow: so.allow,
            deny: so.deny
          });
        } else {
          // Member not in dest guild
          skippedOverwrites++;
        }
      }
    }

    try {
      await rest.patch(Routes.channel(dc.id), {
        body: { permission_overwrites: newOverwrites }
      });
      syncedChannels++;
      console.log(`Synced ${newOverwrites.length} overwrites for "${sc.name}"`);
    } catch (e) {
      console.error(`Failed to sync overwrites for "${sc.name}":`, e.message);
    }
  }

  console.log(`\n✅ Permission overwrites sync complete! Synced ${syncedChannels} channels/categories. (Skipped ${skippedOverwrites} non-existent member/role overwrites)`);
}

main().catch(console.error);
