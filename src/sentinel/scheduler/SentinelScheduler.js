/**
 * SENTINEL AI — PROACTIVE SCHEDULER
 * 
 * Generates proactive internal events:
 * - Inactivity reminders for unattended tickets (e.g. 12h)
 * - Auto-closing tickets with prior warning (e.g. 24h)
 * - Expiration cleanup of temporary rules and knowledge
 * Runs cleanly on interval without aggressive polling.
 */

const { defaultMemoryEngine } = require("../memory-engine/MemoryEngine");
const { defaultKnowledgeEngine } = require("../knowledge-engine/KnowledgeEngine");

class SentinelScheduler {
  constructor(memoryEngine = defaultMemoryEngine, knowledgeEngine = defaultKnowledgeEngine) {
    this.memoryEngine = memoryEngine;
    this.knowledgeEngine = knowledgeEngine;
    this.timer = null;
    this.client = null;
    this.registeredTasks = [];
  }

  setDiscordClient(client) {
    this.client = client;
  }

  start(intervalMs = 300000, client = null) { // Default every 5 minutes
    if (client) this.client = client;
    if (this.timer) return;
    this.timer = setInterval(() => this.runProactiveChecks(this.client), intervalMs);
    if (this.timer && typeof this.timer.unref === "function") {
      this.timer.unref();
    }
    console.log(`[Sentinel:Scheduler] Proactive scheduler active (interval: ${intervalMs / 1000}s).`);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runProactiveChecks(client = null) {
    const discordClient = client || this.client;
    const allSessions = this.memoryEngine.sessions || {};
    const now = Date.now();

    for (const [key, session] of Object.entries(allSessions)) {
      if (!session || session.currentState === "CLOSED" || session.currentState === "RESOLVED") {
        continue;
      }

      const updatedAt = new Date(session.updatedAt || session.createdAt).getTime();
      const elapsedMs = now - updatedAt;

      // 1. Inactivity reminder (12 hours = 43200000 ms)
      if (elapsedMs >= 43200000 && !session.remindedAt && session.currentState === "WAITING_FOR_USER") {
        session.remindedAt = new Date().toISOString();
        this.memoryEngine.updateTicketMemory(session.guildId, session.channelId || session.ticketId, {
          remindedAt: session.remindedAt
        });

        if (discordClient) {
          const chId = session.channelId || session.ticketId;
          const channel = discordClient.channels?.cache?.get(chId) || await discordClient.channels?.fetch?.(chId).catch(() => null);
          if (channel) {
            await channel.send("Ti lascio ancora un po' di tempo. Quando sei pronto puoi rispondere qui.").catch(() => null);
          }
        }
      }

      // 2. Auto-close after 24 hours of inactivity if already reminded
      if (elapsedMs >= 86400000 && session.remindedAt && session.currentState === "WAITING_FOR_USER") {
        this.memoryEngine.updateTicketMemory(session.guildId, session.channelId || session.ticketId, {
          currentState: "CLOSED",
          resolution: "Chiuso automaticamente per inattività prolungata (24h)."
        });

        if (discordClient) {
          const chId = session.channelId || session.ticketId;
          const channel = discordClient.channels?.cache?.get(chId) || await discordClient.channels?.fetch?.(chId).catch(() => null);
          if (channel) {
            await channel.send("🔒 **Ticket chiuso automaticamente:** nessuna risposta ricevuta nelle ultime 24 ore.").catch(() => null);
          }
        }
      }
    }

    // 3. Expiration cleanup of temporary rules and knowledge items across guilds
    try {
      const { defaultPolicyEngine } = require("../policy-engine/PolicyEngine");
      const activeGuildIds = new Set([
        ...Object.keys(this.memoryEngine.cache || {}),
        ...Object.values(allSessions).map(s => s.guildId).filter(Boolean)
      ]);
      for (const gId of activeGuildIds) {
        if (this.knowledgeEngine?.purgeExpiredItems) {
          this.knowledgeEngine.purgeExpiredItems(gId);
        }
        if (defaultPolicyEngine?.getActiveTemporaryRules) {
          defaultPolicyEngine.getActiveTemporaryRules(gId);
        }
      }
    } catch (e) {}
  }
}

const defaultSentinelScheduler = new SentinelScheduler();
module.exports = {
  SentinelScheduler,
  defaultSentinelScheduler
};
