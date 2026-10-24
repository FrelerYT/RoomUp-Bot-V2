require('dotenv').config();
const path = require('path');
const { createDiscordClient } = require('./discordBot');
const { createWebServer } = require('./webServer');

// Process Crash Resilience Guards
process.on('unhandledRejection', (reason, promise) => {
  console.error('[PROCESS GUARD - LineaTemporale] Unhandled Promise Rejection:', reason?.stack || reason?.message || reason);
});
process.on('uncaughtException', (err, origin) => {
  console.error(`[PROCESS GUARD - LineaTemporale] Uncaught Exception (${origin}):`, err?.stack || err?.message || err);
});

console.log('==============================================');
console.log('🚀 AVVIO LINEA TEMPORALE • BOT & DASHBOARD');
console.log('==============================================');

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const port = process.env.PORT || 3003;

if (!token) {
  console.error('❌ ERRORE: DISCORD_BOT_TOKEN mancante nel file .env!');
  process.exit(1);
}

// 1. Avvia Bot Discord
console.log('[Init] Connessione al bot Discord in corso...');
const client = createDiscordClient(token, clientId);

// 2. Avvia Web Server Express
console.log('[Init] Avvio Web Server Express su porta ' + port + '...');
const app = createWebServer();

console.log('==============================================');
console.log('✅ Sistema Linea Temporale Inizializzato!');
console.log('👉 Dashboard Web locale: http://localhost:' + port);
console.log('👉 Dashboard Partnership: http://localhost:' + port + '/partnershipdashboard');
console.log('👉 Pagina Evento Voti: http://localhost:' + port + '/evento');
console.log('==============================================');
