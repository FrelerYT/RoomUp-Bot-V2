require("dotenv").config();
const { REST, Routes } = require("discord.js");

async function run() {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);
  const sChannels = await rest.get(Routes.guildChannels("1429445691452948524"));
  const textChannels = sChannels.filter(c => c.type === 0 || c.type === 5);
  console.log("Text/announcement channels in source:", textChannels.length);

  const channelsWithMessages = [];
  for (const c of textChannels) {
    if (c.name.startsWith("ticket-") || c.name.startsWith("partnership-")) continue;
    try {
      const msgs = await rest.get(Routes.channelMessages(c.id), { query: new URLSearchParams({ limit: 100 }) });
      if (msgs.length > 0) {
        console.log(`Channel: ${c.name} (${c.id}) -> ${msgs.length} messages`);
        channelsWithMessages.push({ name: c.name, id: c.id, count: msgs.length, sample: msgs[0] });
      }
    } catch (e) {
      console.log(`Channel: ${c.name} -> error ${e.message}`);
    }
  }

  console.log(`\nTotal channels with messages: ${channelsWithMessages.length}`);
}

run().catch(console.error);
