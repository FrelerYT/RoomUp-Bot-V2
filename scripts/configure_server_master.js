const fs = require("fs");
const path = require("path");

const SETTINGS_FILE = path.join(__dirname, "../data/settings.json");
const GUILD_ID = "1429445691452948524";

function run() {
  console.log("⚙️ Configurazione Master Server RoomUp! (" + GUILD_ID + ")...");
  const raw = fs.readFileSync(SETTINGS_FILE, "utf8");
  const allSettings = JSON.parse(raw);

  if (!allSettings[GUILD_ID]) {
    allSettings[GUILD_ID] = {};
  }

  const current = allSettings[GUILD_ID];

  // 1. VERIFICA (Manteniamo le impostazioni già completate e funzionanti)
  const verification = current.verification || {
    enabled: true,
    channelId: "1550847024285487177",
    verifiedRoleId: "1550846908011122688",
    logChannelId: "1550847075434893463", // #🧑‍🤝‍🧑・membri
    hideAllChannelsUntilVerified: true,
    hideChannelAfterVerify: true
  };
  verification.logChannelId = "1550847075434893463"; // #🧑‍🤝‍🧑・membri

  // 2. LIVELLI & XP (Con Card Grafica Esagoni + Avatar come Screenshot)
  const levels = {
    enabled: true,
    gainXpText: true,
    gainXpVoice: true,
    xpPerMessageMin: 15,
    xpPerMessageMax: 25,
    announceLevelUp: true,
    announceMode: "channel", // Canale dedicato #🌠・livello
    levelUpChannelId: "1550847048151081010", // #🌠・livello
    useCardBanner: true, // Attiva la card grafica Level Up personalizzata
    useEmbed: false, // Messaggio pulito + banner allegato (come screenshot)
    message: "Complimenti {user}, sei salito al livello **{level}**!",
    embedTitle: "🆙 Level Up!",
    embedColor: "#731fc3",
    embedFooterText: "RoomUp! • Classifica XP",
    showThumbnail: true,
    roleRewardsEnabled: false,
    roleRewards: {}
  };

  // 3. LOGGING MULTI-CANALE (157+ Eventi su Logistica)
  const logs = {
    enabled: true,
    globalChannelId: "1550847067432161350", // #🛅・moderazione di fallback
    embedColor: "#5865F2",
    categories: {
      messages: { enabled: true, channelId: "1550847070984863804" }, // #💬・messaggi
      channels: { enabled: true, channelId: "1550847072494948492" }, // #🏠・canali
      voice: { enabled: true, channelId: "1550847073622958123" },    // #🔊・vocali
      members: { enabled: true, channelId: "1550847075434893463" },  // #🧑‍🤝‍🧑・membri
      roles: { enabled: true, channelId: "1550847077083385868" },    // #🧢・ruoli
      automod: { enabled: true, channelId: "1550847078270504991" },  // #🎭・automod
      server: { enabled: true, channelId: "1550847081311248474" },   // #🗄️・altro
      moderation: { enabled: true, channelId: "1550847067432161350" } // #🛅・moderazione
    },
    events: {
      memberJoin: { channelId: "1550847066358423592" }, // #〽️・uscite-entrate
      memberLeave: { channelId: "1550847066358423592" },  // #〽️・uscite-entrate
      messageCreate: { channelId: "1550847070984863804" }, // #💬・messaggi
      messageDelete: { channelId: "1550847070984863804" }, // #💬・messaggi
      messageUpdate: { channelId: "1550847070984863804" }, // #💬・messaggi
      channelCreate: { channelId: "1550847072494948492" }, // #🏠・canali
      channelDelete: { channelId: "1550847072494948492" }, // #🏠・canali
      channelUpdate: { channelId: "1550847072494948492" },  // #🏠・canali
      voiceJoin: { channelId: "1550847073622958123" }, // #🔊・vocali
      voiceLeave: { channelId: "1550847073622958123" }, // #🔊・vocali
      voiceSwitch: { channelId: "1550847073622958123" }, // #🔊・vocali
      memberVerify: { channelId: "1550847075434893463" }, // #🧑‍🤝‍🧑・membri
      roleCreate: { channelId: "1550847077083385868" }, // #🧢・ruoli
      roleDelete: { channelId: "1550847077083385868" }, // #🧢・ruoli
      roleUpdate: { channelId: "1550847077083385868" }, // #🧢・ruoli
      memberRoleAdd: { channelId: "1550847077083385868" }, // #🧢・ruoli
      memberRoleRemove: { channelId: "1550847077083385868" }, // #🧢・ruoli
      inviteCreate: { channelId: "1550847081311248474" }, // #🗄️・altro
      inviteDelete: { channelId: "1550847081311248474" }, // #🗄️・altro
      serverUpdate: { channelId: "1550847081311248474" }, // #🗄️・altro
      emojiCreate: { channelId: "1550847081311248474" },  // #🗄️・altro
      emojiDelete: { channelId: "1550847081311248474" }   // #🗄️・altro
    }
  };

  // 4. BENVENUTO & ADDIO (Salotto + Auto-Elimina se Esce + Barra Sfumata)
  const welcome = {
    enabled: true,
    channelId: "1550847044858679326", // #🛋️・salotto
    sendChannelMessage: true,
    autoDeleteOnLeave: true, // Si auto-elimina se l'utente esce dal server
    chatMessage: "Benvenuto {user} nella nostra community {guild}!",
    useEmbed: true,
    embedTitle: "Benvenuto su {guild}!",
    embedColor: "#731FC3",
    embedDescription: "**Siamo felicissimi di averti qui con noi!**\n\nTi invitiamo a leggere il regolamento e a presentarti nella chat generale.\n\n*Divertiti e buona permanenza!*",
    embedFooterText: "Membro #{memberCount}",
    thumbnailMode: "guild", // Mostra icona del server come da screenshot
    useDividerBar: true, // Barra gradiente divisoria (welcome_bar.png)
    showThumbnail: true,
    pingUser: true,
    sendBanner: false,
    sendDm: false
  };

  const leave = {
    enabled: false, // Disabilitato qui per lasciare a loggerEngine la gestione fedele di #〽️・uscite-entrate
    channelId: "1550847066358423592", // #〽️・uscite-entrate
    message: "👋 **{username}** ha lasciato il server. Ora siamo in **{memberCount}** membri.",
    embedTitle: "👋 Arrivederci!",
    embedColor: "#E74C3C",
    embedFooter: "RoomUp! Community"
  };

  // 5. TICKET SYSTEM MULTI-PANEL
  const tickets = {
    enabled: true,
    logChannelId: "1550847067432161350", // #🛅・moderazione
    transcriptChannelId: "1550847069810327582", // #📁・transcript
    allowClaim: true,
    allowClose: true,
    requireCloseConfirmation: true,
    generateTranscript: true,
    sendDmTranscript: true,
    sendRatingSurvey: false,
    sendLog: true,
    welcomeEmbedTitle: "🎫 Assistenza #{ticketNumber}",
    welcomeEmbedColor: "#5865F2",
    welcomeEmbedFooter: "RoomUp! Support System",
    showThumbnail: true,
    closeEmbedTitle: "🔒 Ticket Chiuso",
    closeEmbedColor: "#E74C3C",
    closeDmMessage: "Il tuo ticket **#{ticketNumber}** su **{guild}** è stato archiviato.",
    panels: [
      {
        id: "panel_support",
        title: "SUPPORTO",
        description: "Crea un ticket per:\n\n• Problemi con il tuo **account**\n• Problemi riguardanti lo **shop**\n• **Segnalazioni**\n• Candidature **Staff**\n• Candidature **Content Creator**\n• Altre richieste o necessità\n\nClicca qui sotto per scegliere una sezione\ne creare il tuo ticket.",
        color: "#731FC3",
        channelId: "1550847055998746679", // #🎫・ticket
        placeholder: "Seleziona una categoria di ticket...",
        footer: "RoomUp! Support System",
        showThumbnail: true,
        useDividerBar: true,
        categories: [
          {
            key: "general",
            label: "Supporto generale",
            icon: "🛠️",
            desc: "Domande, bug, shop e segnalazioni.",
            staffRoleIds: ["1550846888708804759", "1550846890017300480", "1550846892017975378"],
            categoryId: "1550847019306979328", // 🎫 ᴀꜱꜱɪꜱᴛᴇɴᴢᴀ 🎫
            questions: []
          },
          {
            key: "partnership",
            label: "Partnership",
            icon: "🤝",
            desc: "Richiedi una partnership con il server.",
            staffRoleIds: ["1550846888708804759", "1550846898850631730"],
            categoryId: "1550847019306979328",
            questions: []
          },
          {
            key: "staff_app",
            label: "Candidature Staff",
            icon: "📄",
            desc: "Candidati come Staff su Discord, Minecraft o entrambi.",
            staffRoleIds: ["1550846888708804759", "1550846876624887868"],
            categoryId: "1550847019306979328",
            questions: []
          },
          {
            key: "media_app",
            label: "Candidatura Content Creator o Media",
            icon: "🎥",
            desc: "Candidati come Media o Content Creator.",
            staffRoleIds: ["1550846888708804759", "1550846898850631730"],
            categoryId: "1550847019306979328",
            questions: []
          }
        ]
      }
    ]
  };

  // 6. PARTNERSHIP
  const partnerships = {
    enabled: true,
    partnerChannelId: "1550847042195038269", // #🤝・partnership (Community)
    logChannelId: "1550847065284808804", // #🫂・info-partnership (Staff)
    staffRoleIds: ["1550846898850631730", "1550846888708804759"],
    pingRole: "1550846931826122783", // Ruolo Sponsor
    autoDeleteOnLeave: false,
    embedTitle: "🤝 Nuova Partnership Ufficiale!",
    embedColor: "#5865F2",
    embedFooter: "RoomUp! Network • Partnership System",
    descriptionTemplate: "Siamo felici di annunciare una nuova partnership con **{partnerGuild}**!\n\n{adText}\n\nUnisciti qui: {invite}",
    thumbnail: "",
    bannerImage: ""
  };

  // 7. COUNTING GAME
  const counting = {
    enabled: true,
    channelId: "1550847049988313178", // #🧮・counting
    resetOnFail: true,
    allowConsecutive: false,
    reactionsEnabled: true,
    milestoneCelebration: true,
    embedTitle: "🔢 Minigioco del Conteggio",
    embedColor: "#5865F2",
    embedFooter: "Regola: Conta un numero alla volta senza sbagliare!"
  };

  // 8. SUGGERIMENTI / RICHIESTE
  const suggestions = {
    enabled: true,
    channelId: "1550847063946829834", // #🗳️・richieste
    allowUpvoteDownvote: true,
    autoCreateThread: true,
    sendDmOnStatusChange: true,
    embedTitle: "💡 Nuova Proposta della Community",
    embedColor: "#F1C40F",
    embedFooter: "RoomUp! Suggerimenti • Vota con le reazioni!",
    submissionTemplate: "💡 **Proposta inviata da {user}:**\n\n{suggestion}\n\n*Usa le reazioni qui sotto per votare!*",
    approvedColor: "#2ECC71",
    rejectedColor: "#E74C3C",
    inProgressColor: "#3498DB"
  };

  // 9. WARNS & SANZIONI A SCAGLIONI
  const warns = {
    enabled: true,
    logChannelId: "1550847062235418647", // #🩸・sanzioni
    warnEmbedTitle: "⚠️ Notifica Disciplinare",
    warnEmbedFooter: "RoomUp! Moderation System",
    kickDmMessage: "Sei stato espulso da **{guild}** per violazione del regolamento: {reason}",
    banDmMessage: "Sei stato bannato permanentemente da **{guild}**: {reason}",
    timeoutDmMessage: "Sei stato messo in timeout su **{guild}** per {duration}: {reason}",
    levels: {
      "1": { action: "role", roleId: "1550846910871642155", duration: 0 }, // 1° Warn
      "2": { action: "role", roleId: "1550846912238850246", duration: 0 }, // 2° Warn
      "3": { action: "role", roleId: "1550846913702535178", duration: 0 }, // 3° Warn
      "4": { action: "timeout", duration: 86400000, roleId: "1550846909818867775" }, // Timeout 24h + Bannat*
      "5": { action: "ban", duration: 0 }
    }
  };

  // 10. AUTOMOD & AI MODERATOR
  const automod = {
    enabled: true,
    antiSpam: true,
    antiInvites: true,
    antiLinks: false, // Lasciamo link permessi per YouTube, Twitch, TikTok e Social
    antiBadWords: true,
    antiMassCaps: true,
    antiMassMentions: true,
    logChannelId: "1550847078270504991", // #🎭・automod
    ignoredRoleIds: ["1550846875328848004", "1550846876624887868", "1550846888708804759", "1550846890017300480"]
  };

  const aiModerator = {
    enabled: true,
    confidenceThreshold: 85,
    logChannelId: "1550847078270504991" // #🎭・automod
  };

  // 11. ANTI-RAID & ANTI-NUKE
  const antiRaid = {
    enabled: true,
    logChannelId: "1550847067432161350", // #🛅・moderazione
    lockdownChannelId: "1550847044858679326", // #🛋️・salotto
    joinThreshold: 6,
    windowSeconds: 10,
    raidEmbedTitle: "🚨 ALLERTA RAID RILEVATA",
    lockdownMessage: "🚨 Il server è temporaneamente in Lockdown di sicurezza a causa di accessi sospetti.",
    raidEmbedFooter: "RoomUp! Security Defense"
  };

  const antiNuke = {
    enabled: true,
    alertChannelId: "1550847067432161350", // #🛅・moderazione
    maxChannelDeletions: 2,
    maxRoleDeletions: 2,
    maxKicksBans: 4,
    emergencyEmbedDescription: "🚨 Intervento Anti-Nuke attivo: bloccate modifiche massive ai canali o ruoli.",
    emergencyEmbedFooter: "RoomUp! Emergency Defense"
  };

  // 12. STANZE VOCALI TEMPORANEE (Private Vocs)
  const voice = {
    enabled: true,
    generatorChannelId: "1550847041243054100", // 🏗️〢Crea Privata
    categoryId: "1550847018094698657", // 🔒 ᴘʀɪᴠᴀᴛᴇ ᴠᴏᴄꜱ 🔒
    channelNameTemplate: "🔒・Stanza di {username}",
    userLimit: 0,
    autoDeleteOnEmpty: true
  };

  // 13. BOT MUSICA & COESISTENZA VOCALE
  const music = {
    enabled: true,
    allowedTextChannelId: "1550847054836924509", // #🤖・comandi
    djRoleId: "1550846888708804759", // Head Staff
    coexistenceMode: "duck", // Abbassa il volume se parla il bot TTS
    duckVolume: 20,
    defaultVolume: 80,
    maxQueueSize: 50,
    autoLeaveTimeout: 60
  };

  // 14. STARBOARD
  const starboard = {
    enabled: true,
    channelId: "1550847046351585351", // #📸・media
    threshold: 3,
    emoji: "⭐"
  };

  // Applica al dizionario
  allSettings[GUILD_ID] = {
    ...current,
    verification,
    levels,
    logs,
    welcome,
    leave,
    tickets,
    partnerships,
    counting,
    suggestions,
    warns,
    automod,
    aiModerator,
    antiRaid,
    antiNuke,
    voice,
    music,
    starboard
  };

  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(allSettings, null, 2), "utf8");
  console.log("✅ Configurazione salvata con successo in " + SETTINGS_FILE);
}

run();
