require("dotenv").config();
const { REST, Routes } = require("discord.js");

async function main() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const rest = new REST({ version: "10" }).setToken(token);

  const sourceId = "1429445691452948524";
  const destId = "965378975675322438";

  console.log("Fetching channels for both guilds...");
  const sChannels = await rest.get(Routes.guildChannels(sourceId));
  const dChannels = await rest.get(Routes.guildChannels(destId));

  // Map categories first:
  const sCategories = sChannels.filter(c => c.type === 4);
  const dCategories = dChannels.filter(c => c.type === 4);

  const catMap = {};
  for (const sc of sCategories) {
    const dc = dCategories.find(c => c.name === sc.name);
    if (dc) {
      catMap[sc.id] = dc.id;
      // Check position diff
      if (dc.position !== sc.position) {
        console.log(`Updating category position for "${sc.name}": ${dc.position} -> ${sc.position}`);
        await rest.patch(Routes.channel(dc.id), { body: { position: sc.position } });
      }
    } else {
      console.warn(`Category "${sc.name}" missing in dest!`);
    }
  }

  // Now non-category channels:
  const sNonCat = sChannels.filter(c => c.type !== 4 && c.parent_id);

  let updatedCount = 0;
  for (const sc of sNonCat) {
    const expectedParentId = catMap[sc.parent_id];
    const dc = dChannels.find(c => c.name === sc.name && c.type === sc.type);

    if (!dc) {
      console.warn(`Channel "${sc.name}" (${sc.type}) not found in dest!`);
      continue;
    }

    const patchBody = {};
    if (dc.parent_id !== expectedParentId) patchBody.parent_id = expectedParentId;
    if (dc.topic !== sc.topic) patchBody.topic = sc.topic;
    if (dc.nsfw !== sc.nsfw) patchBody.nsfw = sc.nsfw;
    if (dc.rate_limit_per_user !== sc.rate_limit_per_user) patchBody.rate_limit_per_user = sc.rate_limit_per_user;
    if (dc.position !== sc.position) patchBody.position = sc.position;
    if (sc.type === 2) { // voice
      if (sc.bitrate && dc.bitrate !== sc.bitrate) {
        // Only set if dest supports that bitrate (dest tier)
        try {
          patchBody.bitrate = Math.min(sc.bitrate, 96000); // 96k standard for unboosted/normal
        } catch (e) {}
      }
      if (dc.user_limit !== sc.user_limit) patchBody.user_limit = sc.user_limit;
    }

    if (Object.keys(patchBody).length > 0) {
      console.log(`Patching channel "${sc.name}":`, patchBody);
      try {
        await rest.patch(Routes.channel(dc.id), { body: patchBody });
        updatedCount++;
      } catch (e) {
        console.error(`Error patching "${sc.name}":`, e.message);
      }
    }
  }

  console.log(`✅ Channel sync completed. ${updatedCount} channels updated.`);
}

main().catch(console.error);
