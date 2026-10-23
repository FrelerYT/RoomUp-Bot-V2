require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

async function main() {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);
  const sourceId = "1429445691452948524";
  const sChannels = await rest.get(Routes.guildChannels(sourceId));

  const textChannels = sChannels.filter(c => (c.type === 0 || c.type === 5) && !c.name.startsWith("ticket-") && !c.name.startsWith("partnership-"));
  console.log(`Analyzing ${textChannels.length} text channels in source...`);

  const summary = {};

  for (const ch of textChannels) {
    let allMsgs = [];
    let before = undefined;
    while (true) {
      const query = new URLSearchParams({ limit: 100 });
      if (before) query.set("before", before);
      const batch = await rest.get(Routes.channelMessages(ch.id), { query });
      if (!batch || batch.length === 0) break;
      allMsgs.push(...batch);
      if (batch.length < 100) break;
      before = batch[batch.length - 1].id;
    }
    if (allMsgs.length > 0) {
      summary[ch.name] = {
        id: ch.id,
        count: allMsgs.length,
        hasBot: allMsgs.some(m => m.author.bot),
        hasUser: allMsgs.some(m => !m.author.bot)
      };
      console.log(`[${ch.name}] Total messages: ${allMsgs.length} (Bot: ${summary[ch.name].hasBot}, User: ${summary[ch.name].hasUser})`);
    }
  }

  fs.writeFileSync(path.join(__dirname, "channel_message_counts.json"), JSON.stringify(summary, null, 2));
  console.log("Summary saved to scripts/channel_message_counts.json");
}

main().catch(console.error);
