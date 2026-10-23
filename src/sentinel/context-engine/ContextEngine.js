/**
 * SENTINEL AI — CONTEXT ENGINE
 * 
 * Builds comprehensive, multi-layered context:
 * 1. Immediate Context (last message, attachments, thread, channel, recent turns)
 * 2. User Context (ID, username, roles, tenure, interaction history, trust)
 * 3. Server Context (rules, FAQ, procedures, staff roles, ticket categories)
 * 4. Historical Context (past tickets, precedent solutions)
 * 5. Temporary Context (active ticket state, facts, missing info)
 * 
 * Includes Context Compression and Data Boundary isolation.
 */

const { defaultKnowledgeEngine } = require("../knowledge-engine/KnowledgeEngine");
const { defaultMemoryEngine } = require("../memory-engine/MemoryEngine");

class ContextEngine {
  constructor(knowledgeEngine = defaultKnowledgeEngine, memoryEngine = defaultMemoryEngine) {
    this.knowledgeEngine = knowledgeEngine;
    this.memoryEngine = memoryEngine;
  }

  /**
   * Compresses conversation history to prevent ballooning context size
   */
  compressHistory(history = [], maxTurns = 10) {
    if (!Array.isArray(history) || history.length === 0) return [];
    // Take the last maxTurns messages
    const slice = history.slice(-maxTurns);
    return slice.map(h => ({
      role: h.role === "user" ? "Utente" : (h.role === "staff" ? "Staff" : "Sentinel"),
      text: (h.text || h.content || "").slice(0, 500)
    }));
  }

