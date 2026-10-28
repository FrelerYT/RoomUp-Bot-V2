const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActivityType
} = require("discord.js");

const { loadSettings, saveSettings, getGuildConfig } = require("../config/settingsManager");

// Foundational Core Engines
const eventBus = require("../core/eventBus");
const { initScheduler, scheduleTask } = require("../core/scheduler");
const { executeAutomations } = require("../core/automationEngine");
const { broadcastRealtimeEvent } = require("../core/realtime");

// 23 Baseline Suite Engines
const { initLoggerEngine } = require("./loggerEngine");
const { initTicketEngine, sendTicketPanel } = require("./ticketEngine");
const { initVerificationEngine, sendVerificationPanel } = require("./verificationEngine");
const { initPartnershipEngine } = require("./partnershipEngine");
const { initWelcomeEngine } = require("./welcomeEngine");
const { initAutomodEngine } = require("./automodEngine");
const { initVoiceEngine } = require("./voiceEngine");
const { initAiModeratorEngine } = require("./aiModeratorEngine");
const { initGiveawayEngine } = require("./giveawayEngine");
const { initSuggestionEngine } = require("./suggestionEngine");
const { initLevelsEngine } = require("./levelsEngine");
const { initReactionRolesEngine } = require("./reactionRolesEngine");
const { initCustomCommandsEngine } = require("./customCommandsEngine");
const { initCountingEngine } = require("./countingEngine");
const { initStarboardEngine } = require("./starboardEngine");
const { initServerStatsEngine } = require("./serverStatsEngine");
const { initAntiNukeEngine } = require("./antiNukeEngine");
const { initWarnEngine } = require("./warnEngine");
const { initAntiRaidEngine } = require("./antiRaidEngine");
const { initEntertainmentEngine } = require("./entertainmentEngine");
const { initUtilitiesEngine } = require("./utilitiesEngine");
const { initIntegrationsEngine } = require("./integrationsEngine");
const { initUnbanAppealEngine, sendUnbanAppealPanel } = require("./unbanAppealEngine");
const { initAiAgentEngine } = require("./aiAgentEngine");
const { initAiTicketEngine } = require("./aiTicketEngine");
const { initMusicEngine, getOrCreateQueue, notifyTtsEvent, isDjOrAdmin } = require("./musicEngine");
const { initTtsEngine } = require("./ttsEngine");
const { initBoosterEngine } = require("./boosterEngine");
const { initSocialNotifierEngine } = require("./socialNotifierEngine");
const {
  initSentinel,
  defaultSentinelCore,
  defaultEventEngine,
  defaultMemoryEngine,
  defaultKnowledgeEngine,
  defaultLearningEngine,
  defaultModelRouter,
  LEARNING_TYPES
} = require("../sentinel");

// Modular Platform Power Modules
const { applyPreset, PRESETS } = require("../modules/server/setupWizard");
const roleManager = require("../modules/server/roleManager");
const caseManager = require("../modules/moderation/caseManager");
const reportAppealManager = require("../modules/moderation/reportAppealManager");
const securityCenter = require("../modules/moderation/securityCenter");
const modmailManager = require("../modules/support/modmailManager");
const formBuilder = require("../modules/support/formBuilder");
const knowledgeBase = require("../modules/support/knowledgeBase");
const economyManager = require("../modules/community/economyManager");
const reputationManager = require("../modules/community/reputationManager");
const questManager = require("../modules/community/questManager");
const socialManager = require("../modules/community/socialManager");

let clientInstance = null;

function registerProcessCrashGuards() {
  if (process._roomUpCrashGuardsInstalled) return;
  process._roomUpCrashGuardsInstalled = true;

  process.on("unhandledRejection", (reason, promise) => {
    console.error("[CRITICAL PROCESS GUARD] Unhandled Promise Rejection:", reason?.stack || reason?.message || reason);
  });

  process.on("uncaughtException", (err, origin) => {
    console.error(`[CRITICAL PROCESS GUARD] Uncaught Exception (${origin}):`, err?.stack || err?.message || err);
  });
}

