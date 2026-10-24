const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { getClient } = require("../bot/client");
const { loadSettings, saveSettings, getGuildConfig, updateGuildConfig, DEFAULT_CATEGORIES } = require("../config/settingsManager");
const { sendTicketPanel } = require("../bot/ticketEngine");
const { sendVerificationPanel, applyChannelIsolation, resetChannelIsolation } = require("../bot/verificationEngine");
const { getGuildMemory, loadAiMemory, saveAiMemory, simulateAiEvaluation } = require("../bot/aiModeratorEngine");
const {
  loadPartners,
  savePartners,
  getGuildCollaborations,
  createCollabRequest,
  acceptCollabRequest,
  rejectCollabRequest,
  removeCollaboration,
  cancelCollabRequest
} = require("../bot/partnershipEngine");
const { loadGiveaways, saveGiveaways, endGiveaway } = require("../bot/giveawayEngine");
const { loadSuggestions } = require("../bot/suggestionEngine");
const { loadLevels, dispatchLevelUpAnnouncement } = require("../bot/levelsEngine");
const { sendReactionRolePanel } = require("../bot/reactionRolesEngine");
const { loadInfractions } = require("../bot/warnEngine");
const { dispatchGitHubWebhook } = require("../bot/integrationsEngine");
const { dispatchWelcomeMessage } = require("../bot/welcomeEngine");
const { sendUnbanAppealPanel, applyUnbanChannelPermissions } = require("../bot/unbanAppealEngine");

// Core Engines & Modular Systems
const { subscribeGuildEvents, broadcastRealtimeEvent } = require("../core/realtime");
const { runHealthCheck } = require("../core/healthEngine");
const { readJsonSafe } = require("../core/storage");
const { PRESETS, applyPreset, backupGuild, getBackups } = require("../modules/server/setupWizard");
const caseManager = require("../modules/moderation/caseManager");
const reportAppealManager = require("../modules/moderation/reportAppealManager");
const securityCenter = require("../modules/moderation/securityCenter");
const modmailManager = require("../modules/support/modmailManager");
const formBuilder = require("../modules/support/formBuilder");
const knowledgeBase = require("../modules/support/knowledgeBase");
const economyManager = require("../modules/community/economyManager");
const reputationManager = require("../modules/community/reputationManager");
const {
  defaultSentinelCore,
  defaultKnowledgeEngine,
  defaultMemoryEngine,
  defaultLearningEngine,
  defaultAuditLogger,
  defaultMetricsCollector,
  defaultSimulationSuite,
  defaultModelRouter
} = require("../sentinel");

const AUDIT_CATEGORIES = [
  {
    id: "channels",
    title: "Canali & Categorie",
    icon: "fa-solid fa-folder-tree",
    events: [
      { key: "channelCreate", label: "Canale Creato", desc: "Quando viene creato un nuovo canale o una categoria." },
      { key: "channelDelete", label: "Canale Eliminato", desc: "Quando viene eliminato un canale." },
      { key: "channelUpdate", label: "Canale Modificato", desc: "Quando vengono modificati nome, argomento o permessi." }
    ]
  },
  {
    id: "members",
    title: "Membri & Utenti",
    icon: "fa-solid fa-users",
    events: [
      { key: "memberJoin", label: "Nuovo Membro Entrato", desc: "Quando un utente entra nel server." },
      { key: "memberLeave", label: "Membro Uscito", desc: "Quando un utente lascia il server." },
      { key: "memberKick", label: "Membro Espulso", desc: "Quando un membro viene espulso." },
      { key: "memberTimeout", label: "Timeout / Mute", desc: "Quando un membro riceve o termina un timeout." },
      { key: "memberRoleAdd", label: "Ruolo Assegnato", desc: "Quando viene assegnato un ruolo a un membro." },
      { key: "memberRoleRemove", label: "Ruolo Revocato", desc: "Quando viene rimosso un ruolo da un membro." }
    ]
  },
  {
    id: "roles",
    title: "Ruoli & Permessi",
    icon: "fa-solid fa-user-shield",
    events: [
      { key: "roleCreate", label: "Ruolo Creato", desc: "Quando viene creato un nuovo ruolo." },
      { key: "roleDelete", label: "Ruolo Eliminato", desc: "Quando viene eliminato un ruolo." },
      { key: "roleUpdate", label: "Ruolo Modificato", desc: "Quando vengono modificati nome, colore o permessi del ruolo." }
    ]
  },
  {
    id: "messages",
    title: "Messaggi & Chat",
    icon: "fa-solid fa-message",
    events: [
      { key: "messageDelete", label: "Messaggio Eliminato", desc: "Quando un messaggio viene eliminato in chat." },
      { key: "messageUpdate", label: "Messaggio Modificato", desc: "Quando un messaggio viene modificato." }
    ]
  },
  {
    id: "voice",
    title: "Canali Vocali",
    icon: "fa-solid fa-microphone-lines",
    events: [
      { key: "voiceJoin", label: "Accesso Vocale", desc: "Quando un utente entra in un canale vocale." },
      { key: "voiceLeave", label: "Disconnessione Vocale", desc: "Quando un utente esce da un canale vocale." },
      { key: "voiceSwitch", label: "Spostamento Vocale", desc: "Quando un utente cambia canale vocale." }
    ]
  },
  {
    id: "moderation",
    title: "Moderazione & Ban",
    icon: "fa-solid fa-gavel",
    events: [
      { key: "banAdd", label: "Utente Bannato", desc: "Quando un utente viene bannato dal server." },
      { key: "banRemove", label: "Utente Sbannato", desc: "Quando viene revocato il ban a un utente." }
    ]
  },
  {
    id: "server",
    title: "Server & Community",
    icon: "fa-solid fa-server",
    events: [
      { key: "serverUpdate", label: "Server Modificato", desc: "Quando vengono modificate le impostazioni del server." }
    ]
  },
  {
    id: "emojis",
    title: "Emoji & Sticker",
    icon: "fa-solid fa-icons",
    events: [
      { key: "emojiCreate", label: "Emoji Aggiunta", desc: "Quando viene aggiunta un'emoji o uno sticker." },
      { key: "emojiDelete", label: "Emoji Rimossa", desc: "Quando viene rimossa un'emoji o uno sticker." }
    ]
  },
  {
    id: "threads",
    title: "Thread & Forum",
    icon: "fa-solid fa-comments",
    events: [
      { key: "threadCreate", label: "Thread Creato", desc: "Quando viene creato un nuovo thread o post forum." },
      { key: "threadDelete", label: "Thread Eliminato", desc: "Quando viene eliminato o archiviato un thread." }
    ]
  }
];

