/**
 * SENTINEL AI — ACTION GUARD
 * 
 * 10-Point Pre-Execution Verification:
 * 1. Action permitted under autonomy level?
 * 2. Bot has Discord permissions?
 * 3. Target valid and not protected?
 * 4. Discord hierarchy allows action?
 * 5. Action risk <= guild allowed risk?
 * 6. Cooldown expired?
 * 7. Idempotency check (no duplicate execution)?
 * 8. Loop detector (repetitive cycles blocked)?
 * 9. Staff confirmation required?
 * 10. Parameters valid & sanitized?
 */

const crypto = require("crypto");
const { defaultRiskEngine, RISK_LEVELS } = require("../risk-engine/RiskEngine");
const { defaultPolicyEngine } = require("../policy-engine/PolicyEngine");
const { defaultMemoryEngine } = require("../memory-engine/MemoryEngine");

class ActionGuard {
  constructor(memoryEngine = defaultMemoryEngine, riskEngine = defaultRiskEngine, policyEngine = defaultPolicyEngine) {
    this.memoryEngine = memoryEngine;
    this.riskEngine = riskEngine;
    this.policyEngine = policyEngine;
    this.executedActionHashes = new Map(); // hash -> timestamp
    this.actionLoopCounter = new Map();    // cycleKey -> count
  }

