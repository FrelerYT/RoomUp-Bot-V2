/**
 * SENTINEL AUTONOMOUS STAFF SYSTEM — CORE
 * 
 * Pipeline:
 * EVENT → OBSERVE → CONTEXT → COMPREHENSION → DECISION → PLANNING → ACTION → VERIFICATION → MEMORY
 * 
 * Central coordinator integrating all Sentinel sub-engines.
 */

const { defaultEventEngine } = require("../event-engine/EventEngine");
const { defaultContextEngine } = require("../context-engine/ContextEngine");
const { defaultDecisionEngine, DECISION_ACTIONS } = require("../decision-engine/DecisionEngine");
const { defaultActionPlanner } = require("../action-engine/ActionPlanner");
const { defaultActionExecutor } = require("../action-engine/ActionExecutor");
const { defaultPolicyEngine } = require("../policy-engine/PolicyEngine");
const { defaultRiskEngine } = require("../risk-engine/RiskEngine");
const { defaultMemoryEngine } = require("../memory-engine/MemoryEngine");
const { defaultKnowledgeEngine } = require("../knowledge-engine/KnowledgeEngine");
const { defaultLearningEngine } = require("../learning-engine/LearningEngine");
const { defaultSentinelTicketEngine } = require("../ticket-engine/SentinelTicketEngine");
const { defaultAutonomousModerationEngine } = require("../moderation-engine/AutonomousModerationEngine");
const { defaultVisionEngine } = require("../vision-engine/VisionEngine");
const { defaultEscalationEngine } = require("../escalation-engine/EscalationEngine");
const { defaultSentinelScheduler } = require("../scheduler/SentinelScheduler");
const { defaultAuditLogger } = require("../audit/AuditLogger");
const { defaultMetricsCollector } = require("../metrics/MetricsCollector");
const { defaultSimulationSuite } = require("../simulation/SimulationSuite");
const { defaultTicketConcurrencyManager } = require("../concurrency/TicketConcurrencyManager");

class SentinelCore {
  constructor(options = {}) {
    this.eventEngine = options.eventEngine || defaultEventEngine;
    this.contextEngine = options.contextEngine || defaultContextEngine;
    this.decisionEngine = options.decisionEngine || defaultDecisionEngine;
    this.actionPlanner = options.actionPlanner || defaultActionPlanner;
    this.actionExecutor = options.actionExecutor || defaultActionExecutor;
    this.policyEngine = options.policyEngine || defaultPolicyEngine;
    this.riskEngine = options.riskEngine || defaultRiskEngine;
    this.memoryEngine = options.memoryEngine || defaultMemoryEngine;
    this.knowledgeEngine = options.knowledgeEngine || defaultKnowledgeEngine;
    this.learningEngine = options.learningEngine || defaultLearningEngine;
    this.ticketEngine = options.ticketEngine || defaultSentinelTicketEngine;
    this.moderationEngine = options.moderationEngine || defaultAutonomousModerationEngine;
    this.visionEngine = options.visionEngine || defaultVisionEngine;
    this.escalationEngine = options.escalationEngine || defaultEscalationEngine;
    this.scheduler = options.scheduler || defaultSentinelScheduler;
    this.auditLogger = options.auditLogger || defaultAuditLogger;
    this.metricsCollector = options.metricsCollector || defaultMetricsCollector;
    this.simulationSuite = options.simulationSuite || defaultSimulationSuite;
    this.concurrencyManager = options.concurrencyManager || defaultTicketConcurrencyManager;

    this.simulationSuite.setCore(this);
    this.bindEvents();
  }

  setDiscordClient(client) {
    this.client = client;
    if (client) client._sentinelActive = true;
    this.actionExecutor.toolEngine.setClient(client);
    if (this.scheduler?.setDiscordClient) {
      this.scheduler.setDiscordClient(client);
    }
    this.scheduler.start(300000, client);
    this.bindDiscordGateway(client);
  }

