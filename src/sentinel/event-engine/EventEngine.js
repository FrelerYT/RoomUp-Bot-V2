/**
 * SENTINEL AI — EVENT ENGINE
 * 
 * Centralized, event-driven normalization engine.
 * Converts raw Discord events and internal timers into standard normalized structures:
 * {
 *   eventId, guildId, channelId, userId, type, timestamp, content, attachments, replyTo, threadId, metadata
 * }
 */

const crypto = require("crypto");
const { EventEmitter } = require("events");

const EVENT_TYPES = {
  MESSAGE_CREATE: "MESSAGE_CREATE",
  MESSAGE_UPDATE: "MESSAGE_UPDATE",
  MESSAGE_DELETE: "MESSAGE_DELETE",
  TICKET_CREATE: "TICKET_CREATE",
  TICKET_CLOSE: "TICKET_CLOSE",
  TICKET_REOPEN: "TICKET_REOPEN",
  MEMBER_JOIN: "MEMBER_JOIN",
  MEMBER_LEAVE: "MEMBER_LEAVE",
  MEMBER_UPDATE: "MEMBER_UPDATE",
  ROLE_UPDATE: "ROLE_UPDATE",
  CHANNEL_UPDATE: "CHANNEL_UPDATE",
  REACTION: "REACTION",
  IMAGE_RECEIVED: "IMAGE_RECEIVED",
  STAFF_MESSAGE: "STAFF_MESSAGE",
  STAFF_COMMAND: "STAFF_COMMAND",
  USER_REPLY: "USER_REPLY",
  TIMER: "TIMER",
  ESCALATION: "ESCALATION",
  SYSTEM_EVENT: "SYSTEM_EVENT"
};

class EventEngine extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100);
    this.processedEvents = new Map(); // eventKey -> timestamp
    this.cleanupInterval = setInterval(() => this.cleanupCache(), 60000);
    if (this.cleanupInterval && typeof this.cleanupInterval.unref === "function") {
      this.cleanupInterval.unref();
    }
  }

  cleanupCache(ttlMs = 120000) {
    const cutoff = Date.now() - ttlMs;
    for (const [key, ts] of this.processedEvents.entries()) {
      if (ts < cutoff) {
        this.processedEvents.delete(key);
      }
    }
    // Prevent unbounded memory growth if high volume
    if (this.processedEvents.size > 5000) {
      const keysToDelete = Array.from(this.processedEvents.keys()).slice(0, 1000);
      for (const k of keysToDelete) this.processedEvents.delete(k);
    }
  }

  generateEventId(type, guildId, channelId, userId, timestamp) {
    const raw = `${type}:${guildId || ""}:${channelId || ""}:${userId || ""}:${timestamp || Date.now()}:${Math.random()}`;
    return "evt_" + crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16);
  }

  isDuplicate(dedupKey, ttlMs = 30000) {
    if (!dedupKey) return false;
    const now = Date.now();
    const existing = this.processedEvents.get(dedupKey);
    if (existing && now - existing < ttlMs) {
      return true;
    }
    this.processedEvents.set(dedupKey, now);
    if (this.processedEvents.size > 5000) {
      this.cleanupCache(ttlMs);
    }
    return false;
  }

  /**
   * Transforms raw Discord or system events into the standardized Sentinel Event format.
   */
  normalizeEvent({
    type = EVENT_TYPES.SYSTEM_EVENT,
    guildId = null,
    channelId = null,
    userId = null,
    content = "",
    attachments = [],
    replyTo = null,
    threadId = null,
    metadata = {}
  }) {
    const timestamp = new Date().toISOString();
    const eventId = this.generateEventId(type, guildId, channelId, userId, timestamp);

    return {
      eventId,
      guildId: guildId ? String(guildId) : null,
      channelId: channelId ? String(channelId) : null,
      userId: userId ? String(userId) : null,
      type,
      timestamp,
      content: content || "",
      attachments: Array.isArray(attachments) ? attachments : [],
      replyTo: replyTo || null,
      threadId: threadId || null,
      metadata: metadata || {}
    };
  }

  /**
   * Dispatches normalized event to all listeners
   */
  async dispatchEvent(event) {
    if (!event || !event.eventId) return null;
    this.emit("event", event);
    this.emit(event.type, event);
    return event;
  }

  /**
   * Helper to normalize a Discord.js Message
   */
  normalizeDiscordMessage(message, customType = null, metadata = {}) {
    if (!message) return null;

    const attachments = [];
    if (message.attachments && message.attachments.size > 0) {
      for (const att of message.attachments.values()) {
        attachments.push({
          id: att.id,
          name: att.name,
          url: att.url,
          contentType: att.contentType,
          size: att.size
        });
      }
    }

    const hasImages = attachments.some(a => a.contentType?.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(a.name || ""));
    const determinedType = customType || (hasImages ? EVENT_TYPES.IMAGE_RECEIVED : EVENT_TYPES.MESSAGE_CREATE);

    return this.normalizeEvent({
      type: determinedType,
      guildId: message.guild?.id || null,
      channelId: message.channel?.id || null,
      userId: message.author?.id || null,
      content: message.content || "",
      attachments,
      replyTo: message.reference?.messageId || null,
      threadId: message.channel?.isThread?.() ? message.channel.id : null,
      metadata: {
        authorUsername: message.author?.username,
        authorTag: message.author?.tag,
        isBot: Boolean(message.author?.bot),
        channelName: message.channel?.name,
        ...metadata
      }
    });
  }

  destroy() {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    this.removeAllListeners();
  }
}

const defaultEventEngine = new EventEngine();
module.exports = {
  EventEngine,
  defaultEventEngine,
  EVENT_TYPES
};
