const fs = require('fs');
const path = require('path');

const EVENT_FILE = path.join(__dirname, 'data', 'event.json');

const DEFAULT_EVENT = {
  settings: {
    title: 'Gran Torneo Server 2026',
    description: 'Vota per il tuo server preferito! Il server che otterrà più voti al termine dell\'evento vincerà il premio in palio.',
    prize: 'Premio speciale e pubblicità esclusiva per il server vincitore',
    status: 'active', // 'active' | 'paused' | 'ended'
    cooldownHours: 0,
    endDate: '2026-09-21T00:00:00+02:00'
  },
  servers: [],
  votes: []
};

function ensureEventDataDir() {
  const dir = path.dirname(EVENT_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadEventData() {
  ensureEventDataDir();
  if (!fs.existsSync(EVENT_FILE)) {
    saveEventData(DEFAULT_EVENT);
    return JSON.parse(JSON.stringify(DEFAULT_EVENT));
  }
  try {
    const raw = fs.readFileSync(EVENT_FILE, 'utf8');
    const data = JSON.parse(raw);
    return {
      settings: { ...DEFAULT_EVENT.settings, ...(data.settings || {}) },
      servers: Array.isArray(data.servers) ? data.servers : [],
      votes: Array.isArray(data.votes) ? data.votes : []
    };
  } catch (err) {
    console.error('[EventManager] Errore lettura event.json, ripristino default:', err.message);
    return JSON.parse(JSON.stringify(DEFAULT_EVENT));
  }
}

function saveEventData(data) {
  ensureEventDataDir();
  fs.writeFileSync(EVENT_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function getEventData() {
  const data = loadEventData();
  const endDateStr = data.settings.endDate || '2026-09-21T00:00:00+02:00';
  const endTimestamp = new Date(endDateStr).getTime();
  const isExpired = !isNaN(endTimestamp) && Date.now() >= endTimestamp;

  if (isExpired && data.settings.status !== 'ended') {
    data.settings.status = 'ended';
    saveEventData(data);
  }

  // Sort servers by votes descending for public view
  const sortedServers = [...data.servers].sort((a, b) => (b.votes || 0) - (a.votes || 0));
  return {
    settings: {
      ...data.settings,
      endDate: endDateStr,
      endTimestamp: endTimestamp,
      isExpired
    },
    servers: sortedServers,
    totalVotes: data.servers.reduce((sum, s) => sum + (s.votes || 0), 0)
  };
}

function updateEventSettings(newSettings) {
  const data = loadEventData();
  data.settings = {
    ...data.settings,
    title: newSettings.title?.trim() || data.settings.title,
    description: newSettings.description?.trim() || data.settings.description,
    prize: newSettings.prize?.trim() || data.settings.prize,
    status: ['active', 'paused', 'ended'].includes(newSettings.status) ? newSettings.status : data.settings.status,
    cooldownHours: Math.max(0, parseInt(newSettings.cooldownHours, 10) || 0),
    endDate: newSettings.endDate ? newSettings.endDate.trim() : (data.settings.endDate || '2026-09-21T00:00:00+02:00')
  };
  saveEventData(data);
  return data.settings;
}

function addEventServer({ name, icon, banner, description, inviteUrl }) {
  const data = loadEventData();
  const newServer = {
    id: 'srv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    name: name?.trim() || 'Nuovo Server',
    icon: icon?.trim() || '',
    banner: banner?.trim() || icon?.trim() || '',
    description: description?.trim() || '',
    inviteUrl: inviteUrl?.trim() || '',
    votes: 0,
    createdAt: new Date().toISOString()
  };
  data.servers.push(newServer);
  saveEventData(data);
  return newServer;
}

function updateEventServer(id, updates) {
  const data = loadEventData();
  const server = data.servers.find(s => s.id === id);
  if (!server) return null;

  if (updates.name !== undefined) server.name = updates.name.trim();
  if (updates.icon !== undefined) server.icon = updates.icon.trim();
  if (updates.banner !== undefined) server.banner = updates.banner.trim();
  if (updates.description !== undefined) server.description = updates.description.trim();
  if (updates.inviteUrl !== undefined) server.inviteUrl = updates.inviteUrl.trim();
  if (updates.votes !== undefined) {
    const v = parseInt(updates.votes, 10);
    if (!isNaN(v) && v >= 0) server.votes = v;
  }

  saveEventData(data);
  return server;
}

function deleteEventServer(id) {
  const data = loadEventData();
  const initialCount = data.servers.length;
  data.servers = data.servers.filter(s => s.id !== id);
  data.votes = data.votes.filter(v => v.serverId !== id);
  saveEventData(data);
  return data.servers.length < initialCount;
}

function resetAllVotes() {
  const data = loadEventData();
  data.servers.forEach(s => {
    s.votes = 0;
  });
  data.votes = [];
  saveEventData(data);
  return true;
}

function voteForServer(serverId, rawIp, discordUser, points = 1, votingDetails = null) {
  const data = loadEventData();
  const ip = (rawIp || 'unknown').split(',')[0].trim();
  const now = Date.now();

  // Controllo scadenza automatica evento (21/09 alle 00:00)
  const endDateStr = data.settings.endDate || '2026-09-21T00:00:00+02:00';
  const endTimestamp = new Date(endDateStr).getTime();
  if (!isNaN(endTimestamp) && now >= endTimestamp) {
    if (data.settings.status !== 'ended') {
      data.settings.status = 'ended';
      saveEventData(data);
    }
    return { success: false, error: 'ended', message: "L'evento si è concluso il 21 Settembre alle 00:00. Le votazioni sono chiuse definitivamente." };
  }

  // Controllo stato evento
  if (data.settings.status === 'paused') {
    return { success: false, error: 'paused', message: 'Le votazioni sono attualmente in pausa.' };
  }
  if (data.settings.status === 'ended') {
    return { success: false, error: 'ended', message: 'L\'evento è terminato. Le votazioni sono chiuse.' };
  }

  // Controllo autenticazione Discord obbligatoria
  if (!discordUser) {
    return { success: false, error: 'auth_required', message: 'Devi effettuare l\'accesso con Discord per votare.' };
  }

  // Controllo appartenenza a uno dei server partner
  if (!discordUser.isMember) {
    return { success: false, error: 'not_member', message: 'Devi essere membro di almeno uno dei server partner per votare.' };
  }

  const server = data.servers.find(s => s.id === serverId);
  if (!server) {
    return { success: false, error: 'not_found', message: 'Server non trovato.' };
  }

  // Controllo voto singolo per account Discord (può votare solo 1 volta per account)
  const existingVote = data.votes.find(v => v.userId === discordUser.id);
  if (existingVote) {
    const votedServer = data.servers.find(s => s.id === existingVote.serverId);
    const votedName = votedServer ? votedServer.name : 'un server';
    return {
      success: false,
      error: 'already_voted',
      votedServerId: existingVote.serverId,
      votedServerName: votedName,
      message: `Hai già espresso il tuo voto per ${votedName}. Puoi votare un solo server per l'intera durata dell'evento fino al 21 Settembre.`
    };
  }

  // Calcola punti da assegnare
  const pts = Math.max(1, parseInt(points, 10) || 1);

  // Registra il voto associato all'account Discord
  server.votes = (server.votes || 0) + pts;
  data.votes.push({
    id: 'vt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    serverId,
    ip,
    userId: discordUser.id,
    username: discordUser.username || discordUser.discordTag || 'Utente Discord',
    points: pts,
    details: votingDetails,
    timestamp: now
  });

  // Mantieni fino a 20000 voti in cronologia
  if (data.votes.length > 20000) {
    data.votes = data.votes.slice(-20000);
  }

  saveEventData(data);

  return {
    success: true,
    serverName: server.name,
    votes: server.votes,
    pointsAdded: pts,
    message: `Voto di ${pts} punt${pts === 1 ? 'o' : 'i'} registrato con successo per ${server.name}!`
  };
}

function getUserVote(discordUserId) {
  if (!discordUserId) return null;
  const data = loadEventData();
  const vote = data.votes.find(v => v.userId === discordUserId);
  if (!vote) return null;
  const server = data.servers.find(s => s.id === vote.serverId);
  return {
    voteId: vote.id,
    serverId: vote.serverId,
    serverName: server ? server.name : 'Server',
    points: vote.points || 1,
    details: vote.details,
    timestamp: vote.timestamp
  };
}

function syncUserVotePoints(discordUserId, newPoints, newDetails = null) {
  if (!discordUserId) return null;
  const data = loadEventData();
  const vote = data.votes.find(v => v.userId === discordUserId);
  if (!vote) return null;

  const pts = Math.max(1, parseInt(newPoints, 10) || 1);
  const oldPts = vote.points || 1;
  const diff = pts - oldPts;

  if (diff !== 0) {
    const server = data.servers.find(s => s.id === vote.serverId);
    if (server) {
      server.votes = Math.max(0, (server.votes || 0) + diff);
    }
    vote.points = pts;
    if (newDetails) {
      vote.details = newDetails;
    }
    saveEventData(data);
    console.log(`[EventManager] Voto utente ${discordUserId} sincronizzato: ${oldPts} -> ${pts} punti per ${server ? server.name : vote.serverId} (variazione: ${diff >= 0 ? '+' : ''}${diff})`);
  }

  const server = data.servers.find(s => s.id === vote.serverId);
  return {
    voteId: vote.id,
    serverId: vote.serverId,
    serverName: server ? server.name : 'Server',
    points: vote.points || 1,
    details: vote.details,
    timestamp: vote.timestamp
  };
}

module.exports = {
  getEventData,
  updateEventSettings,
  addEventServer,
  updateEventServer,
  deleteEventServer,
  resetAllVotes,
  voteForServer,
  getUserVote,
  syncUserVotePoints
};

