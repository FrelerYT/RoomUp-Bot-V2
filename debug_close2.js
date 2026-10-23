// Minimal targeted debug for the exact test_intelligent_agent_suite.js section 3 scenario
const assert = require("assert");
const { SentinelTicketEngine, TICKET_CATEGORIES, TICKET_STATES, OPERATIONAL_MODES } = require("./src/sentinel/ticket-engine/SentinelTicketEngine");
const { MemoryEngine } = require("./src/sentinel/memory-engine/MemoryEngine");

async function runTest() {
  const mem = new MemoryEngine();
  const ticketEngine = new SentinelTicketEngine(mem);
  const guildId = "1429445691452948524";
  const channelId = "1429445691452948999";
  const freOwnerId = "111222333444555666";
  const shutUserId = "987654321098765432";

  const sentMessages = [];
  const mockChannel = {
    id: channelId,
    name: "ticket-0010",
    topic: `Ticket #0010 di S.H.U.T. (${shutUserId}) | Richiesta Partnership`,
    guild: { id: guildId, name: "RoomUp!" },
    type: 0,
    sendTyping: async () => {},
    send: async (payload) => {
      const text = typeof payload === "string" ? payload : (payload.content || "");
      sentMessages.push(text);
      return { id: "msg_" + Date.now(), channelId, content: text };
    }
  };

  const session = mem.createTicketMemory(guildId, channelId, {
    ticketId: channelId, channelId, guildId,
    userId: shutUserId,
    category: TICKET_CATEGORIES.PARTNERSHIP,
    currentState: TICKET_STATES.IN_PROGRESS,
    screenshotVerified: true,
    partnerDescription: "test",
    partnerNumber: 5,
    published: true,
    partnershipPublished: true
  });

  const mockFreMember = {
    id: freOwnerId,
    user: { id: freOwnerId, username: "frelerr" },
    permissions: { has: (perm) => perm === "Administrator" },
    guild: mockChannel.guild,
    roles: { cache: [] }
  };

  // Step 1: STAFF_BRIEFING (section 2)
  const res1 = await ticketEngine.processTicketMessage({
    message: { id: "m1", guild: mockChannel.guild, channel: mockChannel, author: { id: freOwnerId, username: "frelerr", bot: false }, member: mockFreMember, content: "Roomup\n@RoomUp!\n@RoomUp! che succede", attachments: new Map(), mentions: { has: () => true, everyone: false } },
    session, guildConfig: { ai: { enabled: true, autonomyLevel: 4 } }
  });
  console.log("Step 1 (che succede):", res1.action, "| mode:", session.mode, "| state:", session.currentState);

  // Step 2: STAFF_RULE_MEMORIZED (section 3a)
  const res2 = await ticketEngine.processTicketMessage({
    message: { id: "m2", guild: mockChannel.guild, channel: mockChannel, author: { id: freOwnerId, username: "frelerr", bot: false }, member: mockFreMember, content: "Roomup ricorda che i partner devono avere almeno 50 membri", attachments: new Map(), mentions: { has: () => false, everyone: false } },
    session, guildConfig: { ai: { enabled: true } }
  });
  console.log("Step 2 (ricorda regola):", res2.action, "| mode:", session.mode, "| state:", session.currentState);

  // Step 3: STAFF_GOAL_SET (section 3b)
  const res3 = await ticketEngine.processTicketMessage({
    message: { id: "m3", guild: mockChannel.guild, channel: mockChannel, author: { id: freOwnerId, username: "frelerr", bot: false }, member: mockFreMember, content: "Roomup imposta obiettivo: raggiungere 100 partnership attive", attachments: new Map(), mentions: { has: () => false, everyone: false } },
    session, guildConfig: { ai: { enabled: true } }
  });
  console.log("Step 3 (imposta obiettivo):", res3.action, "| mode:", session.mode, "| state:", session.currentState);

  // Step 4: CLOSE TICKET (section 3c)
  const res4 = await ticketEngine.processTicketMessage({
    message: { id: "m4", guild: mockChannel.guild, channel: mockChannel, author: { id: freOwnerId, username: "frelerr", bot: false }, member: mockFreMember, content: "Roomup chiudi il ticket", attachments: new Map(), mentions: { has: () => false, everyone: false } },
    session, guildConfig: { ai: { enabled: true } }
  });
  console.log("Step 4 (chiudi il ticket):", res4.action, "| mode:", session.mode, "| state:", session.currentState);
  console.log("Expected: STAFF_COMMAND_CLOSE_TICKET");
  if (res4.action === "STAFF_COMMAND_CLOSE_TICKET") {
    console.log("✅ PASS");
  } else {
    console.log("❌ FAIL - reason:", res4.reason || "N/A");
    if (res4.action === "CLOSE_TICKET_BLOCKED") {
      // Check the actionGuard directly
      const { defaultActionGuard } = require("./src/sentinel/action-guard/ActionGuard");
      const guard = await defaultActionGuard.check({
        guildId, channelId, toolName: "close_ticket",
        params: { channelId, channelName: mockChannel.name, channelType: 0, isTicket: true, guildId, reason: "test", closedBy: "frelerr", isStaffInitiated: true },
        guildConfig: { ai: { enabled: true } }
      });
      console.log("ActionGuard direct check:", JSON.stringify(guard));
    }
  }
}

runTest().catch(e => { console.error("ERROR:", e.message); });
