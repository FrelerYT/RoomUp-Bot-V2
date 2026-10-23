const { Events, AuditLogEvent, PermissionFlagsBits, EmbedBuilder } = require("discord.js");

// In-memory sliding window: guildId -> userId -> { channelDeletes: [], roleDeletes: [] }
const actionWindows = new Map();

function getActionWindow(guildId, userId) {
  const key = `${guildId}:${userId}`;
  if (!actionWindows.has(key)) {
    actionWindows.set(key, { channelDeletes: [], roleDeletes: [] });
  }
  return actionWindows.get(key);
}

function cleanWindow(list, windowMs = 10000) {
  const now = Date.now();
  return list.filter(ts => now - ts < windowMs);
}

async function triggerAntiNukeEmergency(guild, executor, reason, config = {}) {
  try {
    console.log(`[AntiNuke] 🚨 ALLERTA DI EMERGENZA: ${executor.tag} (${executor.id}) ha superato la soglia di sicurezza in ${guild.name} (${reason})!`);

    // Fetch member
    const member = guild.members.cache.get(executor.id) || await guild.members.fetch(executor.id).catch(() => null);
    if (member && member.manageable) {
      // 1. Strip Admin/Mod Roles Action
      if (config.stripRolesAction !== false) {
        const dangerousRoles = member.roles.cache.filter(r =>
          r.permissions.has(PermissionFlagsBits.Administrator) ||
          r.permissions.has(PermissionFlagsBits.ManageGuild) ||
          r.permissions.has(PermissionFlagsBits.ManageChannels) ||
          r.permissions.has(PermissionFlagsBits.ManageRoles)
        );

        for (const [_, role] of dangerousRoles) {
          await member.roles.remove(role, "ANTI-NUKE EMERGENCY: Revoca ruoli per protezione del server").catch(() => null);
        }
      }

      // 2. Apply timeout action
      if (config.timeoutAttackerAction !== false && member.moderatable) {
        await member.timeout(24 * 60 * 60 * 1000, "ANTI-NUKE EMERGENCY: Isolamento immediato per tentato nuke").catch(() => null);
      }
    }

    // Send Alert to Log Channel
    const logChannelId = config.logChannelId;
    if (logChannelId) {
      const channel = guild.channels.cache.get(logChannelId);
      if (channel && channel.isTextBased()) {
        const embed = new EmbedBuilder()
          .setTitle(config.emergencyEmbedTitle || "🚨 [ANTI-NUKE & PANIC MODE ATTIVATO]")
          .setColor(config.emergencyEmbedColor || "#f23f43")
          .setDescription(
            `> **Autore Rilevato:** <@${executor.id}> (\`${executor.tag}\`)\n` +
            `> **Infrazione:** **${reason}**\n` +
            `> **Azione Immediata:** Misure di sicurezza applicate per proteggere la community.`
          )
          .setThumbnail(executor.displayAvatarURL({ dynamic: true }))
          .setFooter({ text: "RoomUp! V2 Sentinel Anti-Nuke" })
          .setTimestamp();

        const pingContent = config.pingEveryoneOnPanic !== false ? "||@everyone|| 🚨 **EMERGENZA ANTI-NUKE**" : "🚨 **EMERGENZA ANTI-NUKE**";
        channel.send({ content: pingContent, embeds: [embed] }).catch(() => null);
      }
    }
  } catch (err) {
    console.error("[AntiNuke] Errore esecuzione protocollo di emergenza:", err.message);
  }
}

function initAntiNukeEngine(client, loadSettingsFn) {
  
  // 1. Channel Delete Watchdog
  client.on(Events.ChannelDelete, async (channel) => {
    try {
      if (!channel.guild) return;
      const settings = typeof loadSettingsFn === "function" ? loadSettingsFn() : {};
      const config = settings[channel.guild.id]?.antiNuke;
      if (!config || !config.enabled) return;
      if (config.protectChannels === false) return;

      const logs = await channel.guild.fetchAuditLogs({ type: AuditLogEvent.ChannelDelete, limit: 1 }).catch(() => null);
      const entry = logs?.entries?.first();
      if (!entry || entry.executor.id === client.user.id) return;
      if (Date.now() - entry.createdTimestamp > 3000) return;

      const window = getActionWindow(channel.guild.id, entry.executor.id);
      window.channelDeletes = cleanWindow(window.channelDeletes);
      window.channelDeletes.push(Date.now());

      const maxAllowed = config.maxChannelDeletes || 3;
      if (window.channelDeletes.length >= maxAllowed) {
        const logChannelId = config.logChannelId || settings[channel.guild.id]?.logs?.categories?.moderation?.channelId || settings[channel.guild.id]?.logs?.globalChannelId;
        await triggerAntiNukeEmergency(channel.guild, entry.executor, `Cancellazione rapida di ${window.channelDeletes.length} canali in meno di 10 secondi`, { ...config, logChannelId });
      }
    } catch (e) {}
  });

  // 2. Role Delete Watchdog
  client.on(Events.GuildRoleDelete, async (role) => {
    try {
      if (!role.guild) return;
      const settings = typeof loadSettingsFn === "function" ? loadSettingsFn() : {};
      const config = settings[role.guild.id]?.antiNuke;
      if (!config || !config.enabled) return;
      if (config.protectRoles === false) return;

      const logs = await role.guild.fetchAuditLogs({ type: AuditLogEvent.RoleDelete, limit: 1 }).catch(() => null);
      const entry = logs?.entries?.first();
      if (!entry || entry.executor.id === client.user.id) return;
      if (Date.now() - entry.createdTimestamp > 3000) return;

      const window = getActionWindow(role.guild.id, entry.executor.id);
      window.roleDeletes = cleanWindow(window.roleDeletes);
      window.roleDeletes.push(Date.now());

      const maxAllowed = config.maxRoleDeletes || 3;
      if (window.roleDeletes.length >= maxAllowed) {
        const logChannelId = config.logChannelId || settings[role.guild.id]?.logs?.categories?.moderation?.channelId || settings[role.guild.id]?.logs?.globalChannelId;
        await triggerAntiNukeEmergency(role.guild, entry.executor, `Cancellazione rapida di ${window.roleDeletes.length} ruoli in meno di 10 secondi`, logChannelId);
      }
    } catch (e) {}
  });

  console.log("[AntiNukeEngine] Sistema Anti-Nuke & Panic Mode attivo!");
}

module.exports = { initAntiNukeEngine };
