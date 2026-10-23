const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
} = require("discord.js");
const fs = require("fs");
const path = require("path");

const PARTNERS_FILE = path.join(__dirname, "../../data/partners.json");
const COLLAB_FILE = path.join(__dirname, "../../data/server_collaborations.json");

function loadPartners() {
  try {
    if (!fs.existsSync(PARTNERS_FILE)) {
      const initial = { counter: 0, partners: [], exitLogs: [] };
      fs.writeFileSync(PARTNERS_FILE, JSON.stringify(initial, null, 2), "utf8");
      return initial;
    }
    return JSON.parse(fs.readFileSync(PARTNERS_FILE, "utf8"));
  } catch (e) {
    return { counter: 0, partners: [], exitLogs: [] };
  }
}

function savePartners(data) {
  try {
    fs.writeFileSync(PARTNERS_FILE, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (e) {
    return false;
  }
}

function loadCollaborations() {
  try {
    if (!fs.existsSync(COLLAB_FILE)) {
      const initial = { collaborations: [] };
      fs.writeFileSync(COLLAB_FILE, JSON.stringify(initial, null, 2), "utf8");
      return initial;
    }
    return JSON.parse(fs.readFileSync(COLLAB_FILE, "utf8"));
  } catch (e) {
    return { collaborations: [] };
  }
}

function saveCollaborations(data) {
  try {
    fs.writeFileSync(COLLAB_FILE, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (e) {
    return false;
  }
}

function getConnectedGuilds(guildId) {
  const data = loadCollaborations();
  const connected = [];
  for (const c of (data.collaborations || [])) {
    if (c.status === "accepted") {
      if (c.requesterGuildId === guildId) connected.push(c.targetGuildId);
      else if (c.targetGuildId === guildId) connected.push(c.requesterGuildId);
    }
  }
  return [...new Set(connected)];
}

function getGuildCollaborations(guildId) {
  const data = loadCollaborations();
  const all = data.collaborations || [];
  
  const connected = all.filter(c => c.status === "accepted" && (c.requesterGuildId === guildId || c.targetGuildId === guildId));
  const incoming = all.filter(c => c.status === "pending" && c.targetGuildId === guildId);
  const outgoing = all.filter(c => c.status === "pending" && c.requesterGuildId === guildId);
  const history = all.filter(c => (c.status === "rejected" || c.status === "revoked" || c.status === "cancelled") && (c.requesterGuildId === guildId || c.targetGuildId === guildId));

  return { connected, incoming, outgoing, history };
}

function splitMessageContent(text, maxLength = 2000) {
  if (!text || text.length <= maxLength) return [text || ""];
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }
    let idx = remaining.lastIndexOf("\n", maxLength);
    if (idx === -1 || idx < maxLength / 2) {
      idx = remaining.lastIndexOf(" ", maxLength);
    }
    if (idx === -1) idx = maxLength;
    chunks.push(remaining.slice(0, idx));
    remaining = remaining.slice(idx).trimStart();
  }
  return chunks;
}

function formatPartnershipDate(d = new Date()) {
  const pad = n => String(n).padStart(2, "0");
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = String(d.getFullYear()).slice(-2);
  const hours = pad(d.getHours());
  const mins = pad(d.getMinutes());
  return `${day}.${month}.${year}, ${hours}:${mins}`;
}

function extractPartnerServerName(description, defaultName = "RoomUp!") {
  if (!description) return defaultName;
  const lines = description.split("\n").map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (/https?:\/\/|discord\.gg/i.test(line)) continue;
    if (/^[-=_*~#]{3,}$/.test(line)) continue;
    const cleaned = line
      .replace(/^[#*_\s~`>|✦˖⁺୨ৎ\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+/gu, "")
      .replace(/[#*_\s~`>|✦˖⁺୨ৎ\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+$/gu, "")
      .trim();
    if (cleaned.length >= 2 && cleaned.length <= 40) {
      return cleaned;
    }
  }
  return defaultName;
}

function calculateStaffStats(partnersData, staffId) {
  const staffCounts = {};
  for (const p of (partnersData?.partners || [])) {
    if (p.deleted) continue;
    const sId = p.authorId || "SentinelAI";
    staffCounts[sId] = (staffCounts[sId] || 0) + 1;
  }
  staffCounts[staffId] = (staffCounts[staffId] || 0) + 1;

  const sorted = Object.entries(staffCounts).sort((a, b) => b[1] - a[1]);
  const rankIdx = sorted.findIndex(([id]) => id === staffId);
  const rank = rankIdx !== -1 ? rankIdx + 1 : 1;

  return {
    count: staffCounts[staffId],
    rank
  };
}

async function createPartnershipInfoEmbed({
  client,
  staffId,
  collaboratorId,
  serverName,
  partnerServerName,
  partnerNumber,
  pingDisplay = "Nessuno",
  embedColor = "#8A5CF6"
}) {
  const finalServerName = serverName || partnerServerName || "RoomUp!";
  let staffAvatar = null;
  if (client && staffId) {
    try {
      const u = client.users?.cache?.get(staffId) || await client.users?.fetch?.(staffId).catch(() => null);
      staffAvatar = u?.displayAvatarURL?.({ dynamic: true, size: 256 }) || null;
    } catch(e) {}
  }

  const embed = new EmbedBuilder()
    .setTitle("🤝 Nuova Partnership!")
    .setColor(embedColor || "#8A5CF6")
    .setDescription(
      `Grazie <@${staffId}> per aver eseguito **una nuova partnership**!\n\n` +
      `├ **Autore:** <@${collaboratorId}>\n` +
      `├ **Server:** ${finalServerName}\n` +
      `├ **Staff:** <@${staffId}>\n` +
      `├ **Ping:** ${pingDisplay || "Nessuno"}\n` +
      `└ **Partner:** #${partnerNumber}`
    )
    .setFooter({
      text: `Collaborazione con ${finalServerName} | ${formatPartnershipDate()}`
    });

  if (staffAvatar) {
    embed.setThumbnail(staffAvatar);
  }

  return embed;
}

async function createCollabRequest({ client, loadSettingsFn, requesterGuildId, requesterUserId, targetGuildId }) {
  if (requesterGuildId === targetGuildId) {
    throw new Error("Non puoi inviare una richiesta di collaborazione al tuo stesso server.");
  }

  const data = loadCollaborations();
  const existing = (data.collaborations || []).find(c =>
    ((c.requesterGuildId === requesterGuildId && c.targetGuildId === targetGuildId) ||
     (c.requesterGuildId === targetGuildId && c.targetGuildId === requesterGuildId)) &&
    (c.status === "pending" || c.status === "accepted")
  );

  if (existing) {
    if (existing.status === "accepted") {
      throw new Error("Questi due server sono già collegati come partner.");
    } else {
      throw new Error("Esiste già una richiesta di collaborazione in sospeso tra questi due server.");
    }
  }

  let reqGuild = null;
  let targetGuild = null;
  if (client && client.isReady()) {
    reqGuild = client.guilds.cache.get(requesterGuildId) || await client.guilds.fetch(requesterGuildId).catch(() => null);
    targetGuild = client.guilds.cache.get(targetGuildId) || await client.guilds.fetch(targetGuildId).catch(() => null);
  }

  const collabId = `collab_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const newCollab = {
    id: collabId,
    requesterGuildId,
    requesterGuildName: reqGuild ? reqGuild.name : `Server ${requesterGuildId}`,
    requesterGuildIcon: reqGuild ? (reqGuild.iconURL({ dynamic: true, size: 128 }) || "") : "",
    requesterMemberCount: reqGuild ? reqGuild.memberCount : 0,
    requesterUserId: requesterUserId || "Dashboard Admin",
    targetGuildId,
    targetGuildName: targetGuild ? targetGuild.name : `Server ${targetGuildId}`,
    targetGuildIcon: targetGuild ? (targetGuild.iconURL({ dynamic: true, size: 128 }) || "") : "",
    targetMemberCount: targetGuild ? targetGuild.memberCount : 0,
    status: "pending",
    createdAt: new Date().toISOString(),
    notificationMessageId: null,
    notificationChannelId: null
  };

  // Notifica interattiva sul server target su Discord (se presente)
  if (targetGuild) {
    try {
      const settings = typeof loadSettingsFn === 'function' ? loadSettingsFn() : {};
      const tConfig = settings[targetGuildId]?.partnerships || {};
      const notifChannelId = tConfig.logChannelId || tConfig.partnerChannelId || targetGuild.systemChannelId;
      if (notifChannelId) {
        const channel = targetGuild.channels.cache.get(notifChannelId) || await targetGuild.channels.fetch(notifChannelId).catch(() => null);
        if (channel && channel.isTextBased()) {
          const embed = new EmbedBuilder()
            .setTitle("🤝 Richiesta di Collaborazione Partnership Network")
            .setColor("#5865F2")
            .setDescription(
              `Il server **${newCollab.requesterGuildName}** (${newCollab.requesterMemberCount} membri) ha inviato una richiesta di collegamento partnership con **${targetGuild.name}**!\n\n` +
              `*Accettando, le partnership approvate verranno sincronizzate reciprocamente tra i due server.*\n` +
              `L'Owner o un Amministratore può accettare o rifiutare con i pulsanti sottostanti o dalla Web Dashboard.`
            )
            .setThumbnail(newCollab.requesterGuildIcon || null)
            .setFooter({ text: `ID: ${collabId} • RoomUp! Network` })
            .setTimestamp();

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`collab_accept_${collabId}`)
              .setLabel("Accetta Collaborazione")
              .setStyle(ButtonStyle.Success)
              .setEmoji("✅"),
            new ButtonBuilder()
              .setCustomId(`collab_reject_${collabId}`)
              .setLabel("Rifiuta")
              .setStyle(ButtonStyle.Danger)
              .setEmoji("❌")
          );

          const msg = await channel.send({ embeds: [embed], components: [row] }).catch(() => null);
          if (msg) {
            newCollab.notificationChannelId = channel.id;
            newCollab.notificationMessageId = msg.id;
          }
        }
      }
    } catch (err) {
      console.error("[PartnershipEngine] Errore notifica collab Discord:", err.message);
    }
  }

  data.collaborations.push(newCollab);
  saveCollaborations(data);
  return newCollab;
}

