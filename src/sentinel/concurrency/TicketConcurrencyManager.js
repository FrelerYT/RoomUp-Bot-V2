/**
 * SENTINEL AI — TICKET CONCURRENCY MANAGER
 * 
 * Provides:
 * - Per-ticket sequential execution queue (FIFO serialization per channelId)
 * - State versioning (tracked per ticket)
 * - In-flight action cancellation tokens (for aborting pending AI responses if staff takes over)
 * - Stale-state validation guards
 */

class TicketConcurrencyManager {
  constructor() {
    this.queues = new Map();             // ticketKey -> Promise
    this.versions = new Map();           // ticketKey -> number
    this.cancellationTokens = new Map(); // ticketKey -> Set<CancellationToken>
  }

  getTicketKey(guildId, ticketId) {
    return `${guildId || "global"}:${ticketId || "global"}`;
  }

  getVersion(guildId, ticketId) {
    const key = this.getTicketKey(guildId, ticketId);
    return this.versions.get(key) || 1;
  }

  bumpVersion(guildId, ticketId) {
    const key = this.getTicketKey(guildId, ticketId);
    const next = (this.versions.get(key) || 1) + 1;
    this.versions.set(key, next);
    return next;
  }

  /**
   * Serializes async operations on the same ticket to eliminate race conditions
   */
  async runWithTicketLock(guildId, ticketId, taskFn) {
    const key = this.getTicketKey(guildId, ticketId);
    const prevPromise = this.queues.get(key) || Promise.resolve();

    let taskResolve;
    const taskDone = new Promise(resolve => { taskResolve = resolve; });
    this.queues.set(key, prevPromise.then(() => taskDone));

    try {
      await prevPromise;
      return await taskFn();
    } finally {
      taskResolve();
      if (this.queues.get(key) === taskDone) {
        this.queues.delete(key);
      }
    }
  }

  /**
   * Creates a cancellation token for an in-flight async decision/generation
   */
  createCancellationToken(guildId, ticketId, initialMode = "AI_ACTIVE") {
    const key = this.getTicketKey(guildId, ticketId);
    const version = this.getVersion(guildId, ticketId);

    const token = {
      guildId,
      ticketId,
      key,
      version,
      initialMode,
      isCancelled: false,
      reason: null,
      cancel(reason = "Staff takeover or ticket state changed") {
        this.isCancelled = true;
        this.reason = reason;
      }
    };

    if (!this.cancellationTokens.has(key)) {
      this.cancellationTokens.set(key, new Set());
    }
    this.cancellationTokens.get(key).add(token);

    return token;
  }

  /**
   * Cancels all pending in-flight AI actions for a ticket (e.g. on staff takeover)
   */
  cancelPendingForTicket(guildId, ticketId, reason = "Staff takeover") {
    const key = this.getTicketKey(guildId, ticketId);
    this.bumpVersion(guildId, ticketId);

    const tokens = this.cancellationTokens.get(key);
    if (tokens && tokens.size > 0) {
      for (const token of tokens) {
        token.cancel(reason);
      }
      tokens.clear();
    }
  }

  releaseToken(token) {
    if (!token || !token.key) return;
    const set = this.cancellationTokens.get(token.key);
    if (set) {
      set.delete(token);
      if (set.size === 0) {
        this.cancellationTokens.delete(token.key);
      }
    }
  }
}

const defaultTicketConcurrencyManager = new TicketConcurrencyManager();
module.exports = {
  TicketConcurrencyManager,
  defaultTicketConcurrencyManager
};
