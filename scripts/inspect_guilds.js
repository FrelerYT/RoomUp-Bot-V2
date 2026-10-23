require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

async function main() {
  const token = process.env.DISCORD_BOT_TOKEN;
  await client.login(token);

  console.log("Logged in as:", client.user.tag);

  const sourceId = "1429445691452948524";
  const destId = "965378975675322438";

  const sourceGuild = client.guilds.cache.get(sourceId) || await client.guilds.fetch(sourceId).catch(e => null);
  const destGuild = client.guilds.cache.get(destId) || await client.guilds.fetch(destId).catch(e => null);

  if (!sourceGuild) {
    console.error("❌ Source guild not found:", sourceId);
  } else {
    console.log(`✅ Source Guild: ${sourceGuild.name} (${sourceGuild.id})`);
  }

  if (!destGuild) {
    console.error("❌ Destination guild not found:", destId);
  } else {
    console.log(`✅ Destination Guild: ${destGuild.name} (${destGuild.id})`);
  }

  if (sourceGuild && destGuild) {
    // Check bot permissions in destination guild
    const botMember = await destGuild.members.fetch(client.user.id).catch(e => null);
    console.log("Bot in Dest Guild:", botMember ? "Yes" : "No");
    if (botMember) {
      console.log("Bot Dest Guild Admin:", botMember.permissions.has("Administrator"));
      console.log("Bot Dest Guild Manage Roles:", botMember.permissions.has("ManageRoles"));
      console.log("Bot Dest Guild Manage Channels:", botMember.permissions.has("ManageChannels"));
      console.log("Bot Dest Highest Role Position:", botMember.roles.highest.position);
    }

    // Source stats
    const sRoles = await sourceGuild.roles.fetch();
    const sChannels = await sourceGuild.channels.fetch();
    console.log(`Source roles: ${sRoles.size}, channels: ${sChannels.size}`);

    // Dest stats
    const dRoles = await destGuild.roles.fetch();
    const dChannels = await destGuild.channels.fetch();
    console.log(`Dest roles: ${dRoles.size}, channels: ${dChannels.size}`);
  }

  client.destroy();
  process.exit(0);
}

main().catch(err => {
  console.error("Fatal:", err);
  client.destroy();
  process.exit(1);
});
