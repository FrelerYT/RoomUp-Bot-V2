/**
 * SENTINEL AI — MEMORY ENGINE
 * 
 * Strict Multi-Guild Tenant Isolation:
 * - Every single read and write MUST be partitioned by guildId.
 * - Zero cross-guild data leakage.
 * - Persists structured ticket memory (facts, goals, questions, actions).
 * - Backwards-compatible loader for existing RoomUp memory in ai_ticket_memory.json.
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "../../../data/sentinel");
const LEGACY_MEMORY_FILE = path.join(__dirname, "../../../data/ai_ticket_memory.json");
const PRIMARY_MEMORY_FILE = path.join(DATA_DIR, "guild_memory.json");
const TICKET_SESSIONS_FILE = path.join(DATA_DIR, "ticket_sessions.json");

class MemoryEngine {
  constructor(storageDir = DATA_DIR) {
    this.storageDir = storageDir;
    this.primaryFile = path.join(storageDir, "guild_memory.json");
    this.sessionsFile = path.join(storageDir, "ticket_sessions.json");
    this.ensureDirectories();
    this.cache = this.loadAllMemory();
    this.sessions = this.loadAllSessions();
  }

  ensureDirectories() {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }
    } catch (e) {}
  }

  loadAllMemory() {
    try {
      if (fs.existsSync(this.primaryFile)) {
        return JSON.parse(fs.readFileSync(this.primaryFile, "utf8"));
      }
      // Migrate from legacy file if present
      if (fs.existsSync(LEGACY_MEMORY_FILE)) {
        const legacy = JSON.parse(fs.readFileSync(LEGACY_MEMORY_FILE, "utf8"));
        fs.writeFileSync(this.primaryFile, JSON.stringify(legacy, null, 2), "utf8");
        return legacy;
      }
    } catch (e) {
      console.error("[Sentinel:MemoryEngine] Error reading memory file:", e.message);
    }
    return {};
  }

  saveAllMemory() {
    try {
      this.ensureDirectories();
      fs.writeFileSync(this.primaryFile, JSON.stringify(this.cache, null, 2), "utf8");
    } catch (e) {
      console.error("[Sentinel:MemoryEngine] Error writing memory file:", e.message);
    }
  }

  loadAllSessions() {
    try {
      if (fs.existsSync(this.sessionsFile)) {
        return JSON.parse(fs.readFileSync(this.sessionsFile, "utf8"));
      }
    } catch (e) {}
    return {};
  }

  saveAllSessions() {
    try {
      this.ensureDirectories();
      fs.writeFileSync(this.sessionsFile, JSON.stringify(this.sessions, null, 2), "utf8");
    } catch (e) {
      console.error("[Sentinel:MemoryEngine] Error writing sessions file:", e.message);
    }
  }

  assertGuildId(guildId) {
    if (!guildId || typeof guildId !== "string" || guildId.trim() === "") {
      throw new Error("[Sentinel:MemoryEngine] MULTI-TENANT VIOLATION: guildId is strictly required for all memory operations.");
    }
    return guildId.trim();
  }

  /**
   * Returns isolated guild memory partition
   */
  getGuildMemory(guildId) {
    const gid = this.assertGuildId(guildId);
    if (!this.cache[gid]) {
      this.cache[gid] = {
        guildId: gid,
        categories: {
          general:     { precedents: [], learnedResponses: [], totalHandled: 0 },
          partnership: { precedents: [], learnedResponses: [], totalHandled: 0 },
          staff_app:   { precedents: [], learnedResponses: [], totalHandled: 0 },
          media_app:   { precedents: [], learnedResponses: [], totalHandled: 0 },
          support:     { precedents: [], learnedResponses: [], totalHandled: 0 },
          minecraft:   { precedents: [], learnedResponses: [], totalHandled: 0 }
        },
        userProfiles: {}, // userId -> { notes, interactionCount, trustScore, warnings }
        statistics: {
          totalTickets: 0,
          resolvedTickets: 0,
          escalatedTickets: 0,
          staffInterventions: 0
        },
        goals: [], // [{ id, title, details, status, createdBy, createdAt, completedAt }]
        boostMode: { enabled: false, mode: "standard", activatedAt: null, expiresAt: null },
        learnedRules: [], // [{ id, rule, category, author, createdAt }]
        grillSessions: {}, // `${channelId}:${userId}` -> session
        createdAt: new Date().toISOString()
      };
      this.saveAllMemory();
    }
    if (!this.cache[gid].guildId) this.cache[gid].guildId = gid;
    if (!this.cache[gid].userProfiles) this.cache[gid].userProfiles = {};
    if (!this.cache[gid].categories) this.cache[gid].categories = {};
    if (!Array.isArray(this.cache[gid].goals)) this.cache[gid].goals = [];
    if (!this.cache[gid].boostMode) this.cache[gid].boostMode = { enabled: false, mode: "standard" };
    if (!Array.isArray(this.cache[gid].learnedRules)) this.cache[gid].learnedRules = [];
    if (!this.cache[gid].grillSessions) this.cache[gid].grillSessions = {};

    // Bidirectional normalization between flat legacy and modern structured formats
    const knownCats = ["general", "partnership", "staff_app", "media_app", "support", "minecraft"];
    for (const cat of knownCats) {
      if (!this.cache[gid].categories[cat] && this.cache[gid][cat]) {
        this.cache[gid].categories[cat] = this.cache[gid][cat];
      } else if (this.cache[gid].categories[cat] && !this.cache[gid][cat]) {
        this.cache[gid][cat] = this.cache[gid].categories[cat];
      }
    }
    return this.cache[gid];
  }

  /**
   * Saves updated guild memory partition
   */
  updateGuildMemory(guildId, updaterFn) {
    const gid = this.assertGuildId(guildId);
    const current = this.getGuildMemory(gid);
    const updated = typeof updaterFn === "function" ? updaterFn(current) : { ...current, ...updaterFn };
    this.cache[gid] = updated;
    this.saveAllMemory();
    return updated;
  }

  // ─── TICKET STRUCTURED MEMORY ──────────────────────────────────
  getTicketMemory(guildId, ticketId) {
    const gid = this.assertGuildId(guildId);
    if (!ticketId) return null;
    const key = `${gid}:${ticketId}`;
    return this.sessions[key] || null;
  }

  createTicketMemory(guildId, ticketId, initialData = {}) {
    const gid = this.assertGuildId(guildId);
    const key = `${gid}:${ticketId}`;
    const now = new Date().toISOString();

    const mem = {
      ticketId,
      guildId: gid,
      channelId: initialData.channelId || ticketId,
      userId: initialData.userId || null,
      category: initialData.category || "general",
      problem: initialData.problem || "",
      userGoal: initialData.userGoal || "",
      knownFacts: Array.isArray(initialData.knownFacts) ? initialData.knownFacts : [],
      missingInformation: Array.isArray(initialData.missingInformation) ? initialData.missingInformation : [],
      questionsAsked: Array.isArray(initialData.questionsAsked) ? initialData.questionsAsked : [],
      answersReceived: Array.isArray(initialData.answersReceived) ? initialData.answersReceived : [],
      actionsPerformed: Array.isArray(initialData.actionsPerformed) ? initialData.actionsPerformed : [],
      failedAttempts: Array.isArray(initialData.failedAttempts) ? initialData.failedAttempts : [],
      successfulAttempts: Array.isArray(initialData.successfulAttempts) ? initialData.successfulAttempts : [],
      staffInterventions: Array.isArray(initialData.staffInterventions) ? initialData.staffInterventions : [],
      partnerDescription: initialData.partnerDescription || null,
      screenshotVerified: Boolean(initialData.screenshotVerified),
      screenshotUrl: initialData.screenshotUrl || null,
      currentState: initialData.currentState || "NEW",
      mode: initialData.mode || "AI_ACTIVE", // AI_ACTIVE, AI_PASSIVE, STAFF_ACTIVE, WAITING_USER, ESCALATED, RESOLVED
      resolution: initialData.resolution || null,
      confidence: typeof initialData.confidence === "number" ? initialData.confidence : 1.0,
      nextStep: initialData.nextStep || "",
      conversationHistory: Array.isArray(initialData.conversationHistory) ? initialData.conversationHistory : [],
      summary: initialData.summary || null,
      ...initialData,
      createdAt: now,
      updatedAt: now
    };

    this.sessions[key] = mem;
    this.saveAllSessions();
    return mem;
  }

  updateTicketMemory(guildId, ticketId, patch) {
    const gid = this.assertGuildId(guildId);
    const key = `${gid}:${ticketId}`;
    const existing = this.sessions[key];
    if (!existing) return null;
    const delta = typeof patch === "function" ? patch(existing) : patch;
    const updated = {
      ...existing,
      ...(delta || {}),
      updatedAt: new Date().toISOString()
    };
    this.sessions[key] = updated;
    this.saveAllSessions();
    return updated;
  }

  deleteTicketMemory(guildId, ticketId) {
    const gid = this.assertGuildId(guildId);
    const key = `${gid}:${ticketId}`;
    if (this.sessions[key]) {
      delete this.sessions[key];
      this.saveAllSessions();
    }
  }

  // ─── USER MEMORY PROFILES ──────────────────────────────────────
  getUserProfile(guildId, userId) {
    const gid = this.assertGuildId(guildId);
    const guildMem = this.getGuildMemory(gid);
    if (!guildMem.userProfiles) guildMem.userProfiles = {};
    if (!guildMem.userProfiles[userId]) {
      guildMem.userProfiles[userId] = {
        userId,
        interactionCount: 0,
        trustScore: 100,
        warnings: 0,
        notes: [],
        lastSeenAt: null
      };
      this.saveAllMemory();
    }
    return guildMem.userProfiles[userId];
  }

  updateUserProfile(guildId, userId, patch) {
    const gid = this.assertGuildId(guildId);
    const guildMem = this.getGuildMemory(gid);
    const profile = this.getUserProfile(gid, userId);
    const delta = typeof patch === "function" ? patch(profile) : patch;
    guildMem.userProfiles[userId] = {
      ...profile,
      ...(delta || {}),
      lastSeenAt: new Date().toISOString()
    };
    this.saveAllMemory();
    return guildMem.userProfiles[userId];
  }

  // ─── GOALS MANAGEMENT (/goal) ──────────────────────────────────
  addGoal(guildId, { title, details = "", createdBy = "Staff", targetDate = null }) {
    const gid = this.assertGuildId(guildId);
    const guildMem = this.getGuildMemory(gid);
    const goal = {
      id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: String(title).trim(),
      details: String(details || "").trim(),
      status: "active", // "active" | "completed" | "cancelled"
      createdBy: String(createdBy),
      createdAt: new Date().toISOString(),
      completedAt: null,
      targetDate: targetDate || null
    };
    guildMem.goals.push(goal);
    this.saveAllMemory();
    return goal;
  }

  getGoals(guildId, status = "all") {
    const gid = this.assertGuildId(guildId);
    const guildMem = this.getGuildMemory(gid);
    const allGoals = guildMem.goals || [];
    if (status === "all") return allGoals;
    return allGoals.filter(g => g.status === status);
  }

  completeGoal(guildId, goalIdOrTitle) {
    const gid = this.assertGuildId(guildId);
    const guildMem = this.getGuildMemory(gid);
    const search = String(goalIdOrTitle).toLowerCase().trim();
    const goal = (guildMem.goals || []).find(g => g.id === goalIdOrTitle || g.title.toLowerCase().includes(search));
    if (!goal) return null;
    goal.status = "completed";
    goal.completedAt = new Date().toISOString();
    this.saveAllMemory();
    return goal;
  }

  removeGoal(guildId, goalIdOrTitle) {
    const gid = this.assertGuildId(guildId);
    const guildMem = this.getGuildMemory(gid);
    const search = String(goalIdOrTitle).toLowerCase().trim();
    const idx = (guildMem.goals || []).findIndex(g => g.id === goalIdOrTitle || g.title.toLowerCase().includes(search));
    if (idx === -1) return false;
    const removed = guildMem.goals.splice(idx, 1)[0];
    this.saveAllMemory();
    return removed;
  }

  // ─── BOOST REASONING MODE (/boost) ────────────────────────────
  setBoostMode(guildId, { mode = "deep_reasoning", setBy = "Staff", durationMinutes = 60 }) {
    const gid = this.assertGuildId(guildId);
    const guildMem = this.getGuildMemory(gid);
    const now = Date.now();
    const expiresAt = durationMinutes > 0 ? new Date(now + durationMinutes * 60 * 1000).toISOString() : null;
    const boostInfo = {
      enabled: true,
      mode, // "deep_reasoning" | "max_autonomy" | "speed" | "strict_audit"
      setBy: String(setBy),
      activatedAt: new Date(now).toISOString(),
      expiresAt,
      durationMinutes
    };
    guildMem.boostMode = boostInfo;
    this.saveAllMemory();
    return boostInfo;
  }

  getBoostMode(guildId) {
    const gid = this.assertGuildId(guildId);
    const guildMem = this.getGuildMemory(gid);
    const boost = guildMem.boostMode || { enabled: false, mode: "standard" };
    if (boost.enabled && boost.expiresAt && Date.now() > new Date(boost.expiresAt).getTime()) {
      boost.enabled = false;
      boost.mode = "standard";
      this.saveAllMemory();
    }
    return boost;
  }

  // ─── LEARNED RULES & PREFERENCES (/learn) ──────────────────────
  addLearnedRule(guildId, { rule, category = "GENERAL", triggerKeywords = [], author = "Staff", source = "manual" }) {
    const gid = this.assertGuildId(guildId);
    const guildMem = this.getGuildMemory(gid);
    const item = {
      id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      rule: String(rule).trim(),
      category: String(category).toUpperCase(),
      triggerKeywords: Array.isArray(triggerKeywords) ? triggerKeywords : [],
      author: String(author),
      source: String(source),
      createdAt: new Date().toISOString()
    };
    guildMem.learnedRules.push(item);
    this.saveAllMemory();
    return item;
  }

  getLearnedRules(guildId, category = null) {
    const gid = this.assertGuildId(guildId);
    const guildMem = this.getGuildMemory(gid);
    const list = guildMem.learnedRules || [];
    if (!category) return list;
    const catUpper = String(category).toUpperCase();
    return list.filter(r => r.category === catUpper);
  }

  removeLearnedRule(guildId, ruleIdOrKeyword) {
    const gid = this.assertGuildId(guildId);
    const guildMem = this.getGuildMemory(gid);
    const search = String(ruleIdOrKeyword).toLowerCase().trim();
    const idx = (guildMem.learnedRules || []).findIndex(r => r.id === ruleIdOrKeyword || r.rule.toLowerCase().includes(search));
    if (idx === -1) return null;
    const removed = guildMem.learnedRules.splice(idx, 1)[0];
    this.saveAllMemory();
    return removed;
  }

  // ─── SOCRATIC GRILL-ME SESSIONS (/grill-me) ────────────────────
  startGrillSession(guildId, channelId, userId, { topic = "Community & Server Strategy", difficulty = "medium", initialQuestion = null } = {}) {
    const gid = this.assertGuildId(guildId);
    const guildMem = this.getGuildMemory(gid);
    const key = `${channelId}:${userId}`;
    const session = {
      sessionId: `grill_${Date.now()}`,
      guildId: gid,
      channelId,
      userId,
      topic,
      difficulty,
      currentTurn: 0,
      maxTurns: 5,
      questions: initialQuestion ? [initialQuestion] : [],
      answers: [],
      feedbackHistory: [],
      score: 0,
      active: true,
      startedAt: new Date().toISOString()
    };
    guildMem.grillSessions[key] = session;
    this.saveAllMemory();
    return session;
  }

  getGrillSession(guildId, channelId, userId) {
    const gid = this.assertGuildId(guildId);
    const guildMem = this.getGuildMemory(gid);
    const key = `${channelId}:${userId}`;
    const session = guildMem.grillSessions?.[key] || null;
    if (session && !session.active) return null;
    return session;
  }

  recordGrillTurn(guildId, channelId, userId, { question, answer, score = 0, feedback = "" }) {
    const gid = this.assertGuildId(guildId);
    const guildMem = this.getGuildMemory(gid);
    const key = `${channelId}:${userId}`;
    const session = guildMem.grillSessions?.[key];
    if (!session) return null;
    session.currentTurn += 1;
    if (question) session.questions.push(question);
    if (answer) session.answers.push(answer);
    if (feedback) session.feedbackHistory.push(feedback);
    session.score += Number(score) || 0;
    if (session.currentTurn >= session.maxTurns) {
      session.active = false;
      session.completedAt = new Date().toISOString();
    }
    this.saveAllMemory();
    return session;
  }

  endGrillSession(guildId, channelId, userId) {
    const gid = this.assertGuildId(guildId);
    const guildMem = this.getGuildMemory(gid);
    const key = `${channelId}:${userId}`;
    const session = guildMem.grillSessions?.[key];
    if (session) {
      session.active = false;
      session.completedAt = new Date().toISOString();
      this.saveAllMemory();
    }
    return session;
  }

  cancelGrillSession(guildId, channelId, userId) {
    return this.endGrillSession(guildId, channelId, userId);
  }

  // ─── CLEAR / EXPORT ───────────────────────────────────────────
  clearGuildMemory(guildId) {
    const gid = this.assertGuildId(guildId);
    delete this.cache[gid];
    // Remove all sessions for this guild
    for (const k of Object.keys(this.sessions)) {
      if (k.startsWith(`${gid}:`)) {
        delete this.sessions[k];
      }
    }
    this.saveAllMemory();
    this.saveAllSessions();
  }

  exportGuildMemory(guildId) {
    const gid = this.assertGuildId(guildId);
    const guildMem = this.getGuildMemory(gid);
    const sessions = {};
    for (const [k, v] of Object.entries(this.sessions)) {
      if (k.startsWith(`${gid}:`)) {
        sessions[k] = v;
      }
    }
    return {
      guildId: gid,
      memory: guildMem,
      sessions,
      exportedAt: new Date().toISOString()
    };
  }

  setOfficialPartnershipDescription(guildId, description) {
    return this.updateGuildMemory(guildId, cur => {
      cur.officialPartnershipDescription = {
        text: description,
        updatedAt: new Date().toISOString()
      };
      return cur;
    });
  }

  getOfficialPartnershipDescription(guildId) {
    const mem = this.getGuildMemory(guildId);
    return mem.officialPartnershipDescription?.text || null;
  }
}

const defaultMemoryEngine = new MemoryEngine();
module.exports = {
  MemoryEngine,
  defaultMemoryEngine
};
