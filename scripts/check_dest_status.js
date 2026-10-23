require("dotenv").config();
const { REST, Routes } = require("discord.js");

async function main() {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);
  const destGuildId = "965378975675322438";
  const dChannels = await rest.get(Routes.guildChannels(destGuildId));
  const textChannels = dChannels.filter(c => c.type === 0 || c.type === 5);

  console.log("=== CHECKING ALL DEST CHANNELS MESSAGE COUNTS ===");
  for (const c of textChannels) {
    const msgs = await rest.get(Routes.channelMessages(c.id), { query: new URLSearchParams({ limit: 10 }) }).catch(() => []);
    if (msgs.length > 0) {
      console.log(`[${c.name}] -> ${msgs.length} messages (last: ${msgs[0].content?.slice(0, 30) || 'embed'})`);
    }
  }
}

main().catch(console.error);
