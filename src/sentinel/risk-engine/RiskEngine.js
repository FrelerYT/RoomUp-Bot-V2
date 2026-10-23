/**
 * SENTINEL AI — RISK ENGINE
 * 
 * Levels: NONE, LOW, MEDIUM, HIGH, CRITICAL.
 * - Enforces risk ceiling per guild.
 * - Protects privileged targets (Owners, Whitelisted Users/Roles/Channels).
 * - Implements rate-limiting and cooldown tracker.
 */

const RISK_LEVELS = {
  NONE: "NONE",
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL"
};

const RISK_SEVERITY = {
  NONE: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4
};

const DEFAULT_TOOL_RISK = {
  send_message: RISK_LEVELS.LOW,
  reply_message: RISK_LEVELS.LOW,
  edit_message: RISK_LEVELS.LOW,
  delete_message: RISK_LEVELS.MEDIUM,
  create_ticket: RISK_LEVELS.LOW,
  close_ticket: RISK_LEVELS.MEDIUM,
  reopen_ticket: RISK_LEVELS.LOW,
  rename_ticket: RISK_LEVELS.LOW,
  move_ticket: RISK_LEVELS.MEDIUM,
  add_user_to_ticket: RISK_LEVELS.LOW,
  remove_user_from_ticket: RISK_LEVELS.MEDIUM,
  add_role: RISK_LEVELS.MEDIUM,
  remove_role: RISK_LEVELS.HIGH,
  timeout_user: RISK_LEVELS.HIGH,
  warn_user: RISK_LEVELS.LOW,
  get_user: RISK_LEVELS.NONE,
  get_member: RISK_LEVELS.NONE,
  get_roles: RISK_LEVELS.NONE,
  get_channel: RISK_LEVELS.NONE,
  search_messages: RISK_LEVELS.NONE,
  get_ticket_history: RISK_LEVELS.NONE,
  get_transcript: RISK_LEVELS.NONE,
  create_thread: RISK_LEVELS.MEDIUM,
  send_dm: RISK_LEVELS.LOW,
  analyze_image: RISK_LEVELS.NONE,
  search_knowledge: RISK_LEVELS.NONE,
  save_memory: RISK_LEVELS.LOW,
  update_memory: RISK_LEVELS.LOW,
  escalate_to_staff: RISK_LEVELS.LOW,
  create_staff_alert: RISK_LEVELS.LOW,
  kick_user: RISK_LEVELS.HIGH,
  ban_user: RISK_LEVELS.CRITICAL,
  delete_mass_messages: RISK_LEVELS.CRITICAL
};

// Hardcoded Root Protected Whitelist
const SYSTEM_PROTECTED_USERS = ["frelerr", "zeyrox003", "samuelecosso", "1429445691452948524", "1007620938700959784"];

class RiskEngine {
  constructor() {
    this.rateLimits = new Map(); // key -> [timestamps]
    this.cooldowns = new Map(); // key -> expiresAt
  }

  getToolRisk(toolName, params = {}) {
    // If timeout duration > 1 hour, elevate to HIGH
    if (toolName === "timeout_user" && params.durationMinutes > 60) {
      return RISK_LEVELS.HIGH;
    }
    return DEFAULT_TOOL_RISK[toolName] || RISK_LEVELS.MEDIUM;
  }

  isRiskPermitted(actionRisk, maxAllowedRisk = RISK_LEVELS.LOW) {
    const actSev = RISK_SEVERITY[actionRisk] || RISK_SEVERITY.MEDIUM;
    const maxSev = RISK_SEVERITY[maxAllowedRisk] || RISK_SEVERITY.LOW;
    return actSev <= maxSev;
  }

  isTargetProtected(targetUserOrMember, guildConfig = {}) {
    if (!targetUserOrMember) return false;

    const targetId = String(targetUserOrMember.id || targetUserOrMember.userId || "");
    const targetUsername = String(targetUserOrMember.username || targetUserOrMember.user?.username || "").toLowerCase();

    // 1. Root system whitelist
    if (SYSTEM_PROTECTED_USERS.includes(targetId) || SYSTEM_PROTECTED_USERS.includes(targetUsername)) {
      return true;
    }

    // 2. Guild configured protected users
    const protectedUsers = (guildConfig?.security?.protectedUsers || []).map(u => String(u).toLowerCase());
    if (protectedUsers.includes(targetId) || protectedUsers.includes(targetUsername)) {
      return true;
    }

    // 3. Guild configured protected roles
    if (targetUserOrMember.roles) {
      const protectedRoles = (guildConfig?.security?.protectedRoles || []).map(r => String(r));
      const hasProtectedRole = targetUserOrMember.roles.cache
        ? targetUserOrMember.roles.cache.some(r => protectedRoles.includes(r.id))
        : (Array.isArray(targetUserOrMember.roles) && targetUserOrMember.roles.some(r => protectedRoles.includes(r)));
      if (hasProtectedRole) return true;
    }

    // 4. Guild Owner is always protected
    if (targetUserOrMember.guild && targetUserOrMember.guild.ownerId === targetId) {
      return true;
    }

    return false;
  }

  cleanupExpired() {
    const now = Date.now();
    for (const [key, exp] of this.cooldowns.entries()) {
      if (now >= exp) this.cooldowns.delete(key);
    }
    for (const [key, timestamps] of this.rateLimits.entries()) {
      const valid = timestamps.filter(t => now - t < 60000);
      if (valid.length === 0) {
        this.rateLimits.delete(key);
      } else {
        this.rateLimits.set(key, valid);
      }
    }
    if (this.rateLimits.size > 2000) {
      const keys = Array.from(this.rateLimits.keys()).slice(0, 500);
      for (const k of keys) this.rateLimits.delete(k);
    }
  }

  /**
   * Check rate limits (actions per minute)
   */
  checkRateLimit(key, limit = 10, windowMs = 60000) {
    if (this.rateLimits.size > 2000) this.cleanupExpired();
    const now = Date.now();
    const timestamps = this.rateLimits.get(key) || [];
    const valid = timestamps.filter(t => now - t < windowMs);

    if (valid.length >= limit) {
      this.rateLimits.set(key, valid);
      return { limited: true, retryAfterMs: windowMs - (now - valid[0]) };
    }

    valid.push(now);
    this.rateLimits.set(key, valid);
    return { limited: false };
  }

  setCooldown(key, durationMs) {
    if (this.cooldowns.size > 2000) this.cleanupExpired();
    this.cooldowns.set(key, Date.now() + durationMs);
  }

  isCooldownActive(key) {
    const expires = this.cooldowns.get(key) || 0;
    if (Date.now() >= expires) {
      if (expires > 0) this.cooldowns.delete(key);
      return false;
    }
    return true;
  }
}

const defaultRiskEngine = new RiskEngine();
module.exports = {
  RiskEngine,
  defaultRiskEngine,
  RISK_LEVELS,
  RISK_SEVERITY,
  DEFAULT_TOOL_RISK
};
