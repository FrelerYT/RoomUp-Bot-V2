const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const { EmbedBuilder } = require('discord.js');
const {
  loadConfig,
  saveConfig,
  getServerConfig,
  setServerConfig,
  loadPartners,
  deletePartner,
  getLeaderboard,
  getStats,
  getAuditLogs,
  clearAuditLogs,
  purgePartner,
  DEFAULT_MESSAGES,
  FIXED_AUTH
} = require('./dataManager');
const { getClient, broadcastLogEmbed, formatBlockquote } = require('./discordBot');
const {
  getEventData,
  updateEventSettings,
  addEventServer,
  updateEventServer,
  deleteEventServer,
  resetAllVotes,
  voteForServer,
  getUserVote,
  syncUserVotePoints
} = require('./eventManager');
const {
  detectUserBoostCount,
  getUserBoostCount,
  setUserBoostCount,
  registerBoostEventListeners
} = require('./boostTracker');

// ==========================================
// AFFILIATE SERVERS CONFIGURATION
// ==========================================
const AFFILIATE_SERVERS = [
  {
    id: '1429445691452948524',
    name: 'RoomUp!',
    inviteUrl: 'https://discord.gg/Ks8KP5BZBH'
  },
  {
    id: '1154934504042025053',
    name: 'Strange Place',
    inviteUrl: 'https://discord.gg/hDQwa4bdnV'
  },
  {
    id: '708344468973027330',
    name: 'Groove Streets',
    inviteUrl: 'https://discord.gg/TUnn2m8GUk'
  }
];

const ALLOWED_GUILD_IDS = [
  '1429445691452948524', // RoomUp!
  '1154934504042025053', // Strange Place
  '708344468973027330',  // Groove Streets
  '1540661437821620235'  // RoomUp! TEST
];

// Helper per restituire il nome ufficiale pulito (mai TEST)
function getAffiliateName(guildId, originalName) {
  if (guildId === '1429445691452948524' || guildId === '1540661437821620235' || (originalName && originalName.toLowerCase().includes('roomup'))) {
    return 'RoomUp!';
  }
  if (guildId === '1154934504042025053' || (originalName && originalName.toLowerCase().includes('strange'))) {
    return 'Strange Place';
  }
  if (guildId === '708344468973027330' || (originalName && originalName.toLowerCase().includes('groove'))) {
    return 'Groove Streets';
  }
  return originalName ? originalName.replace(/TEST/gi, '').trim() : 'Server Partner';
}

