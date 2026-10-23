/**
 * SENTINEL AI — LEARNING ENGINE
 * 
 * Manages human-in-the-loop staff feedback & autonomous learning.
 * Distinguishes:
 * - OBSERVATION, FACT, PROCEDURE, RULE, PREFERENCE, CORRECTION, TEMPORARY_NOTE.
 * Approval policies:
 * - AUTO_LEARN_LOW_RISK (default for low-risk observation/precedent)
 * - STAFF_APPROVAL_REQUIRED (for procedures, rules, corrections)
 * - MANUAL_ONLY (only explicit dashboard/staff entries)
 * Per-guild isolation.
 */

const fs = require("fs");
const path = require("path");
const { defaultKnowledgeEngine, KNOWLEDGE_CATEGORIES } = require("../knowledge-engine/KnowledgeEngine");
const { defaultMemoryEngine } = require("../memory-engine/MemoryEngine");

const LEARNING_TYPES = {
  OBSERVATION: "OBSERVATION",
  FACT: "FACT",
  PROCEDURE: "PROCEDURE",
  RULE: "RULE",
  PREFERENCE: "PREFERENCE",
  CORRECTION: "CORRECTION",
  TEMPORARY_NOTE: "TEMPORARY_NOTE"
};

const APPROVAL_MODES = {
  AUTO_LEARN_LOW_RISK: "AUTO_LEARN_LOW_RISK",
  STAFF_APPROVAL_REQUIRED: "STAFF_APPROVAL_REQUIRED",
  MANUAL_ONLY: "MANUAL_ONLY"
};

const FEEDBACK_ACTIONS = {
  CORRECT: "CORRECT",
  INCORRECT: "INCORRECT",
  GOOD_RESPONSE: "GOOD_RESPONSE",
  BAD_RESPONSE: "BAD_RESPONSE",
  LEARN_THIS: "LEARN_THIS",
  IGNORE: "IGNORE"
};

const QUEUE_FILE = path.join(__dirname, "../../../data/sentinel/learning_queue.json");

class LearningEngine {
  constructor(queueFile = QUEUE_FILE) {
    this.queueFile = queueFile;
    this.ensureDirectories();
    this.queue = this.loadQueue(); // guildId -> [pendingItems]
    this.feedbackHistory = new Map(); // guildId -> [feedbacks]
  }

