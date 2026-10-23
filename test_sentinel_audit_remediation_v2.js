/**
 * Comprehensive Automated Audit & Remediation Verification Suite V2
 * 
 * Verifies all 9 critical areas fixed during the independent Sentinel review:
 * 1. Multi-Guild Isolation in AutonomousModerationEngine (flood/spam per-guild)
 * 2. ContextEngine ticket session propagation (guildId, userId, partnership details)
 * 3. SentinelTicketEngine staff takeover, handover, directives, & live learning without crashes
 * 4. ActionGuard & ActionExecutor channel-scoped idempotency and cooldown alignment
 * 5. ToolEngine & ActionVerifier complete moderation coverage (kick, ban, unban, remove_role, close_ticket)
 * 6. SentinelCore Discord event deduplication
 * 7. VisionEngine dynamic MIME type detection (PNG, JPEG, GIF, WEBP)
 * 8. EscalationEngine staff roles fallback to guildConfig.staffRoles
 * 9. ActionPlanner preservation of decision.message on CLOSE action
 * 10. SentinelScheduler periodic knowledge expiration cleanup
 */

const assert = require("assert");
const {
  defaultEventEngine,
  EVENT_TYPES,
  defaultContextEngine,
  defaultSentinelTicketEngine,
  TICKET_STATES,
  OPERATIONAL_MODES,
  defaultMemoryEngine,
  defaultKnowledgeEngine,
  defaultActionGuard,
  defaultActionExecutor,
  defaultActionVerifier,
  defaultToolEngine,
  defaultAutonomousModerationEngine,
  defaultVisionEngine,
  defaultEscalationEngine,
  defaultActionPlanner,
  defaultSentinelScheduler,
  defaultSentinelCore
} = require("./src/sentinel");

console.log("==================================================================");
console.log("🛡️ AVVIO TEST AUDIT REMEDIATION V2 — SENTINEL AUTONOMOUS STAFF");
console.log("==================================================================\n");

let passed = 0;
let total = 0;

function runTest(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}:`, err.message);
    throw err;
  }
}

async function runTestAsync(name, fn) {
  total++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}:`, err.message);
    throw err;
  }
}

