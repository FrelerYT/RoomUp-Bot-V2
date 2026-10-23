require("dotenv").config();
const { REST, Routes } = require("discord.js");

async function main() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const rest = new REST({ version: "10" }).setToken(token);

  const toDelete = [
    { id: "1091688626598989854", name: "regole" },
    { id: "1091688626598989855", name: "solo-moderatori" }
  ];

  for (const item of toDelete) {
    try {
      console.log(`Deleting orphan channel: ${item.name} (${item.id})...`);
      await rest.delete(Routes.channel(item.id));
      console.log(`✅ Deleted channel ${item.name}`);
    } catch (e) {
      console.warn(`Could not delete ${item.name}: ${e.message}`);
    }
  }
}

main();
