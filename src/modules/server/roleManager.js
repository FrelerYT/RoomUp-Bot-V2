const { readJsonSafe, writeJsonSafe } = require("../../core/storage");
const { scheduleTask } = require("../../core/scheduler");
const { getGuildConfig } = require("../../config/settingsManager");
const eventBus = require("../../core/eventBus");

function getRoleStorage() {
  return readJsonSafe("roles", {
    stickyRoles: {}, // { guildId: { userId: [roleId1, roleId2] } }
    tempRoles: []    // [ { id, guildId, userId, roleId, expiresAt } ]
  });
}

function saveRoleStorage(data) {
  return writeJsonSafe("roles", data);
}

async function handleMemberJoin(member) {
  if (!member || !member.guild || member.user?.bot) return;
  const cfg = getGuildConfig(member.guild.id);
  const roleCfg = cfg.roles || {};
  const storage = getRoleStorage();

  // 1. Instant Auto Roles
  if (Array.isArray(roleCfg.autoRoles) && roleCfg.autoRoles.length > 0) {
    for (const rId of roleCfg.autoRoles) {
      if (rId && member.guild.roles.cache.has(rId)) {
        await member.roles.add(rId, "AutoRole assegnato all'ingresso").catch(err => {
          console.warn("[RoleManager] Impossibile assegnare autoRole:", err.message);
        });
      }
    }
  }

  // 2. Delayed Auto Roles
  if (Array.isArray(roleCfg.delayedRoles) && roleCfg.delayedRoles.length > 0) {
    for (const delayed of roleCfg.delayedRoles) {
      const delayMs = Math.max(1000, (delayed.delayMinutes || 5) * 60 * 1000);
      scheduleTask({
        type: "assign_delayed_role",
        guildId: member.guild.id,
        userId: member.id,
        roleId: delayed.roleId,
        executeAt: Date.now() + delayMs
      });
    }
  }

  // 3. Sticky Roles
  const verCfg = cfg.verification || {};
  const verifiedRoleId = verCfg.roleToAddId || verCfg.verifiedRoleId;
  const guildSticky = storage.stickyRoles[member.guild.id];
  if (guildSticky && Array.isArray(guildSticky[member.id])) {
    const rolesToRestore = guildSticky[member.id].filter(rId => {
      if (!member.guild.roles.cache.has(rId)) return false;
      // Invariant: NEVER restore verified role. Members rejoining MUST re-verify.
      if (verifiedRoleId && rId === verifiedRoleId) return false;
      const roleObj = member.guild.roles.cache.get(rId);
      if (roleObj && roleObj.name.includes("║")) return false; // Exclude divider roles
      return true;
    });
    if (rolesToRestore.length > 0) {
      await member.roles.add(rolesToRestore, "Sticky Roles ripristinati").catch(err => {
        console.warn("[RoleManager] Impossibile ripristinare sticky roles:", err.message);
      });
      eventBus.emit("roles.sticky_restored", { guildId: member.guild.id, userId: member.id, roles: rolesToRestore });
    }
  }
}

async function handleMemberLeave(member) {
  if (!member || !member.guild || member.user?.bot) return;
  const cfg = getGuildConfig(member.guild.id);
  const verCfg = cfg.verification || {};
  const verifiedRoleId = verCfg.roleToAddId || verCfg.verifiedRoleId;
  const storage = getRoleStorage();
  if (!storage.stickyRoles[member.guild.id]) storage.stickyRoles[member.guild.id] = {};

  const roles = member.roles.cache
    .filter(r => {
      if (r.id === member.guild.id || r.managed) return false;
      // Never store verified role in stickyRoles
      if (verifiedRoleId && r.id === verifiedRoleId) return false;
      if (r.name.includes("║")) return false; // Exclude divider roles
      return true;
    })
    .map(r => r.id);

  if (roles.length > 0) {
    storage.stickyRoles[member.guild.id][member.id] = roles;
  } else {
    delete storage.stickyRoles[member.guild.id][member.id];
  }
  saveRoleStorage(storage);
  eventBus.emit("roles.sticky_saved", { guildId: member.guild.id, userId: member.id, roles });
}

async function assignTemporaryRole(member, roleId, durationMs, reason = "Ruolo temporaneo") {
  if (!member || !roleId) return false;
  await member.roles.add(roleId, reason);

  const storage = getRoleStorage();
  const tempEntry = {
    id: "temp_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
    guildId: member.guild.id,
    userId: member.id,
    roleId,
    reason,
    assignedAt: Date.now(),
    expiresAt: Date.now() + durationMs
  };

  storage.tempRoles.push(tempEntry);
  saveRoleStorage(storage);

  scheduleTask({
    type: "remove_temp_role",
    guildId: member.guild.id,
    userId: member.id,
    roleId,
    tempEntryId: tempEntry.id,
    executeAt: tempEntry.expiresAt
  });

  return tempEntry;
}

async function processRoleSchedule(client, task) {
  if (task.type === "assign_delayed_role") {
    const guild = client.guilds.cache.get(task.guildId);
    if (!guild) return;
    const member = await guild.members.fetch(task.userId).catch(() => null);
    if (member && task.roleId) {
      await member.roles.add(task.roleId, "Delayed AutoRole applicato").catch(() => {});
    }
  } else if (task.type === "remove_temp_role") {
    const guild = client.guilds.cache.get(task.guildId);
    if (!guild) return;
    const member = await guild.members.fetch(task.userId).catch(() => null);
    if (member && task.roleId) {
      await member.roles.remove(task.roleId, "Scadenza ruolo temporaneo").catch(() => {});
    }
    const storage = getRoleStorage();
    storage.tempRoles = (storage.tempRoles || []).filter(t => t.id !== task.tempEntryId);
    saveRoleStorage(storage);
  }
}

module.exports = {
  handleMemberJoin,
  handleMemberLeave,
  assignTemporaryRole,
  processRoleSchedule,
  getRoleStorage,
  saveRoleStorage
};