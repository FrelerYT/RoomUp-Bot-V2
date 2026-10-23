const { eventBus } = require("./eventBus");
const { evaluateRuleGroup } = require("./conditionEngine");
const { resolveVariables } = require("./variableEngine");
const { readJsonSafe, writeJsonSafe } = require("./storage");
const { getGuildConfig } = require("../config/settingsManager");

function loadAutomationRuns() {
  return readJsonSafe("automationRuns", []);
}

function recordRun(runRecord) {
  let runs = loadAutomationRuns();
  runs.unshift(runRecord);
  if (runs.length > 250) runs = runs.slice(0, 250);
  writeJsonSafe("automationRuns", runs);
}

async function executeAction(action, context, client) {
  const { type, config = {} } = action;
  const guild = context.guild;
  if (!guild) return { success: false, reason: "No guild context" };

  switch (type) {
    case "sendMessage": {
      const channelId = config.channelId || context.channel?.id;
      const targetCh = guild.channels?.cache?.get(channelId);
      if (!targetCh || !targetCh.isTextBased()) return { success: false, reason: "Canale non valido" };
      const text = resolveVariables(config.message || "", context);
      await targetCh.send(text);
      return { success: true };
    }

    case "sendDm": {
      const user = context.user || context.member?.user;
      if (!user) return { success: false, reason: "Utente non trovato" };
      const text = resolveVariables(config.message || "", context);
      await user.send(text);
      return { success: true };
    }

    case "addRole": {
      const member = context.member;
      const roleId = config.roleId;
      if (!member || !roleId) return { success: false, reason: "Ruolo o membro non trovato" };
      await member.roles.add(roleId).catch(() => null);
      return { success: true };
    }

    case "removeRole": {
      const member = context.member;
      const roleId = config.roleId;
      if (!member || !roleId) return { success: false, reason: "Ruolo o membro non trovato" };
      await member.roles.remove(roleId).catch(() => null);
      return { success: true };
    }

    case "timeout": {
      const member = context.member;
      const durationMs = (parseInt(config.durationMinutes, 10) || 5) * 60 * 1000;
      if (!member) return { success: false, reason: "Membro non trovato" };
      await member.timeout(durationMs, config.reason || "Automazione RoomUp").catch(() => null);
      return { success: true };
    }

    case "kick": {
      const member = context.member;
      if (!member) return { success: false, reason: "Membro non trovato" };
      await member.kick(config.reason || "Automazione RoomUp").catch(() => null);
      return { success: true };
    }

    default:
      return { success: false, reason: `Azione '${type}' non supportata` };
  }
}

async function executeAutomations(guildOrTrigger, triggerOrContext, contextOrClient, clientOrGetConfig) {
  try {
    let guild, triggerType, context, client;
    if (typeof guildOrTrigger === "string") {
      triggerType = guildOrTrigger;
      context = triggerOrContext || {};
      guild = context.guild;
      client = contextOrClient;
    } else {
      guild = guildOrTrigger;
      triggerType = triggerOrContext;
      context = contextOrClient || {};
      client = clientOrGetConfig;
    }

    if (!guild || !guild.id) return;
    const config = getGuildConfig(guild.id);
    const automations = config.automations || [];

    const matched = automations.filter(a => a.enabled !== false && a.trigger === triggerType);
    if (matched.length === 0) return;

    for (const auto of matched) {
      const runId = "run_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
      const passed = evaluateRuleGroup(auto.rules || { match: "ALL", conditions: [] }, context);

      if (!passed) {
        recordRun({
          runId,
          automationId: auto.id,
          automationName: auto.name || "Senza nome",
          trigger: triggerType,
          guildId: guild.id,
          timestamp: new Date().toISOString(),
          status: "SKIPPED",
          reason: "Condizioni non soddisfatte"
        });
        continue;
      }

      const executedActions = [];
      let hasFailed = false;

      for (const action of (auto.actions || [])) {
        try {
          const res = await executeAction(action, context, client);
          executedActions.push({ type: action.type, result: res });
          if (!res.success) hasFailed = true;
        } catch (err) {
          executedActions.push({ type: action.type, result: { success: false, error: err.message } });
          hasFailed = true;
        }
      }

      recordRun({
        runId,
        automationId: auto.id,
        automationName: auto.name || "Senza nome",
        trigger: triggerType,
        guildId: guild.id,
        timestamp: new Date().toISOString(),
        status: hasFailed ? "PARTIAL_FAILURE" : "SUCCESS",
        actions: executedActions
      });
    }
  } catch (err) {
    console.error("[AutomationEngine] Errore esecuzione automazioni:", err.message);
  }
}

module.exports = {
  executeAutomations,
  triggerAutomations: executeAutomations,
  loadAutomationRuns
};