  generateActionHash(guildId, toolName, targetId, params = {}) {
    const raw = `${guildId || ""}:${toolName}:${targetId || ""}:${JSON.stringify(params)}`;
    return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 24);
  }

  pruneHashes(ttlMs = 60000) {
    const cutoff = Date.now() - ttlMs;
    for (const [hash, ts] of this.executedActionHashes.entries()) {
      if (ts < cutoff) {
        this.executedActionHashes.delete(hash);
      }
    }
    if (this.executedActionHashes.size > 2000) {
      const keys = Array.from(this.executedActionHashes.keys()).slice(0, 500);
      for (const k of keys) this.executedActionHashes.delete(k);
    }
  }

  recordExecution(guildId, toolName, targetId, params = {}) {
    this.pruneHashes();
    const hash = this.generateActionHash(guildId, toolName, targetId, params);
    this.executedActionHashes.set(hash, Date.now());
  }

  isRecentlyExecuted(guildId, toolName, targetId, params = {}, windowMs = 15000) {
    const hash = this.generateActionHash(guildId, toolName, targetId, params);
    const ts = this.executedActionHashes.get(hash);
    if (ts && Date.now() - ts < windowMs) {
      return true;
    }
    return false;
  }

  incrementLoopCounter(cycleKey) {
    if (this.actionLoopCounter.size > 1000) {
      this.actionLoopCounter.clear();
    }
    const cur = this.actionLoopCounter.get(cycleKey) || 0;
    this.actionLoopCounter.set(cycleKey, cur + 1);
    return cur + 1;
  }

  resetLoopCounter(cycleKey) {
    this.actionLoopCounter.delete(cycleKey);
  }

  /**
   * Evaluates all 10 checkpoints before executing a tool
   */
  async check({
    guildId,
    toolName,
    params = {},
    targetMember = null,
    botMember = null,
    guildConfig = {},
    cycleKey = null,
    maxActionsPerCycle = 5,
    channelId = null
  }) {
    // 0. Closed Ticket, Takeover State Guard, and Non-Ticket Guard (Section 7 & 12)

    // CRITICAL GUARD: block ticket tools entirely on voice or stage channels
    const channelNameForCheck = params.channelName || "";
    const channelTypeForCheck = params.channelType;
    const ticketTools = ["close_ticket", "reopen_ticket"];
    if (ticketTools.includes(toolName)) {
      if (channelTypeForCheck === 2 || channelTypeForCheck === "GUILD_VOICE" ||
          channelTypeForCheck === 13 || channelTypeForCheck === "GUILD_STAGE_VOICE") {
        return {
          allowed: false,
          checkpoint: 0,
          reason: "Cannot execute ticket tools on voice or stage channels."
        };
      }
    }

    const targetTicketId = params.channelId || channelId;
    if (guildId && targetTicketId) {
      const memory = this.memoryEngine || defaultMemoryEngine;
      let session = memory.getTicketMemory ? memory.getTicketMemory(guildId, targetTicketId) : null;
      if (!session && defaultMemoryEngine && memory !== defaultMemoryEngine) {
        session = defaultMemoryEngine.getTicketMemory(guildId, targetTicketId);
      }

      if (session) {
        if (session.currentState === "CLOSED" && toolName !== "reopen_ticket" && !params.isStaffInitiated) {
          return {
            allowed: false,
            checkpoint: 0,
            reason: "Ticket is CLOSED. Action execution is forbidden on closed tickets."
          };
        }
        if ((session.mode === "AI_PASSIVE" || session.mode === "STAFF_ACTIVE" || session.currentState === "STAFF_TAKEOVER") &&
            !params.isStaffInitiated && !params.allowInPassive) {
          return {
            allowed: false,
            checkpoint: 0,
            reason: "Ticket is in STAFF_TAKEOVER / AI_PASSIVE mode. Automated actions are blocked."
          };
        }

        // Rule precedence: Check mandatory rules on autonomous closure
        if (toolName === "close_ticket" && !params.closedByStaff && !params.isStaffInitiated) {
          const rules = (memory.getLearnedRules ? memory.getLearnedRules(guildId) : defaultMemoryEngine.getLearnedRules(guildId)) || [];
          const noCloseRule = rules.find(r => /non chiudere (?:mai )?prima|senza conferma/i.test(r.rule || ""));
          if (noCloseRule && !params.userConfirmed && session.resolution !== "Risolto dall'utente con esito positivo.") {
            return {
              allowed: false,
              checkpoint: 0,
              reason: `Mandatory rule precedence: "${noCloseRule.rule}" blocks ticket closure.`
            };
          }
        }
      } else if (toolName === "close_ticket" && !params.isTicket && !params.channelName?.startsWith("ticket-") && !String(targetTicketId).includes("ticket")) {
        // Refuse to execute close_ticket on non-ticket channels
        return {
          allowed: false,
          checkpoint: 0,
          reason: "Cannot execute close_ticket on a non-ticket channel."
        };
      }
    }

    // 1. Autonomy Check
    const autonomyLevel = defaultPolicyEngine.getAutonomyLevel(guildConfig);
    if (!defaultPolicyEngine.isToolPermittedUnderAutonomy(toolName, autonomyLevel)) {
      return { allowed: false, checkpoint: 1, reason: `Action ${toolName} forbidden by Autonomy Level ${autonomyLevel}` };
    }

    // 2. Bot Discord Permissions Check
    if (botMember && ["timeout_user", "kick_user"].includes(toolName)) {
      if (!botMember.permissions?.has?.("ModerateMembers") && !botMember.permissions?.has?.("Administrator")) {
        return { allowed: false, checkpoint: 2, reason: "Bot lacks ModerateMembers Discord permission." };
      }
    }
    if (botMember && toolName === "ban_user") {
      if (!botMember.permissions?.has?.("BanMembers") && !botMember.permissions?.has?.("Administrator")) {
        return { allowed: false, checkpoint: 2, reason: "Bot lacks BanMembers Discord permission." };
      }
    }

    // 3. Target Protection Check
    if (targetMember && defaultRiskEngine.isTargetProtected(targetMember, guildConfig)) {
      return { allowed: false, checkpoint: 3, reason: "Target user is protected by security policies or whitelist." };
    }

    // 4. Discord Hierarchy Check
    if (targetMember && (targetMember.guild?.ownerId === targetMember.id || targetMember.id === targetMember.guild?.ownerId)) {
      return { allowed: false, checkpoint: 4, reason: "Discord hierarchy: Cannot target the Server Owner." };
    }
    if (botMember && targetMember && targetMember.roles?.highest && botMember.roles?.highest) {
      if (targetMember.roles.highest.position >= botMember.roles.highest.position) {
        return { allowed: false, checkpoint: 4, reason: "Discord role hierarchy: Target has equal or higher role than bot." };
      }
    }

    // 5. Risk Assessment Check
    const isStaffAction = Boolean(params.isStaffInitiated || params.staffConfirmed || params.closedByStaff);
    const toolRisk = defaultRiskEngine.getToolRisk(toolName, params);
    const maxAllowedRisk = guildConfig?.ai?.maxAutonomousRisk || RISK_LEVELS.LOW;
    if (!isStaffAction && !defaultRiskEngine.isRiskPermitted(toolRisk, maxAllowedRisk)) {
      return {
        allowed: false,
        checkpoint: 5,
        reason: `Action risk ${toolRisk} exceeds guild max autonomous risk ${maxAllowedRisk}`,
        requiresStaff: true
      };
    }

    // 6. Cooldown Check
    const targetId = params.targetId || params.userId || params.channelId || channelId || "global";
    const cooldownKey = `${guildId}:${toolName}:${targetId}`;
    if (defaultRiskEngine.isCooldownActive(cooldownKey)) {
      return { allowed: false, checkpoint: 6, reason: `Action is currently on cooldown for key ${cooldownKey}.` };
    }

    // 7. Idempotency Check
    const idempTarget = params.targetId || params.userId || params.channelId || channelId || "";
    if (this.isRecentlyExecuted(guildId, toolName, idempTarget, params)) {
      return { allowed: false, checkpoint: 7, reason: `Idempotency block: action ${toolName} was already executed recently.` };
    }

    // 8. Loop Detector Check
    if (cycleKey) {
      const actionsCount = this.incrementLoopCounter(cycleKey);
      if (actionsCount > maxActionsPerCycle) {
        return { allowed: false, checkpoint: 8, reason: `Circuit breaker: loop detector triggered (${actionsCount} actions in cycle).` };
      }
    }

    // 9. Staff Confirmation Requirement
    if (!isStaffAction && (toolRisk === RISK_LEVELS.CRITICAL || (toolRisk === RISK_LEVELS.HIGH && guildConfig?.ai?.requireStaffConfirmHighRisk !== false))) {
      return {
        allowed: false,
        checkpoint: 9,
        reason: `Action ${toolName} requires manual staff confirmation before execution.`,
        requiresStaff: true
      };
    }

    // 10. Parameter Validation & Sanitization
    if (toolName === "send_message" || toolName === "reply_message") {
      if (!params.content && !params.embeds) {
        return { allowed: false, checkpoint: 10, reason: "Message content or embeds missing." };
      }
    }
    if (toolName === "timeout_user" && (!params.durationMinutes || params.durationMinutes <= 0)) {
      return { allowed: false, checkpoint: 10, reason: "Timeout duration must be greater than 0 minutes." };
    }

    return { allowed: true };
  }
}

const defaultActionGuard = new ActionGuard();
module.exports = {
  ActionGuard,
  defaultActionGuard
};