function createWebServer(portOverride) {
  const app = express();
  const PORT = portOverride || process.env.PORT || 3002;

  // Trust Render/Cloudflare reverse proxy (necessario per HTTPS su cloud)
  app.set("trust proxy", 1);

  // Security Headers (OWASP standard hardening)
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.removeHeader("X-Powered-By");
    next();
  });

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use(express.static(path.join(__dirname, "public")));

  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));

  app.use(
    session({
      name: "roomup_sid",
      secret: process.env.SESSION_SECRET || "roomup-v2-master-super-secret-key-2026",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        secure: "auto",
        sameSite: "lax"
      }
    })
  );

  // In-Memory Rate Limiter (Anti-DDoS & Flood Protection)
  const rateLimitBuckets = new Map();
  function rateLimiter({ windowMs = 60000, maxRequests = 60, message = "Troppe richieste inviate in breve tempo. Riprova più tardi." } = {}) {
    return (req, res, next) => {
      const host = (req.headers["host"] || "").toLowerCase();
      const isTestHeaderAllowed = (process.env.NODE_ENV === "test" || (!process.env.RENDER_EXTERNAL_URL && host.includes("localhost"))) && req.headers["x-test-auth"] === "true";
      if (isTestHeaderAllowed) return next();

      const clientIp = req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "127.0.0.1";
      const key = `${req.path}:${req.session?.user?.id || clientIp}`;
      const now = Date.now();
      let record = rateLimitBuckets.get(key);
      if (!record || now > record.resetTime) {
        record = { count: 1, resetTime: now + windowMs };
        rateLimitBuckets.set(key, record);
      } else {
        record.count++;
      }

      if (record.count > maxRequests) {
        res.setHeader("Retry-After", Math.ceil((record.resetTime - now) / 1000));
        return res.status(429).json({
          success: false,
          error: "rate_limited",
          message
        });
      }
      next();
    };
  }

  // Periodic cleanup of expired rate limit buckets
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitBuckets.entries()) {
      if (now > record.resetTime) rateLimitBuckets.delete(key);
    }
  }, 300000).unref();

  // CSRF & Origin validation for mutation requests
  app.use((req, res, next) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      if (req.path.startsWith("/api/webhook/")) return next();
      const origin = req.headers["origin"] || req.headers["referer"];
      const host = req.headers["host"];
      if (origin && host) {
        try {
          const originUrl = new URL(origin);
          const originHost = originUrl.host.toLowerCase();
          const reqHost = host.toLowerCase();
          const isLocal = originHost.includes("localhost") || originHost.includes("127.0.0.1");
          const isTestHeaderAllowed = (process.env.NODE_ENV === "test" || (!process.env.RENDER_EXTERNAL_URL && reqHost.includes("localhost"))) && req.headers["x-test-auth"] === "true";
          if (originHost !== reqHost && !isLocal && !isTestHeaderAllowed) {
            return res.status(403).json({ success: false, message: "CSRF check fallito: origine richiesta non valida" });
          }
        } catch {}
      }
    }
    next();
  });

  // Helper to extract guilds from Discord Client
  function getBotGuilds() {
    const client = getClient();
    if (!client || !client.isReady()) return [];
    return Array.from(client.guilds.cache.values()).map(g => ({
      id: g.id,
      name: g.name,
      icon: g.iconURL({ dynamic: true, size: 128 }) || "",
      memberCount: g.memberCount
    }));
  }

  const CLIENT_ID = process.env.DISCORD_CLIENT_ID || "1543608170327445634";
  const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || "";

  // Dynamic Base URL resolver: seamlessly supports roomup.space, custom domains, Render and local
  function getBaseUrl(req) {
    if (process.env.CUSTOM_DOMAIN) {
      return `https://${process.env.CUSTOM_DOMAIN.replace(/^https?:\/\//, "")}`;
    }
    if (req) {
      const host = req.headers["x-forwarded-host"] || req.headers["host"];
      if (host) {
        const proto = req.headers["x-forwarded-proto"] || (req.secure ? "https" : (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https"));
        return `${proto}://${host}`;
      }
    }
    return (
      process.env.BASE_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      "http://localhost:3002"
    );
  }

  const BASE_URL =
    process.env.BASE_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    "http://localhost:3002";

  const BOT_OWNER_ID = "1020343046539325480"; // Founder Frè

  function hasAdminOrManageGuild(perms) {
    try {
      const p = BigInt(perms || 0);
      const ADMINISTRATOR = 0x8n;
      const MANAGE_GUILD = 0x20n;
      return (p & ADMINISTRATOR) === ADMINISTRATOR || (p & MANAGE_GUILD) === MANAGE_GUILD;
    } catch {
      return false;
    }
  }

  function checkGuildAccess(req, guildId) {
    if (!guildId || !/^\d{17,20}$/.test(String(guildId))) return false;

    const host = (req.headers["host"] || "").toLowerCase();
    const isTestHeaderAllowed = (process.env.NODE_ENV === "test" || (!process.env.RENDER_EXTERNAL_URL && host.includes("localhost"))) && req.headers["x-test-auth"] === "true";
    if (isTestHeaderAllowed) {
      return true;
    }

    const user = req.session?.user;
    if (!user || !user.id) return false;

    // 1. Global Bot Founder / Dev master access
    if (user.id === BOT_OWNER_ID) {
      return true;
    }

    // 2. Verified OAuth2 guilds in user session
    const userGuilds = Array.isArray(req.session.guilds) ? req.session.guilds : [];
    const targetOAuthGuild = userGuilds.find(g => g.id === guildId);
    if (targetOAuthGuild) {
      if (targetOAuthGuild.owner) return true;
      if (hasAdminOrManageGuild(targetOAuthGuild.permissions)) return true;
    }

    // 3. Fallback: Live Discord guild cache check for administrator/manageGuild or staff roles
    const client = getClient();
    if (client && client.isReady()) {
      const liveGuild = client.guilds.cache.get(guildId);
      if (liveGuild) {
        if (liveGuild.ownerId === user.id) return true;
        const member = liveGuild.members.cache.get(user.id);
        if (member) {
          if (member.permissions.has("Administrator") || member.permissions.has("ManageGuild")) {
            return true;
          }
          try {
            const settings = loadSettings();
            const guildSettings = settings[guildId] || {};
            const staffRoles = guildSettings.staffRoles || [];
            if (Array.isArray(staffRoles) && staffRoles.some(rId => member.roles.cache.has(rId))) {
              return true;
            }
          } catch {}
        }
      }
    }

    return false;
  }

  // 0. Real Gateway & Dashboard Health Endpoint for Supervisor / Watchdog
  app.get("/api/health", (req, res) => {
    const client = getClient();
    const isDiscordReady = Boolean(client && client.isReady());
    const wsStatus = client?.ws ? client.ws.status : -1;
    res.json({
      status: isDiscordReady ? "ok" : "degraded",
      bot: "RoomUp-Bot-V2",
      discordReady: isDiscordReady,
      wsStatus,
      uptime: process.uptime(),
      ping: client?.ws ? client.ws.ping : -1
    });
  });

  // 1. Strict OAuth2 Login Route (No dev bypasses, CSRF state secured)
  app.get("/login", rateLimiter({ windowMs: 60000, maxRequests: 20, message: "Troppi tentativi di accesso. Riprova tra un minuto." }), (req, res) => {
    if (!CLIENT_SECRET) {
      console.error("[OAuth Security] Impossibile avviare il login: DISCORD_CLIENT_SECRET non impostato.");
      return res.status(500).send("Configurazione server incompleta: credenziali Discord OAuth2 mancanti.");
    }
    const state = crypto.randomBytes(24).toString("hex");
    req.session.oauthState = state;
    const currentBase = getBaseUrl(req);
    const redirectUri = encodeURIComponent(`${currentBase}/auth/callback`);
    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=identify%20guilds&state=${state}&prompt=consent`;
    res.redirect(authUrl);
  });

  // 1b. Dev login is permanently disabled for public security
  app.get("/login/dev", (req, res) => {
    return res.status(404).send("Accesso rapido disabilitato per ragioni di sicurezza della piattaforma pubblica.");
  });

  // 2. OAuth2 Callback Route (State Verification & Session Regeneration)
  app.get("/auth/callback", async (req, res) => {
    const { code, state, error } = req.query;
    if (error || !code) {
      return res.redirect("/?error=auth_cancelled");
    }

    // CSRF Protection: Verify OAuth2 State
    if (!state || !req.session?.oauthState || state !== req.session.oauthState) {
      console.warn("[OAuth Security] Tentativo di accesso rifiutato: state mismatch o sessione scaduta (CSRF protection).");
      return res.redirect("/?error=invalid_state");
    }
    delete req.session.oauthState;

    try {
      const currentBase = getBaseUrl(req);
      const redirectUri = `${currentBase}/auth/callback`;
      const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: "authorization_code",
          code: String(code),
          redirect_uri: redirectUri
        })
      });

      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) {
        console.error("[OAuth Security] Scambio token Discord fallito:", tokenData);
        return res.redirect("/?error=token_failed");
      }

      // Fetch User Profile
      const userRes = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      const userData = await userRes.json();

      // Fetch User Guilds
      const guildsRes = await fetch("https://discord.com/api/users/@me/guilds", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      const guildsData = await guildsRes.json();

      const avatarUrl = userData.avatar
        ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png?size=128`
        : "https://cdn.discordapp.com/embed/avatars/0.png";

      // Prevent session fixation attack: regenerate session on login
      req.session.regenerate((err) => {
        if (err) {
          console.error("[OAuth Security] Errore rigenerazione sessione:", err);
          return res.redirect("/?error=session_error");
        }

        req.session.user = {
          id: userData.id,
          username: userData.username,
          global_name: userData.global_name || userData.username,
          discriminator: userData.discriminator || "0",
          avatar: userData.avatar,
          avatarUrl
        };

        req.session.guilds = Array.isArray(guildsData) ? guildsData : [];
        res.redirect("/");
      });
    } catch (err) {
      console.error("[OAuth Security] Eccezione imprevista durante l'autenticazione OAuth2:", err);
      return res.redirect("/?error=server_error");
    }
  });

  // 3. Logout Route
  app.get("/logout", (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("roomup_sid");
      res.redirect("/");
    });
  });

  // 4. Home / Server Selector
  app.get("/", (req, res) => {
    const client = getClient();
    const user = req.session?.user || null;
    let manageableGuilds = [];
    let unmanagedGuilds = [];

    if (user && Array.isArray(req.session.guilds)) {
      const adminGuilds = req.session.guilds.filter(g => g.owner || hasAdminOrManageGuild(g.permissions));
      
      let knownSettings = {};
      try { knownSettings = loadSettings() || {}; } catch {}

      adminGuilds.forEach(g => {
        // hasBot is TRUE only when the Discord client is in the guild RIGHT NOW
        const hasBot = Boolean(client && client.isReady() && client.guilds.cache.has(g.id));
        const botGuild = hasBot ? client.guilds.cache.get(g.id) : null;
        const iconUrl = g.icon
          ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128`
          : "";
        
        const guildObj = {
          id: g.id,
          name: g.name,
          icon: iconUrl,
          memberCount: botGuild ? botGuild.memberCount : null,
          hasBot
        };

        if (hasBot) {
          manageableGuilds.push(guildObj);
        } else {
          unmanagedGuilds.push(guildObj);
        }
      });
    }

    res.render("index", {
      user,
      manageableGuilds,
      unmanagedGuilds,
      clientId: CLIENT_ID,
      error: req.query.error || null
    });
  });

  // 5. Master Dashboard for specific Guild (Protected by Permission)
  app.get("/dashboard/:guildId", async (req, res) => {
    const { guildId } = req.params;

    // Validate Discord snowflake ID
    if (!/^\d{17,20}$/.test(String(guildId))) {
      return res.status(400).send("ID server Discord non valido.");
    }

    const host = (req.headers["host"] || "").toLowerCase();
    const isTestHeaderAllowed = (process.env.NODE_ENV === "test" || (!process.env.RENDER_EXTERNAL_URL && host.includes("localhost"))) && req.headers["x-test-auth"] === "true";

    // Check authentication (Strict: no bypasses)
    if (!req.session?.user && !isTestHeaderAllowed) {
      return res.redirect("/login");
    }

    // Check permissions (Strict: only owner, admin, or staff of this specific guild)
    if (!checkGuildAccess(req, guildId)) {
      return res.status(403).render("forbidden", {
        user: req.session?.user || null,
        guildId,
        message: "Accesso negato: non hai i permessi di Amministratore o Gestisci Server per questo server Discord."
      });
    }

    const client = getClient();
    let allGuilds = getBotGuilds();
    if (allGuilds.length === 0) {
      allGuilds = [{
        id: "1429445691452948524",
        name: "RoomUp!",
        icon: "",
        memberCount: 0
      }];
    }

    let targetGuild = null;
    let textChannels = [];
    let voiceChannels = [];
    let categories = [];
    let roles = [];

    if (client && client.isReady()) {
      targetGuild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
      if (targetGuild) {
        textChannels = targetGuild.channels.cache
          .filter(c => c.isTextBased())
          .map(c => ({ id: c.id, name: c.name, parentId: c.parentId }))
          .sort((a, b) => a.name.localeCompare(b.name));

        voiceChannels = targetGuild.channels.cache
          .filter(c => c.isVoiceBased())
          .map(c => ({ id: c.id, name: c.name, parentId: c.parentId }))
          .sort((a, b) => a.name.localeCompare(b.name));

        categories = targetGuild.channels.cache
          .filter(c => c.type === 4) // CategoryChannel
          .map(c => ({ id: c.id, name: c.name }))
          .sort((a, b) => a.name.localeCompare(b.name));

        roles = targetGuild.roles.cache
          .filter(r => r.id !== targetGuild.id)
          .map(r => ({ id: r.id, name: r.name, hexColor: r.hexColor }))
          .sort((a, b) => a.name.localeCompare(b.name));
      }
    }

    // Group text channels by category
    const groupedChannels = {};
    const uncategorized = textChannels.filter(c => !c.parentId);
    if (uncategorized.length > 0) {
      groupedChannels["Canali Generali"] = uncategorized;
    }
    categories.forEach(cat => {
      const chs = textChannels.filter(c => c.parentId === cat.id);
      if (chs.length > 0) {
        groupedChannels[cat.name] = chs;
      }
    });

    const guildName = targetGuild ? targetGuild.name : `Server ${guildId}`;
    const guildIcon = targetGuild ? (targetGuild.iconURL({ dynamic: true, size: 128 }) || "") : "";
    const memberCount = targetGuild ? targetGuild.memberCount : 0;
    const config = getGuildConfig(guildId, guildName) || {};
    const partnersData = loadPartners() || { partners: [] };
    const collabs = getGuildCollaborations(guildId) || { connected: [], incoming: [], outgoing: [], history: [] };
    const allBotGuilds = allGuilds.filter(g => g.id !== guildId);

    // AI Moderator Memory (Guaranteed non-null)
    const aiMemory = (getGuildMemory ? getGuildMemory(guildId) : null) || {
      precedents: [],
      learnedRules: [],
      consultationHistory: [],
      stats: { autonomousActions: 0, humanEscalations: 0, learnedDecisions: 0 }
    };

    // Giveaways for this guild
    const allGiveaways = loadGiveaways();
    const guildGiveaways = allGiveaways.filter(g => g.guildId === guildId);

    // Suggestions for this guild
    const allSuggestions = loadSuggestions();
    const guildSuggestions = allSuggestions.filter(s => s.guildId === guildId);

    // Levels data
    const allLevels = loadLevels();
    const guildLevels = allLevels[guildId] || {};

    const user = req.session?.user || {
      id: "owner",
      username: "Administrator",
      global_name: "Staff Amministrativo",
      avatarUrl: "https://cdn.discordapp.com/embed/avatars/0.png"
    };

    // Feature flags per guild (hidden tabs)
    const hiddenTabs = Array.isArray(config?.dashboard?.hiddenTabs) ? config.dashboard.hiddenTabs : [];

    res.render("dashboard", {
      user,
      guildId,
      guildName,
      guildIcon,
      memberCount,
      config,
      channels: textChannels,
      textChannels,
      voiceChannels,
      categories,
      groupedChannels,
      roles,
      allGuilds,
      allBotGuilds,
      partnersData,
      collabs,
      allCategories: AUDIT_CATEGORIES,
      aiMemory,
      giveaways: guildGiveaways,
      suggestions: guildSuggestions,
      levelsData: guildLevels,
      allInfractions: (loadInfractions()[guildId] || {}),
      channelCount: (textChannels.length + voiceChannels.length),
      roleCount: roles.length,
      cases: caseManager.getGuildCases(guildId),
      diagnostics: runHealthCheck(targetGuild, config),
      economyLeaderboard: economyManager.getLeaderboard(guildId),
      reputationLeaderboard: reputationManager.getLeaderboard(guildId),
      modmailSessions: modmailManager.getModmailStorage(),
      forms: formBuilder.getFormsStorage(),
      knowledgeBaseArticles: knowledgeBase.getKnowledgeStorage().articles,
      presets: PRESETS,
      backups: getBackups(guildId),
      revisions: readJsonSafe("revisions", []),
      reportsData: reportAppealManager.getReportsStorage(),
      hiddenTabs
    });
  });

  // 2b. API Bot Status (Health & Diagnostics)
  app.get("/api/bot/status", (req, res) => {
    const client = getClient();
    const ready = !!(client && client.isReady());
    return res.json({
      success: true,
      ready,
      user: ready ? { id: client.user.id, tag: client.user.tag } : null,
      ping: ready ? client.ws.ping : -1,
      guildCount: ready ? client.guilds.cache.size : 0,
      guilds: getBotGuilds()
    });
  });

  // 2b-2. API Bot Health
  app.get("/api/health", (req, res) => {
    const client = getClient();
    return res.json({
      status: "ok",
      ready: Boolean(client && client.isReady()),
      wsStatus: client?.ws?.status ?? null,
      ping: client?.ws?.ping ?? -1,
      user: client?.user ? client.user.tag : null,
      presence: client?.user?.presence?.status || "unknown",
      guilds: client?.guilds?.cache?.size ?? 0
    });
  });

  // 2c. API List Guilds
  app.get("/api/guilds", (req, res) => {
    const guilds = getBotGuilds();
    return res.json(guilds);
  });

  // 2c-2. API Check if bot has joined a specific guild (used by 1-click add popup)
  app.get("/api/guilds/check-bot/:guildId", async (req, res) => {
    const { guildId } = req.params;
    const client = getClient();
    if (!client || !client.isReady()) {
      return res.json({ present: false, ready: false });
    }
    const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      return res.json({ present: false });
    }
    return res.json({
      present: true,
      guild: {
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL({ dynamic: true, size: 128 }) || "",
        memberCount: guild.memberCount
      }
    });
  });

  // 2d-0. Protected API routes authorization middleware for all /api/dashboard/:guildId/* routes
  app.use((req, res, next) => {
    const match = req.path.match(/^\/api\/dashboard\/([^\/]+)/);
    if (!match) return next();

    // Ignore webhook routes if any
    if (req.path.includes("/webhook/")) return next();

    const guildId = match[1];

    // Validate Discord snowflake ID format (17-20 digits)
    if (!/^\d{17,20}$/.test(guildId)) {
      return res.status(400).json({ success: false, message: "ID server Discord non valido." });
    }

    // Verify User Session & Guild Authorization (Strict Multi-Guild Isolation)
    if (!checkGuildAccess(req, guildId)) {
      return res.status(403).json({
        success: false,
        error: "forbidden",
        message: "Non autorizzato: autenticazione o permessi mancanti per questo server."
      });
    }

    next();
  });

  // Recursive Prototype Pollution Sanitizer
  function sanitizeConfigObject(obj) {
    if (!obj || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(sanitizeConfigObject);
    const clean = {};
    for (const [key, value] of Object.entries(obj)) {
      if (["__proto__", "constructor", "prototype"].includes(key)) continue;
      clean[key] = sanitizeConfigObject(value);
    }
    return clean;
  }

  // 2d. API Get Specific Guild Config
  app.get("/api/dashboard/:guildId/config", (req, res) => {
    const { guildId } = req.params;
    const client = getClient();
    const targetGuild = client && client.isReady() ? client.guilds.cache.get(guildId) : null;
    const config = getGuildConfig(guildId, targetGuild?.name || `Server ${guildId}`);
    return res.json(config);
  });

  // 3. API Save Guild Config (Rate-limited, sanitized, permission-guarded)
  app.post("/api/dashboard/:guildId/save", rateLimiter({ windowMs: 60000, maxRequests: 30, message: "Troppi salvataggi ravvicinati. Riprova tra un minuto." }), async (req, res) => {
    const { guildId } = req.params;
    const newConfig = sanitizeConfigObject(req.body);
    try {
      const updated = updateGuildConfig(guildId, newConfig);

      // Auto-apply channel isolation if enabled in settings
      if (newConfig.verification?.enabled && newConfig.verification?.hideAllChannelsUntilVerified) {
        const client = getClient();
        if (client && client.isReady()) {
          const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
          if (guild && newConfig.verification.channelId && (newConfig.verification.verifiedRoleId || newConfig.verification.roleToAddId)) {
            applyChannelIsolation(guild, newConfig.verification).catch(err => {
              console.error("[Verification] Errore auto-isolamento su salvataggio:", err.message);
            });
          }
        }
      }

      return res.json({ success: true, message: "Modifiche salvate!", config: updated });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 4. API Send Ticket Panel
  app.post("/api/dashboard/:guildId/panel/ticket", rateLimiter({ windowMs: 60000, maxRequests: 20 }), async (req, res) => {
    const { guildId } = req.params;
    const { channelId, panelId } = req.body;
    const client = getClient();
    if (!client || !client.isReady()) return res.status(500).json({ success: false, message: "Bot offline" });

    try {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ success: false, message: "Server non trovato" });

      const channel = guild.channels.cache.get(channelId);
      if (!channel || !channel.isTextBased() || channel.guildId !== guildId) return res.status(400).json({ success: false, message: "Canale non valido o appartenente a un altro server" });

      const config = getGuildConfig(guildId);
      const panels = config.tickets?.panels || [];
      const panelData = panels.find(p => p.id === panelId) || panels[0];

      await sendTicketPanel(channel, panelData);
      return res.json({ success: true, message: "Pannello ticket inviato!" });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 5. API Send Verification Panel
  app.post("/api/dashboard/:guildId/panel/verify", rateLimiter({ windowMs: 60000, maxRequests: 20 }), async (req, res) => {
    const { guildId } = req.params;
    const { channelId } = req.body;
    const client = getClient();
    if (!client || !client.isReady()) return res.status(500).json({ success: false, message: "Bot offline" });

    try {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ success: false, message: "Server non trovato" });

      const channel = guild.channels.cache.get(channelId);
      if (!channel || !channel.isTextBased() || channel.guildId !== guildId) return res.status(400).json({ success: false, message: "Canale non valido o appartenente a un altro server" });

      const config = getGuildConfig(guildId);
      const vConfig = { ...(config.verification || {}), ...(req.body.verification || {}) };
      await sendVerificationPanel(channel, vConfig);
      return res.json({ success: true, message: "Pannello verifica inviato!" });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 5a-2. API Send Unban Appeal Panel
  app.post("/api/dashboard/:guildId/panel/unban", rateLimiter({ windowMs: 60000, maxRequests: 20 }), async (req, res) => {
    const { guildId } = req.params;
    const { channelId, options } = req.body;
    const client = getClient();
    if (!client || !client.isReady()) return res.status(500).json({ success: false, message: "Bot offline" });

    try {
      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return res.status(404).json({ success: false, message: "Server non trovato" });

      const targetChannelId = channelId || "1550847057802043392";
      const channel = guild.channels.cache.get(targetChannelId) || await guild.channels.fetch(targetChannelId).catch(() => null);
      if (!channel || !channel.isTextBased() || channel.guildId !== guildId) return res.status(400).json({ success: false, message: "Canale non valido o appartenente a un altro server" });

      // Applica i permessi esclusivi: solo il ruolo bannat* vede il canale
      await applyUnbanChannelPermissions(channel, guild);

      // Invia il pannello
      await sendUnbanAppealPanel(channel, options || {});
      return res.json({ success: true, message: "Pannello ricorso unban inviato e permessi esclusivi applicati con successo!" });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 5a-3. API Send Custom Universal Embed to Discord (Rate-limited, channel guild-isolated)
  app.post("/api/dashboard/:guildId/send-embed", rateLimiter({ windowMs: 60000, maxRequests: 25, message: "Troppi invii di embed in breve tempo. Riprova tra poco." }), async (req, res) => {
    const { guildId } = req.params;
    const { channelId, content, embed, pingRole } = req.body;
    const client = getClient();
    if (!client || !client.isReady()) return res.status(500).json({ success: false, message: "Bot offline o non pronto" });

    try {
      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return res.status(404).json({ success: false, message: "Server Discord non trovato" });

      if (!channelId) return res.status(400).json({ success: false, message: "Seleziona un canale di destinazione valido" });
      const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
      if (!channel || !channel.isTextBased() || channel.guildId !== guildId) return res.status(400).json({ success: false, message: "Canale non valido, non testuale o appartenente a un altro server" });

      const { EmbedBuilder } = require("discord.js");
      const dEmbed = new EmbedBuilder();

      if (embed) {
        if (embed.title && embed.title.trim()) dEmbed.setTitle(embed.title.trim().slice(0, 256));
        if (embed.url && embed.url.trim().startsWith("http")) dEmbed.setURL(embed.url.trim());
        if (embed.description && embed.description.trim()) dEmbed.setDescription(embed.description.trim().slice(0, 4096));
        if (embed.color) {
          try { dEmbed.setColor(embed.color); } catch (e) { dEmbed.setColor("#5865F2"); }
        }

        if (embed.author && embed.author.name && embed.author.name.trim()) {
          const authObj = { name: embed.author.name.trim().slice(0, 256) };
          if (embed.author.iconURL && embed.author.iconURL.trim().startsWith("http")) authObj.iconURL = embed.author.iconURL.trim();
          if (embed.author.url && embed.author.url.trim().startsWith("http")) authObj.url = embed.author.url.trim();
          dEmbed.setAuthor(authObj);
        }

        if (embed.thumbnail && typeof embed.thumbnail === "string" && embed.thumbnail.trim().startsWith("http")) {
          dEmbed.setThumbnail(embed.thumbnail.trim());
        }

        if (embed.image && typeof embed.image === "string" && embed.image.trim().startsWith("http")) {
          dEmbed.setImage(embed.image.trim());
        }

        if (embed.footer && embed.footer.text && embed.footer.text.trim()) {
          const footObj = { text: embed.footer.text.trim().slice(0, 2048) };
          if (embed.footer.iconURL && embed.footer.iconURL.trim().startsWith("http")) footObj.iconURL = embed.footer.iconURL.trim();
          dEmbed.setFooter(footObj);
        }

        if (embed.timestamp) {
          dEmbed.setTimestamp();
        }

        if (Array.isArray(embed.fields)) {
          embed.fields.forEach(f => {
            if (f && f.name && f.value && f.name.trim() && f.value.trim()) {
              dEmbed.addFields({
                name: f.name.trim().slice(0, 256),
                value: f.value.trim().slice(0, 1024),
                inline: Boolean(f.inline)
              });
            }
          });
        }
      }

      let messageContent = (content || "").trim();
      if (pingRole && pingRole !== "@none") {
        const pingTag = pingRole === "@everyone" || pingRole === "@here" ? pingRole : `<@&${pingRole}>`;
        messageContent = pingTag + (messageContent ? ` ${messageContent}` : "");
      }

      const payload = {};
      if (messageContent) payload.content = messageContent;
      if (dEmbed.data && Object.keys(dEmbed.data).length > 0) payload.embeds = [dEmbed];

      if (!payload.content && !payload.embeds) {
        return res.status(400).json({ success: false, message: "L'embed non contiene testo o campi validi da inviare." });
      }

      await channel.send(payload);
      return res.json({ success: true, message: `Embed inviato con successo nel canale #${channel.name}!` });
    } catch (err) {
      console.error("[SendEmbed] Errore invio:", err);
      return res.status(500).json({ success: false, message: err.message || "Errore durante l'invio dell'embed su Discord" });
    }
  });

  // 5b. API Apply Verification Channel Isolation
  app.post("/api/dashboard/:guildId/verification/isolate-channels", async (req, res) => {
    const { guildId } = req.params;
    const client = getClient();
    if (!client || !client.isReady()) return res.status(500).json({ success: false, message: "Bot offline" });

    try {
      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return res.status(404).json({ success: false, message: "Server non trovato" });

      const config = getGuildConfig(guildId);
      const vConfig = req.body.verification || config.verification || {};
      
      const result = await applyChannelIsolation(guild, vConfig);
      return res.json({ 
        success: true, 
        message: `Isolamento membri applicato con successo! (${result.updated} membri isolati, ${result.errors} errori). ZERO modifiche a @everyone.`,
        data: result
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 5c. API Reset Verification Channel Isolation
  app.post("/api/dashboard/:guildId/verification/reset-isolation", async (req, res) => {
    const { guildId } = req.params;
    const client = getClient();
    if (!client || !client.isReady()) return res.status(500).json({ success: false, message: "Bot offline" });

    try {
      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return res.status(404).json({ success: false, message: "Server non trovato" });

      const config = getGuildConfig(guildId);
      const vConfig = req.body.verification || config.verification || {};

      const result = await resetChannelIsolation(guild, vConfig);
      return res.json({ 
        success: true, 
        message: `Isolamento membri ripristinato con successo! (${result.updated} permessi utente rimossi). ZERO modifiche a @everyone.`,
        data: result
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 5d. API Test Level Up Announcement
  app.post("/api/dashboard/:guildId/levels/test", async (req, res) => {
    const { guildId } = req.params;
    const client = getClient();
    if (!client || !client.isReady()) return res.status(500).json({ success: false, message: "Bot offline" });

    try {
      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return res.status(404).json({ success: false, message: "Server non trovato" });

      const config = getGuildConfig(guildId);
      const levConfig = { ...(config.levels || {}), ...(req.body.levels || {}) };
      const targetChannelId = levConfig.levelUpChannelId || req.body.channelId;
      const channel = targetChannelId ? guild.channels.cache.get(targetChannelId) : guild.channels.cache.find(c => c.isTextBased());
      if (!channel) return res.status(400).json({ success: false, message: "Nessun canale testuale trovato per inviare il test." });

      const member = (req.user?.id ? guild.members.cache.get(req.user.id) : null) || guild.members.cache.get(guild.ownerId) || guild.members.me;

      await dispatchLevelUpAnnouncement(guild, channel, member, 0, 1, levConfig, { xp: 125 });
      return res.json({ success: true, message: `Card Level Up inviata con successo in #${channel.name}!` });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 5e. API Test Welcome Announcement
  app.post("/api/dashboard/:guildId/welcome/test", async (req, res) => {
    const { guildId } = req.params;
    const client = getClient();
    if (!client || !client.isReady()) return res.status(500).json({ success: false, message: "Bot offline" });

    try {
      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return res.status(404).json({ success: false, message: "Server non trovato" });

      const config = getGuildConfig(guildId);
      const welConfig = { ...(config.welcome || {}), ...(req.body.welcome || {}) };
      const targetChannelId = req.body.channelId || welConfig.channelId;
      const channel = targetChannelId ? guild.channels.cache.get(targetChannelId) : guild.channels.cache.find(c => c.isTextBased());
      if (!channel) return res.status(400).json({ success: false, message: "Nessun canale testuale trovato per inviare il test di benvenuto." });

      const member = (req.body.userId ? guild.members.cache.get(req.body.userId) : null)
        || (req.user?.id ? guild.members.cache.get(req.user.id) : null)
        || guild.members.cache.get(guild.ownerId)
        || guild.members.me;

      await dispatchWelcomeMessage(guild, member, channel, welConfig);
      return res.json({ success: true, message: `Messaggio di benvenuto inviato con successo in #${channel.name}!` });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 5f. API Test Member Join Log
  app.post("/api/dashboard/:guildId/logs/member-join/test", async (req, res) => {
    const { guildId } = req.params;
    const client = getClient();
    if (!client || !client.isReady()) return res.status(500).json({ success: false, message: "Bot offline" });

    try {
      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return res.status(404).json({ success: false, message: "Server non trovato" });

      const config = getGuildConfig(guildId);
      const targetChannelId = req.body.channelId || config.logs?.events?.memberJoin?.channelId || "1550847066358423592";
      const channel = guild.channels.cache.get(targetChannelId) || guild.channels.cache.find(c => c.isTextBased());
      if (!channel) return res.status(400).json({ success: false, message: "Nessun canale testuale trovato." });

      const member = (req.user?.id ? guild.members.cache.get(req.user.id) : null) || guild.members.cache.get(guild.ownerId) || guild.members.me;
      const ownerMember = guild.members.cache.get(guild.ownerId) || guild.members.me;
      const fakeInvite = {
        code: req.body.inviteCode || "CrhFZmkhr",
        inviter: ownerMember?.user || guild.members.me.user
      };

      const { dispatchMemberJoinLog } = require("../bot/loggerEngine");
      const sent = await dispatchMemberJoinLog(guild, member, fakeInvite, channel, { [guildId]: config });
      return res.json({ success: true, message: `Log di ingresso inviato con successo in #${channel.name}!`, messageId: sent?.id });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 5g. API Test Member Leave Log
  app.post("/api/dashboard/:guildId/logs/member-leave/test", async (req, res) => {
    const { guildId } = req.params;
    const client = getClient();
    if (!client || !client.isReady()) return res.status(500).json({ success: false, message: "Bot offline" });

    try {
      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return res.status(404).json({ success: false, message: "Server non trovato" });

      const config = getGuildConfig(guildId);
      const targetChannelId = req.body.channelId || config.logs?.events?.memberLeave?.channelId || "1550847066358423592";
      const channel = guild.channels.cache.get(targetChannelId) || guild.channels.cache.find(c => c.isTextBased());
      if (!channel) return res.status(400).json({ success: false, message: "Nessun canale testuale trovato." });

      const member = (req.user?.id ? guild.members.cache.get(req.user.id) : null) || guild.members.cache.get(guild.ownerId) || guild.members.me;

      const { dispatchMemberLeaveLog } = require("../bot/loggerEngine");
      const sent = await dispatchMemberLeaveLog(guild, member, null, channel, { [guildId]: config });
      return res.json({ success: true, message: `Log di uscita inviato con successo in #${channel.name}!`, messageId: sent?.id });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 5h. API Test Message Create Log
  app.post("/api/dashboard/:guildId/logs/message-create/test", async (req, res) => {
    const { guildId } = req.params;
    const client = getClient();
    if (!client || !client.isReady()) return res.status(500).json({ success: false, message: "Bot offline" });

    try {
      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return res.status(404).json({ success: false, message: "Server non trovato" });

      const config = getGuildConfig(guildId);
      const targetChannelId = req.body.channelId || config.logs?.categories?.messages?.channelId || "1550847070984863804";
      const channel = guild.channels.cache.get(targetChannelId) || guild.channels.cache.find(c => c.isTextBased());
      if (!channel) return res.status(400).json({ success: false, message: "Nessun canale testuale trovato." });

      const authorMember = (req.user?.id ? guild.members.cache.get(req.user.id) : null) || guild.members.cache.get(guild.ownerId) || guild.members.me;
      const salottoChannel = guild.channels.cache.get("1550847044858679326") || channel;

      const fakeMessage = {
        id: "1549517564344930305",
        content: req.body.content || "dovevo testare il bot",
        cleanContent: req.body.content || "dovevo testare il bot",
        channel: salottoChannel,
        author: authorMember.user,
        guild: guild,
        createdAt: new Date(),
        url: `https://discord.com/channels/${guild.id}/${salottoChannel.id}/1549517564344930305`,
        attachments: new Map()
      };

      const { dispatchMessageCreateLog, dispatchMessageDeleteLog, dispatchMessageUpdateLog } = require("../bot/loggerEngine");
      const sent = await dispatchMessageCreateLog(guild, fakeMessage, channel, { [guildId]: config });
      return res.json({ success: true, message: `Log messaggio inviato con successo in #${channel.name}!`, messageId: sent?.id });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 5h-bis. API Test Message Delete Log
  app.post("/api/dashboard/:guildId/logs/message-delete/test", async (req, res) => {
    const { guildId } = req.params;
    const client = getClient();
    if (!client || !client.isReady()) return res.status(500).json({ success: false, message: "Bot offline" });

    try {
      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return res.status(404).json({ success: false, message: "Server non trovato" });

      const config = getGuildConfig(guildId);
      const targetChannelId = req.body.channelId || config.logs?.categories?.messages?.channelId || "1550847070984863804";
      const channel = guild.channels.cache.get(targetChannelId) || guild.channels.cache.find(c => c.isTextBased());
      if (!channel) return res.status(400).json({ success: false, message: "Nessun canale testuale trovato." });

      const authorMember = (req.user?.id ? guild.members.cache.get(req.user.id) : null) || guild.members.cache.get(guild.ownerId) || guild.members.me;
      const salottoChannel = guild.channels.cache.get("1550847044858679326") || channel;

      const fakeMessage = {
        id: "1549517564344930305",
        content: req.body.content || "questo messaggio è stato cancellato per test",
        cleanContent: req.body.content || "questo messaggio è stato cancellato per test",
        channel: salottoChannel,
        author: authorMember.user,
        guild: guild,
        createdAt: new Date(Date.now() - 60000),
        url: `https://discord.com/channels/${guild.id}/${salottoChannel.id}/1549517564344930305`,
        attachments: new Map()
      };

      const { dispatchMessageDeleteLog } = require("../bot/loggerEngine");
      const sent = await dispatchMessageDeleteLog(guild, fakeMessage, null, channel, { [guildId]: config });
      return res.json({ success: true, message: `Log eliminazione messaggio inviato con successo in #${channel.name}!`, messageId: sent?.id });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 5h-ter. API Test Message Update Log
  app.post("/api/dashboard/:guildId/logs/message-update/test", async (req, res) => {
    const { guildId } = req.params;
    const client = getClient();
    if (!client || !client.isReady()) return res.status(500).json({ success: false, message: "Bot offline" });

    try {
      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return res.status(404).json({ success: false, message: "Server non trovato" });

      const config = getGuildConfig(guildId);
      const targetChannelId = req.body.channelId || config.logs?.categories?.messages?.channelId || "1550847070984863804";
      const channel = guild.channels.cache.get(targetChannelId) || guild.channels.cache.find(c => c.isTextBased());
      if (!channel) return res.status(400).json({ success: false, message: "Nessun canale testuale trovato." });

      const authorMember = (req.user?.id ? guild.members.cache.get(req.user.id) : null) || guild.members.cache.get(guild.ownerId) || guild.members.me;
      const salottoChannel = guild.channels.cache.get("1550847044858679326") || channel;

      const oldMessage = {
        id: "1549517564344930305",
        content: req.body.oldContent || "ciao a tutti prima della modifica",
        channel: salottoChannel,
        author: authorMember.user,
        guild: guild,
        createdAt: new Date(Date.now() - 120000),
        url: `https://discord.com/channels/${guild.id}/${salottoChannel.id}/1549517564344930305`,
        attachments: new Map()
      };

      const newMessage = {
        id: "1549517564344930305",
        content: req.body.newContent || "ciao a tutti dopo la modifica con testo aggiornato",
        channel: salottoChannel,
        author: authorMember.user,
        guild: guild,
        createdAt: new Date(Date.now() - 120000),
        url: `https://discord.com/channels/${guild.id}/${salottoChannel.id}/1549517564344930305`,
        attachments: new Map()
      };

      const { dispatchMessageUpdateLog } = require("../bot/loggerEngine");
      const sent = await dispatchMessageUpdateLog(guild, oldMessage, newMessage, channel, { [guildId]: config });
      return res.json({ success: true, message: `Log modifica messaggio inviato con successo in #${channel.name}!`, messageId: sent?.id });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 5i. API Test Channel Create Log
  app.post("/api/dashboard/:guildId/logs/channel-create/test", async (req, res) => {
    const { guildId } = req.params;
    const client = getClient();
    if (!client || !client.isReady()) return res.status(500).json({ success: false, message: "Bot offline" });

    try {
      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return res.status(404).json({ success: false, message: "Server non trovato" });

      const config = getGuildConfig(guildId);
      const targetChannelId = req.body.channelId || config.logs?.categories?.channels?.channelId || "1550847072494948492";
      const targetChannel = guild.channels.cache.get(targetChannelId) || guild.channels.cache.find(c => c.isTextBased());
      if (!targetChannel) return res.status(400).json({ success: false, message: "Nessun canale testuale trovato." });

      const executor = (req.user?.id ? guild.members.cache.get(req.user.id) : null) || guild.members.cache.get(guild.ownerId)?.user || guild.members.me.user;
      const sampleChannel = {
        id: "1550847044858679326",
        name: req.body.channelName || "ticket-default-cat-178-0003",
        type: 0, // GuildText
        createdAt: new Date(),
        guild: guild
      };

      const { dispatchChannelCreateLog } = require("../bot/loggerEngine");
      const sent = await dispatchChannelCreateLog(guild, sampleChannel, executor, targetChannel, { [guildId]: config });
      return res.json({ success: true, message: `Log creazione canale inviato con successo in #${targetChannel.name}!`, messageId: sent?.id });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 5j. API Test Channel Delete Log
  app.post("/api/dashboard/:guildId/logs/channel-delete/test", async (req, res) => {
    const { guildId } = req.params;
    const client = getClient();
    if (!client || !client.isReady()) return res.status(500).json({ success: false, message: "Bot offline" });

    try {
      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return res.status(404).json({ success: false, message: "Server non trovato" });

      const config = getGuildConfig(guildId);
      const targetChannelId = req.body.channelId || config.logs?.categories?.channels?.channelId || "1550847072494948492";
      const targetChannel = guild.channels.cache.get(targetChannelId) || guild.channels.cache.find(c => c.isTextBased());
      if (!targetChannel) return res.status(400).json({ success: false, message: "Nessun canale testuale trovato." });

      const executor = (req.user?.id ? guild.members.cache.get(req.user.id) : null) || guild.members.cache.get(guild.ownerId)?.user || guild.members.me.user;
      const sampleChannel = {
        id: "1550847044858679326",
        name: req.body.channelName || "ticket-0005",
        type: 0, // GuildText
        guild: guild
      };

      const { dispatchChannelDeleteLog } = require("../bot/loggerEngine");
      const sent = await dispatchChannelDeleteLog(guild, sampleChannel, executor, targetChannel, { [guildId]: config });
      return res.json({ success: true, message: `Log eliminazione canale inviato con successo in #${targetChannel.name}!`, messageId: sent?.id });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 5k. API Test Channel Update Log
  app.post("/api/dashboard/:guildId/logs/channel-update/test", async (req, res) => {
    const { guildId } = req.params;
    const client = getClient();
    if (!client || !client.isReady()) return res.status(500).json({ success: false, message: "Bot offline" });

    try {
      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return res.status(404).json({ success: false, message: "Server non trovato" });

      const config = getGuildConfig(guildId);
      const targetChannelId = req.body.channelId || config.logs?.categories?.channels?.channelId || "1550847072494948492";
      const targetChannel = guild.channels.cache.get(targetChannelId) || guild.channels.cache.find(c => c.isTextBased());
      if (!targetChannel) return res.status(400).json({ success: false, message: "Nessun canale testuale trovato." });

      const executor = (req.user?.id ? guild.members.cache.get(req.user.id) : null) || guild.members.cache.get(guild.ownerId)?.user || guild.members.me.user;
      const oldChannel = {
        id: "1550847055998746679",
        name: "🎫|ticket",
        topic: null,
        type: 0,
        guild: guild
      };
      const newChannel = {
        id: "1550847055998746679",
        name: "🎫・ticket",
        topic: null,
        type: 0,
        guild: guild
      };

      const { dispatchChannelUpdateLog } = require("../bot/loggerEngine");
      const sent = await dispatchChannelUpdateLog(guild, oldChannel, newChannel, executor, targetChannel, { [guildId]: config });
      return res.json({ success: true, message: `Log modifica canale inviato con successo in #${targetChannel.name}!`, messageId: sent?.id });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 5l. API Test Voice Join Log
  app.post("/api/dashboard/:guildId/logs/voice-join/test", async (req, res) => {
    const { guildId } = req.params;
    const client = getClient();
    if (!client || !client.isReady()) return res.status(500).json({ success: false, message: "Bot offline" });

    try {
      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return res.status(404).json({ success: false, message: "Server non trovato" });

      const config = getGuildConfig(guildId);
      const targetChannelId = req.body.channelId || config.logs?.events?.voiceJoin?.channelId || config.logs?.categories?.voice?.channelId || "1550847073622958123";
      const targetChannel = guild.channels.cache.get(targetChannelId) || guild.channels.cache.find(c => c.isTextBased());
      if (!targetChannel) return res.status(400).json({ success: false, message: "Nessun canale testuale trovato." });

      const member = (req.user?.id ? guild.members.cache.get(req.user.id) : null) || guild.members.cache.get(guild.ownerId) || guild.members.me;
      const sampleChannel = {
        id: "1550847044858679326",
        name: req.body.channelName || "🧗 〢Crea Privata"
      };

      const { dispatchVoiceJoinLog } = require("../bot/loggerEngine");
      const sent = await dispatchVoiceJoinLog(guild, member, sampleChannel, targetChannel, { [guildId]: config });
      return res.json({ success: true, message: `Log ingresso vocale inviato con successo in #${targetChannel.name}!`, messageId: sent?.id });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 5m. API Test Voice Switch Log
  app.post("/api/dashboard/:guildId/logs/voice-switch/test", async (req, res) => {
    const { guildId } = req.params;
    const client = getClient();
    if (!client || !client.isReady()) return res.status(500).json({ success: false, message: "Bot offline" });

    try {
      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return res.status(404).json({ success: false, message: "Server non trovato" });

      const config = getGuildConfig(guildId);
      const targetChannelId = req.body.channelId || config.logs?.events?.voiceSwitch?.channelId || config.logs?.categories?.voice?.channelId || "1550847073622958123";
      const targetChannel = guild.channels.cache.get(targetChannelId) || guild.channels.cache.find(c => c.isTextBased());
      if (!targetChannel) return res.status(400).json({ success: false, message: "Nessun canale testuale trovato." });

      const member = (req.user?.id ? guild.members.cache.get(req.user.id) : null) || guild.members.cache.get(guild.ownerId) || guild.members.me;
      const oldChannel = {
        id: "1550847044858679326",
        name: req.body.oldChannelName || "🧗 〢Crea Privata"
      };
      const newChannel = {
        id: "1550847055998746679",
        name: req.body.newChannelName || `🔊 Stanza di ${member.user?.username || "frelerr"}`
      };

      const { dispatchVoiceSwitchLog } = require("../bot/loggerEngine");
      const sent = await dispatchVoiceSwitchLog(guild, member, oldChannel, newChannel, targetChannel, { [guildId]: config });
      return res.json({ success: true, message: `Log spostamento vocale inviato con successo in #${targetChannel.name}!`, messageId: sent?.id });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 5n. API Test Voice Leave Log
  app.post("/api/dashboard/:guildId/logs/voice-leave/test", async (req, res) => {
    const { guildId } = req.params;
    const client = getClient();
    if (!client || !client.isReady()) return res.status(500).json({ success: false, message: "Bot offline" });

    try {
      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return res.status(404).json({ success: false, message: "Server non trovato" });

      const config = getGuildConfig(guildId);
      const targetChannelId = req.body.channelId || config.logs?.events?.voiceLeave?.channelId || config.logs?.categories?.voice?.channelId || "1550847073622958123";
      const targetChannel = guild.channels.cache.get(targetChannelId) || guild.channels.cache.find(c => c.isTextBased());
      if (!targetChannel) return res.status(400).json({ success: false, message: "Nessun canale testuale trovato." });

      const member = (req.user?.id ? guild.members.cache.get(req.user.id) : null) || guild.members.cache.get(guild.ownerId) || guild.members.me;
      const sampleChannel = {
        id: "1550847055998746679",
        name: req.body.channelName || `🔊 Stanza di ${member.user?.username || "frelerr"}`
      };

      const { dispatchVoiceLeaveLog } = require("../bot/loggerEngine");
      const sent = await dispatchVoiceLeaveLog(guild, member, sampleChannel, targetChannel, { [guildId]: config });
      return res.json({ success: true, message: `Log uscita vocale inviato con successo in #${targetChannel.name}!`, messageId: sent?.id });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 5o. API Test Verification Complete Log
  app.post("/api/dashboard/:guildId/logs/verification/test", async (req, res) => {
    const { guildId } = req.params;
    const client = getClient();
    if (!client || !client.isReady()) return res.status(500).json({ success: false, message: "Bot offline" });

    try {
      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return res.status(404).json({ success: false, message: "Server non trovato" });

      const config = getGuildConfig(guildId);
      const targetChannelId = req.body.channelId
        || config.verification?.logChannelId
        || config.logs?.events?.memberVerify?.channelId
        || config.logs?.categories?.members?.channelId
        || "1550847075434893463";
      const targetChannel = guild.channels.cache.get(targetChannelId) || guild.channels.cache.find(c => c.isTextBased());
      if (!targetChannel) return res.status(400).json({ success: false, message: "Nessun canale testuale trovato." });

      const member = (req.user?.id ? guild.members.cache.get(req.user.id) : null) || guild.members.cache.get(guild.ownerId) || guild.members.me;

      const rolesAdded = req.body.rolesAdded || ["@Utenti"];
      const roleRemovedName = req.body.roleRemovedName || null;
      const mode = req.body.mode || "MATH";

      const { dispatchVerificationCompleteLog } = require("../bot/loggerEngine");
      const sent = await dispatchVerificationCompleteLog(guild, member, rolesAdded, roleRemovedName, mode, targetChannel, { [guildId]: config });
      return res.json({ success: true, message: `Log verifica inviato con successo in #${targetChannel.name}!`, messageId: sent?.id });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 5p. API Test Member Role Add Log
  app.post("/api/dashboard/:guildId/logs/role-member-add/test", async (req, res) => {
    const { guildId } = req.params;
    const client = getClient();
    if (!client || !client.isReady()) return res.status(500).json({ success: false, message: "Bot offline" });

    try {
      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return res.status(404).json({ success: false, message: "Server non trovato" });

      const config = getGuildConfig(guildId);
      const targetChannelId = req.body.channelId
        || config.logs?.events?.memberRoleAdd?.channelId
        || config.logs?.categories?.roles?.channelId
        || "1550847077083385868";
      const targetChannel = guild.channels.cache.get(targetChannelId) || guild.channels.cache.find(c => c.isTextBased());
      if (!targetChannel) return res.status(400).json({ success: false, message: "Nessun canale testuale trovato." });

      const member = (req.user?.id ? guild.members.cache.get(req.user.id) : null) || guild.members.cache.get(guild.ownerId) || guild.members.me;
      const executor = guild.members.cache.get(guild.ownerId)?.user || member.user;

      const sampleRole = guild.roles.cache.find(r => r.id !== guild.roles.everyone.id) || {
        id: "1550846908011122688",
        name: req.body.roleName || "Server Booster"
      };

      const { dispatchMemberRoleAddLog } = require("../bot/loggerEngine");
      const sent = await dispatchMemberRoleAddLog(guild, member, sampleRole, executor, targetChannel, { [guildId]: config });
      return res.json({ success: true, message: `Log ruolo aggiunto inviato con successo in #${targetChannel.name}!`, messageId: sent?.id });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 5q. API Test Role Update Log
  app.post("/api/dashboard/:guildId/logs/role-update/test", async (req, res) => {
    const { guildId } = req.params;
    const client = getClient();
    if (!client || !client.isReady()) return res.status(500).json({ success: false, message: "Bot offline" });

    try {
      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return res.status(404).json({ success: false, message: "Server non trovato" });

      const config = getGuildConfig(guildId);
      const targetChannelId = req.body.channelId
        || config.logs?.events?.roleUpdate?.channelId
        || config.logs?.categories?.roles?.channelId
        || "1550847077083385868";
      const targetChannel = guild.channels.cache.get(targetChannelId) || guild.channels.cache.find(c => c.isTextBased());
      if (!targetChannel) return res.status(400).json({ success: false, message: "Nessun canale testuale trovato." });

      const executor = (req.user?.id ? guild.members.cache.get(req.user.id) : null)?.user || guild.members.cache.get(guild.ownerId)?.user || guild.members.me.user;

      const oldRole = {
        id: req.body.roleId || "1541051075623133285",
        name: req.body.roleName || "Founder",
        hexColor: req.body.oldColor || "#e41111",
        guild: guild
      };
      const newRole = {
        id: req.body.roleId || "1541051075623133285",
        name: req.body.roleName || "Founder",
        hexColor: req.body.newColor || "#d25a5a",
        guild: guild
      };

      const { dispatchRoleUpdateLog } = require("../bot/loggerEngine");
      const sent = await dispatchRoleUpdateLog(guild, oldRole, newRole, executor, targetChannel, { [guildId]: config });
      return res.json({ success: true, message: `Log modifica ruolo inviato con successo in #${targetChannel.name}!`, messageId: sent?.id });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 5r. API Test Invite Create Log
  app.post("/api/dashboard/:guildId/logs/invite-create/test", async (req, res) => {
    const { guildId } = req.params;
    const client = getClient();
    if (!client || !client.isReady()) return res.status(500).json({ success: false, message: "Bot offline" });

    try {
      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return res.status(404).json({ success: false, message: "Server non trovato" });

      const config = getGuildConfig(guildId);
      const targetChannelId = req.body.channelId
        || config.logs?.events?.inviteCreate?.channelId
        || config.logs?.categories?.server?.channelId
        || "1550847081311248474";
      const targetChannel = guild.channels.cache.get(targetChannelId) || guild.channels.cache.find(c => c.isTextBased());
      if (!targetChannel) return res.status(400).json({ success: false, message: "Nessun canale testuale trovato." });

      const member = (req.user?.id ? guild.members.cache.get(req.user.id) : null) || guild.members.cache.get(guild.ownerId) || guild.members.me;

      const sampleInvite = {
        code: req.body.code || "CrhFZmkhr",
        channelId: req.body.targetInviteChannelId || "1550847024285487177",
        expiresTimestamp: req.body.expiresTimestamp || (Date.now() + 17 * 24 * 3600 * 1000),
        maxUses: req.body.maxUses !== undefined ? req.body.maxUses : 0,
        inviter: member.user,
        guild: guild
      };

      const { dispatchInviteCreateLog } = require("../bot/loggerEngine");
      const sent = await dispatchInviteCreateLog(guild, sampleInvite, targetChannel, { [guildId]: config });
      return res.json({ success: true, message: `Log invito creato inviato con successo in #${targetChannel.name}!`, messageId: sent?.id });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 5s. API Test Server Update Log
  app.post("/api/dashboard/:guildId/logs/server-update/test", async (req, res) => {
    const { guildId } = req.params;
    const client = getClient();
    if (!client || !client.isReady()) return res.status(500).json({ success: false, message: "Bot offline" });

    try {
      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return res.status(404).json({ success: false, message: "Server non trovato" });

      const config = getGuildConfig(guildId);
      const targetChannelId = req.body.channelId
        || config.logs?.events?.serverUpdate?.channelId
        || config.logs?.categories?.server?.channelId
        || "1550847081311248474";
      const targetChannel = guild.channels.cache.get(targetChannelId) || guild.channels.cache.find(c => c.isTextBased());
      if (!targetChannel) return res.status(400).json({ success: false, message: "Nessun canale testuale trovato." });

      const executor = (req.user?.id ? guild.members.cache.get(req.user.id) : null)?.user || guild.members.cache.get(guild.ownerId)?.user || guild.members.me.user;

      const oldGuild = {
        id: guild.id,
        name: req.body.oldName || guild.name,
        description: req.body.oldDescription || "Community RoomUp",
        verificationLevel: 1,
        iconURL: (opts) => guild.iconURL(opts)
      };
      const newGuild = {
        id: guild.id,
        name: req.body.newName || `${guild.name}!`,
        description: req.body.newDescription || "La miglior Community Discord RoomUp!",
        verificationLevel: 2,
        iconURL: (opts) => guild.iconURL(opts)
      };

      const { dispatchServerUpdateLog } = require("../bot/loggerEngine");
      const sent = await dispatchServerUpdateLog(guild, oldGuild, newGuild, executor, targetChannel, { [guildId]: config });
      return res.json({ success: true, message: `Log server aggiornato inviato con successo in #${targetChannel.name}!`, messageId: sent?.id });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 5t. API Test Member Timeout Log
  app.post("/api/dashboard/:guildId/logs/member-timeout/test", async (req, res) => {
    const { guildId } = req.params;
    const client = getClient();
    if (!client || !client.isReady()) return res.status(500).json({ success: false, message: "Bot offline" });

    try {
      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return res.status(404).json({ success: false, message: "Server non trovato" });

      const config = getGuildConfig(guildId);
      const targetChannelId = req.body.channelId
        || config.logs?.events?.memberTimeout?.channelId
        || config.logs?.categories?.members?.channelId
        || "1550847075434893463";
      const targetChannel = guild.channels.cache.get(targetChannelId) || guild.channels.cache.find(c => c.isTextBased());
      if (!targetChannel) return res.status(400).json({ success: false, message: "Nessun canale testuale trovato." });

      const member = (req.user?.id ? guild.members.cache.get(req.user.id) : null) || guild.members.cache.get(guild.ownerId) || guild.members.me;
      const executor = guild.members.me.user;

      const { dispatchMemberTimeoutLog } = require("../bot/loggerEngine");
      const sent = await dispatchMemberTimeoutLog(guild, member, Date.now() + 600000, "Spam ripetuto (Test Suite)", executor, false, targetChannel, { [guildId]: config });
      return res.json({ success: true, message: `Log timeout membro inviato con successo in #${targetChannel.name}!`, messageId: sent?.id });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 5u. API Test AutoMod Action Log
  app.post("/api/dashboard/:guildId/logs/automod-action/test", async (req, res) => {
    const { guildId } = req.params;
    const client = getClient();
    if (!client || !client.isReady()) return res.status(500).json({ success: false, message: "Bot offline" });

    try {
      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return res.status(404).json({ success: false, message: "Server non trovato" });

      const config = getGuildConfig(guildId);
      const targetChannelId = req.body.channelId
        || config.logs?.categories?.automod?.channelId
        || "1550847078270504991";
      const targetChannel = guild.channels.cache.get(targetChannelId) || guild.channels.cache.find(c => c.isTextBased());
      if (!targetChannel) return res.status(400).json({ success: false, message: "Nessun canale testuale trovato." });

      const sampleExecution = {
        userId: req.user?.id || guild.ownerId || "1007620938700959784",
        channelId: targetChannel.id,
        ruleTriggerType: "Filtro Parole Vietate (Test)",
        action: { type: 1 },
        content: "Messaggio rilevato e bloccato da AutoMod (Test)",
        guild: guild
      };

      const { dispatchAutoModActionLog } = require("../bot/loggerEngine");
      const sent = await dispatchAutoModActionLog(guild, sampleExecution, targetChannel, { [guildId]: config });
      return res.json({ success: true, message: `Log AutoMod inviato con successo in #${targetChannel.name}!`, messageId: sent?.id });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 5v. API Test Generic Audit Log
  app.post("/api/dashboard/:guildId/logs/generic-audit/test", async (req, res) => {
    const { guildId } = req.params;
    const client = getClient();
    if (!client || !client.isReady()) return res.status(500).json({ success: false, message: "Bot offline" });

    try {
      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return res.status(404).json({ success: false, message: "Server non trovato" });

      const config = getGuildConfig(guildId);
      const targetChannelId = req.body.channelId
        || config.logs?.categories?.server?.channelId
        || "1550847081311248474";
      const targetChannel = guild.channels.cache.get(targetChannelId) || guild.channels.cache.find(c => c.isTextBased());
      if (!targetChannel) return res.status(400).json({ success: false, message: "Nessun canale testuale trovato." });

      const sampleEntry = {
        id: "1550847081311248474",
        action: "StageInstanceCreate",
        target: { id: "1550847073622958123", name: "Palco Principale" },
        executor: guild.members.me.user,
        reason: "Evento speciale community RoomUp (Test)",
        changes: [
          { key: "topic", old: undefined, new: "Q&A Community RoomUp" },
          { key: "privacy_level", old: undefined, new: "GUILD_ONLY" }
        ]
      };

      const { dispatchGenericAuditLog } = require("../bot/loggerEngine");
      const sent = await dispatchGenericAuditLog(guild, sampleEntry, targetChannel, { [guildId]: config });
      return res.json({ success: true, message: `Log audit universale inviato con successo in #${targetChannel.name}!`, messageId: sent?.id });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 6. API Send Reaction Roles Panel
  app.post("/api/dashboard/:guildId/panel/reaction-roles", async (req, res) => {
    const { guildId } = req.params;
    const { channelId, panelData } = req.body;
    const client = getClient();
    if (!client || !client.isReady()) return res.status(500).json({ success: false, message: "Bot offline" });

    try {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return res.status(404).json({ success: false, message: "Server non trovato" });

      const channel = guild.channels.cache.get(channelId);
      if (!channel || !channel.isTextBased()) return res.status(400).json({ success: false, message: "Canale non valido" });

      await sendReactionRolePanel(channel, panelData);
      return res.json({ success: true, message: "Pannello ruoli inviato!" });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // 7. API Delete Precedent from AI Moderator Memory
  app.post("/api/dashboard/:guildId/aimod/delete-precedent", (req, res) => {
    const { guildId } = req.params;
    const { precedentId } = req.body;
    try {
      const allMemory = loadAiMemory();
      const gMem = getGuildMemory(guildId);
      gMem.precedents = (gMem.precedents || []).filter(p => p.id !== precedentId);
      allMemory[guildId] = gMem;
      saveAiMemory(allMemory);
      return res.json({ success: true, message: "Regola eliminata" });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  // 8. API Add Rule / Precedent to AI Moderator Memory
  app.post("/api/dashboard/:guildId/aimod/add-precedent", (req, res) => {
    const { guildId } = req.params;
    const { pattern, severity, actionTaken } = req.body;
    try {
      const allMemory = loadAiMemory();
      const gMem = getGuildMemory(guildId);
      if (!Array.isArray(gMem.precedents)) gMem.precedents = [];
      gMem.precedents.push({
        id: `prec_manual_${Date.now()}`,
        pattern: (pattern || "").toLowerCase().trim(),
        severity: severity || "medium",
        actionTaken: actionTaken || "warn",
        source: "dashboard_manual",
        timestamp: new Date().toISOString()
      });
      allMemory[guildId] = gMem;
      saveAiMemory(allMemory);
      return res.json({ success: true, message: "Regola aggiunta!" });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  // 9. API Simulate Sentinel AI Evaluation Playground
  app.post("/api/dashboard/:guildId/aimod/simulate", (req, res) => {
    const { guildId } = req.params;
    const { text } = req.body;
    try {
      const config = getGuildConfig(guildId);
      const guildMemory = getGuildMemory(guildId);
      const result = simulateAiEvaluation(text, config.aiModerator, guildMemory);
      return res.json({ success: true, result });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  // 10. API Delete / Revoke Partnership
  app.post("/api/dashboard/:guildId/partnership/delete", async (req, res) => {
    const { partnerNumber } = req.body;
    const client = getClient();
    try {
      const data = loadPartners();
      const partner = (data.partners || []).find(p => p.number === Number(partnerNumber));
      if (!partner) return res.status(404).json({ success: false, message: "Partnership non trovata" });

      partner.deleted = true;
      partner.deletedAt = new Date().toISOString();
      partner.deletedBy = "Dashboard Admin";

      // Delete messages in all synced servers
      if (client && client.isReady() && Array.isArray(partner.messages)) {
        for (const m of partner.messages) {
          try {
            const guild = client.guilds.cache.get(m.guildId);
            if (guild) {
              const ch = guild.channels.cache.get(m.channelId);
              if (ch && ch.isTextBased()) {
                const msg = await ch.messages.fetch(m.messageId).catch(() => null);
                if (msg) await msg.delete().catch(() => null);
              }
            }
          } catch (e) {}
        }
      }

      savePartners(data);
      return res.json({ success: true, message: "Partnership rimossa" });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  // 10b. API Partnership Server Collaborations Network
  app.get("/api/dashboard/:guildId/partnerships/collabs", (req, res) => {
    const { guildId } = req.params;
    if (!checkGuildAccess(req, guildId)) return res.status(403).json({ success: false, message: "Non autorizzato" });
    try {
      const collabs = getGuildCollaborations(guildId) || { connected: [], incoming: [], outgoing: [], history: [] };
      const totalCount = (collabs.connected?.length || 0) + (collabs.incoming?.length || 0) + (collabs.outgoing?.length || 0);
      return res.json({ success: true, collabs, totalCount });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/dashboard/:guildId/partnerships/collab/request", async (req, res) => {
    const { guildId } = req.params;
    const { targetGuildId } = req.body;
    if (!checkGuildAccess(req, guildId)) return res.status(403).json({ success: false, message: "Non autorizzato" });
    if (!targetGuildId) return res.status(400).json({ success: false, message: "Specificare il server target." });

    const client = getClient();
    try {
      const requesterUserId = req.session?.user?.id || req.session?.user?.username || "Admin";
      const collab = await createCollabRequest({
        client,
        loadSettingsFn: loadSettings,
        requesterGuildId: guildId,
        requesterUserId,
        targetGuildId: String(targetGuildId).trim()
      });
      return res.json({ success: true, message: `Richiesta di collaborazione inviata a ${collab.targetGuildName}!`, collab });
    } catch (e) {
      return res.status(400).json({ success: false, message: e.message });
    }
  });

  app.post("/api/dashboard/:guildId/partnerships/collab/accept", async (req, res) => {
    const { guildId } = req.params;
    const { collabId } = req.body;
    if (!checkGuildAccess(req, guildId)) return res.status(403).json({ success: false, message: "Non autorizzato" });
    if (!collabId) return res.status(400).json({ success: false, message: "ID collaborazione mancante." });

    const client = getClient();
    try {
      const responderUserId = req.session?.user?.id || req.session?.user?.username || "Owner/Admin";
      const collab = await acceptCollabRequest({
        client,
        collabId,
        responderUserId
      });
      return res.json({ success: true, message: `Collaborazione con ${collab.requesterGuildName} accettata! I due server sono ora collegati.`, collab });
    } catch (e) {
      return res.status(400).json({ success: false, message: e.message });
    }
  });

  app.post("/api/dashboard/:guildId/partnerships/collab/reject", async (req, res) => {
    const { guildId } = req.params;
    const { collabId } = req.body;
    if (!checkGuildAccess(req, guildId)) return res.status(403).json({ success: false, message: "Non autorizzato" });
    if (!collabId) return res.status(400).json({ success: false, message: "ID collaborazione mancante." });

    const client = getClient();
    try {
      const responderUserId = req.session?.user?.id || req.session?.user?.username || "Owner/Admin";
      const collab = await rejectCollabRequest({
        client,
        collabId,
        responderUserId
      });
      return res.json({ success: true, message: "Richiesta di collaborazione rifiutata.", collab });
    } catch (e) {
      return res.status(400).json({ success: false, message: e.message });
    }
  });

  app.post("/api/dashboard/:guildId/partnerships/collab/remove", async (req, res) => {
    const { guildId } = req.params;
    const { collabId } = req.body;
    if (!checkGuildAccess(req, guildId)) return res.status(403).json({ success: false, message: "Non autorizzato" });
    if (!collabId) return res.status(400).json({ success: false, message: "ID collaborazione mancante." });

    const client = getClient();
    try {
      const removerUserId = req.session?.user?.id || req.session?.user?.username || "Admin";
      const collab = await removeCollaboration({
        client,
        collabId,
        removerUserId
      });
      return res.json({ success: true, message: "Collaborazione rimossa. I due server non sincronizzeranno più le partnership.", collab });
    } catch (e) {
      return res.status(400).json({ success: false, message: e.message });
    }
  });

  app.post("/api/dashboard/:guildId/partnerships/collab/cancel", async (req, res) => {
    const { guildId } = req.params;
    const { collabId } = req.body;
    if (!checkGuildAccess(req, guildId)) return res.status(403).json({ success: false, message: "Non autorizzato" });
    if (!collabId) return res.status(400).json({ success: false, message: "ID collaborazione mancante." });

    const client = getClient();
    try {
      const requesterUserId = req.session?.user?.id || req.session?.user?.username || "Admin";
      const collab = await cancelCollabRequest({
        client,
        collabId,
        requesterUserId
      });
      return res.json({ success: true, message: "Richiesta annullata.", collab });
    } catch (e) {
      return res.status(400).json({ success: false, message: e.message });
    }
  });

  // 11. API GitHub Webhook Endpoint (Area 11)
  app.post("/api/webhook/github/:guildId", async (req, res) => {
    const { guildId } = req.params;
    const event = req.headers["x-github-event"] || "push";
    const client = getClient();
    const config = getGuildConfig(guildId);
    const targetChannel = config.integrations?.githubLogChannelId || config.logs?.globalChannelId;

    if (targetChannel && client) {
      await dispatchGitHubWebhook(client, targetChannel, event, req.body);
      return res.json({ success: true, message: "Evento GitHub inviato al canale Discord!" });
    }
    return res.status(400).json({ success: false, message: "Nessun canale configurato per i webhook GitHub." });
  });

  // 12. API Minecraft Live Ping (Area 11)
  app.get("/api/dashboard/:guildId/mc-ping", async (req, res) => {
    const { server, port } = req.query;
    if (!server) return res.status(400).json({ success: false, message: "Indirizzo server mancante" });
    try {
      const https = require("https");
      const queryUrl = `https://api.mcsrvstat.us/3/${encodeURIComponent(server)}:${port || 25565}`;
      https.get(queryUrl, { headers: { "User-Agent": "RoomUp-Bot-V2/1.0" } }, (apiRes) => {
        let d = "";
        apiRes.on("data", c => { d += c; });
        apiRes.on("end", () => {
          try {
            return res.json({ success: true, data: JSON.parse(d) });
          } catch(e) {
            return res.status(500).json({ success: false, message: "Errore risposta Minecraft" });
          }
        });
      }).on("error", (e) => res.status(500).json({ success: false, message: e.message }));
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  // 14. API Add Custom Command
  app.post("/api/dashboard/:guildId/custom-commands/add", (req, res) => {
    const { guildId } = req.params;
    const { trigger, response, useEmbed, title } = req.body;
    if (!trigger || !response) return res.status(400).json({ success: false, message: "Comando e risposta obbligatori." });
    try {
      const config = getGuildConfig(guildId);
      if (!config.customCommands) config.customCommands = { enabled: true, triggers: [] };
      if (!Array.isArray(config.customCommands.triggers)) config.customCommands.triggers = [];
      const newCmd = {
        id: `cmd_${Date.now()}`,
        trigger: trigger.trim().toLowerCase(),
        response: response.trim(),
        useEmbed: Boolean(useEmbed),
        title: title ? title.trim() : trigger.trim()
      };
      config.customCommands.triggers.push(newCmd);
      updateGuildConfig(guildId, { customCommands: config.customCommands });
      return res.json({ success: true, message: "Comando aggiunto!", command: newCmd });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  // 15. API Delete Custom Command
  app.post("/api/dashboard/:guildId/custom-commands/delete", (req, res) => {
    const { guildId } = req.params;
    const { triggerId } = req.body;
    try {
      const config = getGuildConfig(guildId);
      if (config.customCommands && Array.isArray(config.customCommands.triggers)) {
        config.customCommands.triggers = config.customCommands.triggers.filter(c => c.id !== triggerId && c.trigger !== triggerId);
        updateGuildConfig(guildId, { customCommands: config.customCommands });
      }
      return res.json({ success: true, message: "Comando eliminato" });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  // 16. API Trigger / Toggle Panic Mode Lockdown
  app.post("/api/dashboard/:guildId/panic-mode", async (req, res) => {
    const { guildId } = req.params;
    const client = getClient();
    try {
      const config = getGuildConfig(guildId);
      const isLocked = !config.isLockdownActive;
      config.isLockdownActive = isLocked;
      updateGuildConfig(guildId, { isLockdownActive: isLocked });

      if (client && client.isReady()) {
        const guild = client.guilds?.cache?.get(guildId);
        if (guild) {
          const logChId = config.antiNuke?.logChannelId || config.logs?.globalChannelId;
          if (logChId) {
            const logCh = guild.channels?.cache?.get(logChId);
            if (logCh && logCh.isTextBased()) {
              logCh.send({
                content: isLocked 
                  ? `[LOCKDOWN] **Lockdown del server attivato.** I canali sono temporaneamente bloccati.`
                  : `[LOCKDOWN] **Lockdown terminato.** Canali riaperti.`
              }).catch(() => null);
            }
          }
        }
      }

      return res.json({
        success: true,
        isLockdownActive: isLocked,
        panicMode: isLocked,
        message: isLocked ? "Lockdown attivato" : "Lockdown disattivato"
      });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  // 17. Bot Invite Redirect
  app.get("/invite", (req, res) => {
    const clientId = process.env.DISCORD_CLIENT_ID || "1543608170327445634";
    res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`);
  });

  // 18. API Real-time SSE Events
  app.get("/api/dashboard/:guildId/events", (req, res) => {
    const { guildId } = req.params;
    subscribeGuildEvents(guildId, res);
  });

  // 19. API Guild Diagnostics & Health Check
  app.get("/api/dashboard/:guildId/diagnostics", (req, res) => {
    const { guildId } = req.params;
    const client = getClient();
    const guild = client?.guilds?.cache?.get(guildId) || null;
    const config = getGuildConfig(guildId);
    const health = runHealthCheck(guild, config);
    return res.json({ success: true, health });
  });

  // 20. API Apply Setup Preset
  app.post("/api/dashboard/:guildId/presets/apply", async (req, res) => {
    const { guildId } = req.params;
    const { presetId } = req.body;
    const client = getClient();
    const guild = client?.guilds?.cache?.get(guildId);
    if (!guild) return res.status(404).json({ success: false, message: "Server non trovato" });
    try {
      const result = await applyPreset(guild, presetId);
      return res.json({ success: true, message: `Preset ${result.presetName} applicato con successo!`, result });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  // 21. API Guild Backup & Restore
  app.post("/api/dashboard/:guildId/backups/create", async (req, res) => {
    const { guildId } = req.params;
    const client = getClient();
    let guild = client?.guilds?.cache?.get(guildId);
    if (!guild) {
      guild = {
        id: guildId,
        name: `Server ${guildId}`,
        channels: { cache: new Map() },
        roles: { cache: new Map() }
      };
    }
    try {
      const backup = await backupGuild(guild);
      return res.json({ success: true, message: "Backup generato con successo!", backup });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  app.get("/api/dashboard/:guildId/backups", (req, res) => {
    const { guildId } = req.params;
    const backups = getBackups(guildId);
    return res.json({ success: true, backups });
  });

  // 22. API Moderation Cases
  app.get("/api/dashboard/:guildId/cases", (req, res) => {
    try {
      const { guildId } = req.params;
      const cases = caseManager.getGuildCases(guildId);
      return res.json({ success: true, cases });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/dashboard/:guildId/cases", (req, res) => {
    try {
      const { guildId } = req.params;
      const { targetId, targetTag, action, reason, evidence } = req.body;
      const newCase = caseManager.createCase(guildId, {
        targetId,
        targetTag,
        action,
        reason,
        evidence,
        moderatorId: req.session?.user?.id || "dashboard",
        moderatorTag: req.session?.user?.username || "Dashboard Admin"
      });
      return res.json({ success: true, message: `Caso #${newCase.caseId} creato!`, case: newCase });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  app.patch("/api/dashboard/:guildId/cases/:caseId", (req, res) => {
    try {
      const { guildId, caseId } = req.params;
      const { reason, status } = req.body;
      let updated = null;
      if (reason) {
        updated = caseManager.updateCaseReason(guildId, caseId, reason, req.session?.user?.username || "Dashboard");
      }
      if (status) {
        updated = caseManager.updateCaseStatus(guildId, caseId, status);
      }
      return res.json({ success: true, case: updated });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  // 23. API Modmail Storage
  app.get("/api/dashboard/:guildId/modmail", (req, res) => {
    try {
      const storage = modmailManager.getModmailStorage();
      const sessions = Object.entries(storage.sessions || {}).map(([userId, s]) => ({ userId, ...s }));
      return res.json({ success: true, storage, sessions, count: sessions.length });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/dashboard/:guildId/modmail/:userId/close", async (req, res) => {
    try {
      const { userId } = req.params;
      const { reason } = req.body;
      const closed = await modmailManager.closeModmailSession(userId, req.session?.user?.username || "Dashboard Admin", reason || "Risolto");
      if (!closed) return res.status(404).json({ success: false, message: "Sessione Modmail non trovata" });
      return res.json({ success: true, message: "Sessione Modmail archiviata con successo!" });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  // 23b. API Reports & Appeals
  app.get("/api/dashboard/:guildId/reports", (req, res) => {
    try {
      const { guildId } = req.params;
      const storage = reportAppealManager.getReportsStorage();
      const reports = (storage.reports || []).filter(r => r.guildId === guildId);
      return res.json({ success: true, reports });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/dashboard/:guildId/reports/:reportId/dismiss", (req, res) => {
    try {
      const { reportId } = req.params;
      const updated = reportAppealManager.dismissReport(reportId);
      if (!updated) return res.status(404).json({ success: false, message: "Segnalazione non trovata" });
      return res.json({ success: true, message: "Segnalazione archiviata con successo!", report: updated });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  app.get("/api/dashboard/:guildId/appeals", (req, res) => {
    try {
      const { guildId } = req.params;
      const storage = reportAppealManager.getReportsStorage();
      const appeals = (storage.appeals || []).filter(a => a.guildId === guildId);
      return res.json({ success: true, appeals });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/dashboard/:guildId/appeals/:appealId/status", async (req, res) => {
    try {
      const { guildId, appealId } = req.params;
      const { status } = req.body;
      const updated = reportAppealManager.resolveAppeal(appealId, status || "ACCEPTED");
      if (!updated) return res.status(404).json({ success: false, message: "Ricorso non trovato" });

      if (status === "ACCEPTED" && updated.actionType === "BAN" && updated.userId) {
        const client = getClient();
        if (client && client.isReady()) {
          const guild = client.guilds.cache.get(guildId);
          if (guild) {
            await guild.members.unban(updated.userId, "Ricorso sban approvato da dashboard").catch(() => null);
          }
        }
      }

      return res.json({ success: true, message: `Ricorso ${status === 'ACCEPTED' ? 'approvato' : 'respinto'} con successo!`, appeal: updated });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  // 24. API Forms & Submissions
  app.get("/api/dashboard/:guildId/forms/submissions", (req, res) => {
    try {
      const { guildId } = req.params;
      const storage = formBuilder.getFormsStorage();
      const subs = (storage.submissions || []).filter(s => s.guildId === guildId);
      return res.json({ success: true, submissions: subs });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/dashboard/:guildId/forms/submissions/:subId/status", (req, res) => {
    try {
      const { subId } = req.params;
      const { status } = req.body;
      const storage = formBuilder.getFormsStorage();
      const sub = (storage.submissions || []).find(s => s.id === subId);
      if (!sub) return res.status(404).json({ success: false, message: "Modulo non trovato" });
      sub.status = status;
      sub.reviewedAt = new Date().toISOString();
      sub.reviewedBy = req.session?.user?.username || "Dashboard";
      formBuilder.saveFormsStorage(storage);
      return res.json({ success: true, message: `Modulo ${status ? status.toLowerCase() : 'aggiornato'}!` });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  // 25. API Knowledge Base
  app.get("/api/dashboard/:guildId/kb", (req, res) => {
    try {
      const storage = knowledgeBase.getKnowledgeStorage();
      return res.json({ success: true, articles: storage.articles || [] });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/dashboard/:guildId/kb", (req, res) => {
    try {
      const { category, title, content, keywords } = req.body;
      if (!title || !content) return res.status(400).json({ success: false, message: "Titolo e contenuto obbligatori" });
      const kw = Array.isArray(keywords) ? keywords : (keywords ? keywords.split(",").map(k => k.trim()) : []);
      const art = knowledgeBase.addArticle(category || "Generale", title, content, kw);
      return res.json({ success: true, message: "Articolo salvato nella Knowledge Base!", article: art });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  // 26. API Economy & Rep
  app.get("/api/dashboard/:guildId/economy", (req, res) => {
    try {
      const { guildId } = req.params;
      const leaderboard = economyManager.getLeaderboard(guildId, 25);
      return res.json({ success: true, leaderboard });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/dashboard/:guildId/economy/adjust", (req, res) => {
    try {
      const { guildId } = req.params;
      const { userId, amount, type } = req.body;
      const num = Number(amount);
      if (!userId || isNaN(num)) return res.status(400).json({ success: false, message: "Dati non validi" });
      if (num >= 0) {
        economyManager.addBalance(guildId, userId, num, type || "wallet");
      } else {
        economyManager.removeBalance(guildId, userId, Math.abs(num), type || "wallet");
      }
      return res.json({ success: true, message: "Saldo aggiornato con successo!" });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  // 27. API Automations Workflows
  app.get("/api/dashboard/:guildId/automations", (req, res) => {
    try {
      const { guildId } = req.params;
      const cfg = getGuildConfig(guildId);
      return res.json({ success: true, automations: cfg.automations || [] });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/dashboard/:guildId/automations", (req, res) => {
    try {
      const { guildId } = req.params;
      const { name, trigger, conditions, actions, enabled } = req.body;
      const cfg = getGuildConfig(guildId);
      if (!Array.isArray(cfg.automations)) cfg.automations = [];
      const newAuto = {
        id: "auto_" + Date.now(),
        name: name || "Workflow Personalizzato",
        trigger: trigger || "message_create",
        conditions: conditions || [],
        actions: actions || [],
        enabled: enabled !== false,
        createdAt: new Date().toISOString()
      };
      cfg.automations.push(newAuto);
      updateGuildConfig(guildId, { automations: cfg.automations });
      return res.json({ success: true, message: "Workflow di automazione salvato!", automation: newAuto });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  app.delete("/api/dashboard/:guildId/automations/:autoId", (req, res) => {
    try {
      const { guildId, autoId } = req.params;
      const cfg = getGuildConfig(guildId);
      if (Array.isArray(cfg.automations)) {
        cfg.automations = cfg.automations.filter(a => a.id !== autoId);
        updateGuildConfig(guildId, { automations: cfg.automations });
      }
      return res.json({ success: true, message: "Automazione eliminata" });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  // 28. API Revisions
  app.get("/api/dashboard/:guildId/revisions", (req, res) => {
    try {
      const revs = readJsonSafe("revisions", []);
      return res.json({ success: true, revisions: revs.slice(-50) });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  // 29. SENTINEL AUTONOMOUS STAFF SYSTEM APIs
  // Config
  app.get("/api/dashboard/:guildId/sentinel/config", (req, res) => {
    try {
      const { guildId } = req.params;
      const cfg = getGuildConfig(guildId);
      return res.json({ success: true, ai: cfg.ai || {} });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/dashboard/:guildId/sentinel/config", (req, res) => {
    try {
      const { guildId } = req.params;
      const patch = req.body;
      const cfg = getGuildConfig(guildId);
      const updatedAi = { ...(cfg.ai || {}), ...patch };
      updateGuildConfig(guildId, { ai: updatedAi });
      return res.json({ success: true, message: "Configurazione Sentinel AI aggiornata!", ai: updatedAi });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  // Knowledge Engine
  app.get("/api/dashboard/:guildId/sentinel/knowledge", (req, res) => {
    try {
      const { guildId } = req.params;
      const category = req.query.category || null;
      const items = defaultKnowledgeEngine.getAll(guildId, category);
      return res.json({ success: true, items });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/dashboard/:guildId/sentinel/knowledge", (req, res) => {
    try {
      const { guildId } = req.params;
      const { category, title, content, keywords, source, expiration, scope } = req.body;
      if (!title || !content) return res.status(400).json({ success: false, message: "Titolo e contenuto obbligatori" });

      const doc = defaultKnowledgeEngine.addKnowledgeItem(guildId, {
        category,
        title,
        content,
        keywords,
        source: source || "dashboard",
        author: req.session?.user?.username || "Staff",
        expiration,
        scope
      });
      return res.json({ success: true, message: "Documento knowledge aggiunto!", doc });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/dashboard/:guildId/sentinel/knowledge/:id/rollback", (req, res) => {
    try {
      const { guildId, id } = req.params;
      const { targetVersion } = req.body;
      const num = Number(targetVersion);
      if (!num) return res.status(400).json({ success: false, message: "Versione non valida" });

      const restored = defaultKnowledgeEngine.rollbackKnowledgeItem(guildId, id, num);
      if (!restored) return res.status(404).json({ success: false, message: "Versione non trovata" });
      return res.json({ success: true, message: `Rollback alla versione v${num} completato!`, doc: restored });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  app.delete("/api/dashboard/:guildId/sentinel/knowledge/:id", (req, res) => {
    try {
      const { guildId, id } = req.params;
      defaultKnowledgeEngine.deleteKnowledgeItem(guildId, id);
      return res.json({ success: true, message: "Documento eliminato con successo" });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  // Learning Engine
  app.get("/api/dashboard/:guildId/sentinel/learning/queue", (req, res) => {
    try {
      const { guildId } = req.params;
      const queue = defaultLearningEngine.getPendingQueue(guildId);
      return res.json({ success: true, queue });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/dashboard/:guildId/sentinel/learning/approve", async (req, res) => {
    try {
      const { guildId } = req.params;
      const { eventId } = req.body;
      const reviewer = req.session?.user?.username || "Staff";
      const result = await defaultLearningEngine.approveLearningEvent(guildId, eventId, reviewer);
      if (!result) return res.status(404).json({ success: false, message: "Evento di learning non trovato" });
      return res.json({ success: true, message: "Apprendimento approvato e integrato nella knowledge base!", result });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/dashboard/:guildId/sentinel/learning/reject", (req, res) => {
    try {
      const { guildId } = req.params;
      const { eventId, reason } = req.body;
      defaultLearningEngine.rejectLearningEvent(guildId, eventId, reason);
      return res.json({ success: true, message: "Evento scartato" });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/dashboard/:guildId/sentinel/feedback", (req, res) => {
    try {
      const { guildId } = req.params;
      const { messageId, ticketId, action, correctionText } = req.body;
      const staffUser = req.session?.user?.username || "Staff";
      const entry = defaultLearningEngine.recordStaffFeedback(guildId, {
        messageId,
        ticketId,
        action,
        correctionText,
        staffUser
      });
      return res.json({ success: true, message: "Feedback staff registrato!", entry });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  // Memory Multi-Tenant Engine
  app.get("/api/dashboard/:guildId/sentinel/memory", (req, res) => {
    try {
      const { guildId } = req.params;
      const mem = defaultMemoryEngine.getGuildMemory(guildId);
      return res.json({ success: true, memory: mem });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/dashboard/:guildId/sentinel/memory/clear", (req, res) => {
    try {
      const { guildId } = req.params;
      defaultMemoryEngine.clearGuildMemory(guildId);
      return res.json({ success: true, message: `Memoria di guild ${guildId} resettata completamente.` });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  app.get("/api/dashboard/:guildId/sentinel/memory/export", (req, res) => {
    try {
      const { guildId } = req.params;
      const exported = defaultMemoryEngine.exportGuildMemory(guildId);
      return res.json({ success: true, export: exported });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  // Audit Logs & Health
  app.get("/api/dashboard/:guildId/sentinel/audit", (req, res) => {
    try {
      const { guildId } = req.params;
      const logs = defaultAuditLogger.getGuildLogs(guildId, 100);
      return res.json({ success: true, logs });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  app.get("/api/dashboard/:guildId/sentinel/health", (req, res) => {
    try {
      const health = defaultMetricsCollector.getHealthStatus(getClient());
      const modelStats = defaultModelRouter.getStats();
      return res.json({ success: true, health, modelStats });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  app.get("/api/dashboard/:guildId/sentinel/metrics", (req, res) => {
    try {
      const metrics = defaultMetricsCollector.getQualityMetrics();
      return res.json({ success: true, metrics });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  });

  // Simulation Suite (Dry-Run & Canary)
  app.post("/api/dashboard/:guildId/sentinel/simulate", async (req, res) => {
    const { guildId } = req.params;
    const { type, content, userId, problem, staffPhrase } = req.body;
    const cfg = getGuildConfig(guildId);

    try {
      let result = null;
      if (type === "ticket") {
        result = await defaultSimulationSuite.simulateTicket({ guildId, userId, problem });
      } else if (type === "staff_takeover") {
        result = await defaultSimulationSuite.simulateStaffTakeover({ guildId, phrase: staffPhrase || "ci penso io" });
      } else if (type === "moderation") {
        result = await defaultSimulationSuite.simulateModeration({ guildId, content: content || "test", userId });
      } else {
        result = await defaultSimulationSuite.simulateMessage({ guildId, content: content || "Ciao", userId, guildConfig: cfg });
      }
      return res.json({ success: true, result });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post("/api/dashboard/:guildId/sentinel/canary", (req, res) => {
    const { guildId } = req.params;
    const { enabled } = req.body;
    defaultSimulationSuite.setCanaryMode(guildId, Boolean(enabled));
    return res.json({
      success: true,
      message: `Modalità Canary ${enabled ? "attivata" : "disattivata"} per server ${guildId}`,
      isCanary: defaultSimulationSuite.isCanary(guildId)
    });
  });

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[WebServer] Master Web Dashboard RoomUp V2 attiva su http://localhost:${PORT}`);
  });

  app.server = server;
  return app;
}

module.exports = { createWebServer };