  bindDiscordGateway(client) {
    if (!client || this._gatewayBound) return;
    this._gatewayBound = true;

    // Listen to live messageCreate
    client.on("messageCreate", async (message) => {
      try {
        if (!message || !message.guild || message.author?.bot) return;
        // CRITICAL GUARD: ignore voice channels entirely — never execute ticket actions on GUILD_VOICE
        const channelType = message.channel?.type;
        if (channelType === 2 || channelType === "GUILD_VOICE" || channelType === 13 || channelType === "GUILD_STAGE_VOICE") return;
        if (message.id && this.eventEngine.isDuplicate(`msg:${message.id}`)) return;
        const guildId = message.guild.id;

        const { getGuildConfig } = require("../../config/settingsManager");
        const guildConfig = getGuildConfig(guildId) || {};

        if (!this.policyEngine.isAiEnabled(guildConfig)) return;

        const chName = (message.channel?.name || "").toLowerCase();
        const parentName = (message.channel?.parent?.name || "").toLowerCase();

        // 1. NEI CANALI COUNTING, LIVELLI, ANNUNCI, REGOLE: Sentinel non deve mai parlare o agire
        if (/counting|livell|annunc|regol|ruol|benvenut|log|boost/i.test(chName)) {
          return;
        }

        // 2. Controllo RIGIDO canale ticket: SOLO se il canale inizia con ticket-, partnership- o contiene ticket nel nome/categoria
        const isTicket = chName.startsWith("ticket-") ||
          chName.startsWith("partnership-") ||
          chName.includes("ticket") ||
          parentName.includes("ticket") ||
          parentName.includes("assistenza") ||
          message.channel.parentId === "1550847019306979328" ||
          message.channel.parentId === "1554969715762536568";

        if (!isTicket) {
          // Fuori dai ticket: Sentinel esegue SOLO moderazione autonoma di sicurezza (spam/phishing/link dannosi)
          const modResult = await this.moderationEngine.evaluateMessage(message, guildConfig);
          if (modResult.action === "ACT") {
            if (modResult.deleteMessage) {
              await message.delete().catch(() => null);
            }
            if (modResult.recommendedTool) {
              await this.actionExecutor.executePlan([{
                toolName: modResult.recommendedTool,
                params: modResult.params || {}
              }], {
                guildId,
                channelId: message.channel.id,
                userId: message.author.id,
                guildConfig,
                discordClient: client
              });
            }
            this.auditLogger.record({
              guildId,
              channelId: message.channel.id,
              userId: message.author.id,
              decision: "ACT_MODERATION",
              confidence: modResult.confidence || 0.95,
              risk: "MEDIUM",
              tool: modResult.recommendedTool,
              reason: modResult.reason
            });
          }
          // Non trattare MAI canali normali (salotto, comandi, counting) come ticket!
          return;
        } else {
          // Message inside ticket channel
          const isStaff = this.ticketEngine.isStaffMember(message.member, guildConfig);
          const hasImages = message.attachments?.some(a => a.contentType?.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(a.name || ""));
          const eventType = isStaff ? "STAFF_MESSAGE" : (hasImages ? "IMAGE_RECEIVED" : "USER_REPLY");

          const normEvent = this.eventEngine.normalizeDiscordMessage(message, eventType, {
            isStaff,
            authorUsername: message.author.username,
            messageId: message.id
          });

          await this.processEvent(normEvent, {
            discordMessage: message,
            guildConfig,
            targetMember: message.member,
            botMember: message.guild.members?.me
          });
        }
      } catch (err) {
        console.error("[Sentinel:Core] Error in live gateway listener:", err.message);
      }
    });

    client.on("messageUpdate", async (oldMsg, newMsg) => {
      try {
        if (!newMsg || !newMsg.guild || newMsg.author?.bot) return;
        if (newMsg.id && this.eventEngine.isDuplicate(`msg_upd:${newMsg.id}:${newMsg.content}`)) return;
        const normEvent = this.eventEngine.normalizeDiscordMessage(newMsg, "MESSAGE_UPDATE", { messageId: newMsg.id });
        this.eventEngine.dispatchEvent(normEvent);
      } catch (e) {}
    });

    client.on("messageDelete", async (message) => {
      try {
        if (!message || !message.guild) return;
        if (message.id && this.eventEngine.isDuplicate(`msg_del:${message.id}`)) return;
        const normEvent = this.eventEngine.normalizeDiscordMessage(message, "MESSAGE_DELETE", { messageId: message.id });
        this.eventEngine.dispatchEvent(normEvent);
      } catch (e) {}
    });

    client.on("channelDelete", async (channel) => {
      try {
        if (!channel || !channel.guild) return;
        this.memoryEngine.updateTicketMemory(channel.guild.id, channel.id, {
          currentState: "CLOSED",
          mode: "RESOLVED"
        });
      } catch (e) {}
    });
  }

