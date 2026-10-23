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

// 1. Inizializza Client Discord
console.log("[Init] Avvio Bot Discord RoomUp! V2...");
const client = createDiscordClient(token, clientId);

// 2. Inizializza Web Server Express
console.log(`[Init] Avvio Web Server Dashboard su porta ${port}...`);
const app = createWebServer();

console.log("=============================================================");
console.log("✅ Sistema Master V2 Inizializzato con Successo!");
console.log(`👉 Web Dashboard attiva su: http://localhost:${port}`);
console.log("=============================================================");