function createDiscordClient(token, clientId) {
  registerProcessCrashGuards();
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildEmojisAndStickers,
      GatewayIntentBits.GuildIntegrations,
      GatewayIntentBits.GuildWebhooks,
      GatewayIntentBits.GuildInvites,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildScheduledEvents,
      GatewayIntentBits.AutoModerationConfiguration,
      GatewayIntentBits.AutoModerationExecution,
      GatewayIntentBits.DirectMessages
    ],
    partials: [
      Partials.Message,
      Partials.Channel,
      Partials.GuildMember,
      Partials.User,
      Partials.Reaction
    ]
  });

  clientInstance = client;
  client.setMaxListeners(80);

  // Gateway Connection Debug Logger
  client.on("debug", (info) => {
    console.log(`[Gateway Debug] ${info}`);
  });

  // Slash commands definitions (Essential & Requested Commands)
  const commands = [
    // 1. Levels / XP - Community Commands
    new SlashCommandBuilder()
      .setName("rank")
      .setDescription("Mostra il tuo livello XP e la posizione in classifica")
      .addUserOption(opt => opt.setName("utente").setDescription("Utente da controllare").setRequired(false)),

    new SlashCommandBuilder()
      .setName("scoreboard-lvl")
      .setDescription("Mostra la classifica generale (scoreboard) dei livelli ed XP del server")
      .addIntegerOption(opt => opt.setName("pagina").setDescription("Numero di pagina della classifica (default 1)").setRequired(false)),

    // 2. Disciplinary / Moderation - Staff Privileged
    new SlashCommandBuilder()
      .setName("warn")
      .setDescription("Assegna un avvertimento disciplinare a un utente")
      .addUserOption(opt => opt.setName("utente").setDescription("Utente da sanzionare").setRequired(true))
      .addStringOption(opt => opt.setName("motivo").setDescription("Motivo dell'infrazione").setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
      .setName("warnings")
      .setDescription("Mostra lo storico delle sanzioni di un utente")
      .addUserOption(opt => opt.setName("utente").setDescription("Utente da controllare").setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
      .setName("clearwarns")
      .setDescription("Azzera la fedina disciplinare e rimuove i warn di un utente")
      .addUserOption(opt => opt.setName("utente").setDescription("Utente da azzerare").setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
      .setName("unwarn")
      .setDescription("Rimuove l'ultimo warn a un utente e aggiorna il ruolo disciplinare")
      .addUserOption(opt => opt.setName("utente").setDescription("Utente da cui revocare il warn").setRequired(true))
      .addStringOption(opt => opt.setName("motivo").setDescription("Motivo della revoca").setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
      .setName("timeout")
      .setDescription("Isola un utente in timeout per un determinato tempo")
      .addUserOption(opt => opt.setName("utente").setDescription("Utente da isolare").setRequired(true))
      .addIntegerOption(opt => opt.setName("minuti").setDescription("Durata del timeout in minuti").setRequired(true))
      .addStringOption(opt => opt.setName("motivo").setDescription("Motivo del timeout").setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
      .setName("kick")
      .setDescription("Espelle un utente dal server")
      .addUserOption(opt => opt.setName("utente").setDescription("Utente da espellere").setRequired(true))
      .addStringOption(opt => opt.setName("motivo").setDescription("Motivo dell'espulsione").setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    new SlashCommandBuilder()
      .setName("ban")
      .setDescription("Banna permanentemente un utente dal server")
      .addUserOption(opt => opt.setName("utente").setDescription("Utente da bannare").setRequired(true))
      .addStringOption(opt => opt.setName("motivo").setDescription("Motivo del ban").setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    // 3. Admin Panels - Admin Privileged
    new SlashCommandBuilder()
      .setName("ticket-panel")
      .setDescription("Invia il pannello dei ticket in questo canale")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
      .setName("verify-panel")
      .setDescription("Invia il pannello di verifica in questo canale")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    // 4. TTS BOT - Text To Speech & Auto Language Detection
    new SlashCommandBuilder()
      .setName("tts")
      .setDescription("Sistema Text-To-Speech con rilevamento automatico Italiano/Inglese")
      .addSubcommand(sub =>
        sub.setName("join")
          .setDescription("Connette il bot al tuo canale vocale e attiva la lettura dei messaggi")
          .addChannelOption(opt => opt.setName("canale").setDescription("Canale vocale a cui connettersi (opzionale)").setRequired(false))
      )
      .addSubcommand(sub =>
        sub.setName("leave")
          .setDescription("Disconnette il bot dal canale vocale corrente e ferma la lettura")
      )
      .addSubcommand(sub =>
        sub.setName("say")
          .setDescription("Pronuncia un messaggio vocale nel canale vocale con rilevamento lingua")
          .addStringOption(opt => opt.setName("testo").setDescription("Il testo da pronunciare").setRequired(true))
          .addStringOption(opt =>
            opt.setName("lingua")
              .setDescription("Lingua della pronuncia (default: rilevamento automatico)")
              .setRequired(false)
              .addChoices(
                { name: "🤖 Rilevamento Automatico (Italiano / Inglese)", value: "auto" },
                { name: "🇮🇹 Italiano", value: "it" },
                { name: "🇬🇧 English", value: "en" }
              )
          )
      )
      .addSubcommand(sub =>
        sub.setName("auto")
          .setDescription("Attiva o disattiva la lettura automatica dei messaggi in questo canale")
          .addBooleanOption(opt => opt.setName("attivo").setDescription("Attiva o disattiva la lettura automatica").setRequired(true))
          .addChannelOption(opt => opt.setName("canale").setDescription("Canale testuale da associare (default: canale corrente)").setRequired(false))
      )
      .addSubcommand(sub =>
        sub.setName("stop")
          .setDescription("Ferma la riproduzione vocale corrente e svuota la coda TTS")
      )
      .addSubcommand(sub =>
        sub.setName("queue")
          .setDescription("Mostra lo stato della coda messaggi TTS e le impostazioni correnti")
      )
      .addSubcommand(sub =>
        sub.setName("help")
          .setDescription("Guida all'uso di TTS BOT (comandi, rilevamento lingua e trucchi)")
      ),

    // 5. Social Announcer
    new SlashCommandBuilder()
      .setName("post-social")
      .setDescription("Pubblica un annuncio per un nuovo Short / TikTok / Reel in #social")
      .addStringOption(opt => opt.setName("titolo").setDescription("Titolo del video o del contenuto").setRequired(true))
      .addStringOption(opt => opt.setName("link_youtube").setDescription("Link diretto al video/short YouTube").setRequired(false))
      .addStringOption(opt => opt.setName("link_tiktok").setDescription("Link diretto al TikTok").setRequired(false))
      .addStringOption(opt => opt.setName("link_instagram").setDescription("Link diretto al Reel Instagram").setRequired(false))
      .addStringOption(opt => opt.setName("nota").setDescription("Nota o commento aggiuntivo").setRequired(false))
      .addBooleanOption(opt => opt.setName("ping").setDescription("Se taggare @everyone (default: true)").setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  ].map(c => c.toJSON());

  // Ready Event Handler: Initialize all foundational engines and platform suites
  client.once("ready", async () => {
    console.log(`[Bot V2] ✅ Connesso a Discord come ${client.user.tag} (${client.user.id})`);
    console.log(`[Bot V2] 🌐 Server presenti: ${client.guilds.cache.size}`);

    // Initialize all foundational engines synchronously on ready
    console.log("[Init] Registrazione listener dei moduli e delle suite platform...");
    initLoggerEngine(client, loadSettings);
    initTicketEngine(client, loadSettings, saveSettings);
    initVerificationEngine(client, loadSettings, saveSettings);
    initPartnershipEngine(client, loadSettings);
    initWelcomeEngine(client, loadSettings);
    initAutomodEngine(client, loadSettings);
    initVoiceEngine(client, loadSettings);
    initAiModeratorEngine(client, loadSettings, saveSettings);
    initGiveawayEngine(client, loadSettings);
    initSuggestionEngine(client, loadSettings);
    initLevelsEngine(client, loadSettings);
    initReactionRolesEngine(client);
    initCustomCommandsEngine(client, loadSettings);
    initCountingEngine(client, loadSettings, saveSettings);
    initStarboardEngine(client, loadSettings);
    initServerStatsEngine(client, loadSettings);
    initAntiNukeEngine(client, loadSettings);
    initWarnEngine(client, loadSettings);
    initAntiRaidEngine(client, loadSettings);
    initEntertainmentEngine(client, loadSettings);
    initUtilitiesEngine(client);
    initIntegrationsEngine(client);
    initAiAgentEngine(client);
    initAiTicketEngine(client);
    initMusicEngine(client, loadSettings);
    initTtsEngine(client, loadSettings);
    initUnbanAppealEngine(client, loadSettings);
    initBoosterEngine(client);
    initSocialNotifierEngine(client);
    initSentinel(client);
    console.log("[Init] ✅ Tutte le suite dell'architettura All-In-One Platform operative e connesse!");

    // Register slash commands globally in background non-blocking task
    (async () => {
      const rest = new REST({ version: "10" }).setToken(token);
      try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log(`[Bot V2] ✅ ${commands.length} Comandi slash registrati a livello globale!`);

        // Pulisci eventuali vecchi comandi guild-level che causavano la duplicazione visiva in Discord
        for (const [guildId] of client.guilds.cache) {
          try {
            await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: [] });
          } catch (e) {}
        }
      } catch (err) {
        console.error("[Bot V2] Errore registrazione comandi slash:", err.message);
      }
    })().catch(() => {});

    // Initialize Persistent Scheduler
    initScheduler(client, async (task) => {
      try {
        await roleManager.processRoleSchedule(client, task);
      } catch (err) {
        console.error("[Scheduler Execution Error]:", err.message);
      }
    });

    // Set explicit Discord presence (Always Online & Active)
    try {
      client.user.setPresence({
        status: "online",
        activities: [
          {
            name: "entra nel discord discord.gg/roomup",
            type: ActivityType.Custom,
            state: "entra nel discord discord.gg/roomup"
          }
        ]
      });
    } catch (err) {
      console.warn("[Presence Error]:", err.message);
    }

    // Periodic Heartbeat Presence Refresher (every 60s)
    setInterval(() => {
      try {
        if (client.isReady() && client.user) {
          client.user.setPresence({
            status: "online",
            activities: [
              {
                name: "entra nel discord discord.gg/roomup",
                type: ActivityType.Custom,
                state: "entra nel discord discord.gg/roomup"
              }
            ]
          });
        }
      } catch (e) {}
    }, 60000).unref();
  });

  // Gateway Diagnostics & Resilience Tracker
  client.loginHistory = [];
  client.lastLoginError = null;
  client.lastLoginAttempt = null;
  client.gatewayEvents = [];
  let hasEverConnected = false;

  function recordGatewayEvent(type, detail = null) {
    const entry = { type, detail, timestamp: new Date().toISOString() };
    client.gatewayEvents.unshift(entry);
    if (client.gatewayEvents.length > 25) client.gatewayEvents.pop();
  }

  // Discord Gateway Resilience & Error Listeners
  client.on("error", (err) => {
    recordGatewayEvent("error", err?.message || String(err));
    console.error("[Discord Client Error]:", err?.message || err);
  });

  client.on("warn", (warnMsg) => {
    recordGatewayEvent("warn", warnMsg);
  });

  // 180-Second Gateway Disconnect Watchdog:
  // Only arms IF the client previously connected, allowing natural gateway retries and preventing rapid restart death loops
  let disconnectTimer = null;
  function markDisconnected(reason) {
    recordGatewayEvent("disconnected", reason);
    if (!disconnectTimer && hasEverConnected) {
      disconnectTimer = setTimeout(() => {
        if (!client.isReady() || (client.ws && client.ws.status !== 0)) {
          console.error(`[CRITICAL GATEWAY WATCHDOG] Gateway disconnected for > 180s (${reason}). Exiting process for clean supervisor restart...`);
          process.exit(1);
        }
      }, 180000);
      if (disconnectTimer.unref) disconnectTimer.unref();
    }
  }

  function markConnected() {
    hasEverConnected = true;
    if (disconnectTimer) {
      clearTimeout(disconnectTimer);
      disconnectTimer = null;
    }
    recordGatewayEvent("connected", { tag: client.user?.tag, wsStatus: client.ws?.status });
  }

  client.on("shardReady", (shardId) => {
    recordGatewayEvent("shardReady", { shardId });
    markConnected();
  });
  client.on("ready", () => {
    markConnected();
  });

  client.on("shardError", (err, shardId) => {
    recordGatewayEvent("shardError", { shardId, error: err?.message || String(err) });
    markDisconnected(`shardError: ${err?.message}`);
    console.error(`[Discord Shard ${shardId} Error]:`, err?.message || err);
  });

  client.on("shardDisconnect", (event, shardId) => {
    recordGatewayEvent("shardDisconnect", { shardId, code: event?.code, reason: event?.reason });
    markDisconnected(`shardDisconnect code=${event?.code}`);
    console.warn(`[Discord Shard ${shardId}] Connessione interrotta (${event?.code || "N/A"}). Il gestore WebSocket di Discord.js ripristinerà la sessione automaticamente.`);
  });

  client.on("shardReconnecting", (shardId) => {
    recordGatewayEvent("shardReconnecting", { shardId });
    markDisconnected(`shardReconnecting`);
    console.log(`[Discord Shard ${shardId}] Riconnessione in corso...`);
  });

  client.on("shardResume", (shardId, replayedEvents) => {
    recordGatewayEvent("shardResume", { shardId, replayedEvents });
    markConnected();
    console.log(`[Discord Shard ${shardId}] Sessione ripristinata con successo (${replayedEvents} eventi sincronizzati).`);
    try {
      if (client.user) {
        client.user.setPresence({
          status: "online",
          activities: [
            {
              name: "entra nel discord discord.gg/roomup",
              type: ActivityType.Custom,
              state: "entra nel discord discord.gg/roomup"
            }
          ]
        });
      }
    } catch (e) {}
  });

  // Global Discord Event Listeners for Modular Engines
  client.on("messageCreate", async (message) => {
    // 1. Modmail DM handling
    if (!message.guild && !message.author.bot) {
      await modmailManager.handleDirectMessage(client, message);
      return;
    }

    // 2. Modmail staff reply handling inside thread
    if (message.guild && message.channel.isThread()) {
      await modmailManager.handleStaffReply(message);
    }

    if (!message.guild || message.author.bot) return;

    // 3. EventBus & Automations
    eventBus.emit("message_create", { guildId: message.guild.id, message });
    executeAutomations(message.guild, "message_create", {
      message,
      author: message.author,
      channel: message.channel,
      guild: message.guild,
      content: message.content
    }).catch(() => {});

    // 4. Quest Progress Tracking
    questManager.recordProgress(message.guild.id, message.author.id, "messages", 1);

    // 5. Knowledge Base Auto-Responder (disattivato rigorosamente in salotto, counting, comandi, livelli, annunci, regole)
    const chName = (message.channel?.name || "").toLowerCase();
    const isPublicCommunityChannel = /counting|salotto|comandi|livell|annunc|regol|ruol|chat|general|community|social|media|clip/i.test(chName);
    const cfg = getGuildConfig(message.guild.id);
    if (!isPublicCommunityChannel && cfg.knowledgeBase?.enabled && cfg.knowledgeBase?.autoResponder && /faq|help|assistenza/i.test(chName)) {
      const articles = knowledgeBase.searchKnowledgeBase(message.content);
      if (articles.length > 0 && message.content.length > 8 && !message.content.startsWith("!")) {
        const art = articles[0];
        const kbEmbed = new EmbedBuilder()
          .setTitle(`💡 Guida Rapida: ${art.title}`)
          .setDescription(art.content)
          .setColor(0x5865F2)
          .setFooter({ text: "Risposta automatica della Knowledge Base" });
        await message.reply({ embeds: [kbEmbed] }).catch(() => {});
      }
    }
  });

  client.on("guildMemberAdd", async (member) => {
    if (!member || !member.guild) return;
    await roleManager.handleMemberJoin(member);
    eventBus.emit("member_join", { guildId: member.guild.id, member });
    executeAutomations(member.guild, "member_join", {
      member,
      user: member.user,
      guild: member.guild
    }).catch(() => {});
  });

  client.on("guildMemberRemove", async (member) => {
    if (!member || !member.guild) return;
    await roleManager.handleMemberLeave(member);
    eventBus.emit("member_leave", { guildId: member.guild.id, member });
    executeAutomations(member.guild, "member_leave", {
      member,
      user: member.user,
      guild: member.guild
    }).catch(() => {});
  });

  // Slash Command interaction handlers
  client.on("interactionCreate", async (interaction) => {
    // 1. Form Modal Submissions
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith("form_submit_")) {
        const formId = interaction.customId.replace("form_submit_", "");
        const fields = {};
        interaction.fields.fields.forEach((val, key) => {
          fields[key] = val.value;
        });

        const sub = formBuilder.handleFormSubmission(formId, interaction.guild?.id || "0", interaction.user, fields);
        return interaction.reply({
          content: `✅ Modulo inviato con successo! Il nostro staff esaminerà la tua richiesta (ID: \`${sub.id}\`).`,
          ephemeral: true
        });
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;
    const { commandName, guild, channel, user, options } = interaction;
    if (!guild || !channel) return;

    // Panel Commands
    if (commandName === "ticket-panel") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: "❌ Solo gli amministratori possono usare questo comando.", ephemeral: true });
      }
      try {
        const config = getGuildConfig(guild.id);
        const panels = config.tickets?.panels || [];
        const panelData = panels[0] || {};
        await sendTicketPanel(channel, panelData);
        return interaction.reply({ content: "✅ Pannello Ticket inviato in questo canale!", ephemeral: true });
      } catch (err) {
        return interaction.reply({ content: `❌ Errore invio pannello: ${err.message}`, ephemeral: true });
      }
    }

    if (commandName === "verify-panel") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: "❌ Solo gli amministratori possono usare questo comando.", ephemeral: true });
      }
      try {
        const config = getGuildConfig(guild.id);
        await sendVerificationPanel(channel, config.verification);
        return interaction.reply({ content: "✅ Pannello Verifica inviato in questo canale!", ephemeral: true });
      } catch (err) {
        return interaction.reply({ content: `❌ Errore invio pannello: ${err.message}`, ephemeral: true });
      }
    }




  });

  // Resilient sanitized login matching LineaTemporale lifecycle
  const sanitizedToken = (token || "").trim().replace(/^["']|["']$/g, "");
  let loginAttempt = 0;

  function attemptGatewayLogin() {
    loginAttempt++;
    client.lastLoginAttempt = new Date().toISOString();
    console.log(`[Bot V2] Tentativo connessione Discord Gateway (#${loginAttempt})... (token len: ${sanitizedToken.length})`);

    client.login(sanitizedToken)
      .then(() => {
        console.log(`[Bot V2] ✅ Chiamata client.login completata con successo al tentativo #${loginAttempt}!`);
        client.lastLoginError = null;
        client.loginHistory.push({ attempt: loginAttempt, success: true, timestamp: new Date().toISOString() });
      })
      .catch(err => {
        console.error(`[Bot V2] ❌ Errore login gateway Discord (tentativo #${loginAttempt}):`, err?.message || err);
        client.lastLoginError = {
          message: err?.message,
          code: err?.code,
          status: err?.status,
          timestamp: new Date().toISOString(),
          attempt: loginAttempt
        };
        client.loginHistory.push({ attempt: loginAttempt, success: false, error: err?.message, timestamp: new Date().toISOString() });
        recordGatewayEvent("loginError", { attempt: loginAttempt, error: err?.message, code: err?.code });

        // Automatically retry if not ready, with exponential backoff up to 25s
        if (!client.isReady()) {
          const delay = Math.min(loginAttempt * 5000, 25000);
          console.log(`[Bot V2] Riprogrammato nuovo tentativo di login tra ${delay / 1000}s...`);
          setTimeout(attemptGatewayLogin, delay);
        }
      });
  }

  attemptGatewayLogin();

  return client;
}

function getClient() {
  return clientInstance;
}

module.exports = {
  createDiscordClient,
  getClient,
  registerProcessCrashGuards
};
