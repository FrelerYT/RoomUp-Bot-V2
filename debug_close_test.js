const assert = require("assert");
const { SentinelTicketEngine, TICKET_CATEGORIES, TICKET_STATES, OPERATIONAL_MODES } = require("./src/sentinel/ticket-engine/SentinelTicketEngine");
const { MemoryEngine } = require("./src/sentinel/memory-engine/MemoryEngine");

async function debugTest() {
  const mem = new MemoryEngine();
  const ticketEngine = new SentinelTicketEngine(mem);
  const guildId = "1429445691452948524";
  const channelId = "1429445691452948999";
  const freOwnerId = "111222333444555666";

  const sentMessages = [];
  const mockChannel = {
    id: channelId,
    name: "ticket-0010",
    topic: `Ticket #0010 di S.H.U.T. (987654321098765432) | Richiesta Partnership`,
    guild: { id: guildId, name: "RoomUp!" },
    type: 0,  // GUILD_TEXT
    sendTyping: async () => {},
    send: async (payload) => {
      const text = typeof payload === "string" ? payload : (payload.content || "");
      sentMessages.push(text);
      return { id: "msg_" + Date.now(), channelId, content: text };
    }
  };

  const session = mem.createTicketMemory(guildId, channelId, {
    ticketId: channelId, channelId, guildId,
    userId: "987654321098765432",
    category: TICKET_CATEGORIES.PARTNERSHIP,
    currentState: TICKET_STATES.IN_PROGRESS,
    screenshotVerified: true,
    partnerDescription: "test",
    partnerNumber: 5,
    published: true,
    partnershipPublished: true
  });

  // Simulate staff interaction (which sets session mode to STAFF_ACTIVE)
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
    content: "Roomup che succede",
    attachments: new Map(),
    mentions: { has: () => true, everyone: false }
  };

  await ticketEngine.processTicketMessage({ message: mockFreMessage, session, guildConfig: { ai: { enabled: true } } });
  
  console.log("Session after staff interaction:");
  console.log("  currentState:", session.currentState);
  console.log("  mode:", session.mode);
  
  // Now try to close
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

  // Debug: directly call actionGuard.check
  const { defaultActionGuard } = require("./src/sentinel/action-guard/ActionGuard");
  const guardResult = await defaultActionGuard.check({
    guildId,
    channelId: channelId,
    toolName: "close_ticket",
    params: {
      channelId: channelId,
      channelName: mockChannel.name,
      channelType: mockChannel.type,
      isTicket: true,
      guildId,
      reason: "test",
      closedBy: "frelerr",
      isStaffInitiated: true
    },
    guildConfig: { ai: { enabled: true } }
  });
  
  console.log("\nActionGuard result (default guard, no session in defaultMemory):", guardResult);
  
  // Inject session into defaultMemoryEngine and retry
  const { defaultMemoryEngine } = require("./src/sentinel/memory-engine/MemoryEngine");
  defaultMemoryEngine.createTicketMemory(guildId, channelId, {
    ticketId: channelId, channelId, guildId,
    currentState: TICKET_STATES.IN_PROGRESS,
    mode: session.mode
  });
  
  const guardResult2 = await defaultActionGuard.check({
    guildId,
    channelId: channelId,
    toolName: "close_ticket",
    params: {
      channelId: channelId,
      channelName: mockChannel.name,
      channelType: mockChannel.type,
      isTicket: true,
      guildId,
      reason: "test",
      closedBy: "frelerr",
      isStaffInitiated: true
    },
    guildConfig: { ai: { enabled: true } }
  });
  
  console.log("\nActionGuard result (with session injected):", guardResult2);
  
  const resClose = await ticketEngine.processTicketMessage({
    message: mockCloseMsg, session, guildConfig: { ai: { enabled: true } }
  });
  
  console.log("\nFinal close action:", resClose.action);
  console.log("Expected: STAFF_COMMAND_CLOSE_TICKET");
  console.log("Result:", resClose.action === "STAFF_COMMAND_CLOSE_TICKET" ? "PASS" : "FAIL");
}

debugTest().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
