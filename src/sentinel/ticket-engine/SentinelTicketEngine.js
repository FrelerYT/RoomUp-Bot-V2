/**
 * SENTINEL AI — TICKET ENGINE
 * 
 * Complete lifecycle ticket management:
 * - Ticket States:
 *   NEW, CLASSIFYING, WAITING_FOR_USER, IN_PROGRESS, WAITING_FOR_STAFF,
 *   STAFF_TAKEOVER, AI_ACTIVE, ESCALATED, RESOLVED, CLOSING, CLOSED, REOPENED.
 * - Staff Takeover, Handover, Directives, and Live Learning.
 * - Staff Hierarchy Recognition.
 * - Closing Intelligence (Resolution detection vs ambiguous acknowledgments).
 * - Autonomous Ticket Summary generation.
 */

const { defaultMemoryEngine } = require("../memory-engine/MemoryEngine");
const { defaultLearningEngine, LEARNING_TYPES } = require("../learning-engine/LearningEngine");
const { defaultModelRouter } = require("../ai/ModelRouter");
const { defaultVisionEngine } = require("../vision-engine/VisionEngine");
const { defaultToolEngine } = require("../tool-engine/ToolEngine");
const { defaultActionGuard } = require("../action-guard/ActionGuard");
const { defaultActionVerifier } = require("../action-verifier/ActionVerifier");
const { defaultAuditLogger } = require("../audit/AuditLogger");
const { defaultTicketConcurrencyManager } = require("../concurrency/TicketConcurrencyManager");
const { defaultCommandIntentDetector, INTENT_TYPES } = require("./CommandIntentDetector");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const TICKET_CATEGORIES = {
  GENERAL: "GENERAL",
  ACCOUNT: "ACCOUNT",
  SUPPORT: "SUPPORT",
  REPORT: "REPORT",
  BAN_APPEAL: "BAN_APPEAL",
  PARTNERSHIP: "PARTNERSHIP",
  SHOP: "SHOP",
  MINECRAFT: "MINECRAFT",
  STAFF: "STAFF",
  CREATOR: "CREATOR",
  OTHER: "OTHER"
};

const TICKET_STATES = {
  NEW: "NEW",
  CLASSIFYING: "CLASSIFYING",
  WAITING_FOR_USER: "WAITING_FOR_USER",
  IN_PROGRESS: "IN_PROGRESS",
  WAITING_FOR_STAFF: "WAITING_FOR_STAFF",
  STAFF_TAKEOVER: "STAFF_TAKEOVER",
  AI_ACTIVE: "AI_ACTIVE",
  AI_PASSIVE: "AI_PASSIVE",
  AI_RESUME: "AI_RESUME",
  ESCALATED: "ESCALATED",
  RESOLVED: "RESOLVED",
  CLOSING: "CLOSING",
  CLOSED: "CLOSED",
  REOPENED: "REOPENED"
};

const OPERATIONAL_MODES = {
  AI_ACTIVE: "AI_ACTIVE",
  AI_PASSIVE: "AI_PASSIVE",
  STAFF_ACTIVE: "STAFF_ACTIVE",
  WAITING_USER: "WAITING_USER",
  ESCALATED: "ESCALATED",
  RESOLVED: "RESOLVED"
};

const STAFF_HIERARCHY = [
  "OWNER",
  "ADMIN",
  "MANAGER",
  "MODERATOR",
  "SUPPORT",
  "PARTNERSHIP",
  "HELPER",
  "AI",
  "USER"
];

function extractMemberFigures(text) {
  if (!text) return [];
  const str = String(text);
  const figures = [];
  const kMatches = str.matchAll(/\b(\d+(?:[.,]\d+)?)\s*k\+?\b/gi);
  for (const m of kMatches) {
    const rawVal = parseFloat(m[1].replace(",", "."));
    const val = Math.round(rawVal * 1000);
    if (val >= 10 && val <= 10000000 && !figures.includes(String(val))) {
      figures.push(String(val));
    }
  }
  const regex = /\b\d{1,3}(?:[.,]\d{3})+\b|\b\d+\b/g;
  const matches = str.match(regex) || [];
  for (const n of matches) {
    const clean = n.replace(/[.,]/g, "");
    const val = parseInt(clean, 10);
    if (val >= 10 && val <= 10000000 && !figures.includes(clean)) {
      figures.push(clean);
    }
  }
  return figures;
}

class SentinelTicketEngine {
  constructor(
    memoryEngine = defaultMemoryEngine,
    learningEngine = defaultLearningEngine,
    modelRouter = defaultModelRouter,
    visionEngine = defaultVisionEngine,
    toolEngine = defaultToolEngine,
    actionGuard = defaultActionGuard,
    actionVerifier = defaultActionVerifier,
    auditLogger = defaultAuditLogger,
    concurrencyManager = defaultTicketConcurrencyManager,
    commandIntentDetector = defaultCommandIntentDetector
  ) {
    this.memoryEngine = memoryEngine || defaultMemoryEngine;
    if (learningEngine && typeof learningEngine === "object" && learningEngine.learningEngine) {
      this.learningEngine = learningEngine.learningEngine;
      if (learningEngine.knowledgeEngine) this.knowledgeEngine = learningEngine.knowledgeEngine;
    } else {
      this.learningEngine = learningEngine || defaultLearningEngine;
    }
    const { defaultKnowledgeEngine } = require("../knowledge-engine/KnowledgeEngine");
    this.knowledgeEngine = this.knowledgeEngine || defaultKnowledgeEngine;
    this.modelRouter = modelRouter || defaultModelRouter;
    this.visionEngine = visionEngine || defaultVisionEngine;
    this.toolEngine = toolEngine || defaultToolEngine;
    this.actionGuard = actionGuard || defaultActionGuard;
    this.actionVerifier = actionVerifier || defaultActionVerifier;
    this.auditLogger = auditLogger || defaultAuditLogger;
    this.concurrencyManager = concurrencyManager || defaultTicketConcurrencyManager;
    this.commandIntentDetector = commandIntentDetector || defaultCommandIntentDetector;
  }

