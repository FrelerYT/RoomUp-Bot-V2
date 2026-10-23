require("dotenv").config();
const { Client, GatewayIntentBits, PermissionFlagsBits } = require("discord.js");

const GUILD_ID = "1429445691452948524";
const EXCLUDED_USER_ID = "1529192217787240478"; // crazydabu
const VERIFIED_ROLE_ID = "1550846908011122688"; // Utenti
const VERIFY_CHANNEL_ID = "1550847024285487177"; // #☑️・verifica
const VERIFY_CAT_ID = "1550847009571864696"; // ☑️ ᴠᴇʀɪꜰɪᴄᴀ ☑️

async function main() {
  console.log("🚀 Avvio procedura rapida verifica di massa...");
  const startTime = Date.now();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers
    ]
  });

  await client.login(process.env.DISCORD_BOT_TOKEN);

  client.once("clientReady", async () => {
    console.log(`[Bot] Connesso come ${client.user.tag}`);

    const guild = await client.guilds.fetch(GUILD_ID);
    if (!guild) {
      console.error("Guild non trovata");
      process.exit(1);
    }

    // 1. Gestione utente escluso: crazydabu
    console.log(`\n🔒 [Step 1] Gestione utente escluso: ${EXCLUDED_USER_ID}`);
    const excludedMember = await guild.members.fetch(EXCLUDED_USER_ID).catch(() => null);
    if (excludedMember) {
      if (excludedMember.roles.cache.has(VERIFIED_ROLE_ID)) {
        await excludedMember.roles.remove(VERIFIED_ROLE_ID, "Escluso dalla verifica");
        console.log(`   - Ruolo @Utenti rimosso da ${excludedMember.user.tag}`);
      } else {
        console.log(`   - ${excludedMember.user.tag} non ha il ruolo @Utenti (OK)`);
      }
    } else {
      console.log(`   - Utente ${EXCLUDED_USER_ID} non trovato nel server`);
    }

    // 2. Pulizia istantanea overwrites per-canale mantenendo SOLO ruoli + crazydabu isolato
    console.log(`\n🧹 [Step 2] Aggiornamento rapido permessi su tutti i canali...`);
    const channels = await guild.channels.fetch();
    let chCount = 0;

    for (const [chId, ch] of channels) {
      if (!ch || !ch.permissionOverwrites || ch.isThread()) continue;

      // Mantieni solo i ruoli (type === 0)
      const newOverwrites = [];
      for (const [targetId, ow] of ch.permissionOverwrites.cache) {
        if (ow.type === 0) {
          newOverwrites.push({
            id: ow.id,
            type: ow.type,
            allow: ow.allow,
            deny: ow.deny
          });
        }
      }

      // Aggiungi isolamento specifico SOLO per l'utente escluso crazydabu
      if (chId === VERIFY_CHANNEL_ID || chId === VERIFY_CAT_ID) {
        newOverwrites.push({
          id: EXCLUDED_USER_ID,
          type: 1, // Member
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
          deny: [PermissionFlagsBits.SendMessages]
        });
      } else {
        newOverwrites.push({
          id: EXCLUDED_USER_ID,
          type: 1, // Member
          allow: [],
          deny: [PermissionFlagsBits.ViewChannel]
        });
      }

      try {
        await ch.permissionOverwrites.set(newOverwrites, "Reset permessi membri e isolamento crazydabu");
        chCount++;
        if (chCount % 10 === 0 || chCount === channels.size) {
          console.log(`   - Aggiornati permessi su ${chCount}/${channels.size} canali...`);
        }
      } catch (err) {
        console.error(`   - Errore su canale ${ch.name} (${chId}):`, err.message);
      }

      await new Promise(r => setTimeout(r, 120));
    }
    console.log(`✅ Permessi canale aggiornati con successo su tutti i canali.`);

    // 3. Assegnazione ruolo @Utenti a tutti i membri umani tranne crazydabu
    console.log(`\n👥 [Step 3] Assegnazione ruolo @Utenti ai membri non verificati...`);
    const members = await guild.members.fetch();
    const toVerify = [];

    for (const [id, m] of members) {
      if (m.user.bot) continue;
      if (id === EXCLUDED_USER_ID) continue;
      if (!m.roles.cache.has(VERIFIED_ROLE_ID)) {
        toVerify.push(m);
      }
    }

    console.log(`   - Membri da verificare trovati: ${toVerify.length}`);

    const batchSize = 10;
    let verifiedCount = 0;

    for (let i = 0; i < toVerify.length; i += batchSize) {
      const batch = toVerify.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async m => {
          try {
            await m.roles.add(VERIFIED_ROLE_ID, "Verifica di massa membri");
            verifiedCount++;
          } catch (err) {
            console.error(`   - Errore ruolo per ${m.user.tag}:`, err.message);
          }
        })
      );
      console.log(`   - Verificati ${verifiedCount}/${toVerify.length} membri...`);
      await new Promise(r => setTimeout(r, 350));
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n==================================================`);
    console.log(`🎉 OPERAZIONE COMPLETATA IN ${elapsed}s!`);
    console.log(`   - Membri Nuovamente Verificati: ${verifiedCount}`);
    console.log(`   - Membri Totali nel Server: ${members.size}`);
    console.log(`   - Membro Escluso: ${EXCLUDED_USER_ID} (crazydabu) NON Verificato ed ISOLATO`);
    console.log(`==================================================\n`);

    process.exit(0);
  });
}

main().catch(err => {
  console.error("Errore fatale:", err);
  process.exit(1);
});
