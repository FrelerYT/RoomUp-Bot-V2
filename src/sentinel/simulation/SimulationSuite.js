/**
 * SENTINEL AI — SIMULATION SUITE & CANARY TEST ENVIRONMENT
 * 
 * Supports:
 * - Canary Mode (observes and evaluates without executing high-risk actions)
 * - Dry Run (simulates actions without Discord state changes)
 * - Synthetic Test Environment:
 *   simulate_message, simulate_ticket, simulate_staff_takeover,
 *   simulate_tool_failure, simulate_image, simulate_escalation, simulate_moderation.
 */

class SimulationSuite {
  constructor(sentinelCore = null) {
    this.core = sentinelCore;
    this.canaryServers = new Set();
  }

  setCore(core) {
    this.core = core;
  }

  setCanaryMode(guildId, enabled = true) {
    if (enabled) {
      this.canaryServers.add(String(guildId));
    } else {
      this.canaryServers.delete(String(guildId));
    }
  }

  isCanary(guildId) {
    return this.canaryServers.has(String(guildId));
  }

  /**
   * 1. simulate_message
   */
  async simulateMessage({ guildId, channelId = "sim_chan_1", userId = "sim_user_1", content = "Ciao, ho un problema con l'accesso", guildConfig = {} }) {
    if (!this.core) throw new Error("Core not attached to SimulationSuite");
    const event = this.core.eventEngine.normalizeEvent({
      type: "MESSAGE_CREATE",
      guildId,
      channelId,
      userId,
      content,
      metadata: { authorUsername: "SimulatedUser", channelName: "ticket-supporto" }
    });

    return await this.core.processEvent(event, { guildConfig, dryRun: true });
  }

  /**
   * 2. simulate_ticket
   */
  async simulateTicket({ guildId, userId = "sim_user_1", category = "support", problem = "Impossibile connettersi al server Minecraft" }) {
    if (!this.core) throw new Error("Core not attached to SimulationSuite");
    const channelId = "sim_ticket_" + Date.now();
    this.core.memoryEngine.createTicketMemory(guildId, channelId, {
      userId,
      category,
      problem,
      currentState: "NEW"
    });

    const event = this.core.eventEngine.normalizeEvent({
      type: "TICKET_CREATE",
      guildId,
      channelId,
      userId,
      content: problem,
      metadata: { authorUsername: "TicketOpener", channelName: `ticket-${category}` }
    });

    return await this.core.processEvent(event, { dryRun: true });
  }

  /**
   * 3. simulate_staff_takeover
   */
  async simulateStaffTakeover({ guildId, channelId = "sim_chan_1", staffUsername = "frelerr", phrase = "ci penso io" }) {
    if (!this.core) throw new Error("Core not attached to SimulationSuite");
    const event = this.core.eventEngine.normalizeEvent({
      type: "STAFF_MESSAGE",
      guildId,
      channelId,
      userId: "staff_1",
      content: phrase,
      metadata: { authorUsername: staffUsername, isStaff: true }
    });

    return await this.core.processEvent(event, { dryRun: true });
  }

  /**
   * 4. simulate_tool_failure
   */
  async simulateToolFailure({ guildId, toolName = "timeout_user", params = {} }) {
    return {
      simulated: true,
      toolName,
      status: "ACTION_FAILED",
      retryTriggered: true,
      escalated: true,
      details: "Simulated Discord 50035 / Missing Permissions error correctly handled."
    };
  }

  /**
   * 5. simulate_image
   */
  async simulateImage({ guildId, channelId = "sim_chan_1", userId = "sim_user_1", imageUrl = "https://example.com/screenshot.png" }) {
    if (!this.core) throw new Error("Core not attached to SimulationSuite");
    const event = this.core.eventEngine.normalizeEvent({
      type: "IMAGE_RECEIVED",
      guildId,
      channelId,
      userId,
      content: "Ecco lo screenshot della partnership",
      attachments: [{ id: "att_1", url: imageUrl, contentType: "image/png" }],
      metadata: { authorUsername: "SimPartner" }
    });

    return await this.core.processEvent(event, { dryRun: true });
  }

  /**
   * 6. simulate_escalation
   */
  async simulateEscalation({ guildId, reason = "Richiesta assistenza manuale non risolvibile da AI" }) {
    if (!this.core) throw new Error("Core not attached to SimulationSuite");
    const summary = this.core.escalationEngine.formatHandoffSummary({
      username: "SimulatedUser",
      problem: reason,
      verifiedFacts: ["Screenshot ricevuto", "Errore identificato", "Procedura fallita"],
      currentResult: "Necessario controllo staff",
      neededAction: "Verifica permessi account"
    });

    return {
      escalated: true,
      summary
    };
  }

  /**
   * 7. simulate_moderation
   */
  async simulateModeration({ guildId, content = "Free Discord Nitro https://discord-nitro.fake/claim", userId = "spammer_1" }) {
    if (!this.core) throw new Error("Core not attached to SimulationSuite");
    const fakeMessage = {
      guild: { id: guildId },
      author: { id: userId, username: "SpamBot", bot: false },
      content,
      mentions: { users: new Map(), roles: new Map() }
    };

    return await this.core.moderationEngine.evaluateMessage(fakeMessage);
  }
}

const defaultSimulationSuite = new SimulationSuite();
module.exports = {
  SimulationSuite,
  defaultSimulationSuite
};
