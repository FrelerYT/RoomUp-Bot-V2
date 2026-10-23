const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const https = require("https");

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "RoomUp-Bot-V2/1.0" } }, (res) => {
      let data = "";
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });
}

function initIntegrationsEngine(client) {
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName } = interaction;

    // 1. /mc-status
    if (commandName === "mc-status") {
      const serverIp = interaction.options.getString("server", true);
      const port = interaction.options.getInteger("porta") || 25565;

      await interaction.deferReply();

      try {
        const queryUrl = `https://api.mcsrvstat.us/3/${encodeURIComponent(serverIp)}:${port}`;
        const data = await fetchJson(queryUrl).catch(() => null);

        if (!data || !data.online) {
          return interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setTitle(`🔴 Minecraft Server Offline`)
                .setDescription(`Il server **${serverIp}:${port}** non risponde o è attualmente offline.`)
                .setColor("#f23f43")
                .setTimestamp()
            ]
          });
        }

        const motdClean = (data.motd?.clean || ["Nessun MOTD disponibile"]).join("\n");
        const playersOnline = data.players?.online ?? 0;
        const playersMax = data.players?.max ?? 0;
        const version = data.version || "Sconosciuta";
        const iconUrl = data.icon ? `https://api.mcsrvstat.us/icon/${encodeURIComponent(serverIp)}` : null;

        const embed = new EmbedBuilder()
          .setTitle(`🟢 Minecraft Server Online • ${serverIp}`)
          .setDescription(`\`\`\`\n${motdClean}\n\`\`\``)
          .addFields(
            { name: "👥 Giocatori Connessi", value: `**${playersOnline}** / ${playersMax}`, inline: true },
            { name: "📦 Versione Server", value: `\`${version}\``, inline: true },
            { name: "🔌 Indirizzo Completo", value: `\`${serverIp}:${port}\``, inline: true }
          )
          .setColor("#23a55a")
          .setFooter({ text: "RoomUp! Minecraft Bridge • Query Live" })
          .setTimestamp();

        if (iconUrl) embed.setThumbnail(iconUrl);

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        return interaction.editReply({
          content: `❌ Errore durante la richiesta di stato per \`${serverIp}\`: ${err.message}`
        });
      }
    }
  });

  console.log("[IntegrationsEngine] Suite Integrazioni Esterne & Bridge Minecraft Attiva!");
}

// Function to dispatch formatted GitHub webhook alerts
async function dispatchGitHubWebhook(client, channelId, eventType, payload) {
  if (!client || !client.isReady() || !channelId) return false;
  const channel = client.channels.cache.get(channelId);
  if (!channel || !channel.isTextBased()) return false;

  const repo = payload.repository?.full_name || "Repository";
  const sender = payload.sender?.login || "Autore";

  let embed = new EmbedBuilder().setColor("#2b3137").setTimestamp();

  if (eventType === "push") {
    const commits = payload.commits || [];
    const branch = (payload.ref || "").replace("refs/heads/", "");
    embed.setTitle(`🔨 [${repo}:${branch}] ${commits.length} nuovo/i commit`)
         .setURL(payload.compare || payload.repository?.html_url)
         .setDescription(commits.slice(0, 5).map(c => `[\`${c.id.slice(0, 7)}\`](${c.url}) ${c.message.split("\n")[0]} — *${c.author.name}*`).join("\n"))
         .setFooter({ text: `Push di ${sender}` });
  } else if (eventType === "pull_request") {
    const pr = payload.pull_request;
    embed.setTitle(`🔀 [${repo}] Pull Request #${pr.number} ${payload.action}: ${pr.title}`)
         .setURL(pr.html_url)
         .setDescription(pr.body ? pr.body.slice(0, 200) + "..." : "Nessuna descrizione")
         .setColor(payload.action === "opened" ? "#23a55a" : "#9b59b6")
         .setFooter({ text: `PR di ${sender}` });
  } else {
    embed.setTitle(`📦 [${repo}] Evento GitHub: ${eventType}`)
         .setDescription(`Azione eseguita da **${sender}**.`)
         .setURL(payload.repository?.html_url || "https://github.com");
  }

  await channel.send({ embeds: [embed] }).catch(() => null);
  return true;
}

module.exports = {
  initIntegrationsEngine,
  dispatchGitHubWebhook
};
