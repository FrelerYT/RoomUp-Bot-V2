/**
 * TEST SUITE: SENTINEL AUTONOMOUS REMAKE & E2E VERIFICATION
 * 
 * Tests 1 to 8 + Negative Tests:
 * - TEST 1: Staff Takeover & AI Passive Silence
 * - TEST 2: AI Handover & Resume
 * - TEST 3: Directives without Staff Leakage
 * - TEST 4: Staff Close Ticket with ToolEngine & ActionVerifier
 * - TEST 5: Staff Reopen Ticket with ToolEngine & ActionVerifier
 * - TEST 6: Rule Learning & Application in Subsequent Tickets
 * - TEST 7: Concurrency & In-Flight Response Cancellation
 * - TEST 8: Closed Ticket Isolation
 * - NEGATIVE TEST 1: User Unauthorized Close Request
 * - NEGATIVE TEST 2: User Unauthorized Handover / Resume
 * - NEGATIVE TEST 3: ActionGuard Checkpoint 0 blocks mutations on Closed Ticket
 */

const assert = require("assert");
const {
  SentinelCore,
  defaultSentinelCore,
  defaultMemoryEngine,
  defaultLearningEngine,
  defaultActionGuard,
  defaultToolEngine,
  defaultActionVerifier,
  defaultTicketConcurrencyManager,
  defaultCommandIntentDetector,
  SentinelTicketEngine,
  TICKET_STATES,
  OPERATIONAL_MODES
} = require("./src/sentinel");

