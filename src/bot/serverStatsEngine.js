const { Events, ChannelType, PermissionFlagsBits } = require("discord.js");

// Discord rate limit for channel renaming: max 2 changes per 10 minutes (600,000ms)
const channelRenameTimers = new Map(); // channelId -> array of timestamps
const pendingRenameTimeouts = new Map(); // channelId -> timeoutHandle

function canRenameChannel(channelId) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const history = (channelRenameTimers.get(channelId) || []).filter(ts => now - ts < windowMs);
  channelRenameTimers.set(channelId, history);
  return history.length < 2;
}

function recordRename(channelId) {
  const history = channelRenameTimers.get(channelId) || [];
  history.push(Date.now());
  channelRenameTimers.set(channelId, history);
}

function scheduleDeferredRename(guild, config, delayMs = 300000) {
  const guildKey = guild.id;
  if (pendingRenameTimeouts.has(guildKey)) return;
  const t = setTimeout(() => {
    pendingRenameTimeouts.delete(guildKey);
    updateGuildStats(guild, config).catch(() => null);
  }, delayMs);
  if (t.unref) t.unref();
  pendingRenameTimeouts.set(guildKey, t);
}

async function updateGuildStats(guild, config) {
  if (!guild || !config || !config.enabled) return;

  try {
    const totalMembers = guild.memberCount;

    if (config.membersChannelId) {
      const ch = guild.channels.cache.get(config.membersChannelId);
      if (ch) {
        const newName = (config.membersFormat || "👥 Membri: {count}").replace(/{count}/g, String(totalMembers));
        if (ch.name !== newName) {
          if (canRenameChannel(ch.id)) {
            recordRename(ch.id);
            await ch.setName(newName).catch(() => null);
          } else {
            scheduleDeferredRename(guild, config);
          }
        }
      }
    }

    if (config.boostChannelId) {
      const ch = guild.channels.cache.get(config.boostChannelId);
      if (ch) {
        const tier = guild.premiumTier;
        const newName = `🚀 Boost: Livello ${tier}`;
        if (ch.name !== newName) {
          if (canRenameChannel(ch.id)) {
            recordRename(ch.id);
            await ch.setName(newName).catch(() => null);
          } else {
            scheduleDeferredRename(guild, config);
          }
        }
      }
    }
  } catch (e) {
    console.error(`[ServerStatsEngine] Errore update stats per ${guild.name}:`, e.message);
  }
}

function initServerStatsEngine(client, loadSettingsFn) {
  // Update on member join/leave
  client.on(Events.GuildMemberAdd, (member) => {
    const settings = typeof loadSettingsFn === "function" ? loadSettingsFn() : {};
    const config = settings[member.guild.id]?.serverStats;
    updateGuildStats(member.guild, config);
  });

  client.on(Events.GuildMemberRemove, (member) => {
    const settings = typeof loadSettingsFn === "function" ? loadSettingsFn() : {};
    const config = settings[member.guild.id]?.serverStats;
    updateGuildStats(member.guild, config);
  });

  // Periodic check (every 10 mins)
  setInterval(() => {
    try {
      const settings = typeof loadSettingsFn === "function" ? loadSettingsFn() : {};
      for (const [_, guild] of client.guilds.cache) {
        const config = settings[guild.id]?.serverStats;
        updateGuildStats(guild, config);
      }
    } catch (e) {}
  }, 10 * 60 * 1000);

  console.log("[ServerStatsEngine] Sistema Server Statistics live attivo!");
}

module.exports = {
  initServerStatsEngine,
  updateGuildStats
};