async function acceptCollabRequest({ client, collabId, responderUserId }) {
  const data = loadCollaborations();
  const collab = (data.collaborations || []).find(c => c.id === collabId);
  if (!collab) throw new Error("Collaborazione non trovata.");
  if (collab.status !== "pending") throw new Error(`La richiesta è già in stato "${collab.status}".`);

  collab.status = "accepted";
  collab.respondedAt = new Date().toISOString();
  collab.respondedBy = responderUserId || "Owner/Admin";

  if (client && collab.notificationChannelId && collab.notificationMessageId) {
    try {
      const g = client.guilds.cache.get(collab.targetGuildId);
      const ch = g?.channels?.cache.get(collab.notificationChannelId);
      const msg = await ch?.messages?.fetch(collab.notificationMessageId).catch(() => null);
      if (msg) {
        const embed = EmbedBuilder.from(msg.embeds[0] || {})
          .setColor("#57F287")
          .setTitle("🤝 Collaborazione Partnership Accettata!")
          .setDescription(`La richiesta di collegamento con **${collab.requesterGuildName}** è stata **ACCETTATA** da <@${responderUserId}>.\nOra le partnership sono sincronizzate tra i due server!`);
        await msg.edit({ embeds: [embed], components: [] }).catch(() => null);
      }
    } catch(e) {}
  }

  saveCollaborations(data);
  return collab;
}

