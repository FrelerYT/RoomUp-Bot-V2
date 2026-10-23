/**
 * TEST SUITE: Founder Frè Directives & Ticket Takeover
 * 
 * Verifies:
 * 1. Frè's directive: "Ah roomup ricordati vedere sempre che non sia un server nsfw o con contenuti un po brutti se capisci @RoomUp!"
 *    -> Must detect STAFF_TEACH_RULE
 *    -> Must memorize rule in MemoryEngine & KnowledgeEngine
 *    -> Must reply acknowledging the rule
 * 2. Frè's takeover: "Io sto gestendo il ticket"
 *    -> Must detect STAFF_TAKEOVER
 *    -> Must transition to STAFF_TAKEOVER & STAFF_ACTIVE
 *    -> Must reply confirming takeover and yielding control
 * 3. Mention greeting guard:
 *    -> In ticket, mentioning @roomup must NEVER tell staff/founder "dimmi pure come posso supportarti nel ticket"
 *    -> Must acknowledge staff as colleague monitoring the user's ticket
 */

const assert = require("assert");
const { CommandIntentDetector, INTENT_TYPES } = require("./src/sentinel/ticket-engine/CommandIntentDetector");
const { SentinelTicketEngine, TICKET_STATES, OPERATIONAL_MODES } = require("./src/sentinel/ticket-engine/SentinelTicketEngine");
const { MemoryEngine } = require("./src/sentinel/memory-engine/MemoryEngine");
const { KnowledgeEngine } = require("./src/sentinel/knowledge-engine/KnowledgeEngine");
const { LearningEngine } = require("./src/sentinel/learning-engine/LearningEngine");

