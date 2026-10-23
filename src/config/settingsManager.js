const fs = require("fs");
const path = require("path");

const SETTINGS_FILE = path.join(__dirname, "../../data/settings.json");

const DEFAULT_CATEGORIES = {
  channels: { name: "Canali", enabled: false, channelId: "" },
  members: { name: "Membri & Utenti", enabled: false, channelId: "" },
  roles: { name: "Ruoli", enabled: false, channelId: "" },
  messages: { name: "Messaggi", enabled: false, channelId: "" },
  voice: { name: "Canali Vocali", enabled: false, channelId: "" },
  server: { name: "Server", enabled: false, channelId: "" },
  moderation: { name: "Moderazione & AutoMod", enabled: false, channelId: "" },
  emojis: { name: "Emoji & Sticker", enabled: false, channelId: "" },
  threads: { name: "Thread", enabled: false, channelId: "" },
  webhooks: { name: "Webhook", enabled: false, channelId: "" }
};

const DEFAULT_GAMES = {
  trivia: { enabled: false, embedColor: "#5865F2" },
  math: { enabled: false, embedColor: "#5865F2" },
  rps: { enabled: false, embedColor: "#5865F2" },
  slots: { enabled: false, embedColor: "#f1c40f" },
  blackjack: { enabled: false, embedColor: "#2c3e50" },
  piualto: { enabled: false, embedColor: "#3498db" },
  mysterybox: { enabled: false, embedColor: "#9b59b6" },
  grattaevinci: { enabled: false, embedColor: "#e67e22" },
  ruotafortuna: { enabled: false, embedColor: "#e74c3c" },
  indovina: { enabled: false, embedColor: "#1abc9c" },
  dadi: { enabled: false, embedColor: "#34495e" },
  tris: { enabled: false, embedColor: "#5865F2" },
  coinflip: { enabled: false, embedColor: "#f0b232" },
  meme: { enabled: false, embedColor: "#ec4899" }
};

