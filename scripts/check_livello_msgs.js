require("dotenv").config();
const { REST, Routes } = require("discord.js");

async function main() {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);
  const sChannels = await rest.get(Routes.guildChannels("1429445691452948524"));
  const livello = sChannels.find(c => c.name === "🌠・livello");
  const msgs = await rest.get(Routes.channelMessages(livello.id), { query: new URLSearchParams({ limit: 5 }) });
  console.log("Livello msgs sample:", JSON.stringify(msgs[0], null, 2));
}

main().catch(console.error);