async function runAutonomousRemakeTests() {
  console.log("==================================================================");
  console.log("🛡️ AVVIO TEST SUITE: SENTINEL AI AUTONOMOUS REMAKE (E2E & AUDIT)");
  console.log("==================================================================\n");

  const guildId = "guild_remake_test_123";
  const channelId = "chan_remake_ticket_456";
  const userId = "user_victim_789";

  const sentMessages = [];
  let channelDeleted = false;

  const mockChannel = {
    id: channelId,
    name: "ticket-0042",
    guild: { id: guildId, name: "Test Guild" },
    send: async (msg) => {
      const content = typeof msg === "string" ? msg : (msg.content || "");
      sentMessages.push(content);
      return { id: "msg_" + Date.now(), content, channelId };
    },
    sendTyping: async () => {},
    delete: async (reason) => {
      channelDeleted = true;
      return true;
    }
  };

  const mockClient = {
    user: { id: "bot_sentinel_007" },
    channels: {
      cache: new Map([[channelId, mockChannel]]),
      fetch: async (id) => (id === channelId ? mockChannel : null)
    }
  };

  defaultToolEngine.setClient(mockClient);

  const staffUser = { id: "staff_samuele_111", username: "samuelecosso" };
  const regularUser = { id: userId, username: "PlayerOne" };

  // Setup Initial Ticket
  defaultMemoryEngine.createTicketMemory(guildId, channelId, {
    ticketId: "tkt_456",
    channelId,
    userId,
    category: "SUPPORT",
    problem: "Errore durante l'accesso al server",
    userGoal: "Risolvere errore",
    currentState: TICKET_STATES.IN_PROGRESS,
    mode: OPERATIONAL_MODES.AI_ACTIVE,
    conversationHistory: [
      { role: "user", text: "Salve, ricevo un errore strano quando provo ad accedere al server." }
    ]
  });

  const ticketEngine = new SentinelTicketEngine(
    defaultMemoryEngine,
    defaultLearningEngine,
    undefined,
    undefined,
    defaultToolEngine,
    defaultActionGuard,
    defaultActionVerifier,
    undefined,
    defaultTicketConcurrencyManager,
    defaultCommandIntentDetector
  );

  // --- TEST 1: Staff Takeover & AI Passive Silence ---
  console.log("--- TEST 1: Staff Takeover & AI Passive Silence ---");
  sentMessages.length = 0;
  const takeoverMsg = {
    author: staffUser,
    content: "No faccio io",
    channel: mockChannel,
    guild: mockChannel.guild,
    client: mockClient,
    member: { user: staffUser, permissions: { has: () => true } }
  };

  const takeoverRes = await ticketEngine.processTicketMessage({ message: takeoverMsg, session: defaultMemoryEngine.getTicketMemory(guildId, channelId) });
  assert.strictEqual(takeoverRes.action, "TAKEOVER_ACKNOWLEDGED", "Takeover should be acknowledged");

  let session = defaultMemoryEngine.getTicketMemory(guildId, channelId);
  assert.strictEqual(session.currentState, TICKET_STATES.STAFF_TAKEOVER);
  assert.strictEqual(sentMessages.length, 0, "Bot MUST remain 100% silent (0 messages sent) on takeover");

  // Silence verification: Staff speaks to user -> Bot must stay silent
  sentMessages.length = 0;
  const staffChatMsg = {
    author: staffUser,
    content: "Ciao PlayerOne, dimmi che errore ti compare.",
    channel: mockChannel,
    guild: mockChannel.guild,
    client: mockClient,
    member: { user: staffUser, permissions: { has: () => true } }
  };
  const staffChatRes = await ticketEngine.processTicketMessage({ message: staffChatMsg, session });
  assert.strictEqual(staffChatRes.action, "STAFF_MESSAGE_OBSERVED");
  assert.strictEqual(sentMessages.length, 0, "Bot MUST NOT reply while staff is in takeover mode");

  // Silence verification: User replies while staff is active -> Bot must stay passive
  const userChatMsg = {
    author: regularUser,
    content: "Mi esce connection refused porta 19132",
    channel: mockChannel,
    guild: mockChannel.guild,
    client: mockClient,
    member: { user: regularUser, permissions: { has: () => false } }
  };
  const userPassiveRes = await ticketEngine.processTicketMessage({ message: userChatMsg, session });
  assert.strictEqual(userPassiveRes.action, "AI_PASSIVE");
  assert.strictEqual(sentMessages.length, 0, "Bot MUST NOT reply to user while staff is handling ticket");
  console.log("  ✅ [PASS] TEST 1: Staff takeover switches state and guarantees 100% silence.\n");

  // --- TEST 2: AI Handover & Resume ---
  console.log("--- TEST 2: AI Handover & Resume ---");
  sentMessages.length = 0;
  const handoverMsg = {
    author: staffUser,
    content: "continua tu",
    channel: mockChannel,
    guild: mockChannel.guild,
    client: mockClient,
    member: { user: staffUser, permissions: { has: () => true } }
  };

  const handoverRes = await ticketEngine.processTicketMessage({ message: handoverMsg, session });
  assert.strictEqual(handoverRes.action, "HANDOVER_RESUMED");
  session = defaultMemoryEngine.getTicketMemory(guildId, channelId);
  assert.strictEqual(session.currentState, TICKET_STATES.AI_ACTIVE);
  assert.strictEqual(session.mode, OPERATIONAL_MODES.AI_ACTIVE);
  assert.strictEqual(sentMessages.length, 1);
  assert(sentMessages[0].toLowerCase().includes("riprendo"), "Bot must acknowledge resumption");
  console.log("  ✅ [PASS] TEST 2: Handover successfully restores AI_ACTIVE state.\n");

  // --- TEST 3: Directives without Staff Leakage ---
  console.log("--- TEST 3: Directives without Staff Leakage ---");
  sentMessages.length = 0;
  const directiveMsg = {
    author: staffUser,
    content: "chiedigli uno screen della schermata di errore",
    channel: mockChannel,
    guild: mockChannel.guild,
    client: mockClient,
    member: { user: staffUser, permissions: { has: () => true } }
  };

  const directiveRes = await ticketEngine.processTicketMessage({ message: directiveMsg, session });
  assert.strictEqual(directiveRes.action, "DIRECTIVE_EXECUTED");
  assert.strictEqual(sentMessages.length, 1);
  const directiveBotReply = sentMessages[0];
  console.log("  🤖 Directive Translation:", directiveBotReply);
  assert(!directiveBotReply.toLowerCase().includes("lo staff mi ha detto"), "Must not leak 'lo staff mi ha detto'");
  assert(!directiveBotReply.toLowerCase().includes("mi hanno chiesto"), "Must not leak 'mi hanno chiesto'");
  assert(!directiveBotReply.toLowerCase().includes("il moderatore"), "Must not leak 'il moderatore'");
  console.log("  ✅ [PASS] TEST 3: Directive translated into 2nd-person without leaking staff attribution.\n");

  // --- TEST 4: Staff Close Ticket with ToolEngine & ActionVerifier ---
  console.log("--- TEST 4: Staff Close Ticket with ToolEngine & ActionVerifier ---");
  sentMessages.length = 0;
  const closeMsg = {
    author: staffUser,
    content: "chiudi ticket",
    channel: mockChannel,
    guild: mockChannel.guild,
    client: mockClient,
    member: { user: staffUser, permissions: { has: () => true } }
  };

  const closeRes = await ticketEngine.processTicketMessage({ message: closeMsg, session });
  assert.strictEqual(closeRes.action, "STAFF_COMMAND_CLOSE_TICKET");
  assert(closeRes.execution && closeRes.execution.success, "ToolEngine executeTool('close_ticket') must succeed");
  assert(closeRes.verification && closeRes.verification.verified, "ActionVerifier must verify close_ticket");

  session = defaultMemoryEngine.getTicketMemory(guildId, channelId);
  assert.strictEqual(session.currentState, TICKET_STATES.CLOSED, "Ticket state must be CLOSED");
  assert.strictEqual(session.mode, OPERATIONAL_MODES.RESOLVED);
  console.log("  ✅ [PASS] TEST 4: Real close_ticket tool executed and verified, state is CLOSED.\n");

  // --- TEST 8: Closed Ticket Isolation (Tested right after close) ---
  console.log("--- TEST 8: Closed Ticket Isolation ---");
  sentMessages.length = 0;
  const postCloseUserMsg = {
    author: regularUser,
    content: "Ehi bot ci sei ancora? Ho un'altra domanda.",
    channel: mockChannel,
    guild: mockChannel.guild,
    client: mockClient,
    member: { user: regularUser, permissions: { has: () => false } }
  };
  const closedBlockedRes = await ticketEngine.processTicketMessage({ message: postCloseUserMsg, session });
  assert.strictEqual(closedBlockedRes.action, "TICKET_CLOSED_BLOCKED");
  assert.strictEqual(sentMessages.length, 0, "No messages should be sent on closed tickets");

  const postCloseStaffMsg = {
    author: staffUser,
    content: "Un messaggio qualunque dello staff",
    channel: mockChannel,
    guild: mockChannel.guild,
    client: mockClient,
    member: { user: staffUser, permissions: { has: () => true } }
  };
  const closedBlockedStaffRes = await ticketEngine.processTicketMessage({ message: postCloseStaffMsg, session });
  assert.strictEqual(closedBlockedStaffRes.action, "TICKET_CLOSED_BLOCKED");
  assert.strictEqual(sentMessages.length, 0, "Non-reopen staff messages are blocked on closed tickets");
  console.log("  ✅ [PASS] TEST 8: Closed ticket isolation blocks all messages and stays dormant.\n");

  // --- TEST 5: Staff Reopen Ticket with ToolEngine & ActionVerifier ---
  console.log("--- TEST 5: Staff Reopen Ticket with ToolEngine & ActionVerifier ---");
  sentMessages.length = 0;
  const reopenMsg = {
    author: staffUser,
    content: "riapri ticket",
    channel: mockChannel,
    guild: mockChannel.guild,
    client: mockClient,
    member: { user: staffUser, permissions: { has: () => true } }
  };

  const reopenRes = await ticketEngine.processTicketMessage({ message: reopenMsg, session: defaultMemoryEngine.getTicketMemory(guildId, channelId) });
  assert.strictEqual(reopenRes.action, "STAFF_COMMAND_REOPEN_TICKET");
  assert(reopenRes.execution && reopenRes.execution.success, "ToolEngine executeTool('reopen_ticket') must succeed");
  assert(reopenRes.verification && reopenRes.verification.verified, "ActionVerifier must verify reopen_ticket");

  session = defaultMemoryEngine.getTicketMemory(guildId, channelId);
  assert.strictEqual(session.currentState, TICKET_STATES.IN_PROGRESS);
  assert.strictEqual(session.mode, OPERATIONAL_MODES.AI_ACTIVE);
  assert.strictEqual(session.resolution, null);
  assert(sentMessages.length >= 1, "Bot sends reopen confirmation");
  console.log("  ✅ [PASS] TEST 5: Reopen tool executed and verified, ticket restored to active.\n");

  // --- TEST 6: Rule Learning & Application in Subsequent Tickets ---
  console.log("--- TEST 6: Rule Learning & Application in Subsequent Tickets ---");
  sentMessages.length = 0;
  const teachRuleMsg = {
    author: staffUser,
    content: "Per questo tipo di problema chiediamo sempre uno screenshot chiaro della schermata di errore",
    channel: mockChannel,
    guild: mockChannel.guild,
    client: mockClient,
    member: { user: staffUser, permissions: { has: () => true } }
  };

  const teachRes = await ticketEngine.processTicketMessage({ message: teachRuleMsg, session });
  assert.strictEqual(teachRes.action, "STAFF_RULE_MEMORIZED");

  const learnedRules = defaultMemoryEngine.getLearnedRules(guildId);
  assert(learnedRules.length > 0, "Learned rules must contain newly added rule");
  const storedRule = learnedRules[learnedRules.length - 1];
  assert(storedRule.triggerKeywords.includes("screen") || storedRule.triggerKeywords.includes("errore"), "Trigger keywords must be captured");

  // Simulate SUBSEQUENT TICKET with matching issue
  const newChannelId = "chan_subsequent_tkt_777";
  const newMockChannel = {
    id: newChannelId,
    name: "ticket-0099",
    guild: { id: guildId, name: "Test Guild" },
    send: async (msg) => {
      const content = typeof msg === "string" ? msg : (msg.content || "");
      sentMessages.push(content);
      return { id: "msg_" + Date.now(), content, channelId: newChannelId };
    },
    sendTyping: async () => {}
  };

  const newSession = defaultMemoryEngine.createTicketMemory(guildId, newChannelId, {
    ticketId: "tkt_999",
    channelId: newChannelId,
    userId: "new_user_888",
    category: "SUPPORT",
    problem: "Errore di connessione",
    currentState: TICKET_STATES.IN_PROGRESS,
    mode: OPERATIONAL_MODES.AI_ACTIVE
  });

  sentMessages.length = 0;
  const newUserProblemMsg = {
    author: { id: "new_user_888", username: "NewUser" },
    content: "Ho un errore strano quando provo a loggare",
    channel: newMockChannel,
    guild: newMockChannel.guild,
    client: mockClient,
    member: { user: { id: "new_user_888" }, permissions: { has: () => false } }
  };

  const ruleAppliedRes = await ticketEngine.processTicketMessage({ message: newUserProblemMsg, session: newSession });
  assert.strictEqual(ruleAppliedRes.action, "APPLIED_LEARNED_RULE", "Learned rule must take precedence");
  assert(sentMessages.length > 0);
  assert(sentMessages[0].toLowerCase().includes("screenshot"), "Bot reply must execute the learned procedure asking for screenshot");
  console.log("  🤖 Rule-based autonomous response:", sentMessages[0]);
  console.log("  ✅ [PASS] TEST 6: Rule memorized and successfully applied to subsequent matching ticket.\n");

  // --- TEST 7: Concurrency & In-Flight Response Cancellation ---
  console.log("--- TEST 7: Concurrency & In-Flight Response Cancellation ---");
  const concurrencyChanId = "chan_concurrency_999";
  defaultMemoryEngine.createTicketMemory(guildId, concurrencyChanId, {
    ticketId: "tkt_conc",
    channelId: concurrencyChanId,
    userId: "user_conc",
    currentState: TICKET_STATES.IN_PROGRESS,
    mode: OPERATIONAL_MODES.AI_ACTIVE
  });

  // Create an in-flight token simulating ongoing AI work
  const token = defaultTicketConcurrencyManager.createCancellationToken(guildId, concurrencyChanId);
  assert.strictEqual(token.isCancelled, false);

  // Staff takes over while in flight
  defaultTicketConcurrencyManager.cancelPendingForTicket(guildId, concurrencyChanId, "Staff took over");
  assert.strictEqual(token.isCancelled, true, "In-flight token must be cancelled immediately");

  // Verify stale sendTicketReply check blocks the response
  const staleChannel = {
    id: concurrencyChanId,
    guild: { id: guildId },
    send: async () => {
      throw new Error("Stale reply should never be sent to channel!");
    }
  };
  defaultMemoryEngine.updateTicketMemory(guildId, concurrencyChanId, {
    currentState: TICKET_STATES.STAFF_TAKEOVER,
    mode: OPERATIONAL_MODES.STAFF_ACTIVE
  });
  const staleSession = defaultMemoryEngine.getTicketMemory(guildId, concurrencyChanId);
  const staleResult = await ticketEngine.sendTicketReply(staleChannel, staleSession, "Risposta tardiva dell'AI");
  assert.strictEqual(staleResult, null, "sendTicketReply must return null and abort sending");
  console.log("  ✅ [PASS] TEST 7: In-flight token cancelled and stale response blocked before sending.\n");

  // --- NEGATIVE TESTS ---
  console.log("--- NEGATIVE TESTS ---");

  // Negative Test 1: Unauthorized user close attempt
  sentMessages.length = 0;
  const unauthorizedCloseMsg = {
    author: regularUser,
    content: "chiudi il ticket",
    channel: mockChannel,
    guild: mockChannel.guild,
    client: mockClient,
    member: { user: regularUser, permissions: { has: () => false } }
  };
  const negCloseRes = await ticketEngine.processTicketMessage({ message: unauthorizedCloseMsg, session: defaultMemoryEngine.getTicketMemory(guildId, channelId) });
  assert.strictEqual(negCloseRes.action, "USER_CLOSE_UNAUTHORIZED", "User should not be authorized to close ticket");
  assert(sentMessages[0].toLowerCase().includes("solo i membri dello staff"), "Bot must explain authorization");
  console.log("  ✅ [PASS] Negative Test 1: Regular user close attempt safely rejected.");

  // Negative Test 2: Unauthorized user resume attempt
  const unauthorizedResumeMsg = {
    author: regularUser,
    content: "continua tu",
    channel: mockChannel,
    guild: mockChannel.guild,
    client: mockClient,
    member: { user: regularUser, permissions: { has: () => false } }
  };
  const negResumeRes = await ticketEngine.processTicketMessage({ message: unauthorizedResumeMsg, session: defaultMemoryEngine.getTicketMemory(guildId, channelId) });
  assert.strictEqual(negResumeRes.action, "USER_RESUME_UNAUTHORIZED", "User should not be authorized to resume AI");
  console.log("  ✅ [PASS] Negative Test 2: Regular user resume attempt safely rejected.");

  // Negative Test 3: ActionGuard Checkpoint 0 blocks mutations on CLOSED ticket
  defaultMemoryEngine.updateTicketMemory(guildId, channelId, { currentState: TICKET_STATES.CLOSED });
  const guardBlocked = await defaultActionGuard.check({
    guildId,
    channelId,
    toolName: "send_message",
    params: { content: "Unsolicited message" }
  });
  assert.strictEqual(guardBlocked.allowed, false);
  assert.strictEqual(guardBlocked.checkpoint, 0);
  console.log("  ✅ [PASS] Negative Test 3: ActionGuard Checkpoint 0 blocks execution on CLOSED tickets.");

  // Negative Test 4: Regular user takeover attempt is safely ignored
  defaultMemoryEngine.updateTicketMemory(guildId, channelId, { currentState: TICKET_STATES.IN_PROGRESS, mode: OPERATIONAL_MODES.AI_ACTIVE });
  const unauthorizedTakeoverMsg = {
    author: regularUser,
    content: "faccio io",
    channel: mockChannel,
    guild: mockChannel.guild,
    client: mockClient,
    member: { user: regularUser, permissions: { has: () => false } }
  };
  const negTakeoverRes = await ticketEngine.processTicketMessage({ message: unauthorizedTakeoverMsg, session: defaultMemoryEngine.getTicketMemory(guildId, channelId) });
  assert.strictEqual(negTakeoverRes.action, "USER_TAKEOVER_IGNORED", "User should not be allowed to take over ticket");
  console.log("  ✅ [PASS] Negative Test 4: Regular user takeover attempt safely ignored.");

  // Negative Test 5: ActionGuard blocks close_ticket on non-ticket channel (e.g. general)
  const nonTicketGuard = await defaultActionGuard.check({
    guildId,
    channelId: "general_chan_999",
    toolName: "close_ticket",
    params: { channelId: "general_chan_999" }
  });
  assert.strictEqual(nonTicketGuard.allowed, false);
  assert.strictEqual(nonTicketGuard.checkpoint, 0);
  assert(nonTicketGuard.reason.includes("non-ticket"), "Non-ticket channel close must be rejected");
  console.log("  ✅ [PASS] Negative Test 5: ActionGuard Checkpoint 0 prevents closing non-ticket channels.");

  // User confirmed resolution works
  sentMessages.length = 0;
  defaultMemoryEngine.updateTicketMemory(guildId, channelId, { currentState: TICKET_STATES.IN_PROGRESS, mode: OPERATIONAL_MODES.AI_ACTIVE });
  const userResolvedMsg = {
    author: regularUser,
    content: "ho risolto, grazie mille funziona!",
    channel: mockChannel,
    guild: mockChannel.guild,
    client: mockClient,
    member: { user: regularUser, permissions: { has: () => false } }
  };
  const resolvedRes = await ticketEngine.processTicketMessage({ message: userResolvedMsg, session: defaultMemoryEngine.getTicketMemory(guildId, channelId) });
  assert.strictEqual(resolvedRes.action, "TICKET_RESOLVED_CLOSE");
  const finalClosedSession = defaultMemoryEngine.getTicketMemory(guildId, channelId);
  assert.strictEqual(finalClosedSession.currentState, TICKET_STATES.CLOSED);
  console.log("  ✅ [PASS] User resolution confirmation cleanly triggers close_ticket.\n");

  console.log("==================================================================");
  console.log("🎉 TUTTI I TEST DI AUTONOMOUS REMAKE SUPERATI AL 100%!");
  console.log("==================================================================");
}

runAutonomousRemakeTests().catch(err => {
  console.error("\n❌ TEST SUITE FAILED:", err);
  process.exit(1);
});
