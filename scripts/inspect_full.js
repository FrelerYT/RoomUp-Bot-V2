require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

async function main() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const rest = new REST({ version: "10" }).setToken(token);

  const sourceId = "1429445691452948524";
  const destId = "965378975675322438";

  console.log("Fetching source guild data...");
  const sGuild = await rest.get(Routes.guild(sourceId));
  const sRoles = await rest.get(Routes.guildRoles(sourceId));
  const sChannels = await rest.get(Routes.guildChannels(sourceId));

  console.log("Fetching dest guild data...");
  const dGuild = await rest.get(Routes.guild(destId));
  const dRoles = await rest.get(Routes.guildRoles(destId));
  const dChannels = await rest.get(Routes.guildChannels(destId));

  const botMemberDest = await rest.get(Routes.guildMember(destId, "1543608170327445634"));

  const data = {
    source: {
      guild: sGuild,
      roles: sRoles,
      channels: sChannels
    },
    dest: {
      guild: dGuild,
      roles: dRoles,
      channels: dChannels,
      botMember: botMemberDest
    }
  };

  fs.writeFileSync(path.join(__dirname, "guild_dump.json"), JSON.stringify(data, null, 2), "utf8");
  console.log("Dump saved to scripts/guild_dump.json");
  console.log(`Source: ${sRoles.length} roles, ${sChannels.length} channels`);
  console.log(`Dest: ${dRoles.length} roles, ${dChannels.length} channels`);
  console.log("Dest Bot Member roles:", botMemberDest.roles);
}

main().catch(err => {
  console.error("Error in inspect_full:", err);
});