async function runTest() {
  console.log("==================================================================");
  console.log("🧪 TEST SUITE: FOUNDER FRÈ DIRECTIVES & TICKET COMPREHENSION");
  console.log("==================================================================");

  const detector = new CommandIntentDetector();
  const mem = new MemoryEngine();
  const knowledge = new KnowledgeEngine();
  const learning = new LearningEngine();
  const ticketEngine = new SentinelTicketEngine(mem, {
    knowledgeEngine: knowledge,
    learningEngine: learning
  });

  const guildId = "1429445691452948524";
  const channelId = "1429445691452948999";
  const shutUserId = "1007620938700959784";
  const freOwnerId = "1543608170327445634";

  const sentMessages = [];
  const mockChannel = {
    id: channelId,
    name: "ticket-0014",
    topic: `Ticket #0014 di S.H.U.T. (${shutUserId}) | Richiesta Partnership`,
    guild: { id: guildId, name: "RoomUp!" },
    sendTyping: async () => {},
    send: async (payload) => {
      const text = typeof payload === "string" ? payload : (payload.content || "");
      sentMessages.push(text);
      return { id: "msg_" + Date.now(), channelId, content: text };
    }
  };

  // 1. Test Intent Detection on Frè's Exact String
  console.log("\n--- 1. INTENT DETECTION ON FRÈ DIRECTIVE ---");
  const freDirectiveText = "Ah roomup ricordati vedere sempre che non sia un server nsfw o con contenuti un po brutti se capisci @RoomUp!";
  const detectedDirective = detector.detectIntent(freDirectiveText);
  console.log("  Detected Intent:", detectedDirective.type);
  assert.strictEqual(detectedDirective.type, INTENT_TYPES.STAFF_TEACH_RULE, "Must detect STAFF_TEACH_RULE");
  console.log("  ✅ [PASS] Directive intent correctly detected!");

  // 2. Test Intent Detection on Takeover
  console.log("\n--- 2. INTENT DETECTION ON STAFF TAKEOVER ---");
  const freTakeoverText = "Io sto gestendo il ticket";
  const detectedTakeover = detector.detectIntent(freTakeoverText);
  console.log("  Detected Intent:", detectedTakeover.type);
  assert.strictEqual(detectedTakeover.type, INTENT_TYPES.STAFF_TAKEOVER, "Must detect STAFF_TAKEOVER");
  console.log("  ✅ [PASS] Takeover intent correctly detected!");

  // 3. Test Full Execution of Directive in Ticket Session
  console.log("\n--- 3. FULL EXECUTION OF DIRECTIVE IN TICKET ---");
  const session = mem.createTicketMemory(guildId, channelId, {
    ticketId: channelId,
    channelId,
    userId: shutUserId,
    category: "partnership",
    problem: "Richiesta Partnership",
    currentState: TICKET_STATES.IN_PROGRESS,
    mode: OPERATIONAL_MODES.AI_ACTIVE
  });

  const mockFreMember = {
    id: freOwnerId,
    user: { id: freOwnerId, username: "frelerr" },
    permissions: { has: () => true },
    roles: { cache: new Map() }
  };

  const freDirectiveMessage = {
    id: "msg_fre_dir_1",
    guild: mockChannel.guild,
    channel: mockChannel,
    author: { id: freOwnerId, username: "frelerr", bot: false },
    member: mockFreMember,
    content: freDirectiveText,
    mentions: { users: new Map([[ "bot_id", { id: "bot_id", username: "RoomUp!" } ]]), everyone: false }
  };

  const guildConfig = {
    roles: { adminRoles: ["admin_role"], staffRoles: ["staff_role"] },
    ownerId: freOwnerId
  };

  const dirResult = await ticketEngine.processTicketMessage({
    message: freDirectiveMessage,
    session,
    guildConfig
  });
  console.log("  Directive execution result:", dirResult.action);
  assert.strictEqual(dirResult.handled, true);
  assert.strictEqual(dirResult.action, "STAFF_RULE_MEMORIZED");

  const rules = mem.getLearnedRules(guildId);
  console.log("  Learned rules count:", rules.length);
  assert(rules.length > 0, "Rule must be saved in MemoryEngine");
  const lastRule = rules[rules.length - 1];
  console.log("  Saved rule:", lastRule);
  assert.strictEqual(lastRule.category, "PARTNERSHIP", "Rule category must be PARTNERSHIP");

  assert(sentMessages.length > 0, "Bot must send confirmation reply");
  const lastBotReply = sentMessages[sentMessages.length - 1];
  console.log("  🤖 Bot reply to Frè:\n  " + lastBotReply);
  assert(lastBotReply.includes("Ciao Frè") || lastBotReply.includes("Ricevuto Frè"), "Must address Frè respectfully");
  assert(lastBotReply.toLowerCase().includes("nsfw"), "Must mention NSFW verification");
  console.log("  ✅ [PASS] Directive executed, rule memorized, and confirmed!");

  // 4. Test Takeover Execution in Ticket
  console.log("\n--- 4. FULL EXECUTION OF TAKEOVER IN TICKET ---");
  const freTakeoverMessage = {
    id: "msg_fre_takeover_1",
    guild: mockChannel.guild,
    channel: mockChannel,
    author: { id: freOwnerId, username: "frelerr", bot: false },
    member: mockFreMember,
    content: freTakeoverText,
    mentions: { users: new Map(), everyone: false }
  };

  const takeoverResult = await ticketEngine.processTicketMessage({
    message: freTakeoverMessage,
    session,
    guildConfig
  });
  console.log("  Takeover execution result:", takeoverResult.action);
  assert.strictEqual(takeoverResult.handled, true);
  assert.strictEqual(takeoverResult.action, "TAKEOVER_ACKNOWLEDGED");

  const updatedSession = mem.getTicketMemory(guildId, channelId);
  console.log("  Ticket Mode:", updatedSession.mode, "| State:", updatedSession.currentState);
  assert.strictEqual(updatedSession.mode, OPERATIONAL_MODES.STAFF_ACTIVE, "Mode must be STAFF_ACTIVE");
  assert.strictEqual(updatedSession.currentState, TICKET_STATES.STAFF_TAKEOVER, "State must be STAFF_TAKEOVER");

  const takeoverReply = sentMessages[sentMessages.length - 1];
  console.log("  🤖 Bot reply to Takeover:\n  " + takeoverReply);
  assert(takeoverReply.includes("ti lascio la gestione del ticket"), "Must confirm yielding management to staff");
  assert(takeoverReply.includes("silenzioso"), "Must confirm remaining in silence");
  console.log("  ✅ [PASS] Takeover yielded management and confirmed politely!");

  // 5. Test Mention Greeting Guard
  console.log("\n--- 5. MENTION GREETING GUARD ---");
  // Reset session to active
  session.mode = OPERATIONAL_MODES.AI_ACTIVE;
  session.currentState = TICKET_STATES.IN_PROGRESS;

  const freCallMessage = {
    id: "msg_fre_call_1",
    guild: mockChannel.guild,
    channel: mockChannel,
    author: { id: freOwnerId, username: "frelerr", bot: false },
    member: mockFreMember,
    content: "@RoomUp! ciao ci sei?",
    mentions: { users: new Map([[ "bot_id", { id: "bot_id" } ]]), everyone: false }
  };

  const callResult = await ticketEngine.processTicketMessage({
    message: freCallMessage,
    session,
    guildConfig
  });
  const callReply = sentMessages[sentMessages.length - 1];
  console.log("  🤖 Bot reply to Frè greeting:\n  " + callReply);
  assert(!callReply.includes("supportarti nel ticket"), "Must NEVER offer ticket support to staff/founder!");
  assert(!callReply.includes("il tuo ticket"), "Must NEVER call it the staff's ticket!");
  assert(callReply.includes("partnership") || callReply.includes("monitorando") || callReply.includes(shutUserId), "Must explain situation of user's ticket");
  console.log("  ✅ [PASS] Bot addressed Founder Frè as colleague monitoring user's ticket!");

  console.log("\n==================================================================");
  console.log("🎉 ALL TESTS PASSED! FOUNDER FRÈ DIRECTIVES & TAKEOVER VERIFIED 100%");
  console.log("==================================================================");
}

runTest().catch((err) => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
