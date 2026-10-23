const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require("discord.js");
require("dotenv").config();

async function run() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = "1429445691452948524";
  const verifyChannelId = "1550842551450210384"; // ☑️・verifica
  const verifyCategoryId = "1550842486111342668"; // ☑️ ᴠᴇʀɪꜰɪᴄᴀ ☑️
  const verifiedRoleId = "1550842234704891994"; // Utenti

  console.log("[Channel Isolation] Connessione al bot...");
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(token);
  console.log(`[Channel Isolation] Connesso come ${client.user.tag}`);

  const guild = await client.guilds.fetch(guildId);
  if (!guild) throw new Error("Guild non trovato: " + guildId);
  console.log(`[Channel Isolation] Guild: ${guild.name} (${guild.id})`);

  const channels = await guild.channels.fetch();
  const everyoneRole = guild.roles.everyone;
  const verifiedRole = await guild.roles.fetch(verifiedRoleId);
  if (!verifiedRole) throw new Error("Ruolo verificato non trovato: " + verifiedRoleId);

  console.log(`[Channel Isolation] Ruolo Verificato: ${verifiedRole.name} (${verifiedRole.id})`);
  console.log(`[Channel Isolation] Totale canali da esaminare: ${channels.size}`);

  const staffCategoryIds = [
    "1550842533960089662", // 👮‍♀️ꜱᴛᴀꜰꜰ ᴢᴏɴᴇ👮‍♂️
    "1550842539496570990"  // 🕵️ ʟᴏɢɪꜱᴛɪᴄ ᴢᴏɴᴇ 🕵️
  ];

  let successCount = 0;
  let failCount = 0;

  // 1. First process CATEGORIES
  const categories = channels.filter(c => c && c.type === ChannelType.GuildCategory);
  for (const [catId, cat] of categories) {
    try {
      if (catId === verifyCategoryId) {
        // Verification category: visible to everyone, hidden to verified
        await cat.permissionOverwrites.edit(everyoneRole, {
          ViewChannel: true,
          SendMessages: false,
          ReadMessageHistory: true
        }, { reason: "Isolamento: Categoria verifica visibile a @everyone" });

        await cat.permissionOverwrites.edit(verifiedRole, {
          ViewChannel: false
        }, { reason: "Isolamento: Categoria verifica nascosta ai verificati" });
        console.log(`[OK] Categoria Verifica: ${cat.name} -> @everyone: ALLOW, Utenti: DENY`);
      } else if (staffCategoryIds.includes(catId)) {
        // Staff categories: keep denied for @everyone and Utenti
        await cat.permissionOverwrites.edit(everyoneRole, {
          ViewChannel: false
        }, { reason: "Isolamento: Staff zone protetta da @everyone" });
        console.log(`[OK] Categoria Staff: ${cat.name} -> @everyone: DENY`);
      } else {
        // Community categories: hide from @everyone, show to Utenti
        await cat.permissionOverwrites.edit(everyoneRole, {
          ViewChannel: false
        }, { reason: "Isolamento: Canali nascosti a non verificati" });

        await cat.permissionOverwrites.edit(verifiedRole, {
          ViewChannel: true
        }, { reason: "Isolamento: Canali visibili a verificati" });
        console.log(`[OK] Categoria Community: ${cat.name} -> @everyone: DENY, Utenti: ALLOW`);
      }
      successCount++;
    } catch (err) {
      console.error(`[ERR] Categoria ${cat.name}:`, err.message);
      failCount++;
    }
    // Small delay to prevent rate limit spikes
    await new Promise(r => setTimeout(r, 200));
  }

  // 2. Process non-category CHANNELS
  const nonCategories = channels.filter(c => c && c.type !== ChannelType.GuildCategory && !c.isThread());
  for (const [chId, ch] of nonCategories) {
    try {
      const isVerifyChannel = chId === verifyChannelId || ch.parentId === verifyCategoryId;
      const isStaffChannel = staffCategoryIds.includes(ch.parentId);

      if (isVerifyChannel) {
        // Verification channel: @everyone can view, cannot send messages (uses buttons/modals), verified role cannot view
        await ch.permissionOverwrites.edit(everyoneRole, {
          ViewChannel: true,
          SendMessages: false,
          ReadMessageHistory: true
        }, { reason: "Isolamento: Canale verifica visibile a @everyone" });

        await ch.permissionOverwrites.edit(verifiedRole, {
          ViewChannel: false
        }, { reason: "Isolamento: Canale verifica nascosto ai verificati" });
        console.log(`[OK] Canale Verifica: #${ch.name} -> @everyone: ALLOW, Utenti: DENY`);
      } else if (isStaffChannel) {
        // Staff channel: ensure everyone is denied
        await ch.permissionOverwrites.edit(everyoneRole, {
          ViewChannel: false
        }, { reason: "Isolamento: Canale staff protetto" });
        console.log(`[OK] Canale Staff: #${ch.name} -> @everyone: DENY`);
      } else {
        // Regular community channels: ensure @everyone cannot view, Utenti can view
        // If channel had explicit ALLOW for @everyone (like annunci, boosts, informazioni), override it to false!
        const existingEveryone = ch.permissionOverwrites.cache.get(everyoneRole.id);
        const hadExplicitAllow = existingEveryone && existingEveryone.allow.has(PermissionFlagsBits.ViewChannel);

        if (hadExplicitAllow) {
          await ch.permissionOverwrites.edit(everyoneRole, {
            ViewChannel: false
          }, { reason: "Isolamento: Rimosso accesso esplicito @everyone" });
        }

        // Ensure verified role has explicit ViewChannel if needed
        await ch.permissionOverwrites.edit(verifiedRole, {
          ViewChannel: true
        }, { reason: "Isolamento: Accesso garantito a utenti verificati" });

        console.log(`[OK] Canale Community: #${ch.name} -> @everyone: DENY, Utenti: ALLOW`);
      }
      successCount++;
    } catch (err) {
      console.error(`[ERR] Canale #${ch.name}:`, err.message);
      failCount++;
    }
    await new Promise(r => setTimeout(r, 150));
  }

  console.log("==================================================");
  console.log(`[Channel Isolation COMPLETATO] Successi: ${successCount}, Errori: ${failCount}`);
  console.log("==================================================");

  // Send or refresh verification message in verification channel
  const verifyChannel = channels.get(verifyChannelId);
  if (verifyChannel && verifyChannel.isTextBased()) {
    console.log(`[Verification Panel] Verifica se esiste messaggio pannello in #${verifyChannel.name}...`);
    const messages = await verifyChannel.messages.fetch({ limit: 10 }).catch(() => null);
    const hasPanel = messages && messages.some(m => m.author.id === client.user.id && m.components.length > 0);
    if (!hasPanel) {
      console.log(`[Verification Panel] Invio pannello di verifica in #${verifyChannel.name}...`);
      const { deployVerificationPanel } = require("../src/bot/verificationEngine");
      await deployVerificationPanel(verifyChannel, {
        title: "🛡️ Benvenuto su RoomUp! - Verifica Account",
        description: "Benvenuto nel server Discord ufficiale di **RoomUp!**\n\nPer proteggere la nostra community da spam e bot, tutti i canali sono temporaneamente nascosti.\n\n👇 **Clicca sul pulsante sottostante per verificarti ed accedere a tutti i canali del server!**",
        buttonLabel: "✅ Verificati Ora",
        buttonColor: "success",
        color: "#5865F2",
        footer: "Sistema di Protezione RoomUp! V2"
      });
      console.log("[Verification Panel] Pannello inviato con successo!");
    } else {
      console.log("[Verification Panel] Pannello già presente nel canale di verifica.");
    }
  }

  process.exit(0);
}

run().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
