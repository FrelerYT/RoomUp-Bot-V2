require("dotenv").config();
const { REST, Routes } = require("discord.js");

async function main() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const rest = new REST({ version: "10" }).setToken(token);

  const guildId = "1429445691452948524";
  const guild = await rest.get(Routes.guild(guildId));
  console.log("Guild:", guild.name, guild.id);
  console.log("Community features:", guild.features);
  console.log("rules_channel_id:", guild.rules_channel_id);
  console.log("public_updates_channel_id:", guild.public_updates_channel_id);
  console.log("system_channel_id:", guild.system_channel_id);
  console.log("afk_channel_id:", guild.afk_channel_id);
  console.log("safety_alerts_channel_id:", guild.safety_alerts_channel_id);

  const channels = await rest.get(Routes.guildChannels(guildId));
  console.log(`\nChannels count: ${channels.length}`);
  channels.forEach(c => {
    console.log(`- [${c.id}] (type: ${c.type}) name: "${c.name}", parent: ${c.parent_id}`);
  });

  const roles = await rest.get(Routes.guildRoles(guildId));
  console.log(`\nRoles count: ${roles.length}`);
  roles.sort((a, b) => b.position - a.position);
  roles.forEach(r => {
    console.log(`- [${r.id}] pos: ${r.position}, name: "${r.name}", managed: ${r.managed}, tags: ${JSON.stringify(r.tags || {})}`);
  });

  // Also check bot user
  const me = await rest.get(Routes.user());
  console.log("\nBot:", me.username, me.id);
  const botMember = await rest.get(Routes.guildMember(guildId, me.id));
  console.log("Bot member roles:", botMember.roles);

  // Check invites on dest guild
  const destId = "965378975675322438";
  try {
    const destInvites = await rest.get(Routes.guildInvites(destId));
    console.log(`\nDest invites count: ${destInvites.length}`);
    destInvites.forEach(inv => {
      console.log(`- code: ${inv.code}, channel: ${inv.channel?.name}, uses: ${inv.uses}`);
    });
  } catch (e) {
    console.log("Could not fetch dest invites:", e.message);
  }
}

main().catch(console.error);
