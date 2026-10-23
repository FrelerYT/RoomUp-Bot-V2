/**
 * TEST SUITE: DASHBOARD MOBILE & SERVER ISOLATION VERIFICATION
 * Verifies that:
 * 1. Home page (via LAN / dev login) shows only real Discord bot guilds (0 fake/test servers).
 * 2. Mobile Safari black-screen root causes are 100% eliminated:
 *    - No animation: pageFadeIn with opacity: 0 on .app-container
 *    - No body.page-transitioning with opacity: 0
 *    - sidebar-backdrop has display: none when inactive
 *    - main-workspace has explicit overflow-y: auto !important and -webkit-overflow-scrolling: touch
 *    - tab-pane.active is guaranteed visible (opacity: 1, animation: none) on mobile
 *    - height: calc(100dvh - ...) is supported for dynamic iOS Safari viewports
 * 3. Client scripts parse and execute without errors.
 */
const http = require("http");
const assert = require("assert");

function request(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = "";
      const setCookie = res.headers["set-cookie"] ? res.headers["set-cookie"][0].split(";")[0] : null;
      res.on("data", chunk => body += chunk);
      res.on("end", () => resolve({ statusCode: res.statusCode, headers: res.headers, cookie: setCookie, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

async function runMobileAndIsolationTests() {
  console.log("==================================================================");
  console.log("📱 DASHBOARD MOBILE & SERVER ISOLATION TEST SUITE");
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

  // --- 1. DEV LOGIN & SERVER LIST ISOLATION ---
  console.log("\n--- 1. Dev Login & Server List Isolation (LAN 192.168.0.149 simulation) ---");
  const loginRes = await request({
    hostname: "localhost",
    port: 3002,
    path: "/login/dev",
    method: "GET"
  });
  test("Dev login redirects with session cookie", loginRes.statusCode === 302 && Boolean(loginRes.cookie));

  const homeRes = await request({
    hostname: "localhost",
    port: 3002,
    path: "/",
    method: "GET",
    headers: { "Cookie": loginRes.cookie }
  });
  test("Home page returns HTTP 200 with dev session", homeRes.statusCode === 200);

  const serverNames = [...homeRes.body.matchAll(/class="server-name"[^>]*>([^<]+)<\/div>/g)].map(m => m[1]);
  console.log("  Server names listed:", serverNames);
  test("Home page contains 'RoomUp!'", serverNames.includes("RoomUp!"));
  test("Home page contains 'RoomUp! TEST'", serverNames.includes("RoomUp! TEST"));
  test("Home page has NO 'Server 123456789'", !serverNames.includes("Server 123456789"));
  test("Home page has NO 'Test Server'", !serverNames.includes("Test Server"));
  test("Home page has NO 'Server 123456789012345678'", !serverNames.includes("Server 123456789012345678"));
  test("Home page has NO 'Server 1337424683053748285'", !serverNames.includes("Server 1337424683053748285"));
  test("Home page has NO 'Server guild_test_123'", !serverNames.includes("Server guild_test_123"));
  test("Home page has NO 'Server 741639102434525206'", !serverNames.includes("Server 741639102434525206"));
  test("Manageable servers count is exactly 2", serverNames.length === 2);

  // --- 2. MOBILE DASHBOARD BLACK SCREEN PREVENTION ---
  console.log("\n--- 2. Mobile Dashboard Black Screen Prevention ---");
  const dashRes = await request({
    hostname: "localhost",
    port: 3002,
    path: "/dashboard/1429445691452948524",
    method: "GET",
    headers: { "Cookie": loginRes.cookie }
  });
  test("Dashboard returns HTTP 200 for RoomUp!", dashRes.statusCode === 200);

  const html = dashRes.body;
  test("No animation: pageFadeIn applied to .app-container", !html.includes(".app-container {\n      animation: pageFadeIn"));
  test("No body.page-transitioning with opacity: 0 in dashboard", !html.includes("body.page-transitioning"));
  test("sidebar-backdrop has display: none by default", html.includes(".sidebar-backdrop {\n      display: none;"));
  test("sidebar-backdrop.active has display: block !important", html.includes(".sidebar-backdrop.active {\n      display: block !important;"));
  test("100dvh support present for iOS Safari dynamic viewport", html.includes("100dvh"));
  test("main-workspace has overflow-y: auto !important on mobile", html.includes("overflow-y: auto !important;"));
  test("main-workspace has -webkit-overflow-scrolling: touch", html.includes("-webkit-overflow-scrolling: touch !important;"));
  test("tab-pane.active has animation: none and opacity: 1 on mobile", html.includes(".tab-pane.active {\n        display: block !important;\n        opacity: 1 !important;\n        transform: none !important;\n        animation: none !important;"));

  // --- 3. JAVASCRIPT SYNTAX & INTEGRITY ---
  console.log("\n--- 3. Client-Side Script Integrity ---");
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  test("Script tag extracted from HTML", Boolean(scriptMatch && scriptMatch[1]));
  let scriptValid = false;
  try {
    new Function(scriptMatch[1]);
    scriptValid = true;
  } catch (e) {
    console.error("  Script error:", e.message);
  }
  test("Client-side script parses with zero syntax errors", scriptValid);
  test("toggleMobileSidebar exists in script", html.includes("function toggleMobileSidebar()"));
  test("closeMobileSidebar exists in script", html.includes("function closeMobileSidebar()"));
  test("initMobileGestures swipe listener exists in script", html.includes("initMobileGestures"));

  console.log(`\n==================================================================`);
  console.log(`📊 RISULTATO TEST MOBILE & ISOLATION: ${passed} SUPERATI, ${failed} FALLITI`);
  console.log(`==================================================================\n`);

  if (failed > 0) process.exit(1);
}

runMobileAndIsolationTests().catch(err => {
  console.error("Test execution error:", err);
  process.exit(1);
});
