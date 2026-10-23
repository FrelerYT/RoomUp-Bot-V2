const { PermissionFlagsBits } = require("discord.js");

function checkBotHierarchy(guild, targetMember) {
  if (!guild || !targetMember) return { canManage: true };
  const botMember = guild.members.me;
  if (!botMember) return { canManage: true };

  // Guild owner can never be moderated by bot
  if (targetMember.id === guild.ownerId) {
    return { canManage: false, reason: "L'utente è il proprietario del server." };
  }

  // Check highest role position
  if (targetMember.roles.highest.position >= botMember.roles.highest.position) {
    return {
      canManage: false,
      reason: `Il ruolo più alto di ${targetMember.user.username} (@${targetMember.roles.highest.name}) è superiore o uguale al ruolo del bot (@${botMember.roles.highest.name}).`
    };
  }

  return { canManage: true };
}

function checkUserPermission(member, guildConfig, actionKey, channelId = null) {
  if (!member) return false;
  // Guild owner always has access
  if (member.id === member.guild?.ownerId) return true;
  // Administrator permission check
  if (member.permissions?.has?.(PermissionFlagsBits.Administrator)) return true;

  const permConfig = guildConfig?.permissions?.[actionKey];
  if (!permConfig) {
    // Default fallback: allow if has ManageGuild
    return member.permissions?.has?.(PermissionFlagsBits.ManageGuild);
  }

  // Denied users take highest precedence
  if (permConfig.deniedUsers?.includes(member.id)) return false;

  // Denied roles
  if (permConfig.deniedRoles?.some(rId => member.roles.cache.has(rId))) return false;

  // Denied channels
  if (channelId && permConfig.deniedChannels?.includes(channelId)) return false;

  // Allowed users
  if (permConfig.allowedUsers?.includes(member.id)) return true;

  // Allowed roles
  if (permConfig.allowedRoles?.some(rId => member.roles.cache.has(rId))) return true;

  // Allowed channels
  if (channelId && permConfig.allowedChannels?.length > 0 && !permConfig.allowedChannels.includes(channelId)) {
    return false;
  }

  // Required Discord permission
  if (permConfig.requiredDiscordPermission) {
    const flag = PermissionFlagsBits[permConfig.requiredDiscordPermission];
    if (flag && member.permissions?.has?.(flag)) return true;
  }

  return false;
}

module.exports = { checkBotHierarchy, checkUserPermission };