// Calcolo punteggio voto utente:
// Base: 1 punto per ogni voto (reazione standard)
// Presenza nei server partner (se sei in quel server hai più voti):
// - Groove Streets -> +1 punto
// - Strange Place -> +2 punti
// - RoomUp! -> +3 punti
// Boost nei server partner:
// - 1 boost su Groove Streets -> +3 punti
// - 1 boost su Strange Place -> +2 punti
// - 1 boost su RoomUp! -> +1 punto
async function calculateUserVotingPower(userId, userSessionGuildIds = null) {
  const power = {
    base: 1,
    memberGroove: 0,
    memberStrange: 0,
    memberRoomUp: 0,
    boostGroove: 0,
    boostStrange: 0,
    boostRoomUp: 0,
    boostGrooveCount: 0,
    boostStrangeCount: 0,
    boostRoomUpCount: 0,
    memberTotal: 0,
    boostTotal: 0,
    total: 1
  };

  if (!userId) return power;

  try {
    const client = getClient();
    const sessionIds = Array.isArray(userSessionGuildIds) ? userSessionGuildIds : [];

    const checkMemberAndBoost = async (guildId) => {
      let isMember = sessionIds.includes(guildId);
      let isBooster = false;
      let boostCount = 0;

      if (client && client.isReady()) {
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
          let member = guild.members.cache.get(userId);
          if (!member) {
            member = await guild.members.fetch(userId).catch(() => null);
          }
          if (member) {
            isMember = true;
            boostCount = await detectUserBoostCount(guild, member);
            isBooster = boostCount > 0;
          }
        }
      }

      // Se non rilevato da client, verifica eventuale valore salvato nello store persistente
      if (boostCount === 0) {
        const saved = getUserBoostCount(userId, guildId);
        if (saved > 0) {
          boostCount = saved;
          isBooster = true;
        }
      }

      return { isMember, isBooster, boostCount };
    };

    // 1. Groove Streets: Membro -> +1 punto, Boost -> +3 punti per ogni boost
    const grooveCheck = await checkMemberAndBoost('708344468973027330');
    if (grooveCheck.isMember) power.memberGroove = 1;
    if (grooveCheck.isBooster) {
      power.boostGrooveCount = grooveCheck.boostCount;
      power.boostGroove = power.boostGrooveCount * 3;
    }

    // 2. Strange Place: Membro -> +2 punti, Boost -> +2 punti per ogni boost
    const strangeCheck = await checkMemberAndBoost('1154934504042025053');
    if (strangeCheck.isMember) power.memberStrange = 2;
    if (strangeCheck.isBooster) {
      power.boostStrangeCount = strangeCheck.boostCount;
      power.boostStrange = power.boostStrangeCount * 2;
    }

    // 3. RoomUp!: Membro -> +3 punti, Boost -> +1 punto per ogni boost
    const roomUpCheck = await checkMemberAndBoost('1429445691452948524');
    const roomUpTestCheck = await checkMemberAndBoost('1540661437821620235');
    if (roomUpCheck.isMember || roomUpTestCheck.isMember) power.memberRoomUp = 3;
    if (roomUpCheck.isBooster || roomUpTestCheck.isBooster) {
      power.boostRoomUpCount = Math.max(roomUpCheck.boostCount, roomUpTestCheck.boostCount);
      power.boostRoomUp = power.boostRoomUpCount * 1;
    }

    power.memberTotal = power.memberGroove + power.memberStrange + power.memberRoomUp;
    power.boostTotal = power.boostGroove + power.boostStrange + power.boostRoomUp;
    power.total = power.base + power.memberTotal + power.boostTotal;
  } catch (err) {
    console.warn('[VotingPower] Errore calcolo potere di voto:', err.message);
  }

  return power;
}

