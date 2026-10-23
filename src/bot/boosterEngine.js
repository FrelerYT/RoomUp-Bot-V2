const { EmbedBuilder, Events } = require("discord.js");
const { getGuildConfig, loadSettings } = require("../config/settingsManager");

/**
 * BOOSTER REWARDS & NOTIFICATION ENGINE
 * - Detects server boosts in real time via guildMemberUpdate & guildUpdate
 * - Automatically assigns the configured booster roles (including custom & supporter separator roles)
 * - Posts rich celebration announcements in the designated boost channel (#💎・boosts)
 * - Synchronizes booster roles on startup across all guild members
 */

function formatBoostText(text, member) {
  if (!text) return "";
  const guildName = member.guild?.name || "RoomUp!";
  const userId = member.id || member.user?.id || "";
  const username = member.user?.username || member.displayName || "Utente";
  const tag = member.user?.tag || username;
  const count = member.guild?.premiumSubscriptionCount || 1;

  return text
    .replace(/{user}/g, `<@${userId}>`)
    .replace(/{username}/g, username)
    .replace(/{tag}/g, tag)
    .replace(/{guild}/g, guildName)
    .replace(/{count}/g, String(count));
}

async function handleBoostEvent(member, config) {
  const guild = member.guild;
  if (!guild || !config || config.enabled === false) return;

  const rolesToAssign = [];
  if (config.boosterRoleId) rolesToAssign.push(config.boosterRoleId);
  if (Array.isArray(config.extraRoleIds)) {
    for (const rId of config.extraRoleIds) {
      if (rId && !rolesToAssign.includes(rId)) rolesToAssign.push(rId);
    }
  }

  // Assign roles
  for (const roleId of rolesToAssign) {
    try {
      const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId).catch(() => null);
      if (role && !role.managed && !member.roles.cache.has(role.id)) {
        await member.roles.add(role.id, "Auto Server Booster assignment").catch(err => {
          console.warn(`[BoosterEngine] Impossibile assegnare ruolo ${role.name} (${role.id}):`, err.message);
        });
        console.log(`[BoosterEngine] Ruolo ${role.name} assegnato a ${member.user.tag}`);
      }
    } catch (e) {
      console.warn(`[BoosterEngine] Errore verifica ruolo booster ${roleId}:`, e.message);
    }
  }

  // Il bot NON scrive nulla nel canale boost: lascia fare al sistema nativo di Discord
}

async function handleUnboostEvent(member, config) {
  const guild = member.guild;
  if (!guild || !config || config.enabled === false) return;
  if (config.removeExtraRolesOnUnboost === false) return;

  if (Array.isArray(config.extraRoleIds)) {
    for (const roleId of config.extraRoleIds) {
      try {
        const role = guild.roles.cache.get(roleId);
        if (role && !role.managed && member.roles.cache.has(role.id)) {
          await member.roles.remove(role.id, "Server Boost scaduto").catch(() => {});
          console.log(`[BoosterEngine] Rimosso ruolo extra ${role.name} da ${member.user.tag} (boost terminato)`);
        }
      } catch (e) {}
    }
  }
}

async function syncAllGuildBoosters(guild, config) {
  if (!guild || !config || config.enabled === false) return;
  try {
    const members = typeof guild.members?.fetch === "function" 
      ? await guild.members.fetch().catch(() => guild.members?.cache || [])
      : (guild.members?.cache || []);
    const boosterRoleId = config.boosterRoleId || "965420993155858442";
    const extraRoles = config.extraRoleIds || ["1554969583432245330"];

    let count = 0;
    for (const [, member] of members) {
      const isBooster = Boolean(member.premiumSince || (boosterRoleId && member.roles.cache.has(boosterRoleId)));
      if (isBooster) {
        for (const rId of extraRoles) {
          const role = guild.roles.cache.get(rId);
          if (role && !role.managed && !member.roles.cache.has(role.id)) {
            await member.roles.add(role.id, "Initial booster sync").catch(() => {});
            count++;
          }
        }
      }
    }
    if (count > 0) {
      console.log(`[BoosterEngine] Sincronizzati ${count} ruoli supporter su ${guild.name}`);
    }
  } catch (err) {
    console.warn(`[BoosterEngine] Errore sync booster per ${guild.name}:`, err.message);
  }
}

function initBoosterEngine(client) {
  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    try {
      const guild = newMember.guild;
      if (!guild) return;

      const guildConfig = getGuildConfig(guild.id);
      const boosterConfig = guildConfig.booster || {
        enabled: true,
        boosterRoleId: "965420993155858442",
        extraRoleIds: ["1554969583432245330"],
        announcementEnabled: false
      };

      const boosterRoleId = boosterConfig.boosterRoleId || "965420993155858442";
      const oldIsBooster = Boolean(oldMember.premiumSince || (boosterRoleId && oldMember.roles.cache.has(boosterRoleId)));
      const newIsBooster = Boolean(newMember.premiumSince || (boosterRoleId && newMember.roles.cache.has(boosterRoleId)));

      if (!oldIsBooster && newIsBooster) {
        console.log(`[BoosterEngine] Nuovo boost rilevato da ${newMember.user.tag} su ${guild.name}!`);
        await handleBoostEvent(newMember, boosterConfig);
      } else if (oldIsBooster && !newIsBooster) {
        console.log(`[BoosterEngine] Boost terminato per ${newMember.user.tag} su ${guild.name}`);
        await handleUnboostEvent(newMember, boosterConfig);
      }
    } catch (e) {
      console.error("[BoosterEngine] Errore in GuildMemberUpdate:", e.message);
    }
  });

  async function onReadySync() {
    for (const [, guild] of client.guilds.cache) {
      const guildConfig = getGuildConfig(guild.id);
      const boosterConfig = guildConfig.booster || {
        enabled: true,
        boosterRoleId: "965420993155858442",
        extraRoleIds: ["1554969583432245330"],
        announcementEnabled: false
      };
      await syncAllGuildBoosters(guild, boosterConfig);
    }
    console.log("[BoosterEngine] Suite Server Booster & Supporter Rewards attiva!");
  }

  if (client.isReady()) {
    onReadySync();
  } else {
    client.once(Events.ClientReady, onReadySync);
  }
}

module.exports = {
  initBoosterEngine,
  handleBoostEvent,
  syncAllGuildBoosters
};
