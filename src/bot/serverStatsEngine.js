const { Events, ChannelType, PermissionFlagsBits } = require("discord.js");

async function updateGuildStats(guild, config) {
  if (!guild || !config || !config.enabled) return;

  try {
    const totalMembers = guild.memberCount;

    if (config.membersChannelId) {
      const ch = guild.channels.cache.get(config.membersChannelId);
      if (ch) {
        const newName = (config.membersFormat || "👥 Membri: {count}").replace(/{count}/g, String(totalMembers));
        if (ch.name !== newName) await ch.setName(newName).catch(() => null);
      }
    }

    if (config.boostChannelId) {
      const ch = guild.channels.cache.get(config.boostChannelId);
      if (ch) {
        const tier = guild.premiumTier;
        const newName = `🚀 Boost: Livello ${tier}`;
        if (ch.name !== newName) await ch.setName(newName).catch(() => null);
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
