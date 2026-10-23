/**
 * SENTINEL AI — POLICY ENGINE
 * 
 * Enforces strict decision priority hierarchy:
 * 1. SYSTEM SAFETY
 * 2. DISCORD PERMISSIONS
 * 3. GUILD POLICY
 * 4. STAFF CONFIGURATION
 * 5. SERVER KNOWLEDGE
 * 6. TICKET CONTEXT
 * 7. LEARNED KNOWLEDGE
 * 8. MODEL INFERENCE
 * 
 * Supports:
 * - Autonomy Levels (0 to 5)
 * - Conflict resolution (higher priority wins)
 * - Temporary Guild Rules with expiration
 * - Security Boundaries: PUBLIC_CONTEXT, STAFF_CONTEXT, SYSTEM_CONTEXT, SECRET_CONTEXT
 * - Anti-Prompt-Injection data containment
 */

const AUTONOMY_LEVELS = {
  LEVEL_0: 0, // AI OFF
  LEVEL_1: 1, // AI CHAT ONLY
  LEVEL_2: 2, // AI TICKET ASSISTANT
  LEVEL_3: 3, // AI AUTONOMOUS SUPPORT
  LEVEL_4: 4, // AI SUPPORT + LOW-RISK ACTIONS
  LEVEL_5: 5  // AI FULL AUTONOMOUS STAFF
};

const CONTEXT_BOUNDARIES = {
  PUBLIC_CONTEXT: "PUBLIC_CONTEXT",
  STAFF_CONTEXT: "STAFF_CONTEXT",
  SYSTEM_CONTEXT: "SYSTEM_CONTEXT",
  SECRET_CONTEXT: "SECRET_CONTEXT"
};

class PolicyEngine {
  constructor() {
    this.temporaryRules = new Map(); // guildId -> [rules]
  }

  getAutonomyLevel(guildConfig = {}) {
    const level = guildConfig?.ai?.autonomyLevel;
    if (typeof level === "number" && level >= 0 && level <= 5) {
      return level;
    }
    // Default to Level 4 (Support + Low Risk Actions) if enabled
    if (guildConfig?.ai?.enabled !== false) return AUTONOMY_LEVELS.LEVEL_4;
    return AUTONOMY_LEVELS.LEVEL_0;
  }

  isAiEnabled(guildConfig = {}) {
    return this.getAutonomyLevel(guildConfig) > AUTONOMY_LEVELS.LEVEL_0;
  }

  /**
   * Evaluates if a given tool/action is permitted under current autonomy level
   */
  isToolPermittedUnderAutonomy(toolName, autonomyLevel) {
    if (autonomyLevel === AUTONOMY_LEVELS.LEVEL_0) return false;

    // Level 1: Chat only
    if (autonomyLevel === AUTONOMY_LEVELS.LEVEL_1) {
      return ["send_message", "reply_message", "search_knowledge"].includes(toolName);
    }

    // Level 2: Ticket Assistant (reads & suggests, no mutations)
    if (autonomyLevel === AUTONOMY_LEVELS.LEVEL_2) {
      return [
        "send_message", "reply_message", "search_knowledge",
        "get_ticket_history", "get_user", "get_channel", "analyze_image"
      ].includes(toolName);
    }

    // Level 3: Autonomous Support (messaging, requesting info, changing ticket metadata)
    if (autonomyLevel === AUTONOMY_LEVELS.LEVEL_3) {
      return [
        "send_message", "reply_message", "edit_message",
        "search_knowledge", "save_memory", "update_memory",
        "rename_ticket", "move_ticket", "analyze_image",
        "escalate_to_staff", "create_staff_alert", "get_ticket_history", "get_transcript"
      ].includes(toolName);
    }

    // Level 4: Support + Low-Risk Actions (includes role queries, warn, close ticket with prompt)
    if (autonomyLevel === AUTONOMY_LEVELS.LEVEL_4) {
      const highRisk = ["ban_user", "delete_channel", "delete_mass_messages", "remove_role"];
      return !highRisk.includes(toolName);
    }

    // Level 5: Full Autonomous Staff (all tools allowed, still subject to RiskEngine & ActionGuard)
    return true;
  }

  /**
   * Adds a temporary rule with start, end, rule, scope
   */
  addTemporaryRule(guildId, { rule, scope = "global", start = new Date(), end }) {
    if (!guildId || !rule || !end) return null;
    const ruleObj = {
      id: "rule_" + Date.now(),
      guildId,
      rule,
      scope,
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      createdAt: new Date().toISOString()
    };

    if (!this.temporaryRules.has(guildId)) this.temporaryRules.set(guildId, []);
    this.temporaryRules.get(guildId).push(ruleObj);
    return ruleObj;
  }

