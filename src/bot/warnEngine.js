const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { applyBanIsolation } = require("./unbanAppealEngine");

const INFRACTIONS_FILE = path.join(__dirname, "../../data/infractions.json");

function ensureDataDir() {
  const dir = path.dirname(INFRACTIONS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadInfractions() {
  ensureDataDir();
  try {
    if (!fs.existsSync(INFRACTIONS_FILE)) {
      fs.writeFileSync(INFRACTIONS_FILE, JSON.stringify({}, null, 2), "utf8");
      return {};
    }
    return JSON.parse(fs.readFileSync(INFRACTIONS_FILE, "utf8"));
  } catch (e) {
    console.error("[WarnEngine] Errore lettura infractions.json:", e.message);
    return {};
  }
}

function saveInfractions(data) {
  ensureDataDir();
  try {
    fs.writeFileSync(INFRACTIONS_FILE, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (e) {
    console.error("[WarnEngine] Errore salvataggio infractions.json:", e.message);
    return false;
  }
}

function getGuildUserInfractions(guildId, userId) {
  const data = loadInfractions();
  if (!data[guildId]) data[guildId] = {};
  if (!data[guildId][userId]) data[guildId][userId] = [];
  return data[guildId][userId];
}

/**
 * Rileva automaticamente i 3 ruoli warn del server (1° Warn, 2° Warn, 3° Warn)
 * Senza bisogno di ID hardcodati.
 */
function detectWarnRoles(guild) {
  if (!guild || !guild.roles) return { warn1: null, warn2: null, warn3: null };
  const roles = guild.roles.cache;

  // 1° Warn
  const warn1 = roles.find(r =>
    !r.name.includes("║") && /(?:^|\b)(?:1[°º]?\s*warn|warn\s*1\b|warn\s*i\b)/i.test(r.name)
  );

  // 2° Warn
  const warn2 = roles.find(r =>
    !r.name.includes("║") && /(?:^|\b)(?:2[°º]?\s*warn|warn\s*2\b|warn\s*ii\b)/i.test(r.name)
  );

  // 3° Warn
  const warn3 = roles.find(r =>
    !r.name.includes("║") && /(?:^|\b)(?:3[°º]?\s*warn|warn\s*3\b|warn\s*iii\b)/i.test(r.name)
  );

  return { warn1, warn2, warn3 };
}

/**
 * Rileva automaticamente tutti i Founder e Owner del server (tramite ruoli e proprietario del server)
 */
async function detectOwnerFounderMembers(guild) {
  if (!guild) return [];
  const recipients = new Map();

  // 1. Proprietario effettivo del server Discord
  try {
    if (guild.ownerId) {
      const ownerMember = guild.members.cache.get(guild.ownerId) || await guild.members.fetch(guild.ownerId).catch(() => null);
      if (ownerMember && !ownerMember.user.bot) {
        recipients.set(ownerMember.id, ownerMember);
      }
    }
  } catch (e) {}

  // 2. Ruoli Founder e Owner (ignorando separatori estetici contenenti '║')
  try {
    const ofRoles = guild.roles.cache.filter(r =>
      !r.name.includes("║") && /(?:^|\b)(owner|founder|fondatore|proprietario)(?:$|\b)/i.test(r.name)
    );
    for (const [, role] of ofRoles) {
      for (const [, member] of role.members) {
        if (!member.user.bot) {
          recipients.set(member.id, member);
        }
      }
    }
  } catch (e) {}

  return Array.from(recipients.values());
}

/**
 * Sincronizza i ruoli disciplinari dell'utente in base al numero totale di warn:
 * - 1 warn -> Assegna 1° Warn, rimuove gli altri
 * - 2 warn -> Assegna 2° Warn, rimuove gli altri
 * - 3+ warn -> Assegna 3° Warn, rimuove gli altri
 * - 0 warn -> Rimuove tutti i ruoli warn
 */
async function syncWarnRoles(guild, targetMember, totalWarns) {
  if (!targetMember || !targetMember.roles) return { targetRole: null, removedRoles: [] };
  const { warn1, warn2, warn3 } = detectWarnRoles(guild);

  let targetRole = null;
  if (totalWarns === 1) targetRole = warn1;
  else if (totalWarns === 2) targetRole = warn2;
  else if (totalWarns >= 3) targetRole = warn3;

  const removedRoles = [];

  // Rimuovi gli altri ruoli warn non corrispondenti al livello attuale
  for (const r of [warn1, warn2, warn3]) {
    if (!r) continue;
    if (r.id !== targetRole?.id && targetMember.roles.cache.has(r.id)) {
      await targetMember.roles.remove(r.id, "Sincronizzazione livello warn").catch(() => null);
      removedRoles.push(r.name);
    }
  }

  // Aggiungi il ruolo bersaglio se mancante
  if (targetRole && !targetMember.roles.cache.has(targetRole.id)) {
    await targetMember.roles.add(targetRole.id, `Assegnazione automatica ${targetRole.name} (${totalWarns} warn)`).catch(() => null);
  }

  return { targetRole, removedRoles, warnRoles: { warn1, warn2, warn3 } };
}

/**
 * Notifica immediata a Owner e Founder via DM e nel canale log al raggiungimento del 3° warn
 */
async function notifyOwnerAndFounderOnWarn3({ guild, targetUser, moderator, reason, totalWarns, infractions = [], config = {} }) {
  const recipients = await detectOwnerFounderMembers(guild);

  const embed = new EmbedBuilder()
    .setTitle("🚨 ALERT WARN 3: Membro al Limite delle Sanzioni!")
    .setColor("#f23f43")
    .setDescription(
      `L'utente <@${targetUser.id}> (**${targetUser.tag || targetUser.username}**) ha appena raggiunto **${totalWarns} WARN** su **${guild.name}**!\n\n` +
      `È stato assegnato automaticamente il ruolo **3° Warn**.`
    )
    .addFields(
      { name: "👤 Utente Sanzionato", value: `<@${targetUser.id}> (\`${targetUser.id}\`)`, inline: true },
      { name: "🛡️ Moderatore", value: `<@${moderator.id}> (${moderator.tag || moderator.username})`, inline: true },
      { name: "⚠️ Livello Sanzioni", value: `**${totalWarns}° Warn** (Ruolo 3° Warn applicato)`, inline: true },
      { name: "📝 Ultimo Motivo (3° Warn)", value: reason || "Nessuna motivazione fornita", inline: false }
    )
    .setThumbnail(targetUser.displayAvatarURL ? targetUser.displayAvatarURL({ dynamic: true }) : null)
    .setTimestamp()
    .setFooter({ text: `${guild.name} • Sistema Notifiche Automatiche Founder & Owner` });

  if (Array.isArray(infractions) && infractions.length > 0) {
    const list = infractions.slice(-3).map((inf, i) => {
      const d = inf.timestamp ? new Date(inf.timestamp).toLocaleDateString("it-IT") : "N/D";
      return `**${i + 1}.** [${d}] ${inf.reason} (Mod: <@${inf.moderatorId}>)`;
    }).join("\n");
    embed.addFields({ name: "📋 Storico degli Avvertimenti", value: list || "Nessuno storico", inline: false });
  }

  let notifiedCount = 0;
  for (const recipient of recipients) {
    try {
      await recipient.send({ embeds: [embed] }).catch(() => null);
      notifiedCount++;
    } catch (e) {}
  }

  // Invia avviso nel canale di log se configurato
  if (config.logChannelId) {
    const logCh = guild.channels.cache.get(config.logChannelId);
    if (logCh && logCh.isTextBased()) {
      await logCh.send({
        content: `🚨 **ATTENZIONE FOUNDER & OWNER** — <@${targetUser.id}> ha raggiunto il **3° WARN**!`,
        embeds: [embed]
      }).catch(() => null);
    }
  }

  return { notifiedCount, recipientCount: recipients.length };
}

async function addInfraction(guild, targetUser, moderator, reason, type = "warn", loadSettingsFn = null) {
  const data = loadInfractions();
  if (!data[guild.id]) data[guild.id] = {};
  if (!data[guild.id][targetUser.id]) data[guild.id][targetUser.id] = [];

  const infraction = {
    id: `inf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    type,
    reason: reason || "Nessuna motivazione specificata",
    moderatorId: moderator.id,
    moderatorTag: moderator.tag || moderator.username,
    timestamp: new Date().toISOString()
  };

  data[guild.id][targetUser.id].push(infraction);
  saveInfractions(data);

  const totalWarns = data[guild.id][targetUser.id].filter(i => i.type === "warn").length;

  const settings = typeof loadSettingsFn === 'function' ? loadSettingsFn() : {};
  const config = settings[guild.id]?.warns || {};

  const timeoutWarns = config.timeoutAtWarns || (config.timeoutAt3 !== false ? 3 : 0);
  const kickWarns = config.kickAtWarns || (config.kickAt5 !== false ? 5 : 0);
  const banWarns = config.banAtWarns || (config.banAt7 !== false ? 7 : 0);
  const timeoutMins = config.timeoutDurationMinutes || 60;

  let escalationAction = null;
  const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

  // 1. Sincronizzazione automatica dei 3 ruoli Warn
  let roleSync = null;
  if (type === "warn" && targetMember) {
    roleSync = await syncWarnRoles(guild, targetMember, totalWarns);
  }

  // 2. Se raggiunge 3 warn -> Notifica Founder & Owner
  let ownerNotification = null;
  if (type === "warn" && totalWarns >= 3) {
    ownerNotification = await notifyOwnerAndFounderOnWarn3({
      guild,
      targetUser,
      moderator,
      reason,
      totalWarns,
      infractions: data[guild.id][targetUser.id].filter(i => i.type === "warn"),
      config
    });
  }

  if (config.autoEscalation !== false && targetMember && targetMember.moderatable) {
    if (banWarns > 0 && totalWarns >= banWarns) {
      escalationAction = `BAN AUTOMATICO (${totalWarns} Warn)`;
      await targetMember.ban({ reason: `Soglia massima infrazioni raggiunta (${banWarns} Warn): ${reason}` }).catch(() => null);
    } else if (kickWarns > 0 && totalWarns >= kickWarns) {
      escalationAction = `ESPULSIONE (KICK) AUTOMATICA (${totalWarns} Warn)`;
      await targetMember.kick(`Soglia infrazioni intermedia raggiunta (${kickWarns} Warn): ${reason}`).catch(() => null);
    } else if (timeoutWarns > 0 && totalWarns >= timeoutWarns) {
      escalationAction = `TIMEOUT AUTOMATICO (${timeoutMins}m)`;
      await targetMember.timeout(timeoutMins * 60 * 1000, `Soglia ${timeoutWarns} Warn raggiunta: ${reason}`).catch(() => null);
    }
  }

  return { infraction, totalWarns, escalationAction, roleSync, ownerNotification };
}

function removeLastInfraction(guildId, userId) {
  const data = loadInfractions();
  if (!data[guildId] || !data[guildId][userId] || data[guildId][userId].length === 0) {
    return { removed: null, totalWarns: 0 };
  }
  const userInfractions = data[guildId][userId];
  let lastIdx = -1;
  for (let i = userInfractions.length - 1; i >= 0; i--) {
    if (userInfractions[i].type === "warn") {
      lastIdx = i;
      break;
    }
  }
  if (lastIdx === -1) {
    return { removed: null, totalWarns: 0 };
  }
  const [removed] = userInfractions.splice(lastIdx, 1);
  saveInfractions(data);
  const totalWarns = userInfractions.filter(i => i.type === "warn").length;
  return { removed, totalWarns };
}

function clearUserInfractions(guildId, userId) {
  const data = loadInfractions();
  if (data[guildId] && data[guildId][userId]) {
    const count = data[guildId][userId].length;
    data[guildId][userId] = [];
    saveInfractions(data);
    return count;
  }
  return 0;
}

function initWarnEngine(client, loadSettingsFn) {
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, guild, member } = interaction;
    if (!guild) return;

    const settings = typeof loadSettingsFn === 'function' ? loadSettingsFn() : {};
    const config = settings[guild.id]?.warns || {};

    // 1. COMANDO /warn
    if (commandName === "warn") {
      if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.reply({ content: "❌ Non hai i permessi per moderare i membri.", ephemeral: true });
      }

      const targetUser = interaction.options.getUser("utente", true);
      const reason = interaction.options.getString("motivo") || "Nessuna motivazione fornita";

      if (targetUser.id === interaction.user.id) {
        return interaction.reply({ content: "❌ Non puoi sanzionare te stesso!", ephemeral: true });
      }

      const result = await addInfraction(guild, targetUser, interaction.user, reason, "warn", loadSettingsFn);

      const embedColor = config.warnEmbedColor || (result.totalWarns >= 3 ? "#f23f43" : (result.totalWarns === 2 ? "#f0b232" : "#5865F2"));
      const assignedRoleName = result.roleSync?.targetRole?.name
        ? result.roleSync.targetRole.name
        : (result.totalWarns === 1 ? "1° Warn" : result.totalWarns === 2 ? "2° Warn" : "3° Warn");

      const embed = new EmbedBuilder()
        .setTitle("⚠️ Avvertimento Assegnato")
        .setColor(embedColor)
        .addFields(
          { name: "Utente Sanzionato", value: `<@${targetUser.id}> (${targetUser.tag || targetUser.username})`, inline: true },
          { name: "Moderatore", value: `<@${interaction.user.id}>`, inline: true },
          { name: "Totale Warn", value: `**${result.totalWarns}**`, inline: true },
          { name: "Ruolo Disciplinare", value: `🏷️ **${assignedRoleName}**`, inline: true },
          { name: "Motivazione", value: reason, inline: false }
        )
        .setTimestamp();

      // Notifica Owner & Founder se raggiunge 3 warn
      if (result.totalWarns >= 3) {
        embed.addFields({
          name: "🚨 Notifica Founder & Owner Inviata",
          value: `L'utente ha raggiunto la soglia di **3 Warn**! Notifica automatica recapitata a Founder & Owner del server via DM.`,
          inline: false
        });
      }

      if (result.escalationAction) {
        embed.addFields({
          name: "🚨 Sanzione a Soglia Scattata",
          value: `**${result.escalationAction}** applicata automaticamente dal sistema disciplinare!`,
          inline: false
        });
      }

      await interaction.reply({ embeds: [embed] });

      // DM User
      if (config.sendDmOnWarn !== false) {
        const dmTpl = config.customWarnDmMessage || "⚠️ Sei stato avvertito nel server **{guild}** da <@{moderator}> per: *{reason}*. Totale infrazioni: **{totalWarns}** (Ruolo: **{role}**).";
        const dmText = dmTpl
          .replace(/{guild}/g, guild.name)
          .replace(/{moderator}/g, interaction.user.id)
          .replace(/{reason}/g, reason)
          .replace(/{role}/g, assignedRoleName)
          .replace(/{totalWarns}/g, String(result.totalWarns));
        targetUser.send({ content: dmText }).catch(() => null);
      }

      // Send Log
      if (config.logChannelId) {
        const logChannel = guild.channels.cache.get(config.logChannelId);
        if (logChannel && logChannel.isTextBased()) {
          logChannel.send({ embeds: [embed] }).catch(() => null);
        }
      }
    }

    // 2. COMANDO /unwarn
    if (commandName === "unwarn") {
      if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.reply({ content: "❌ Non hai i permessi per moderare i membri.", ephemeral: true });
      }

      const targetUser = interaction.options.getUser("utente", true);
      const reason = interaction.options.getString("motivo") || "Revoca manuale dello staff";

      const { removed, totalWarns } = removeLastInfraction(guild.id, targetUser.id);
      if (!removed) {
        return interaction.reply({ content: `⚠️ <@${targetUser.id}> non ha alcun warn attivo da revocare.`, ephemeral: true });
      }

      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
      let roleSync = null;
      if (targetMember) {
        roleSync = await syncWarnRoles(guild, targetMember, totalWarns);
      }

      const roleText = roleSync?.targetRole
        ? `🏷️ Ruolo aggiornato a **${roleSync.targetRole.name}**`
        : `🏷️ Tutti i ruoli warn rimossi (ora ha 0 warn)`;

      const embed = new EmbedBuilder()
        .setTitle("✅ Avvertimento Revocato")
        .setColor("#57F287")
        .setDescription(`È stato revocato l'ultimo warn a <@${targetUser.id}>.`)
        .addFields(
          { name: "Utente", value: `<@${targetUser.id}>`, inline: true },
          { name: "Moderatore", value: `<@${interaction.user.id}>`, inline: true },
          { name: "Warn Rimanenti", value: `**${totalWarns}**`, inline: true },
          { name: "Stato Ruolo", value: roleText, inline: false },
          { name: "Motivo Revoca", value: reason, inline: false }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // 3. COMANDO /warnings
    if (commandName === "warnings") {
      if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.reply({ content: "❌ Solo lo Staff può consultare lo storico delle sanzioni disciplinari.", ephemeral: true });
      }
      const targetUser = interaction.options.getUser("utente") || interaction.user;
      const infractions = getGuildUserInfractions(guild.id, targetUser.id);

      const embed = new EmbedBuilder()
        .setTitle(`📋 Storico Infrazioni • ${targetUser.tag || targetUser.username}`)
        .setColor("#5865F2")
        .setThumbnail(targetUser.displayAvatarURL ? targetUser.displayAvatarURL({ dynamic: true }) : null)
        .setDescription(
          infractions.length === 0
            ? "✅ Questo utente ha la fedina pulita! Nessuna sanzione o avvertimento attivo."
            : `Totale infrazioni registrate: **${infractions.length}**`
        );

      infractions.slice(-10).forEach((inf, idx) => {
        embed.addFields({
          name: `#${idx + 1} | ${inf.type.toUpperCase()} • ${new Date(inf.timestamp).toLocaleDateString('it-IT')}`,
          value: `**Motivo:** ${inf.reason}\n**Mod:** <@${inf.moderatorId}> (ID: \`${inf.id}\`)`
        });
      });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // 4. COMANDO /clearwarns
    if (commandName === "clearwarns") {
      if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: "❌ Solo gli amministratori possono azzerare i warn.", ephemeral: true });
      }
      const targetUser = interaction.options.getUser("utente", true);
      const count = clearUserInfractions(guild.id, targetUser.id);

      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
      if (targetMember) {
        await syncWarnRoles(guild, targetMember, 0);
      }

      return interaction.reply({
        content: `✅ Fedina azzerata per <@${targetUser.id}>. Rimossi **${count}** avvertimenti e revocati tutti i ruoli warn.`,
        ephemeral: true
      });
    }

    // 5. COMANDO /timeout
    if (commandName === "timeout") {
      if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.reply({ content: "❌ Permessi insufficienti per applicare timeout.", ephemeral: true });
      }
      const targetUser = interaction.options.getUser("utente", true);
      const minutes = interaction.options.getInteger("minuti", true);
      const reason = interaction.options.getString("motivo") || "Nessun motivo specificato";

      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
      if (!targetMember || !targetMember.moderatable) {
        return interaction.reply({ content: "❌ Impossibile applicare il timeout a questo utente (permessi superiori o bot).", ephemeral: true });
      }

      await targetMember.timeout(minutes * 60 * 1000, reason);
      await addInfraction(guild, targetUser, interaction.user, `${reason} (${minutes}m timeout)`, "timeout");

      return interaction.reply({
        content: `⏳ <@${targetUser.id}> è stato isolato in timeout per **${minutes} minuti** da <@${interaction.user.id}>.\n**Motivo:** ${reason}`
      });
    }

    // 6. COMANDO /kick
    if (commandName === "kick") {
      if (!member.permissions.has(PermissionFlagsBits.KickMembers)) {
        return interaction.reply({ content: "❌ Permessi insufficienti per espellere membri.", ephemeral: true });
      }
      const targetUser = interaction.options.getUser("utente", true);
      const reason = interaction.options.getString("motivo") || "Nessun motivo specificato";
      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

      if (!targetMember || !targetMember.kickable) {
        return interaction.reply({ content: "❌ Impossibile espellere questo utente.", ephemeral: true });
      }

      await targetMember.kick(reason);
      await addInfraction(guild, targetUser, interaction.user, reason, "kick");

      return interaction.reply({
        content: `👢 <@${targetUser.id}> è stato espulso dal server da <@${interaction.user.id}>.\n**Motivo:** ${reason}`
      });
    }

    // 7. COMANDO /ban
    if (commandName === "ban") {
      if (!member.permissions.has(PermissionFlagsBits.BanMembers)) {
        return interaction.reply({ content: "❌ Permessi insufficienti per bannare membri.", ephemeral: true });
      }
      const targetUser = interaction.options.getUser("utente", true);
      const reason = interaction.options.getString("motivo") || "Nessun motivo specificato";

      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

      if (targetMember) {
        // Applica l'isolamento da ban (rimuove tutti i ruoli e assegna @bannat* che vede SOLO #🧧・unban)
        await applyBanIsolation(targetMember, reason, interaction.user);
      }

      await addInfraction(guild, targetUser, interaction.user, reason, "ban");

      return interaction.reply({
        content: `🔨 <@${targetUser.id}> è stato bannato e isolato dal server da <@${interaction.user.id}>.\nTutti i canali gli sono stati nascosti ed ha accesso unicamente al canale di ricorso <#1554969785165414551>.\n**Motivo:** ${reason}`
      });
    }
  });

  console.log("[WarnEngine] Suite Disciplinare & Sanzioni a Scaglioni (3 Ruoli Warn + Notifica Owner/Founder) Attiva!");
}

module.exports = {
  initWarnEngine,
  loadInfractions,
  saveInfractions,
  getGuildUserInfractions,
  detectWarnRoles,
  detectOwnerFounderMembers,
  syncWarnRoles,
  notifyOwnerAndFounderOnWarn3,
  addInfraction,
  removeLastInfraction,
  clearUserInfractions
};
