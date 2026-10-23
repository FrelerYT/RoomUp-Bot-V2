require("dotenv").config();
const { REST, Routes } = require("discord.js");

async function main() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const rest = new REST({ version: "10" }).setToken(token);

  console.log("Testing REST API...");
  const me = await rest.get(Routes.user());
  console.log("Bot user:", me.username, me.id);

  const guilds = await rest.get(Routes.userGuilds());
  console.log("Guilds the bot is in:", guilds.map(g => `${g.name} (${g.id})`));

  const sourceId = "1429445691452948524";
  const destId = "965378975675322438";

  try {
    const sGuild = await rest.get(Routes.guild(sourceId));
    console.log("Source guild fetched successfully:", sGuild.name);
  } catch (e) {
    console.error("Failed to fetch source guild:", e.message);
  }

  try {
    const dGuild = await rest.get(Routes.guild(destId));
    console.log("Dest guild fetched successfully:", dGuild.name);
  } catch (e) {
    console.error("Failed to fetch dest guild:", e.message);
  }
}

main().catch(err => {
  console.error("Error:", err);
});
