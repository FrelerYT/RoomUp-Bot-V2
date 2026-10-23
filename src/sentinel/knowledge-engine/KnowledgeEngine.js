/**
 * SENTINEL AI — KNOWLEDGE ENGINE
 * 
 * Separates Memory from Knowledge Base.
 * Supports:
 * - SERVER_RULES, SERVER_FAQ, SERVER_PROCEDURES, SERVER_CONFIGURATION,
 *   STAFF_GUIDELINES, LEARNED_KNOWLEDGE, TICKET_KNOWLEDGE, TEMPORARY_CONTEXT.
 * - Versioning & Rollback (v1, v2, etc.).
 * - Temporary knowledge with automatic expiration.
 * - Source-aware answer retrieval (source attribution + confidence).
 * - Multi-tenant isolation by guildId.
 */

const fs = require("fs");
const path = require("path");

const KNOWLEDGE_CATEGORIES = {
  SERVER_RULES: "SERVER_RULES",
  SERVER_FAQ: "SERVER_FAQ",
  SERVER_PROCEDURES: "SERVER_PROCEDURES",
  SERVER_CONFIGURATION: "SERVER_CONFIGURATION",
  STAFF_GUIDELINES: "STAFF_GUIDELINES",
  LEARNED_KNOWLEDGE: "LEARNED_KNOWLEDGE",
  TICKET_KNOWLEDGE: "TICKET_KNOWLEDGE",
  TEMPORARY_CONTEXT: "TEMPORARY_CONTEXT"
};

const KNOWLEDGE_FILE = path.join(__dirname, "../../../data/sentinel/knowledge.json");
const VERSIONS_FILE = path.join(__dirname, "../../../data/sentinel/knowledge_versions.json");

class KnowledgeEngine {
  constructor(storageFile = KNOWLEDGE_FILE, versionsFile = VERSIONS_FILE) {
    this.storageFile = storageFile;
    this.versionsFile = versionsFile;
    this.ensureDirectories();
    this.items = this.loadItems();
    this.versions = this.loadVersions();
  }