async function rejectCollabRequest({ client, collabId, responderUserId }) {
  const data = loadCollaborations();
  const collab = (data.collaborations || []).find(c => c.id === collabId);
  if (!collab) throw new Error("Collaborazione non trovata.");
  if (collab.status !== "pending") throw new Error(`La richiesta è già in stato "${collab.status}".`);

  collab.status = "rejected";
  collab.respondedAt = new Date().toISOString();
  collab.respondedBy = responderUserId || "Owner/Admin";

  if (client && collab.notificationChannelId && collab.notificationMessageId) {
    try {
      const g = client.guilds.cache.get(collab.targetGuildId);
      const ch = g?.channels?.cache.get(collab.notificationChannelId);
      const msg = await ch?.messages?.fetch(collab.notificationMessageId).catch(() => null);
      if (msg) {
        const embed = EmbedBuilder.from(msg.embeds[0] || {})
          .setColor("#ED4245")
          .setTitle("❌ Collaborazione Partnership Rifiutata")
          .setDescription(`La richiesta di collegamento con **${collab.requesterGuildName}** è stata **RIFIUTATA** da <@${responderUserId}>.`);
        await msg.edit({ embeds: [embed], components: [] }).catch(() => null);
      }
    } catch(e) {}
  }

  saveCollaborations(data);
  return collab;
}