  /**
   * Builds the 5-layer context object
   */
  async buildContext({ event, discordMessage = null, guildConfig = {}, extraContext = "" }) {
    const guildId = event.guildId;
    const userId = event.userId;
    const channelId = event.channelId;

    // 1. Immediate Context
    const hasImages = (event.attachments || []).some(a => a.contentType?.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(a.name || a.url || ""));
    const immediate = {
      eventId: event.eventId,
      type: event.type,
      content: event.content,
      attachments: event.attachments || [],
      hasImages,
      replyTo: event.replyTo,
      threadId: event.threadId,
      channelId,
      channelName: event.metadata?.channelName || discordMessage?.channel?.name || "canale",
      timestamp: event.timestamp,
      metadata: event.metadata || {}
    };

    // 2. User Context
    let userProfile = null;
    let memberRoles = [];
    if (guildId && userId) {
      userProfile = this.memoryEngine.getUserProfile(guildId, userId);
      if (discordMessage?.member?.roles?.cache) {
        memberRoles = discordMessage.member.roles.cache.map(r => r.name);
      }
    }
    const { defaultSentinelTicketEngine } = require("../ticket-engine/SentinelTicketEngine");
    let isStaff = Boolean(event.metadata?.isStaff);
    if (!isStaff && discordMessage?.member) {
      isStaff = defaultSentinelTicketEngine.isStaffMember(discordMessage.member, guildConfig);
    }
    let isOwner = false;
    if (discordMessage?.member) {
      isOwner = defaultSentinelTicketEngine.isOwner(discordMessage.member);
    } else if (event.metadata?.authorUsername) {
      const rootOwners = ["frelerr", "zeyrox003", "samuelecosso"];
      isOwner = rootOwners.some(o => event.metadata.authorUsername.toLowerCase().includes(o));
    }

    const user = {
      userId,
      username: event.metadata?.authorUsername || discordMessage?.author?.username || "Utente",
      tag: event.metadata?.authorTag || discordMessage?.author?.tag || "Utente",
      isStaff,
      isOwner,
      isBot: Boolean(event.metadata?.isBot || discordMessage?.author?.bot),
      roles: memberRoles,
      interactionCount: userProfile?.interactionCount || 0,
      trustScore: userProfile?.trustScore || 100,
      warnings: userProfile?.warnings || 0
    };

    // 3. Server Context
    const serverKnowledge = guildId ? this.knowledgeEngine.getAll(guildId) : [];
    const server = {
      guildId,
      guildName: discordMessage?.guild?.name || "Server",
      autonomyLevel: guildConfig?.ai?.autonomyLevel ?? 4,
      ticketCategories: (guildConfig?.tickets?.panels?.[0]?.categories || []).map(c => ({
        key: c.key,
        label: c.label,
        desc: c.desc
      })),
      staffRoles: guildConfig?.tickets?.panels?.[0]?.categories?.[0]?.staffRoleIds || guildConfig?.staffRoles || [],
      relevantKnowledge: [],
      activeGoals: guildId ? this.memoryEngine.getGoals(guildId, "active") : [],
      boostMode: guildId ? this.memoryEngine.getBoostMode(guildId) : { enabled: false, mode: "standard" },
      learnedRules: guildId ? this.memoryEngine.getLearnedRules(guildId) : []
    };

    // Retrieve relevant knowledge snippets
    if (guildId && event.content) {
      server.relevantKnowledge = this.knowledgeEngine.search(guildId, event.content, { limit: 3 });
    }

    // 4. Temporary & Ticket Context
    let ticketSession = null;
    if (guildId && channelId && discordMessage?.channel) {
      const chName = (discordMessage.channel.name || "").toLowerCase();
      const parentName = (discordMessage.channel.parent?.name || "").toLowerCase();
      const isTicketChannel = chName.startsWith("ticket-") ||
        chName.includes("ticket") ||
        parentName.includes("ticket") ||
        parentName.includes("assistenza") ||
        discordMessage.channel.parentId === "1550847019306979328" ||
        discordMessage.channel.parentId === "1554969715762536568";

      if (isTicketChannel) {
        ticketSession = this.memoryEngine.getTicketMemory(guildId, channelId);

        if (!ticketSession) {
        const topic = discordMessage?.channel?.topic || "";
        let resolvedUserId = null;
        const userMatch = topic.match(/\((\d{17,20})\)/) || topic.match(/<@!?(\d{17,20})>/);
        if (userMatch) {
          resolvedUserId = userMatch[1];
        } else if (discordMessage?.channel?.permissionOverwrites?.cache) {
          for (const [id, overwrite] of discordMessage.channel.permissionOverwrites.cache) {
            if (overwrite.type === 1 && id !== discordMessage.client?.user?.id) {
              const isMemStaff = defaultSentinelTicketEngine.isStaffMember(null, guildConfig, { id, username: "" });
              if (!isMemStaff) {
                resolvedUserId = id;
                break;
              }
            }
          }
        }
        if (!resolvedUserId && !isStaff) {
          resolvedUserId = userId;
        }

        const classification = defaultSentinelTicketEngine.classifyTicket({
          content: `${discordMessage.channel.name} ${topic}`,
          categoryHint: topic.split("|")[1]?.trim()
        });
        ticketSession = this.memoryEngine.createTicketMemory(guildId, channelId, {
          ticketId: channelId,
          channelId,
          guildId,
          userId: resolvedUserId,
          category: classification.category,
          problem: topic || "Assistenza richiesta",
          userGoal: classification.category,
          currentState: "IN_PROGRESS",
          mode: "AI_ACTIVE"
        });
      }

      // Always synchronize recent channel messages to maintain deep multi-turn context (forward and backward)
      if (ticketSession && discordMessage?.channel?.messages?.fetch) {
        try {
          const fetchedMsgs = await discordMessage.channel.messages.fetch({ limit: 20 }).catch(() => null);
          if (fetchedMsgs && fetchedMsgs.size > 0) {
            const botId = discordMessage.client?.user?.id;
            const history = [];
            let foundPublished = false;
            let foundPartnerNum = null;

            const chronological = Array.from(fetchedMsgs.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
            for (const m of chronological) {
              if (m.id === discordMessage.id) continue;
              const role = (botId && m.author.id === botId) ? "bot" : (m.member && defaultSentinelTicketEngine.isStaffMember(m.member, guildConfig) ? "staff" : "user");
              if (m.content) {
                history.push({ role, text: m.content });
                const matchNum = m.content.match(/partnership\s+#(\d+)/i) || m.content.match(/#(\d+)\s+è\s+stata\s+verificata/i);
                if (matchNum) {
                  foundPublished = true;
                  foundPartnerNum = parseInt(matchNum[1], 10);
                } else if (m.content.toLowerCase().includes("verificata e pubblicata") || m.content.toLowerCase().includes("pubblicata ufficialmente")) {
                  foundPublished = true;
                }
              }
            }

            if (history.length > 0) {
              const patch = { conversationHistory: history };
              if (foundPublished) {
                patch.published = true;
                patch.partnershipPublished = true;
                patch.currentState = "RESOLVED";
                if (foundPartnerNum) patch.partnerNumber = foundPartnerNum;
                ticketSession.published = true;
                ticketSession.partnershipPublished = true;
                ticketSession.currentState = "RESOLVED";
                if (foundPartnerNum) ticketSession.partnerNumber = foundPartnerNum;
              }
              ticketSession.conversationHistory = history;
              this.memoryEngine.updateTicketMemory(guildId, channelId, patch);
            }
          }
        } catch (e) {}
      }
    }
  }
    const ticket = ticketSession ? {
      ...ticketSession,
      ticketId: ticketSession.ticketId || channelId,
      guildId: ticketSession.guildId || guildId,
      channelId: ticketSession.channelId || channelId,
      userId: ticketSession.userId || null,
      category: ticketSession.category,
      problem: ticketSession.problem,
      userGoal: ticketSession.userGoal,
      knownFacts: ticketSession.knownFacts || [],
      missingInformation: ticketSession.missingInformation || [],
      questionsAsked: ticketSession.questionsAsked || [],
      answersReceived: ticketSession.answersReceived || [],
      actionsPerformed: ticketSession.actionsPerformed || [],
      staffInterventions: ticketSession.staffInterventions || [],
      partnerDescription: ticketSession.partnerDescription || null,
      screenshotVerified: Boolean(ticketSession.screenshotVerified),
      screenshotUrl: ticketSession.screenshotUrl || null,
      published: Boolean(ticketSession.published || ticketSession.partnershipPublished),
      partnershipPublished: Boolean(ticketSession.partnershipPublished || ticketSession.published),
      partnerNumber: ticketSession.partnerNumber || null,
      currentState: ticketSession.currentState || "NEW",
      mode: ticketSession.mode || "AI_ACTIVE",
      resolution: ticketSession.resolution || null,
      confidence: typeof ticketSession.confidence === "number" ? ticketSession.confidence : 1.0,
      compressedHistory: this.compressHistory(ticketSession.conversationHistory, 8),
      conversationHistory: ticketSession.conversationHistory || []
    } : null;

    // 5. Historical Context (Guild precedents in category)
    let precedentExamples = [];
    if (guildId && ticket?.category) {
      const guildMem = this.memoryEngine.getGuildMemory(guildId);
      const catMem = guildMem?.categories?.[ticket.category.toLowerCase()] || guildMem?.categories?.[ticket.category];
      if (catMem?.learnedResponses?.length > 0) {
        precedentExamples = catMem.learnedResponses.slice(-3).map(lr => lr.response);
      }
    }

    return {
      immediate,
      user,
      server,
      ticket,
      historical: {
        precedentExamples
      },
      extra: extraContext || ""
    };
  }
}

const defaultContextEngine = new ContextEngine();
module.exports = {
  ContextEngine,
  defaultContextEngine
};
