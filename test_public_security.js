/**
 * PUBLIC BOT SECURITY AUDIT SUITE
 * Verifies that dev backdoors / Accesso Rapido are completely removed,
 * strict OAuth2 state CSRF protection is in place,
 * all dashboard routes & APIs are strictly guarded,
 * security headers are enforced, and session cookie is hardened.
 */
const http = require("http");
const fs = require("fs");
const assert = require("assert");

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
    });
    req.on("error", reject);
    if (postData) {
      req.write(typeof postData === "string" ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runSecurityTests() {
  console.log("==================================================================");
  console.log("🛡️ PUBLIC BOT ENTERPRISE SECURITY TEST SUITE");
  console.log("==================================================================");

  let passed = 0;
  let failed = 0;

  function test(name, condition, extraInfo = "") {
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } else {
      console.log(`  ❌ [FAIL] ${name} ${extraInfo ? `(${extraInfo})` : ""}`);
      failed++;
    }
  }

  // 1. Check Homepage Views: No "Accesso Rapido" or "/login/dev"
  console.log("\n--- 1. Verification of Accesso Rapido Removal in Views ---");
  const indexHtml = fs.readFileSync("src/web/views/index.ejs", "utf8");
  test("index.ejs does NOT contain 'Accesso Rapido'", !indexHtml.includes("Accesso Rapido"));
  test("index.ejs does NOT contain '/login/dev'", !indexHtml.includes("/login/dev"));
  test("index.ejs contains 'Accedi con Discord'", indexHtml.includes("Accedi con Discord"));
  test("index.ejs contains 'Invita RoomUp'", indexHtml.includes("Invita RoomUp"));

  // 2. Check Dev Login Route Disabled
  console.log("\n--- 2. Dev / Quick Login Route Disabled ---");
  const devLoginRes = await request({
    hostname: "localhost",
    port: 3002,
    path: "/login/dev",
    method: "GET"
  });
  test("GET /login/dev returns HTTP 404", devLoginRes.statusCode === 404, `Got: ${devLoginRes.statusCode}`);

  // 3. Strict OAuth2 Login Route & CSRF State
  console.log("\n--- 3. OAuth2 Login & CSRF State Verification ---");
  const loginRes = await request({
    hostname: "localhost",
    port: 3002,
    path: "/login",
    method: "GET"
  });
  test("GET /login redirects to Discord OAuth2 (HTTP 302)", loginRes.statusCode === 302, `Got: ${loginRes.statusCode}`);
  const redirectLoc = loginRes.headers.location || "";
  test("OAuth2 redirect URL points to discord.com/api/oauth2/authorize", redirectLoc.includes("discord.com/api/oauth2/authorize"));
  test("OAuth2 redirect URL contains secure random state", /state=[a-f0-9]{48}/.test(redirectLoc));
  test("OAuth2 redirect URL requests identify & guilds scopes", redirectLoc.includes("scope=identify%20guilds"));

  // 4. Session Cookie Hardening
  console.log("\n--- 4. Session Cookie Hardening ---");
  const setCookie = loginRes.headers["set-cookie"] || [];
  const sessionCookie = setCookie.find(c => c.startsWith("roomup_sid="));
  test("Session cookie name is 'roomup_sid' (not connect.sid)", !!sessionCookie);
  if (sessionCookie) {
    test("Session cookie has HttpOnly flag", sessionCookie.includes("HttpOnly") || sessionCookie.includes("httponly"));
    test("Session cookie has SameSite=Lax", sessionCookie.includes("SameSite=Lax") || sessionCookie.includes("samesite=lax"));
  }

  // 5. Security Headers
  console.log("\n--- 5. HTTP Security Headers ---");
  const healthRes = await request({
    hostname: "localhost",
    port: 3002,
    path: "/api/health",
    method: "GET"
  });
  test("Header X-Content-Type-Options is nosniff", healthRes.headers["x-content-type-options"] === "nosniff");
  test("Header X-Frame-Options is SAMEORIGIN", healthRes.headers["x-frame-options"] === "SAMEORIGIN");
  test("Header X-XSS-Protection is 1; mode=block", healthRes.headers["x-xss-protection"] === "1; mode=block");
  test("Header Referrer-Policy is strict-origin-when-cross-origin", healthRes.headers["referrer-policy"] === "strict-origin-when-cross-origin");
  test("X-Powered-By header is removed", !healthRes.headers["x-powered-by"]);

  // 6. Multi-Guild Isolation & Authorization Guards
  console.log("\n--- 6. Multi-Guild Dashboard & API Protection ---");

  // A. Accessing dashboard without session
  const dashNoAuth = await request({
    hostname: "localhost",
    port: 3002,
    path: "/dashboard/1429445691452948524",
    method: "GET"
  });
  test("GET /dashboard/:guildId without session redirects to /login (302)", dashNoAuth.statusCode === 302 && (dashNoAuth.headers.location || "").includes("login"));

  // B. Attempting dev bypass via query parameter
  const dashBypass = await request({
    hostname: "localhost",
    port: 3002,
    path: "/dashboard/1429445691452948524?bypass=dev",
    method: "GET"
  });
  test("GET /dashboard/:guildId?bypass=dev does NOT bypass auth (redirects to /login)", dashBypass.statusCode === 302 && (dashBypass.headers.location || "").includes("login"));

  // C. Calling config API without auth
  const apiConfigNoAuth = await request({
    hostname: "localhost",
    port: 3002,
    path: "/api/dashboard/1429445691452948524/config",
    method: "GET"
  });
  test("GET /api/dashboard/:guildId/config without auth returns 403 Forbidden", apiConfigNoAuth.statusCode === 403, `Got: ${apiConfigNoAuth.statusCode}`);

  // D. Calling save API without auth
  const apiSaveNoAuth = await request({
    hostname: "localhost",
    port: 3002,
    path: "/api/dashboard/1429445691452948524/save",
    method: "POST",
    headers: { "Content-Type": "application/json" }
  }, { prefix: "!" });
  test("POST /api/dashboard/:guildId/save without auth returns 403 Forbidden", apiSaveNoAuth.statusCode === 403, `Got: ${apiSaveNoAuth.statusCode}`);

  // E. Calling send-embed API without auth
  const apiSendEmbedNoAuth = await request({
    hostname: "localhost",
    port: 3002,
    path: "/api/dashboard/1429445691452948524/send-embed",
    method: "POST",
    headers: { "Content-Type": "application/json" }
  }, { channelId: "123", content: "test" });
  test("POST /api/dashboard/:guildId/send-embed without auth returns 403 Forbidden", apiSendEmbedNoAuth.statusCode === 403, `Got: ${apiSendEmbedNoAuth.statusCode}`);

  // F. Calling panel ticket API without auth
  const apiPanelNoAuth = await request({
    hostname: "localhost",
    port: 3002,
    path: "/api/dashboard/1429445691452948524/panel/ticket",
    method: "POST",
    headers: { "Content-Type": "application/json" }
  }, { channelId: "123" });
  test("POST /api/dashboard/:guildId/panel/ticket without auth returns 403 Forbidden", apiPanelNoAuth.statusCode === 403, `Got: ${apiPanelNoAuth.statusCode}`);

  // G. Invalid Snowflake ID format rejection
  const apiInvalidSnowflake = await request({
    hostname: "localhost",
    port: 3002,
    path: "/api/dashboard/not_a_snowflake/config",
    method: "GET"
  });
  test("Non-numeric/invalid guildId rejected with 400 Bad Request", apiInvalidSnowflake.statusCode === 400, `Got: ${apiInvalidSnowflake.statusCode}`);

  console.log(`\n==================================================================`);
  console.log(`📊 RISULTATI AUDIT SICUREZZA: ${passed} SUPERATI, ${failed} FALLITI`);
  console.log(`==================================================================\n`);

  if (failed > 0) process.exit(1);
}

runSecurityTests().catch(err => {
  console.error("FATAL ERROR IN SECURITY SUITE:", err);
  process.exit(1);
});