  cleanText(text) {
    if (!text) return "";
    return text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "").trim();
  }

  logCriticalEvent(eventName, data = {}) {
    if (eventName === "STAFF_TAKEOVER") {
      console.log(`\nEVENT:\nMESSAGE_CREATE\n\nAUTHOR:\nstaff\n\nCLASSIFIED INTENT:\nSTAFF_TAKEOVER\n\nAUTHORIZATION:\nPASS\n\nPREVIOUS STATE:\n${data.previousState || "AI_ACTIVE"}\n\nNEW STATE:\nSTAFF_TAKEOVER\n\nAI RESPONSE:\nBLOCKED\n\nREASON:\nHuman takeover\n`);
    } else if (eventName === "CLOSE_TICKET") {
      console.log(`\nINTENT:\nCLOSE_TICKET\n\nAUTHORIZED:\n${data.authorized || "YES"}\n\nTOOL:\n${data.tool || "close_ticket"}\n\nEXECUTION:\n${data.execution || "SUCCESS"}\n\nVERIFICATION:\n${data.verification || "SUCCESS"}\n\nFINAL STATE:\n${data.finalState || "CLOSED"}\n`);
    } else if (eventName === "REOPEN_TICKET") {
      console.log(`\nINTENT:\nREOPEN_TICKET\n\nAUTHORIZED:\n${data.authorized || "YES"}\n\nTOOL:\n${data.tool || "reopen_ticket"}\n\nEXECUTION:\n${data.execution || "SUCCESS"}\n\nVERIFICATION:\n${data.verification || "SUCCESS"}\n\nFINAL STATE:\n${data.finalState || "AI_ACTIVE"}\n`);
    }
  }

  async sendTicketReply(channel, session, replyText, fallbackVariant) {
    const guildId = session?.guildId || channel.guild?.id;
    const channelId = session?.channelId || channel.id;

    // Stale-state cancellation validation (Section 9)
    if (guildId && channelId) {
      const freshSession = this.memoryEngine.getTicketMemory(guildId, channelId);
      if (freshSession) {
        if (freshSession.currentState === TICKET_STATES.STAFF_TAKEOVER ||
            freshSession.mode === OPERATIONAL_MODES.AI_PASSIVE ||
            freshSession.mode === OPERATIONAL_MODES.STAFF_ACTIVE ||
            freshSession.currentState === TICKET_STATES.CLOSED) {
          console.log(`[Sentinel:TicketEngine] Response cancelled: ticket entered ${freshSession.currentState}/${freshSession.mode}`);
          return null;
        }
      }
    }

    let finalMsg = this.cleanText(replyText);
    const lastMsg = session?.lastBotMessage ? this.cleanText(session.lastBotMessage) : "";

    // Normalize for comparison
    const normFinal = finalMsg.toLowerCase().replace(/[^\w\s]/g, "").trim();
    const normLast = lastMsg.toLowerCase().replace(/[^\w\s]/g, "").trim();

    // Anti-repetition check: if identical or near-identical message was just sent
    if (normLast && normFinal === normLast) {
      finalMsg = fallbackVariant
        ? this.cleanText(fallbackVariant)
        : "Ti ascolto, dimmi pure: qual è il tuo dubbio o la tua richiesta? Sono a tua completa disposizione.";
    }

    const sent = await channel.send(finalMsg).catch(() => null);
    if (session) {
      session.lastBotMessage = finalMsg;
      if (guildId && channel.id) {
        this.memoryEngine.updateTicketMemory(guildId, channel.id, {
          lastBotMessage: finalMsg
        });
      }
    }
    return sent;
  }

  isStaffMember(member, guildConfig = {}, author = null) {
    const userObj = member?.user || member || author;
    const username = (userObj?.username || "").toLowerCase();

    // Built-in Root Owners & Staff
    const rootStaff = ["frelerr", "zeyrox003", "samuelecosso", "kimo05868", "the_nogitsune", "davidowskii"];
    if (rootStaff.some(s => username.includes(s))) return true;

    if (!member) return false;

    // Discord Permissions check
    if (member.permissions?.has?.("ManageMessages") || member.permissions?.has?.("Administrator") || member.permissions?.has?.("ManageGuild")) {
      return true;
    }

    // Ruolo Staff Globale (v1: 1550846887085740125, v2: 1554969549076566117)
    if (member.roles?.cache) {
      if (typeof member.roles.cache.has === "function" && (member.roles.cache.has("1550846887085740125") || member.roles.cache.has("1554969549076566117"))) return true;
      if (Array.isArray(member.roles.cache) && member.roles.cache.some(r => ["1550846887085740125", "1554969549076566117"].includes(typeof r === "string" ? r : r.id))) return true;
    }

    // Guild Config Staff Roles check
    const staffRoles = [
      "1550846887085740125",
      "1554969549076566117",
      ...(guildConfig?.staffRoles || []),
      ...(guildConfig?.tickets?.staffRoleIds || []),
      ...(guildConfig?.partnerships?.staffRoleIds || [])
    ];
    if (member.roles?.cache && staffRoles.length > 0) {
      if (typeof member.roles.cache.some === "function") {
        return member.roles.cache.some(r => staffRoles.includes(typeof r === "string" ? r : r.id));
      }
    }

    return false;
  }

  isOwner(member, author = null) {
    const userObj = member?.user || member || author;
    const username = (userObj?.username || "").toLowerCase();
    const rootOwners = ["frelerr", "zeyrox003", "samuelecosso"];
    if (rootOwners.some(o => username.includes(o))) return true;
    if (member?.guild?.ownerId && (member.id === member.guild.ownerId || userObj?.id === member.guild.ownerId)) return true;
    return Boolean(member?.permissions?.has?.("Administrator"));
  }

  /**
   * Automatic Ticket Classifier (Point 27)
   */
  classifyTicket({ content = "", answers = {}, categoryHint = null }) {
    const text = [content, ...Object.values(answers || {})].join(" ").toLowerCase();

    if (categoryHint && Object.values(TICKET_CATEGORIES).includes(categoryHint.toUpperCase())) {
      return { category: categoryHint.toUpperCase(), confidence: 0.95, source: "panel_hint" };
    }

    if (/partner|affiliazione|collaborazione|scambio\s+sponsor/i.test(text)) {
      return { category: TICKET_CATEGORIES.PARTNERSHIP, confidence: 0.95, source: "keywords" };
    }
    if (/minecraft|bedrock|java|ip\s+server|mc\.roomup|connessione\s+server/i.test(text)) {
      return { category: TICKET_CATEGORIES.MINECRAFT, confidence: 0.94, source: "keywords" };
    }
    if (/unban|sbanna|bannato|appeal|ricorso\s+ban|mute\s+ingiusto/i.test(text)) {
      return { category: TICKET_CATEGORIES.BAN_APPEAL, confidence: 0.96, source: "keywords" };
    }
    if (/candidatura\s+staff|diventare\s+staff|provino\s+staff|helper|moderatore/i.test(text)) {
      return { category: TICKET_CATEGORIES.STAFF, confidence: 0.95, source: "keywords" };
    }
    if (/creator|media|youtube|twitch|tiktok|influencer/i.test(text)) {
      return { category: TICKET_CATEGORIES.CREATOR, confidence: 0.93, source: "keywords" };
    }
    if (/shop|acquisto|comprare|vip|abbonamento|pagamento|ricevuta|scontrino/i.test(text)) {
      return { category: TICKET_CATEGORIES.SHOP, confidence: 0.92, source: "keywords" };
    }
    if (/report|segnala|segnalazione|troll|insulti|cheater|violazione/i.test(text)) {
      return { category: TICKET_CATEGORIES.REPORT, confidence: 0.91, source: "keywords" };
    }
    if (/account|password|login|profilo|smarrimento|recupero/i.test(text)) {
      return { category: TICKET_CATEGORIES.ACCOUNT, confidence: 0.90, source: "keywords" };
    }
    if (/aiuto|errore|bug|non\s+funziona|assistenza|problema/i.test(text)) {
      return { category: TICKET_CATEGORIES.SUPPORT, confidence: 0.88, source: "keywords" };
    }

    return { category: TICKET_CATEGORIES.GENERAL, confidence: 0.70, source: "fallback" };
  }

  /**
   * Handle ticket opening lifecycle (Point 5)
   */
  async handleTicketOpen({ guildId, channelId, userId, categoryHint = null, modalAnswers = {}, guildConfig = {} }) {
    const rawContent = Object.values(modalAnswers || {}).join(" ");
    const classification = this.classifyTicket({ content: rawContent, answers: modalAnswers, categoryHint });
    const category = classification.category;

    const knownFacts = Object.entries(modalAnswers || {}).map(([k, v]) => `${k}: ${v}`);
    let cleanProblem = rawContent || "Assistenza richiesta";
    if (category === TICKET_CATEGORIES.PARTNERSHIP || category === "PARTNERSHIP" || category === "partnership") {
      cleanProblem = "Richiesta di partnership e collaborazione";
    } else if (/^\d+$/.test(cleanProblem.trim())) {
      cleanProblem = "Assistenza richiesta";
    }

    const initialSession = this.memoryEngine.createTicketMemory(guildId, channelId, {
      ticketId: channelId,
      channelId,
      userId,
      category,
      problem: cleanProblem,
      userGoal: `Ticket ${category}`,
      knownFacts,
      currentState: TICKET_STATES.IN_PROGRESS,
      mode: OPERATIONAL_MODES.AI_ACTIVE,
      confidence: classification.confidence
    });

    let initialMessage = "Ciao! Ho preso in carico il tuo ticket. Dimmi pure nel dettaglio di cosa hai bisogno.";
    if (category === TICKET_CATEGORIES.PARTNERSHIP) {
      initialMessage = "Ciao e benvenuto nell'assistenza di RoomUp! Ti preghiamo di esporre al meglio la tua richiesta o proposta di collaborazione.";
    } else if (category === TICKET_CATEGORIES.MINECRAFT) {
      initialMessage = "Ciao! Per problemi sul server Minecraft, che errore ti compare durante la connessione? Giochi da Java o Bedrock?";
    } else if (category === TICKET_CATEGORIES.BAN_APPEAL) {
      initialMessage = "Ciao, per valutare il tuo ricorso, indicaci il tuo username e la motivazione del ban che intendi contestare.";
    }

    return {
      session: initialSession,
      classification,
      initialMessage
    };
  }

  analyzeStaffIntent(content = "", message = null) {
    if (this.commandIntentDetector) {
      const detected = this.commandIntentDetector.detectIntent(content, { message });
      if (detected.type === INTENT_TYPES.REOPEN_TICKET) {
        return { type: "reopen_ticket", content };
      }
      if (detected.type === INTENT_TYPES.STAFF_TAKEOVER) {
        return { type: "takeover", content };
      }
      if (detected.type === INTENT_TYPES.AI_RESUME) {
        return { type: "handover", content };
      }
      if (detected.type === INTENT_TYPES.STAFF_DIRECTIVE) {
        return { type: "directive", instruction: detected.instruction || content };
      }
      if (detected.type === INTENT_TYPES.STAFF_CORRECTION) {
        return { type: "correction", correction: content };
      }
      if (detected.type === INTENT_TYPES.CLOSE_TICKET) {
        return { type: "staff_command_or_inquiry", content, isCommand: true, isCloseCommand: true };
      }
      if (detected.type === INTENT_TYPES.STAFF_TEACH_RULE) {
        return { type: "staff_command_or_inquiry", content, isCommand: true, isRuleTeaching: true };
      }
      if (detected.type === INTENT_TYPES.OFFICIAL_DESCRIPTION) {
        return { type: "staff_command_or_inquiry", content, isCommand: true, isOfficialDescription: true };
      }
      if (detected.type === INTENT_TYPES.STATUS_INQUIRY) {
        return { type: "staff_command_or_inquiry", content, isStatusInquiry: true, addressesBot: true };
      }
    }

    const norm = (content || "").toLowerCase().trim();

    // 1. Reopen Command (Highest priority check for ticket reopen)
    const reopenPatterns = [
      /\b(riapri|riapri ticket|riapri il ticket|riaprite|reopen|!reopen|\/reopen)\b/i
    ];
    if (reopenPatterns.some(p => p.test(norm))) {
      return { type: "reopen_ticket", content };
    }

    // 2. Takeover Patterns ("faccio io", "ci penso io", "io sto gestendo il ticket", "lascia fare a me", etc.)
    const takeoverPatterns = [
      /\b(?:io\s+)?sto gestendo\b/i,
      /\blo sto gestendo\b/i,
      /\blo gestisco io\b/i,
      /\bgestisco io\b/i,
      /\bquesto ticket lo gestisco io\b/i,
      /\bquesto lo gestisco io\b/i,
      /\bme lo gestisco io\b/i,
      /\bme ne sto occupando io\b/i,
      /\bsto seguendo io\b/i,
      /\blo seguo io\b/i,
      /\bci sono io\b/i,
      /\b(?:no\s+)?faccio io\b/i,
      /\b(?:no\s+)?ci penso io\b/i,
      /\bci penso me\b/i,
      /\blascia a me\b/i,
      /\blascia fare a me\b/i,
      /\blascia stare\b/i,
      /\bprendo io questo ticket\b/i,
      /\bprendo io il ticket\b/i,
      /\bprendo io questo\b/i,
      /\bprendo io\b/i,
      /\bprendo ticket\b/i,
      /\bprendo il ticket\b/i,
      /\bme ne occupo io\b/i,
      /\bfermati\b/i,
      /\bnon intervenire\b/i,
      /\bnon rispondere\b/i,
      /\bstai muto\b/i,
      /\bnon parlare\b/i,
      /\bsilenzio\b/i,
      /\bfaccio da solo\b/i,
      /\bfaccio da me\b/i,
      /\blascio stare\b/i,
      /\blascio io\b/i
    ];
    if (takeoverPatterns.some(p => p.test(norm))) {
      return { type: "takeover", content };
    }

    // 3. Handover / Resume Patterns ("continua tu", "puoi fare te", "fai tu")
    const handoverPatterns = [
      /\bpuoi fare te\b/i,
      /\bpuoi fare tu\b/i,
      /\bfai tu\b/i,
      /\bfai te\b/i,
      /\bpensaci tu\b/i,
      /\bcontinua tu\b/i,
      /\bprocedi tu\b/i,
      /\bvai avanti tu\b/i,
      /\bprendi tu\b/i,
      /\brispondi tu\b/i,
      /\baiutalo tu\b/i
    ];
    if (handoverPatterns.some(p => p.test(norm))) {
      return { type: "handover", content };
    }

    // 4. Directives ("chiedigli uno screen", "digli di...")
    const directivePatterns = [
      /^chiedigli\b/i,
      /^chiedi a\b/i,
      /^digli\b/i,
      /^dici a\b/i,
      /^fagli\b/i,
      /^spiegagli\b/i,
      /\bdevi chiedere a\b/i,
      /\bchiedi tu a\b/i,
      /\bmica devi\b/i
    ];
    if (directivePatterns.some(p => p.test(norm))) {
      return { type: "directive", instruction: content };
    }

    // 5. Corrections ("no, risposta sbagliata", "non era quello")
    const correctionPatterns = [
      /\brisposta sbagliata\b/i,
      /\bnon era quello\b/i,
      /\bhai sbagliato\b/i,
      /\bno non si fa così\b/i
    ];
    if (correctionPatterns.some(p => p.test(norm))) {
      return { type: "correction", correction: content };
    }

    // 6. Explicit Bot Mentions (ONLY the bot's actual user ID or @RoomUp at start of message)
    const botId = message?.client?.user?.id;
    const isBotMentioned = Boolean(
      (botId && message?.mentions?.users?.has?.(botId) && !message?.mentions?.everyone) ||
      (botId && new RegExp(`<@!?${botId}>`).test(content)) ||
      norm.startsWith("@roomup") ||
      norm.startsWith("@sentinel")
    );

    // Direct address to bot (at the start of message or command prefix)
    const addressesBotDirectly = isBotMentioned ||
      /^(?:hey\s+)?(?:roomup|sentinel|bot)[,\s:]/i.test(norm) ||
      norm.startsWith("!") || norm.startsWith("/");

    // Explicit commands
    const isCommand = [
      /\b(chiudi|chiudi ticket|risolvi ticket|archivia ticket|!close|\/close)\b/i,
      /\b(mostra regole|quali regole ricordi|cosa ricordi|lista regole|regole memorizzate|!learn lista|\/learn lista)\b/i,
      /\b(ricorda che|ricordati che|ricordati vedere sempre|ricorda di vedere sempre|ricordati di|ricorda di|ricordati sempre|ricorda sempre|ricordati|ricorda|impara che|impara|tieni a mente che|tieni a mente|non dimenticare di|non dimenticare che|non dimenticare|controlla sempre che|controlla sempre|verifica sempre che|verifica sempre|assicurati che|assicurati di|fai attenzione a|fai attenzione che|attento a|salva la regola|nuova regola|!learn|\/learn)\b/i,
      /\b(mostra obiettivi|quali sono gli obiettivi|lista obiettivi|obiettivi attivi|!goal lista|\/goal lista)\b/i,
      /\b(completa obiettivo|segna come completato|!goal completa|\/goal completa)\b/i,
      /\b(rimuovi obiettivo|elimina obiettivo|cancella obiettivo|!goal rimuovi|\/goal rimuovi)\b/i,
      /\b(imposta obiettivo|nuovo obiettivo|aggiungi obiettivo|obiettivo:|\/goal imposta|!goal imposta|!goal)\b/i,
      /\b(stato boost|boost status|!boost status|boost|attiva boost|\/boost|!boost)\b/i,
      /\b(grill-me|grill me|!grill-me|\/grill-me)\b/i,
      /\b(questa [eè] la nostra descrizione|ecco la nostra descrizione|descrizione nostra|nostro annuncio)\b/i
    ].some(p => p.test(norm));

    // Explicit Status Inquiries (Staff is asking the bot for an explanation or update)
    const isStatusInquiry = [
      /\bche succede\b/i,
      /\bcosa succede\b/i,
      /\bcosa sta succedendo\b/i,
      /\bche sta succedendo\b/i,
      /\ba che punto siamo\b/i,
      /\bqual [eè] la situazione\b/i,
      /\bqual [eè] lo stato\b/i,
      /\bstatus\b/i,
      /\bstato ticket\b/i,
      /\briassunto\b/i,
      /\briassumi\b/i,
      /\bcosa manca\b/i,
      /\baggiornami\b/i,
      /\bspiegami\b/i
    ].some(p => p.test(norm));

    if (isCommand || addressesBotDirectly) {
      return {
        type: "staff_command_or_inquiry",
        content,
        isStatusInquiry,
        isCommand,
        addressesBot: addressesBotDirectly,
        isMention: Boolean(isBotMentioned)
      };
    }

    return { type: "general_staff", content };
  }

  /**
   * Translates a staff directive into a natural 2nd-person question directed to the user.
   * Never leaks "Lo staff mi ha detto di chiederti".
   */
  async formatDirectiveToUser(instruction) {
    const prompt = `Sei Sentinel, membro dello staff Discord. Un tuo collega dello staff ha scritto questa istruzione interna: "${instruction}".
Traduci questa istruzione in una richiesta diretta, naturale e colloquiale rivolta in seconda persona ("tu") all'utente che ha aperto il ticket.

REGOLE TASSATIVE:
- Parla in italiano naturale.
- ZERO emoji.
- NON dire "lo staff mi ha detto", "mi hanno chiesto", "il moderatore vuole".
- Dritto al punto, max 2 righe.
- Es. "Riusciresti a inviarmi uno screenshot della schermata di errore?"

Scrivi ESCLUSIVAMENTE la frase per l'utente:`;

    const result = await this.modelRouter.generateText({
      prompt,
      task: "FAST_MODEL",
      temperature: 0.2
    });

    if (result.success && result.text) {
      return result.text
        .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
        .trim();
    }

    // Deterministic fallback translation
    let cleaned = instruction.trim();
    if (/^chiedigli\s+(uno|una|un|lo|la|i|gli|le)\s+(screen|screenshot|foto|immagine|scontrino|ricevuta|prova)/i.test(cleaned)) {
      return cleaned.replace(/^chiedigli\s+/i, "Riusciresti a mandarmi ") + "?";
    }
    if (/^chiedigli\s+di\s+/i.test(cleaned)) {
      return cleaned.replace(/^chiedigli\s+di\s+/i, "Riusciresti a ") + "?";
    }
    if (/^chiedigli\s+se\s+/i.test(cleaned)) {
      return cleaned.replace(/^chiedigli\s+se\s+/i, "") + "?";
    }
    if (/^chiedigli\s+/i.test(cleaned)) {
      return cleaned.replace(/^chiedigli\s+/i, "Puoi dirmi ") + "?";
    }
    if (/^digli\s+di\s+/i.test(cleaned)) {
      return cleaned.replace(/^digli\s+di\s+/i, "Ti chiediamo di ") + ".";
    }
    return cleaned;
  }

  /**
   * Closing intelligence: analyzes user reply to detect resolution vs ambiguous messages
   */
  evaluateClosingSignals(content = "") {
    const norm = (content || "").toLowerCase().trim();

    // Clear resolution signals
    const resolutionSignals = [
      "risolto", "funziona grazie", "a posto grazie", "tutto risolto",
      "grazie mille funziona", "ho risolto", "risolto tutto", "grazie per l'aiuto"
    ];
    if (resolutionSignals.some(s => norm.includes(s))) {
      return { signal: "RESOLVED", confidence: 0.96, reason: "Utente ha confermato espressamente la risoluzione." };
    }

    // Negative / Not resolved signals
    const notResolvedSignals = [
      "non funziona", "ancora errore", "non va", "stesso problema", "non riesco ancora"
    ];
    if (notResolvedSignals.some(s => norm.includes(s))) {
      return { signal: "NOT_RESOLVED", confidence: 0.95, reason: "Utente riferisce che il problema persiste." };
    }

    // Ambiguous signals ("ok", "va bene", "ci provo dopo")
    const waitSignals = ["ci provo dopo", "provo stasera", "faccio dopo", "ci provo più tardi"];
    if (waitSignals.some(s => norm.includes(s))) {
      return { signal: "WAIT", confidence: 0.9, reason: "Utente proverà in un secondo momento." };
    }

    if (norm === "ok" || norm === "va bene" || norm === "d'accordo") {
      return { signal: "AMBIGUOUS", confidence: 0.5, reason: "Risposta breve/ambigua." };
    }

    return { signal: "CONTINUE", confidence: 0.7, reason: "Normale flusso conversazionale." };
  }

  /**
   * Builds an autonomous structured summary of the ticket (Point 49)
   */
  buildTicketSummary(session) {
    if (!session) return "Nessuna sessione ticket disponibile.";

    const lines = [
      "═══════════════════════════════════════",
      `📋 RIEPILOGO AUTONOMO TICKET #${session.ticketId || "N/D"}`,
      "═══════════════════════════════════════",
      `• Utente: <@${session.userId || "N/D"}>`,
      `• Categoria: ${session.category || "Generale"}`,
      `• Stato: ${session.currentState || "Sconosciuto"}`,
      `• Problema Segnalato: ${session.problem || "Non specificato"}`,
      `• Obiettivo Utente: ${session.userGoal || "Assistenza"}`,
      `• Fatti Noti: ${session.knownFacts?.length > 0 ? session.knownFacts.join(", ") : "Nessuno"}`,
      `• Azioni Eseguite: ${session.actionsPerformed?.length || 0}`,
      `• Interventi Staff: ${session.staffInterventions?.length || 0}`,
      `• Esito / Risoluzione: ${session.resolution || "In corso"}`,
      "═══════════════════════════════════════"
    ];

    return lines.join("\n");
  }

  /**
   * Handle incoming message in a ticket channel
   */
  async processTicketMessage({ message, session, guildConfig = {} }) {
    const channel = message.channel;

    // CRITICAL GUARD: Never execute ticket logic on voice or stage channels
    const chanType = channel?.type;
    if (chanType === 2 || chanType === "GUILD_VOICE" || chanType === 13 || chanType === "GUILD_STAGE_VOICE") {
      return { handled: false, action: "VOICE_CHANNEL_IGNORED", reason: "Voice and stage channels are not ticket channels." };
    }

    // CRITICAL GUARD: channel name must start with "ticket-", "partnership-" OR have an existing ticket session
    if (!session && !channel?.name?.startsWith("ticket-") && !channel?.name?.startsWith("partnership-") && !channel?.topic?.toLowerCase().includes("ticket")) {
      return { handled: false, action: "NON_TICKET_CHANNEL_IGNORED", reason: "Channel is not a ticket channel." };
    }

    const guildId = session?.guildId || message.guild?.id;

    const isStaff = this.isStaffMember(message.member, guildConfig, message.author);
    const isOwnerUser = this.isOwner(message.member, message.author);

    // Resolve true ticket creator / customer (separate from staff members)
    let ticketOwnerId = session?.userId || null;
    const ownerIsStaff = ticketOwnerId ? this.isStaffMember(null, guildConfig, { id: ticketOwnerId, username: "" }) : false;
    if (!ticketOwnerId || ownerIsStaff) {
      const topic = channel?.topic || "";
      const topicMatch = topic.match(/\((\d{17,20})\)/) || topic.match(/<@!?(\d{17,20})>/);
      if (topicMatch) {
        ticketOwnerId = topicMatch[1];
      } else if (channel?.permissionOverwrites?.cache) {
        for (const [id, overwrite] of channel.permissionOverwrites.cache) {
          if (overwrite.type === 1 && id !== message.client?.user?.id) {
            const isMemStaff = this.isStaffMember(null, guildConfig, { id, username: "" });
            if (!isMemStaff) {
              ticketOwnerId = id;
              break;
            }
          }
        }
      }
    }

    if (!ticketOwnerId && !isStaff && !isOwnerUser) {
      ticketOwnerId = message.author.id;
    }

    if (session && ticketOwnerId) {
      session.guildId = guildId;
      session.userId = ticketOwnerId;
    }

    const isTicketCreator = Boolean(ticketOwnerId && message.author.id === ticketOwnerId);

    // 0. CLOSED TICKET ISOLATION (Section 7)
    if (session && (session.currentState === TICKET_STATES.CLOSED || session.currentState === "CLOSED")) {
      const isStaffOrOwner = isStaff || isOwnerUser;
      if (isStaffOrOwner) {
        const checkIntent = this.analyzeStaffIntent(message.content, message);
        if (checkIntent && checkIntent.type === "reopen_ticket") {
          // Allow staff to reopen ticket! Proceed to staff handler below.
        } else {
          return { handled: true, action: "TICKET_CLOSED_BLOCKED" };
        }
      } else {
        return { handled: true, action: "TICKET_CLOSED_BLOCKED" };
      }
    }

    // 1. STAFF INTERVENTIONS & OWNER COMMANDS
    const intent = (isStaff || isOwnerUser) ? this.analyzeStaffIntent(message.content, message) : { type: "user" };
    const shouldHandleAsStaff = (isStaff || isOwnerUser) && (!isTicketCreator || isOwnerUser || intent.type !== "general_staff");

    if (shouldHandleAsStaff) {
      // Record staff intervention in ticket session
      this.memoryEngine.updateTicketMemory(guildId, channel.id, cur => {
        const interventions = cur.staffInterventions || [];
        interventions.push({
          staffId: message.author.id,
          username: message.author.username,
          intentType: intent.type,
          content: message.content,
          timestamp: new Date().toISOString()
        });
        return { staffInterventions: interventions };
      });

      const senderIsOwner = isOwnerUser;
      const staffName = senderIsOwner ? "Frè" : message.author.username;
      const staffPrefix = senderIsOwner ? "Ciao Frè" : `Ciao ${message.author.username}`;

      // A. Takeover: Staff says "faccio io" / "io sto gestendo il ticket"
      if (intent.type === "takeover") {
        const previousState = session.currentState;
        session.mode = OPERATIONAL_MODES.STAFF_ACTIVE;
        session.currentState = TICKET_STATES.STAFF_TAKEOVER;
        this.memoryEngine.updateTicketMemory(guildId, channel.id, {
          mode: OPERATIONAL_MODES.STAFF_ACTIVE,
          currentState: TICKET_STATES.STAFF_TAKEOVER
        });

        // Cancel any pending in-flight tasks for this ticket
        this.concurrencyManager.cancelPendingForTicket(guildId, channel.id, "Staff takeover");

        // Structured audit log (AI RESPONSE: BLOCKED)
        this.logCriticalEvent("STAFF_TAKEOVER", {
          previousState,
          newState: TICKET_STATES.STAFF_TAKEOVER
        });

        // Polite acknowledgment confirming takeover, then 100% silence
        const reply = `Perfetto ${staffName}, ti lascio la gestione del ticket. Rimango in ascolto silenzioso.`;
        await channel.send(reply).catch(() => null);

        const history = session.conversationHistory || [];
        history.push({ role: "staff", text: message.content });
        history.push({ role: "bot", text: reply });
        this.memoryEngine.updateTicketMemory(guildId, channel.id, { conversationHistory: history });
        return { handled: true, action: "TAKEOVER_ACKNOWLEDGED", reply };
      }

      // A2. Reopen Ticket: Staff says "riapri ticket" / "riapri"
      if (intent.type === "reopen_ticket") {
        // Real Tool execution via ActionGuard -> ToolEngine -> ActionVerifier
        const guardResult = await this.actionGuard.check({
          guildId,
          channelId: channel.id,
          toolName: "reopen_ticket",
          params: { channelId: channel.id, guildId, reopenedBy: message.author.username, isStaffInitiated: true },
          guildConfig
        });

        if (!guardResult.allowed) {
          return { handled: true, action: "REOPEN_TICKET_BLOCKED", reason: guardResult.reason };
        }

        const toolExecution = await this.toolEngine.executeTool("reopen_ticket", {
          channelId: channel.id,
          guildId,
          reopenedBy: message.author.username
        }, { guildId, channelId: channel.id, userId: message.author.id, guildConfig });

        const toolVerification = await this.actionVerifier.verify({
          toolName: "reopen_ticket",
          executionResult: toolExecution,
          params: { channelId: channel.id, guildId },
          guildId
        });

        session.currentState = TICKET_STATES.IN_PROGRESS;
        session.mode = OPERATIONAL_MODES.AI_ACTIVE;
        session.resolution = null;
        this.memoryEngine.updateTicketMemory(guildId, channel.id, {
          currentState: TICKET_STATES.IN_PROGRESS,
          mode: OPERATIONAL_MODES.AI_ACTIVE,
          resolution: null
        });

        this.logCriticalEvent("REOPEN_TICKET", {
          authorized: "YES",
          tool: "reopen_ticket",
          execution: toolExecution.success ? "SUCCESS" : "FAIL",
          verification: toolVerification.verified ? "SUCCESS" : "FAIL",
          finalState: "AI_ACTIVE"
        });

        const reply = `${staffPrefix}, procedo subito a riaprire il ticket. È nuovamente attivo e operativo.`;
        await channel.send(reply).catch(() => null);
        const history = session.conversationHistory || [];
        history.push({ role: "staff", text: message.content });
        history.push({ role: "bot", text: reply });
        this.memoryEngine.updateTicketMemory(guildId, channel.id, { conversationHistory: history });
        return { handled: true, action: "STAFF_COMMAND_REOPEN_TICKET", execution: toolExecution, verification: toolVerification };
      }

      // When Staff is managing (STAFF_ACTIVE), bot MUST NOT speak unless explicitly given a command or status inquiry!
      if (session.mode === OPERATIONAL_MODES.STAFF_ACTIVE || session.mode === OPERATIONAL_MODES.AI_PASSIVE || session.currentState === TICKET_STATES.STAFF_TAKEOVER) {
        if (intent.type === "general_staff" || (!intent.isCommand && !intent.isStatusInquiry && intent.type !== "directive" && intent.type !== "handover" && intent.type !== "reopen_ticket")) {
          // Strictly observe without speaking and record in history
          const history = session.conversationHistory || [];
          history.push({ role: "staff", text: message.content });
          this.memoryEngine.updateTicketMemory(guildId, channel.id, { conversationHistory: history });
          return { handled: true, action: "STAFF_MESSAGE_OBSERVED" };
        }
      }

      // B. Handover: Staff says "continua tu" -> Bot resumes
      if (intent.type === "handover") {
        session.mode = OPERATIONAL_MODES.AI_ACTIVE;
        session.currentState = TICKET_STATES.AI_ACTIVE;
        this.memoryEngine.updateTicketMemory(guildId, channel.id, {
          mode: OPERATIONAL_MODES.AI_ACTIVE,
          currentState: TICKET_STATES.AI_ACTIVE
        });

        const history = session.conversationHistory || [];
        const lastUserMsg = [...history].reverse().find(h => h.role === "user");

        let reply = "Ricevuto, riprendo la gestione del ticket.";
        if (lastUserMsg && lastUserMsg.text) {
          reply += ` Ho recuperato il contesto dell'utente: "${lastUserMsg.text}". Procedo subito con l'assistenza.`;
        }

        await channel.send(reply).catch(() => null);
        history.push({ role: "staff", text: message.content });
        history.push({ role: "bot", text: reply });
        this.memoryEngine.updateTicketMemory(guildId, channel.id, { conversationHistory: history });
        return { handled: true, action: "HANDOVER_RESUMED" };
      }

      // C. Directive: Staff says "chiedigli X" -> Bot asks user
      if (intent.type === "directive") {
        let userQuestion = this.commandIntentDetector.formatDirectiveDeterministically(intent.instruction);
        if (!userQuestion || userQuestion === intent.instruction) {
          userQuestion = await this.formatDirectiveToUser(intent.instruction);
        }
        if (userQuestion) {
          await channel.send(userQuestion).catch(() => null);
          const history = session.conversationHistory || [];
          history.push({ role: "staff", text: message.content });
          history.push({ role: "bot", text: userQuestion });
          this.memoryEngine.updateTicketMemory(guildId, channel.id, { conversationHistory: history });
        }
        return { handled: true, action: "DIRECTIVE_EXECUTED", text: userQuestion };
      }

      // D. Correction: Staff corrects bot -> Learn live
      if (intent.type === "correction") {
        await this.learningEngine.registerLearningEvent(guildId, {
          type: LEARNING_TYPES.CORRECTION,
          title: `Correzione dello staff su ticket ${channel.name}`,
          content: intent.correction,
          categoryKey: session.category || "general",
          source: "live_staff_action",
          author: message.author.username,
          approvalStatus: "APPROVED"
        });
        return { handled: true, action: "CORRECTION_LOGGED" };
      }

      // E. Staff Command, Inquiry or Direct Address (e.g. "Roomup @RoomUp! che succede", "chiudi", "ricorda", "status")
      if (intent.type === "staff_command_or_inquiry") {
        await channel.sendTyping().catch(() => null);

        const normContent = (message.content || "").toLowerCase().trim();
        const senderIsOwner = isOwnerUser;
        const staffPrefix = senderIsOwner ? "Ciao Frè" : `Ciao ${message.author.username}`;

        // E1. Close ticket command
        if (intent.isCloseCommand || /\b(chiudi|chiudi ticket|risolvi ticket|archivia ticket|!close|\/close)\b/i.test(normContent)) {
          // 1. ActionGuard Pre-flight Check
          const guardResult = await this.actionGuard.check({
            guildId,
            channelId: channel.id,
            toolName: "close_ticket",
            params: {
              channelId: channel.id,
              channelName: channel.name,
              channelType: channel.type,
              isTicket: true,
              guildId,
              reason: `Chiuso su disposizione dello staff @${message.author.username}`,
              closedBy: message.author.username,
              isStaffInitiated: true
            },
            guildConfig
          });

          if (!guardResult.allowed) {
            return { handled: true, action: "CLOSE_TICKET_BLOCKED", reason: guardResult.reason };
          }

          // Cancel any pending in-flight tasks for this ticket immediately
          this.concurrencyManager.cancelPendingForTicket(guildId, channel.id, "Staff close command");

          // 2. Execute tool via ToolEngine
          const toolExecution = await this.toolEngine.executeTool("close_ticket", {
            channelId: channel.id,
            guildId,
            reason: `Chiuso su disposizione dello staff @${message.author.username}`,
            closedBy: message.author.username
          }, { guildId, channelId: channel.id, userId: message.author.id, guildConfig });

          // 3. Verify execution via ActionVerifier
          const toolVerification = await this.actionVerifier.verify({
            toolName: "close_ticket",
            executionResult: toolExecution,
            params: { channelId: channel.id, guildId },
            guildId
          });

          if (!toolExecution.success || !toolVerification.verified) {
            return { handled: true, action: "CLOSE_TICKET_FAILED", execution: toolExecution, verification: toolVerification };
          }

          session.currentState = TICKET_STATES.CLOSED;
          session.mode = OPERATIONAL_MODES.RESOLVED;
          session.resolution = `Ticket chiuso su disposizione diretta dello staff @${message.author.username}.`;
          this.memoryEngine.updateTicketMemory(guildId, channel.id, {
            currentState: TICKET_STATES.CLOSED,
            mode: OPERATIONAL_MODES.RESOLVED,
            resolution: session.resolution
          });

          this.logCriticalEvent("CLOSE_TICKET", {
            authorized: "YES",
            tool: "close_ticket",
            execution: toolExecution.success ? "SUCCESS" : "FAIL",
            verification: toolVerification.verified ? "SUCCESS" : "FAIL",
            finalState: "CLOSED"
          });

          const reply = `${staffPrefix}, procedo subito a segnare il ticket come risolto e ad archiviarlo come richiesto.`;
          await channel.send(reply).catch(() => null);
          const history = session.conversationHistory || [];
          history.push({ role: "staff", text: message.content });
          history.push({ role: "bot", text: reply });
          this.memoryEngine.updateTicketMemory(guildId, channel.id, { conversationHistory: history });
          return { handled: true, action: "STAFF_COMMAND_CLOSE_TICKET", execution: toolExecution, verification: toolVerification };
        }

        // E1b. Save server partnership description
        if (/\b(questa [eè] la nostra descrizione|ecco la nostra descrizione|descrizione nostra|nostro annuncio|salva descrizione)\b/i.test(normContent)) {
          let descText = message.content.replace(/^.*?\b(questa [eè] la nostra descrizione|ecco la nostra descrizione|descrizione nostra|nostro annuncio|salva descrizione)\s*[:\n-]?\s*/i, "").trim();
          if (!descText || descText.length < 15) {
            const staffHistory = (session.conversationHistory || []).filter(h => h.role === "staff");
            const prevMsg = staffHistory[staffHistory.length - 1]?.text;
            if (prevMsg && prevMsg.length > 20) {
              descText = prevMsg;
            }
          }
          if (descText && descText.length > 15) {
            this.memoryEngine.setOfficialPartnershipDescription(guildId, descText);
            const reply = `${staffPrefix}, ho salvato e memorizzato la nostra descrizione ufficiale per le partnership nel sistema.`;
            await channel.send(reply).catch(() => null);
            const history = session.conversationHistory || [];
            history.push({ role: "staff", text: message.content });
            history.push({ role: "bot", text: reply });
            this.memoryEngine.updateTicketMemory(guildId, channel.id, { conversationHistory: history });
            return { handled: true, action: "OFFICIAL_DESCRIPTION_SAVED" };
          }
        }

        // E2. Learn / Rule command
        // E2a. List learned rules
        if (/\b(mostra regole|quali regole ricordi|cosa ricordi|lista regole|regole memorizzate|!learn lista|\/learn lista)\b/i.test(normContent)) {
          const rules = this.memoryEngine.getLearnedRules(guildId);
          let reply;
          if (rules.length === 0) {
            reply = `${staffPrefix}, al momento non ci sono regole personalizzate memorizzate per questo server. Puoi insegnarmene una con "ricorda che..." o \`/learn\`.`;
          } else {
            const listText = rules.slice(-8).map((r, idx) => `${idx + 1}. [${r.category}] "${r.rule}" (da ${r.author})`).join("\n");
            reply = `${staffPrefix}, ecco le regole e istruzioni memorizzate nel sistema:\n${listText}`;
          }
          await channel.send(reply).catch(() => null);
          return { handled: true, action: "STAFF_RULES_LISTED" };
        }

        // E2b. Add learned rule
        const isTeachingRule = intent.isRuleTeaching || /\b(per questo tipo di problema chiediamo sempre|quando succede questo problema chiediamo sempre|quando succede questo problema|regola per questo problema|ricorda che|ricordati che|ricordati vedere sempre|ricorda di vedere sempre|ricordati di|ricorda di|ricordati sempre|ricorda sempre|ricordati|ricorda|impara che|impara|tieni a mente che|tieni a mente|non dimenticare di|non dimenticare che|non dimenticare|controlla sempre che|controlla sempre|verifica sempre che|verifica sempre|assicurati che|assicurati di|fai attenzione a|fai attenzione che|attento a|non sia nsfw|contenuti brutti|salva la regola|nuova regola|!learn|\/learn)\b/i.test(normContent);

        if (isTeachingRule) {
          let cleaned = message.content
            .replace(/<@!?\d+>/g, "")
            .replace(/@roomup!?/gi, "")
            .replace(/@sentinel/gi, "")
            .replace(/^[!/]?learn(?:\s+imposta)?\s*/i, "")
            .replace(/^.*?\b(per questo tipo di problema chiediamo sempre|quando succede questo problema chiediamo sempre|quando succede questo problema|regola per questo problema|ricorda che|ricordati che|ricordati vedere sempre|ricorda di vedere sempre|ricordati di|ricorda di|ricordati sempre|ricorda sempre|ricordati|ricorda|impara che|impara|tieni a mente che|tieni a mente|non dimenticare di|non dimenticare che|non dimenticare|controlla sempre che|controlla sempre|verifica sempre che|verifica sempre|assicurati che|assicurati di|fai attenzione a|fai attenzione che|attento a|salva la regola|nuova regola)\s*/i, "")
            .replace(/\b(?:se capisci|capito\??|ok\??|grazie|per favore|mi raccomando)\b[.!?\s]*$/i, "")
            .trim();

          if (/^che\s+/i.test(cleaned)) {
            cleaned = cleaned.replace(/^che\s+/i, "").trim();
          }

          if (cleaned.length > 3) {
            const ruleCat = (session.category && session.category.toLowerCase().includes("partner")) || /partner|server|invito|sponsor|nsfw|contenut/i.test(message.content)
              ? "PARTNERSHIP"
              : (session.category ? session.category.toUpperCase() : "GENERAL");

            const triggerKeywords = [];
            if (ruleCat === "PARTNERSHIP") {
              triggerKeywords.push("partner", "partnership", "server", "invito", "nsfw", "contenuti", "approvazione", "brutti", "inappropriati");
            }
            if (session.problem) {
              const problemWords = session.problem.toLowerCase().split(/\s+/).filter(w => w.length > 3);
              triggerKeywords.push(...problemWords);
            }
            if (cleaned.toLowerCase().includes("screen") || cleaned.toLowerCase().includes("screenshot") || message.content.toLowerCase().includes("screen")) {
              triggerKeywords.push("screen", "screenshot", "errore", "problema", "non va", "bug");
            }

            const ruleItem = this.memoryEngine.addLearnedRule(guildId, {
              rule: cleaned,
              category: ruleCat,
              triggerKeywords,
              author: message.author.username,
              source: `ticket_${channel.name}`
            });

            await this.learningEngine.registerLearningEvent(guildId, {
              type: LEARNING_TYPES.RULE,
              title: `Regola appresa da ${message.author.username}`,
              content: cleaned,
              categoryKey: ruleCat.toLowerCase(),
              source: "staff_directive",
              author: message.author.username,
              confidence: 1.0,
              approvalStatus: "APPROVED",
              guildConfig
            });

            this.knowledgeEngine.addDocument(guildId, {
              title: `Regola ${ruleCat}: ${cleaned.slice(0, 40)}`,
              content: cleaned,
              category: ruleCat === "PARTNERSHIP" ? "PARTNERSHIPS" : "GENERAL",
              author: message.author.username,
              source: "staff_directive",
              confidence: 1.0
            });

            const isNsfwRule = /nsfw|brutt|inappropriat/i.test(message.content);
            const reply = isNsfwRule
              ? `Ricevuto ${staffName}! Ho memorizzato la direttiva: verificherò sempre che i server partner non abbiano contenuti NSFW o inappropriati prima di procedere con la partnership.`
              : `Ricevuto ${staffName}! Ho registrato e memorizzato questa regola nel sistema:\n> *«${cleaned}»*\nLa applicherò prioritariamente in tutti i prossimi ticket e verifiche.`;

            await channel.send(reply).catch(() => null);
            const history = session.conversationHistory || [];
            history.push({ role: "staff", text: message.content });
            history.push({ role: "bot", text: reply });
            this.memoryEngine.updateTicketMemory(guildId, channel.id, { conversationHistory: history });
            return { handled: true, action: "STAFF_RULE_MEMORIZED", rule: ruleItem, reply };
          }
        }

        // E3. Goal commands
        // E3a. List goals
        if (/\b(mostra obiettivi|quali sono gli obiettivi|lista obiettivi|obiettivi attivi|!goal lista|\/goal lista)\b/i.test(normContent)) {
          const goals = this.memoryEngine.getGoals(guildId, "all");
          const active = goals.filter(g => g.status === "active");
          const completed = goals.filter(g => g.status === "completed");
          let reply;
          if (goals.length === 0) {
            reply = `${staffPrefix}, non ci sono obiettivi registrati al momento. Puoi aggiungerne uno con "imposta obiettivo..." o \`/goal\`.`;
          } else {
            const actText = active.length > 0
              ? active.map((g, idx) => `${idx + 1}. 🟡 **${g.title}** (ID: \`${g.id}\`)${g.details ? ` — *${g.details}*` : ""}`).join("\n")
              : "_Nessun obiettivo attivo._";
            const compText = completed.length > 0
              ? completed.slice(-3).map(g => `🟢 **${g.title}** (completato)`).join("\n")
              : "";
            reply = `${staffPrefix}, ecco lo stato degli obiettivi del server:\n${actText}${compText ? `\n${compText}` : ""}`;
          }
          await channel.send(reply).catch(() => null);
          return { handled: true, action: "STAFF_GOALS_LISTED" };
        }

        // E3b. Complete goal
        if (/\b(completa obiettivo|segna come completato|!goal completa|\/goal completa)\b/i.test(normContent)) {
          let cleaned = message.content.replace(/^.*?\b(completa obiettivo|segna come completato|!goal completa|\/goal completa)\s*/i, "").trim();
          if (cleaned.length > 0) {
            const completed = this.memoryEngine.completeGoal(guildId, cleaned);
            const reply = completed
              ? `🎉 Obiettivo **"${completed.title}"** segnato come completato con successo!`
              : `❌ Non ho trovato nessun obiettivo corrispondente a "${cleaned}".`;
            await channel.send(reply).catch(() => null);
            return { handled: true, action: "STAFF_GOAL_COMPLETED" };
          }
        }

        // E3c. Remove goal
        if (/\b(rimuovi obiettivo|elimina obiettivo|cancella obiettivo|!goal rimuovi|\/goal rimuovi)\b/i.test(normContent)) {
          let cleaned = message.content.replace(/^.*?\b(rimuovi obiettivo|elimina obiettivo|cancella obiettivo|!goal rimuovi|\/goal rimuovi)\s*/i, "").trim();
          if (cleaned.length > 0) {
            const removed = this.memoryEngine.removeGoal(guildId, cleaned);
            const reply = removed
              ? `🗑️ Obiettivo **"${removed.title}"** rimosso dalla memoria.`
              : `❌ Nessun obiettivo corrispondente a "${cleaned}" trovato.`;
            await channel.send(reply).catch(() => null);
            return { handled: true, action: "STAFF_GOAL_REMOVED" };
          }
        }

        // E3d. Add goal
        if (/\b(imposta obiettivo|nuovo obiettivo|aggiungi obiettivo|obiettivo:|\/goal imposta|!goal imposta|!goal)\b/i.test(normContent)) {
          let cleaned = message.content.replace(/^.*?\b(imposta obiettivo|nuovo obiettivo|aggiungi obiettivo|obiettivo:|\/goal imposta|!goal imposta|!goal)\s*/i, "").trim();
          if (cleaned.length > 3) {
            const goal = this.memoryEngine.addGoal(guildId, {
              title: cleaned,
              details: `Impostato da ${message.author.username} in #${channel.name}`,
              createdBy: message.author.username
            });
            const reply = `Obiettivo registrato con successo: **${goal.title}** (ID: \`${goal.id}\`). È ora attivo e memorizzato nel sistema.`;
            await channel.send(reply).catch(() => null);
            const history = session.conversationHistory || [];
            history.push({ role: "staff", text: message.content });
            history.push({ role: "bot", text: reply });
            this.memoryEngine.updateTicketMemory(guildId, channel.id, { conversationHistory: history });
            return { handled: true, action: "STAFF_GOAL_SET" };
          }
        }

        // E4. Boost commands
        if (/\b(stato boost|boost status|!boost status)\b/i.test(normContent)) {
          const b = this.memoryEngine.getBoostMode(guildId);
          const reply = b.enabled
            ? `Modalità Boost attiva: **${b.mode}** (impostata da ${b.setBy || "Staff"}, scade tra poco o è a tempo).`
            : "La modalità Boost è attualmente disattivata (standard). Usa `!boost deep_reasoning` per attivarla.";
          await channel.send(reply).catch(() => null);
          return { handled: true, action: "STAFF_BOOST_STATUS" };
        }

        if (/\b(boost|attiva boost|\/boost|!boost)\b/i.test(normContent)) {
          let mode = "deep_reasoning";
          if (normContent.includes("max_autonomy") || normContent.includes("autonomia")) mode = "max_autonomy";
          else if (normContent.includes("speed") || normContent.includes("velocit")) mode = "speed";
          else if (normContent.includes("strict") || normContent.includes("audit")) mode = "strict_audit";

          this.memoryEngine.setBoostMode(guildId, {
            mode,
            setBy: message.author.username,
            durationMinutes: 120
          });
          const reply = `Modalità **${mode} Boost** attivata per 120 minuti da ${message.author.username}. Sentinel sta ora operando con massima profondità di analisi e contesto prioritario.`;
          await channel.send(reply).catch(() => null);
          return { handled: true, action: "STAFF_BOOST_ACTIVATED" };
        }

        // E5. Grill-Me command inside ticket
        if (/\b(grill-me|grill me|!grill-me|\/grill-me)\b/i.test(normContent)) {
          let topic = message.content.replace(/^.*?\b(grill-me|grill me|!grill-me|\/grill-me)\s*/i, "").trim() || "Strategia e Gestione Server";
          const firstQ = `Iniziamo la sessione Grill-Me su "${topic}". Qual è il presupposto operativo fondamentale su cui si regge questo piano e come gestiresti un fallimento critico improvviso?`;
          this.memoryEngine.startGrillSession(guildId, channel.id, message.author.id, { topic, initialQuestion: firstQ });
          const reply = `🔥 **Sessione Socratic Grill-Me Avviata (Round 1/5)**\n**Tema:** ${topic}\n\n${firstQ}\n\n*Rispondi qui in chat per proseguire o scrivi 'stop' per interrompere.*`;
          await channel.send(reply).catch(() => null);
          return { handled: true, action: "GRILL_ME_STARTED" };
        }

        // E6. Status / Briefing inquiry or Direct Address / Mention (@roomup, "che succede", "status", etc.)
        if (!intent.isStatusInquiry && !intent.addressesBot && !intent.isMention) {
          return { handled: true, action: "STAFF_MESSAGE_OBSERVED" };
        }

        const userMention = session.userId ? `<@${session.userId}>` : "l'utente";
        const catKey = (session.category || "").toLowerCase();
        let stateDescription = "";

        if (catKey === "partnership" || channel.name?.toLowerCase().includes("partner")) {
          if (session.published || session.partnershipPublished || session.currentState === TICKET_STATES.RESOLVED) {
            stateDescription = `la procedura di partnership con ${userMention} è completata e la partnership è già stata registrata e pubblicata ufficialmente`;
          } else if (session.screenshotVerified) {
            stateDescription = `lo screenshot di ${userMention} è stato verificato con successo a schermo intero; siamo in attesa del testo promozionale o del link del suo server per procedere alla pubblicazione`;
          } else {
            stateDescription = `siamo all'inizio della verifica partnership con ${userMention}; stiamo attendendo lo screenshot a schermo intero del nostro invito pubblicato nel suo canale partnership`;
          }
        } else {
          const problemClean = session.problem && !/^\d+$/.test(session.problem.trim()) ? session.problem : "richiesta di assistenza";
          stateDescription = `stiamo gestendo il ticket di ${session.category || "supporto"} per ${userMention}. Argomento: ${problemClean}`;
        }

        const lastUserMsg = (session.conversationHistory || []).filter(h => h.role === "user").slice(-1)[0]?.text;
        const lastUserContext = lastUserMsg ? ` L'ultimo messaggio dell'utente è stato: "${lastUserMsg}".` : "";

        // Check if message is a simple greeting or direct call without inquiry
        const cleanContent = (message.content || "")
          .replace(/<@!?\d+>/g, "")
          .replace(/@roomup/gi, "")
          .replace(/@sentinel/gi, "")
          .replace(/^roomup\b/i, "")
          .trim();
        const isSimpleGreetingOrCall = cleanContent.length === 0 ||
          /^(?:ciao|ehi|salve|buongiorno|buonasera|ci sei|dimmi|hey|eccomi)[.!?\s]*$/i.test(cleanContent);

        let finalReply = "";

        if (isSimpleGreetingOrCall && !intent.isStatusInquiry) {
          finalReply = `${staffPrefix}! Sono qui e operativo al 100%. Sto monitorando il ticket di ${userMention}. Dimmi pure se hai indicazioni o verifiche da eseguire.`;
        } else {
          const prompt = `Sei Sentinel, membro autonomo dello staff di RoomUp!
Un superiore dello staff (${message.author.username}, ${senderIsOwner ? "Owner del server" : "Staffer"}) ti ha scritto: "${message.content}".
CONTESTO ATTUALE DEL TICKET #${channel.name}:
- Situazione: ${stateDescription}.
${lastUserContext}
Fornisci una risposta sintetica, naturale ed umana spiegando esattamente la situazione a ${message.author.username}.
REGOLE TASSATIVE:
- Se chi parla è Frè/Owner rivolgiti a lui amichevolmente ("Ciao Frè, ...").
- ZERO emoji.
- Max 2-3 righe.
- Niente convenevoli inutili.
- VIETATO ASSOLUTO usare costanti di codice o termini interni come "STAFF_TAKEOVER", "RESOLVED", "AI_ACTIVE", "errore 600", "problema 600".
- Ricorda che ${message.author.username} fa parte dello staff/Founder e NON è l'utente che ha aperto il ticket. Non offrirgli supporto o assistenza per il suo ticket: offrigli collaborazione come collega di staff.
- Parla come un vero collega di staff.
Scrivi ESCLUSIVAMENTE la tua risposta:`;

          const aiReply = await this.modelRouter.generateText({
            prompt,
            task: "FAST_MODEL",
            guildConfig,
            temperature: 0.2
          });

          finalReply = aiReply.success && aiReply.text
            ? aiReply.text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "").trim()
            : (intent.isStatusInquiry
                ? `${staffPrefix}, ecco la situazione: ${stateDescription}.${lastUserContext} Sto monitorando la conversazione e rimango pronto a eseguire le tue direttive.`
                : `${staffPrefix}! Sono qui e operativo al 100%. Sto monitorando il ticket di ${userMention}. Dimmi pure se hai indicazioni o verifiche da eseguire.`);

          // Mandatory guard: Never tell staff/founder "dimmi pure come posso supportarti nel ticket"
          if (/\b(?:supportarti|aiutarti|assisterti)\s+(?:nel|per il)\s+ticket\b/i.test(finalReply) || /\b(?:il\s+tuo\s+ticket)\b/i.test(finalReply)) {
            finalReply = `${staffPrefix}! Sono qui e operativo al 100%. Sto monitorando il ticket di ${userMention}. Dimmi pure se hai indicazioni o verifiche da eseguire per questo ticket.`;
          }
        }

        await channel.send(finalReply).catch(() => null);
        const history = session.conversationHistory || [];
        history.push({ role: "staff", text: message.content });
        history.push({ role: "bot", text: finalReply });
        this.memoryEngine.updateTicketMemory(guildId, channel.id, {
          conversationHistory: history
        });

        return {
          handled: true,
          action: intent.isStatusInquiry ? "STAFF_BRIEFING_SENT" : "STAFF_DIRECT_REPLY",
          reply: finalReply
        };
      }

      // F. Live Learning Observation
      if (message.content.length > 8) {
        await this.learningEngine.registerLearningEvent(guildId, {
          type: LEARNING_TYPES.OBSERVATION,
          title: `Risposta dello staff in ticket ${session.category}`,
          content: message.content,
          categoryKey: session.category || "general",
          source: "live_staff_action",
          author: message.author.username,
          guildConfig
        });
      }

      return { handled: true, action: "STAFF_MESSAGE_OBSERVED" };
    }

    // 2. USER MESSAGES
    if (session.mode === OPERATIONAL_MODES.STAFF_ACTIVE || session.mode === OPERATIONAL_MODES.AI_PASSIVE || session.currentState === TICKET_STATES.STAFF_TAKEOVER) {
      // AI is passive, just observe and record
      const history = session.conversationHistory || [];
      history.push({ role: "user", text: message.content });
      this.memoryEngine.updateTicketMemory(guildId, channel.id, { conversationHistory: history });
      return { handled: true, action: "AI_PASSIVE" };
    }

    const userIntent = this.commandIntentDetector.detectIntent(message.content);

    // Negative Test: User cannot close ticket manually unless resolving
    if (userIntent.type === INTENT_TYPES.CLOSE_TICKET) {
      const reply = "Solo i membri dello staff possono chiudere direttamente il ticket. Se hai risolto il tuo problema, puoi scrivere 'ho risolto' o 'tutto risolto' e provvederò io a chiuderlo.";
      await channel.send(reply).catch(() => null);
      return { handled: true, action: "USER_CLOSE_UNAUTHORIZED" };
    }

    // Negative Test: User cannot issue resume or takeover
    if (userIntent.type === INTENT_TYPES.AI_RESUME) {
      return { handled: true, action: "USER_RESUME_UNAUTHORIZED" };
    }
    if (userIntent.type === INTENT_TYPES.STAFF_TAKEOVER) {
      return { handled: true, action: "USER_TAKEOVER_IGNORED" };
    }

    // Direct bot mention or greeting from user in ticket
    const botId = message?.client?.user?.id;
    const content = message.content || "";
    const norm = content.toLowerCase().trim();
    const isBotMentioned = Boolean(
      (botId && message?.mentions?.users?.has?.(botId) && !message?.mentions?.everyone) ||
      (botId && new RegExp(`<@!?${botId}>`).test(content)) ||
      norm.startsWith("@roomup") ||
      norm.startsWith("@sentinel")
    );

    const cleanUserContent = content
      .replace(/<@!?\d+>/g, "")
      .replace(/@roomup/gi, "")
      .replace(/@sentinel/gi, "")
      .replace(/^roomup\b/i, "")
      .trim();

    const isSimpleGreetingOrCall = cleanUserContent.length === 0 ||
      /^(?:ciao|ehi|salve|buongiorno|buonasera|ci sei|dimmi|hey|eccomi|help|aiuto)[.!?\s]*$/i.test(cleanUserContent);

    if (isBotMentioned && isSimpleGreetingOrCall) {
      const userReply = `Ciao <@${message.author.id}>! Sono RoomUp! Sentinel AI, l'assistente del server. Sono qui per aiutarti nel ticket: spiegami pure la tua richiesta o il tuo problema e ti assisto subito!`;
      await channel.send(userReply).catch(() => null);
      const history = session.conversationHistory || [];
      history.push({ role: "user", text: message.content });
      history.push({ role: "bot", text: userReply });
      this.memoryEngine.updateTicketMemory(guildId, channel.id, { conversationHistory: history });
      return { handled: true, action: "USER_DIRECT_REPLY", reply: userReply };
    }

    // Check closing signals first
    const closingCheck = this.evaluateClosingSignals(message.content);
    if (closingCheck.signal === "RESOLVED" || userIntent.type === INTENT_TYPES.USER_RESOLUTION) {
      const exec = await this.toolEngine.executeTool("close_ticket", {
        channelId: channel.id,
        guildId,
        reason: "Risolto dall'utente con esito positivo.",
        closedBy: message.author.username
      }, { guildId, channelId: channel.id, userId: message.author.id, guildConfig });

      session.currentState = TICKET_STATES.CLOSED;
      session.mode = OPERATIONAL_MODES.RESOLVED;
      session.resolution = "Risolto dall'utente con esito positivo.";
      this.memoryEngine.updateTicketMemory(guildId, channel.id, {
        currentState: TICKET_STATES.CLOSED,
        mode: OPERATIONAL_MODES.RESOLVED,
        resolution: session.resolution
      });
      await channel.send("Perfetto, felice che sia tutto risolto! Provvedo a chiudere il ticket.");
      return { handled: true, action: "TICKET_RESOLVED_CLOSE", execution: exec };
    }

    // Route to category specialized stateful handlers
    const cat = String(session.category || "").toUpperCase();
    const chName = String(channel.name || "").toLowerCase();

    const msgNorm = (message.content || "").toLowerCase();
    const isPartnershipMsg = /\b(partnership|partner|fondervi|fusione|fondere)\b/i.test(msgNorm);

    if (cat === TICKET_CATEGORIES.PARTNERSHIP || cat === "PARTNERSHIP" || chName.includes("partner") || isPartnershipMsg) {
      if (isPartnershipMsg && cat !== "PARTNERSHIP") {
        session.category = "PARTNERSHIP";
        this.memoryEngine.updateTicketMemory(guildId, channel.id, { category: "PARTNERSHIP" });
      }
      const partResult = await this.handlePartnershipTicketMessage({ message, session, channel, guildConfig });
      if (partResult.handled) return partResult;
    } else if (cat === TICKET_CATEGORIES.MINECRAFT || cat === "MINECRAFT" || chName.includes("mc") || chName.includes("minecraft")) {
      const mcResult = await this.handleMinecraftTicketMessage({ message, session, channel, guildConfig });
      if (mcResult.handled) return mcResult;
    } else if (cat === TICKET_CATEGORIES.BAN_APPEAL || cat === "BAN_APPEAL" || chName.includes("unban") || chName.includes("appeal")) {
      const baResult = await this.handleBanAppealTicketMessage({ message, session, channel, guildConfig });
      if (baResult.handled) return baResult;
    } else if (cat === TICKET_CATEGORIES.SHOP || cat === "SHOP" || chName.includes("shop") || chName.includes("acquisto")) {
      const shopResult = await this.handleShopTicketMessage({ message, session, channel, guildConfig });
      if (shopResult.handled) return shopResult;
    } else if (cat === TICKET_CATEGORIES.STAFF || cat === "STAFF" || chName.includes("candidatura") || chName.includes("staff")) {
      const staffResult = await this.handleStaffAppTicketMessage({ message, session, channel, guildConfig });
      if (staffResult.handled) return staffResult;
    } else if (cat === TICKET_CATEGORIES.REPORT || cat === "REPORT" || chName.includes("report") || chName.includes("segnal")) {
      const repResult = await this.handleReportTicketMessage({ message, session, channel, guildConfig });
      if (repResult.handled) return repResult;
    }

    // Check learned rules precedence for support & general tickets
    const learnedRules = this.memoryEngine.getLearnedRules(guildId);
    if (learnedRules && learnedRules.length > 0) {
      const normMsg = (message.content || "").toLowerCase();
      const matchingRule = learnedRules.find(r => {
        if (!r.rule) return false;
        const rCat = String(r.category || "GENERAL").toUpperCase();
        if (rCat !== "GENERAL" && cat && rCat !== cat) return false;
        if (r.triggerKeywords && Array.isArray(r.triggerKeywords) && r.triggerKeywords.length > 0) {
          return r.triggerKeywords.some(kw => {
            const cleanKw = kw.toLowerCase().trim();
            return cleanKw.length > 2 && normMsg.includes(cleanKw);
          });
        }
        return false;
      });

      if (matchingRule) {
        let ruleResponse = "";
        if (/chied(?:i|iamo)\s+(?:sempre\s+)?(?:uno\s+)?screen/i.test(matchingRule.rule)) {
          ruleResponse = "Per questo tipo di problema ti chiediamo di inviarci uno screenshot chiaro della schermata di errore per poterti aiutare al meglio.";
        } else {
          ruleResponse = `In base alla procedura del server: ${matchingRule.rule}`;
        }
        await this.sendTicketReply(channel, session, ruleResponse);
        const history = session.conversationHistory || [];
        history.push({ role: "user", text: message.content });
        history.push({ role: "bot", text: ruleResponse });
        this.memoryEngine.updateTicketMemory(guildId, channel.id, { conversationHistory: history });
        return { handled: true, action: "APPLIED_LEARNED_RULE", rule: matchingRule };
      }
    }

    return { handled: false, action: "PROCEED_TO_DECISION_ENGINE" };
  }

  /**
   * Transfer / Escalation Handoff with Embed and Rivendica button (Point 20, 28)
   */
  async transferTicketToStaff({ channel, session, guildConfig, userMessage = null }) {
    const guildId = session.guildId || channel.guild?.id;

    // 0. Rename ticket channel to partnership-nomeutente
    let rawUsername = userMessage?.author?.username || session.username;
    if (!rawUsername && session.userId && channel.guild) {
      try {
        const m = channel.guild.members.cache.get(session.userId) || await channel.guild.members.fetch(session.userId).catch(() => null);
        if (m?.user?.username) {
          rawUsername = m.user.username;
        }
      } catch (e) {}
    }
    const cleanName = (rawUsername || "utente")
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, 30) || "utente";
    const targetChannelName = `partnership-${cleanName}`;
    if (channel.name !== targetChannelName && typeof channel.setName === "function") {
      await channel.setName(targetChannelName).catch(err => {
        console.warn(`[SentinelTicketEngine] Could not rename channel ${channel.id} to ${targetChannelName}:`, err.message);
      });
    }

    // 1. Staff roles to ping
    let partnershipRoleId = "1554969581011996682";
    let supervisorRoleId = "1554969549076566117";
    try {
      const { getGuildConfig } = require("../../config/settingsManager");
      const cfg = channel.guild ? getGuildConfig(channel.guild.id) : null;
      if (cfg?.partnerships?.staffRoleIds?.[0]) partnershipRoleId = cfg.partnerships.staffRoleIds[0];
      if (cfg?.tickets?.staffRoleIds?.[0]) supervisorRoleId = cfg.tickets.staffRoleIds[0];
    } catch (e) {}
    if (channel.guild?.id === "1429445691452948524") {
      partnershipRoleId = "1550846898850631730";
      supervisorRoleId = "1550846887085740125";
    }
    const pingContent = `<@&${partnershipRoleId}> <@&${supervisorRoleId}>`;

    // 2. Build summary
    const isFusion = /fond|fusione|merg/i.test(session.partnershipIntent || "");
    const isChain = Boolean(session.isChain || session.memberFigures);
    const memberText = isChain
      ? `una chain di ${session.memberFigures.split(",").length > 2 ? "tre" : session.memberFigures.split(",").length} server con ${session.memberFigures} membri`
      : `un server con ${session.memberCount || "diversi"} membri`;
    const pastText = session.hasPastPartnership
      ? `di aver già avuto collaborazioni in passato (${session.pastDetails || ""})`
      : `di non aver mai effettuato prima una partnership con RoomUp`;

    const intentText = isFusion
      ? "L'utente richiede una partnership e chiede se siete interessati a fondervi o a fare una fusione temporanea di prova."
      : "L'utente richiede una partnership per la propria community.";

    let summary = `${intentText} Indica di avere ${memberText} e ${pastText}.`;

    // Try AI generation of summary if available for extra fluency
    try {
      const historySlice = (session.conversationHistory || []).map(h => `${h.role}: ${h.text}`).join("\n");
      const aiRes = await this.modelRouter.generateText({
        prompt: `Sei Sentinel per RoomUp. Riassumi in un unico paragrafo di 2-3 frasi la richiesta di questo utente per il pannello staff:
${historySlice}
Ultimo messaggio utente: "${userMessage?.content || ""}"
REGOLE:
- Inizia con "L'utente richiede..."
- Sintetizza: se chiede partnership/fusione, quanti membri/server (chain) ha, e se ha già fatto partnership.
- Italiano perfetto, conciso, professionale, zero emoji oltre all'eventuale stile del testo.`,
        task: "FAST_MODEL",
        temperature: 0.2
      });
      if (aiRes.success && aiRes.text && aiRes.text.length > 20) {
        summary = aiRes.text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "").trim();
      }
    } catch (e) {}

    const descSnippet = session.partnerDescription
      ? `\n\n**Descrizione fornita dall'utente:**\n>>> ${session.partnerDescription.slice(0, 500)}${session.partnerDescription.length > 500 ? "..." : ""}`
      : "";

    // 3. Create Embed
    const embed = new EmbedBuilder()
      .setTitle("Ticket Trasferito")
      .setColor(0x5865F2)
      .setDescription(
        `**Categoria:** \`『🤝』 Partnership / Collaborazioni\`\n\n` +
        `> ✨ ${summary}${descSnippet}\n\n` +
        `**Tempo di risposta stimato**\n\`da 5 alle 24 ore\``
      )
      .setTimestamp();

    // 4. Action button
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_claim_${channel.id}`)
        .setLabel("Rivendica")
        .setStyle(ButtonStyle.Success)
        .setEmoji("📌")
    );

    // 5. Send to Discord
    await channel.send({
      content: pingContent,
      embeds: [embed],
      components: [row]
    }).catch(async () => {
      await channel.send({ embeds: [embed], components: [row] }).catch(() => null);
    });

    // 6. Update session state
    session.transferred = true;
    session.currentState = TICKET_STATES.WAITING_FOR_STAFF;
    session.mode = OPERATIONAL_MODES.STAFF_ACTIVE; // Sentinel will remain passive
    session.transferSummary = summary;
    this.memoryEngine.updateTicketMemory(guildId, channel.id, {
      transferred: true,
      currentState: TICKET_STATES.WAITING_FOR_STAFF,
      mode: OPERATIONAL_MODES.STAFF_ACTIVE,
      transferSummary: summary,
      screeningStep: "COMPLETED",
      partnerDescription: session.partnerDescription
    });
  }

  /**
   * Stateful handling of partnership tickets (multi-turn screening + transfer + verification)
   */
  async handlePartnershipTicketMessage({ message, session, channel, guildConfig }) {
    const guildId = session.guildId || channel.guild?.id || message.guild?.id;
    const attachments = message.attachments ? Array.from(message.attachments.values()) : [];
    const image = attachments.find(a => a.contentType?.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(a.name || ""));
    const content = (message.content || "").trim();

    // 0. If ticket was already transferred to staff: AI stays passive!
    if (session.transferred || session.mode === OPERATIONAL_MODES.STAFF_ACTIVE || session.currentState === TICKET_STATES.WAITING_FOR_STAFF) {
      return { handled: true, action: "WAITING_FOR_STAFF" };
    }

    await channel.sendTyping().catch(() => null);

    // 0b. If partnership has already been completed / published -> DO NOT PUBLISH AGAIN!
    if (session.published || session.partnershipPublished || session.currentState === TICKET_STATES.RESOLVED) {
      const partnerNum = session.partnerNumber || (session.resolution?.match(/#(\d+)/)?.[1]) || "";
      const pNumText = partnerNum ? ` #${partnerNum}` : "";

      let targetChannelMention = "canale partnership";
      try {
        const { loadSettings } = require("../../config/settingsManager");
        const settings = loadSettings();
        const chId = settings[guildId]?.partnerships?.channelId;
        if (chId) targetChannelMention = `<#${chId}>`;
      } catch(e) {}

      // A. User announces they have a question or asks to ask a question (including typos like 'dkamnda', 'hna domanda')
      const isAnnouncingQuestion = /\b(domand[ae]|dkamnd[ae]|chiedere|chiarimento|dubbio|posso|ascolta|dimmi|help|aiuto|info|informazion[ie])\b/i.test(content) &&
        !/\b(non (?:si )?vede|non (?:hai|ha) inviato|canale|link)\b/i.test(content);

      // B. User asks specifically about publication status or where it was published
      const asksAboutPublication = /\b(canale|dove|dov['eè]|non (?:si )?vede|non (?:hai|ha) inviato|perch[eéè]|quando|pubblicat[ao]|link|inviat[ao])\b/i.test(content) &&
        /\b(canale|partnership|pubblicat|inviat|postat|link|vedere|vede|chat)\b/i.test(content);

      // C. User gives polite closing / thank-you signals
      const isClosingSignal = /^(grazie|ok|va bene|perfetto|tutto a posto|a posto|ottimo|gentilissimo|buona giornata|buonasera|buon proseguimento|grazie mille)[.!]?$/i.test(content.trim());

      if (isAnnouncingQuestion) {
        await this.sendTicketReply(
          channel,
          session,
          "Certo, dimmi pure! Qual è la tua domanda?",
          "Ti ascolto, scrivi pure qui il tuo dubbio o la tua richiesta e ti rispondo subito."
        );
        return { handled: true, action: "PARTNERSHIP_QUESTION_INVITED" };
      }

      if (asksAboutPublication) {
        const prompt = `Sei Sentinel, staff di RoomUp.
L'utente (@${message.author.username}) ha chiesto nel ticket di partnership: "${content}".
STATO PARTNERSHIP:
- La partnership${pNumText} è GIÀ STATA VERIFICATA e PUBBLICATA nel ${targetChannelMention}.
- Spiega all'utente con calma che la partnership è stata registrata e inviata nel ${targetChannelMention}. Se non la vede o ha dubbi, confermagli che è salvata nei sistemi ufficiali.
REGOLE:
- Italiano naturale ed empatico.
- ZERO emoji.
- Max 2-3 righe.`;

        const aiRes = await this.modelRouter.generateText({
          prompt,
          task: "FAST_MODEL",
          guildConfig,
          temperature: 0.2
        });

        const replyMsg = aiRes.success && aiRes.text
          ? aiRes.text
          : `La tua richiesta di partnership${pNumText} è stata verificata ed è già stata pubblicata nel ${targetChannelMention}. Se non la visualizzi nel canale, potrebbe essere dovuto ai permessi di visualizzazione o a un ritardo di aggiornamento di Discord. Ti confermo che è registrata correttamente nei nostri sistemi.`;

        await this.sendTicketReply(
          channel,
          session,
          replyMsg,
          `Ti confermo nuovamente che la partnership${pNumText} è registrata e inviata nel ${targetChannelMention}. Se hai bisogno di altro o hai altre domande, dimmi pure!`
        );
        return { handled: true, action: "PARTNERSHIP_FOLLOWUP_ANSWERED" };
      }

      if (isClosingSignal) {
        await this.sendTicketReply(
          channel,
          session,
          "Di nulla! Se non hai altre domande possiamo procedere alla chiusura del ticket, oppure rimaniamo a disposizione se ti serve altro.",
          "Rimaniamo sempre a tua disposizione. Se hai completato tutto, faccelo sapere per chiudere il ticket."
        );
        return { handled: true, action: "PARTNERSHIP_CLOSING_PROMPTED" };
      }

      // D. User asks ANY other general question or follow-up
      const isQuestionOrInquiry = content.includes("?") || content.length > 3;
      if (isQuestionOrInquiry) {
        const prompt = `Sei Sentinel, membro dello staff di RoomUp.
L'utente (@${message.author.username}) ti scrive nel ticket: "${content}".
CONTESTO TICKET:
- La partnership${pNumText} di questo utente è già stata approvata e completata nel ${targetChannelMention}.
- Ora l'utente ha scritto questo messaggio o domanda aggiuntiva.
REGOLE:
- Rispondi in modo cordiale, utile, naturale e professionale come un vero staffer.
- ZERO emoji.
- Massimo 2-3 frasi chiare.
- Non ripetere frasi già dette se non richieste.`;

        const aiRes = await this.modelRouter.generateText({
          prompt,
          task: "FAST_MODEL",
          guildConfig,
          temperature: 0.2
        });

        const replyMsg = aiRes.success && aiRes.text
          ? aiRes.text
          : "Rimaniamo a disposizione per qualsiasi chiarimento. Dimmi pure di cosa hai bisogno!";

        await this.sendTicketReply(
          channel,
          session,
          replyMsg,
          "Dimmi pure di cosa hai bisogno, sono a tua completa disposizione."
        );
        return { handled: true, action: "PARTNERSHIP_GENERAL_QUERY_ANSWERED" };
      }

      // E. Fallback
      await this.sendTicketReply(
        channel,
        session,
        `La tua partnership${pNumText} è già stata approvata e pubblicata nel ${targetChannelMention}. Se hai bisogno di altro, rimaniamo a disposizione!`,
        "Dimmi pure se hai altre domande, ti ascolto."
      );
      return { handled: true, action: "PARTNERSHIP_ALREADY_COMPLETED" };
    }

    // 1. Screenshot validation
    if (image) {
      await channel.send("Ho ricevuto lo screenshot, sto verificando l'invito e la schermata...").catch(() => null);

      const visionCheck = await this.visionEngine.validateScreenshot({
        imageUrl: image.url,
        requiredInvite: "discord.gg/roomup",
        guildConfig
      });

      if (visionCheck.valid) {
        this.memoryEngine.updateTicketMemory(guildId, channel.id, {
          screenshotVerified: true,
          screenshotUrl: image.url
        });
        session.screenshotVerified = true;

        if (session.partnerDescription && session.partnerDescription.length > 5) {
          const pubResult = await this.publishPartnership(channel, session, message.guild);
          return { handled: true, action: "PARTNERSHIP_PUBLISHED", data: pubResult };
        } else {
          await channel.send("Screenshot verificato con successo a schermo intero. Ora inviami la descrizione o il link del tuo server che vuoi che RoomUp pubblichi nel canale partnership.").catch(() => null);
          return { handled: true, action: "PARTNERSHIP_AWAITING_DESCRIPTION" };
        }
      } else {
        const reasons = visionCheck.reasons?.length > 0 ? visionCheck.reasons.join(". ") : "Assicurati che lo screenshot sia a schermo intero con orario visibile e che il link sia nel canale partnership.";
        await channel.send(`Lo screenshot non è idoneo: ${reasons}. Per favore inviane uno a schermo intero che mostri l'intera finestra di Discord con il nostro link pubblicato nel canale partnership.`).catch(() => null);
        return { handled: true, action: "PARTNERSHIP_SCREENSHOT_REJECTED" };
      }
    }

    // 2. Publish if screenshot was already verified and description is now provided
    if (session.screenshotVerified && content.length > 5) {
      const isQuestion = content.includes("?") || /^(perch[eè]|come|dove|quando|cosa|chi|perche|perchè|non hai|ma|scusa|perche non)\b/i.test(content);
      const hasInvite = /discord\.gg\/|discord\.com\/invite\/|https?:\/\//i.test(content);

      if (isQuestion && !hasInvite) {
        const replyMsg = "Lo screenshot è già stato verificato con successo. Per procedere alla pubblicazione finale nel nostro canale partnership, inviaci la descrizione del tuo server con il link di invito permanente.";
        await channel.send(replyMsg).catch(() => null);
        return { handled: true, action: "PARTNERSHIP_QUESTION_ANSWERED" };
      }

      const prevDesc = session.partnerDescription || "";
      const newDesc = prevDesc ? `${prevDesc}\n${content}` : content;
      this.memoryEngine.updateTicketMemory(guildId, channel.id, { partnerDescription: newDesc });
      session.partnerDescription = newDesc;

      const pubResult = await this.publishPartnership(channel, session, message.guild);
      return { handled: true, action: "PARTNERSHIP_PUBLISHED", data: pubResult };
    }

    // 3. MULTI-TURN CONVERSATIONAL SCREENING & REASONING (Modello Pergusa's Support)
    const norm = content.toLowerCase();
    const figures = extractMemberFigures(content);

    // Guard: Check if the user is clarifying or correcting member count in ANY state
    const isMemberCorrection = figures.length > 0 && (
      /\b(non sono|non ne ho|non ne ha|in realt[àa]|invece sono|invece ne sono|sono invece|ne sono|ne ha|ne ho|membri|conteggio)\b/i.test(norm) ||
      /\bnon\s+(?:sono\s+)?\d+\s+ma\s+/i.test(norm)
    );

    if (isMemberCorrection) {
      const correctedCount = figures[figures.length - 1];
      session.memberCount = correctedCount;
      this.memoryEngine.updateTicketMemory(guildId, channel.id, session);
      const formatted = Number(correctedCount).toLocaleString("it-IT");

      if (session.screeningStep === "AWAITING_DESCRIPTION") {
        const reply = `Capito, ho aggiornato il dato a **${formatted} membri**! Quando sei pronto, inviaci qui la **descrizione del tuo server** completa con il relativo link di invito Discord permanente.`;
        await this.sendTicketReply(channel, session, reply);
        return { handled: true, action: "PARTNERSHIP_MEMBERS_CORRECTED" };
      } else if (session.screeningStep === "AWAITING_COOLDOWN") {
        const reply = `Capito, ho aggiornato il dato a **${formatted} membri**! Un'ulteriore verifica sui requisiti: hai già effettuato in passato una partnership con RoomUp? Se sì, quando è avvenuta l'ultima volta?`;
        await this.sendTicketReply(channel, session, reply);
        return { handled: true, action: "PARTNERSHIP_MEMBERS_CORRECTED" };
      } else {
        const reply = `Capito, ho aggiornato il dato nei sistemi a **${formatted} membri**!`;
        await this.sendTicketReply(channel, session, reply);
        return { handled: true, action: "PARTNERSHIP_MEMBERS_CORRECTED" };
      }
    }

    // STEP A: Initial proposal / Intent
    if (!session.screeningStep || session.screeningStep === "INITIAL") {
      session.partnershipIntent = content;

      if (figures.length >= 2) {
        session.screeningStep = "AWAITING_CHAIN_CONFIRM";
        session.memberFigures = figures.join(", ");
        const countText = figures.length === 3 ? "tre" : `${figures.length}`;
        const reply = `Grazie per le informazioni! Prima di procedere con la verifica, vorrei capire meglio la situazione dei tuoi server.\n\nHai indicato ${countText} cifre di membri (${figures.join(", ")}): si tratta di server distinti collegati tra loro (cioè una chain)?\n\nNota: alcuni dettagli sui requisiti di partnership sono attualmente in revisione da parte dello staff.`;
        await this.sendTicketReply(channel, session, reply);
        this.memoryEngine.updateTicketMemory(guildId, channel.id, session);
        return { handled: true, action: "PARTNERSHIP_CHAIN_CLARIFY_ASKED" };
      } else if (figures.length === 1) {
        session.screeningStep = "AWAITING_COOLDOWN";
        session.memberCount = figures[0];
        const formatted = Number(figures[0]).toLocaleString("it-IT");
        const reply = `Grazie per l'informazione! Abbiamo registrato che il tuo server ha circa ${formatted} membri. Un'ulteriore verifica sui requisiti: hai già effettuato in passato una partnership con RoomUp? Se sì, quando è avvenuta l'ultima volta? (Ricorda che la partnership con lo stesso server può essere ripetuta solo dopo 10 giorni.)`;
        await this.sendTicketReply(channel, session, reply);
        this.memoryEngine.updateTicketMemory(guildId, channel.id, session);
        return { handled: true, action: "PARTNERSHIP_COOLDOWN_CHECK_ASKED" };
      }

      session.screeningStep = "AWAITING_MEMBERS";
      const reply = session.greetingSent
        ? `Per procedere con la verifica dei requisiti, quanti membri ha attualmente il tuo server Discord?`
        : `Ciao! Grazie per averci contattato. Prima di passare la tua richiesta al reparto relazioni estere, dobbiamo verificare che rispetti i nostri requisiti per le partnership.\n\nUna prima domanda: quanti membri ha attualmente il tuo server?`;
      session.greetingSent = true;
      await this.sendTicketReply(channel, session, reply);
      this.memoryEngine.updateTicketMemory(guildId, channel.id, session);
      return { handled: true, action: "PARTNERSHIP_MEMBERS_ASKED" };
    }

    // STEP B: Awaiting Members
    if (session.screeningStep === "AWAITING_MEMBERS") {
      if (figures.length >= 2) {
        session.screeningStep = "AWAITING_CHAIN_CONFIRM";
        session.memberFigures = figures.join(", ");
        const countText = figures.length === 3 ? "tre" : `${figures.length}`;
        const reply = `Grazie per le informazioni! Prima di procedere con la verifica, vorrei capire meglio la situazione dei tuoi server.\n\nHai indicato ${countText} cifre di membri (${figures.join(", ")}): si tratta di tre server distinti collegati tra loro (cioè una chain)?\n\nNota: alcuni dettagli sui requisiti di partnership sono attualmente in revisione da parte dello staff.`;
        await this.sendTicketReply(channel, session, reply);
        this.memoryEngine.updateTicketMemory(guildId, channel.id, session);
        return { handled: true, action: "PARTNERSHIP_CHAIN_CLARIFY_ASKED" };
      } else if (figures.length === 1) {
        session.screeningStep = "AWAITING_COOLDOWN";
        session.memberCount = figures[0];
        const formatted = Number(figures[0]).toLocaleString("it-IT");
        const reply = `Grazie per l'informazione! Abbiamo registrato circa ${formatted} membri. Un'ulteriore verifica sui requisiti: hai già effettuato in passato una partnership con RoomUp? Se sì, quando è avvenuta l'ultima volta? (Ricorda che la partnership con lo stesso server può essere ripetuta solo dopo 10 giorni.)`;
        await this.sendTicketReply(channel, session, reply);
        this.memoryEngine.updateTicketMemory(guildId, channel.id, session);
        return { handled: true, action: "PARTNERSHIP_COOLDOWN_CHECK_ASKED" };
      } else {
        const reply = `Per procedere con la verifica dei requisiti, quanti membri ha attualmente il tuo server Discord?`;
        await this.sendTicketReply(channel, session, reply);
        return { handled: true, action: "PARTNERSHIP_MEMBERS_REASKED" };
      }
    }

    // STEP C: Awaiting Chain Confirmation
    if (session.screeningStep === "AWAITING_CHAIN_CONFIRM") {
      session.isChain = /si|sì|esatto|chain|collegat|distint|server/i.test(norm);
      session.screeningStep = "AWAITING_COOLDOWN";
      const reply = `Grazie per la conferma. Un'ulteriore verifica sui requisiti: hai già effettuato in passato una partnership con RoomUp? Se sì, quando è avvenuta l'ultima volta? (Ricorda che la partnership con lo stesso server può essere ripetuta solo dopo 10 giorni.)`;
      await this.sendTicketReply(channel, session, reply);
      this.memoryEngine.updateTicketMemory(guildId, channel.id, session);
      return { handled: true, action: "PARTNERSHIP_COOLDOWN_CHECK_ASKED" };
    }

    // STEP D: Awaiting Cooldown -> Ask description as the last question!
    if (session.screeningStep === "AWAITING_COOLDOWN") {
      const hasPast = !/\b(no|mai|nessun|prima volta)\b/i.test(norm);
      session.hasPastPartnership = hasPast;
      session.pastDetails = content;
      session.screeningStep = "AWAITING_DESCRIPTION";
      this.memoryEngine.updateTicketMemory(guildId, channel.id, session);

      const reply = `Perfetto, ho registrato i requisiti! Come ultima cosa, inviaci qui la **descrizione del tuo server** completa con il relativo link di invito Discord permanente.`;
      await this.sendTicketReply(channel, session, reply);
      return { handled: true, action: "PARTNERSHIP_DESCRIPTION_ASKED" };
    }

    // STEP E: Awaiting Description & Discord Invite Link
    if (session.screeningStep === "AWAITING_DESCRIPTION") {
      const inviteRegex = /(?:https?:\/\/)?(?:www\.)?(?:discord\.(?:gg|io|me|li)|discord(?:app)?\.com\/invite)\/[a-zA-Z0-9_-]+/i;
      const hasInvite = inviteRegex.test(content);
      const isQuestion = content.includes("?") || /^(perch[eéè]|come|dove|quando|cosa|quanto|chi|posso|scusa|ma)\b/i.test(norm);
      const isCasualChat = /^(ok|va bene|perfetto|aspetta|arrivo|un attimo|ricevuto|capito|eccomi|va benissimo)[.!]?$/i.test(norm.trim());

      // 1. Casual chat / wait signal
      if (isCasualChat && !hasInvite) {
        const reply = `Perfetto! Attendiamo qui la descrizione del tuo server con il link di invito Discord permanente.`;
        await this.sendTicketReply(channel, session, reply);
        return { handled: true, action: "PARTNERSHIP_WAIT_ACKNOWLEDGED" };
      }

      // 2. Question without invite link
      if (isQuestion && !hasInvite) {
        const prompt = `Sei Sentinel, membro dello staff di RoomUp.
L'utente ti ha appena fatto questa domanda durante la fase finale della richiesta di partnership: "${content}".
Rispondi in modo naturale, cortese e conciso (massimo 2 frasi, zero emoji), ricordandogli che per completare la procedura serve la descrizione del server e il link d'invito Discord permanente.`;
        const aiRes = await this.modelRouter.generateText({
          prompt,
          task: "FAST_MODEL",
          guildConfig,
          temperature: 0.2
        });
        const reply = aiRes.success && aiRes.text
          ? aiRes.text
          : `Rimaniamo a disposizione per qualsiasi chiarimento! Quando sei pronto, inviaci pure qui la descrizione del tuo server con il link di invito permanente.`;
        await this.sendTicketReply(channel, session, reply);
        return { handled: true, action: "PARTNERSHIP_QUESTION_ANSWERED" };
      }

      // 3. User sent text WITHOUT invite link
      if (!hasInvite) {
        if (content.trim().length > 15) {
          const prevDesc = session.partnerDescription || "";
          session.partnerDescription = prevDesc ? `${prevDesc}\n${content}` : content;
          this.memoryEngine.updateTicketMemory(guildId, channel.id, session);

          const reply = `Grazie per la descrizione! Manca solo il **link di invito Discord permanente** (es. \`https://discord.gg/...\`). Inviacelo qui per passare la richiesta allo staff.`;
          await this.sendTicketReply(channel, session, reply);
          return { handled: true, action: "PARTNERSHIP_INVITE_REQUESTED" };
        } else {
          const reply = `Per procedere con la richiesta di partnership, inviaci la **descrizione del tuo server** completa con il relativo **link di invito Discord permanente**.`;
          await this.sendTicketReply(channel, session, reply);
          return { handled: true, action: "PARTNERSHIP_DESCRIPTION_REPROMPTED" };
        }
      }

      // 4. Message HAS an invite link!
      const prevDesc = session.partnerDescription || "";
      const textWithoutInvite = content.replace(inviteRegex, "").trim();

      if (!prevDesc && textWithoutInvite.length < 15) {
        // User sent ONLY the invite link without description
        session.partnerDescription = content;
        this.memoryEngine.updateTicketMemory(guildId, channel.id, session);

        const reply = `Link di invito registrato! Inviaci ora una breve **descrizione del tuo server** da pubblicare insieme all'invito.`;
        await this.sendTicketReply(channel, session, reply);
        return { handled: true, action: "PARTNERSHIP_DESCRIPTION_REQUESTED" };
      }

      // User provided both description and invite link!
      const finalDesc = prevDesc
        ? `${prevDesc}\n${content}`
        : content;

      session.partnerDescription = finalDesc;
      session.screeningStep = "COMPLETED";
      this.memoryEngine.updateTicketMemory(guildId, channel.id, session);

      await this.transferTicketToStaff({
        channel,
        session,
        guildConfig,
        userMessage: message
      });

      return { handled: true, action: "TICKET_TRANSFERRED" };
    }

    return { handled: false };
  }

  async handleMinecraftTicketMessage({ message, session, channel }) {
    const content = (message.content || "").toLowerCase();
    await channel.sendTyping().catch(() => null);

    if (content.includes("ip") || content.includes("entra") || content.includes("conness") || content.includes("bedrock") || content.includes("java") || content.includes("errore")) {
      const reply = "Per giocare su RoomUp Minecraft:\n- Server IP Java: `mc.roomup.it` (Versione 1.20+)\n- Server IP Bedrock: `mc.roomup.it` con Porta `19132`\nSe continui a riscontrare problemi, inviaci lo screenshot dell'errore esatto.";
      await this.sendTicketReply(channel, session, reply);
      return { handled: true, action: "MINECRAFT_SUPPORT_SENT" };
    }

    return { handled: false };
  }

  async handleBanAppealTicketMessage({ message, session, channel }) {
    const content = (message.content || "").trim();
    await channel.sendTyping().catch(() => null);

    if (content.length > 3) {
      const reply = "Ho registrato le informazioni del tuo ricorso. Il team di amministrazione esaminerà i log di moderazione e valuterà la tua richiesta a breve. Rimani in attesa in questo ticket.";
      await this.sendTicketReply(channel, session, reply);
      return { handled: true, action: "BAN_APPEAL_PROCESSED" };
    }

    return { handled: false };
  }

  async handleShopTicketMessage({ message, session, channel }) {
    const content = (message.content || "").trim();
    await channel.sendTyping().catch(() => null);

    if (content.length > 3) {
      const reply = "Ho memorizzato i dettagli del pagamento/pacchetto. Uno staffer dell'amministrazione controllerà le transazioni per accreditarti i vantaggi appena possibile.";
      await this.sendTicketReply(channel, session, reply);
      return { handled: true, action: "SHOP_ASSISTANCE_SENT" };
    }

    return { handled: false };
  }

  async handleStaffAppTicketMessage({ message, session, channel }) {
    const content = (message.content || "").trim();
    await channel.sendTyping().catch(() => null);

    if (content.length > 5) {
      const reply = "Candidatura registrata con successo. I manager dello staff esamineranno la tua richiesta e ti contatteranno direttamente qui se risulterai idoneo per il colloquio.";
      await this.sendTicketReply(channel, session, reply);
      return { handled: true, action: "STAFF_APPLICATION_RECORDED" };
    }

    return { handled: false };
  }

  async handleReportTicketMessage({ message, session, channel }) {
    const content = (message.content || "").trim();
    await channel.sendTyping().catch(() => null);

    if (content.length > 3) {
      const reply = "Segnalazione acquisita. Il team di moderazione analizzerà le prove inviate e applicherà le dovute sanzioni in base al regolamento.";
      await this.sendTicketReply(channel, session, reply);
      return { handled: true, action: "REPORT_RECORDED" };
    }

    return { handled: false };
  }

  async publishPartnership(channel, session, guild) {
    let publishedInfo = null;
    const effectiveGuild = guild || channel.guild;
    const client = effectiveGuild?.client || channel.client || this.client;
    const guildId = effectiveGuild?.id || session.guildId;
    const userId = session.userId || channel.id;

    try {
      const { executePublishPartnership } = require("../../bot/partnershipEngine");
      const { loadSettings } = require("../../config/settingsManager");
      const member = effectiveGuild ? await effectiveGuild.members.fetch(userId).catch(() => null) : null;

      publishedInfo = await executePublishPartnership(
        client,
        loadSettings,
        {
          originGuildId: guildId,
          originGuildName: effectiveGuild?.name || "RoomUp!",
          collaboratorId: userId,
          collaboratorTag: member?.user?.tag || userId,
          authorId: "SentinelAI",
          description: session.partnerDescription || `Partnership con la community di <@${userId}>.`
        }
      );
    } catch (e) {
      console.error("[Sentinel:TicketEngine] Error publishing partnership:", e.message);
    }

    session.published = true;
    session.partnershipPublished = true;
    session.screenshotVerified = false;
    if (publishedInfo?.partnerNum) session.partnerNumber = publishedInfo.partnerNum;

    this.memoryEngine.updateTicketMemory(guildId, channel.id, {
      currentState: TICKET_STATES.RESOLVED,
      published: true,
      partnershipPublished: true,
      screenshotVerified: false,
      partnerNumber: publishedInfo?.partnerNum || session.partnerNumber || null,
      resolution: `Partnership #${publishedInfo?.partnerNum || "N/D"} verificata e pubblicata con successo.`
    });

    const msg = publishedInfo && publishedInfo.sentMessages?.length > 0
      ? `Tutto a posto! La partnership #${publishedInfo.partnerNum} è stata verificata e pubblicata ufficialmente nei canali sincronizzati del network!\n\nRoomUp!`
      : `Screenshot verificato con successo. La partnership è stata registrata e verrà approvata dallo staff.\n\nRoomUp!`;

    await this.sendTicketReply(channel, session, msg).catch(() => null);
    return publishedInfo;
  }
}

const defaultSentinelTicketEngine = new SentinelTicketEngine();
module.exports = {
  SentinelTicketEngine,
  defaultSentinelTicketEngine,
  TICKET_CATEGORIES,
  TICKET_STATES,
  OPERATIONAL_MODES,
  STAFF_HIERARCHY
};
