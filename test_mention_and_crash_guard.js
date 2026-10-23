/**
 * TEST SUITE: BOT MENTION (@roomup) & PROCESS RESILIENCE GUARDS
 */
const assert = require("assert");
const { SentinelTicketEngine, TICKET_CATEGORIES, TICKET_STATES } = require("./src/sentinel/ticket-engine/SentinelTicketEngine");
const { MemoryEngine } = require("./src/sentinel/memory-engine/MemoryEngine");
const { DecisionEngine } = require("./src/sentinel/decision-engine/DecisionEngine");
const { registerProcessCrashGuards } = require("./src/bot/client");
registerProcessCrashGuards();

async function runTests() {
  console.log("==================================================================");
  console.log("🧪 TEST SUITE: @roomup DIRECT ADDRESS & CRASH RESILIENCE");
  console.log("==================================================================");

  let passed = 0;
  let failed = 0;

  function test(name, condition) {
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } else {
      console.log(`  ❌ [FAIL] ${name}`);
      failed++;
    }
  }

  const guildId = "1429445691452948524";
  const channelId = "1429445691452948999";
  const freOwnerId = "1007620938700959784";
  const staffUserId = "111222333444555666";
  const regularUserId = "987654321098765432";
  const botId = "1543608170327445634";

  const mem = new MemoryEngine();
  const ticketEngine = new SentinelTicketEngine(mem);
  const decisionEngine = new DecisionEngine();

  const sentMessages = [];
  const mockChannel = {
    id: channelId,
    name: "ticket-0010",
    guild: { id: guildId, name: "RoomUp!" },
    sendTyping: async () => {},
    send: async (payload) => {
      const text = typeof payload === "string" ? payload : (payload.content || "");
      sentMessages.push(text);
      return { id: "msg_" + Date.now(), channelId, content: text };
    }
  };

  const session = mem.createTicketMemory(guildId, channelId, {
    ticketId: channelId,
    channelId,
    guildId,
    userId: regularUserId,
    category: TICKET_CATEGORIES.GENERAL,
    currentState: TICKET_STATES.IN_PROGRESS
  });

  // --- TEST 1: Founder Frè says "@roomup" in ticket ---
  console.log("\n--- 1. Founder Frè (@roomup / @RoomUp!) inside ticket ---");
  const freMsg = {
    id: "m_fre_1",
    guild: mockChannel.guild,
    channel: mockChannel,
    author: { id: freOwnerId, username: "frelerr", bot: false },
    member: {
      id: freOwnerId,
      user: { id: freOwnerId, username: "frelerr" },
      permissions: { has: (p) => p === "Administrator" },
      roles: { cache: [] }
    },
    content: "@roomup",
    attachments: new Map(),
    mentions: { users: new Map([[botId, { id: botId }]]), everyone: false },
    client: { user: { id: botId } }
  };

  const resFre = await ticketEngine.processTicketMessage({
    message: freMsg,
    session,
    guildConfig: { ai: { enabled: true } }
  });

  test("Frè @roomup is handled (not ignored as silent staff message)", resFre.handled === true);
  test("Action is STAFF_DIRECT_REPLY", resFre.action === "STAFF_DIRECT_REPLY");
  const lastReplyFre = sentMessages[sentMessages.length - 1] || "";
  test("Reply warmly addresses Founder Frè", lastReplyFre.toLowerCase().includes("frè") || lastReplyFre.toLowerCase().includes("frelerr"));
  console.log("  Bot reply to Frè:", lastReplyFre);

  // --- TEST 2: Founder Frè says "@RoomUp! ciao ci sei?" in ticket ---
  console.log("\n--- 2. Founder Frè greeting with text inside ticket ---");
  const freMsg2 = {
    ...freMsg,
    id: "m_fre_2",
    content: "@RoomUp! ciao ci sei?"
  };

  const resFre2 = await ticketEngine.processTicketMessage({
    message: freMsg2,
    session,
    guildConfig: { ai: { enabled: true } }
  });

  test("Frè greeting is handled", resFre2.handled === true);
  const lastReplyFre2 = sentMessages[sentMessages.length - 1] || "";
  const acknowledgesPresence = (lastReplyFre2.toLowerCase().includes("frè") || lastReplyFre2.toLowerCase().includes("frelerr")) &&
    (lastReplyFre2.toLowerCase().includes("operativo") || lastReplyFre2.toLowerCase().includes("ci sono") || lastReplyFre2.toLowerCase().includes("eccomi") || lastReplyFre2.toLowerCase().includes("online"));
  test("Reply acknowledges presence to Frè", acknowledgesPresence);
  console.log("  Bot reply to Frè greeting:", lastReplyFre2);

  // --- TEST 3: Other Staff member says "@roomup" in ticket ---
  console.log("\n--- 3. Other Staff member @roomup inside ticket ---");
  const staffMsg = {
    id: "m_staff_1",
    guild: mockChannel.guild,
    channel: mockChannel,
    author: { id: staffUserId, username: "StaffMember", bot: false },
    member: {
      id: staffUserId,
      user: { id: staffUserId, username: "StaffMember" },
      permissions: { has: (p) => p === "ManageMessages" },
      roles: { cache: [] }
    },
    content: "@roomup",
    attachments: new Map(),
    mentions: { users: new Map([[botId, { id: botId }]]), everyone: false },
    client: { user: { id: botId } }
  };

  const resStaff = await ticketEngine.processTicketMessage({
    message: staffMsg,
    session,
    guildConfig: { ai: { enabled: true } }
  });

  test("Staff @roomup is handled", resStaff.handled === true);
  test("Staff action is STAFF_DIRECT_REPLY", resStaff.action === "STAFF_DIRECT_REPLY");
  const lastReplyStaff = sentMessages[sentMessages.length - 1] || "";
  test("Reply addresses staff member", lastReplyStaff.toLowerCase().includes("staffmember") || lastReplyStaff.toLowerCase().includes("disposizione"));
  console.log("  Bot reply to Staff:", lastReplyStaff);

  // --- TEST 4: Regular User says "@roomup" in ticket ---
  console.log("\n--- 4. Regular User @roomup inside ticket ---");
  const userMsg = {
    id: "m_user_1",
    guild: mockChannel.guild,
    channel: mockChannel,
    author: { id: regularUserId, username: "NormalUser", bot: false },
    member: {
      id: regularUserId,
      user: { id: regularUserId, username: "NormalUser" },
      permissions: { has: () => false },
      roles: { cache: [] }
    },
    content: "@roomup ciao",
    attachments: new Map(),
    mentions: { users: new Map([[botId, { id: botId }]]), everyone: false },
    client: { user: { id: botId } }
  };

  const resUser = await ticketEngine.processTicketMessage({
    message: userMsg,
    session,
    guildConfig: { ai: { enabled: true } }
  });

  test("User @roomup is handled", resUser.handled === true);
  test("User action is USER_DIRECT_REPLY", resUser.action === "USER_DIRECT_REPLY");
  const lastReplyUser = sentMessages[sentMessages.length - 1] || "";
  test("Reply offers help to user", lastReplyUser.includes("NormalUser") || lastReplyUser.includes(regularUserId) || lastReplyUser.includes("aiutarti"));
  console.log("  Bot reply to User:", lastReplyUser);

  // --- TEST 5: DecisionEngine Fallback for @roomup outside tickets ---
  console.log("\n--- 5. DecisionEngine Direct Greeting Fallback ---");
  const fallbackDecisionFre = decisionEngine.generateDeterministicFallback("@roomup", null, {
    user: { isOwner: true, username: "frelerr", id: freOwnerId }
  });
  test("DecisionEngine recognizes Frè @roomup", fallbackDecisionFre.action === "RESPOND" && fallbackDecisionFre.message.includes("Frè"));
  console.log("  DecisionEngine reply to Frè:", fallbackDecisionFre.message);

  const fallbackDecisionUser = decisionEngine.generateDeterministicFallback("@roomup ciao", null, {
    user: { isOwner: false, username: "Marco", id: "12345" }
  });
  test("DecisionEngine recognizes user @roomup ciao", fallbackDecisionUser.action === "RESPOND" && fallbackDecisionUser.message.includes("Sentinel AI"));
  console.log("  DecisionEngine reply to User:", fallbackDecisionUser.message);

  // --- TEST 6: Plain text "@roomup" detection (no Discord mention object) ---
  console.log("\n--- 6. Plain Text @roomup without Discord Mention Object ---");
  const plainTextMsg = {
    id: "m_plain_1",
    guild: mockChannel.guild,
    channel: mockChannel,
    author: { id: freOwnerId, username: "frelerr", bot: false },
    member: freMsg.member,
    content: "@roomup puoi aiutarmi?",
    attachments: new Map(),
    mentions: { users: new Map(), everyone: false },
    client: { user: { id: botId } }
  };

  const resPlain = await ticketEngine.processTicketMessage({
    message: plainTextMsg,
    session,
    guildConfig: { ai: { enabled: true } }
  });

  test("Plain text @roomup is handled", resPlain.handled === true);
  test("Plain text @roomup action is STAFF_DIRECT_REPLY", resPlain.action === "STAFF_DIRECT_REPLY");

  // --- TEST 7: Process Unhandled Rejection Guard Verification ---
  console.log("\n--- 7. Process Resilience Guards ---");
  const rejectionListeners = process.listeners("unhandledRejection");
  const exceptionListeners = process.listeners("uncaughtException");
  test("process.on('unhandledRejection') is registered", rejectionListeners.length > 0);
  test("process.on('uncaughtException') is registered", exceptionListeners.length > 0);

  console.log(`\n==================================================================`);
  console.log(`📊 RISULTATO TEST: ${passed} SUPERATI, ${failed} FALLITI`);
  console.log(`==================================================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error("FATAL ERROR IN TEST SUITE:", err);
  process.exit(1);
});
