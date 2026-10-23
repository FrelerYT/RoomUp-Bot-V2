const { createWebServer } = require('../src/web/server');

async function testStandalone() {
  const port = 3098;
  const app = createWebServer(port);
  const baseUrl = `http://localhost:${port}`;
  const guildId = '1429445691452948524';
  const results = [];

  function record(name, status, passed, detail) {
    results.push({ name, status, passed, detail });
    const tag = passed ? '[PASS]' : '[FAIL]';
    console.log(`${tag} ${name} (Status: ${status}) ${detail ? '- ' + detail : ''}`);
  }

  // Wait for server to start listening
  await new Promise(r => setTimeout(r, 600));

  try {
    // 1. GET /
    const r1 = await fetch(`${baseUrl}/`);
    record('GET /', r1.status, r1.status === 200, 'Visitor hero rendered');

    // 2. GET /login/dev
    const rLogin = await fetch(`${baseUrl}/login/dev`, { redirect: 'manual' });
    const cookie = rLogin.headers.get('set-cookie')?.split(';')[0] || '';
    record('GET /login/dev', rLogin.status, rLogin.status === 302 && Boolean(cookie), `Cookie: ${cookie.slice(0, 15)}...`);

    const headers = { 'Cookie': cookie, 'Content-Type': 'application/json' };

    // 3. GET / (authenticated)
    const rAuthRoot = await fetch(`${baseUrl}/`, { headers: { 'Cookie': cookie } });
    const authRootHtml = await rAuthRoot.text();
    record('GET / (authenticated)', rAuthRoot.status, rAuthRoot.status === 200 && authRootHtml.includes('RoomUp!'), 'Dashboard server selector loaded');

    // 4. GET /dashboard/:guildId (Standalone without client ready!)
    const rDash = await fetch(`${baseUrl}/dashboard/${guildId}`, { headers: { 'Cookie': cookie } });
    const dashHtml = await rDash.text();
    record(`GET /dashboard/${guildId} (standalone)`, rDash.status, rDash.status === 200 && dashHtml.includes('<!DOCTYPE html>'), `HTML size: ${dashHtml.length}`);

    // 5. GET /api/bot/status
    const rBotStatus = await fetch(`${baseUrl}/api/bot/status`);
    const dBotStatus = await rBotStatus.json();
    record('GET /api/bot/status', rBotStatus.status, dBotStatus.success === true && dBotStatus.ready === false, 'Bot offline reported cleanly');

    // 6. GET /api/guilds
    const rGuilds = await fetch(`${baseUrl}/api/guilds`);
    const dGuilds = await rGuilds.json();
    record('GET /api/guilds', rGuilds.status, Array.isArray(dGuilds), `Count: ${dGuilds.length}`);

    // 7. GET /api/dashboard/:guildId/config
    const rConfig = await fetch(`${baseUrl}/api/dashboard/${guildId}/config`);
    const dConfig = await rConfig.json();
    record('GET /api/dashboard/:guildId/config', rConfig.status, Boolean(dConfig.guildId), `Prefix: ${dConfig.prefix}`);

    // 8. POST /api/dashboard/:guildId/save
    const rSave = await fetch(`${baseUrl}/api/dashboard/${guildId}/save`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ prefix: '!' })
    });
    const dSave = await rSave.json();
    record('POST /api/dashboard/:guildId/save', rSave.status, dSave.success === true, dSave.message);

    // 9. Cases CRUD
    const rCaseAdd = await fetch(`${baseUrl}/api/dashboard/${guildId}/cases`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        targetId: '12345678',
        targetTag: 'Target#0000',
        action: 'WARN',
        reason: 'Standalone test case',
        evidence: ''
      })
    });
    const dCaseAdd = await rCaseAdd.json();
    record('POST /api/dashboard/:guildId/cases', rCaseAdd.status, dCaseAdd.success === true, dCaseAdd.message);
    const cId = dCaseAdd.case?.caseId;

    if (cId) {
      const rCasePatch = await fetch(`${baseUrl}/api/dashboard/${guildId}/cases/${cId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'RESOLVED' })
      });
      const dCasePatch = await rCasePatch.json();
      record(`PATCH /api/dashboard/:guildId/cases/${cId}`, rCasePatch.status, dCasePatch.success === true, dCasePatch.case?.status);
    }

    // 10. Sentinel APIs
    const rSentHealth = await fetch(`${baseUrl}/api/dashboard/${guildId}/sentinel/health`);
    const dSentHealth = await rSentHealth.json();
    record('GET /api/dashboard/:guildId/sentinel/health', rSentHealth.status, dSentHealth.success === true, dSentHealth.health?.aiStatus);

    const rSentMetrics = await fetch(`${baseUrl}/api/dashboard/${guildId}/sentinel/metrics`);
    const dSentMetrics = await rSentMetrics.json();
    record('GET /api/dashboard/:guildId/sentinel/metrics', rSentMetrics.status, dSentMetrics.success === true, `Resolution: ${dSentMetrics.metrics?.resolutionRate}`);

    const rSentSim = await fetch(`${baseUrl}/api/dashboard/${guildId}/sentinel/simulate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ type: 'message', content: 'Come posso aprire un ticket?' })
    });
    const dSentSim = await rSentSim.json();
    record('POST /api/dashboard/:guildId/sentinel/simulate', rSentSim.status, dSentSim.success === true, dSentSim.result?.action || 'processed');

  } catch (err) {
    console.error('Standalone test exception:', err);
  } finally {
    app.server.close(() => {
      console.log('Standalone test server closed cleanly.');
    });
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`\n=============================================================`);
  console.log(`STANDALONE TEST: ${passed} PASSED, ${failed} FAILED (Total: ${results.length})`);
  console.log(`=============================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

testStandalone();
