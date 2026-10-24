require("dotenv").config();
const { createDiscordClient } = require("./bot/client");
const { createWebServer } = require("./web/server");

const path = require("path");
const fs = require("fs");

// Single-instance PID Guard: Prevents dual-process Gateway conflict and offline/online flickering
const PID_FILE = path.join(__dirname, "../roomup_bot.pid");
try {
  if (fs.existsSync(PID_FILE)) {
    const oldPid = parseInt(fs.readFileSync(PID_FILE, "utf8").trim(), 10);
    if (!isNaN(oldPid) && oldPid !== process.pid) {
      try {
        process.kill(oldPid, 0);
        console.warn(`[Init] Rilevata istanza precedente di RoomUp-Bot-V2 (PID ${oldPid}). Chiusura ordinata in corso...`);
        process.kill(oldPid, "SIGTERM");
      } catch (e) {
        // PID file is stale
      }
    }
  }
  fs.writeFileSync(PID_FILE, String(process.pid));
} catch (e) {}

function cleanupPid() {
  try {
    if (fs.existsSync(PID_FILE)) {
      const p = parseInt(fs.readFileSync(PID_FILE, "utf8").trim(), 10);
      if (p === process.pid) fs.unlinkSync(PID_FILE);
    }
  } catch (e) {}
}

process.on("exit", cleanupPid);
process.on("SIGINT", () => { cleanupPid(); process.exit(0); });
process.on("SIGTERM", () => { cleanupPid(); process.exit(0); });

// Global Resilience Guards: Prevent unexpected network/API errors from killing the bot
process.on("unhandledRejection", (reason, promise) => {
  console.error("[CRITICAL PROCESS GUARD] Unhandled Promise Rejection:", reason?.stack || reason?.message || reason);
});

process.on("uncaughtException", (err, origin) => {
  console.error(`[CRITICAL PROCESS GUARD] Uncaught Exception (${origin}):`, err?.stack || err?.message || err);
});

console.log("=============================================================");
console.log("🚀 AVVIO ROOMUP V2 - MASTER BOT & MULTI-GUILD WEB DASHBOARD");
console.log("=============================================================");

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const port = process.env.PORT || 3002;

if (!token) {
  console.error("❌ ERRORE CRITICO: DISCORD_BOT_TOKEN mancante nel file .env!");
  process.exit(1);
}

// 1. Inizializza Client Discord RoomUp V2
console.log("[Init] Avvio Bot Discord RoomUp! V2...");
const client = createDiscordClient(token, clientId);

// 2. Inizializza Client Discord Bot Partnership (Linea Temporale)
console.log("[Init] Avvio Bot Discord Linea Temporale (Partnership & Eventi)...");
let partnershipClient = null;
try {
  const { createDiscordClient: createPartnershipClient } = require("./partnershipBot/discordBot");
  const partnerToken = process.env.PARTNERSHIP_BOT_TOKEN;
  const partnerClientId = process.env.PARTNERSHIP_CLIENT_ID || "1546192386546470963";
  if (partnerToken) {
    partnershipClient = createPartnershipClient(partnerToken, partnerClientId);
  } else {
    console.warn("[Init] PARTNERSHIP_BOT_TOKEN non impostato. Bot Discord Partnership disattivato in questo ambiente.");
  }
} catch (err) {
  console.error("[Init] Avviso avvio Bot Partnership:", err.message);
}

// 3. Inizializza Web Server Express
console.log(`[Init] Avvio Web Server Dashboard su porta ${port}...`);
const app = createWebServer();

// 3. Self-ping keepalive su Render Cloud (evita sleep dopo 15 minuti)
// Funziona solo quando RENDER_EXTERNAL_URL è definita (in produzione su Render)
const renderUrl = process.env.RENDER_EXTERNAL_URL;
if (renderUrl) {
  const PING_INTERVAL = 13 * 60 * 1000; // ogni 13 minuti
  setInterval(async () => {
    try {
      const res = await fetch(`${renderUrl}/api/health`);
      const json = await res.json();
      console.log(`[KeepAlive] Render self-ping OK — uptime: ${Math.floor(json.uptime || 0)}s`);
    } catch (e) {
      console.warn("[KeepAlive] Render self-ping fallito:", e.message);
    }
  }, PING_INTERVAL);
  console.log(`[KeepAlive] Self-ping Render attivo ogni 13 minuti su ${renderUrl}/api/health`);
}

console.log("=============================================================");
console.log("✅ Sistema Master V2 Inizializzato con Successo!");
console.log(`👉 Web Dashboard attiva su: http://localhost:${port}`);
console.log("=============================================================");
