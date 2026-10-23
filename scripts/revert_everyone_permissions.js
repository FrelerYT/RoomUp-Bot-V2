const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require("discord.js");
require("dotenv").config();

async function run() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = "1429445691452948524";
  const verifiedRoleId = "1550842234704891994"; // Utenti

  console.log("[Revert] Connessione al bot...");
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(token);

  const guild = await client.guilds.fetch(guildId);
  const channels = await guild.channels.fetch();
  const everyoneRole = guild.roles.everyone;

  console.log(`[Revert] Ripristino permessi originali per @everyone e ruolo Utenti su ${guild.name}...`);

  // Original state from task-20121:
  // Allowed for @everyone:
  const originalAllowEveryoneIds = [
    "1529727480267673620", // 💎・boosts
    "1550842496748228630", // ℹ️ ɪɴꜰᴏʀᴍᴀᴢɪᴏɴɪ ℹ️
    "1550842570899333223", // 📢・annunci
    "1550842582152650812"  // 🔍・informazioni
  ];

  // Denied for @everyone: Staff categories and staff channels
  const staffCategoryIds = [
    "1550842533960089662", // 👮‍♀️ꜱᴛᴀꜰꜰ ᴢᴏɴᴇ👮‍♂️
    "1550842539496570990"  // 🕵️ ʟᴏɢɪꜱᴛɪᴄ ᴢᴏɴᴇ 🕵️
  ];
  const staffChannelIds = [
    "1529462095790342174", // 🔐〢Staff
    "1529462127968911381", // 🔰・staff
    "1550842689904312340", // ❓・infostaff
    "1550842710947135501", // 🖥️・cmd
    "1550842716605124689", // 🩸・sanzioni
    "1550842721877491794", // 🗳️・richieste
    "1550842728072487013", // 🫂・info-partnership
    "1550842733785129055", // 〽️・uscite-entrate
    "1550842739556356118", // 🛅・moderazione
    "1550842744707227718", // 🤝・partnership
    "1550842749857566763", // 📁・transcript
    "1550842755989897286", // 💬・messaggi
    "1550842761630978088", // 🏠・canali
    "1550842767046090932", // 🔊・vocali
    "1550842772288839761", // 🧑‍🤝‍🧑・membri
    "1550842777611411486", // 🧢・ruoli
    "1550842783395348520", // 🎭・automod
    "1550842791402147931"  // 🗄️・altro
  ];

  for (const [id, ch] of channels) {
    if (!ch || ch.isThread()) continue;

    try {
      // 1. Remove Utenti overwrite on community channels/categories (it originally had NONE)
      const utOw = ch.permissionOverwrites?.cache.get(verifiedRoleId);
      if (utOw) {
        await ch.permissionOverwrites.delete(verifiedRoleId, "Ripristino permessi originali Utenti").catch(() => null);
        console.log(`[Revert Utenti] Rimosso overwrite Utenti da ${ch.name}`);
      }

      // 2. Restore @everyone to original state
      if (originalAllowEveryoneIds.includes(id)) {
        await ch.permissionOverwrites.edit(everyoneRole, {
          ViewChannel: true
        }, { reason: "Ripristino originale @everyone ALLOW" });
        console.log(`[Revert @everyone] ${ch.name} -> ALLOW`);
      } else if (staffCategoryIds.includes(id) || staffChannelIds.includes(id)) {
        await ch.permissionOverwrites.edit(everyoneRole, {
          ViewChannel: false
        }, { reason: "Ripristino originale @everyone DENY per staff" });
        console.log(`[Revert @everyone] ${ch.name} -> DENY (Staff)`);
      } else {
        // Community channels / categories originally had NONE for @everyone (deleted overwrite)
        const evOw = ch.permissionOverwrites?.cache.get(everyoneRole.id);
        if (evOw) {
          await ch.permissionOverwrites.delete(everyoneRole.id, "Ripristino originale @everyone NONE").catch(() => null);
          console.log(`[Revert @everyone] Rimosso overwrite da ${ch.name} (ora NONE/INHERIT)`);
        }
      }
    } catch (err) {
      console.error(`[ERR] ${ch.name}:`, err.message);
    }
    await new Promise(r => setTimeout(r, 150));
  }

  console.log("[Revert] Completato ripristino di @everyone e Utenti!");
  process.exit(0);
}

run().catch(console.error);