  bindEvents() {
    this.eventEngine.on("event", async event => {
      try {
        await this.processEvent(event);
      } catch (err) {
        console.error("[Sentinel:Core] Error processing event:", err.message);
        this.metricsCollector.increment("errors");
      }
    });
  }

  /**
   * Master Execution Pipeline:
   * EVENT → OBSERVE → CONTEXT → COMPREHENSION → DECISION → PLANNING → ACTION → VERIFICATION → MEMORY
   */
  async processEvent(event, options = {}) {
    const { guildId, channelId } = event;
    if (channelId) {
      return await this.concurrencyManager.runWithTicketLock(guildId, channelId, async () => {
        return await this._processEventInternal(event, options);
      });
    }
    return await this._processEventInternal(event, options);
  }

  async _processEventInternal(event, options = {}) {
    const startTime = Date.now();
    const { guildId, channelId, userId } = event;
    const guildConfig = options.guildConfig || {};
    const dryRun = Boolean(options.dryRun || (guildId && this.simulationSuite.isCanary(guildId)));

    const cancelToken = (guildId && channelId)
      ? this.concurrencyManager.createCancellationToken(guildId, channelId)
      : null;

    try {
      // Event deduplication guard
      const eventDedupKey = event.metadata?.messageId
        ? `evt_msg:${event.metadata.messageId}`
        : null;
      if (eventDedupKey && this.eventEngine.isDuplicate(eventDedupKey)) {
        return { status: "DUPLICATE_EVENT", eventId: event.eventId };
      }

      this.metricsCollector.increment("messagesHandled");

      // 1. OBSERVE: Autonomy and rate limit checks
      if (guildId && !this.policyEngine.isAiEnabled(guildConfig)) {
        return { status: "AI_DISABLED", eventId: event.eventId };
      }

      const rateCheck = this.riskEngine.checkRateLimit(`guild:${guildId}`, 60, 60000);
      if (rateCheck.limited) {
        return { status: "RATE_LIMITED", eventId: event.eventId, retryAfterMs: rateCheck.retryAfterMs };
      }

      // Check closed ticket isolation before building full context
      if (guildId && channelId) {
        const freshTicket = this.memoryEngine.getTicketMemory(guildId, channelId);
        if (freshTicket && freshTicket.currentState === "CLOSED") {
          const isStaff = options.discordMessage ? this.ticketEngine.isStaffMember(options.discordMessage.member, guildConfig, options.discordMessage.author) : false;
          const isOwner = options.discordMessage ? this.ticketEngine.isOwner(options.discordMessage.member, options.discordMessage.author) : false;
          const isReopen = (isStaff || isOwner) && options.discordMessage?.content && /\b(riapri|reopen)\b/i.test(options.discordMessage.content);
          if (!isReopen) {
            return { status: "TICKET_CLOSED_BLOCKED" };
          }
        }
      }

      // 2. CONTEXT: Build 5-layer context
      const context = await this.contextEngine.buildContext({
        event,
        discordMessage: options.discordMessage,
        guildConfig,
        extraContext: options.extraContext
      });

      // 3. COMPREHENSION & TICKET SPECIALIZATION: Check staff takeover or ticket state
      if (context.ticket && options.discordMessage) {
        const ticketResult = await this.ticketEngine.processTicketMessage({
          message: options.discordMessage,
          session: context.ticket,
          guildConfig
        });

        if (ticketResult.handled) {
          if (event.content && context.ticket) {
            this.memoryEngine.updateTicketMemory(guildId, channelId, cur => {
              const history = cur.conversationHistory || [];
              history.push({ role: context.user.isStaff ? "staff" : "user", text: event.content });
              return { conversationHistory: history };
            });
          }
          const durationMs = Date.now() - startTime;
          this.auditLogger.record({
            guildId,
            channelId,
            userId,
            ticketId: context.ticket.ticketId,
            eventId: event.eventId,
            decision: ticketResult.action,
            confidence: 1.0,
            risk: "LOW",
            durationMs
          });
          return { status: "TICKET_SPECIALIZED", action: ticketResult.action };
        }
      }

      // Cancellation check before expensive AI decision
      if (cancelToken?.isCancelled) {
        return { status: "CANCELLED", reason: cancelToken.reason };
      }

      // Check if ticket is in AI_PASSIVE / STAFF_TAKEOVER mode
      if (context.ticket) {
        const freshTicket = this.memoryEngine.getTicketMemory(guildId, channelId);
        if (freshTicket && (freshTicket.mode === "AI_PASSIVE" || freshTicket.mode === "STAFF_ACTIVE" || freshTicket.currentState === "STAFF_TAKEOVER")) {
          return { status: "AI_PASSIVE_BLOCKED" };
        }
      }

      // 4. DECISION: AI Reasoner or Deterministic Heuristic
      const decision = await this.decisionEngine.decide(context, guildConfig);

      // Cancellation check after AI reasoning
      if (cancelToken?.isCancelled) {
        return { status: "CANCELLED", reason: cancelToken.reason };
      }

      // 5. PLANNING: Plan tool actions
      const plan = this.actionPlanner.planActions(decision, context);

      // Cancellation check before executing actions
      if (cancelToken?.isCancelled) {
        return { status: "CANCELLED", reason: cancelToken.reason };
      }

      // 6. ACTION & VERIFICATION: Execute through Action Guard & Verifier
      let executionResults = [];
      if (plan.length > 0) {
        executionResults = await this.actionExecutor.executePlan(plan, {
          guildId,
          channelId,
          userId,
          guildConfig,
          dryRun,
          discordClient: this.client,
          targetMember: options.targetMember,
          botMember: options.botMember
        });
      }

      // 7. MEMORY: Commit updates to ticket and audit logs
      if (context.ticket) {
        this.memoryEngine.updateTicketMemory(guildId, channelId, current => {
          const history = current.conversationHistory || [];
          if (event.content) {
            history.push({ role: context.user.isStaff ? "staff" : "user", text: event.content });
          }
          if (decision.message) {
            history.push({ role: "bot", text: decision.message });
          }
          return {
            conversationHistory: history,
            currentState: decision.action === "CLOSE" ? "RESOLVED" : current.currentState,
            resolution: decision.action === "CLOSE" ? (decision.reason || "Risolto") : current.resolution
          };
        });
      } else if (guildId && userId) {
        this.memoryEngine.updateUserProfile(guildId, userId, cur => ({
          interactionCount: (cur.interactionCount || 0) + 1,
          lastSeenAt: new Date().toISOString()
        }));
      }

      const durationMs = Date.now() - startTime;
      this.metricsCollector.recordResponseTime(durationMs);
      this.metricsCollector.increment("actionsExecuted", executionResults.filter(r => r.success).length);

      this.auditLogger.record({
        guildId,
        channelId,
        userId,
        ticketId: context.ticket?.ticketId,
        eventId: event.eventId,
        decision,
        confidence: decision.confidence,
        risk: decision.risk,
        tool: executionResults.map(r => r.toolName).join(", ") || null,
        result: executionResults.map(r => ({ tool: r.toolName, ok: r.success })),
        durationMs
      });

      const debugView = this.auditLogger.buildDebugView(decision, context, executionResults);

      return {
        status: "COMPLETED",
        eventId: event.eventId,
        decision,
        executionResults,
        debugView,
        durationMs
      };
    } finally {
      if (cancelToken) {
        this.concurrencyManager.releaseToken(cancelToken);
      }
    }
  }
}

const defaultSentinelCore = new SentinelCore();
module.exports = {
  SentinelCore,
  defaultSentinelCore
};
