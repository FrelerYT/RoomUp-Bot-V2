const { Client, GatewayIntentBits, PermissionFlagsBits } = require("discord.js");
require("dotenv").config();
const { isolateMember } = require("../src/bot/verificationEngine");

async function run() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = "1429445691452948524";
  const verifyChannelId = "1550847024285487177"; // ☑️・verifica
  const verifiedRoleId = "1550846908011122688"; // Utenti

  console.log("[Member Isolation] Connessione al bot...");
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
  await client.login(token);

  const oAuthG = await client.guilds.fetch(guildId);
  const guild = await oAuthG.fetch();
  console.log(`[Member Isolation] Guild: ${guild.name} (${guild.id})`);

  const config = {
    channelId: verifyChannelId,
    verifiedRoleId: verifiedRoleId,
    hideChannelAfterVerify: true
  };

  const members = await guild.members.fetch();
  console.log(`[Member Isolation] Totale membri nel server: ${members.size}`);

  let isolatedCount = 0;
  let skippedCount = 0;

  for (const [memberId, member] of members) {
    if (member.user.bot) {
      skippedCount++;
      continue;
    }
    if (member.id === guild.ownerId) {
      console.log(`[Member Isolation] Saltato Owner: ${member.user.tag}`);
      skippedCount++;
      continue;
    }
    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
      console.log(`[Member Isolation] Saltato Admin: ${member.user.tag}`);
      skippedCount++;
      continue;
    }

    // Isolate this member
    await isolateMember(member, config);
    isolatedCount++;
    console.log(`[OK] Membro isolato: ${member.user.tag} (${member.id}) -> canali nascosti, solo #verifica visibile.`);

    // Rate-limit safety
    await new Promise(r => setTimeout(r, 120));
  }

  console.log("==================================================");
  console.log(`[Member Isolation COMPLETATO] Isolati: ${isolatedCount}, Saltati (Bot/Staff/Owner): ${skippedCount}`);
  console.log(`[Verifica Sicurezza] @everyone NON è stato toccato minimamente!`);
  console.log("==================================================");

  process.exit(0);
}

run().catch(console.error);
