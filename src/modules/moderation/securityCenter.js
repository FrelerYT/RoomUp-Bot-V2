const { PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const { getGuildConfig, updateGuildConfig } = require("../../config/settingsManager");
const eventBus = require("../../core/eventBus");

async function enableLockdown(guild, reason = "Lockdown di emergenza attivato dallo Staff", actor = "Staff") {
  if (!guild) return { success: false, error: "Guild non trovata" };

  const lockedChannels = [];
  const textChannels = guild.channels.cache.filter(c => c.isTextBased() && !c.isThread());

  for (const [, ch] of textChannels) {
    try {
      await ch.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: false,
        AddReactions: false
      }, { reason: `Lockdown: ${reason}` });
      lockedChannels.push(ch.name);
    } catch {}
  }

  updateGuildConfig(guild.id, { security: { lockdown: true, lockdownReason: reason } });

  eventBus.emit("security.lockdown_enabled", { guildId: guild.id, actor, count: lockedChannels.length });
  return { success: true, count: lockedChannels.length, lockedChannels };
}

async function disableLockdown(guild, actor = "Staff") {
  if (!guild) return { success: false, error: "Guild non trovata" };

  const unlockedChannels = [];
  const textChannels = guild.channels.cache.filter(c => c.isTextBased() && !c.isThread());

  for (const [, ch] of textChannels) {
    try {
      await ch.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: null,
        AddReactions: null
      }, { reason: "Sblocco canali / fine Lockdown" });
      unlockedChannels.push(ch.name);
    } catch {}
  }

  updateGuildConfig(guild.id, { security: { lockdown: false, lockdownReason: "" } });

  eventBus.emit("security.lockdown_disabled", { guildId: guild.id, actor, count: unlockedChannels.length });
  return { success: true, count: unlockedChannels.length };
}

async function quarantineUser(member, reason = "Comportamento sospetto") {
  if (!member || !member.guild) return false;
  const cfg = getGuildConfig(member.guild.id);
  const qRoleId = cfg.security?.quarantineRoleId;

  if (qRoleId && member.guild.roles.cache.has(qRoleId)) {
    await member.roles.add(qRoleId, `Quarantine: ${reason}`).catch(() => {});
    eventBus.emit("security.quarantine_user", { guildId: member.guild.id, userId: member.id, reason });
    return true;
  }
  return false;
}

module.exports = {
  enableLockdown,
  disableLockdown,
  quarantineUser
};