const fs = require('fs');

async function runTests() {
  const baseUrl = 'http://localhost:3002';
  const guildId = '1429445691452948524';
  const results = [];

  function record(name, status, passed, detail) {
    results.push({ name, status, passed, detail });
    const tag = passed ? '[PASS]' : '[FAIL]';
    console.log(`${tag} ${name} (Status: ${status}) ${detail ? '- ' + detail : ''}`);
  }

  try {
    // 1. Unauthenticated Root
    const r1 = await fetch(`${baseUrl}/`);
    record('GET / (unauthenticated)', r1.status, r1.status === 200, 'HTML loaded');

    // 2. Dev Login
    const rLogin = await fetch(`${baseUrl}/login/dev`, { redirect: 'manual' });
    const cookieHeader = rLogin.headers.get('set-cookie');
    const cookie = cookieHeader ? cookieHeader.split(';')[0] : '';
    record('GET /login/dev', rLogin.status, rLogin.status === 302 && Boolean(cookie), `Cookie: ${cookie.slice(0, 20)}...`);

    const headers = { 'Cookie': cookie, 'Content-Type': 'application/json' };

    // 3. Authenticated Root
    const rRootAuth = await fetch(`${baseUrl}/`, { headers: { 'Cookie': cookie } });
    const rootHtml = await rRootAuth.text();
    record('GET / (authenticated)', rRootAuth.status, rRootAuth.status === 200 && rootHtml.includes('RoomUp'), 'Server selector loaded');

    // 4. Guild Dashboard
    const rDash = await fetch(`${baseUrl}/dashboard/${guildId}`, { headers: { 'Cookie': cookie } });
    const dashHtml = await rDash.text();
    record(`GET /dashboard/${guildId}`, rDash.status, rDash.status === 200 && dashHtml.includes('<!DOCTYPE html>'), `HTML size: ${dashHtml.length}`);

    // 5. Bot Status
    const rBotStatus = await fetch(`${baseUrl}/api/bot/status`);
    const dBotStatus = await rBotStatus.json();
    record('GET /api/bot/status', rBotStatus.status, dBotStatus.success === true, `Ping: ${dBotStatus.ping}ms`);

    // 6. Guilds list
    const rGuilds = await fetch(`${baseUrl}/api/guilds`);
    const dGuilds = await rGuilds.json();
    record('GET /api/guilds', rGuilds.status, Array.isArray(dGuilds), `Count: ${dGuilds.length}`);

    // 7. Get Config
    const rConfig = await fetch(`${baseUrl}/api/dashboard/${guildId}/config`);
    const dConfig = await rConfig.json();
    record('GET /api/dashboard/:guildId/config', rConfig.status, Boolean(dConfig.guildId), `Prefix: ${dConfig.prefix}`);

    // 8. Save Config
    const rSave = await fetch(`${baseUrl}/api/dashboard/${guildId}/save`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ prefix: '!' })
    });
    const dSave = await rSave.json();
    record('POST /api/dashboard/:guildId/save', rSave.status, dSave.success === true, dSave.message);

    // 9. Diagnostics
    const rDiag = await fetch(`${baseUrl}/api/dashboard/${guildId}/diagnostics`);
    const dDiag = await rDiag.json();
    record('GET /api/dashboard/:guildId/diagnostics', rDiag.status, dDiag.success === true, `Score: ${dDiag.health?.overallScore}`);

    // 10. Backups List
    const rBackups = await fetch(`${baseUrl}/api/dashboard/${guildId}/backups`);
    const dBackups = await rBackups.json();
    record('GET /api/dashboard/:guildId/backups', rBackups.status, dBackups.success === true, `Backups count: ${dBackups.backups?.length}`);

    // 11. Create Backup
    const rBackupCreate = await fetch(`${baseUrl}/api/dashboard/${guildId}/backups/create`, {
      method: 'POST',
      headers
    });
    const dBackupCreate = await rBackupCreate.json();
    record('POST /api/dashboard/:guildId/backups/create', rBackupCreate.status, dBackupCreate.success === true, dBackupCreate.message);

    // 12. Cases List
    const rCases = await fetch(`${baseUrl}/api/dashboard/${guildId}/cases`);
    const dCases = await rCases.json();
    record('GET /api/dashboard/:guildId/cases', rCases.status, dCases.success === true, `Cases count: ${dCases.cases?.length}`);

    // 13. Create Case
    const rCaseCreate = await fetch(`${baseUrl}/api/dashboard/${guildId}/cases`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        targetId: '999999999',
        targetTag: 'TestUser#0001',
        action: 'WARN',
        reason: 'Automated test sanction',
        evidence: 'Automated test suite run'
      })
    });
    const dCaseCreate = await rCaseCreate.json();
    record('POST /api/dashboard/:guildId/cases', rCaseCreate.status, dCaseCreate.success === true, dCaseCreate.message);
    const createdCaseId = dCaseCreate.case?.caseId;

    // 14. Patch Case
    if (createdCaseId) {
      const rCasePatch = await fetch(`${baseUrl}/api/dashboard/${guildId}/cases/${createdCaseId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'RESOLVED', reason: 'Sanction updated in test' })
      });
      const dCasePatch = await rCasePatch.json();
      record(`PATCH /api/dashboard/:guildId/cases/${createdCaseId}`, rCasePatch.status, dCasePatch.success === true, `New status: ${dCasePatch.case?.status}`);
    }

    // 15. Modmail
    const rModmail = await fetch(`${baseUrl}/api/dashboard/${guildId}/modmail`);
    const dModmail = await rModmail.json();
    record('GET /api/dashboard/:guildId/modmail', rModmail.status, dModmail.success === true, `Sessions: ${dModmail.storage?.sessions?.length}`);

    // 16. Forms Submissions
    const rForms = await fetch(`${baseUrl}/api/dashboard/${guildId}/forms/submissions`);
    const dForms = await rForms.json();
    record('GET /api/dashboard/:guildId/forms/submissions', rForms.status, dForms.success === true, `Submissions: ${dForms.submissions?.length}`);

    // 17. Knowledge Base
    const rKbGet = await fetch(`${baseUrl}/api/dashboard/${guildId}/kb`);
    const dKbGet = await rKbGet.json();
    record('GET /api/dashboard/:guildId/kb', rKbGet.status, dKbGet.success === true, `Articles: ${dKbGet.articles?.length}`);

    // 18. Knowledge Base Add Article
    const rKbAdd = await fetch(`${baseUrl}/api/dashboard/${guildId}/kb`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        category: 'Test',
        title: 'Guida Test Dashboard',
        content: 'Istruzioni dettagliate per il test.',
        keywords: ['test', 'guida']
      })
    });
    const dKbAdd = await rKbAdd.json();
    record('POST /api/dashboard/:guildId/kb', rKbAdd.status, dKbAdd.success === true, dKbAdd.message);

    // 19. Economy
    const rEco = await fetch(`${baseUrl}/api/dashboard/${guildId}/economy`);
    const dEco = await rEco.json();
    record('GET /api/dashboard/:guildId/economy', rEco.status, dEco.success === true, `Leaderboard: ${dEco.leaderboard?.length}`);

    // 20. Economy Adjust
    const rEcoAdj = await fetch(`${baseUrl}/api/dashboard/${guildId}/economy/adjust`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId: '1543608170327445634', amount: 100, type: 'wallet' })
    });
    const dEcoAdj = await rEcoAdj.json();
    record('POST /api/dashboard/:guildId/economy/adjust', rEcoAdj.status, dEcoAdj.success === true, dEcoAdj.message);

    // 21. Automations GET
    const rAutoGet = await fetch(`${baseUrl}/api/dashboard/${guildId}/automations`);
    const dAutoGet = await rAutoGet.json();
    record('GET /api/dashboard/:guildId/automations', rAutoGet.status, dAutoGet.success === true, `Automations: ${dAutoGet.automations?.length}`);

    // 22. Automations POST
    const rAutoPost = await fetch(`${baseUrl}/api/dashboard/${guildId}/automations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Auto Test Workflow',
        trigger: 'member_join',
        actions: [{ type: 'send_message', target: 'general', payload: 'Welcome!' }]
      })
    });
    const dAutoPost = await rAutoPost.json();
    record('POST /api/dashboard/:guildId/automations', rAutoPost.status, dAutoPost.success === true, dAutoPost.message);
    const createdAutoId = dAutoPost.automation?.id;

    // 23. Automations DELETE
    if (createdAutoId) {
      const rAutoDel = await fetch(`${baseUrl}/api/dashboard/${guildId}/automations/${createdAutoId}`, {
        method: 'DELETE',
        headers
      });
      const dAutoDel = await rAutoDel.json();
      record(`DELETE /api/dashboard/:guildId/automations/${createdAutoId}`, rAutoDel.status, dAutoDel.success === true, dAutoDel.message);
    }

    // 24. Revisions
    const rRevs = await fetch(`${baseUrl}/api/dashboard/${guildId}/revisions`);
    const dRevs = await rRevs.json();
    record('GET /api/dashboard/:guildId/revisions', rRevs.status, dRevs.success === true, `Revisions: ${dRevs.revisions?.length}`);

    // 25. Sentinel Config GET & POST
    const rSentCfg = await fetch(`${baseUrl}/api/dashboard/${guildId}/sentinel/config`);
    const dSentCfg = await rSentCfg.json();
    record('GET /api/dashboard/:guildId/sentinel/config', rSentCfg.status, dSentCfg.success === true, `Autonomy: ${dSentCfg.ai?.autonomyLevel}`);

    const rSentCfgPost = await fetch(`${baseUrl}/api/dashboard/${guildId}/sentinel/config`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ autonomyLevel: 4, temperature: 0.2, maxRisk: 'LOW' })
    });
    const dSentCfgPost = await rSentCfgPost.json();
    record('POST /api/dashboard/:guildId/sentinel/config', rSentCfgPost.status, dSentCfgPost.success === true, dSentCfgPost.message);

    // 26. Sentinel Knowledge GET, POST, DELETE
    const rSentKb = await fetch(`${baseUrl}/api/dashboard/${guildId}/sentinel/knowledge`);
    const dSentKb = await rSentKb.json();
    record('GET /api/dashboard/:guildId/sentinel/knowledge', rSentKb.status, dSentKb.success === true, `KB Items: ${dSentKb.items?.length}`);

    const rSentKbAdd = await fetch(`${baseUrl}/api/dashboard/${guildId}/sentinel/knowledge`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'Regola Sicurezza Test',
        category: 'SERVER_RULES',
        content: 'Nessun raid o spam consentito.',
        keywords: ['raid', 'spam', 'sicurezza']
      })
    });
    const dSentKbAdd = await rSentKbAdd.json();
    record('POST /api/dashboard/:guildId/sentinel/knowledge', rSentKbAdd.status, dSentKbAdd.success === true, dSentKbAdd.message);
    const sentDocId = dSentKbAdd.doc?.id;

    if (sentDocId) {
      const rSentKbDel = await fetch(`${baseUrl}/api/dashboard/${guildId}/sentinel/knowledge/${sentDocId}`, {
        method: 'DELETE',
        headers
      });
      const dSentKbDel = await rSentKbDel.json();
      record(`DELETE /api/dashboard/:guildId/sentinel/knowledge/${sentDocId}`, rSentKbDel.status, dSentKbDel.success === true, dSentKbDel.message);
    }

    // 27. Sentinel Learning Queue
    const rSentQueue = await fetch(`${baseUrl}/api/dashboard/${guildId}/sentinel/learning/queue`);
    const dSentQueue = await rSentQueue.json();
    record('GET /api/dashboard/:guildId/sentinel/learning/queue', rSentQueue.status, dSentQueue.success === true, `Queue size: ${dSentQueue.queue?.length}`);

    // 28. Sentinel Memory
    const rSentMem = await fetch(`${baseUrl}/api/dashboard/${guildId}/sentinel/memory`);
    const dSentMem = await rSentMem.json();
    record('GET /api/dashboard/:guildId/sentinel/memory', rSentMem.status, dSentMem.success === true, `Memory loaded`);

    const rSentMemExport = await fetch(`${baseUrl}/api/dashboard/${guildId}/sentinel/memory/export`);
    const dSentMemExport = await rSentMemExport.json();
    record('GET /api/dashboard/:guildId/sentinel/memory/export', rSentMemExport.status, dSentMemExport.success === true, `Exported`);

    // 29. Sentinel Audit
    const rSentAudit = await fetch(`${baseUrl}/api/dashboard/${guildId}/sentinel/audit`);
    const dSentAudit = await rSentAudit.json();
    record('GET /api/dashboard/:guildId/sentinel/audit', rSentAudit.status, dSentAudit.success === true, `Logs count: ${dSentAudit.logs?.length}`);

    // 30. Sentinel Health & Metrics
    const rSentHealth = await fetch(`${baseUrl}/api/dashboard/${guildId}/sentinel/health`);
    const dSentHealth = await rSentHealth.json();
    record('GET /api/dashboard/:guildId/sentinel/health', rSentHealth.status, dSentHealth.success === true, `Status: ${dSentHealth.health?.overallStatus}`);

    const rSentMetrics = await fetch(`${baseUrl}/api/dashboard/${guildId}/sentinel/metrics`);
    const dSentMetrics = await rSentMetrics.json();
    record('GET /api/dashboard/:guildId/sentinel/metrics', rSentMetrics.status, dSentMetrics.success === true, `Resolution: ${dSentMetrics.metrics?.resolutionRate}`);

    // 31. Sentinel Simulation
    const rSentSim = await fetch(`${baseUrl}/api/dashboard/${guildId}/sentinel/simulate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ type: 'message', content: 'Come posso aprire un ticket?' })
    });
    const dSentSim = await rSentSim.json();
    record('POST /api/dashboard/:guildId/sentinel/simulate', rSentSim.status, dSentSim.success === true, `Result: ${dSentSim.result?.action || 'processed'}`);

    // 32. Sentinel Canary
    const rSentCanary = await fetch(`${baseUrl}/api/dashboard/${guildId}/sentinel/canary`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ enabled: false })
    });
    const dSentCanary = await rSentCanary.json();
    record('POST /api/dashboard/:guildId/sentinel/canary', rSentCanary.status, dSentCanary.success === true, dSentCanary.message);

    // 33. AI Mod Simulation & Precedents
    const rAiSim = await fetch(`${baseUrl}/api/dashboard/${guildId}/aimod/simulate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: 'Ciao a tutti!' })
    });
    const dAiSim = await rAiSim.json();
    record('POST /api/dashboard/:guildId/aimod/simulate', rAiSim.status, dAiSim.success === true, `Suspicion: ${dAiSim.result?.suspicion}%`);

    const rAiPrec = await fetch(`${baseUrl}/api/dashboard/${guildId}/aimod/add-precedent`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ pattern: 'test spam rule', severity: 'low', actionTaken: 'warn' })
    });
    const dAiPrec = await rAiPrec.json();
    record('POST /api/dashboard/:guildId/aimod/add-precedent', rAiPrec.status, dAiPrec.success === true, dAiPrec.message);

    // 34. Custom Commands Add & Delete
    const rCmdAdd = await fetch(`${baseUrl}/api/dashboard/${guildId}/custom-commands/add`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ trigger: '!pingtest', response: 'Pong test!' })
    });
    const dCmdAdd = await rCmdAdd.json();
    record('POST /api/dashboard/:guildId/custom-commands/add', rCmdAdd.status, dCmdAdd.success === true, dCmdAdd.message);
    const cmdId = dCmdAdd.command?.id;

    if (cmdId) {
      const rCmdDel = await fetch(`${baseUrl}/api/dashboard/${guildId}/custom-commands/delete`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ triggerId: cmdId })
      });
      const dCmdDel = await rCmdDel.json();
      record('POST /api/dashboard/:guildId/custom-commands/delete', rCmdDel.status, dCmdDel.success === true, dCmdDel.message);
    }

    // 35. Partnerships Collabs
    const rCollabs = await fetch(`${baseUrl}/api/dashboard/${guildId}/partnerships/collabs`, {
      headers: { 'Cookie': cookie }
    });
    const dCollabs = await rCollabs.json();
    record('GET /api/dashboard/:guildId/partnerships/collabs', rCollabs.status, dCollabs.success === true, `Collabs: ${dCollabs.collabs?.length}`);

    // 36. Panic Mode
    const rPanic = await fetch(`${baseUrl}/api/dashboard/${guildId}/panic-mode`, {
      method: 'POST',
      headers
    });
    const dPanic = await rPanic.json();
    record('POST /api/dashboard/:guildId/panic-mode (toggle 1)', rPanic.status, dPanic.success === true, dPanic.message);

    // Toggle panic mode back off
    const rPanicOff = await fetch(`${baseUrl}/api/dashboard/${guildId}/panic-mode`, {
      method: 'POST',
      headers
    });
    const dPanicOff = await rPanicOff.json();
    record('POST /api/dashboard/:guildId/panic-mode (toggle 2 off)', rPanicOff.status, dPanicOff.success === true, dPanicOff.message);

  } catch (err) {
    console.error('Test Suite Encountered Exception:', err);
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`\n=============================================================`);
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (Total: ${results.length})`);
  console.log(`=============================================================`);
}

runTests();
