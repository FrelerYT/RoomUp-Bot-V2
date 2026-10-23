const http = require("http");

const GUILD_ID = "1429445691452948524";
const BASE_PORT = 3002;

const testEndpoints = [
  { endpoint: "member-join/test", name: "1. Member Join (Uscite e Entrate)", expectedChannel: "#〽️・uscite-entrate" },
  { endpoint: "member-leave/test", name: "2. Member Leave (Uscite e Entrate)", expectedChannel: "#〽️・uscite-entrate" },
  { endpoint: "message-create/test", name: "3. Message Create (Messaggi)", expectedChannel: "#💬・messaggi" },
  { endpoint: "message-update/test", name: "4. Message Update (Messaggi)", expectedChannel: "#💬・messaggi" },
  { endpoint: "message-delete/test", name: "5. Message Delete (Messaggi)", expectedChannel: "#💬・messaggi" },
  { endpoint: "channel-create/test", name: "6. Channel Create (Canali)", expectedChannel: "#🏠・canali" },
  { endpoint: "channel-update/test", name: "7. Channel Update (Canali)", expectedChannel: "#🏠・canali" },
  { endpoint: "channel-delete/test", name: "8. Channel Delete (Canali)", expectedChannel: "#🏠・canali" },
  { endpoint: "voice-join/test", name: "9. Voice Join (Vocali)", expectedChannel: "#🔊・vocali" },
  { endpoint: "voice-switch/test", name: "10. Voice Switch (Vocali)", expectedChannel: "#🔊・vocali" },
  { endpoint: "voice-leave/test", name: "11. Voice Leave (Vocali)", expectedChannel: "#🔊・vocali" },
  { endpoint: "verification/test", name: "12. Verification (Membri)", expectedChannel: "#🧑‍🤝‍🧑・membri" },
  { endpoint: "role-member-add/test", name: "13. Role Add to Member (Ruoli)", expectedChannel: "#🧢・ruoli" },
  { endpoint: "role-update/test", name: "14. Role Color Update (Ruoli)", expectedChannel: "#🧢・ruoli" },
  { endpoint: "invite-create/test", name: "15. Invite Create (Altro/Server)", expectedChannel: "#🗄️・altro" },
  { endpoint: "server-update/test", name: "16. Server Update (Altro/Server)", expectedChannel: "#🗄️・altro" },
  { endpoint: "member-timeout/test", name: "17. Member Timeout (Membri)", expectedChannel: "#🧑‍🤝‍🧑・membri" },
  { endpoint: "automod-action/test", name: "18. AutoMod Action (AutoMod)", expectedChannel: "#🎭・automod" },
  { endpoint: "generic-audit/test", name: "19. Universal Audit Event (Altro)", expectedChannel: "#🗄️・altro" }
];

function post(path) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({});
    const req = http.request({
      hostname: "localhost",
      port: BASE_PORT,
      path: path,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data)
      }
    }, (res) => {
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function runLiveTests() {
  console.log("=============================================================");
  console.log("🚀 AVVIO TEST LIVE DISPATCH LOG SU DISCORD REALE (V2)");
  console.log(`🎯 Server ID: ${GUILD_ID}`);
  console.log("=============================================================\n");

  let passed = 0;
  let failed = 0;

  for (const item of testEndpoints) {
    const url = `/api/dashboard/${GUILD_ID}/logs/${item.endpoint}`;
    try {
      const res = await post(url);
      if (res.status === 200 && res.data.success) {
        console.log(`✅ [200 OK] ${item.name}`);
        console.log(`   Canale target: ${item.expectedChannel}`);
        console.log(`   Messaggio: ${res.data.message}`);
        console.log(`   Discord Message ID: ${res.data.messageId || 'Inviato'}\n`);
        passed++;
      } else {
        console.error(`❌ [ERROR ${res.status}] ${item.name}`);
        console.error(`   Dettagli:`, res.data);
        failed++;
      }
    } catch (err) {
      console.error(`❌ [EXCEPTION] ${item.name}: ${err.message}`);
      failed++;
    }
    // Breve pausa per evitare ratelimit su Discord gateway
    await new Promise(r => setTimeout(r, 600));
  }

  console.log("=============================================================");
  console.log(`📊 RISULTATI LIVE DISPATCH: ${passed} SUCCESSI, ${failed} FALLITI (TOTALE: ${testEndpoints.length})`);
  console.log("=============================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runLiveTests();