async function removeCollaboration({ client, collabId, removerUserId }) {
  const data = loadCollaborations();
  const collab = (data.collaborations || []).find(c => c.id === collabId);
  if (!collab) throw new Error("Collaborazione non trovata.");

  collab.status = "revoked";
  collab.revokedAt = new Date().toISOString();
  collab.revokedBy = removerUserId || "Dashboard Admin";

  saveCollaborations(data);
  return collab;
}

async function cancelCollabRequest({ client, collabId, requesterUserId }) {
  const data = loadCollaborations();
  const collab = (data.collaborations || []).find(c => c.id === collabId);
  if (!collab) throw new Error("Collaborazione non trovata.");
  if (collab.status !== "pending") throw new Error("Solo le richieste in sospeso possono essere annullate.");

  collab.status = "cancelled";
  collab.cancelledAt = new Date().toISOString();
  collab.cancelledBy = requesterUserId || "Dashboard Admin";

  if (client && collab.notificationChannelId && collab.notificationMessageId) {
    try {
      const g = client.guilds.cache.get(collab.targetGuildId);
      const ch = g?.channels?.cache.get(collab.notificationChannelId);
      const msg = await ch?.messages?.fetch(collab.notificationMessageId).catch(() => null);
      if (msg) await msg.delete().catch(() => null);
    } catch(e) {}
  }

  saveCollaborations(data);
  return collab;
}

