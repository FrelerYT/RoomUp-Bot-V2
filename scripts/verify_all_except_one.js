require("dotenv").config();
const { Client, GatewayIntentBits, ChannelType } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { isolateMember, unisolateMember } = require("../src/bot/verificationEngine");

const TARGET_GUILD_ID = "1429445691452948524";
const EXCLUDED_USER_ID = "1529192217787240478";
const VERIFIED_ROLE_ID = "1550846908011122688"; // @Utenti
const VERIFY_CHANNEL_ID = "1550847024285487177"; // #☑️・verifica

async function run() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers
    ]
  });

  await client.login(process.env.DISCORD_BOT_TOKEN);

  client.once("clientReady", async () => {
    console.log(`[Script] Connesso come ${client.user.tag}`);

    const guild = await client.guilds.fetch(TARGET_GUILD_ID).catch(() => null);
    if (!guild) {
      console.error(`[Script] ERRORE: Server ${TARGET_GUILD_ID} non trovato!`);
      process.exit(1);
    }

    console.log(`[Script] Server trovato: "${guild.name}" (ID: ${guild.id})`);

    const verifiedRole = await guild.roles.fetch(VERIFIED_ROLE_ID).catch(() => null);
    if (!verifiedRole) {
      console.error(`[Script] ERRORE: Ruolo verificato ${VERIFIED_ROLE_ID} non trovato!`);
      process.exit(1);
    }
    console.log(`[Script] Ruolo verificato: "${verifiedRole.name}" (ID: ${verifiedRole.id})`);

    const config = {
      channelId: VERIFY_CHANNEL_ID,
      verifiedRoleId: VERIFIED_ROLE_ID,
      roleToAddId: VERIFIED_ROLE_ID,
      hideChannelAfterVerify: true,
      hideAllChannelsUntilVerified: true
    };

    console.log("[Script] Caricamento membri...");
    const members = await guild.members.fetch();
    console.log(`[Script] Totale membri trovati: ${members.size}`);

    let verifiedCount = 0;
    let excludedCount = 0;
    let botCount = 0;

    for (const [id, member] of members) {
      if (member.user.bot) {
        botCount++;
        continue;
      }

      // Se è l'utente da ESCLUDERE
      if (id === EXCLUDED_USER_ID) {
        console.log(`\n🚫 [ESCLUSO] Membro ${member.user.tag} (${id}):`);
        
        // Rimuovi ruolo verificato se lo possiede
        if (member.roles.cache.has(VERIFIED_ROLE_ID)) {
          await member.roles.remove(VERIFIED_ROLE_ID, "Escluso dalla verifica su richiesta admin")
            .then(() => console.log(`   - Ruolo @${verifiedRole.name} RIMOSSO con successo`))
            .catch(err => console.error(`   - Errore rimozione ruolo:`, err.message));
        } else {
          console.log(`   - Il membro NON possiede il ruolo @${verifiedRole.name}`);
        }

        // Applica isolamento canali
        try {
          console.log(`   - Applicazione isolamento canali per ${member.user.tag}...`);
          await isolateMember(member, config);
          console.log(`   - Isolamento canali applicato con successo (canali nascosti, solo #verifica visibile)`);
        } catch (err) {
          console.error(`   - Errore applicazione isolamento:`, err.message);
        }

        excludedCount++;
        continue;
      }

      // Per TUTTI GLI ALTRI membri: verifica completa
      let roleAdded = false;
      if (!member.roles.cache.has(VERIFIED_ROLE_ID)) {
        try {
          await member.roles.add(VERIFIED_ROLE_ID, "Verifica di massa membri");
          roleAdded = true;
        } catch (err) {
          console.error(`[Script] Errore aggiunta ruolo a ${member.user.tag}:`, err.message);
        }
      }

      // Rimuovi eventuali restrizioni/isolamenti individuali
      try {
        await unisolateMember(member, config);
      } catch (err) {
        // ignora se non presenti
      }

      verifiedCount++;
      const status = roleAdded ? "RUOLO ASSEGNATO + SBLOCCATO" : "GIÀ AVEVA RUOLO + SBLOCCATO";
      console.log(`✅ [VERIFICATO ${verifiedCount}] ${member.user.tag} (${id}) -> ${status}`);

      // Pausa di 200ms tra i membri per rispettare i rate limits di Discord
      await new Promise(r => setTimeout(r, 200));
    }

    console.log("\n==================================================");
    console.log(`🎉 OPERAZIONE COMPLETATA CON SUCCESSO!`);
    console.log(`   - Membri Umani Verificati: ${verifiedCount}`);
    console.log(`   - Membri Esclusi (NON Verificati): ${excludedCount} (ID: ${EXCLUDED_USER_ID})`);
    console.log(`   - Bot saltati: ${botCount}`);
    console.log("==================================================");

    process.exit(0);
  });
}

run().catch(err => {
  console.error("[Script] Errore critico:", err);
  process.exit(1);
});