(async () => {
  const GUILD_A = "111111111111111111";
  const GUILD_B = "222222222222222222";
  const USER_ID = "999999999999999999";

  // 1. Multi-Guild Isolation in AutonomousModerationEngine
  console.log("--- 1. MULTI-GUILD ISOLATION IN MODERATION ENGINE ---");
  await runTestAsync("AutonomousModerationEngine isolates flood tracking between guilds for the same user", async () => {
    // Send 5 messages in Guild A
    for (let i = 0; i < 5; i++) {
      const msgA = {
        guild: { id: GUILD_A },
        author: { id: USER_ID, bot: false },
        content: "Messaggio normale " + i,
        channel: { id: "c_a" }
      };
      const resA = await defaultAutonomousModerationEngine.evaluateMessage(msgA, {});
      assert.strictEqual(resA.action, "OBSERVE");
    }

    // Send 3 messages in Guild B with same user
    for (let i = 0; i < 3; i++) {
      const msgB = {
        guild: { id: GUILD_B },
        author: { id: USER_ID, bot: false },
        content: "Messaggio in un altro server " + i,
        channel: { id: "c_b" }
      };
      const resB = await defaultAutonomousModerationEngine.evaluateMessage(msgB, {});
      // Guild B total is only 3, must NOT trigger flood
      assert.strictEqual(resB.action, "OBSERVE", "User must not trigger flood on Guild B due to Guild A activity");
    }

    // Now send 2 more in Guild A (total 7 in Guild A) -> triggers flood in Guild A
    let resA6, resA7;
    for (let i = 5; i < 7; i++) {
      const msgA = {
        guild: { id: GUILD_A },
        author: { id: USER_ID, bot: false },
        content: "Flood rapido " + i,
        channel: { id: "c_a" }
      };
      resA7 = await defaultAutonomousModerationEngine.evaluateMessage(msgA, {});
    }
    assert.strictEqual(resA7.action, "ACT");
    assert.strictEqual(resA7.violation, "FLOOD");
  });

  // 2. ContextEngine ticket session propagation
  console.log("\n--- 2. CONTEXT ENGINE TICKET SESSION PROPAGATION ---");
  await runTestAsync("ContextEngine.buildContext preserves guildId, userId, and partnership metadata", async () => {
    const channelId = "chan_ctx_test_1";
    defaultMemoryEngine.createTicketMemory(GUILD_A, channelId, {
      userId: USER_ID,
      category: "partnership",
      problem: "Richiesta partnership server",
      partnerDescription: "Server da 500 membri",
      screenshotVerified: true,
      screenshotUrl: "https://example.com/verified.png"
    });

    const event = defaultEventEngine.normalizeEvent({
      type: EVENT_TYPES.USER_REPLY,
      guildId: GUILD_A,
      channelId,
      userId: USER_ID,
      content: "Ecco la descrizione"
    });

    const context = await defaultContextEngine.buildContext({
      event,
      guildConfig: { ai: { enabled: true } }
    });

    assert.ok(context.ticket, "Ticket context must be populated");
    assert.strictEqual(context.ticket.guildId, GUILD_A, "ticket.guildId must match event guildId");
    assert.strictEqual(context.ticket.userId, USER_ID, "ticket.userId must match created ticket userId");
    assert.strictEqual(context.ticket.screenshotVerified, true, "screenshotVerified must be preserved");
    assert.strictEqual(context.ticket.screenshotUrl, "https://example.com/verified.png");
    assert.strictEqual(context.ticket.partnerDescription, "Server da 500 membri");
  });

  // 3. SentinelTicketEngine with ContextEngine ticket without crashes
  console.log("\n--- 3. TICKET ENGINE INTERVENTIONS WITH VALID CONTEXT ---");
  await runTestAsync("SentinelTicketEngine handles staff takeover and handover cleanly without multi-tenant violations", async () => {
    const channelId = "chan_takeover_test";
    defaultMemoryEngine.createTicketMemory(GUILD_A, channelId, {
      userId: USER_ID,
      category: "support",
      currentState: TICKET_STATES.IN_PROGRESS,
      mode: OPERATIONAL_MODES.AI_ACTIVE
    });

    const context = await defaultContextEngine.buildContext({
      event: defaultEventEngine.normalizeEvent({
        type: EVENT_TYPES.STAFF_MESSAGE,
        guildId: GUILD_A,
        channelId,
        userId: "staff_123",
        content: "faccio io"
      })
    });

    const sentMessages = [];
    const mockChannel = {
      id: channelId,
      name: "ticket-0001",
      send: async (msg) => { sentMessages.push(msg); return { id: "msg_takeover" }; }
    };

    const mockMessage = {
      channel: mockChannel,
      guild: { id: GUILD_A },
      author: { id: "staff_123", username: "frelerr", bot: false },
      member: { user: { username: "frelerr" }, permissions: { has: () => true } },
      content: "ci penso io"
    };

    // Takeover test
    const resTakeover = await defaultSentinelTicketEngine.processTicketMessage({
      message: mockMessage,
      session: context.ticket,
      guildConfig: {}
    });

    assert.strictEqual(resTakeover.handled, true);
    assert.strictEqual(resTakeover.action, "TAKEOVER_ACKNOWLEDGED");
    const updatedMem = defaultMemoryEngine.getTicketMemory(GUILD_A, channelId);
    assert.strictEqual(updatedMem.mode, OPERATIONAL_MODES.STAFF_ACTIVE);

    // Handover test
    mockMessage.content = "continua tu";
    const resHandover = await defaultSentinelTicketEngine.processTicketMessage({
      message: mockMessage,
      session: context.ticket,
      guildConfig: {}
    });

    assert.strictEqual(resHandover.handled, true);
    assert.strictEqual(resHandover.action, "HANDOVER_RESUMED");
    const resumedMem = defaultMemoryEngine.getTicketMemory(GUILD_A, channelId);
    assert.strictEqual(resumedMem.mode, OPERATIONAL_MODES.AI_ACTIVE);
  });

  // 4. ActionGuard & ActionExecutor Channel-Scoped Idempotency
  console.log("\n--- 4. ACTION GUARD & EXECUTOR CHANNEL IDEMPOTENCY ---");
  await runTestAsync("ActionGuard and ActionExecutor correctly align hashes for channel-targeted actions", async () => {
    const channel1 = "chan_idemp_1";
    const channel2 = "chan_idemp_2";

    // Dry-run execute send_message in channel 1
    const plan = [{ toolName: "send_message", params: { content: "Messaggio test" } }];
    const execRes = await defaultActionExecutor.executePlan(plan, {
      guildId: GUILD_A,
      channelId: channel1,
      userId: USER_ID,
      dryRun: true
    });
    assert.strictEqual(execRes[0].success, true);

    // Now check immediate retry in channel 1: MUST be blocked by idempotency (checkpoint 7)
    const guardCheck1 = await defaultActionGuard.check({
      guildId: GUILD_A,
      channelId: channel1,
      toolName: "send_message",
      params: { content: "Messaggio test" }
    });
    assert.strictEqual(guardCheck1.allowed, false);
    assert.strictEqual(guardCheck1.checkpoint, 7, "Must be blocked by checkpoint 7 (Idempotency)");

    // Check same action in channel 2: MUST be allowed because channel differs
    const guardCheck2 = await defaultActionGuard.check({
      guildId: GUILD_A,
      channelId: channel2,
      toolName: "send_message",
      params: { content: "Messaggio test" }
    });
    assert.strictEqual(guardCheck2.allowed, true, "Different channel must be allowed");
  });

  // 5. ToolEngine & ActionVerifier Moderation Suite
  console.log("\n--- 5. TOOL ENGINE & VERIFIER COMPLETE MODERATION SUITE ---");
  await runTestAsync("ToolEngine implements kick_user, ban_user, unban_user and ActionVerifier verifies them", async () => {
    const mockGuild = {
      id: GUILD_A,
      members: {
        cache: new Map([["u_kick", { kick: async (r) => ({ reason: r }) }]]),
        fetch: async (id) => (id === "u_kick" ? { kick: async (r) => ({ reason: r }) } : null)
      },
      bans: {
        create: async (id, opts) => ({ user: { id } }),
        remove: async (id, reason) => true,
        fetch: async (id) => (id === "u_ban" ? { user: { id: "u_ban" } } : null)
      }
    };

    defaultToolEngine.setClient({
      guilds: {
        cache: new Map([[GUILD_A, mockGuild]]),
        fetch: async (id) => mockGuild
      }
    });

    // 1. kick_user
    const kickRes = await defaultToolEngine.executeTool("kick_user", { userId: "u_kick", reason: "Test Kick" }, { guildId: GUILD_A });
    assert.strictEqual(kickRes.success, true);
    assert.strictEqual(kickRes.data.userId, "u_kick");

    // 2. ban_user
    const banRes = await defaultToolEngine.executeTool("ban_user", { userId: "u_ban", reason: "Test Ban" }, { guildId: GUILD_A });
    assert.strictEqual(banRes.success, true);
    assert.strictEqual(banRes.data.userId, "u_ban");

    // 3. unban_user
    const unbanRes = await defaultToolEngine.executeTool("unban_user", { userId: "u_ban", reason: "Test Unban" }, { guildId: GUILD_A });
    assert.strictEqual(unbanRes.success, true);

    // 4. ActionVerifier tests
    const verifyBan = await defaultActionVerifier.verify({
      toolName: "ban_user",
      executionResult: { success: true },
      params: { userId: "u_ban" },
      discordClient: defaultToolEngine.client,
      guildId: GUILD_A
    });
    assert.strictEqual(verifyBan.verified, true);

    const verifyRemoveRole = await defaultActionVerifier.verify({
      toolName: "remove_role",
      executionResult: { simulated: true, success: true },
      params: { userId: "u_test", roleId: "r_1" },
      discordClient: defaultToolEngine.client,
      guildId: GUILD_A
    });
    assert.strictEqual(verifyRemoveRole.verified, true);

    const verifyClose = await defaultActionVerifier.verify({
      toolName: "close_ticket",
      executionResult: { success: true },
      params: { channelId: "c_1" }
    });
    assert.strictEqual(verifyClose.verified, true);
  });

  // 6. SentinelCore Event Deduplication
  console.log("\n--- 6. SENTINEL CORE DEDUPLICATION ---");
  await runTestAsync("SentinelCore suppresses duplicate gateway events", async () => {
    const event = defaultEventEngine.normalizeEvent({
      type: EVENT_TYPES.MESSAGE_CREATE,
      guildId: GUILD_A,
      channelId: "chan_dedup_test",
      userId: USER_ID,
      content: "Unico messaggio",
      metadata: { messageId: "msg_dup_12345" }
    });

    const res1 = await defaultSentinelCore.processEvent(event, { dryRun: true });
    assert.strictEqual(res1.status, "COMPLETED");

    // Send identical event again
    const res2 = await defaultSentinelCore.processEvent(event, { dryRun: true });
    assert.strictEqual(res2.status, "DUPLICATE_EVENT");
  });

  // 7. VisionEngine Dynamic MIME Detection
  console.log("\n--- 7. VISION ENGINE DYNAMIC MIME DETECTION ---");
  runTest("VisionEngine detectMimeType detects PNG, JPEG, GIF, and WEBP", () => {
    const pngBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    const jpegBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const gifBuf = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    const webpBuf = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);

    assert.strictEqual(defaultVisionEngine.detectMimeType(pngBuf), "image/png");
    assert.strictEqual(defaultVisionEngine.detectMimeType(jpegBuf), "image/jpeg");
    assert.strictEqual(defaultVisionEngine.detectMimeType(gifBuf), "image/gif");
    assert.strictEqual(defaultVisionEngine.detectMimeType(webpBuf), "image/webp");
    assert.strictEqual(defaultVisionEngine.detectMimeType(Buffer.from([0, 0]), "https://cdn.discordapp.com/img.jpeg"), "image/jpeg");
  });

  // 8. EscalationEngine Fallback to guildConfig.staffRoles
  console.log("\n--- 8. ESCALATION ENGINE STAFF ROLE FALLBACK ---");
  await runTestAsync("EscalationEngine falls back to guildConfig.staffRoles for mentions", async () => {
    const sentPings = [];
    const mockChannel = {
      id: "chan_esc_test",
      guild: { id: GUILD_A },
      send: async (content) => { sentPings.push(content); return { id: "msg_esc_1" }; }
    };

    const res = await defaultEscalationEngine.escalateTicket({
      channel: mockChannel,
      user: { username: "Richiedente" },
      session: { guildId: GUILD_A, ticketId: "chan_esc_test", problem: "Problema complesso" },
      guildConfig: { staffRoles: ["1550847075434893463", "1541051075623133285"] }
    });

    assert.strictEqual(res.success, true);
    assert.ok(sentPings[0].includes("<@&1550847075434893463>"));
    assert.ok(sentPings[0].includes("<@&1541051075623133285>"));
  });

  // 9. ActionPlanner Message Inclusion on CLOSE
  console.log("\n--- 9. ACTION PLANNER CLOSE MESSAGE INCLUSION ---");
  runTest("ActionPlanner includes send_message prior to close_ticket when decision has message", () => {
    const plan = defaultActionPlanner.planActions({
      action: "CLOSE",
      message: "Problema verificato e risolto. Procedo con la chiusura del ticket.",
      reason: "Risolto"
    });

    assert.strictEqual(plan.length, 2);
    assert.strictEqual(plan[0].toolName, "send_message");
    assert.strictEqual(plan[0].params.content, "Problema verificato e risolto. Procedo con la chiusura del ticket.");
    assert.strictEqual(plan[1].toolName, "close_ticket");
  });

  // 10. SentinelScheduler Expiration Cleanup
  console.log("\n--- 10. SENTINEL SCHEDULER PROACTIVE CLEANUP ---");
  await runTestAsync("SentinelScheduler runProactiveChecks purges expired knowledge items", async () => {
    // Add expired knowledge item (expired 10 seconds ago)
    const doc = defaultKnowledgeEngine.addKnowledgeItem(GUILD_A, {
      category: "SERVER_FAQ",
      title: "Temporaneo scaduto",
      content: "Questo documento deve essere rimosso",
      expiration: Date.now() - 10000
    });

    assert.ok(defaultKnowledgeEngine.items[GUILD_A].some(i => i.id === doc.id));

    // Run scheduler proactive check
    await defaultSentinelScheduler.runProactiveChecks(null);

    // Confirm it was purged
    assert.ok(!defaultKnowledgeEngine.items[GUILD_A].some(i => i.id === doc.id), "Expired doc must be purged");
  });

  console.log("\n==================================================================");
  console.log(`🎉 TUTTI I 10 TEST DI AUDIT V2 SUPERATI CON SUCCESSO! (${passed}/${total})`);
  console.log("==================================================================\n");
})();