  getActiveTemporaryRules(guildId, scope = null) {
    if (!this.temporaryRules.has(guildId)) return [];
    const now = Date.now();
    const rules = this.temporaryRules.get(guildId);
    const active = rules.filter(r => {
      const startMs = new Date(r.start).getTime();
      const endMs = new Date(r.end).getTime();
      return now >= startMs && now <= endMs && (!scope || r.scope === scope || r.scope === "global");
    });
    // Cleanup expired
    if (active.length !== rules.length) {
      this.temporaryRules.set(guildId, active);
    }
    return active;
  }

  /**
   * Checks if an action is forbidden by policy or temporary rules.
   * Higher priority wins!
   */
  evaluatePolicyConstraints(guildId, { action, targetUserId, guildConfig = {} }) {
    const autonomy = this.getAutonomyLevel(guildConfig);

    // 1. SYSTEM SAFETY: Never modify bot creator or bot self
    if (targetUserId === "1429445691452948524" || targetUserId === "1007620938700959784") {
      if (["timeout_user", "kick_user", "ban_user", "remove_role"].includes(action)) {
        return { allowed: false, reason: "SYSTEM_SAFETY: Target user is protected by root system policy." };
      }
    }

    // 2. DISCORD PERMISSIONS & AUTONOMY
    if (!this.isToolPermittedUnderAutonomy(action, autonomy)) {
      return {
        allowed: false,
        reason: `POLICY_ENGINE: Action ${action} is not permitted under autonomy Level ${autonomy}.`
      };
    }

    // 3. TEMPORARY RULES: Check active temporary rules
    const activeRules = this.getActiveTemporaryRules(guildId);
    for (const tr of activeRules) {
      const ruleText = tr.rule.toLowerCase();
      if (action.includes("close") && ruleText.includes("non chiudere")) {
        return { allowed: false, reason: `TEMPORARY_RULE: ${tr.rule}` };
      }
      if (action.includes("ban") && ruleText.includes("non bannare")) {
        return { allowed: false, reason: `TEMPORARY_RULE: ${tr.rule}` };
      }
    }

    return { allowed: true };
  }

  /**
   * Sanitizes user input against prompt injection (multilingual: IT + EN)
   */
  sanitizeUserInput(userInput) {
    if (!userInput || typeof userInput !== "string") return "";
    return userInput
      // English injection patterns
      .replace(/system\s*directive/gi, "[blocked_directive]")
      .replace(/ignore\s+(all\s+)?(previous|above)\s+instructions/gi, "[blocked_injection]")
      .replace(/disregard\s+(all\s+)?(previous|above)\s+instructions/gi, "[blocked_injection]")
      .replace(/show\s+(me\s+)?your\s+(system\s+)?prompt/gi, "[blocked_query]")
      .replace(/reveal\s+your\s+(api\s*key|system\s+prompt|instructions)/gi, "[blocked_query]")
      .replace(/you\s+are\s+now\s+(in\s+)?developer\s+mode/gi, "[blocked_jailbreak]")
      .replace(/jailbreak|dan\s+mode/gi, "[blocked_jailbreak]")
      // Italian injection patterns
      .replace(/ignora\s+(?:tutte\s+le\s+|le\s+)?(?:istruzioni|regole)\s*(?:precedenti|sopra)?/gi, "[blocco_iniezione]")
      .replace(/dimentica\s+(?:tutto\s+quello\s+che|le\s+istruzioni|le\s+regole)/gi, "[blocco_iniezione]")
      .replace(/mostra(?:mi)?\s+(?:il\s+)?(?:tuo\s+)?(?:system\s+)?prompt/gi, "[blocco_query]")
      .replace(/rivela\s+(?:la\s+tua\s+)?(?:chiave\s+api|api\s*key|istruzioni\s+di\s+sistema)/gi, "[blocco_query]")
      .replace(/(?:tu\s+)?sei\s+(?:ora\s+)?in\s+modalit[àa]\s+sviluppatore/gi, "[blocco_jailbreak]")
      .replace(/non\s+seguire\s+le\s+regole/gi, "[blocco_iniezione]")
      // Adversarial system tags and code fence markers
      .replace(/\[\s*(?:system|system_directive|instruction)\s*\]/gi, "[safe_text]")
      .replace(/<\/?(?:system|instruction|directive)>/gi, "")
      .slice(0, 2000);
  }

  /**
   * Enforces data boundary: filters out secret or staff context before generating public response
   */
  filterContextForAudience(context, audience = "user") {
    if (audience === "staff") return context;

    // Filter out secret data
    const filtered = { ...context };
    delete filtered.secretTokens;
    delete filtered.systemPrompt;
    delete filtered.apiKeys;
    delete filtered.staffInternalNotes;

    return filtered;
  }
}

const defaultPolicyEngine = new PolicyEngine();
module.exports = {
  PolicyEngine,
  defaultPolicyEngine,
  AUTONOMY_LEVELS,
  CONTEXT_BOUNDARIES
};
