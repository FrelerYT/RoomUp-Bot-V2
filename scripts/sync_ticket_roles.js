require("dotenv").config();
const { Client, GatewayIntentBits, PermissionFlagsBits } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers
  ]
});

const ROLE_ID = "1550846887085740125";
const GUILD_ID = "1429445691452948524";

client.once("ready", async () => {
  console.log(`[SyncScript] Connesso come ${client.user.tag}`);
  try {
    const guild = client.guilds.cache.get(GUILD_ID) || await client.guilds.fetch(GUILD_ID).catch(() => null);
    if (!guild) {
      console.error("[SyncScript] Guild non trovata:", GUILD_ID);
      process.exit(1);
    }

    const channels = await guild.channels.fetch();
    const ticketChannels = channels.filter(c =>
      c && c.isTextBased() && (c.name.startsWith("ticket-") || c.name.includes("ticket") || c.topic?.includes("ticket") || c.topic?.includes("Ticket #"))
    );

    console.log(`[SyncScript] Trovati ${ticketChannels.size} canali ticket in ${guild.name}`);

    for (const [id, ch] of ticketChannels) {
      try {
        await ch.permissionOverwrites.edit(ROLE_ID, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          AttachFiles: true,
          EmbedLinks: true
        }, { reason: "Sincronizzazione permessi ruolo 1550846887085740125 per vedere tutti i ticket" });
        console.log(`  ✅ Permessi aggiornati sul canale #${ch.name} (${ch.id})`);
      } catch (err) {
        console.error(`  ❌ Errore aggiornamento permessi su #${ch.name}:`, err.message);
      }
    }

    console.log("[SyncScript] Sincronizzazione completata con successo!");
  } catch (e) {
    console.error("[SyncScript] Errore generale:", e);
  } finally {
    client.destroy();
    process.exit(0);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN).catch(e => {
  console.error("[SyncScript] Errore login:", e.message);
  process.exit(1);
});
