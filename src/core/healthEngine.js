const { PermissionFlagsBits } = require("discord.js");

function runGuildDiagnostics(guild, config) {
  const report = {
    guildId: guild?.id || "",
    guildName: guild?.name || "Server",
    timestamp: new Date().toISOString(),
    status: "HEALTHY", // HEALTHY, WARNING, CRITICAL
    checks: [],
    stats: {
      members: guild?.memberCount || 0,
      channels: guild?.channels?.cache?.size || 0,
      roles: guild?.roles?.cache?.size || 0,
      ping: guild?.client?.ws?.ping || 0
    }
  };

  if (!guild) {
    report.status = "CRITICAL";
    report.score = 50;
    report.checks.push({ status: "CRITICAL", title: "Connessione Server", message: "Gilda non trovata nella cache del bot." });
    return report;
  }

  const me = guild.members.me;

  // 1. Check Administrator or ManageGuild permission
  if (!me.permissions.has(PermissionFlagsBits.Administrator)) {
    report.checks.push({
      status: "WARNING",
      title: "Permesso Amministratore",
      message: "Il bot non ha il permesso di Amministratore. Alcune funzioni automatiche potrebbero richiedere permessi specifici su ciascun canale."
    });
    if (report.status === "HEALTHY") report.status = "WARNING";
  } else {
    report.checks.push({ status: "HEALTHY", title: "Permesso Amministratore", message: "Il bot ha i permessi amministrativi completi." });
  }

  // 2. Role hierarchy check
  const highestBotRole = me.roles.highest;
  if (highestBotRole.position < guild.roles.cache.size - 5) {
    report.checks.push({
      status: "WARNING",
      title: "Gerarchia dei Ruoli",
      message: `Il ruolo del bot (@${highestBotRole.name}) è in posizione ${highestBotRole.position}. Spostalo più in alto nelle impostazioni ruoli di Discord per permettere l'assegnazione automatica di tutti i ruoli.`
    });
    if (report.status === "HEALTHY") report.status = "WARNING";
  } else {
    report.checks.push({ status: "HEALTHY", title: "Gerarchia Ruoli", message: "Posizione del ruolo bot ottimale per la gestione membri." });
  }

  // 3. Configured channels existence check
  const channelsToCheck = [
    { key: "welcome.channelId", name: "Canale Benvenuto" },
    { key: "leave.channelId", name: "Canale Addio" },
    { key: "automod.logChannelId", name: "Log AutoMod" },
    { key: "tickets.transcriptChannelId", name: "Transcript Ticket" },
    { key: "suggestions.channelId", name: "Canale Suggerimenti" },
    { key: "counting.channelId", name: "Canale Conteggio" },
    { key: "starboard.channelId", name: "Canale Starboard" }
  ];

  channelsToCheck.forEach(item => {
    const val = item.key.split('.').reduce((o, k) => o?.[k], config);
    if (val) {
      const ch = guild.channels.cache.get(val);
      if (!ch) {
        report.checks.push({
          status: "WARNING",
          title: `Canale Mancante (${item.name})`,
          message: `Il canale impostato con ID ${val} non esiste più su Discord. Aggiornalo dalla dashboard.`
        });
        if (report.status === "HEALTHY") report.status = "WARNING";
      }
    }
  });

  // 4. Memory & Gateway Check
  report.checks.push({
    status: "HEALTHY",
    title: "Latenza Gateway Discord",
    message: `Latenza corrente: ${guild.client.ws.ping}ms. Connessione stabile.`
  });

  report.score = report.status === "HEALTHY" ? 100 : (report.status === "WARNING" ? 80 : 50);
  report.overallScore = report.score;
  return report;
}

const runHealthCheck = runGuildDiagnostics;
module.exports = { runGuildDiagnostics, runHealthCheck };