function initPartnershipEngine(client, loadSettingsFn) {
  
  // 1. Auto-Leave Detector: Se il collaboratore lascia il server, cancella la partnership
  client.on("guildMemberRemove", async (member) => {
    try {
      const data = loadPartners();
      const collaboratorId = member.id;
      const activePartners = (data.partners || []).filter(p => p.collaboratorId === collaboratorId && !p.deleted);

      if (activePartners.length === 0) return;

      console.log(`[PartnershipEngine] Collaboratore ${member.user.tag} (${member.id}) uscito da ${member.guild.name}. Revoca automatica di ${activePartners.length} partnership!`);

      const revokedNumbers = [];

      for (const partner of activePartners) {
        partner.deleted = true;
        partner.deletedAt = new Date().toISOString();
        partner.deletedBy = "Auto-Leave Detector";
        partner.deleteReason = `Collaboratore uscito da ${member.guild.name}`;
        revokedNumbers.push(partner.number);

        // Cancella messaggi inviati nei vari server
        for (const m of (partner.messages || [])) {
          try {
            const guild = client.guilds.cache.get(m.guildId);
            if (guild) {
              const channel = guild.channels.cache.get(m.channelId);
              if (channel && channel.isTextBased()) {
                const msg = await channel.messages.fetch(m.messageId).catch(() => null);
                if (msg) await msg.delete().catch(() => null);
              }
            }
          } catch (err) {}
        }
      }

      savePartners(data);

      // Invia notifica log nei canali log configurati
      const settings = loadSettingsFn();
      for (const [guildId, guildConfig] of Object.entries(settings)) {
        const logChannelId = guildConfig.partnerships?.logChannelId || guildConfig.logs?.categories?.moderation?.channelId || guildConfig.logs?.globalChannelId;
        if (!logChannelId) continue;
        const guild = client.guilds.cache.get(guildId);
        if (!guild) continue;
        const channel = guild.channels.cache.get(logChannelId);
        if (channel && channel.isTextBased()) {
          const embed = new EmbedBuilder()
            .setTitle("🚫 Partnership Revocata Automaticamente")
            .setColor("#f23f43")
            .setDescription(
              `> **Collaboratore:** <@${member.id}> (\`${member.user.tag}\`)\n` +
              `> **Server di uscita:** **${member.guild.name}**\n` +
              `> **Partnership revocate:** ${revokedNumbers.map(n => '#' + n).join(', ')}\n` +
              `> **Azione:** Messaggi eliminati da tutti i canali sincronizzati per reciprocità.`
            )
            .setTimestamp();
          channel.send({ embeds: [embed] }).catch(() => null);
        }
      }

    } catch (e) {
      console.error("[PartnershipEngine] Errore auto-leave listener:", e);
    }
  });

  // 2. Interaction handling for slash command /partner & collab buttons
  client.on("interactionCreate", async (interaction) => {
    // Gestione Pulsanti Discord per Richieste Collaborazione
    if (interaction.isButton()) {
      if (interaction.customId.startsWith("collab_accept_")) {
        const collabId = interaction.customId.replace("collab_accept_", "");
        const member = interaction.member;
        const isOwner = interaction.guild?.ownerId === member?.id;
        const isAdmin = member?.permissions?.has(PermissionFlagsBits.Administrator) || member?.permissions?.has(PermissionFlagsBits.ManageGuild);
        if (!isOwner && !isAdmin) {
          return interaction.reply({
            content: "❌ Solo l'Owner o un Amministratore può accettare le richieste di collaborazione tra server.",
            ephemeral: true
          });
        }
        try {
          await acceptCollabRequest({ client, collabId, responderUserId: interaction.user.id });
          return interaction.reply({
            content: "✅ Collaborazione accettata con successo! Ora i due server sono collegati per le partnership.",
            ephemeral: true
          });
        } catch(e) {
          return interaction.reply({ content: `⚠️ ${e.message}`, ephemeral: true });
        }
      }

      if (interaction.customId.startsWith("collab_reject_")) {
        const collabId = interaction.customId.replace("collab_reject_", "");
        const member = interaction.member;
        const isOwner = interaction.guild?.ownerId === member?.id;
        const isAdmin = member?.permissions?.has(PermissionFlagsBits.Administrator) || member?.permissions?.has(PermissionFlagsBits.ManageGuild);
        if (!isOwner && !isAdmin) {
          return interaction.reply({
            content: "❌ Solo l'Owner o un Amministratore può rifiutare le richieste di collaborazione tra server.",
            ephemeral: true
          });
        }
        try {
          await rejectCollabRequest({ client, collabId, responderUserId: interaction.user.id });
          return interaction.reply({
            content: "❌ Richiesta di collaborazione rifiutata.",
            ephemeral: true
          });
        } catch(e) {
          return interaction.reply({ content: `⚠️ ${e.message}`, ephemeral: true });
        }
      }
    }

    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "partner") return;

    const guild = interaction.guild;
    if (!guild) return;

    const settings = loadSettingsFn();
    const guildConfig = settings[guild.id]?.partnerships || {};

    // Check staff permissions
    const member = interaction.member;
    const isStaff = member.permissions.has(PermissionFlagsBits.ManageGuild) ||
      (Array.isArray(guildConfig.staffRoleIds) && guildConfig.staffRoleIds.some(r => member.roles.cache.has(r)));

    if (!isStaff) {
      return interaction.reply({
        content: "❌ Non hai i permessi necessari per pubblicare partnership.",
        ephemeral: true
      });
    }

    const collaborator = interaction.options.getUser("collaboratore");
    const description = interaction.options.getString("descrizione");

    await interaction.deferReply({ ephemeral: true });

    const partnersData = loadPartners();
    const partnerNum = (partnersData.counter || 0) + 1;
    partnersData.counter = partnerNum;

    const sentMessages = [];
    const connectedGuildIds = getConnectedGuilds(guild.id);
    const targetGuilds = Object.entries(settings).filter(([gId, conf]) => {
      if (!conf.partnerships?.enabled || !conf.partnerships?.partnerChannelId) return false;
      return gId === guild.id || connectedGuildIds.includes(gId);
    });

    if (targetGuilds.length === 0) {
      return interaction.editReply({
        content: "⚠️ Nessun canale partnership configurato nei server sincronizzati."
      });
    }

    for (const [tGuildId, tConfig] of targetGuilds) {
      try {
        const tGuild = client.guilds.cache.get(tGuildId);
        if (!tGuild) continue;
        const targetChannelId = tConfig.partnerships.partnerChannelId || tConfig.partnerships.channelId;
        const pChannel = tGuild.channels.cache.get(targetChannelId);
        if (!pChannel || !pChannel.isTextBased()) continue;

        const ping = tConfig.partnerships.pingRole;

        // 1. Invio della descrizione in chiaro (messaggio normale così in sé, senza embed)
        const descChunks = splitMessageContent(description.trim(), 2000);
        for (const chunk of descChunks) {
          const sentDescMsg = await pChannel.send({
            content: chunk,
            allowedMentions: { parse: [] } // Evita menzioni o ping non autorizzati copiati nel testo del partner
          }).catch(() => null);

          if (sentDescMsg) {
            sentMessages.push({ guildId: tGuildId, channelId: pChannel.id, messageId: sentDescMsg.id });
          }
        }

        // 2. Invio del messaggio informativo (Embed stilizzato con le informazioni e il ping)
        const serverName = guild?.name || "RoomUp!";
        const embedColor = tConfig.partnerships?.embedColor || "#8A5CF6";

        let pingDisplay = "Nessuno";
        let pingContent = undefined;
        if (ping && ping !== "none" && ping !== "nessuno" && ping !== "no") {
          if (ping === "@everyone" || ping === "@here") {
            pingContent = ping;
            pingDisplay = ping;
          } else if (/^\d{17,20}$/.test(ping)) {
            pingContent = `<@&${ping}>`;
            pingDisplay = `<@&${ping}>`;
          } else if (ping.startsWith("<@&")) {
            pingContent = ping;
            pingDisplay = ping;
          }
        }

        const infoEmbed = await createPartnershipInfoEmbed({
          client,
          staffId: interaction.user.id,
          collaboratorId: collaborator.id,
          serverName,
          partnerNumber: partnerNum,
          pingDisplay,
          embedColor
        });

        const sentInfoMsg = await pChannel.send({
          content: pingContent,
          embeds: [infoEmbed],
          allowedMentions: { parse: ["roles", "users", "everyone"] }
        }).catch(() => null);

        if (sentInfoMsg) {
          sentMessages.push({ guildId: tGuildId, channelId: pChannel.id, messageId: sentInfoMsg.id });
        }
      } catch (err) {}
    }

    partnersData.partners.push({
      number: partnerNum,
      collaboratorId: collaborator.id,
      collaboratorTag: collaborator.tag,
      authorId: interaction.user.id,
      originGuildId: guild.id,
      description,
      createdAt: new Date().toISOString(),
      messages: sentMessages,
      deleted: false
    });

    savePartners(partnersData);

    return interaction.editReply({
      content: `✅ Partnership **#${partnerNum}** pubblicata con successo in **${sentMessages.length}** server sincronizzati!`
    });
  });

  console.log("[PartnershipEngine] Sistema Partnership Multi-Server e Rete Collaborazioni attivo!");
}