// Helper per verificare se un utente Discord è membro di almeno uno dei server affiliati
async function verifyAffiliateMembership(userId, userGuilds = null) {
  let isMember = false;
  const memberGuilds = [];
  const memberGuildIds = [];

  // 1. Controllo tramite la lista gilde restituita da Discord OAuth (@me/guilds)
  if (Array.isArray(userGuilds)) {
    for (const g of userGuilds) {
      if (ALLOWED_GUILD_IDS.includes(g.id)) {
        isMember = true;
        const cleanName = getAffiliateName(g.id, g.name);
        if (!memberGuilds.includes(cleanName)) memberGuilds.push(cleanName);
        if (!memberGuildIds.includes(g.id)) memberGuildIds.push(g.id);
      }
    }
  }

  // 2. Controllo live tramite il client bot Discord (se presente e connesso)
  try {
    const client = getClient();
    if (client && client.isReady()) {
      for (const gId of ALLOWED_GUILD_IDS) {
        const guild = client.guilds.cache.get(gId);
        if (guild) {
          let member = guild.members.cache.get(userId);
          if (!member) {
            member = await guild.members.fetch(userId).catch(() => null);
          }
          if (member) {
            isMember = true;
            const cleanName = getAffiliateName(guild.id, guild.name);
            if (!memberGuilds.includes(cleanName)) memberGuilds.push(cleanName);
            if (!memberGuildIds.includes(guild.id)) memberGuildIds.push(guild.id);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[MembershipCheck] Bot verification notice:', err.message);
  }

  return { isMember, memberGuilds, memberGuildIds };
}

function createWebServer(listen = true) {
  const app = express();
  const PORT = process.env.PORT || 3003;
  const BASE_PATH = '/partnershipdashboard';

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(BASE_PATH, express.static(path.join(__dirname, 'public')));
  app.use('/event-uploads', express.static(path.join(__dirname, 'public', 'uploads')));
  app.use(BASE_PATH + '/event-uploads', express.static(path.join(__dirname, 'public', 'uploads')));

  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'partner-secret-auth-key-2026',
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000
      }
    })
  );

  // Health & Liveness API for Partnership Bot Watchdog
  app.get(['/api/partnership/health', '/api/evento/health'], (req, res) => {
    const client = getClient();
    const isDiscordReady = Boolean(client && client.isReady());
    const wsStatus = client?.ws ? client.ws.status : -1;
    res.json({
      status: isDiscordReady ? 'ok' : 'degraded',
      bot: 'LineaTemporale',
      discordReady: isDiscordReady,
      wsStatus,
      uptime: process.uptime(),
      ping: client?.ws ? client.ws.ping : -1
    });
  });

  const router = express.Router();

  // Authentication Middleware per Dashboard Admin
  function requireAuth(req, res, next) {
    if (req.session && req.session.isAuthenticated) {
      return next();
    }
    if (req.originalUrl && !req.originalUrl.includes('/login')) {
      req.session.returnTo = req.originalUrl;
    }
    return res.redirect(`${BASE_PATH}/login`);
  }

  // GET /login
  router.get('/login', (req, res, next) => {
    if (req.baseUrl === BASE_PATH || req.originalUrl?.startsWith(BASE_PATH)) {
      if (req.session && req.session.isAuthenticated) {
        return res.redirect(`${BASE_PATH}/`);
      }
      return res.render('login', { error: null, basePath: BASE_PATH });
    }
    return next();
  });

  // POST /login
  router.post('/login', (req, res, next) => {
    if (req.baseUrl === BASE_PATH || req.originalUrl?.startsWith(BASE_PATH)) {
      const { username, password } = req.body;
      
      const validPassword = FIXED_AUTH.password;
      const isUserValid = (username === FIXED_AUTH.username || username === 'staff' || username === 'admin');

      if (isUserValid && password === validPassword) {
        req.session.isAuthenticated = true;
        req.session.username = username;
        const redirectUrl = req.session.returnTo || `${BASE_PATH}/`;
        delete req.session.returnTo;
        return res.redirect(redirectUrl);
      }

      return res.render('login', {
        error: 'Credenziali non valide! Riprova.',
        basePath: BASE_PATH
      });
    }
    return next();
  });

  // GET /logout
  router.get('/logout', (req, res, next) => {
    if (req.baseUrl === BASE_PATH || req.originalUrl?.startsWith(BASE_PATH)) {
      req.session.destroy(() => {
        res.redirect(`${BASE_PATH}/login`);
      });
      return;
    }
    return next();
  });

  async function handleMainDashboard(req, res) {
    const config = loadConfig();
    const partnersData = loadPartners();
    const stats = getStats();
    const leaderboard = getLeaderboard();

    // Fetch Guilds, text channels and roles from active Discord bot
    const client = getClient();
    const guildsData = [];

    if (client) {
      if (!client.isReady()) {
        try {
          await new Promise((resolve) => {
            if (client.isReady()) return resolve();
            client.once('ready', resolve);
            setTimeout(resolve, 2500);
          });
        } catch (e) {}
      }

      for (const [_, guild] of client.guilds.cache) {
        try {
          const channels = guild.channels.cache
            .filter(c => c.isTextBased())
            .map(c => ({ id: c.id, name: c.name }));

          const roles = guild.roles.cache
            .filter(r => r.id !== guild.id)
            .map(r => ({ id: r.id, name: r.name, color: r.hexColor }))
            .sort((a, b) => a.name.localeCompare(b.name));

          const serverConf = config.servers?.[guild.id] || {};
          if (!Array.isArray(serverConf.staffRoleIds)) {
            serverConf.staffRoleIds = serverConf.staffRoleId ? [serverConf.staffRoleId] : [];
          }

          guildsData.push({
            id: guild.id,
            name: guild.name,
            icon: guild.iconURL({ size: 64 }) || '',
            channels,
            roles,
            serverConf
          });
        } catch (e) {}
      }
    }

    res.render('dashboard', {
      user: req.session?.username || 'Staff',
      config,
      stats,
      leaderboard,
      partners: partnersData.partners || [],
      exitLogs: partnersData.exitLogs || [],
      auditLogs: getAuditLogs(),
      guilds: guildsData,
      messages: { ...DEFAULT_MESSAGES, ...(config.messages || {}) },
      basePath: BASE_PATH
    });
  }

  // GET / (Main Dashboard)
  router.get('/', (req, res, next) => {
    if (req.baseUrl === BASE_PATH || req.originalUrl?.startsWith(BASE_PATH)) {
      return requireAuth(req, res, () => handleMainDashboard(req, res));
    }
    return next();
  });

  // POST /api/settings/servers
  router.post('/api/settings/servers', requireAuth, (req, res) => {
    try {
      const { servers } = req.body;
      if (!Array.isArray(servers)) {
        return res.status(400).json({ success: false, error: 'Formato dati non valido.' });
      }

      for (const s of servers) {
        if (!s.guildId) continue;
        setServerConfig(s.guildId, {
          guildName: s.guildName,
          partnerChannelId: s.partnerChannelId,
          logChannelId: s.logChannelId,
          staffRoleIds: Array.isArray(s.staffRoleIds) ? s.staffRoleIds : [],
          ping: s.ping
        });
      }

      return res.json({ success: true, message: 'Configurazioni salvate con successo.' });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/settings/messages (Save customized bot messages)
  router.post('/api/settings/messages', requireAuth, (req, res) => {
    try {
      const config = loadConfig();
      const { messages } = req.body;
      if (messages && typeof messages === 'object') {
        config.messages = {
          ...(config.messages || {}),
          ...messages
        };
        saveConfig(config);
        return res.json({ success: true, message: 'Messaggi salvati con successo.' });
      }
      return res.status(400).json({ success: false, error: 'Dati non validi.' });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/partner/delete/:id (Delete a partner from dashboard)
  router.post('/api/partner/delete/:id', requireAuth, async (req, res) => {
    try {
      const partnerId = req.params.id;
      const partnersData = loadPartners();
      const partner = partnersData.partners.find(p => p.id === partnerId);

      if (!partner) {
        return res.status(404).json({ success: false, error: 'Partnership non trovata.' });
      }

      const client = getClient();
      let deletedCount = 0;

      if (client && client.isReady()) {
        for (const m of (partner.messages || [])) {
          try {
            const guild = client.guilds.cache.get(m.guildId) || await client.guilds.fetch(m.guildId).catch(() => null);
            if (guild) {
              const channel = guild.channels.cache.get(m.channelId) || await guild.channels.fetch(m.channelId).catch(() => null);
              if (channel && channel.isTextBased()) {
                if (m.messageId) {
                  const msg = await channel.messages.fetch(m.messageId).catch(() => null);
                  if (msg) {
                    await msg.delete().catch(() => null);
                    deletedCount++;
                  }
                }
                if (m.infoMessageId) {
                  const infoMsg = await channel.messages.fetch(m.infoMessageId).catch(() => null);
                  if (infoMsg) {
                    await infoMsg.delete().catch(() => null);
                  }
                }
              }
            }
          } catch (e) {}
        }
      }

      deletePartner(partner.id, `Dashboard (${req.session.username})`, 'Eliminazione manuale da Web Dashboard');

      // Send Discord Log to all configured log channels
      try {
        if (client && client.isReady()) {
          const unixNow = Math.floor(Date.now() / 1000);

          const deleteLogEmbed = new EmbedBuilder()
            .setTitle('Partnership Eliminata (Dashboard)')
            .setColor('#f0b232')
            .setDescription(formatBlockquote([
              `**Partnership:** #${partner.number}`,
              `**Collaboratore:** <@${partner.collaboratorId}> (\`${partner.collaboratorTag || 'Sconosciuto'}\`)`,
              `**Operatore:** Dashboard (\`${req.session.username}\`)`,
              `**Server:** **${partner.originGuildName || 'N/A'}**`,
              `**Messaggi rimossi:** ${deletedCount}`,
              `**Data:** <t:${unixNow}:f>`
            ]))
            .setThumbnail(partner.collaboratorAvatar || null)
            .addFields([
              {
                name: 'Testo',
                value: `\`\`\`markdown\n${(partner.desc || 'N/A').length > 500 ? (partner.desc || '').slice(0, 500) + '...' : (partner.desc || 'N/A')}\n\`\`\``
              },
              {
                name: 'Dettagli',
                value: `• Motivo: \`Dashboard Web\`\n• ID: \`${partner.id}\``
              }
            ])
            .setFooter({
              text: `Linea Temporale • #${partner.number}`,
              iconURL: undefined
            })
            .setTimestamp();

          await broadcastLogEmbed(client, deleteLogEmbed);
        }
      } catch (logErr) {
        console.error('[WebServer] Errore invio log Discord eliminazione dashboard:', logErr.message);
      }

      return res.json({
        success: true,
        message: `Partnership #${partner.number} eliminata.`
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/audit/clear (Clear all audit & exit activity logs)
  router.post('/api/audit/clear', requireAuth, (req, res) => {
    try {
      clearAuditLogs();
      return res.json({ success: true, message: 'Registro attività svuotato con successo.' });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/partner/purge/:id (Completely remove an archived partner from database)
  router.post('/api/partner/purge/:id', requireAuth, (req, res) => {
    try {
      purgePartner(req.params.id);
      return res.json({ success: true, message: 'Partnership rimossa dall\'archivio.' });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // DISCORD OAUTH2 & EVENTO ROUTES
  // ==========================================

  // Helper per calcolare Redirect URI coerente (dinamico per roomup.space / custom domain / Render)
  function getDiscordRedirectUri(req) {
    if (process.env.CUSTOM_DOMAIN) {
      return `https://${process.env.CUSTOM_DOMAIN.replace(/^https?:\/\//, "")}/api/evento/discord/callback`;
    }
    if (req) {
      const host = req.headers["x-forwarded-host"] || req.headers["host"];
      if (host) {
        const proto = req.headers["x-forwarded-proto"] || (req.secure ? "https" : (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https"));
        return `${proto}://${host}/api/evento/discord/callback`;
      }
    }
    if (process.env.DISCORD_REDIRECT_URI) {
      return process.env.DISCORD_REDIRECT_URI.trim().replace(/^["'\s]+|["'\s\\]+$/g, '');
    }
    return 'https://roomup.space/api/evento/discord/callback';
  }

  // GET /api/evento/discord/login -> Reindirizza a Discord OAuth2
  router.get(['/api/evento/discord/login', '/api/Evento/discord/login'], (req, res) => {
    const clientId = process.env.PARTNERSHIP_CLIENT_ID || '1546192386546470963';
    const redirectUri = getDiscordRedirectUri(req);
    req.session.discordRedirectUri = redirectUri;

    const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=identify%20guilds`;
    return res.redirect(discordAuthUrl);
  });

  // GET /api/evento/discord/callback -> Riceve il codice OAuth, richiede il token ed esegue il check dei server
  router.get(['/api/evento/discord/callback', '/api/Evento/discord/callback'], async (req, res) => {
    const { code, error } = req.query;
    if (error || !code) {
      console.warn('[Discord OAuth] Callback error o codice assente:', error);
      return res.redirect('/evento?auth_error=' + encodeURIComponent(error || 'accesso_annullato'));
    }

    const clientId = process.env.PARTNERSHIP_CLIENT_ID || '1546192386546470963';
    const clientSecret = process.env.PARTNERSHIP_CLIENT_SECRET;
    if (!clientSecret) {
      console.error('[Discord OAuth] PARTNERSHIP_CLIENT_SECRET non configurato!');
      return res.redirect('/evento?auth_error=secret_missing');
    }
    const redirectUri = req.session.discordRedirectUri || getDiscordRedirectUri(req);

    try {
      const tokenParams = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      });

      const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        body: tokenParams,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        console.error('[Discord OAuth] Scambio token fallito:', tokenRes.status, errText);
        return res.redirect('/evento?auth_error=token_failed');
      }

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;

      // 1. Profilo utente
      const userRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!userRes.ok) {
        return res.redirect('/evento?auth_error=user_fetch_failed');
      }

      const userData = await userRes.json();

      // 2. Server dell'utente (@me/guilds)
      const guildsRes = await fetch('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const userGuilds = guildsRes.ok ? await guildsRes.json() : [];

      // 3. Verifica appartenenza ad almeno uno dei server affiliati
      const verification = await verifyAffiliateMembership(userData.id, userGuilds);

      const avatarUrl = userData.avatar
        ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png?size=128`
        : `https://cdn.discordapp.com/embed/avatars/${(BigInt(userData.id) >> 22n) % 6n}.png`;

      req.session.discordUser = {
        id: userData.id,
        username: userData.global_name || userData.username,
        discordTag: userData.username,
        avatar: avatarUrl,
        isMember: verification.isMember,
        memberGuilds: verification.memberGuilds,
        memberGuildIds: verification.memberGuildIds,
        accessToken: accessToken
      };

      return res.redirect('/evento');
    } catch (err) {
      console.error('[Discord OAuth] Errore critico nel callback:', err);
      return res.redirect('/evento?auth_error=internal_error');
    }
  });

  // GET /api/evento/discord/refresh -> Ricontrolla appartenenza ai server affiliati
  router.get(['/api/evento/discord/refresh', '/api/Evento/discord/refresh'], async (req, res) => {
    if (!req.session || !req.session.discordUser) {
      return res.redirect('/evento');
    }

    try {
      let userGuilds = [];
      if (req.session.discordUser.accessToken) {
        const guildsRes = await fetch('https://discord.com/api/users/@me/guilds', {
          headers: { Authorization: `Bearer ${req.session.discordUser.accessToken}` }
        });
        if (guildsRes.ok) {
          userGuilds = await guildsRes.json();
        }
      }

      const verification = await verifyAffiliateMembership(req.session.discordUser.id, userGuilds);
      req.session.discordUser.isMember = verification.isMember;
      req.session.discordUser.memberGuilds = verification.memberGuilds;
      req.session.discordUser.memberGuildIds = verification.memberGuildIds;
    } catch (err) {
      console.error('[Discord OAuth] Errore refresh:', err);
    }

    return res.redirect('/evento');
  });

  // GET /api/evento/discord/logout -> Disconnette sessione Discord
  router.get(['/api/evento/discord/logout', '/api/Evento/discord/logout'], (req, res) => {
    if (req.session) {
      delete req.session.discordUser;
    }
    return res.redirect('/evento');
  });

  // GET /Evento & /evento (Public voting page)
  router.get(['/Evento', '/evento', '/Evento/', '/evento/'], async (req, res) => {
    try {
      if (req.session && req.session.discordUser && Array.isArray(req.session.discordUser.memberGuilds)) {
        req.session.discordUser.memberGuilds = req.session.discordUser.memberGuilds.map(name => {
          if (name.toLowerCase().includes('roomup')) return 'RoomUp!';
          return name.replace(/TEST/gi, '').trim();
        });
      }
      const discordUser = req.session ? req.session.discordUser : null;
      let userVote = discordUser ? getUserVote(discordUser.id) : null;

      // Costruisce i dati per la sezione superiore dei 3 server affiliati
      const client = getClient();
      const affiliateCards = AFFILIATE_SERVERS.map(aff => {
        let icon = null;
        let memberCount = null;
        if (client && client.isReady()) {
          const g = client.guilds.cache.get(aff.id);
          if (g) {
            icon = g.iconURL({ size: 128 });
            memberCount = g.memberCount;
          }
        }
        const cleanName = aff.id === '1429445691452948524' ? 'RoomUp!' : (aff.id === '1154934504042025053' ? 'Strange Place' : 'Groove Streets');
        const defaultIcon = aff.id === '1429445691452948524' 
          ? 'https://cdn.discordapp.com/icons/1429445691452948524/a_88fd315266388739b29f7ba64d6c445e.gif?size=128'
          : (aff.id === '1154934504042025053' 
            ? 'https://cdn.discordapp.com/icons/1154934504042025053/a_820b086c052f336ae8ebe44e2c705b20.gif?size=128' 
            : 'https://cdn.discordapp.com/icons/708344468973027330/b09b1907f4aaac8ff3497c6b1f435e67.webp?size=128');
        const defaultMembers = aff.id === '1429445691452948524' ? 245 : (aff.id === '1154934504042025053' ? 674 : 1383);

        const isUserMember = Boolean(discordUser && discordUser.memberGuildIds && (discordUser.memberGuildIds.includes(aff.id) || (aff.id === '1429445691452948524' && discordUser.memberGuildIds.includes('1540661437821620235'))));

        return {
          id: aff.id,
          name: cleanName,
          icon: icon || defaultIcon,
          memberCount: memberCount || defaultMembers,
          inviteUrl: aff.inviteUrl,
          isUserMember
        };
      });

      let votingPower = null;
      if (discordUser && discordUser.isMember) {
        votingPower = await calculateUserVotingPower(discordUser.id, discordUser.memberGuildIds);
        if (userVote && votingPower && votingPower.total !== userVote.points) {
          syncUserVotePoints(discordUser.id, votingPower.total, votingPower);
          userVote = getUserVote(discordUser.id);
        }
      }

      const data = getEventData();
      res.render('evento', {
        ...data,
        discordUser,
        userVote,
        votingPower,
        affiliateCards,
        affiliateServers: AFFILIATE_SERVERS,
        authError: req.query.auth_error || null
      });
    } catch (err) {
      console.error('[WebServer] Errore render evento:', err);
      res.status(500).send('Errore durante il caricamento della pagina evento.');
    }
  });

  // POST /api/evento/vote (Public vote submission with mandatory Discord login & affiliate server check)
  router.post(['/api/evento/vote', '/api/Evento/vote'], async (req, res) => {
    try {
      const { serverId } = req.body;
      if (!serverId) {
        return res.status(400).json({ success: false, message: 'Server ID mancante.' });
      }

      // Controllo sessione utente Discord
      const discordUser = req.session ? req.session.discordUser : null;
      if (!discordUser) {
        return res.status(401).json({
          success: false,
          error: 'auth_required',
          message: 'Devi effettuare l\'accesso con Discord per poter votare.'
        });
      }

      // Controllo se è membro di almeno uno dei server partner
      if (!discordUser.isMember) {
        return res.status(403).json({
          success: false,
          error: 'not_member',
          message: 'Devi essere membro di almeno uno dei server partner per poter votare.'
        });
      }

      const votingPower = await calculateUserVotingPower(discordUser.id, discordUser.memberGuildIds);
      const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
      const result = voteForServer(serverId, ip, discordUser, votingPower.total, votingPower);
      return res.json({
        ...result,
        votingPower
      });
    } catch (err) {
      console.error('[WebServer] Errore API voto evento:', err);
      return res.status(500).json({ success: false, message: 'Errore interno durante la registrazione del voto.' });
    }
  });

  // GET /Eventodashboard & /eventodashboard (Admin event dashboard)
  router.get(['/Eventodashboard', '/eventodashboard', '/Eventodashboard/', '/eventodashboard/'], requireAuth, (req, res) => {
    try {
      const data = getEventData();
      res.render('eventodashboard', data);
    } catch (err) {
      console.error('[WebServer] Errore render eventodashboard:', err);
      res.status(500).send('Errore durante il caricamento della dashboard evento.');
    }
  });

  // POST /api/eventodashboard/settings (Save event settings)
  router.post(['/api/eventodashboard/settings', '/api/Eventodashboard/settings'], requireAuth, (req, res) => {
    try {
      const updated = updateEventSettings(req.body);
      return res.json({ success: true, settings: updated });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // POST /api/eventodashboard/upload (Upload image file via base64)
  router.post(['/api/eventodashboard/upload', '/api/Eventodashboard/upload'], requireAuth, (req, res) => {
    try {
      const { image, filename } = req.body;
      if (!image) {
        return res.status(400).json({ success: false, message: 'Nessun file o dato immagine inviato.' });
      }

      let matches = image.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      let ext = 'png';
      let base64Data = image;

      if (matches && matches.length === 3) {
        ext = matches[1].toLowerCase();
        if (ext === 'jpeg') ext = 'jpg';
        if (ext === 'svg+xml') ext = 'svg';
        base64Data = matches[2];
      } else if (filename && filename.includes('.')) {
        ext = filename.split('.').pop().toLowerCase();
      }

      const buffer = Buffer.from(base64Data, 'base64');
      const uploadDir = path.join(__dirname, 'public', 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const safeName = `img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
      const targetPath = path.join(uploadDir, safeName);

      fs.writeFileSync(targetPath, buffer);

      const publicUrl = `/event-uploads/${safeName}`;
      return res.json({ success: true, url: publicUrl, filename: safeName });
    } catch (err) {
      console.error('[WebServer] Errore upload immagine evento:', err);
      return res.status(500).json({ success: false, message: 'Errore durante il salvataggio del file: ' + err.message });
    }
  });

  // POST /api/eventodashboard/server (Add server)
  router.post(['/api/eventodashboard/server', '/api/Eventodashboard/server'], requireAuth, (req, res) => {
    try {
      const server = addEventServer(req.body);
      return res.json({ success: true, server });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // POST /api/eventodashboard/server/update (Update server votes/details)
  router.post(['/api/eventodashboard/server/update', '/api/Eventodashboard/server/update'], requireAuth, (req, res) => {
    try {
      const { id, ...updates } = req.body;
      const server = updateEventServer(id, updates);
      if (!server) {
        return res.status(404).json({ success: false, message: 'Server non trovato.' });
      }
      return res.json({ success: true, server });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // POST /api/eventodashboard/server/delete (Delete server)
  router.post(['/api/eventodashboard/server/delete', '/api/Eventodashboard/server/delete'], requireAuth, (req, res) => {
    try {
      const { id } = req.body;
      const deleted = deleteEventServer(id);
      return res.json({ success: deleted });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // POST /api/eventodashboard/reset-votes (Reset all votes)
  router.post(['/api/eventodashboard/reset-votes', '/api/Eventodashboard/reset-votes'], requireAuth, (req, res) => {
    try {
      resetAllVotes();
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // Mount router on both BASE_PATH and root
  app.use(BASE_PATH, router);
  app.use('/', router);

  if (listen) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[WebServer] Dashboard Partnership & Evento attiva su http://0.0.0.0:${PORT}${BASE_PATH}`);
    });
  }

  // Registra il monitoraggio automatico in tempo reale dei Boost Discord
  try {
    const client = getClient();
    if (client) {
      const attachListeners = () => {
        registerBoostEventListeners(client, async (userId, guildId, newCount) => {
          try {
            const newPower = await calculateUserVotingPower(userId);
            const synced = syncUserVotePoints(userId, newPower.total, newPower);
            if (synced) {
              console.log(`[BoostTracker AutoSync] Voto utente ${userId} aggiornato automaticamente: ${newPower.total} pt (boost ${newCount} su ${guildId})`);
            }
          } catch (e) {
            console.error('[BoostTracker AutoSync] Errore sincronizzazione:', e.message);
          }
        });
      };

      if (client.isReady()) {
        attachListeners();
      } else {
        client.once('ready', attachListeners);
      }
    }
  } catch (err) {
    console.warn('[WebServer] Avviso registrazione listener boost:', err.message);
  }

  return app;
}

module.exports = {
  createWebServer,
  calculateUserVotingPower,
  verifyAffiliateMembership
};
