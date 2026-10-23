/**
 * Test: Full Partnership Conversational Flow & Category Robustness
 * Simulates user answering "svago" in #ticket-0009 and verifying Sentinel's real-time response.
 */

const assert = require("assert");
const { SentinelTicketEngine, TICKET_CATEGORIES, TICKET_STATES } = require("./src/sentinel/ticket-engine/SentinelTicketEngine");
const { SentinelCore } = require("./src/sentinel/core/SentinelCore");
const { MemoryEngine } = require("./src/sentinel/memory-engine/MemoryEngine");

async function runTests() {
  console.log("==================================================================");
  console.log("🧪 TEST SUITE: PARTNERSHIP MULTI-STEP CONVERSATIONAL FLOW");
  console.log("==================================================================");

  const mem = new MemoryEngine();
  const ticketEngine = new SentinelTicketEngine(mem);
  const core = new SentinelCore({ memoryEngine: mem, ticketEngine });

  const guildId = "1429445691452948524";
  const channelId = "1429445691452948999";
  const userId = "987654321098765432";

  // Mock Discord channel
  const sentMessages = [];
  const mockChannel = {
    id: channelId,
    name: "ticket-0009",
    topic: `Ticket #0009 di S.H.U.T. (${userId}) | Richiesta Partnership`,
    guild: { id: guildId, name: "RoomUp!" },
    sendTyping: async () => {},
    send: async (payload) => {
      const content = typeof payload === "string" ? payload : payload.content;
      sentMessages.push(content);
      return { id: "msg_" + Date.now(), channelId, content };
    }
  };

  // Step 1: Ticket is opened
  console.log("\n1. Simulating ticket open for Partnership...");
  const openRes = await ticketEngine.handleTicketOpen({
    guildId,
    channelId,
    userId,
    categoryHint: "partnership",
    modalAnswers: { passion: "Gaming e intrattenimento", members: "6700000" }
  });
  assert(openRes.session, "Session must exist");
  assert.strictEqual(openRes.classification.category, TICKET_CATEGORIES.PARTNERSHIP);
  console.log("  ✅ Ticket open handled, initial question prepared.");

  // Step 2: User replies "svago"
  console.log("\n2. Simulating user replying 'svago' to the bot...");
  const mockUserMsg1 = {
    id: "msg_user_1",
    guild: mockChannel.guild,
    channel: mockChannel,
    author: { id: userId, username: "S.H.U.T.", bot: false },
    member: { user: { id: userId, username: "S.H.U.T." }, permissions: { has: () => false }, roles: { cache: [] } },
    content: "svago",
    attachments: new Map()
  };

  const processResult1 = await ticketEngine.processTicketMessage({
    message: mockUserMsg1,
    session: openRes.session,
    guildConfig: { ai: { enabled: true, autonomyLevel: 4 } }
  });

  console.log("  Process result 1 action:", processResult1.action);
  assert(processResult1.handled, "Process ticket message must be HANDLED");
  assert.strictEqual(processResult1.action, "PARTNERSHIP_INSTRUCTIONS_SENT");
  assert(sentMessages.length > 0, "Bot must have sent a response message");
  const lastBotReply1 = sentMessages[sentMessages.length - 1];
  console.log("  🤖 Bot reply 1:\n" + lastBotReply1);
  assert(lastBotReply1.includes("discord.gg/roomup"), "Bot must provide invite instructions");
  assert(lastBotReply1.includes("screenshot a schermo intero"), "Bot must request full-screen screenshot");

  // Step 3: User sends server description & invite
  console.log("\n3. Simulating user sending their server ad/invite...");
  const mockUserMsg2 = {
    id: "msg_user_2",
    guild: mockChannel.guild,
    channel: mockChannel,
    author: { id: userId, username: "S.H.U.T.", bot: false },
    member: { user: { id: userId, username: "S.H.U.T." }, permissions: { has: () => false }, roles: { cache: [] } },
    content: "Ecco la nostra community: https://discord.gg/myserver - Server di svago e tornei!",
    attachments: new Map()
  };

  const processResult2 = await ticketEngine.processTicketMessage({
    message: mockUserMsg2,
    session: openRes.session,
    guildConfig: { ai: { enabled: true, autonomyLevel: 4 } }
  });

  console.log("  Process result 2 action:", processResult2.action);
  assert(processResult2.handled, "Process ticket message must be HANDLED");
  assert.strictEqual(processResult2.action, "PARTNERSHIP_DESCRIPTION_SAVED");
  const lastBotReply2 = sentMessages[sentMessages.length - 1];
  console.log("  🤖 Bot reply 2:\n" + lastBotReply2);
  assert(openRes.session.partnerDescription.includes("https://discord.gg/myserver"), "Partner description must be stored");

  // Step 4: User says "risolto grazie"
  console.log("\n4. Simulating user saying 'tutto risolto grazie'...");
  const mockUserMsg3 = {
    id: "msg_user_3",
    guild: mockChannel.guild,
    channel: mockChannel,
    author: { id: userId, username: "S.H.U.T.", bot: false },
    member: { user: { id: userId, username: "S.H.U.T." }, permissions: { has: () => false }, roles: { cache: [] } },
    content: "tutto risolto grazie",
    attachments: new Map()
  };

  const processResult3 = await ticketEngine.processTicketMessage({
    message: mockUserMsg3,
    session: openRes.session,
    guildConfig: { ai: { enabled: true, autonomyLevel: 4 } }
  });

  console.log("  Process result 3 action:", processResult3.action);
  assert(processResult3.handled, "Process ticket message must be HANDLED");
  assert.strictEqual(processResult3.action, "TICKET_RESOLVED_CLOSE");

  console.log("\n==================================================================");
  console.log("🎉 TUTTI I TEST DEL FLUSSO PARTNERSHIP SUPERATI CON SUCCESSO!");
  console.log("==================================================================");
}

runTests().catch(err => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