  ensureDirectories() {
    try {
      const dir = path.dirname(this.queueFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch (e) {}
  }

  loadQueue() {
    try {
      if (fs.existsSync(this.queueFile)) {
        return JSON.parse(fs.readFileSync(this.queueFile, "utf8"));
      }
    } catch (e) {
      console.error("[Sentinel:LearningEngine] Error reading queue:", e.message);
    }
    return {};
  }

  saveQueue() {
    try {
      this.ensureDirectories();
      fs.writeFileSync(this.queueFile, JSON.stringify(this.queue, null, 2), "utf8");
    } catch (e) {
      console.error("[Sentinel:LearningEngine] Error saving queue:", e.message);
    }
  }

  assertGuildId(guildId) {
    if (!guildId || typeof guildId !== "string") {
      throw new Error("[Sentinel:LearningEngine] MULTI-TENANT VIOLATION: guildId is strictly required.");
    }
    return guildId.trim();
  }

  /**
   * Register a potential learning event from a staff action, correction, or directive.
   */
  async registerLearningEvent(guildId, {
    type = LEARNING_TYPES.OBSERVATION,
    title = "",
    content = "",
    categoryKey = "general",
    source = "live_staff_action",
    author = "staff",
    confidence = 0.9,
    guildConfig = {},
    autoApprove = false,
    approvalStatus = null
  }) {
    const gid = this.assertGuildId(guildId);
    if (!content) return null;

    const approvalMode = guildConfig?.ai?.learningApproval || APPROVAL_MODES.AUTO_LEARN_LOW_RISK;
    const now = new Date().toISOString();
    const id = "lrn_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);

    const isExplicitlyApproved = autoApprove || approvalStatus === "APPROVED" || approvalStatus === "approved";

    const event = {
      id,
      guildId: gid,
      type,
      title: title || `${type} from ${author}`,
      content: content.trim(),
      categoryKey,
      source,
      author,
      confidence,
      createdAt: now,
      status: isExplicitlyApproved ? "approved" : "pending"
    };

    if (isExplicitlyApproved) {
      await this.applyApprovedLearning(event);
      return { status: "approved", event };
    }

    // Low-risk observations/facts can auto-learn if configured
    const isLowRisk = type === LEARNING_TYPES.OBSERVATION || type === LEARNING_TYPES.PREFERENCE;
    if (approvalMode === APPROVAL_MODES.AUTO_LEARN_LOW_RISK && isLowRisk) {
      event.status = "approved";
      await this.applyApprovedLearning(event);
      return { status: "auto_approved", event };
    }

    if (approvalMode === APPROVAL_MODES.MANUAL_ONLY) {
      return { status: "skipped_manual_only", event: null };
    }

    // Otherwise add to approval queue
    if (!this.queue[gid]) this.queue[gid] = [];
    this.queue[gid].push(event);
    this.saveQueue();

    return { status: "queued_for_approval", event };
  }

  /**
   * Approve a pending learning event and persist into KnowledgeEngine or MemoryEngine
   */
  async approveLearningEvent(guildId, eventId, staffReviewer = "staff") {
    const gid = this.assertGuildId(guildId);
    const list = this.queue[gid] || [];
    const idx = list.findIndex(e => e.id === eventId);
    if (idx === -1) return null;

    const event = list[idx];
    event.status = "approved";
    event.reviewedBy = staffReviewer;
    event.reviewedAt = new Date().toISOString();

    await this.applyApprovedLearning(event);

    // Remove from pending queue
    this.queue[gid] = list.filter(e => e.id !== eventId);
    this.saveQueue();

    return event;
  }

  /**
   * Reject and discard a pending learning event
   */
  rejectLearningEvent(guildId, eventId, reason = "") {
    const gid = this.assertGuildId(guildId);
    const list = this.queue[gid] || [];
    this.queue[gid] = list.filter(e => e.id !== eventId);
    this.saveQueue();
    return true;
  }

  /**
   * Commit approved learning event into the knowledge base & memory store
   */
  async applyApprovedLearning(event) {
    const { guildId, type, content, title, categoryKey, source, author, confidence } = event;

    // Procedures & Rules become knowledge documents
    if (type === LEARNING_TYPES.PROCEDURE || type === LEARNING_TYPES.RULE || type === LEARNING_TYPES.FACT) {
      const cat = type === LEARNING_TYPES.RULE ? KNOWLEDGE_CATEGORIES.SERVER_RULES : KNOWLEDGE_CATEGORIES.SERVER_PROCEDURES;
      defaultKnowledgeEngine.addKnowledgeItem(guildId, {
        category: cat,
        title: title || `Procedura: ${categoryKey}`,
        content,
        keywords: [categoryKey, type.toLowerCase()],
        source: source || "learned_procedure",
        author,
        confidence
      });
    }

    // Update MemoryEngine learned responses per category
    defaultMemoryEngine.updateGuildMemory(guildId, current => {
      const categories = current.categories || {};
      const catMem = categories[categoryKey] || { precedents: [], learnedResponses: [], totalHandled: 0 };
      if (!Array.isArray(catMem.learnedResponses)) catMem.learnedResponses = [];

      const exists = catMem.learnedResponses.some(lr => lr.response === content.slice(0, 400));
      if (!exists) {
        catMem.learnedResponses.push({
          id: `lrn_${Date.now()}`,
          response: content.slice(0, 400),
          type,
          learnedFrom: source,
          learnedAt: new Date().toISOString(),
          usageCount: 0
        });
        if (catMem.learnedResponses.length > 50) {
          catMem.learnedResponses = catMem.learnedResponses.slice(-50);
        }
      }

      categories[categoryKey] = catMem;
      return { ...current, categories };
    });
  }

  /**
   * Record explicit staff feedback on AI messages (CORRECT, INCORRECT, etc.)
   */
  recordStaffFeedback(guildId, {
    messageId,
    ticketId,
    action = FEEDBACK_ACTIONS.CORRECT,
    correctionText = "",
    staffUser = "staff"
  }) {
    const gid = this.assertGuildId(guildId);
    const entry = {
      id: "fb_" + Date.now(),
      guildId: gid,
      messageId,
      ticketId,
      action,
      correctionText,
      staffUser,
      timestamp: new Date().toISOString()
    };

    if (!this.feedbackHistory.has(gid)) this.feedbackHistory.set(gid, []);
    const history = this.feedbackHistory.get(gid);
    history.push(entry);
    if (history.length > 200) history.shift();

    // If staff says INCORRECT or LEARN_THIS with a correction, queue it
    if ((action === FEEDBACK_ACTIONS.INCORRECT || action === FEEDBACK_ACTIONS.LEARN_THIS) && correctionText) {
      this.registerLearningEvent(gid, {
        type: action === FEEDBACK_ACTIONS.INCORRECT ? LEARNING_TYPES.CORRECTION : LEARNING_TYPES.PROCEDURE,
        title: `Correzione dello staff su ticket #${ticketId || "chat"}`,
        content: correctionText,
        source: "staff_feedback",
        author: staffUser,
        confidence: 0.95
      }).catch(err => {
        console.error("[Sentinel:LearningEngine] Error registering learning from feedback:", err.message);
      });
    }

    return entry;
  }

  getPendingQueue(guildId) {
    const gid = this.assertGuildId(guildId);
    return this.queue[gid] || [];
  }

  getFeedbackHistory(guildId) {
    const gid = this.assertGuildId(guildId);
    return this.feedbackHistory.get(gid) || [];
  }
}

const defaultLearningEngine = new LearningEngine();
module.exports = {
  LearningEngine,
  defaultLearningEngine,
  LEARNING_TYPES,
  APPROVAL_MODES,
  FEEDBACK_ACTIONS
};
