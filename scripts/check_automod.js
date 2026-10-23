require("dotenv").config();
const { REST } = require("discord.js");

async function main() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const rest = new REST({ version: "10" }).setToken(token);

  const sourceId = "1429445691452948524";
  const destId = "965378975675322438";

  try {
    const sAutomod = await rest.get(`/guilds/${sourceId}/auto-moderation/rules`);
    console.log("Source AutoMod rules count:", sAutomod.length);
    console.log(JSON.stringify(sAutomod, null, 2));
  } catch (e) {
    console.error("Error fetching source automod:", e.message);
  }

  try {
    const dAutomod = await rest.get(`/guilds/${destId}/auto-moderation/rules`);
    console.log("Dest AutoMod rules count:", dAutomod.length);
    console.log(JSON.stringify(dAutomod, null, 2));
  } catch (e) {
    console.error("Error fetching dest automod:", e.message);
  }
}

main();
