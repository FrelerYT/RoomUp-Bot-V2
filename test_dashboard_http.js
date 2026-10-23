/**
 * LIVE HTTP DASHBOARD TEST SUITE
 * Sends real HTTP requests to the live running Express dashboard on port 3002
 */
const http = require("http");
const assert = require("assert");

function request(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

async function runHttpTests() {
  console.log("==================================================================");
  console.log("🌐 LIVE HTTP DASHBOARD TEST SUITE (PORT 3002)");
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

  // --- TEST 1: Home page (GET /) ---
  console.log("\n--- 1. Home Route (GET /) ---");
  const homeRes = await request({
    hostname: "localhost",
    port: 3002,
    path: "/",
    method: "GET"
  });

  test("Home page returns HTTP 200", homeRes.statusCode === 200);
  test("Home page contains RoomUp branding", homeRes.body.includes("RoomUp"));
  console.log(`  Status: ${homeRes.statusCode}, Body size: ${Math.round(homeRes.body.length / 1024)}KB`);

  // --- TEST 2: Dashboard for RoomUp (GET /dashboard/1429445691452948524) ---
  console.log("\n--- 2. RoomUp Guild Dashboard (GET /dashboard/1429445691452948524) ---");
  const dashRes = await request({
    hostname: "localhost",
    port: 3002,
    path: "/dashboard/1429445691452948524",
    method: "GET",
    headers: {
      "x-test-auth": "true"
    }
  });

  test("RoomUp Dashboard returns HTTP 200", dashRes.statusCode === 200);
  test("Dashboard body is non-empty (>100KB)", dashRes.body.length > 100000);
  console.log(`  Status: ${dashRes.statusCode}, Body size: ${Math.round(dashRes.body.length / 1024)}KB`);

  // Hidden Tabs Verification for RoomUp:
  test("tab-economy pane is NOT rendered", !dashRes.body.includes('id="tab-economy"'));
  test("tab-entertainment pane is NOT rendered", !dashRes.body.includes('id="tab-entertainment"'));
  test("Economy nav button is NOT rendered", !dashRes.body.includes("switchTab('tab-economy')"));
  test("Entertainment nav button is NOT rendered", !dashRes.body.includes("switchTab('tab-entertainment')"));
  test("Minigiochi overview card is NOT rendered", !dashRes.body.includes('data-module-name="Minigiochi"'));

  // Active Tabs Verification for RoomUp:
  test("Counting tab pane IS rendered", dashRes.body.includes('id="tab-counting"'));
  test("Counting nav button IS rendered", dashRes.body.includes("switchTab('tab-counting')"));
  test("Sentinel AI tab pane IS rendered", dashRes.body.includes('id="tab-sentinel"') || dashRes.body.includes("tab-sentinel"));
  test("Tickets tab pane IS rendered", dashRes.body.includes('id="tab-tickets"') || dashRes.body.includes("tab-tickets"));
  test("Partnership tab pane IS rendered", dashRes.body.includes('id="tab-partnership"') || dashRes.body.includes("tab-partnership"));
  test("Moderation (AI Mod) tab pane IS rendered", dashRes.body.includes('id="tab-aimod"') || dashRes.body.includes("tab-aimod"));

  // --- TEST 3: Unauthorized Access Guard ---
  console.log("\n--- 3. Unauthorized Access Guard ---");
  const unauthRes = await request({
    hostname: "localhost",
    port: 3002,
    path: "/dashboard/1429445691452948524",
    method: "GET"
  });

  test("Unauthorized request is redirected to /login", unauthRes.statusCode === 302 && unauthRes.headers.location.includes("login"));

  console.log(`\n==================================================================`);
  console.log(`📊 RISULTATO TEST LIVE HTTP: ${passed} SUPERATI, ${failed} FALLITI`);
  console.log(`==================================================================\n`);

  if (failed > 0) process.exit(1);
}

runHttpTests().catch(err => {
  console.error("HTTP TEST ERROR:", err);
  process.exit(1);
});
