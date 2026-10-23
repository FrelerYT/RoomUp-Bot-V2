// Quick diagnostic: run exactly the full sequence from test_intelligent_agent_suite.js and print session state before close
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
    id: channelId, name: "ticket-0010",
    topic: `Ticket #0010 di S.H.U.T. (${shutUserId}) | Richiesta Partnership`,
    guild: { id: guildId, name: "RoomUp!" },
    type: 0, sendTyping: async () => {},
    send: async (payload) => { const t = typeof payload === "string" ? payload : (payload.content || ""); sentMessages.push(t); return {}; }
  };

  const session = mem.createTicketMemory(guildId, channelId, {
    ticketId: channelId, channelId, guildId, userId: shutUserId,
    category: TICKET_CATEGORIES.PARTNERSHIP, currentState: TICKET_STATES.IN_PROGRESS,
    screenshotVerified: true, partnerDescription: "test", partnerNumber: 5,
    published: true, partnershipPublished: true
  });

  const shutMember = { user: { id: shutUserId }, permissions: { has: () => false }, roles: { cache: [] } };
  const freMember = { id: freOwnerId, user: { id: freOwnerId, username: "frelerr" }, permissions: { has: (p) => p === "Administrator" }, guild: mockChannel.guild, roles: { cache: [] } };

  // Section 1
  let r;
  r = await ticketEngine.processTicketMessage({ message: { id: "s1", guild: mockChannel.guild, channel: mockChannel, author: { id: shutUserId, username: "S.H.U.T.", bot: false }, member: shutMember, content: "non hai inviato sul canale partnership perche?", attachments: new Map() }, session, guildConfig: { ai: { enabled: true, autonomyLevel: 4 } } });
  console.log("S1:", r.action, "mode:", session.mode, "state:", session.currentState);

  // Section 1b
  r = await ticketEngine.processTicketMessage({ message: { id: "q1", guild: mockChannel.guild, channel: mockChannel, author: { id: shutUserId, username: "S.H.U.T.", bot: false }, member: shutMember, content: "una domanda", attachments: new Map() }, session, guildConfig: { ai: { enabled: true, autonomyLevel: 4 } } });
  console.log("Q1:", r.action, "mode:", session.mode, "state:", session.currentState);

  r = await ticketEngine.processTicketMessage({ message: { id: "q2", guild: mockChannel.guild, channel: mockChannel, author: { id: shutUserId, username: "S.H.U.T.", bot: false }, member: shutMember, content: "si si e ho hna domanda", attachments: new Map() }, session, guildConfig: { ai: { enabled: true, autonomyLevel: 4 } } });
  console.log("Q2:", r.action, "mode:", session.mode, "state:", session.currentState);

  r = await ticketEngine.processTicketMessage({ message: { id: "q3", guild: mockChannel.guild, channel: mockChannel, author: { id: shutUserId, username: "S.H.U.T.", bot: false }, member: shutMember, content: "okay si ma ho una dkamnda", attachments: new Map() }, session, guildConfig: { ai: { enabled: true, autonomyLevel: 4 } } });
  console.log("Q3:", r.action, "mode:", session.mode, "state:", session.currentState);

  // Section 2: Fré briefing
  r = await ticketEngine.processTicketMessage({ message: { id: "f1", guild: mockChannel.guild, channel: mockChannel, author: { id: freOwnerId, username: "frelerr", bot: false }, member: freMember, content: "Roomup\n@RoomUp!\n@RoomUp! che succede", attachments: new Map(), mentions: { has: () => true, everyone: false } }, session, guildConfig: { ai: { enabled: true, autonomyLevel: 4 } } });
  console.log("F1 (briefing):", r.action, "mode:", session.mode, "state:", session.currentState);

  // Section 3a: rule
  r = await ticketEngine.processTicketMessage({ message: { id: "f2", guild: mockChannel.guild, channel: mockChannel, author: { id: freOwnerId, username: "frelerr", bot: false }, member: freMember, content: "Roomup ricorda che i partner devono avere almeno 50 membri", attachments: new Map(), mentions: { has: () => false, everyone: false } }, session, guildConfig: { ai: { enabled: true } } });
  console.log("F2 (rule):", r.action, "mode:", session.mode, "state:", session.currentState);

  // Section 3b: goal
  r = await ticketEngine.processTicketMessage({ message: { id: "f3", guild: mockChannel.guild, channel: mockChannel, author: { id: freOwnerId, username: "frelerr", bot: false }, member: freMember, content: "Roomup imposta obiettivo: raggiungere 100 partnership attive", attachments: new Map(), mentions: { has: () => false, everyone: false } }, session, guildConfig: { ai: { enabled: true } } });
  console.log("F3 (goal):", r.action, "mode:", session.mode, "state:", session.currentState);

  // Section 3c: close
  r = await ticketEngine.processTicketMessage({ message: { id: "f4", guild: mockChannel.guild, channel: mockChannel, author: { id: freOwnerId, username: "frelerr", bot: false }, member: freMember, content: "Roomup chiudi il ticket", attachments: new Map(), mentions: { has: () => false, everyone: false } }, session, guildConfig: { ai: { enabled: true } } });
  console.log("F4 (close):", r.action, "mode:", session.mode, "state:", session.currentState);
  if (r.action !== "STAFF_COMMAND_CLOSE_TICKET") {
    console.log("FAIL reason:", r.reason || "N/A");
  }
}

runTest().catch(e => console.error("ERROR:", e.message));
