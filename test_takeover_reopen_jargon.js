const assert = require("assert");
const { defaultSentinelTicketEngine, OPERATIONAL_MODES, TICKET_STATES } = require("./src/sentinel/ticket-engine/SentinelTicketEngine");
const { defaultMemoryEngine } = require("./src/sentinel/memory-engine/MemoryEngine");

async function runTests() {
  console.log("=== TEST SUITE: STAFF TAKEOVER, REOPEN, JARGON ELIMINATION & MENTIONS ===");
  const guildId = "1429445691452948524";
  const channelId = "test_chan_takeover_reopen";

  // Mock Discord channel
  const sentMessages = [];
  const channel = {
    id: channelId,
    name: "ticket-0012",
    guild: { id: guildId },
    send: async (msg) => {
      sentMessages.push(typeof msg === "string" ? msg : msg.content);
      return { id: "msg_" + Date.now() };
    },
    sendTyping: async () => {}
  };

  const client = {
    user: { id: "1543608170327445634" } // Bot ID
  };

  // 1. Initialize session in partnership
  defaultMemoryEngine.createTicketMemory(guildId, channelId, {
    channelId,
    userId: "1398121150449586327", // Bry4n
    category: "partnership",
    problem: "Richiesta di partnership e collaborazione",
    userGoal: "Partnership"
  });

  const freUser = { id: "1020343046539325480", username: "frelerr" };

  // Test 1: Staff Takeover ("No faccio io")
  console.log("\n--- Test 1: Staff Takeover ---");
  const takeoverMsg = {
    author: freUser,
    content: "No faccio io",
    channel,
    guild: channel.guild,
    client,
    mentions: { users: new Map() }
  };
  let session = defaultMemoryEngine.getTicketMemory(guildId, channelId);
  const takeoverRes = await defaultSentinelTicketEngine.processTicketMessage({ message: takeoverMsg, session });
  assert.strictEqual(takeoverRes.action, "TAKEOVER_ACKNOWLEDGED");
  session = defaultMemoryEngine.getTicketMemory(guildId, channelId);
  assert.strictEqual(session.mode, OPERATIONAL_MODES.STAFF_ACTIVE);
  console.log("✅ Staff takeover acknowledged. Mode is STAFF_ACTIVE.");

  // Test 2: Staff speaks to user (@Bry4n) while in STAFF_ACTIVE mode -> Bot MUST stay silent!
  console.log("\n--- Test 2: Bot Silence during STAFF_ACTIVE ---");
  sentMessages.length = 0;
  const talkToUserMsg = {
    author: freUser,
    content: "<@1398121150449586327> noi siamo già nel server il bot non può entrare lul",
    channel,
    guild: channel.guild,
    client,
    mentions: { users: new Map([["1398121150449586327", { id: "1398121150449586327" }]]) }
  };
  session = defaultMemoryEngine.getTicketMemory(guildId, channelId);
  const talkRes = await defaultSentinelTicketEngine.processTicketMessage({ message: talkToUserMsg, session });
  assert.strictEqual(talkRes.action, "STAFF_MESSAGE_OBSERVED");
  assert.strictEqual(sentMessages.length, 0, "Bot should NOT send any message when staff speaks to user!");
  console.log("✅ Bot observed silently with 0 messages sent!");

  // Test 3: Staff pastes server ad with 'ROOMUP!' -> Bot MUST stay silent!
  console.log("\n--- Test 3: Staff pastes server ad with 'ROOMUP!' ---");
  sentMessages.length = 0;
  const adMsg = {
    author: freUser,
    content: "# ❤️‍🔥 [ROOMUP!](https://discord.gg/Ks8KP5BZBH) 🔥\n\nGaming e divertimento",
    channel,
    guild: channel.guild,
    client,
    mentions: { users: new Map() }
  };
  session = defaultMemoryEngine.getTicketMemory(guildId, channelId);
  const adRes = await defaultSentinelTicketEngine.processTicketMessage({ message: adMsg, session });
  assert.strictEqual(adRes.action, "STAFF_MESSAGE_OBSERVED");
  assert.strictEqual(sentMessages.length, 0, "Bot should NOT trigger on 'ROOMUP!' in advertisements!");
  console.log("✅ Server advertisement ignored silently without intrusion!");

  // Test 4: Staff teaches description ("Roomup questa è la nostra descrizione")
  console.log("\n--- Test 4: Save official partnership description ---");
  sentMessages.length = 0;
  const saveDescMsg = {
    author: freUser,
    content: "Roomup questa è la nostra descrizione",
    channel,
    guild: channel.guild,
    client,
    mentions: { users: new Map() }
  };
  session = defaultMemoryEngine.getTicketMemory(guildId, channelId);
  const descRes = await defaultSentinelTicketEngine.processTicketMessage({ message: saveDescMsg, session });
  assert.strictEqual(descRes.action, "OFFICIAL_DESCRIPTION_SAVED");
  assert.strictEqual(sentMessages.length, 1);
  console.log("🤖 Bot reply:", sentMessages[0]);
  console.log("✅ Official partnership description saved successfully!");

  // Test 5: Staff says "Riapri ticket" -> Bot reopens ticket!
  console.log("\n--- Test 5: Staff command 'Riapri ticket' ---");
  sentMessages.length = 0;
  const reopenMsg = {
    author: freUser,
    content: "Riapri ticket",
    channel,
    guild: channel.guild,
    client,
    mentions: { users: new Map() }
  };
  session = defaultMemoryEngine.getTicketMemory(guildId, channelId);
  const reopenRes = await defaultSentinelTicketEngine.processTicketMessage({ message: reopenMsg, session });
  assert.strictEqual(reopenRes.action, "STAFF_COMMAND_REOPEN_TICKET");
  session = defaultMemoryEngine.getTicketMemory(guildId, channelId);
  assert.strictEqual(session.currentState, TICKET_STATES.IN_PROGRESS);
  assert.strictEqual(session.mode, OPERATIONAL_MODES.AI_ACTIVE);
  console.log("🤖 Bot reply:", sentMessages[0]);
  console.log("✅ Reopen command executed. Ticket is IN_PROGRESS and AI_ACTIVE!");

  // Test 6: Explicit Status Inquiry ("@RoomUp! che succede") -> No technical jargon or constants!
  console.log("\n--- Test 6: Status inquiry without technical jargon ---");
  sentMessages.length = 0;
  const statusMsg = {
    author: freUser,
    content: "Roomup che succede",
    channel,
    guild: channel.guild,
    client,
    mentions: { users: new Map() }
  };
  session = defaultMemoryEngine.getTicketMemory(guildId, channelId);
  const statusRes = await defaultSentinelTicketEngine.processTicketMessage({ message: statusMsg, session });
  assert.strictEqual(statusRes.action, "STAFF_BRIEFING_SENT");
  console.log("🤖 Bot briefing:", sentMessages[0]);
  const botText = sentMessages[0];
  assert(!botText.includes("STAFF_TAKEOVER"), "Should not contain STAFF_TAKEOVER");
  assert(!botText.includes("RESOLVED"), "Should not contain RESOLVED");
  assert(!botText.includes("errore 600"), "Should not contain errore 600");
  assert(!botText.includes("problema 600"), "Should not contain problema 600");
  console.log("✅ Status briefing provided without any developer jargon or code constants!");

  console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY (100%)!");
}

runTests().catch(err => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
