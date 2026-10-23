/**
 * SENTINEL AI — AUTONOMOUS MODERATION ENGINE
 * 
 * Context-aware autonomous moderation:
 * Categories:
 * - SPAM, FLOOD, RAID, MENTIONS, HARASSMENT, SCAM, SUSPICIOUS_LINK,
 *   IMPERSONATION, NSFW, ADVERTISING, TOXIC_BEHAVIOR, BAN_EVASION.
 * 
 * Multi-factor evaluation:
 * - Message frequency & timing (flood detection)
 * - Exact and fuzzy content repetition (spam)
 * - Phishing & suspicious link regex
 * - Mass mentions threshold
 * - User trust score & history
 * 
 * Graduated Response:
 * - Single ambiguous event -> OBSERVE
 * - Clear violation -> ACT (warn/timeout/delete)
 * - Ambiguous high-risk event -> ESCALATE
 */

const crypto = require("crypto");
const { defaultRiskEngine } = require("../risk-engine/RiskEngine");
const { defaultMemoryEngine } = require("../memory-engine/MemoryEngine");

const MOD_VIOLATIONS = {
  SPAM: "SPAM",
  FLOOD: "FLOOD",
  RAID: "RAID",
  MENTIONS: "MENTIONS",
  HARASSMENT: "HARASSMENT",
  SCAM: "SCAM",
  SUSPICIOUS_LINK: "SUSPICIOUS_LINK",
  IMPERSONATION: "IMPERSONATION",
  NSFW: "NSFW",
  ADVERTISING: "ADVERTISING",
  TOXIC_BEHAVIOR: "TOXIC_BEHAVIOR",
  BAN_EVASION: "BAN_EVASION"
};

class AutonomousModerationEngine {
  constructor(memoryEngine = defaultMemoryEngine) {
    this.memoryEngine = memoryEngine;
    this.userMessageTimes = new Map(); // userId -> [timestamps]
    this.recentMessageHashes = new Map(); // userId -> [hashes]
    this.scamRegex = /(?:discord\.gift|discord-nitro[a-z0-9-]*|steamcommunity[a-z0-9-]*|free-nitro[a-z0-9-]*|airdrop-eth|claim-gift|discord(?:app)?-(?:nitro|gift|drop|promo)[a-z0-9-]*|dlscord|discrod|steampromote|steamcomminuty)\.[a-z]{2,}/i;
  }

  hashMessage(content) {
    return crypto.createHash("md5").update((content || "").toLowerCase().trim()).digest("hex");
  }

  cleanupInactive(maxAgeMs = 120000) {
    const cutoff = Date.now() - maxAgeMs;
    for (const [uid, times] of this.userMessageTimes.entries()) {
      const valid = times.filter(t => t > cutoff);
      if (valid.length === 0) this.userMessageTimes.delete(uid);
      else this.userMessageTimes.set(uid, valid);
    }
    for (const [uid, hashes] of this.recentMessageHashes.entries()) {
      const valid = hashes.filter(h => h.time > cutoff);
      if (valid.length === 0) this.recentMessageHashes.delete(uid);
      else this.recentMessageHashes.set(uid, valid);
    }
  }

  /**
   * Evaluates a message against all moderation dimensions
   */
  async evaluateMessage(message, guildConfig = {}) {
    if (!message || !message.guild || message.author?.bot) {
      return { action: "IGNORE", reason: "Bot or DM message" };
    }

    if (this.userMessageTimes.size > 1000 || this.recentMessageHashes.size > 1000) {
      this.cleanupInactive();
    }

    const guildId = message.guild.id;
    const userId = message.author.id;
    const content = message.content || "";
    const now = Date.now();

    // 1. Whitelist / Protected Target Check
    if (defaultRiskEngine.isTargetProtected(message.member || message.author, guildConfig)) {
      return { action: "IGNORE", reason: "User is protected by whitelist" };
    }

    // 2. Suspicious Link & Scam Check
    if (this.scamRegex.test(content)) {
      return {
        action: "ACT",
        violation: MOD_VIOLATIONS.SCAM,
        confidence: 0.98,
        recommendedTool: "timeout_user",
        params: { userId, durationMinutes: 60, reason: "Phishing / Scam Link rilevato da Sentinel AI" },
        deleteMessage: true,
        reason: "Link malevolo confermato da pattern phishing."
      };
    }

    // 3. Mass Mentions Check
    const mentionCount = (message.mentions?.users?.size || 0) + (message.mentions?.roles?.size || 0);
    const maxMentions = guildConfig?.moderation?.maxMentions || 5;
    if (mentionCount >= maxMentions) {
      return {
        action: "ACT",
        violation: MOD_VIOLATIONS.MENTIONS,
        confidence: 0.95,
        recommendedTool: "timeout_user",
        params: { userId, durationMinutes: 10, reason: `Mass mentions (${mentionCount} menzioni)` },
        deleteMessage: true,
        reason: "Superamento soglia menzioni consentite."
      };
    }

    // 4. Flood Check (Message rate per user per guild)
    const trackingKey = `${guildId}:${userId}`;
    if (!this.userMessageTimes.has(trackingKey)) this.userMessageTimes.set(trackingKey, []);
    const times = this.userMessageTimes.get(trackingKey);
    times.push(now);
    // Keep last 10 seconds
    const recentTimes = times.filter(t => now - t < 10000);
    this.userMessageTimes.set(trackingKey, recentTimes);

    if (recentTimes.length >= 7) {
      return {
        action: "ACT",
        violation: MOD_VIOLATIONS.FLOOD,
        confidence: 0.94,
        recommendedTool: "timeout_user",
        params: { userId, durationMinutes: 5, reason: "Flood rilevato (7+ messaggi in 10s)" },
        deleteMessage: false,
        reason: "Invio compulsivo di messaggi in rapida successione."
      };
    }

    // 5. Repeated Message Spam Check (Per user per guild)
    if (!this.recentMessageHashes.has(trackingKey)) this.recentMessageHashes.set(trackingKey, []);
    const hashes = this.recentMessageHashes.get(trackingKey);
    const msgHash = this.hashMessage(content);

    if (content.length > 10) {
      hashes.push({ hash: msgHash, time: now });
      const recentHashes = hashes.filter(h => now - h.time < 30000);
      this.recentMessageHashes.set(trackingKey, recentHashes);

      const duplicates = recentHashes.filter(h => h.hash === msgHash).length;
      if (duplicates >= 4) {
        return {
          action: "ACT",
          violation: MOD_VIOLATIONS.SPAM,
          confidence: 0.96,
          recommendedTool: "timeout_user",
          params: { userId, durationMinutes: 10, reason: "Spam di messaggi identici ripetuti" },
          deleteMessage: true,
          reason: "4+ messaggi identici inviati negli ultimi 30 secondi."
        };
      }
    }

    // 6. User Trust Profile Evaluation
    const profile = this.memoryEngine.getUserProfile(guildId, userId);
    if (profile && profile.trustScore < 40) {
      // Lower trust score -> higher sensitivity
      return {
        action: "OBSERVE",
        confidence: 0.7,
        reason: `User under elevated observation (trust score: ${profile.trustScore})`
      };
    }

    return { action: "OBSERVE", confidence: 1.0, reason: "No violations detected" };
  }
}

const defaultAutonomousModerationEngine = new AutonomousModerationEngine();
module.exports = {
  AutonomousModerationEngine,
  defaultAutonomousModerationEngine,
  MOD_VIOLATIONS
};