function getDefaultGuildConfig(guildId, guildName = `Server ${guildId}`) {
  return {
    guildId,
    guildName,
    prefix: "!",

    // 1. DISCORD LOGGING SYSTEM (157+ Events)
    logs: {
      enabled: false,
      globalChannelId: "",
      embedColor: "#5865F2",
      categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
      events: {}
    },

    // 2. PARTNERSHIP SYSTEM
    partnerships: {
      enabled: false,
      partnerChannelId: "",
      logChannelId: "",
      staffRoleIds: [],
      pingRole: "@everyone",
      autoDeleteOnLeave: false,
      embedTitle: "🤝 Nuova Partnership Ufficiale!",
      embedColor: "#5865F2",
      embedFooter: "RoomUp! Network • Partnership System",
      descriptionTemplate: "Siamo felici di annunciare una nuova partnership con **{partnerGuild}**!\n\n{adText}\n\nUnisciti qui: {invite}",
      thumbnail: "",
      bannerImage: ""
    },

    // 3. TICKET SYSTEM MULTI-PANEL
    tickets: {
      enabled: false,
      logChannelId: "",
      transcriptChannelId: "",
      allowClaim: false,
      allowClose: false,
      requireCloseConfirmation: false,
      generateTranscript: false,
      sendDmTranscript: false,
      sendRatingSurvey: false,
      sendLog: false,
      welcomeEmbedTitle: "{icon} Ticket #{ticketNumber} • {category}",
      welcomeEmbedColor: "#5865F2",
      welcomeEmbedFooter: "RoomUp! Support System • Canale: {channel}",
      showThumbnail: false,
      closeEmbedTitle: "🔒 Ticket Chiuso",
      closeEmbedColor: "#e74c3c",
      closeDmMessage: "Il tuo ticket **#{ticketNumber}** su **{guild}** è stato chiuso da **{moderator}**.",
      panels: [
        {
          id: "panel_support",
          title: "RoomUp! - Assistenza & Supporto",
          description: "Seleziona una categoria dal menu sottostante per aprire un ticket privato con lo Staff.",
          color: "#5865F2",
          channelId: "",
          categories: [
            {
              key: "general",
              label: "Assistenza Generale",
              icon: "fa-screwdriver-wrench",
              desc: "Problemi tecnici, ruoli o domande generali",
              staffRoleIds: [],
              categoryId: "",
              questions: ["Descrivi dettagliatamente la tua richiesta:", "Hai screenshot o prove da allegare?"]
            },
            {
              key: "partnership",
              label: "Richiesta Partnership",
              icon: "fa-handshake",
              desc: "Richieste di affiliazione con la nostra community",
              staffRoleIds: [],
              categoryId: "",
              questions: ["Nome del tuo server/progetto:", "Link invito Discord:", "Numero di membri attivi:"]
            },
            {
              key: "report",
              label: "Segnalazione Utente",
              icon: "fa-triangle-exclamation",
              desc: "Segnala violazioni del regolamento o comportamenti scorretti",
              staffRoleIds: [],
              categoryId: "",
              questions: ["Tag o ID dell'utente segnalato:", "Regola infranta:", "Prove / Screenshot:"]
            },
            {
              key: "staff_app",
              label: "Candidatura Staff",
              icon: "fa-briefcase",
              desc: "Invia la tua candidatura per entrare nel team",
              staffRoleIds: [],
              categoryId: "",
              questions: ["Età anagrafica:", "Esperienze pregresse come Staff:", "Perché dovremmo scegliere te?"]
            }
          ]
        }
      ]
    },

    // 4. VERIFICATION SYSTEM
    verification: {
      enabled: false,
      channelId: "",
      verifiedRoleId: "",
      unverifiedRoleId: "",
      assignUnverifiedRole: false,
      hideChannelAfterVerify: false,
      hideAllChannelsUntilVerified: false,
      mode: "code", // "button", "code", "math", "emoji"
      embedTitle: "Verifica del Server",
      embedDescription: "Clicca sul pulsante sottostante per verificare il tuo account e sbloccare tutti i canali del server!",
      embedColor: "#5865F2",
      embedFooter: "Sistema di Protezione RoomUp!",
      thumbnail: "",
      image: "",
      buttonLabel: "Verificati Ora",
      buttonColor: "success",
      dmNotification: false,
      dmMessage: "Ciao {username}! Hai completato con successo la verifica in **{guild}**.{roles}\nBuona permanenza!",
      sendChannelLog: false,
      logChannelId: "",
      successMessage: "Hai completato la verifica con successo! Benvenuto in **{guild}**.{roles}",
      failMessage: "Risposta non corretta! (Tentativo {attempt}/{maxAttempts}). Riprova cliccando nuovamente sul pulsante.",
      punishmentMessage: "Hai superato il limite di tentativi consentiti ({maxAttempts}). Sei stato {action}.",
      alreadyVerifiedMessage: "✅ Sei già verificato in questo server!",
      disabledMessage: "⚠️ Il sistema di verifica è temporaneamente disattivato dall'amministratore.",
      sessionExpiredMessage: "La sessione di verifica è scaduta. Riprova cliccando nuovamente sul pulsante.",
      minAgeMessage: "Accesso negato: Il tuo account è troppo recente ({age} giorni). Il server richiede almeno {minDays} giorni di anzianità.",
      requireAvatarMessage: "Accesso negato: Il server richiede un account con un'immagine del profilo personalizzata.",
      maxFailedAttempts: 3,
      failedAction: "kick",
      minAccountAgeDays: 0,
      requireAvatar: false,
      extraRoleIds: []
    },

    // 5. WELCOME & LEAVE SYSTEM
    welcome: {
      enabled: false,
      channelId: "",
      sendChannelMessage: false,
      autoDeleteOnLeave: true,
      chatMessage: "Benvenuto {user} nella nostra community {guild}!",
      message: "Benvenuto {user} nella nostra community {guild}!",
      useEmbed: false,
      embedTitle: "Benvenuto su {guild}!",
      embedColor: "#731FC3",
      embedDescription: "**Siamo felicissimi di averti qui con noi!**\n\nTi invitiamo a leggere il regolamento e a presentarti nella chat generale.\n\n*Divertiti e buona permanenza!*",
      embedFooterText: "Membro #{memberCount}",
      thumbnailMode: "guild",
      useDividerBar: true,
      pingUser: false,
      sendBanner: false,
      showThumbnail: false,
      dmMessageEnabled: false,
      dmMessage: "Benvenuto su **{guild}**! Leggi il regolamento per iniziare al meglio la tua avventura.",
      dmUseEmbed: false,
      dmEmbedTitle: "Benvenuto nella nostra Community!",
      dmEmbedColor: "#5865F2"
    },
    leave: {
      enabled: false,
      channelId: "",
      sendChannelMessage: false,
      message: "🚪 **{username}** ha lasciato il server.",
      useEmbed: false,
      embedTitle: "Membro Uscito",
      embedColor: "#f23f43",
      embedFooterText: "Ci mancherai! • {guild}",
      showThumbnail: false
    },

    // 6. AUTOMOD & SICUREZZA
    automod: {
      enabled: false,
      logChannelId: "",
      antiInvite: false,
      antiLinks: false,
      badWordsEnabled: false,
      badWordsList: ["scam", "free nitro", "discord.gg/malware"],
      maxMentionsEnabled: false,
      maxMentions: 5,
      antiSpamEnabled: false,
      antiCapsEnabled: false,
      actionDeleteMessage: false,
      actionSendChatWarning: false,
      actionSendDmWarning: false,
      actionTimeoutUser: false,
      timeoutDurationMinutes: 10,
      actionSendLog: false,
      chatWarningMessage: "⚠️ <@{user}>, il tuo messaggio è stato rimosso da **AutoMod** ({reason}).",
      dmWarningMessage: "⚠️ Attenzione: un tuo messaggio su **{guild}** è stato rimosso per: **{reason}**.",
      logEmbedTitle: "🛡️ Intervento AutoMod",
      logEmbedColor: "#f23f43"
    },

    // 7. STANZE VOCALI TEMPORANEE
    voice: {
      enabled: false,
      hubChannelId: "",
      categoryId: "",
      controlPanelChannelId: "",
      defaultLimit: 0,
      autoDeleteEmpty: false,
      allowUserRename: false,
      allowUserLimit: false,
      allowUserLock: false
    },

    // 8. AI MODERATOR (SENTINEL AI)
    aiModerator: {
      enabled: false,
      mode: "autonomous", // "autonomous" o "consult_only"
      sensitivity: "medium", // "low", "medium", "high", "strict"
      consultationChannelId: "",
      staffRoleIds: []
    },

    // 10. GIVEAWAYS
    giveaways: {
      enabled: false,
      defaultChannelId: "",
      pingRole: "@everyone",
      pingRoleEnabled: false,
      sendDmToWinners: false,
      showParticipantsCount: false,
      startEmbedTitle: "🎉 GIVEAWAY DELLA COMMUNITY 🎉",
      startEmbedColor: "#5865F2",
      startEmbedFooter: "Reagisci o clicca per partecipare! • Termina",
      endEmbedTitle: "🎉 GIVEAWAY TERMINATO 🎉",
      winEmbedColor: "#23a55a",
      loseEmbedColor: "#f23f43",
      winMessage: "🎊 Congratulazioni {winners}! Hai vinto **{prize}**!",
      dmWinnerMessage: "🎉 Complimenti! Hai vinto il giveaway per **{prize}** su **{guild}**!",
      bannerImage: "",
      thumbnail: ""
    },

    // 11. SUGGESTIONS
    suggestions: {
      enabled: false,
      channelId: "",
      approvedChannelId: "",
      rejectedChannelId: "",
      staffRoleIds: [],
      autoCreateThread: false,
      sendDmOnStatusChange: false,
      allowUpvoteDownvote: false,
      embedTitle: "💡 Nuovo Suggerimento della Community",
      embedColor: "#5865F2",
      embedFooter: "RoomUp! Community Suggestions • ID: {suggestionId}",
      submissionTemplate: "💡 **Suggerimento:**\n{suggestion}\n\n*Vota qui sotto con le reazioni!*",
      approvedColor: "#23a55a",
      rejectedColor: "#f23f43",
      inProgressColor: "#f0b232"
    },

    // 12. LEVELS & XP
    levels: {
      enabled: false,
      xpPerMessageMin: 15,
      xpPerMessageMax: 25,
      gainXpText: false,
      gainXpVoice: false,
      gainXpMuted: true, // Assegna XP anche se mutato / deafened in vocale
      voiceMinMembers: 1, // Membri minimi nel canale vocale per ricevere XP (1 = anche da solo)
      announceLevelUp: false,
      announceMode: "channel", // "channel", "current", "dm", "disabled"
      levelUpChannelId: "",
      useCardBanner: true, // Custom Hexagon Canvas Level Up Banner Card
      useEmbed: false,
      embedTitle: "🆙 Level Up!",
      message: "Complimenti {user}, sei salito al livello **{level}**!",
      embedColor: "#731fc3",
      embedFooterText: "{guild} • Classifica XP",
      showThumbnail: false,
      roleRewardsEnabled: false,
      roleRewards: {} // { "5": "roleId5", "10": "roleId10" }
    },

    // 13. REACTION ROLES
    reactionRoles: {
      panels: []
    },

    // 14. CUSTOM COMMANDS & AUTO-RESPONSES
    customCommands: {
      triggers: [
        {
          trigger: "!ip",
          response: "L'indirizzo del nostro server è: **play.roomup.it**",
          useEmbed: true,
          title: "Indirizzo Server",
          color: "#5865F2"
        },
        {
          trigger: "!regole",
          response: "Consulta il regolamento completo del server nel canale dedicato!",
          useEmbed: true,
          title: "Regolamento",
          color: "#f0b232"
        }
      ]
    },

    // 15. COUNTING GAME
    counting: {
      enabled: false,
      channelId: "",
      currentCount: 0,
      highestScore: 0,
      lastUserId: "",
      resetOnFail: false,
      allowConsecutive: false,
      milestoneCelebration: false,
      reactionsEnabled: false,
      embedTitle: "🔢 Minigioco del Conteggio",
      embedColor: "#5865F2",
      embedFooter: "RoomUp! Games • Record: {highestScore}",
      failMessageSameUser: "❌ <@{user}>, non puoi contare due volte di seguito! Il conteggio si azzera a **0**. Record del server: **{highestScore}**.",
      failMessageWrongNumber: "❌ <@{user}> ha sbagliato! Il numero corretto doveva essere **{expected}** (invece di `{input}`). Il conteggio si azzera a **0**. Record del server: **{highestScore}**!",
      milestoneMessage: "🎉 Traguardo raggiunto: **{count}** numeri contati consecutivamente!"
    },

    // 16. STARBOARD SYSTEM
    starboard: {
      enabled: false,
      channelId: "",
      threshold: 3,
      starEmoji: "⭐",
      allowSelfStar: false,
      includeAttachments: false,
      showJumpUrl: false,
      embedColor: "#f0b232",
      embedFooterText: "ID: {messageId} • ⭐ {count}"
    },

    // 17. SERVER STATISTICS
    serverStats: {
      enabled: false,
      membersChannelId: "",
      boostChannelId: "",
      membersFormat: "Membri: {count}",
      boostFormat: "Boost: {count}"
    },

    // 18. ANTI-NUKE & PANIC MODE
    antiNuke: {
      enabled: false,
      maxChannelDeletes: 3,
      maxRoleDeletes: 3,
      protectChannels: false,
      protectRoles: false,
      stripRolesAction: false,
      timeoutAttackerAction: false,
      pingEveryoneOnPanic: false,
      logChannelId: "",
      emergencyEmbedTitle: "🚨 [ANTI-NUKE & PANIC MODE ATTIVATO]",
      emergencyEmbedDescription: "🚨 **Allarme di Sicurezza**: Rilevate azioni anomale non autorizzate. Attivata modalità di protezione e isolamento.",
      emergencyEmbedColor: "#f23f43",
      emergencyEmbedFooter: "RoomUp! Sentinel Anti-Nuke"
    },

    // 19. ANTI-RAID & PROFILE SCREENING (Area 2)
    antiRaid: {
      enabled: false,
      maxJoinsPer10s: 5,
      minAccountAgeDays: 3,
      accountAgeScreening: false,
      kickNoAvatar: false,
      avatarScreening: false,
      joinSpikeProtection: false,
      autoLockdownOnSpike: false,
      antiMassMention: false,
      antiEveryonePing: false,
      sendKickDm: false,
      raidEmbedTitle: "🛡️ Allerta Raid & Lockdown",
      lockdownMessage: "🚨 Il server è stato temporaneamente bloccato a causa di un afflusso anomalo di nuovi utenti. Vi preghiamo di attendere.",
      raidEmbedFooter: "RoomUp! Anti-Raid Defense",
      customAgeKickDm: "⚠️ Sei stato espulso da **{guild}**: il tuo account Discord è troppo recente ({age} giorni). Riprova tra qualche giorno!",
      customAvatarKickDm: "⚠️ Sei stato espulso da **{guild}**: è richiesta un'immagine profilo personalizzata per accedere.",
      logChannelId: "",
      logEmbedColor: "#f23f43"
    },

    // 20. DISCIPLINARY & WARNS (Area 3)
    warns: {
      enabled: false,
      timeoutAt3: false,
      kickAt5: false,
      banAt7: false,
      timeoutAtWarns: 3,
      kickAtWarns: 5,
      banAtWarns: 7,
      timeoutDurationMinutes: 60,
      sendDmOnWarn: false,
      sendDmOnKick: false,
      sendDmOnBan: false,
      sendDmOnTimeout: false,
      autoEscalation: false,
      warnEmbedTitle: "⚠️ Sanzione Disciplinare",
      warnEmbedFooter: "RoomUp! Moderation Suite",
      customWarnDmMessage: "⚠️ Hai ricevuto un avvertimento su **{guild}** per: **{reason}** (Avvertimenti totali: **{totalWarns}**).",
      kickDmMessage: "👞 Sei stato espulso da **{guild}** per: **{reason}**.",
      banDmMessage: "🔨 Sei stato bandito da **{guild}** per: **{reason}**.",
      timeoutDmMessage: "⏳ Sei stato messo in timeout su **{guild}** per **{duration} minuti** per: **{reason}**.",
      logChannelId: "",
      warnEmbedColor: "#f0b232"
    },

    // 21. ENTERTAINMENT & GAMES (Area 9)
    entertainment: {
      enabled: false,
      games: JSON.parse(JSON.stringify(DEFAULT_GAMES))
    },

    // 22. OPERATIONAL UTILITIES (Area 10)
    utilities: {
      enabled: false
    },

    // 23. EXTERNAL INTEGRATIONS (Area 11)
    integrations: {
      enabled: false,
      mcDefaultServer: "mc.roomup.it",
      githubLogChannelId: ""
    },

    // 24. AI AGENT ASSISTANT (Area 12)
    aiAgent: {
      enabled: false,
      autoMentionReply: false
    },

    // 25. ADVANCED ROLE MANAGEMENT
    roles: {
      autoRoles: [],
      delayedRoles: [], // [ { roleId: "", delayMinutes: 5 } ]
      stickyRolesEnabled: false
    },

    // 26. ADVANCED SECURITY & LOCKDOWN
    security: {
      lockdown: false,
      lockdownReason: "",
      quarantineRoleId: "",
      quarantineChannelId: "",
      panicMode: false
    },

    // 27. MODMAIL SYSTEM
    modmail: {
      enabled: false,
      staffRoleId: "",
      categoryId: "",
      logChannelId: ""
    },

    // 28. FORMS & APPLICATIONS
    forms: {
      enabled: false
    },

    // 29. KNOWLEDGE BASE & FAQ
    knowledgeBase: {
      enabled: false,
      autoResponder: false,
      faqChannelId: ""
    },

    // 30. COMMUNITY ECONOMY
    economy: {
      enabled: false,
      currencyName: "Monete",
      currencySymbol: "🪙",
      startingBalance: 100,
      dailyAmount: 50,
      workMin: 20,
      workMax: 80,
      shopItems: []
    },

    // 31. REPUTATION SYSTEM
    reputation: {
      enabled: false,
      cooldownHours: 24,
      logChannelId: ""
    },

    // 32. QUESTS & ACHIEVEMENTS
    quests: {
      enabled: false
    },

    // 33. SOCIAL & CONFESSIONS
    social: {
      birthdayChannelId: "",
      birthdayRoleId: "",
      confessionChannelId: "",
      requireReview: false
    },

    // 34. AUTOMATION WORKFLOWS
    automations: [],

    // 35. MUSIC BOT SYSTEM (Audio & TTS Coexistence)
    music: {
      enabled: false,
      djRoleId: "",
      defaultVolume: 80,
      maxQueueSize: 50,
      autoLeaveTimeout: 180,
      allowedVoiceChannels: [],
      allowedTextChannels: [],
      ttsCoexistenceMode: "duck", // "duck", "pause", "independent"
      ttsDuckingVolume: 20,
      embedColor: "#5865F2",
      playMessageTemplate: "🎶 In riproduzione: **{title}** [{duration}]",
      queueMessageTemplate: "📜 Coda attuale ({count} brani)",
      nowPlayingTemplate: "🎵 Ora in onda: **{title}** [{duration}] - Richiesto da <@{user}>"
    },

    // 35b. TTS BOT SYSTEM (Auto Language Detection & Voice)
    tts: {
      enabled: true,
      defaultLanguage: "auto", // "auto", "it", "en"
      autoJoinOnCommand: true,
      autoReadChannels: [],
      announceUser: false,
      maxMessageLength: 350,
      autoLeaveTimeout: 180
    },

    // 36. SERVER BOOSTER SYSTEM & REWARDS
    booster: {
      enabled: true,
      boosterRoleId: "965420993155858442",
      extraRoleIds: ["1554969583432245330"],
      boostChannelId: "",
      announcementEnabled: false,
      removeExtraRolesOnUnboost: true
    },

    // 37. SENTINEL AUTONOMOUS STAFF SYSTEM
    ai: {
      enabled: true,
      autonomyLevel: 4, // 0 to 5
      provider: "gemini",
      model: "gemini-3.6-flash",
      fallbackModel: "gemini-1.5-flash",
      temperature: 0.2,
      maxTokens: 1200,
      learningApproval: "AUTO_LEARN_LOW_RISK", // AUTO_LEARN_LOW_RISK, STAFF_APPROVAL_REQUIRED, MANUAL_ONLY
      maxAutonomousRisk: "LOW", // NONE, LOW, MEDIUM, HIGH, CRITICAL
      requireStaffConfirmHighRisk: true,
      confidenceThresholds: {
        escalate: 0.49,
        ask: 0.69,
        respond: 0.89
      },
      personality: {
        tone: "friendly",
        formality: "professional-but-human",
        verbosity: "concise",
        humor: "subtle",
        emoji: false,
        greetingStyle: "direct",
        language: "it"
      },
      tools: {
        timeout: true,
        warn: true,
        renameTicket: true,
        closeTicket: true,
        ban: false,
        kick: false
      }
    }
  };
}

