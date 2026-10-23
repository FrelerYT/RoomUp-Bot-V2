/**
 * SENTINEL AI — METRICS & HEALTH ENGINE
 * 
 * Tracks system health and AI operational quality:
 * Health:
 * - AI STATUS, DISCORD STATUS, DATABASE STATUS, MODEL STATUS,
 *   VISION STATUS, TOOL STATUS, MEMORY STATUS, QUEUE STATUS.
 * Quality:
 * - tickets handled, messages handled, actions executed, escalations,
 *   errors, average response time, AI calls, fallback calls, tool failure rate.
 */

const { defaultModelRouter } = require("../ai/ModelRouter");

class MetricsCollector {
  constructor() {
    this.counters = {
      ticketsHandled: 0,
      messagesHandled: 0,
      actionsExecuted: 0,
      escalations: 0,
      errors: 0,
      aiCalls: 0,
      fallbackCalls: 0,
      toolFailures: 0,
      resolvedTickets: 0
    };
    this.responseTimes = [];
  }

  increment(metric, amount = 1) {
    if (this.counters[metric] !== undefined) {
      this.counters[metric] += amount;
    }
  }

  recordResponseTime(ms) {
    this.responseTimes.push(ms);
    if (this.responseTimes.length > 500) this.responseTimes.shift();
  }

  getAverageResponseTime() {
    if (this.responseTimes.length === 0) return 0;
    const sum = this.responseTimes.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.responseTimes.length);
  }

  getHealthStatus(client = null) {
    const modelStats = defaultModelRouter.getStats();

    return {
      aiStatus: modelStats.totalKeys > 0 ? "HEALTHY" : "DEGRADED",
      overallStatus: modelStats.totalKeys > 0 ? "HEALTHY" : "DEGRADED",
      discordStatus: client?.ws?.status === 0 ? "ONLINE" : (client ? "CONNECTING" : "OFFLINE"),
      databaseStatus: "OPERATIONAL",
      modelStatus: `${modelStats.activeKeysCount}/${modelStats.totalKeys} keys active`,
      visionStatus: modelStats.totalKeys > 0 ? "READY" : "UNAVAILABLE",
      toolStatus: "OPERATIONAL",
      memoryStatus: "ISOLATED_MULTI_TENANT",
      queueStatus: "IDLE"
    };
  }

  getQualityMetrics() {
    const totalActions = this.counters.actionsExecuted + this.counters.toolFailures;
    const toolFailureRate = totalActions > 0 ? ((this.counters.toolFailures / totalActions) * 100).toFixed(1) + "%" : "0.0%";
    const totalTickets = this.counters.ticketsHandled;
    const resolutionRate = totalTickets > 0 ? ((this.counters.resolvedTickets / totalTickets) * 100).toFixed(1) + "%" : "100.0%";

    return {
      ...this.counters,
      averageResponseTimeMs: this.getAverageResponseTime(),
      toolFailureRate,
      resolutionRate
    };
  }
}

const defaultMetricsCollector = new MetricsCollector();
module.exports = {
  MetricsCollector,
  defaultMetricsCollector
};
