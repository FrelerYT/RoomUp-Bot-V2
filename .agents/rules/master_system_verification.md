---
description: Pipeline e standard di certificazione master end-to-end per RoomUp (122 controlli su 6 livelli)
globs: ["scripts/**/*.js", "test_*.js", "src/**/*.js"]
---

# Standard di Certificazione Master End-to-End

Ogni collaudo completo o rilascio di versione per RoomUp deve obbligatoriamente soddisfare i seguenti 6 livelli di certificazione:

## Livello 1: Integrità e Persistenza dei Dati
- Tutti i file in `data/` (`settings.json`, `cases.json`, `levels.json`, `economy.json`, `revisions.json`, `welcome_tracker.json`) devono esistere ed essere JSON sintatticamente validi.
- La configurazione del server target deve avere i moduli chiave attivi e i canali logistici mappati.

## Livello 2: Gateway Discord, Client e Cache Live
- Interrogazione dell'endpoint `/api/bot/status`:
  - `ready === true`
  - Client ID e Tag corretti (`RoomUp!#9111` - `1543608170327445634`).
  - Cache del server target popolata con membri, canali e ruoli.
  - Health check diagnostico `/api/dashboard/:guildId/diagnostics` con `success: true`.

## Livello 3: Validazione Funzionale di Tutti i 24 Motori Bot
- **Canvas HD Level Card**: Generazione in memoria con header magic bytes PNG (`89 50 4E 47`) e buffer non vuoto (>30KB).
- **Music & Voice TTS**: Coesistenza audio verificata (ducking, pause, independent) e permessi Ruolo DJ.
- **Audit Logger**: Calcolo durate relative in italiano (`formatTimeAgo`), deduplicazione chiavi (`wasRecentlyDispatched`).
- **Verifica**: Funzioni di isolamento canali per-membro (`applyChannelIsolation`, `resetChannelIsolation`).
- **Benvenuto**: Costruzione payload con divisore e tracciamento auto-eliminazione (`trackWelcomeMessage`).
- **AutoMod & Sentinel AI**: Simulazione valutazione testi (`simulateAiEvaluation`) con `decision: "allowed"` su frasi safe.
- **Warn, Ticket, Unban, Minigiochi**: Tutte le funzioni esportate e inizializzate correttamente.

## Livello 4: Web Server Dashboard, Template EJS e API REST
- Server attivo e reattivo su porta 3002.
- Rendering completo di `GET /dashboard/:guildId`:
  - DOCTYPE HTML integro.
  - Presenza di tutti i 38 tab (`tab-overview`, `tab-music`, `tab-verification`, `tab-welcome`, `tab-levels`, `tab-tickets`, `tab-logs`, `tab-appeals`, `tab-automod`, ecc.).
- API REST operative:
  - `GET /api/guilds`
  - `GET /api/dashboard/:guildId/config`
  - `POST /api/dashboard/:guildId/save`
  - `GET /api/dashboard/:guildId/backups` e `POST .../backups/create`
  - `GET /api/dashboard/:guildId/cases`
  - `GET /api/dashboard/:guildId/economy` e `POST .../economy/adjust`
  - `POST /api/dashboard/:guildId/panic-mode`
  - `POST /api/dashboard/:guildId/aimod/simulate`

## Livello 5: Live Dispatch su Discord Reale
- Invio reale di tutti i 19 eventi di log sui canali Discord dedicati (`#〽️・uscite-entrate`, `#💬・messaggi`, `#🏠・canali`, `#🔊・vocali`, `#🧑‍🤝‍🧑・membri`, `#🧢・ruoli`, `#🗄️・altro`, `#🎭・automod`).
- Ogni richiesta deve restituire `200 OK` con `messageId` Discord valido e verificato.

## Livello 6: Decommissioning Sistemi Legacy
- La porta 3001 del bot V1 deve risultare completamente inattiva.
- Gli script di avvio obsoleti (`AVVIA_BOT_V1.bat`) devono rimanere permanentemente disabilitati.
