require("dotenv").config();
const { REST, Routes } = require("discord.js");

async function main() {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);
  const logChannelNames = [
    "🏠・canali",
    "🔊・vocali",
    "🧑‍🤝‍🧑・membri",
    "🧢・ruoli",
    "💬・messaggi",
    "🛅・moderazione",
    "〽️・uscite-entrate",
    "📁・transcript",
    "🎭・automod",
    "🗄️・altro"
  ];

  const sChannels = await rest.get(Routes.guildChannels("1429445691452948524"));

  for (const name of logChannelNames) {
    const ch = sChannels.find(c => c.name === name);
    if (!ch) continue;
    const msgs = await rest.get(Routes.channelMessages(ch.id), { query: new URLSearchParams({ limit: 100 }) });
    console.log(`${name}: ${msgs.length >= 100 ? '100+ (sample: ' + msgs[0]?.author?.username + ')' : msgs.length}`);
  }
}

main().catch(console.error);
