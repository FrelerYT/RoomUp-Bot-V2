/**
 * SENTINEL AI — AUDIT LOGGER & DEBUG MODE
 * 
 * Records every significant AI decision, guard evaluation, and tool execution:
 * {
 *   timestamp, guildId, channelId, userId, ticketId, eventId,
 *   decision, confidence, risk, tool, parameters, result, model, duration, error
 * }
 * 
 * Provides AI Debug Mode for staff (structured diagnostic data without private CoT).
 */

const fs = require("fs");
const path = require("path");

const LOG_FILE = path.join(__dirname, "../../../data/sentinel/audit_logs.json");

class AuditLogger {
  constructor(logFile = LOG_FILE) {
    this.logFile = logFile;
    this.ensureDirectories();
    this.logs = this.loadLogs();
  }

  ensureDirectories() {
    try {
      const dir = path.dirname(this.logFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch (e) {}
  }

  loadLogs() {
    try {
      if (fs.existsSync(this.logFile)) {
        return JSON.parse(fs.readFileSync(this.logFile, "utf8"));
      }
    } catch (e) {}
    return [];
  }

  saveLogs() {
    try {
      this.ensureDirectories();
      fs.writeFileSync(this.logFile, JSON.stringify(this.logs.slice(-1000), null, 2), "utf8");
    } catch (e) {}
  }

  /**
   * Records a complete audit entry
   */
  record({
    guildId,
    channelId,
    userId,
    ticketId = null,
    eventId = null,
    decision = null,
    confidence = null,
    risk = "LOW",
    tool = null,
    parameters = null,
    result = null,
    model = null,
    durationMs = 0,
    error = null
  }) {
    const entry = {
      id: "log_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      guildId: guildId ? String(guildId) : null,
      channelId: channelId ? String(channelId) : null,
      userId: userId ? String(userId) : null,
      ticketId,
      eventId,
      decision: typeof decision === "object" ? decision?.action : decision,
      confidence: typeof confidence === "number" ? confidence : decision?.confidence,
      risk: risk || decision?.risk || "LOW",
      tool,
      parameters,
      result,
      model,
      durationMs,
      error
    };

    this.logs.push(entry);
    if (this.logs.length > 2000) this.logs.shift();
    this.saveLogs();
    return entry;
  }

  /**
   * Retrieves audit logs for a specific guild
   */
  getGuildLogs(guildId, limit = 50) {
    if (!guildId) return this.logs.slice(-limit);
    return this.logs
      .filter(l => l.guildId === String(guildId))
      .slice(-limit);
  }

  /**
   * Generates AI Debug Mode view for staff (Point 42)
   */
  buildDebugView(decision, context, executionResults = []) {
    return {
      debugMode: true,
      timestamp: new Date().toISOString(),
      intent: decision?.intent || "unknown",
      currentState: context?.ticket?.currentState || "UNKNOWN",
      confidence: decision?.confidence ?? 0.0,
      selectedAction: decision?.action || "NONE",
      reasonCategory: decision?.reason || "N/A",
      riskLevel: decision?.risk || "LOW",
      toolsCalled: executionResults.map(r => ({
        toolName: r.toolName,
        success: r.success,
        verified: r.verified,
        error: r.error
      })),
      knowledgeSources: (context?.server?.relevantKnowledge || []).map(k => ({
        title: k.title,
        source: k.source,
        confidence: k.confidence
      })),
      memoryRetrieved: {
        knownFactsCount: context?.ticket?.knownFacts?.length || 0,
        precedentsCount: context?.historical?.precedentExamples?.length || 0
      }
    };
  }
}

const defaultAuditLogger = new AuditLogger();
module.exports = {
  AuditLogger,
  defaultAuditLogger
};
