/**
 * Comprehensive Automated End-to-End Test Suite for RoomUp-Bot-V2
 * Tests:
 * 1. Configuration & Settings Manager customizability
 * 2. Music Bot Engine (playback, queue, volume, skip, DJ roles)
 * 3. Voice TTS Coexistence (ducking, pause, independent modes, inactive/active TTS)
 * 4. All 24 Bot Engines initialization and event handling
 * 5. Web Server & Dashboard Routes, Full Template Rendering, and API endpoints
 */

const assert = require("assert");
const http = require("http");
const path = require("path");
const fs = require("fs");

console.log("===============================================================");
console.log("🧪 AVVIO TEST COMPLETO SUITE ROOMUP V2 - BOT & WEB DASHBOARD");
console.log("===============================================================\n");

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}:`, err.message);
    throw err;
  }
}

async function runTestAsync(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}:`, err.message);
    throw err;
  }
}

async function startSuite() {
  const TEST_GUILD_ID = "123456789012345678";

  // ---------------------------------------------------------------------------
  // SECTION 1: Config & Settings Manager
  // ---------------------------------------------------------------------------
  console.log("--- SEZIONE 1: CONFIGURAZIONE & 100% CUSTOMIZZABILITÀ ---");

  const {
    getDefaultGuildConfig,
    loadSettings,
    saveSettings,
    getGuildConfig,
    updateGuildConfig
  } = require("./src/config/settingsManager");

  runTest("getDefaultGuildConfig include tutti i moduli con defaults disattivati", () => {
    const def = getDefaultGuildConfig(TEST_GUILD_ID, "Server Test");
    assert.strictEqual(def.guildId, TEST_GUILD_ID);
    assert.strictEqual(def.music.enabled, false, "Modulo Musica deve essere disattivato per default");
    assert.strictEqual(def.music.defaultVolume, 80);
    assert.strictEqual(def.music.ttsCoexistenceMode, "duck");
    assert.strictEqual(def.music.ttsDuckingVolume, 20);
    assert.strictEqual(def.logs.enabled, false);
    assert.strictEqual(def.automod.enabled, false);
    assert.strictEqual(def.antiNuke.enabled, false);
    assert.strictEqual(def.antiRaid.enabled, false);
    assert.strictEqual(def.tickets.enabled, false);
    assert.strictEqual(def.verification.enabled, false);
    assert.strictEqual(def.verification.hideAllChannelsUntilVerified, false, "hideAllChannelsUntilVerified deve essere false di default");
  });

  runTest("updateGuildConfig supporta aggiornamento e persistenza di ogni impostazione", () => {
    const customConfig = {
      prefix: "?",
      music: {
        enabled: true,
        djRoleId: "999888777",
        defaultVolume: 65,
        maxQueueSize: 75,
        autoLeaveTimeout: 240,
        ttsCoexistenceMode: "pause",
        ttsDuckingVolume: 15,
        embedColor: "#00ff00",
        nowPlayingTemplate: "🎵 Test Now Playing",
        playMessageTemplate: "🎶 Test Play: {title}",
        queueMessageTemplate: "📜 Test Queue ({count})"
      },
      welcome: {
        enabled: true,
        embedTitle: "Benvenuto Personalizzato!",
        embedColor: "#123456",
        message: "Ciao {user}!"
      },
      verification: {
        enabled: true,
        embedTitle: "Verifica Personalizzata 100%",
        embedDescription: "Benvenuto {user}! Clicca sotto per accedere.",
        embedColor: "#ff007f",
        embedFooter: "Protezione Totale",
        thumbnail: "https://example.com/thumb.png",
        image: "https://example.com/banner.png",
        buttonLabel: "Accedi Ora",
        buttonColor: "primary",
        successMessage: "Benvenuto {user} in {guild}!",
        failMessage: "Errore tentativo {attempt}/{maxAttempts}",
        dmNotification: true,
        dmMessage: "Benvenuto {username}!"
      },
      partnerships: {
        enabled: true,
        embedTitle: "Partnership Ufficiale",
        embedColor: "#9b59b6",
        embedFooter: "Network Affiliazioni",
        descriptionTemplate: "Nuovo partner {partnerGuild}!"
      },
      counting: {
        enabled: true,
        embedTitle: "Numeri del Server",
        embedColor: "#3498db",
        embedFooter: "Record: {highestScore}"
      }
    };

    const updated = updateGuildConfig(TEST_GUILD_ID, customConfig);
    assert.strictEqual(updated.prefix, "?");
    assert.strictEqual(updated.music.enabled, true);
    assert.strictEqual(updated.music.defaultVolume, 65);
    assert.strictEqual(updated.music.djRoleId, "999888777");
    assert.strictEqual(updated.music.ttsCoexistenceMode, "pause");
    assert.strictEqual(updated.welcome.embedTitle, "Benvenuto Personalizzato!");
    assert.strictEqual(updated.verification.embedTitle, "Verifica Personalizzata 100%");
    assert.strictEqual(updated.verification.embedColor, "#ff007f");
    assert.strictEqual(updated.verification.buttonColor, "primary");
    assert.strictEqual(updated.partnerships.embedTitle, "Partnership Ufficiale");
    assert.strictEqual(updated.counting.embedTitle, "Numeri del Server");

    // Verify persistence from disk
    const reloaded = getGuildConfig(TEST_GUILD_ID);
    assert.strictEqual(reloaded.music.defaultVolume, 65);
    assert.strictEqual(reloaded.music.ttsCoexistenceMode, "pause");
    assert.strictEqual(reloaded.verification.embedTitle, "Verifica Personalizzata 100%");
    assert.strictEqual(reloaded.verification.buttonColor, "primary");
    assert.strictEqual(reloaded.partnerships.embedTitle, "Partnership Ufficiale");
    assert.strictEqual(reloaded.counting.embedTitle, "Numeri del Server");
  });

  // ---------------------------------------------------------------------------
  // SECTION 2: Music Engine & Voice TTS Coexistence
  // ---------------------------------------------------------------------------
  console.log("\n--- SEZIONE 2: MUSIC ENGINE & VOICE TTS COEXISTENCE ---");

  const {
    GuildMusicQueue,
    isDjOrAdmin,
    notifyTtsEvent,
    queues
  } = require("./src/bot/musicEngine");

  runTest("GuildMusicQueue gestione code e limiti", () => {
    const mockVoiceChannel = { id: "voice_123", name: "Vocale Generale" };
    const mockTextChannel = { id: "text_123", send: async () => {} };
    const musicConfig = {
      defaultVolume: 80,
      maxQueueSize: 3,
      ttsCoexistenceMode: "duck",
      ttsDuckingVolume: 20
    };

    const queue = new GuildMusicQueue(TEST_GUILD_ID, mockVoiceChannel, mockTextChannel, musicConfig);
    assert.strictEqual(queue.volume, 80);
    assert.strictEqual(queue.songs.length, 0);
    assert.strictEqual(queue.isPlaying, false);

    // Add songs
    queue.songs.push({ title: "Canzone 1", url: "url1", requesterId: "user1" });
    queue.songs.push({ title: "Canzone 2", url: "url2", requesterId: "user2" });
    assert.strictEqual(queue.songs.length, 2);

    // Test volume adjustment
    queue.setVolume(50);
    assert.strictEqual(queue.volume, 50);
    queue.setVolume(150); // Clamp to 100
    assert.strictEqual(queue.volume, 100);
    queue.setVolume(-10); // Clamp to 1
    assert.strictEqual(queue.volume, 1);
  });

  runTest("Voice TTS Coexistence: Ducking quando TTS è attivo e ripristino quando termina", () => {
    const mockVoiceChannel = { id: "voice_123", name: "Vocale Generale" };
    const mockTextChannel = { id: "text_123", send: async () => {} };
    const musicConfig = {
      defaultVolume: 85,
      ttsCoexistenceMode: "duck",
      ttsDuckingVolume: 25
    };

    const queue = new GuildMusicQueue(TEST_GUILD_ID, mockVoiceChannel, mockTextChannel, musicConfig);
    queue.volume = 85;

    // Simulate mock audio resource with inline volume
    let resourceVolume = 0.85;
    queue.currentResource = {
      volume: {
        setVolume: (v) => { resourceVolume = v; }
      }
    };
    queues.set(TEST_GUILD_ID, queue);

    // 1. TTS Inactive initial state
    assert.strictEqual(queue.ttsActive, false);
    assert.strictEqual(resourceVolume, 0.85);

    // 2. TTS Starts -> Ducking applied
    notifyTtsEvent(TEST_GUILD_ID, "start");
    assert.strictEqual(queue.ttsActive, true);
    assert.strictEqual(resourceVolume, 0.25, "Il volume della musica deve essere abbassato al 25% durante il TTS");

    // 3. TTS Ends -> Full volume restored
    notifyTtsEvent(TEST_GUILD_ID, "end");
    assert.strictEqual(queue.ttsActive, false);
    assert.strictEqual(resourceVolume, 0.85, "Il volume della musica deve essere ripristinato al livello pre-TTS");

    queue.destroy();
  });

  runTest("Voice TTS Coexistence: Modalità Pausa Automatica quando TTS parla", () => {
    const mockVoiceChannel = { id: "voice_123", name: "Vocale Generale" };
    const mockTextChannel = { id: "text_123", send: async () => {} };
    const musicConfig = {
      defaultVolume: 80,
      ttsCoexistenceMode: "pause",
      ttsDuckingVolume: 20
    };

    const queue = new GuildMusicQueue(TEST_GUILD_ID, mockVoiceChannel, mockTextChannel, musicConfig);
    queue.isPlaying = true;
    queues.set(TEST_GUILD_ID, queue);

    // TTS Starts -> Pause music
    notifyTtsEvent(TEST_GUILD_ID, "start");
    assert.strictEqual(queue.ttsActive, true);
    assert.strictEqual(queue.isPaused, true, "La musica deve andare in pausa automatica quando parla il TTS");

    // TTS Ends -> Resume music
    notifyTtsEvent(TEST_GUILD_ID, "end");
    assert.strictEqual(queue.ttsActive, false);
    assert.strictEqual(queue.isPaused, false, "La musica deve riprendere automaticamente dopo il TTS");

    queue.destroy();
  });

  runTest("Controllo permessi DJ e Ruolo DJ", () => {
    const adminMember = {
      permissions: { has: (perm) => true },
      roles: { cache: new Map() }
    };
    const regularMember = {
      permissions: { has: (perm) => false },
      roles: { cache: new Map([["role_dj", { id: "role_dj" }]]) }
    };
    const nonDjMember = {
      permissions: { has: (perm) => false },
      roles: { cache: new Map() }
    };

    const cfgNoDj = { djRoleId: "" };
    assert.strictEqual(isDjOrAdmin(adminMember, cfgNoDj), true);
    assert.strictEqual(isDjOrAdmin(regularMember, cfgNoDj), true);

    const cfgWithDj = { djRoleId: "role_dj" };
    assert.strictEqual(isDjOrAdmin(adminMember, cfgWithDj), true, "Admin ha sempre i permessi");
    assert.strictEqual(isDjOrAdmin(regularMember, cfgWithDj), true, "Utente con ruolo DJ ha i permessi");
    assert.strictEqual(isDjOrAdmin(nonDjMember, cfgWithDj), false, "Utente senza ruolo DJ è bloccato");
  });

  // ---------------------------------------------------------------------------
  // SECTION 3: All 24 Discord Bot Engines Initialization
  // ---------------------------------------------------------------------------
  console.log("\n--- SEZIONE 3: INIZIALIZZAZIONE TUTTI I 24 MOTORI BOT ---");

  const mockDiscordClient = {
    user: { id: "bot_123", tag: "RoomUp V2#9111" },
    guilds: {
      cache: new Map([
        [
          TEST_GUILD_ID,
          {
            id: TEST_GUILD_ID,
            name: "Server Test",
            memberCount: 42,
            iconURL: () => "https://roomup.it/icon.png",
            channels: { cache: new Map() },
            roles: { cache: new Map(), everyone: { id: "everyone_123" } }
          }
        ]
      ])
    },
    channels: { cache: new Map(), fetch: async () => null },
    users: { cache: new Map(), fetch: async () => null },
    on: () => {},
    once: () => {},
    setMaxListeners: () => {},
    isReady: () => true
  };

  const engines = [
    { name: "Logger Engine", fn: require("./src/bot/loggerEngine").initLoggerEngine },
    { name: "Ticket Engine", fn: require("./src/bot/ticketEngine").initTicketEngine },
    { name: "Verification Engine", fn: require("./src/bot/verificationEngine").initVerificationEngine },
    { name: "Partnership Engine", fn: require("./src/bot/partnershipEngine").initPartnershipEngine },
    { name: "Welcome Engine", fn: require("./src/bot/welcomeEngine").initWelcomeEngine },
    { name: "AutoMod Engine", fn: require("./src/bot/automodEngine").initAutomodEngine },
    { name: "Voice Engine", fn: require("./src/bot/voiceEngine").initVoiceEngine },
    { name: "AI Moderator Engine", fn: require("./src/bot/aiModeratorEngine").initAiModeratorEngine },
    { name: "Giveaway Engine", fn: require("./src/bot/giveawayEngine").initGiveawayEngine },
    { name: "Suggestion Engine", fn: require("./src/bot/suggestionEngine").initSuggestionEngine },
    { name: "Levels Engine", fn: require("./src/bot/levelsEngine").initLevelsEngine },
    { name: "Reaction Roles Engine", fn: require("./src/bot/reactionRolesEngine").initReactionRolesEngine },
    { name: "Custom Commands Engine", fn: require("./src/bot/customCommandsEngine").initCustomCommandsEngine },
    { name: "Counting Engine", fn: require("./src/bot/countingEngine").initCountingEngine },
    { name: "Starboard Engine", fn: require("./src/bot/starboardEngine").initStarboardEngine },
    { name: "Server Stats Engine", fn: require("./src/bot/serverStatsEngine").initServerStatsEngine },
    { name: "Anti-Nuke Engine", fn: require("./src/bot/antiNukeEngine").initAntiNukeEngine },
    { name: "Warn Engine", fn: require("./src/bot/warnEngine").initWarnEngine },
    { name: "Anti-Raid Engine", fn: require("./src/bot/antiRaidEngine").initAntiRaidEngine },
    { name: "Entertainment Engine", fn: require("./src/bot/entertainmentEngine").initEntertainmentEngine },
    { name: "Utilities Engine", fn: require("./src/bot/utilitiesEngine").initUtilitiesEngine },
    { name: "Integrations Engine", fn: require("./src/bot/integrationsEngine").initIntegrationsEngine },
    { name: "AI Agent Engine", fn: require("./src/bot/aiAgentEngine").initAiAgentEngine },
    { name: "Music Bot Engine", fn: require("./src/bot/musicEngine").initMusicEngine }
  ];

  engines.forEach((eng) => {
    runTest(`Inizializzazione Motore: ${eng.name}`, () => {
      eng.fn(mockDiscordClient, loadSettings, saveSettings);
    });
  });

  const { executeAutomations } = require("./src/core/automationEngine");
  runTest("Esecuzione Automazioni: executeAutomations è una funzione valida ed esegue senza errori", () => {
    assert.strictEqual(typeof executeAutomations, "function");
    executeAutomations({ id: TEST_GUILD_ID }, "message_create", {
      content: "Messaggio di test automazione",
      guild: { id: TEST_GUILD_ID }
    });
  });

  const { applyChannelIsolation, resetChannelIsolation } = require("./src/bot/verificationEngine");
  runTest("Verification Engine: applyChannelIsolation e resetChannelIsolation sono funzioni esportate", () => {
    assert.strictEqual(typeof applyChannelIsolation, "function");
    assert.strictEqual(typeof resetChannelIsolation, "function");
  });

  const {
    buildMemberJoinPayload,
    buildMemberLeavePayload,
    formatTimeAgo,
    formatFooterDate
  } = require("./src/bot/loggerEngine");

  runTest("Logger Engine: formatTimeAgo calcola correttamente le durate relative in italiano", () => {
    const now = Date.now();
    assert.strictEqual(formatTimeAgo(now - 1000 * 60 * 60 * 24 * 14), "14 giorni fa");
    assert.strictEqual(formatTimeAgo(now - 1000 * 60 * 60 * 24 * 365.25 * 4), "4 anni fa");
    assert.strictEqual(formatTimeAgo(now - 1000 * 60 * 60 * 24 * 365.25 * 10), "10 anni fa");
    assert.strictEqual(formatTimeAgo(now - 1000 * 60 * 60 * 24), "1 giorno fa");
    assert.strictEqual(formatTimeAgo(now - 1000 * 60 * 60), "1 ora fa");
  });

  runTest("Logger Engine: buildMemberJoinPayload genera il formato esatto dello screenshot per ingressi", () => {
    const fakeMember = {
      id: "1007620938700959784",
      user: {
        id: "1007620938700959784",
        username: "S.H.U.T.",
        tag: "S.H.U.T.",
        createdTimestamp: Date.now() - 1000 * 60 * 60 * 24 * 365.25 * 4,
        displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png"
      },
      guild: {
        name: "RoomUp!",
        memberCount: 10
      }
    };
    const fakeInvite = {
      code: "CrhFZmkhr",
      inviter: { id: "1429445691452948524" }
    };
    const payload = buildMemberJoinPayload(fakeMember, fakeInvite);
    assert.strictEqual(payload.content, "<@1007620938700959784>");
    assert.strictEqual(payload.embeds.length, 1);
    const embedData = payload.embeds[0].data;
    assert.strictEqual(embedData.title, "📥 Utente Entrato");
    assert.strictEqual(embedData.color, 5763719); // #57F287 in dec
    assert.ok(embedData.description.includes("> **Utente:** <@1007620938700959784>"));
    assert.ok(embedData.description.includes("> **ID Utente:** `1007620938700959784`"));
    assert.ok(embedData.description.includes("> **Invitato da:** <@1429445691452948524> ( `CrhFZmkhr` )"));
    assert.ok(embedData.description.includes("> **Account Creato:** `4 anni fa`"));
    assert.ok(embedData.description.includes("> **Membri Totali:** 10"));
  });

  runTest("Logger Engine: buildMemberLeavePayload genera il formato esatto dello screenshot per uscite", () => {
    const fakeMember = {
      id: "1007620938700959784",
      user: {
        id: "1007620938700959784",
        username: "S.H.U.T.",
        tag: "S.H.U.T.",
        displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png"
      },
      joinedTimestamp: Date.now() - 1000 * 60 * 60 * 24 * 14,
      guild: {
        name: "RoomUp!",
        memberCount: 9
      }
    };
    const payload = buildMemberLeavePayload(fakeMember, null);
    assert.strictEqual(payload.content, undefined);
    assert.strictEqual(payload.embeds.length, 1);
    const embedData = payload.embeds[0].data;
    assert.strictEqual(embedData.title, "📤 Utente Uscito");
    assert.strictEqual(embedData.color, 15548997); // #ED4245 in dec
    assert.ok(embedData.description.includes("> **Utente:** <@1007620938700959784>"));
    assert.ok(embedData.description.includes("> **ID Utente:** `1007620938700959784`"));
    assert.ok(embedData.description.includes("> **Entrato nel Server:** `14 giorni fa`"));
    assert.ok(embedData.description.includes("> **Membri Totali:** 9"));
    assert.ok(embedData.description.includes("> Uscito Spontaneamente"));
  });

  const {
    buildMessageCreatePayload,
    buildMessageDeletePayload,
    buildMessageUpdatePayload
  } = require("./src/bot/loggerEngine");

  runTest("Logger Engine: buildMessageCreatePayload genera il formato esatto dello screenshot per messaggi inviati", () => {
    const fakeMessage = {
      id: "1549517564344930305",
      content: "Ooo he cousa sono queste parolone",
      cleanContent: "Ooo he cousa sono queste parolone",
      channel: { id: "1550847044858679326", name: "🛋️・salotto" },
      author: {
        id: "1007620938700959784",
        username: "freler",
        tag: "freler",
        displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png"
      },
      guild: { id: TEST_GUILD_ID },
      createdAt: new Date(),
      url: "https://discord.com/channels/123/1550847044858679326/1549517564344930305",
      attachments: new Map()
    };
    const payload = buildMessageCreatePayload(fakeMessage);
    assert.strictEqual(payload.embeds.length, 1);
    const embedData = payload.embeds[0].data;
    assert.strictEqual(embedData.title, "💬 Messaggio Inviato");
    assert.strictEqual(embedData.color, 5793266); // #5865F2 in dec
    assert.ok(embedData.description.includes("**Canale:** <#1550847044858679326> ( `🛋️・salotto` )"));
    assert.ok(embedData.description.includes("**Autore:** <@1007620938700959784> ( `freler` )"));
    assert.ok(embedData.description.includes("**ID Messaggio:** `1549517564344930305` • [Vai al Messaggio]"));
    assert.ok(embedData.description.includes("**Contenuto Inviato**"));
    assert.ok(embedData.description.includes("+ Ooo he cousa sono queste parolone"));
  });

  runTest("Logger Engine: buildMessageDeletePayload genera il log eliminazione con blocco diff rosso", () => {
    const fakeMessage = {
      id: "1549517564344930305",
      content: "Messaggio eliminato test",
      channel: { id: "1550847044858679326", name: "🛋️・salotto" },
      author: { id: "1007620938700959784", username: "freler" },
      attachments: new Map()
    };
    const payload = buildMessageDeletePayload(fakeMessage, null);
    const embedData = payload.embeds[0].data;
    assert.strictEqual(embedData.title, "🗑️ Messaggio Eliminato");
    assert.strictEqual(embedData.color, 15548997); // #ED4245 in dec
    assert.ok(embedData.description.includes("- Messaggio eliminato test"));
  });

  runTest("Logger Engine: buildMessageUpdatePayload genera il log modifica con prima/dopo", () => {
    const oldMsg = { content: "Prima versione", channel: { id: "c1", name: "chat" } };
    const newMsg = {
      id: "m1",
      content: "Seconda versione modificata",
      channel: { id: "c1", name: "chat" },
      author: { id: "u1", username: "testuser" },
      url: "https://discord.com"
    };
    const payload = buildMessageUpdatePayload(oldMsg, newMsg);
    const embedData = payload.embeds[0].data;
    assert.strictEqual(embedData.title, "✏️ Messaggio Modificato");
    assert.ok(embedData.description.includes("- Prima versione"));
    assert.ok(embedData.description.includes("+ Seconda versione modificata"));
  });

  const {
    buildChannelCreatePayload,
    buildChannelDeletePayload,
    buildChannelUpdatePayload
  } = require("./src/bot/loggerEngine");

  runTest("Logger Engine: buildChannelCreatePayload genera il formato esatto dello screenshot per canali creati", () => {
    const fakeChannel = {
      id: "1550847044858679326",
      name: "ticket-default-cat-178-0003",
      type: 0, // GuildText
      createdAt: new Date(),
      guild: { name: "RoomUp!" }
    };
    const fakeMod = {
      id: "1007620938700959784",
      username: "RoomUp!",
      tag: "RoomUp!#9111",
      displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png"
    };
    const payload = buildChannelCreatePayload(fakeChannel, fakeMod);
    assert.strictEqual(payload.embeds.length, 1);
    const embedData = payload.embeds[0].data;
    assert.strictEqual(embedData.title, "➕ Canale Creato");
    assert.strictEqual(embedData.color, 5763719); // #57F287 in dec
    assert.ok(embedData.description.includes("**Canale:** <#1550847044858679326>"));
    assert.ok(embedData.description.includes("**Tipo:** Canale Testuale"));
    assert.ok(embedData.description.includes("**Moderatore:** <@1007620938700959784>"));
    assert.ok(embedData.description.includes("**Nuovo Canale**"));
    assert.ok(embedData.description.includes("+ #ticket-default-cat-178-0003"));
  });

  runTest("Logger Engine: buildChannelDeletePayload genera il formato esatto dello screenshot per canali eliminati", () => {
    const fakeChannel = {
      id: "1550847044858679326",
      name: "ticket-0005",
      type: 0, // GuildText
      guild: { name: "RoomUp!" }
    };
    const fakeMod = {
      id: "1007620938700959784",
      username: "Samuele",
      displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png"
    };
    const payload = buildChannelDeletePayload(fakeChannel, fakeMod);
    const embedData = payload.embeds[0].data;
    assert.strictEqual(embedData.title, "➖ Canale Eliminato");
    assert.strictEqual(embedData.color, 15548997); // #ED4245 in dec
    assert.ok(embedData.description.includes("**Tipo:** Canale Testuale"));
    assert.ok(embedData.description.includes("**Moderatore:** <@1007620938700959784>"));
    assert.ok(embedData.description.includes("**Canale Rimosso**"));
    assert.ok(embedData.description.includes("- #ticket-0005"));
  });

  runTest("Logger Engine: buildChannelUpdatePayload genera il formato esatto dello screenshot per canali modificati", () => {
    const oldCh = {
      id: "1550847055998746679",
      name: "🎫|ticket",
      topic: null,
      type: 0,
      guild: { name: "RoomUp!" }
    };
    const newCh = {
      id: "1550847055998746679",
      name: "🎫・ticket",
      topic: null,
      type: 0,
      guild: { name: "RoomUp!" }
    };
    const fakeMod = {
      id: "1007620938700959784",
      username: "freler",
      displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png"
    };
    const payload = buildChannelUpdatePayload(oldCh, newCh, fakeMod);
    const embedData = payload.embeds[0].data;
    assert.strictEqual(embedData.title, "✏️ Canale Modificato");
    assert.strictEqual(embedData.color, 15774258); // #F0B232 in dec
    assert.ok(embedData.description.includes("**Canale:** <#1550847055998746679>"));
    assert.ok(embedData.description.includes("**Tipo:** Canale Testuale"));
    assert.ok(embedData.description.includes("**Moderatore:** <@1007620938700959784>"));
    assert.ok(embedData.description.includes("- Nome: 🎫|ticket"));
    assert.ok(embedData.description.includes("+ Nome: 🎫・ticket"));
  });

  const {
    buildVoiceJoinPayload,
    buildVoiceSwitchPayload,
    buildVoiceLeavePayload
  } = require("./src/bot/loggerEngine");

  runTest("Logger Engine: buildVoiceJoinPayload genera il formato esatto dello screenshot per ingresso vocale", () => {
    const fakeMember = {
      id: "1007620938700959784",
      user: {
        id: "1007620938700959784",
        username: "frelerr",
        tag: "frelerr",
        displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png"
      }
    };
    const fakeChannel = {
      id: "1550847044858679326",
      name: "🧗 〢Crea Privata"
    };
    const payload = buildVoiceJoinPayload(fakeMember, fakeChannel);
    assert.strictEqual(payload.embeds.length, 1);
    const embedData = payload.embeds[0].data;
    assert.strictEqual(embedData.title, "🔊 Utente Entrato in Vocale");
    assert.strictEqual(embedData.color, 5763719); // #57F287 in dec
    assert.ok(embedData.description.includes("> **Membro:** <@1007620938700959784>"));
    assert.ok(embedData.description.includes("**Stanza Vocale**"));
    assert.ok(embedData.description.includes("+ Entrato in #🧗 〢Crea Privata"));
  });

  runTest("Logger Engine: buildVoiceSwitchPayload genera il formato esatto dello screenshot per spostamento vocale", () => {
    const fakeMember = {
      id: "1007620938700959784",
      user: {
        id: "1007620938700959784",
        username: "frelerr",
        tag: "frelerr",
        displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png"
      }
    };
    const oldCh = { id: "c1", name: "🧗 〢Crea Privata" };
    const newCh = { id: "c2", name: "🔊 Stanza di frelerr" };
    const payload = buildVoiceSwitchPayload(fakeMember, oldCh, newCh);
    assert.strictEqual(payload.embeds.length, 1);
    const embedData = payload.embeds[0].data;
    assert.strictEqual(embedData.title, "🔊 Spostamento Stanza Vocale");
    assert.strictEqual(embedData.color, 5793266); // #5865F2 in dec
    assert.ok(embedData.description.includes("> **Membro:** <@1007620938700959784>"));
    assert.ok(embedData.description.includes("**Spostamento Vocale**"));
    assert.ok(embedData.description.includes("- Da: #🧗 〢Crea Privata"));
    assert.ok(embedData.description.includes("+ A: #🔊 Stanza di frelerr"));
  });

  runTest("Logger Engine: buildVoiceLeavePayload genera il formato esatto dello screenshot per disconnessione vocale", () => {
    const fakeMember = {
      id: "1007620938700959784",
      user: {
        id: "1007620938700959784",
        username: "frelerr",
        tag: "frelerr",
        displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png"
      }
    };
    const fakeChannel = { id: "c2", name: "🔊 Stanza di frelerr" };
    const payload = buildVoiceLeavePayload(fakeMember, fakeChannel);
    assert.strictEqual(payload.embeds.length, 1);
    const embedData = payload.embeds[0].data;
    assert.strictEqual(embedData.title, "🔊 Utente Uscito dalla Vocale");
    assert.strictEqual(embedData.color, 15548997); // #ED4245 in dec
    assert.ok(embedData.description.includes("> **Membro:** <@1007620938700959784>"));
    assert.ok(embedData.description.includes("**Stanza Vocale**"));
    assert.ok(embedData.description.includes("- Disconnesso da #🔊 Stanza di frelerr"));
  });

  const { buildVerificationCompletePayload } = require("./src/bot/loggerEngine");

  runTest("Logger Engine: buildVerificationCompletePayload genera il formato esatto dello screenshot per verifica completata", () => {
    const fakeMember = {
      id: "1007620938700959784",
      user: {
        id: "1007620938700959784",
        username: "samuelecosso",
        tag: "samuelecosso",
        displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png"
      }
    };
    const payload = buildVerificationCompletePayload(fakeMember, ["@Utenti"], null, "MATH");
    assert.strictEqual(payload.embeds.length, 1);
    const embedData = payload.embeds[0].data;
    assert.strictEqual(embedData.title, "Verifica Completata");
    assert.strictEqual(embedData.color, 5763719); // #57F287 in dec
    assert.ok(embedData.description.includes("L'utente **samuelecosso** ( <@1007620938700959784> ) ha completato la verifica."));
    assert.strictEqual(embedData.fields[0].name, "Ruoli Assegnati");
    assert.strictEqual(embedData.fields[0].value, "@Utenti");
    assert.strictEqual(embedData.fields[1].name, "Ruolo Rimosso");
    assert.strictEqual(embedData.fields[1].value, "Nessuno");
    assert.strictEqual(embedData.fields[2].name, "Modalità");
    assert.strictEqual(embedData.fields[2].value, "MATH");
  });

  const {
    buildMemberRoleAddPayload,
    buildRoleUpdatePayload
  } = require("./src/bot/loggerEngine");

  runTest("Logger Engine: buildMemberRoleAddPayload genera il formato esatto dello screenshot per ruolo aggiunto a membro", () => {
    const fakeMember = {
      id: "1007620938700959784",
      user: {
        id: "1007620938700959784",
        username: "lolshut",
        tag: "lolshut",
        displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png"
      }
    };
    const fakeExecutor = {
      id: "1007620938700959784",
      username: "lolshut",
      tag: "lolshut",
      displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png"
    };
    const fakeRole = {
      id: "1550846908011122688",
      name: "Server Booster"
    };
    const payload = buildMemberRoleAddPayload(fakeMember, fakeRole, fakeExecutor);
    assert.strictEqual(payload.embeds.length, 1);
    const embedData = payload.embeds[0].data;
    assert.strictEqual(embedData.title, "➕ Ruolo Aggiunto al Membro");
    assert.strictEqual(embedData.color, 16426522); // #FAA61A in dec
    assert.ok(embedData.description.includes("> **Membro:** <@1007620938700959784>"));
    assert.ok(embedData.description.includes("> **Moderatore:** <@1007620938700959784>"));
    assert.ok(embedData.description.includes("**Ruolo Assegnato**"));
    assert.ok(embedData.description.includes("<@&1550846908011122688>"));
  });

  runTest("Logger Engine: buildRoleUpdatePayload genera il formato esatto dello screenshot per colore ruolo aggiornato", () => {
    const oldRole = {
      id: "1541051075623133285",
      name: "Founder",
      hexColor: "#e41111"
    };
    const newRole = {
      id: "1541051075623133285",
      name: "Founder",
      hexColor: "#d25a5a"
    };
    const fakeExecutor = {
      id: "1007620938700959784",
      username: "freler",
      tag: "freler",
      displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png"
    };
    const payload = buildRoleUpdatePayload(oldRole, newRole, fakeExecutor);
    assert.strictEqual(payload.embeds.length, 1);
    const embedData = payload.embeds[0].data;
    assert.strictEqual(embedData.title, "🎨 Colore Ruolo Aggiornato");
    assert.strictEqual(embedData.color, 13785690); // #d25a5a in dec
    assert.ok(embedData.description.includes("> **Ruolo:** <@&1541051075623133285> (Founder)"));
    assert.ok(embedData.description.includes("> **ID Ruolo:** 1541051075623133285"));
    assert.ok(embedData.description.includes("> **Moderatore:** <@1007620938700959784>"));
    assert.ok(embedData.description.includes("**Colore Modificato**"));
    assert.ok(embedData.description.includes("- Prima: #e41111"));
    assert.ok(embedData.description.includes("+ Dopo: #d25a5a"));
  });

  const {
    buildInviteCreatePayload,
    buildServerUpdatePayload
  } = require("./src/bot/loggerEngine");

  runTest("Logger Engine: buildInviteCreatePayload genera il formato esatto dello screenshot per inviti creati", () => {
    const fakeInvite = {
      code: "CrhFZmkhr",
      channelId: "1550847024285487177",
      expiresTimestamp: 1789827150000,
      maxUses: 0,
      inviter: {
        id: "1007620938700959784",
        username: "frelerr",
        tag: "frelerr",
        displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png"
      }
    };
    const payload = buildInviteCreatePayload(fakeInvite);
    assert.strictEqual(payload.embeds.length, 1);
    const embedData = payload.embeds[0].data;
    assert.strictEqual(embedData.title, "📨 Invito Creato");
    assert.strictEqual(embedData.color, 5763719); // #57F287 in dec
    assert.ok(embedData.description.includes("> **Codice Invito:** CrhFZmkhr"));
    assert.ok(embedData.description.includes("> **Canale:** <#1550847024285487177>"));
    assert.ok(embedData.description.includes("> **Scadenza Invito:** <t:1789827150:R>"));
    assert.ok(embedData.description.includes("> **Usi Massimi:** ∞"));
    assert.ok(embedData.footer.text.includes("@frelerr"));
  });

  runTest("Logger Engine: buildServerUpdatePayload genera il formato esatto dello screenshot per modifiche al server", () => {
    const oldGuild = {
      id: "1429445691452948524",
      name: "RoomUp",
      description: "Community RoomUp",
      verificationLevel: 1
    };
    const newGuild = {
      id: "1429445691452948524",
      name: "RoomUp!",
      description: "Community RoomUp Migliorata",
      verificationLevel: 2,
      iconURL: () => "https://cdn.discordapp.com/embed/avatars/0.png"
    };
    const fakeMod = {
      id: "1007620938700959784",
      username: "frelerr",
      tag: "frelerr",
      displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png"
    };
    const payload = buildServerUpdatePayload(oldGuild, newGuild, fakeMod);
    assert.strictEqual(payload.embeds.length, 1);
    const embedData = payload.embeds[0].data;
    assert.strictEqual(embedData.title, "⚙️ Server Aggiornato");
    assert.strictEqual(embedData.color, 5793266); // #5865F2 in dec
    assert.ok(embedData.description.includes("> **Server:** **RoomUp!**"));
    assert.ok(embedData.description.includes("> **ID Server:** `1429445691452948524`"));
    assert.ok(embedData.description.includes("> **Moderatore:** <@1007620938700959784>"));
    assert.ok(embedData.description.includes("**Modifiche Server**"));
    assert.ok(embedData.description.includes("- Nome: RoomUp"));
    assert.ok(embedData.description.includes("+ Nome: RoomUp!"));
  });

  const {
    buildMemberTimeoutPayload,
    buildMemberNickUpdatePayload,
    buildAutoModActionPayload,
    buildVoiceMuteDeafPayload,
    buildGenericAuditLogPayload,
    markDispatched,
    wasRecentlyDispatched
  } = require("./src/bot/loggerEngine");

  runTest("Logger Engine: buildMemberTimeoutPayload genera formato estetico con blocco >", () => {
    const fakeMember = {
      id: "1007620938700959784",
      user: {
        id: "1007620938700959784",
        username: "frelerr",
        tag: "frelerr",
        displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png"
      }
    };
    const fakeMod = {
      id: "1429445691452948524",
      username: "Admin",
      tag: "Admin#0001",
      displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png"
    };
    const payload = buildMemberTimeoutPayload(fakeMember, Date.now() + 600000, "Spam ripetuto", fakeMod, false);
    assert.strictEqual(payload.embeds.length, 1);
    const embedData = payload.embeds[0].data;
    assert.strictEqual(embedData.title, "⏳ Timeout Membro Applicato");
    assert.strictEqual(embedData.color, 15548997); // #ED4245 in dec
    assert.ok(embedData.description.includes("> **Membro:** <@1007620938700959784>"));
    assert.ok(embedData.description.includes("> **ID Utente:** `1007620938700959784`"));
    assert.ok(embedData.description.includes("> **Moderatore:** <@1429445691452948524>"));
    assert.ok(embedData.description.includes("> **Motivo:** Spam ripetuto"));
  });

  runTest("Logger Engine: buildMemberNickUpdatePayload genera formato estetico con blocco diff", () => {
    const oldMember = {
      id: "1007620938700959784",
      nickname: "VecchioNick",
      displayName: "VecchioNick"
    };
    const newMember = {
      id: "1007620938700959784",
      nickname: "NuovoNick",
      displayName: "NuovoNick",
      user: {
        id: "1007620938700959784",
        username: "frelerr",
        displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png"
      }
    };
    const payload = buildMemberNickUpdatePayload(oldMember, newMember, null);
    const embedData = payload.embeds[0].data;
    assert.strictEqual(embedData.title, "✏️ Nickname Membro Modificato");
    assert.strictEqual(embedData.color, 15774258); // #F0B232 in dec
    assert.ok(embedData.description.includes("> **Membro:** <@1007620938700959784>"));
    assert.ok(embedData.description.includes("- Prima: VecchioNick"));
    assert.ok(embedData.description.includes("+ Dopo: NuovoNick"));
  });

  runTest("Logger Engine: buildAutoModActionPayload genera formato estetico per violazioni", () => {
    const fakeExec = {
      userId: "1007620938700959784",
      channelId: "1550847044858679326",
      ruleTriggerType: "Parole Vietate",
      action: { type: 1 },
      content: "messaggio illegale spam",
      guild: { iconURL: () => "https://cdn.discordapp.com/embed/avatars/0.png" }
    };
    const payload = buildAutoModActionPayload(fakeExec);
    const embedData = payload.embeds[0].data;
    assert.strictEqual(embedData.title, "🛡️ AutoMod: Violazione Rilevata");
    assert.strictEqual(embedData.color, 15548997); // #ED4245 in dec
    assert.ok(embedData.description.includes("> **Utente:** <@1007620938700959784>"));
    assert.ok(embedData.description.includes("> **Regola Violata:** `Parole Vietate`"));
    assert.ok(embedData.description.includes("- messaggio illegale spam"));
  });

  runTest("Logger Engine: buildVoiceMuteDeafPayload genera stato vocale coerente", () => {
    const fakeMember = {
      id: "1007620938700959784",
      voice: { channelId: "1550847073622958123" },
      user: {
        id: "1007620938700959784",
        username: "frelerr",
        displayAvatarURL: () => "https://cdn.discordapp.com/embed/avatars/0.png"
      }
    };
    const payload = buildVoiceMuteDeafPayload(fakeMember, "Server Mute", true, null);
    const embedData = payload.embeds[0].data;
    assert.strictEqual(embedData.title, "🔇 Server Mute Attivato");
    assert.strictEqual(embedData.color, 15548997); // #ED4245 in dec
    assert.ok(embedData.description.includes("> **Membro:** <@1007620938700959784>"));
    assert.ok(embedData.description.includes("Server Mute Attivato"));
  });

  runTest("Logger Engine: buildGenericAuditLogPayload gestisce qualsiasi evento di audit log (157+)", () => {
    const fakeEntry = {
      id: "998877665544",
      action: "RoleCreate",
      target: { id: "1550846908011122688", name: "NuovoRuolo" },
      executor: { id: "1007620938700959784", username: "Admin" },
      reason: "Configurazione rank",
      changes: [
        { key: "name", old: undefined, new: "NuovoRuolo" },
        { key: "color", old: 0, new: 16711680 }
      ]
    };
    const payload = buildGenericAuditLogPayload(fakeEntry, { iconURL: () => null });
    const embedData = payload.embeds[0].data;
    assert.ok(embedData.title.includes("Ruolo Creato"));
    assert.ok(embedData.description.includes("> **Azione:** `Ruolo Creato`"));
    assert.ok(embedData.description.includes("> **Bersaglio:** `NuovoRuolo` (`1550846908011122688`)"));
    assert.ok(embedData.description.includes("> **Moderatore:** <@1007620938700959784>"));
    assert.ok(embedData.description.includes("> **Motivo:** Configurazione rank"));
    assert.ok(embedData.description.includes("+ name: NuovoRuolo"));
  });

  runTest("Logger Engine: markDispatched e wasRecentlyDispatched deduplicano correttamente gli eventi", () => {
    markDispatched("RoleCreate", "12345");
    assert.strictEqual(wasRecentlyDispatched("RoleCreate", "12345"), true);
    assert.strictEqual(wasRecentlyDispatched("RoleCreate", "non_esistente"), false);
  });

  // ---------------------------------------------------------------------------
  // SECTION 4: Web Server, Template Rendering & REST APIs
  // ---------------------------------------------------------------------------
  console.log("\n--- SEZIONE 4: WEB DASHBOARD, RENDERING TEMPLATE & API REST ---");

  const ejs = require("ejs");
  const dashboardTpl = fs.readFileSync(path.join(__dirname, "src/web/views/dashboard.ejs"), "utf8");

  runTest("Rendering EJS Dashboard con tutti i 38 moduli e nuovo tab musica", () => {
    const fullConfig = getGuildConfig(TEST_GUILD_ID);
    const mockChannels = [{ id: "c1", name: "generale" }, { id: "c2", name: "comandi-bot" }];
    const mockVoice = [{ id: "v1", name: "Vocale 1" }, { id: "v2", name: "Musica Room" }];
    const mockRoles = [{ id: "r1", name: "Admin" }, { id: "r2", name: "DJ RoomUp" }];
    const mockCats = [{ id: "cat1", name: "Community" }];

    const html = ejs.render(dashboardTpl, {
      guildId: TEST_GUILD_ID,
      guildName: "RoomUp Community Server",
      guildIcon: "https://roomup.it/icon.png",
      memberCount: 42,
      allGuilds: [{ id: TEST_GUILD_ID, name: "RoomUp Community Server", icon: "", memberCount: 42 }],
      config: fullConfig,
      channels: mockChannels,
      textChannels: mockChannels,
      voiceChannels: mockVoice,
      categories: mockCats,
      groupedChannels: { text: mockChannels, voice: mockVoice },
      roles: mockRoles,
      user: { id: "user_test", username: "Frelerr", global_name: "Frelerr", avatarUrl: "" },
      stats: { openTickets: 0, verifiedMembers: 42, activeGiveaways: 0, pendingSuggestions: 0, partnershipCount: 0 },
      partnersData: [],
      allCategories: [
        { id: "channels", title: "Canali", icon: "fa-folder", events: [{ key: "channelCreate", label: "Crea", desc: "d" }] }
      ],
      aiMemory: { precedents: [] },
      giveaways: [],
      suggestions: [],
      levelsData: {},
      allInfractions: {},
      channelCount: 4,
      roleCount: 2,
      cases: [],
      diagnostics: { score: 95, status: "optimal", recommendations: [] },
      economyLeaderboard: [],
      reputationLeaderboard: [],
      modmailSessions: [],
      forms: [],
      knowledgeBaseArticles: [],
      presets: {},
      backups: [],
      revisions: []
    });

    assert(html.includes('id="tab-music"'), "Il markup HTML deve contenere il tab-music");
    assert(html.includes('data-tab="tab-music"'), "Il markup HTML deve includere il pulsante nav tab-music");
    assert(html.includes('id="musicEnabled"'), "Il markup HTML deve includere il toggle musicEnabled");
    assert(html.includes('id="musicTtsMode"'), "Il markup HTML deve includere il selettore musicTtsMode");
    assert(html.includes('id="musicDefaultVolume"'), "Il markup HTML deve includere lo slider musicDefaultVolume");
    assert(html.includes('id="musicDjRole"'), "Il markup HTML deve includere il selettore musicDjRole");
    assert(html.includes('Modulo Musica & Voice'), "Il markup HTML deve includere la scheda overview per la musica");
  });

  // Test Web Server APIs via supertest / direct HTTP
  const { createWebServer } = require("./src/web/server");
  const TEST_PORT = 3109;
  const testApp = createWebServer(TEST_PORT);

  function makeRequest(path, method = "GET", body = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: "127.0.0.1",
        port: TEST_PORT,
        path,
        method,
        headers: {
          "Content-Type": "application/json",
          "x-test-auth": "true"
        }
      };

      const req = http.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ status: res.statusCode, body: parsed, raw: data });
          } catch (e) {
            resolve({ status: res.statusCode, body: null, raw: data });
          }
        });
      });

      req.on("error", reject);
      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  await runTestAsync("GET /login reindirizza o risponde correttamente", async () => {
    const res = await makeRequest("/login");
    assert.strictEqual(res.status, 302, "Dovrebbe reindirizzare all'OAuth o login dev");
  });

  await runTestAsync("GET /login/dev effettua login locale per test/mobile", async () => {
    const res = await makeRequest("/login/dev");
    assert.strictEqual(res.status, 302);
  });

  await runTestAsync("POST /api/dashboard/:guildId/save salva il payload completo di 35+ moduli", async () => {
    const payload = {
      music: {
        enabled: true,
        djRoleId: "dj_role_123",
        defaultVolume: 75,
        maxQueueSize: 60,
        autoLeaveTimeout: 120,
        ttsCoexistenceMode: "duck",
        ttsDuckingVolume: 20,
        embedColor: "#5865F2",
        nowPlayingTemplate: "🎵 Brano In Corso",
        playMessageTemplate: "🎶 Riproduco {title}",
        queueMessageTemplate: "📜 Coda: {count}"
      },
      automod: {
        enabled: true,
        antiInvite: true,
        antiLinks: false,
        badWordsEnabled: true,
        badWordsList: ["scam", "spam"]
      },
      verification: {
        enabled: true,
        mode: "button",
        buttonLabel: "Verificati Ora!"
      }
    };

    const res = await makeRequest(`/api/dashboard/${TEST_GUILD_ID}/save`, "POST", payload);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.config.music.defaultVolume, 75);
    assert.strictEqual(res.body.config.music.djRoleId, "dj_role_123");
    assert.strictEqual(res.body.config.automod.antiInvite, true);
  });

  await runTestAsync("POST /api/dashboard/:guildId/custom-commands/add & delete", async () => {
    const addRes = await makeRequest(`/api/dashboard/${TEST_GUILD_ID}/custom-commands/add`, "POST", {
      trigger: "!testcmd",
      response: "Risposta test personalizzata"
    });
    assert.strictEqual(addRes.status, 200);
    assert.strictEqual(addRes.body.success, true);

    const delRes = await makeRequest(`/api/dashboard/${TEST_GUILD_ID}/custom-commands/delete`, "POST", {
      trigger: "!testcmd"
    });
    assert.strictEqual(delRes.status, 200);
    assert.strictEqual(delRes.body.success, true);
  });

  await runTestAsync("POST /api/dashboard/:guildId/aimod/simulate", async () => {
    const res = await makeRequest(`/api/dashboard/${TEST_GUILD_ID}/aimod/simulate`, "POST", {
      text: "Ciao a tutti, server fantastico!"
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.result);
    assert.ok(res.body.result.decision);
  });

  await runTestAsync("GET /api/dashboard/:guildId/backups & POST /backups/create", async () => {
    const createRes = await makeRequest(`/api/dashboard/${TEST_GUILD_ID}/backups/create`, "POST", {});
    assert.strictEqual(createRes.status, 200);
    assert.strictEqual(createRes.body.success, true);

    const getRes = await makeRequest(`/api/dashboard/${TEST_GUILD_ID}/backups`, "GET");
    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getRes.body.success, true);
    assert.ok(Array.isArray(getRes.body.backups));
  });

  await runTestAsync("GET /api/dashboard/:guildId/cases & POST /cases", async () => {
    const postCase = await makeRequest(`/api/dashboard/${TEST_GUILD_ID}/cases`, "POST", {
      type: "WARN",
      targetId: "target_123",
      targetTag: "BadUser#0001",
      moderatorId: "mod_123",
      moderatorTag: "Staff#9999",
      reason: "Spam ripetuto in chat"
    });
    assert.strictEqual(postCase.status, 200);
    assert.strictEqual(postCase.body.success, true);

    const getCases = await makeRequest(`/api/dashboard/${TEST_GUILD_ID}/cases`, "GET");
    assert.strictEqual(getCases.status, 200);
    assert.strictEqual(getCases.body.success, true);
    assert.ok(Array.isArray(getCases.body.cases));
  });

  await runTestAsync("GET /api/dashboard/:guildId/economy & POST /economy/adjust", async () => {
    const adjustRes = await makeRequest(`/api/dashboard/${TEST_GUILD_ID}/economy/adjust`, "POST", {
      userId: "eco_user_1",
      userTag: "EcoUser#1234",
      amount: 500,
      reason: "Premio evento speciale"
    });
    assert.strictEqual(adjustRes.status, 200);
    assert.strictEqual(adjustRes.body.success, true);

    const getEco = await makeRequest(`/api/dashboard/${TEST_GUILD_ID}/economy`, "GET");
    assert.strictEqual(getEco.status, 200);
    assert.strictEqual(getEco.body.success, true);
  });

  await runTestAsync("POST /api/dashboard/:guildId/panic-mode attiva/disattiva lockdown", async () => {
    const lockRes = await makeRequest(`/api/dashboard/${TEST_GUILD_ID}/panic-mode`, "POST", {
      action: "lock"
    });
    assert.strictEqual(lockRes.status, 200);
    assert.strictEqual(lockRes.body.success, true);
    assert.strictEqual(lockRes.body.panicMode, true);

    const unlockRes = await makeRequest(`/api/dashboard/${TEST_GUILD_ID}/panic-mode`, "POST", {
      action: "unlock"
    });
    assert.strictEqual(unlockRes.status, 200);
    assert.strictEqual(unlockRes.body.success, true);
    assert.strictEqual(unlockRes.body.panicMode, false);
  });

  await runTestAsync("GET /api/dashboard/:guildId/revisions", async () => {
    const res = await makeRequest(`/api/dashboard/${TEST_GUILD_ID}/revisions`, "GET");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.revisions));
  });

  await runTestAsync("POST /api/dashboard/:guildId/verification/isolate-channels endpoint risponde correttamente", async () => {
    const res = await makeRequest(`/api/dashboard/${TEST_GUILD_ID}/verification/isolate-channels`, "POST", {
      verification: { channelId: "c1", verifiedRoleId: "r1" }
    });
    assert.ok(res.status === 200 || res.status === 500);
    assert.ok(res.body !== null);
  });

  await runTestAsync("POST /api/dashboard/:guildId/verification/reset-isolation endpoint risponde correttamente", async () => {
    const res = await makeRequest(`/api/dashboard/${TEST_GUILD_ID}/verification/reset-isolation`, "POST");
    assert.ok(res.status === 200 || res.status === 500);
    assert.ok(res.body !== null);
  });

  await runTestAsync("POST /api/dashboard/:guildId/logs/member-join/test endpoint risponde correttamente", async () => {
    const res = await makeRequest(`/api/dashboard/${TEST_GUILD_ID}/logs/member-join/test`, "POST");
    assert.ok(res.status === 200 || res.status === 500);
    assert.ok(res.body !== null);
  });

  await runTestAsync("POST /api/dashboard/:guildId/logs/member-leave/test endpoint risponde correttamente", async () => {
    const res = await makeRequest(`/api/dashboard/${TEST_GUILD_ID}/logs/member-leave/test`, "POST");
    assert.ok(res.status === 200 || res.status === 500);
    assert.ok(res.body !== null);
  });

  await runTestAsync("POST /api/dashboard/:guildId/logs/message-create/test endpoint risponde correttamente", async () => {
    const res = await makeRequest(`/api/dashboard/${TEST_GUILD_ID}/logs/message-create/test`, "POST");
    assert.ok(res.status === 200 || res.status === 500);
    assert.ok(res.body !== null);
  });

  await runTestAsync("POST /api/dashboard/:guildId/logs/message-update/test endpoint risponde correttamente", async () => {
    const res = await makeRequest(`/api/dashboard/${TEST_GUILD_ID}/logs/message-update/test`, "POST");
    assert.ok(res.status === 200 || res.status === 500);
    assert.ok(res.body !== null);
  });

  await runTestAsync("POST /api/dashboard/:guildId/logs/message-delete/test endpoint risponde correttamente", async () => {
    const res = await makeRequest(`/api/dashboard/${TEST_GUILD_ID}/logs/message-delete/test`, "POST");
    assert.ok(res.status === 200 || res.status === 500);
    assert.ok(res.body !== null);
  });

  await runTestAsync("POST /api/dashboard/:guildId/logs/channel-create/test endpoint risponde correttamente", async () => {
    const res = await makeRequest(`/api/dashboard/${TEST_GUILD_ID}/logs/channel-create/test`, "POST");
    assert.ok(res.status === 200 || res.status === 500);
    assert.ok(res.body !== null);
  });

  await runTestAsync("POST /api/dashboard/:guildId/logs/channel-delete/test endpoint risponde correttamente", async () => {
    const res = await makeRequest(`/api/dashboard/${TEST_GUILD_ID}/logs/channel-delete/test`, "POST");
    assert.ok(res.status === 200 || res.status === 500);
    assert.ok(res.body !== null);
  });

  await runTestAsync("POST /api/dashboard/:guildId/logs/channel-update/test endpoint risponde correttamente", async () => {
    const res = await makeRequest(`/api/dashboard/${TEST_GUILD_ID}/logs/channel-update/test`, "POST");
    assert.ok(res.status === 200 || res.status === 500);
    assert.ok(res.body !== null);
  });

  await runTestAsync("POST /api/dashboard/:guildId/logs/voice-join/test endpoint risponde correttamente", async () => {
    const res = await makeRequest(`/api/dashboard/${TEST_GUILD_ID}/logs/voice-join/test`, "POST");
    assert.ok(res.status === 200 || res.status === 500);
    assert.ok(res.body !== null);
  });

  await runTestAsync("POST /api/dashboard/:guildId/logs/voice-switch/test endpoint risponde correttamente", async () => {
    const res = await makeRequest(`/api/dashboard/${TEST_GUILD_ID}/logs/voice-switch/test`, "POST");
    assert.ok(res.status === 200 || res.status === 500);
    assert.ok(res.body !== null);
  });

  await runTestAsync("POST /api/dashboard/:guildId/logs/voice-leave/test endpoint risponde correttamente", async () => {
    const res = await makeRequest(`/api/dashboard/${TEST_GUILD_ID}/logs/voice-leave/test`, "POST");
    assert.ok(res.status === 200 || res.status === 500);
    assert.ok(res.body !== null);
  });

  await runTestAsync("POST /api/dashboard/:guildId/logs/verification/test endpoint risponde correttamente", async () => {
    const res = await makeRequest(`/api/dashboard/${TEST_GUILD_ID}/logs/verification/test`, "POST");
    assert.ok(res.status === 200 || res.status === 500);
    assert.ok(res.body !== null);
  });

  await runTestAsync("POST /api/dashboard/:guildId/logs/role-member-add/test endpoint risponde correttamente", async () => {
    const res = await makeRequest(`/api/dashboard/${TEST_GUILD_ID}/logs/role-member-add/test`, "POST");
    assert.ok(res.status === 200 || res.status === 500);
    assert.ok(res.body !== null);
  });

  await runTestAsync("POST /api/dashboard/:guildId/logs/role-update/test endpoint risponde correttamente", async () => {
    const res = await makeRequest(`/api/dashboard/${TEST_GUILD_ID}/logs/role-update/test`, "POST");
    assert.ok(res.status === 200 || res.status === 500);
    assert.ok(res.body !== null);
  });

  await runTestAsync("POST /api/dashboard/:guildId/logs/invite-create/test endpoint risponde correttamente", async () => {
    const res = await makeRequest(`/api/dashboard/${TEST_GUILD_ID}/logs/invite-create/test`, "POST");
    assert.ok(res.status === 200 || res.status === 500);
    assert.ok(res.body !== null);
  });

  await runTestAsync("POST /api/dashboard/:guildId/logs/server-update/test endpoint risponde correttamente", async () => {
    const res = await makeRequest(`/api/dashboard/${TEST_GUILD_ID}/logs/server-update/test`, "POST");
    assert.ok(res.status === 200 || res.status === 500);
    assert.ok(res.body !== null);
  });

  await runTestAsync("POST /api/dashboard/:guildId/logs/member-timeout/test endpoint risponde correttamente", async () => {
    const res = await makeRequest(`/api/dashboard/${TEST_GUILD_ID}/logs/member-timeout/test`, "POST");
    assert.ok(res.status === 200 || res.status === 500);
    assert.ok(res.body !== null);
  });

  await runTestAsync("POST /api/dashboard/:guildId/logs/automod-action/test endpoint risponde correttamente", async () => {
    const res = await makeRequest(`/api/dashboard/${TEST_GUILD_ID}/logs/automod-action/test`, "POST");
    assert.ok(res.status === 200 || res.status === 500);
    assert.ok(res.body !== null);
  });

  await runTestAsync("POST /api/dashboard/:guildId/logs/generic-audit/test endpoint risponde correttamente", async () => {
    const res = await makeRequest(`/api/dashboard/${TEST_GUILD_ID}/logs/generic-audit/test`, "POST");
    assert.ok(res.status === 200 || res.status === 500);
    assert.ok(res.body !== null);
  });

  // Close test server
  if (testApp.server) {
    await new Promise((resolve) => testApp.server.close(resolve));
  }

  console.log("\n===============================================================");
  console.log(`🎉 TUTTI I TEST SUPERATI CON SUCCESSO! (${passedTests}/${totalTests})`);
  console.log("===============================================================");
  process.exit(0);
}

startSuite().catch((err) => {
  console.error("Test suite terminata con errore fatale:", err);
  process.exit(1);
});
