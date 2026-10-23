require("dotenv").config();
const { REST, Routes } = require("discord.js");

async function main() {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);
  const dChannels = await rest.get(Routes.guildChannels("965378975675322438"));
  const salotto = dChannels.find(c => c.name === "🛋️・salotto");
  const msgs = await rest.get(Routes.channelMessages(salotto.id));
  console.log("Dest salotto messages:", JSON.stringify(msgs, null, 2));
}

main().catch(console.error);
