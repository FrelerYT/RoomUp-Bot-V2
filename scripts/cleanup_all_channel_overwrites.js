require("dotenv").config();
const { Client, GatewayIntentBits, PermissionFlagsBits } = require("discord.js");

const GUILD_ID = "1429445691452948524";
const EXCLUDED_USER_ID = "1529192217787240478"; // crazydabu
const VERIFIED_ROLE_ID = "1550846908011122688"; // Utenti
const VERIFY_CHANNEL_ID = "1550847024285487177"; // #☑️・verifica
const VERIFY_CAT_ID = "1550847009571864696"; // ☑️ ᴠᴇʀɪꜰɪᴄᴀ ☑️

async function main() {
  console.log("🧹 Avvio pulizia definitiva di tutti i permessi membro...");
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
  });

  await client.login(process.env.DISCORD_BOT_TOKEN);

  client.once("clientReady", async () => {
    console.log(`[Bot] Connesso come ${client.user.tag}`);
    const guild = await client.guilds.fetch(GUILD_ID);
    const channels = await guild.channels.fetch();

    console.log(`[Bot] Canali totali da verificare: ${channels.size}`);

    let updatedCount = 0;

    for (const [chId, ch] of channels) {
      if (!ch || !ch.permissionOverwrites || ch.isThread()) continue;

      // 1. Costruisci il set pulito: solo ruoli
      const newOws = [];
      let utentiRoleHandled = false;

      for (const [targetId, ow] of ch.permissionOverwrites.cache) {
        if (ow.type === 0) { // Role
          if ((chId === VERIFY_CHANNEL_ID || chId === VERIFY_CAT_ID) && targetId === VERIFIED_ROLE_ID) {
            // Assicura che @Utenti abbia SEMPRE Deny ViewChannel su verifica e categoria
            newOws.push({
              id: VERIFIED_ROLE_ID,
              type: 0,
              allow: [],
              deny: [PermissionFlagsBits.ViewChannel]
            });
            utentiRoleHandled = true;
          } else {
            newOws.push({
              id: ow.id,
              type: ow.type,
              allow: ow.allow,
              deny: ow.deny
            });
          }
        }
      }

      // Se su verifica/categoria @Utenti non era presente nei ruoli, aggiungilo
      if ((chId === VERIFY_CHANNEL_ID || chId === VERIFY_CAT_ID) && !utentiRoleHandled) {
        newOws.push({
          id: VERIFIED_ROLE_ID,
          type: 0,
          allow: [],
          deny: [PermissionFlagsBits.ViewChannel]
        });
      }

      // 2. Aggiungi SOLO crazydabu come unico membro con overwrite
      if (chId === VERIFY_CHANNEL_ID || chId === VERIFY_CAT_ID) {
        newOws.push({
          id: EXCLUDED_USER_ID,
          type: 1, // Member
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
          deny: [PermissionFlagsBits.SendMessages]
        });
      } else {
        newOws.push({
          id: EXCLUDED_USER_ID,
          type: 1, // Member
          allow: [],
          deny: [PermissionFlagsBits.ViewChannel]
        });
      }

      // 3. Applica l'array definitivo
      try {
        await ch.permissionOverwrites.set(newOws, "Pulizia overwrites membri - nascondi verifica a utenti");
        updatedCount++;
        console.log(`[${updatedCount}/${channels.size}] Aggiornato: ${ch.name} (${chId}) -> ${newOws.length} overwrites puliti`);
      } catch (err) {
        console.error(`[ERRORE] Canale ${ch.name}:`, err.message);
      }

      await new Promise(r => setTimeout(r, 200));
    }

    console.log("\n==================================================");
    console.log(`✅ PULIZIA COMPLETATA SU ${updatedCount} CANALI!`);
    console.log(`   - Nessun membro ha più 'ViewChannel: true' su #verifica o categoria.`);
    console.log(`   - Solo crazydabu (${EXCLUDED_USER_ID}) può vedere #verifica.`);
    console.log(`   - Il ruolo @Utenti nega l'accesso a #verifica per tutti i verificati.`);
    console.log("==================================================\n");

    process.exit(0);
  });
}

main().catch(err => {
  console.error("Errore fatale:", err);
  process.exit(1);
});
