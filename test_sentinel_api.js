/**
 * Automated Test Suite for SENTINEL REST APIs
 */

process.env.PORT = "3115";
const assert = require("assert");
const http = require("http");
const { createWebServer } = require("./src/web/server");

console.log("==================================================================");
console.log("🌐 AVVIO TEST ENDPOINT REST API SENTINEL WEB DASHBOARD");
console.log("==================================================================\n");

const TEST_PORT = 3115;
const GUILD_ID = "1429445691452948524";

function requestJson(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : "";
    const options = {
      hostname: "127.0.0.1",
      port: TEST_PORT,
      path,
      method,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
        ...headers
      }
    };

    const req = http.request(options, res => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on("error", reject);
    if (postData) req.write(postData);
    req.end();
  });
}

let passed = 0;
let total = 0;

async function runTest(name, fn) {
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

async function run() {
  const app = createWebServer(null, TEST_PORT);

  // 1. GET & POST Sentinel Config
  await runTest("GET /api/dashboard/:guildId/sentinel/config", async () => {
    const res = await requestJson("GET", `/api/dashboard/${GUILD_ID}/sentinel/config`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.ai);
  });

  await runTest("POST /api/dashboard/:guildId/sentinel/config", async () => {
    const res = await requestJson("POST", `/api/dashboard/${GUILD_ID}/sentinel/config`, {
      autonomyLevel: 5,
      temperature: 0.1
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.ai.autonomyLevel, 5);
  });

  // 2. Knowledge Base CRUD & Rollback
  let createdDocId = null;
  await runTest("POST /api/dashboard/:guildId/sentinel/knowledge", async () => {
    const res = await requestJson("POST", `/api/dashboard/${GUILD_ID}/sentinel/knowledge`, {
      category: "SERVER_FAQ",
      title: "API Test Doc",
      content: "Contenuto informativo API v1",
      keywords: ["api", "test"]
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.doc.id);
    createdDocId = res.data.doc.id;
  });

  await runTest("GET /api/dashboard/:guildId/sentinel/knowledge", async () => {
    const res = await requestJson("GET", `/api/dashboard/${GUILD_ID}/sentinel/knowledge`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(res.data.items));
  });

  await runTest("POST /api/dashboard/:guildId/sentinel/knowledge/:id/rollback", async () => {
    const res = await requestJson("POST", `/api/dashboard/${GUILD_ID}/sentinel/knowledge/${createdDocId}/rollback`, {
      targetVersion: 1
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
  });

  await runTest("DELETE /api/dashboard/:guildId/sentinel/knowledge/:id", async () => {
    const res = await requestJson("DELETE", `/api/dashboard/${GUILD_ID}/sentinel/knowledge/${createdDocId}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
  });

  // 3. Learning Queue & Staff Feedback
  await runTest("GET /api/dashboard/:guildId/sentinel/learning/queue", async () => {
    const res = await requestJson("GET", `/api/dashboard/${GUILD_ID}/sentinel/learning/queue`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(res.data.queue));
  });

  await runTest("POST /api/dashboard/:guildId/sentinel/feedback", async () => {
    const res = await requestJson("POST", `/api/dashboard/${GUILD_ID}/sentinel/feedback`, {
      messageId: "msg_123",
      ticketId: "tkt_456",
      action: "CORRECT",
      correctionText: "Ottima risposta"
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
  });

  // 4. Memory Multi-Tenant Isolation
  await runTest("GET /api/dashboard/:guildId/sentinel/memory", async () => {
    const res = await requestJson("GET", `/api/dashboard/${GUILD_ID}/sentinel/memory`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.memory.guildId, GUILD_ID);
  });

  // 5. Audit, Health & Metrics
  await runTest("GET /api/dashboard/:guildId/sentinel/audit", async () => {
    const res = await requestJson("GET", `/api/dashboard/${GUILD_ID}/sentinel/audit`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(res.data.logs));
  });

  await runTest("GET /api/dashboard/:guildId/sentinel/health", async () => {
    const res = await requestJson("GET", `/api/dashboard/${GUILD_ID}/sentinel/health`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.health);
    assert.ok(res.data.modelStats);
  });

  await runTest("GET /api/dashboard/:guildId/sentinel/metrics", async () => {
    const res = await requestJson("GET", `/api/dashboard/${GUILD_ID}/sentinel/metrics`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.metrics);
  });

  // 6. Simulation & Canary
  await runTest("POST /api/dashboard/:guildId/sentinel/canary", async () => {
    const res = await requestJson("POST", `/api/dashboard/${GUILD_ID}/sentinel/canary`, { enabled: true });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.isCanary, true);
  });

  await runTest("POST /api/dashboard/:guildId/sentinel/simulate", async () => {
    const res = await requestJson("POST", `/api/dashboard/${GUILD_ID}/sentinel/simulate`, {
      type: "moderation",
      content: "Link sospetto https://discord-nitro.fake/nitro"
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.result.action, "ACT");
  });

  if (app.server) {
    app.server.close();
  }

  console.log("\n==================================================================");
  console.log(`🎉 TUTTI GLI ENDPOINT API SENTINEL VERIFICATI CON SUCCESSO! (${passed}/${total})`);
  console.log("==================================================================\n");
  process.exit(0);
}

run().catch(err => {
  console.error("Test API fallito:", err);
  process.exit(1);
});