function ensureDataDir() {
  const dir = path.dirname(SETTINGS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadSettings() {
  ensureDataDir();
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify({}, null, 2), "utf8");
      return {};
    }
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
  } catch (e) {
    console.error("[SettingsManager] Errore lettura settings.json:", e.message);
    return {};
  }
}

function saveSettings(settings) {
  ensureDataDir();
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf8");
    return true;
  } catch (e) {
    console.error("[SettingsManager] Errore scrittura settings.json:", e.message);
    return false;
  }
}

function deepMerge(target, source) {
  if (!source || typeof source !== "object") return target;
  for (const key of Object.keys(source)) {
    const val = source[key];
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      if (!target[key] || typeof target[key] !== "object" || Array.isArray(target[key])) {
        target[key] = {};
      }
      deepMerge(target[key], val);
    } else if (Array.isArray(val) && Array.isArray(target[key]) && key === "panels") {
      target[key] = val.map((panel, idx) => {
        const existing = target[key].find(p => p && p.id && p.id === panel.id) || target[key][idx] || {};
        return { ...existing, ...panel };
      });
    } else {
      target[key] = val;
    }
  }
  return target;
}

function getGuildConfig(guildId, guildName) {
  const allSettings = loadSettings();
  const def = getDefaultGuildConfig(guildId, guildName);
  if (!allSettings[guildId]) {
    allSettings[guildId] = def;
    saveSettings(allSettings);
    return allSettings[guildId];
  }
  
  // Deep-merge defaults with stored settings so any new keys/toggles/fields are populated
  const current = allSettings[guildId];
  const merged = deepMerge(JSON.parse(JSON.stringify(def)), current);
  merged.guildId = guildId;
  if (guildName && !merged.guildName) merged.guildName = guildName;
  allSettings[guildId] = merged;
  return allSettings[guildId];
}

function updateGuildConfig(guildId, newConfig) {
  const allSettings = loadSettings();
  const current = allSettings[guildId] || getDefaultGuildConfig(guildId);
  const cloned = JSON.parse(JSON.stringify(current));
  deepMerge(cloned, newConfig);
  cloned.guildId = guildId;
  allSettings[guildId] = cloned;
  saveSettings(allSettings);
  return allSettings[guildId];
}

module.exports = {
  loadSettings,
  saveSettings,
  getGuildConfig,
  updateGuildConfig,
  getDefaultGuildConfig,
  DEFAULT_CATEGORIES,
  DEFAULT_GAMES
};