  ensureDirectories() {
    try {
      const dir = path.dirname(this.storageFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch (e) {}
  }

  loadItems() {
    try {
      if (fs.existsSync(this.storageFile)) {
        return JSON.parse(fs.readFileSync(this.storageFile, "utf8"));
      }
    } catch (e) {
      console.error("[Sentinel:KnowledgeEngine] Error loading knowledge:", e.message);
    }
    return {}; // guildId -> [items]
  }

  saveItems() {
    try {
      this.ensureDirectories();
      fs.writeFileSync(this.storageFile, JSON.stringify(this.items, null, 2), "utf8");
    } catch (e) {
      console.error("[Sentinel:KnowledgeEngine] Error saving knowledge:", e.message);
    }
  }

  loadVersions() {
    try {
      if (fs.existsSync(this.versionsFile)) {
        return JSON.parse(fs.readFileSync(this.versionsFile, "utf8"));
      }
    } catch (e) {}
    return {}; // itemId -> [versions]
  }

  saveVersions() {
    try {
      this.ensureDirectories();
      fs.writeFileSync(this.versionsFile, JSON.stringify(this.versions, null, 2), "utf8");
    } catch (e) {}
  }

  assertGuildId(guildId) {
    if (!guildId || typeof guildId !== "string") {
      throw new Error("[Sentinel:KnowledgeEngine] MULTI-TENANT VIOLATION: guildId is strictly required.");
    }
    return guildId.trim();
  }

  /**
   * Add a new knowledge document
   */
  addKnowledgeItem(guildId, {
    category = KNOWLEDGE_CATEGORIES.SERVER_FAQ,
    title,
    content,
    keywords = [],
    source = "dashboard",
    author = "staff",
    confidence = 1.0,
    expiration = null, // epoch ms or ISO string
    scope = "global"
  }) {
    const gid = this.assertGuildId(guildId);
    if (!title || !content) throw new Error("Title and content are required for knowledge items.");

    if (!this.items[gid]) this.items[gid] = [];

    const now = new Date().toISOString();
    const id = "knw_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);

    const doc = {
      id,
      guildId: gid,
      category,
      title: title.trim(),
      content: content.trim(),
      keywords: Array.isArray(keywords) ? keywords.map(k => String(k).toLowerCase()) : [],
      source,
      author,
      confidence: typeof confidence === "number" ? confidence : 1.0,
      expiration: expiration ? new Date(expiration).toISOString() : null,
      scope,
      version: 1,
      createdAt: now,
      updatedAt: now
    };

    this.items[gid].push(doc);
    this.saveItems();

    // Initialize version archive
    this.versions[id] = [{ version: 1, doc: { ...doc }, snapshotAt: now }];
    this.saveVersions();

    return doc;
  }

  addDocument(guildId, doc) {
    return this.addKnowledgeItem(guildId, doc);
  }

  /**
   * Update existing knowledge document with version increment
   */
  updateKnowledgeItem(guildId, itemId, patch, author = "staff") {
    const gid = this.assertGuildId(guildId);
    const list = this.items[gid] || [];
    const idx = list.findIndex(i => i.id === itemId);
    if (idx === -1) return null;

    const current = list[idx];
    const newVersion = (current.version || 1) + 1;
    const now = new Date().toISOString();

    const updated = {
      ...current,
      ...patch,
      author: author || current.author,
      version: newVersion,
      updatedAt: now
    };

    list[idx] = updated;
    this.items[gid] = list;
    this.saveItems();

    // Push version archive
    if (!this.versions[itemId]) this.versions[itemId] = [];
    this.versions[itemId].push({ version: newVersion, doc: { ...updated }, snapshotAt: now });
    this.saveVersions();

    return updated;
  }

  /**
   * Rollback knowledge item to a specific version
   */
  rollbackKnowledgeItem(guildId, itemId, targetVersion) {
    const gid = this.assertGuildId(guildId);
    const versions = this.versions[itemId] || [];
    const match = versions.find(v => v.version === targetVersion);
    if (!match) return null;

    const list = this.items[gid] || [];
    const idx = list.findIndex(i => i.id === itemId);
    if (idx === -1) return null;

    const now = new Date().toISOString();
    const restored = {
      ...match.doc,
      version: list[idx].version + 1,
      updatedAt: now
    };

    list[idx] = restored;
    this.items[gid] = list;
    this.saveItems();

    versions.push({ version: restored.version, doc: { ...restored }, snapshotAt: now, note: `Rolled back to v${targetVersion}` });
    this.saveVersions();

    return restored;
  }

  deleteKnowledgeItem(guildId, itemId) {
    const gid = this.assertGuildId(guildId);
    const list = this.items[gid] || [];
    this.items[gid] = list.filter(i => i.id !== itemId);
    this.saveItems();
    return true;
  }

  /**
   * Purge expired items automatically
   */
  purgeExpiredItems(guildId) {
    const gid = this.assertGuildId(guildId);
    const list = this.items[gid] || [];
    const now = Date.now();
    const valid = list.filter(item => {
      if (!item.expiration) return true;
      return new Date(item.expiration).getTime() > now;
    });

    if (valid.length !== list.length) {
      this.items[gid] = valid;
      this.saveItems();
    }
  }

  /**
   * Search knowledge base with relevance scoring, source attribution, and expiration filter
   */
  search(guildId, query, { category = null, limit = 5 } = {}) {
    const gid = this.assertGuildId(guildId);
    this.purgeExpiredItems(gid);

    const list = this.items[gid] || [];
    if (list.length === 0) return [];

    const normQuery = (query || "").toLowerCase().trim();
    const queryTokens = normQuery.replace(/[^\w\s]/g, " ").split(/\s+/).filter(t => t.length >= 2);

    const scored = list
      .filter(item => !category || item.category === category)
      .map(item => {
        let score = 0;
        const normTitle = (item.title || "").toLowerCase();
        const normContent = (item.content || "").toLowerCase();

        // Exact match boost
        if (normQuery && normTitle.includes(normQuery)) score += 10;
        if (normQuery && normContent.includes(normQuery)) score += 5;

        // Keyword tokens match
        for (const token of queryTokens) {
          if (normTitle.includes(token)) score += 3;
          if (normContent.includes(token)) score += 1.5;
          if (item.keywords && item.keywords.some(k => k.includes(token) || token.includes(k))) score += 4;
        }

        // Confidence weighting
        score *= (item.confidence || 1.0);

        return {
          ...item,
          score
        };
      })
      .filter(i => i.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map(item => ({
      id: item.id,
      category: item.category,
      title: item.title,
      content: item.content,
      source: item.source,
      confidence: item.confidence,
      score: item.score,
      version: item.version
    }));
  }

  getAll(guildId, category = null) {
    const gid = this.assertGuildId(guildId);
    this.purgeExpiredItems(gid);
    const list = this.items[gid] || [];
    if (!category) return list;
    return list.filter(i => i.category === category);
  }

  getItemVersions(itemId) {
    return this.versions[itemId] || [];
  }
}

const defaultKnowledgeEngine = new KnowledgeEngine();
module.exports = {
  KnowledgeEngine,
  defaultKnowledgeEngine,
  KNOWLEDGE_CATEGORIES
};
