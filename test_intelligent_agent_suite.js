/**
 * TEST SUITE: INTELLIGENT AGENT, MEMORY & CONVERSATIONAL BUG FIXES
 * 
 * Tests the specific issues from the user request and screenshot:
 * 1. S.H.U.T. in #ticket-0010 asking "non hai inviato sul canale partnership perche?"
 *    -> Verified: The bot answers conversationally and DOES NOT re-publish Partnership #5!
 * 2. Founder Frè writing "Roomup\n@RoomUp!\n@RoomUp! che succede"
 *    -> Verified: The bot recognizes the Founder/Staff, answers with a complete status briefing,
 *       and does not remain mute!
 * 3. Staff commands in tickets:
 *    - "Roomup ricorda che i partner devono avere 50 membri" -> Memorizes rule in MemoryEngine & LearningEngine.
 *    - "Roomup imposta obiettivo: raggiungere 50 partner" -> Adds goal to MemoryEngine.
 *    - "Roomup chiudi il ticket" -> Closes ticket cleanly.
 * 4. MemoryEngine /goal, /learn, /boost, /grill-me stateful functions:
 *    - Goals lifecycle (add, list, complete, remove)
 *    - Boost mode activation (deep_reasoning, max_autonomy, speed, strict_audit)
 *    - Socratic Grill-Me session tracking turn-by-turn with scoring and evaluation
 * 5. ContextEngine & DecisionEngine memory inclusion:
 *    - Active goals, boost mode, and learned rules are present in context
 *    - Addressed staff messages outside tickets are not dropped
 */

const assert = require("assert");
const { SentinelTicketEngine, TICKET_CATEGORIES, TICKET_STATES, OPERATIONAL_MODES } = require("./src/sentinel/ticket-engine/SentinelTicketEngine");
const { MemoryEngine } = require("./src/sentinel/memory-engine/MemoryEngine");
const { ContextEngine } = require("./src/sentinel/context-engine/ContextEngine");
const { DecisionEngine, DECISION_ACTIONS } = require("./src/sentinel/decision-engine/DecisionEngine");