async function executePublishPartnership(client, loadSettingsFn, { originGuildId, collaboratorId, collaboratorTag, authorId, description, originGuildName }) {
  const settings = typeof loadSettingsFn === 'function' ? loadSettingsFn() : {};
  const partnersData = loadPartners();
  const partnerNum = (partnersData.counter || 0) + 1;
  partnersData.counter = partnerNum;

  const sentMessages = [];
  const connectedGuildIds = getConnectedGuilds(originGuildId);
  const targetGuilds = Object.entries(settings).filter(([gId, conf]) => {
    const chId = conf.partnerships?.partnerChannelId || conf.partnerships?.channelId;
    if (!conf.partnerships?.enabled || !chId) return false;
    return gId === originGuildId || connectedGuildIds.includes(gId);
  });

  for (const [tGuildId, tConfig] of targetGuilds) {
    try {
      const tGuild = client.guilds.cache.get(tGuildId);
      if (!tGuild) continue;
      const targetChannelId = tConfig.partnerships.partnerChannelId || tConfig.partnerships.channelId;
      const pChannel = tGuild.channels.cache.get(targetChannelId);
      if (!pChannel || !pChannel.isTextBased()) continue;

      const ping = tConfig.partnerships.pingRole;

      // 1. Invio della descrizione in chiaro (messaggio normale così in sé, senza embed)
      const descChunks = splitMessageContent(description.trim(), 2000);
      for (const chunk of descChunks) {
        const sentDescMsg = await pChannel.send({
          content: chunk,
          allowedMentions: { parse: [] } // Evita menzioni o ping non autorizzati copiati nel testo del partner
        }).catch(() => null);

        if (sentDescMsg) {
          sentMessages.push({ guildId: tGuildId, channelId: pChannel.id, messageId: sentDescMsg.id });
        }
      }

      // 2. Invio del messaggio informativo (Embed stilizzato con le informazioni e il ping)
      const effectiveStaffId = (authorId && authorId !== "SentinelAI" && authorId !== "Sentinel")
        ? authorId
        : (client.user ? client.user.id : "SentinelAI");

      const serverName = originGuildName || "RoomUp!";
      const embedColor = tConfig.partnerships?.embedColor || "#8A5CF6";

      let pingDisplay = "Nessuno";
      let pingContent = undefined;
      if (ping && ping !== "none" && ping !== "nessuno" && ping !== "no") {
        if (ping === "@everyone" || ping === "@here") {
          pingContent = ping;
          pingDisplay = ping;
        } else if (/^\d{17,20}$/.test(ping)) {
          pingContent = `<@&${ping}>`;
          pingDisplay = `<@&${ping}>`;
        } else if (ping.startsWith("<@&")) {
          pingContent = ping;
          pingDisplay = ping;
        }
      }

      const infoEmbed = await createPartnershipInfoEmbed({
        client,
        staffId: effectiveStaffId,
        collaboratorId,
        serverName,
        partnerNumber: partnerNum,
        pingDisplay,
        embedColor
      });

      const sentInfoMsg = await pChannel.send({
        content: pingContent,
        embeds: [infoEmbed],
        allowedMentions: { parse: ["roles", "users", "everyone"] }
      }).catch(() => null);

      if (sentInfoMsg) {
        sentMessages.push({ guildId: tGuildId, channelId: pChannel.id, messageId: sentInfoMsg.id });
      }
    } catch (err) {}
  }

  partnersData.partners.push({
    number: partnerNum,
    collaboratorId,
    collaboratorTag: collaboratorTag || collaboratorId,
    authorId,
    originGuildId,
    description,
    createdAt: new Date().toISOString(),
    messages: sentMessages,
    deleted: false
  });

  savePartners(partnersData);
  return { partnerNum, sentMessages };
}

module.exports = {
  initPartnershipEngine,
  loadPartners,
  savePartners,
  loadCollaborations,
  saveCollaborations,
  getConnectedGuilds,
  getGuildCollaborations,
  createCollabRequest,
  acceptCollabRequest,
  rejectCollabRequest,
  removeCollaboration,
  cancelCollabRequest,
  executePublishPartnership
};
