---
trigger: always_on
description: Standard architetturali per RoomUp! V2 Omnipresent Master Discord Bot Architecture (12 Aree, 60 Moduli).
---

# Architettura RoomUp! V2 — Omnipresent Master Architecture

Ogni modulo, comando o interfaccia web di RoomUp! V2 deve allinearsi alla matrice delle 12 Aree dell'ecosistema Discord:

1. **AREA 1: Advanced Moderation & Content Filtering**:
   - Spam/flood mitigation, regex blacklist dinamica, anti-link & phishing, filtri caratteri invisibili/zero-width, blocco allegati pericolosi (`.exe`, `.scr`, `.bat`).
2. **AREA 2: Anti-Raid & Server Defense (Anti-Nuke)**:
   - Join velocity watchdog, profile screening (quarantena account senza avatar o < soglia giorni), blocco raid mention (`@everyone`/`@here`), webhook defense e Panic Mode Lockdown.
3. **AREA 3: Disciplinary Systems & Punishment Escalation**:
   - Registro permanente infrazioni/warn, sanzioni progressive a soglia (3 = Timeout, 5 = Kick, 7 = Ban), timeout nativi Discord e audit logging motivato.
4. **AREA 4: Forensic Auditing Suite (Logging Engine)**:
   - 157+ eventi Discord tracciati (modifiche/cancellazioni messaggi con snapshot, ingressi/uscite con età account, variazioni ruoli, permessi e stati vocali).
5. **AREA 5: Self-Service Utilities & Interface Components**:
   - Ruoli a pulsante persistenti, menu a tendina (Select Menus) categorizzati e vincoli di esclusione reciproca (Mutex).
6. **AREA 6: Lifecycle Automation & Community Onboarding**:
   - Benvenuto dinamico e grafiche banner SVG/Canvas, autorole istantaneo, notifiche di uscita e apprezzamento boost nitro.
7. **AREA 7: Support Ticketing Infrastructure**:
   - Creazione ticket a pulsante, canali isolati con permessi per staff, routing per dipartimento (modal) ed esportazione transcript `.txt`/HTML.
8. **AREA 8: Progression & Gamification**:
   - Chat XP e Voice XP con cooldown anti-spam, ruoli traguardo automatici, profilo `/rank`. *(Nota: RoomCoins appartiene esclusivamente a V1)*.
9. **AREA 9: Entertainment, Gaming & Social Fun**:
   - Minigiochi interattivi in chat (Trivia, Math Challenge, Tic-Tac-Toe, Coinflip, RPS), generatore meme e Starboard ⭐ per i messaggi più votati.
10. **AREA 10: Operational Utilities & Management Tools**:
    - Tag e macro veloci, sondaggi interattivi con barre di avanzamento (`/poll`), builder di embed avanzati (`/embed-builder`), traduzione multilingua rapida e promemoria/countdown.
11. **AREA 11: External Integrations & Webhook Pipelines**:
    - Bridge Minecraft (`/mc-status` live query di giocatori, ping e MOTD), avvisi streaming Twitch/YouTube, webhook GitHub e partnership cross-server sincronizzate.
12. **AREA 12: Artificial Intelligence & Agentic Automations**:
    - Sentinel AI auto-apprendente con consultazione staff, assistente LLM naturale (`/ask-ai`), riassunto chat recente (`/summarize`) e configurazione multi-tenant isolata per ogni server.

### Integrità Porte & Processi:
- **Porta 3002**: riservata a RoomUp! V2 (Web Server & Dashboard).
- **Porta 3003**: riservata a Linea Temporale.
- **Bot V1**: attivo in background con i suoi RoomCoins sul server principale, garantendo zero spoiler sul server principale prima del rilascio ufficiale.