async function runTestSuite() {
  console.log("==================================================================");
  console.log("🧠 TEST SUITE: INTELLIGENT AGENT & CONVERSATIONAL MEMORY");
  console.log("==================================================================");

  const mem = new MemoryEngine();
  const ticketEngine = new SentinelTicketEngine(mem);
  const guildId = "1429445691452948524";
  const channelId = "1429445691452948999";
  const shutUserId = "987654321098765432";
  const freOwnerId = "111222333444555666";

  const sentMessages = [];
  const mockChannel = {
    id: channelId,
    name: "ticket-0010",
    topic: `Ticket #0010 di S.H.U.T. (${shutUserId}) | Richiesta Partnership`,
    guild: { id: guildId, name: "RoomUp!" },
    sendTyping: async () => {},
    send: async (payload) => {
      const text = typeof payload === "string" ? payload : (payload.content || "");
      sentMessages.push(text);
      return { id: "msg_" + Date.now(), channelId, content: text };
    }
  };

  // --- SECTION 1: REPRODUCTION & VERIFICATION OF S.H.U.T. BUG ---
  console.log("\n--- 1. PARTNERSHIP REPUBLICATON BUG FIX (#ticket-0010) ---");
  
  // Create ticket session in partnership state
  const session = mem.createTicketMemory(guildId, channelId, {
    ticketId: channelId,
    channelId,
    guildId,
    userId: shutUserId,
    category: TICKET_CATEGORIES.PARTNERSHIP,
    currentState: TICKET_STATES.IN_PROGRESS,
    screenshotVerified: true, // Screenshot was already verified
    partnerDescription: "Descrizione server partner",
    partnerNumber: 5,
    published: true, // Partnership #5 was already published
    partnershipPublished: true
  });

  // User S.H.U.T. writes: "non hai inviato sul canale partnership perche?"
  const mockShutMessage = {
    id: "msg_shut_1",
    guild: mockChannel.guild,
    channel: mockChannel,
    author: { id: shutUserId, username: "S.H.U.T.", bot: false },
    member: { user: { id: shutUserId, username: "S.H.U.T." }, permissions: { has: () => false }, roles: { cache: [] } },
    content: "non hai inviato sul canale partnership perche?",
    attachments: new Map()
  };

  const resShut = await ticketEngine.processTicketMessage({
    message: mockShutMessage,
    session,
    guildConfig: { ai: { enabled: true, autonomyLevel: 4 } }
  });

  console.log("  Action taken for S.H.U.T. question:", resShut.action);
  assert(resShut.handled, "Message must be handled");
  assert.strictEqual(resShut.action, "PARTNERSHIP_FOLLOWUP_ANSWERED", "Must answer follow-up instead of republishing!");
  assert.notStrictEqual(resShut.action, "PARTNERSHIP_PUBLISHED", "CRITICAL BUG: Must NEVER re-publish partnership!");
  
  const lastReply = sentMessages[sentMessages.length - 1];
  console.log("  🤖 Bot reply to S.H.U.T.:\n  " + lastReply);
  assert(lastReply.includes("partnership") || lastReply.includes("canale"), "Reply must explain the partnership situation");
  console.log("  ✅ [PASS] S.H.U.T. question answered conversationally without duplicate publication!");

  // --- SECTION 1b: VERIFICATION OF 'una domanda' SCREENSHOT BUG (#ticket-0011) ---
  console.log("\n--- 1b. 'UNA DOMANDA' & ANTI-REPETITION LOOP FIX (#ticket-0011) ---");
  
  // Turn 1: User S.H.U.T. says: "una domanda"
  const mockShutQ1 = {
    id: "msg_shut_q1",
    guild: mockChannel.guild,
    channel: mockChannel,
    author: { id: shutUserId, username: "S.H.U.T.", bot: false },
    member: { user: { id: shutUserId, username: "S.H.U.T." }, permissions: { has: () => false }, roles: { cache: [] } },
    content: "una domanda",
    attachments: new Map()
  };

  const resQ1 = await ticketEngine.processTicketMessage({
    message: mockShutQ1,
    session,
    guildConfig: { ai: { enabled: true, autonomyLevel: 4 } }
  });

  assert(resQ1.handled, "Message must be handled");
  assert.strictEqual(resQ1.action, "PARTNERSHIP_QUESTION_INVITED", "Must invite the question naturally!");
  const replyQ1 = sentMessages[sentMessages.length - 1];
  console.log("  🤖 Bot reply to 'una domanda':\n  " + replyQ1);
  assert(replyQ1.toLowerCase().includes("dimmi") || replyQ1.toLowerCase().includes("domanda"), "Must invite user to ask question");
  assert(!replyQ1.includes("è già stata approvata e pubblicata"), "Must NEVER spam canned publication string!");

  // Turn 2: User repeats with typo: "si si e ho hna domanda"
  const mockShutQ2 = {
    id: "msg_shut_q2",
    guild: mockChannel.guild,
    channel: mockChannel,
    author: { id: shutUserId, username: "S.H.U.T.", bot: false },
    member: { user: { id: shutUserId, username: "S.H.U.T." }, permissions: { has: () => false }, roles: { cache: [] } },
    content: "si si e ho hna domanda",
    attachments: new Map()
  };

  const resQ2 = await ticketEngine.processTicketMessage({
    message: mockShutQ2,
    session,
    guildConfig: { ai: { enabled: true, autonomyLevel: 4 } }
  });

  assert(resQ2.handled, "Message must be handled");
  const replyQ2 = sentMessages[sentMessages.length - 1];
  console.log("  🤖 Bot reply to 'si si e ho hna domanda':\n  " + replyQ2);
  assert.notStrictEqual(replyQ2, replyQ1, "Anti-repetition guard must vary consecutive replies!");

  // Turn 3: User writes typo: "okay si ma ho una dkamnda"
  const mockShutQ3 = {
    id: "msg_shut_q3",
    guild: mockChannel.guild,
    channel: mockChannel,
    author: { id: shutUserId, username: "S.H.U.T.", bot: false },
    member: { user: { id: shutUserId, username: "S.H.U.T." }, permissions: { has: () => false }, roles: { cache: [] } },
    content: "okay si ma ho una dkamnda",
    attachments: new Map()
  };

  const resQ3 = await ticketEngine.processTicketMessage({
    message: mockShutQ3,
    session,
    guildConfig: { ai: { enabled: true, autonomyLevel: 4 } }
  });

  assert(resQ3.handled, "Message must be handled");
  const replyQ3 = sentMessages[sentMessages.length - 1];
  console.log("  🤖 Bot reply to 'okay si ma ho una dkamnda':\n  " + replyQ3);
  assert(!replyQ3.includes("è già stata approvata e pubblicata"), "Must NEVER spam canned publication string!");
  console.log("  ✅ [PASS] 'Una domanda' & typos handled conversationally with strict anti-repetition!");

  // --- SECTION 2: FOUNDER FRÈ "che succede" BRIEFING BUG ---
  console.log("\n--- 2. FOUNDER FRÈ '@RoomUp! che succede' INTERACTION BUG ---");

  const mockFreMessage = {
    id: "msg_fre_1",
    guild: mockChannel.guild,
    channel: mockChannel,
    author: { id: freOwnerId, username: "frelerr", bot: false },
    member: {
      id: freOwnerId,
      user: { id: freOwnerId, username: "frelerr" },
      permissions: { has: (perm) => perm === "Administrator" },
      guild: mockChannel.guild,
      roles: { cache: [] }
    },
    content: "Roomup\n@RoomUp!\n@RoomUp! che succede",
    attachments: new Map(),
    mentions: { has: () => true, everyone: false }
  };

  const resFre = await ticketEngine.processTicketMessage({
    message: mockFreMessage,
    session,
    guildConfig: { ai: { enabled: true, autonomyLevel: 4 } }
  });

  console.log("  Action taken for Founder Frè inquiry:", resFre.action);
  assert(resFre.handled, "Frè's message must be handled");
  assert.strictEqual(resFre.action, "STAFF_BRIEFING_SENT", "Must send comprehensive briefing to Founder!");
  assert.notStrictEqual(resFre.action, "STAFF_MESSAGE_OBSERVED", "Must NOT silently observe when addressed!");

  const freReply = sentMessages[sentMessages.length - 1];
  console.log("  🤖 Bot reply to Frè:\n  " + freReply);
  assert(freReply.toLowerCase().includes("frè") || freReply.toLowerCase().includes("frelerr"), "Must address Founder Frè!");
  assert(freReply.toLowerCase().includes("partnership") || freReply.toLowerCase().includes("situazione"), "Must explain current status");
  console.log("  ✅ [PASS] Founder Frè received respectful, accurate status briefing!");

  // --- SECTION 3: STAFF DIRECT COMMANDS IN TICKET ---
  console.log("\n--- 3. STAFF DIRECT COMMANDS (GOAL, LEARN, CLOSE) IN TICKET ---");

  // A. Staff teaches a rule: "Roomup ricorda che i partner devono avere almeno 50 membri"
  const mockRuleMsg = {
    id: "msg_fre_2",
    guild: mockChannel.guild,
    channel: mockChannel,
    author: { id: freOwnerId, username: "frelerr", bot: false },
    member: mockFreMessage.member,
    content: "Roomup ricorda che i partner devono avere almeno 50 membri",
    attachments: new Map(),
    mentions: { has: () => false, everyone: false }
  };

  const resRule = await ticketEngine.processTicketMessage({
    message: mockRuleMsg,
    session,
    guildConfig: { ai: { enabled: true } }
  });
  assert.strictEqual(resRule.action, "STAFF_RULE_MEMORIZED", "Must memorize rule");
  const learnedRules = mem.getLearnedRules(guildId);
  assert(learnedRules.some(r => r.rule.includes("almeno 50 membri")), "Rule must be saved in MemoryEngine");
  console.log("  ✅ [PASS] Staff rule memorized and stored in persistent memory!");

  // B. Staff sets a goal: "Roomup imposta obiettivo: raggiungere 100 partnership attive"
  const mockGoalMsg = {
    id: "msg_fre_3",
    guild: mockChannel.guild,
    channel: mockChannel,
    author: { id: freOwnerId, username: "frelerr", bot: false },
    member: mockFreMessage.member,
    content: "Roomup imposta obiettivo: raggiungere 100 partnership attive",
    attachments: new Map(),
    mentions: { has: () => false, everyone: false }
  };

  const resGoal = await ticketEngine.processTicketMessage({
    message: mockGoalMsg,
    session,
    guildConfig: { ai: { enabled: true } }
  });
  assert.strictEqual(resGoal.action, "STAFF_GOAL_SET", "Must set goal");
  const activeGoals = mem.getGoals(guildId, "active");
  assert(activeGoals.some(g => g.title.includes("100 partnership attive")), "Goal must be saved in MemoryEngine");
  console.log("  ✅ [PASS] Staff goal created and tracked in MemoryEngine!");

  // C. Staff closes ticket: "Roomup chiudi il ticket"
  const mockCloseMsg = {
    id: "msg_fre_4",
    guild: mockChannel.guild,
    channel: mockChannel,
    author: { id: freOwnerId, username: "frelerr", bot: false },
    member: mockFreMessage.member,
    content: "Roomup chiudi il ticket",
    attachments: new Map(),
    mentions: { has: () => false, everyone: false }
  };

  const resClose = await ticketEngine.processTicketMessage({
    message: mockCloseMsg,
    session,
    guildConfig: { ai: { enabled: true } }
  });
  assert.strictEqual(resClose.action, "STAFF_COMMAND_CLOSE_TICKET", "Must close ticket upon staff command");
  assert([TICKET_STATES.CLOSED, TICKET_STATES.RESOLVED].includes(session.currentState), "Ticket state must be CLOSED or RESOLVED");
  console.log("  ✅ [PASS] Staff close ticket command executed cleanly!");

  // --- SECTION 4: MEMORY ENGINE /goal /learn /boost /grill-me SUITE ---
  console.log("\n--- 4. MEMORY ENGINE /goal, /learn, /boost, /grill-me CAPABILITIES ---");

  // Goals
  const g1 = mem.addGoal(guildId, { title: "Ottimizzare tempo di risposta ticket a <2m", createdBy: "Frè" });
  assert(g1.id && g1.status === "active");
  const compG = mem.completeGoal(guildId, g1.id);
  assert.strictEqual(compG.status, "completed");
  assert(compG.completedAt);
  console.log("  ✅ [PASS] Goal add & complete lifecycle verified");

  // Boost
  const boost = mem.setBoostMode(guildId, { mode: "deep_reasoning", setBy: "Frè", durationMinutes: 60 });
  assert.strictEqual(boost.enabled, true);
  assert.strictEqual(boost.mode, "deep_reasoning");
  const activeBoost = mem.getBoostMode(guildId);
  assert.strictEqual(activeBoost.mode, "deep_reasoning");
  console.log("  ✅ [PASS] Boost mode activation and expiry retrieval verified");

  // Grill-Me Socratic Sessions
  const grill = mem.startGrillSession(guildId, channelId, shutUserId, { topic: "Architettura Network", difficulty: "hard" });
  assert.strictEqual(grill.active, true);
  assert.strictEqual(grill.currentTurn, 0);

  mem.recordGrillTurn(guildId, channelId, shutUserId, {
    question: "Come gestisci un single point of failure nel database?",
    answer: "Uso replica master-slave asincrona e cluster redis per cache.",
    score: 8,
    feedback: "Buona risposta, ma considera i conflitti di split-brain."
  });

  const updatedGrill = mem.getGrillSession(guildId, channelId, shutUserId);
  assert.strictEqual(updatedGrill.currentTurn, 1);
  assert.strictEqual(updatedGrill.score, 8);
  assert.strictEqual(updatedGrill.questions.length, 1);
  assert.strictEqual(updatedGrill.answers.length, 1);

  mem.endGrillSession(guildId, channelId, shutUserId);
  const endedGrill = mem.getGrillSession(guildId, channelId, shutUserId);
  assert.strictEqual(endedGrill, null, "Inactive grill session must return null");
  console.log("  ✅ [PASS] Grill-Me multi-turn stateful interview session verified");

  // --- SECTION 5: CONTEXT & DECISION ENGINE MEMORY INTEGRATION ---
  console.log("\n--- 5. CONTEXT & DECISION ENGINE INTEGRATION ---");

  const contextEngine = new ContextEngine(undefined, mem);
  const ctx = await contextEngine.buildContext({
    event: {
      eventId: "evt_test",
      guildId,
      channelId,
      userId: shutUserId,
      type: "MESSAGE_CREATE",
      content: "Come funzionano le partnership?",
      metadata: { channelName: "chat-generale" }
    }
  });

  assert(Array.isArray(ctx.server.activeGoals), "Active goals must be in server context");
  assert(ctx.server.boostMode, "Boost mode must be in server context");
  assert(Array.isArray(ctx.server.learnedRules), "Learned rules must be in server context");
  console.log("  ✅ [PASS] ContextEngine accurately injects persistent goals, boost mode, and rules!");

  const decisionEngine = new DecisionEngine();
  // Ensure staff addressed outside ticket is NOT ignored
  const staffCtx = {
    immediate: { content: "Roomup che succede con gli obiettivi?", metadata: { isMention: true } },
    user: { isStaff: true, username: "Frè" },
    server: ctx.server,
    ticket: null
  };

  const staffDec = await decisionEngine.decide(staffCtx);
  assert.notStrictEqual(staffDec.action, DECISION_ACTIONS.IGNORE, "Must NOT ignore staff when addressed!");
  // --- SECTION 6: AI TICKET ENGINE (LEGACY SUITE) VERIFICATION ---
  console.log("\n--- 6. AI TICKET ENGINE VERIFICATION & DUPLICATE PREVENTION ---");
  const aiTicketEngine = require("./src/bot/aiTicketEngine");

  const legacySession = {
    guildId,
    userId: shutUserId,
    categoryKey: "partnership",
    state: "completed",
    approvedPartnerNumber: 5,
    status: "autonomous",
    conversationHistory: []
  };

  const legacySent = [];
  const mockLegacyChannel = {
    id: channelId,
    name: "ticket-0010",
    guild: mockChannel.guild,
    sendTyping: async () => {},
    send: async (msg) => {
      legacySent.push(typeof msg === "string" ? msg : (msg.content || ""));
      return { id: "msg_legacy_" + Date.now() };
    }
  };

  // S.H.U.T. follow-up in completed partnership: must answer, never republish
  await aiTicketEngine.handlePartnershipMessage({
    id: "msg_legacy_shut_1",
    guild: mockChannel.guild,
    channel: mockLegacyChannel,
    author: { id: shutUserId, username: "S.H.U.T.", bot: false },
    member: mockShutMessage.member,
    content: "non hai inviato sul canale partnership perche?",
    attachments: new Map()
  }, legacySession);

  assert(legacySent.length > 0, "aiTicketEngine must reply to S.H.U.T.");
  const shutLegacyReply = legacySent[legacySent.length - 1];
  console.log("  🤖 aiTicketEngine reply to S.H.U.T.:\n  " + shutLegacyReply);
  assert(shutLegacyReply.includes("partnership") || shutLegacyReply.includes("canale"), "Must explain partnership status");
  assert(!shutLegacyReply.includes("Tutto a posto! La partnership #"), "Must NOT republish partnership!");
  console.log("  ✅ [PASS] aiTicketEngine handled S.H.U.T. without duplicate publication!");

  // Founder Frè in aiTicketEngine: must get respectful briefing
  await aiTicketEngine.handlePartnershipMessage({
    id: "msg_legacy_fre_1",
    guild: mockChannel.guild,
    channel: mockLegacyChannel,
    author: { id: freOwnerId, username: "frelerr", bot: false },
    member: mockFreMessage.member,
    content: "Roomup\n@RoomUp!\n@RoomUp! che succede",
    attachments: new Map(),
    mentions: { has: () => true, everyone: false }
  }, legacySession);

  const freLegacyReply = legacySent[legacySent.length - 1];
  console.log("  🤖 aiTicketEngine reply to Frè:\n  " + freLegacyReply);
  assert(freLegacyReply.includes("Ciao Frè"), "Must address Founder Frè with respect");
  assert(freLegacyReply.includes("partnership"), "Must explain partnership status to Frè");
  console.log("  ✅ [PASS] aiTicketEngine gave Founder Frè immediate status briefing!");

  // Awaiting description guard in aiTicketEngine: question must NOT be saved as server description
  const awaitingSession = {
    guildId,
    userId: shutUserId,
    categoryKey: "partnership",
    state: "awaiting_description",
    status: "autonomous",
    conversationHistory: []
  };
  await aiTicketEngine.handlePartnershipMessage({
    id: "msg_legacy_desc_q",
    guild: mockChannel.guild,
    channel: mockLegacyChannel,
    author: { id: shutUserId, username: "S.H.U.T.", bot: false },
    member: mockShutMessage.member,
    content: "perché non inviate prima voi?",
    attachments: new Map()
  }, awaitingSession);

  assert(!awaitingSession.partnerDescription, "Question must NOT be saved as server description!");
  assert.strictEqual(awaitingSession.state, "awaiting_description", "State must remain awaiting_description!");
  console.log("  ✅ [PASS] aiTicketEngine correctly guarded awaiting_description against questions!");

  // --- SECTION 7: DECISION ENGINE FALLBACK TOOL ACTIONS ---
  console.log("\n--- 7. DECISION ENGINE COMPLETE GOAL, REMOVE GOAL & BOOST STATUS ---");

  // Complete goal fallback
  const decComp = decisionEngine.generateDeterministicFallback("!goal completa Ottimizzare tempo", null, staffCtx);
  assert.strictEqual(decComp.action, "ACT");
  assert(decComp.needsTool);
  assert.strictEqual(decComp.tools[0].name, "complete_goal");
  console.log("  ✅ [PASS] DecisionEngine fallback handles complete_goal tool action!");

  // Remove goal fallback
  const decRem = decisionEngine.generateDeterministicFallback("!goal rimuovi Vecchio obiettivo", null, staffCtx);
  assert.strictEqual(decRem.action, "ACT");
  assert(decRem.needsTool);
  assert.strictEqual(decRem.tools[0].name, "remove_goal");
  console.log("  ✅ [PASS] DecisionEngine fallback handles remove_goal tool action!");

  // Boost status fallback
  const decBoostStat = decisionEngine.generateDeterministicFallback("stato boost", null, staffCtx);
  assert.strictEqual(decBoostStat.action, "RESPOND");
  assert(decBoostStat.message.includes("Boost"));
  console.log("  ✅ [PASS] DecisionEngine fallback handles boost status inquiry!");

  // Grill-me fallback
  const decGrill = decisionEngine.generateDeterministicFallback("!grill-me Sicurezza Server", null, staffCtx);
  assert.strictEqual(decGrill.action, "ACT");
  assert(decGrill.needsTool);
  assert.strictEqual(decGrill.tools[0].name, "start_grill_session");
  console.log("  ✅ [PASS] DecisionEngine fallback handles start_grill_session tool action!");

  console.log("\n==================================================================");
  console.log("🎉 TUTTI I TEST DELLA SUITE INTELLIGENZA E MEMORIA SUPERATI (100%)");
  console.log("==================================================================");
}

runTestSuite().catch(err => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
