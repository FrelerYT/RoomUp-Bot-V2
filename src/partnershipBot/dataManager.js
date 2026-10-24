const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'config.json');
const partnersPath = path.join(__dirname, 'data', 'partners.json');

const FIXED_AUTH = {
  username: "43AS2!|(9s0dow",
  password: "43AS2!|(9s0dow"
};

const DEFAULT_MESSAGES = {
  accessDenied: "Permesso negato. Ruoli richiesti: {roles}",
  noChannels: "Nessun canale partnership configurato.",
  partnerSuccess: "Partnership #{number} pubblicata in {count} server. ID: `{messageId}`",
  deleteSuccess: "Partnership #{number} eliminata con successo.",
  notFound: "Nessuna partnership trovata con ID: `{id}`",
  alreadyDeleted: "La partnership #{number} è già stata eliminata.",
  collaboratorLeftAlert: "Collaboratore {user} uscito da {server}. Partnership revocate: {numbers}."
};

function loadConfig() {
  try {
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, JSON.stringify({
        auth: FIXED_AUTH,
        servers: {},
        partnerChannels: [],
        logChannels: [],
        messages: DEFAULT_MESSAGES
      }, null, 2), 'utf8');
    }
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    cfg.auth = FIXED_AUTH;
    if (!cfg.servers) cfg.servers = {};
    if (!cfg.messages) cfg.messages = { ...DEFAULT_MESSAGES };
    return cfg;
  } catch (err) {
    console.error('[DataManager] Errore caricamento config.json:', err.message);
    return { auth: FIXED_AUTH, servers: {}, partnerChannels: [], logChannels: [], messages: { ...DEFAULT_MESSAGES } };
  }
}

function saveConfig(config) {
  try {
    config.auth = FIXED_AUTH;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[DataManager] Errore salvataggio config.json:', err.message);
    return false;
  }
}

function getMessage(key, replacements = {}) {
  const config = loadConfig();
  let msg = config.messages?.[key] || DEFAULT_MESSAGES[key] || "";
  for (const [k, v] of Object.entries(replacements)) {
    msg = msg.split(`{${k}}`).join(v);
  }
  return msg;
}

function getServerConfig(guildId) {
  const config = loadConfig();
  const sc = config.servers?.[guildId] || {};
  if (!Array.isArray(sc.staffRoleIds)) {
    sc.staffRoleIds = sc.staffRoleId ? [sc.staffRoleId] : [];
  }
  return sc;
}

function setServerConfig(guildId, data) {
  const config = loadConfig();
  if (!config.servers) config.servers = {};
  const current = config.servers[guildId] || {};

  let staffRoleIds = [];
  if (Array.isArray(data.staffRoleIds)) {
    staffRoleIds = data.staffRoleIds.filter(Boolean);
  } else if (data.staffRoleId) {
    staffRoleIds = [data.staffRoleId];
  } else if (Array.isArray(current.staffRoleIds)) {
    staffRoleIds = current.staffRoleIds;
  }

  config.servers[guildId] = {
    ...current,
    ...data,
    staffRoleIds
  };

  if (!config.partnerChannels) config.partnerChannels = [];
  if (!config.logChannels) config.logChannels = [];

  if (data.partnerChannelId) {
    const pIdx = config.partnerChannels.findIndex(c => c.guildId === guildId);
    const entry = {
      guildId,
      guildName: data.guildName || '',
      channelId: data.partnerChannelId,
      channelName: data.partnerChannelName || '',
      ping: data.ping || ''
    };
    if (pIdx >= 0) config.partnerChannels[pIdx] = entry;
    else config.partnerChannels.push(entry);
  }

  if (data.logChannelId) {
    const lIdx = config.logChannels.findIndex(c => c.guildId === guildId);
    const entry = {
      guildId,
      guildName: data.guildName || '',
      channelId: data.logChannelId,
      channelName: data.logChannelName || ''
    };
    if (lIdx >= 0) config.logChannels[lIdx] = entry;
    else config.logChannels.push(entry);
  }

  saveConfig(config);
  return config.servers[guildId];
}

function loadPartners() {
  try {
    if (!fs.existsSync(partnersPath)) {
      const dir = path.dirname(partnersPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(partnersPath, JSON.stringify({ counter: 0, partners: [], exitLogs: [], auditLogs: [] }, null, 2), 'utf8');
    }
    const data = JSON.parse(fs.readFileSync(partnersPath, 'utf8'));
    if (!data.partners) data.partners = [];
    if (!data.exitLogs) data.exitLogs = [];
    if (!data.auditLogs) data.auditLogs = [];
    if (typeof data.counter !== 'number') data.counter = 0;

    return data;
  } catch (err) {
    console.error('[DataManager] Errore caricamento partners.json:', err.message);
    return { counter: 0, partners: [], exitLogs: [], auditLogs: [] };
  }
}

function clearAuditLogs() {
  const data = loadPartners();
  data.auditLogs = [];
  data.exitLogs = [];
  savePartners(data);
  return true;
}

function purgePartner(partnerId) {
  const data = loadPartners();
  data.partners = data.partners.filter(p => p.id !== partnerId);
  savePartners(data);
  return true;
}

function resetAllPartners() {
  const data = {
    counter: 0,
    partners: [],
    exitLogs: [],
    auditLogs: []
  };
  savePartners(data);
  return true;
}

function savePartners(data) {
  try {
    fs.writeFileSync(partnersPath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[DataManager] Errore salvataggio partners.json:', err.message);
    return false;
  }
}

function addAuditLog(entry) {
  try {
    const data = loadPartners();
    if (!data.auditLogs) data.auditLogs = [];
    const logItem = {
      id: 'audit_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString(),
      type: entry.type || 'info', // 'create', 'delete', 'auto_leave', 'config'
      title: entry.title || '',
      details: entry.details || '',
      collaboratorTag: entry.collaboratorTag || '',
      collaboratorId: entry.collaboratorId || '',
      collaboratorAvatar: entry.collaboratorAvatar || '',
      hostTag: entry.hostTag || '',
      hostId: entry.hostId || '',
      hostAvatar: entry.hostAvatar || '',
      originGuildName: entry.originGuildName || '',
      originGuildId: entry.originGuildId || '',
      partnerNumbers: entry.partnerNumbers || [],
      reason: entry.reason || '',
      count: entry.count || 0,
      extra: entry.extra || {}
    };
    data.auditLogs.unshift(logItem);
    if (data.auditLogs.length > 500) data.auditLogs = data.auditLogs.slice(0, 500);
    savePartners(data);
    return logItem;
  } catch (e) {
    console.error('[DataManager] Errore addAuditLog:', e.message);
    return null;
  }
}

function getAuditLogs() {
  const data = loadPartners();
  return data.auditLogs || [];
}

function addPartner({ desc, collaborator, host, originGuild, messages }) {
  const data = loadPartners();
  data.counter = (data.counter || 0) + 1;
  const newPartner = {
    id: 'p_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    number: data.counter,
    desc: desc,
    collaboratorId: collaborator.id,
    collaboratorTag: collaborator.tag || collaborator.username,
    collaboratorAvatar: collaborator.displayAvatarURL ? collaborator.displayAvatarURL({ size: 128 }) : '',
    hostId: host.id,
    hostTag: host.tag || host.username,
    hostAvatar: host.displayAvatarURL ? host.displayAvatarURL({ size: 128 }) : '',
    originGuildId: originGuild?.id || '',
    originGuildName: originGuild?.name || '',
    createdAt: new Date().toISOString(),
    active: true,
    messages: messages || []
  };
  data.partners.unshift(newPartner);
  savePartners(data);

  // Record audit log
  addAuditLog({
    type: 'create',
    title: `Partnership #${newPartner.number} Pubblicata`,
    details: `Pubblicata in ${messages?.length || 0} server da ${host.tag || host.username}`,
    collaboratorTag: newPartner.collaboratorTag,
    collaboratorId: newPartner.collaboratorId,
    collaboratorAvatar: newPartner.collaboratorAvatar,
    hostTag: newPartner.hostTag,
    hostId: newPartner.hostId,
    hostAvatar: newPartner.hostAvatar,
    originGuildName: newPartner.originGuildName,
    originGuildId: newPartner.originGuildId,
    partnerNumbers: [newPartner.number],
    count: messages?.length || 0,
    extra: {
      messageId: messages?.[0]?.messageId || '',
      descSnippet: desc.length > 100 ? desc.slice(0, 100) + '...' : desc
    }
  });

  return newPartner;
}

function findPartnerByMessageId(messageId) {
  const data = loadPartners();
  return data.partners.find(p => 
    p.id === messageId ||
    String(p.number) === String(messageId) ||
    (p.messages && p.messages.some(m => m.messageId === messageId || m.infoMessageId === messageId))
  );
}

function findActivePartnersByCollaborator(collaboratorId) {
  const data = loadPartners();
  return data.partners.filter(p => p.collaboratorId === collaboratorId && p.active !== false);
}

function deletePartner(partnerId, deletedBy = 'System', reason = 'Manual delete') {
  const data = loadPartners();
  const partner = data.partners.find(p => p.id === partnerId);
  if (!partner) return null;

  partner.active = false;
  partner.deletedAt = new Date().toISOString();
  partner.deletedBy = deletedBy;
  partner.deletedReason = reason;

  savePartners(data);

  // Record audit log if not auto_leave (auto_leave records its own exit log)
  if (reason !== 'Auto-Leave Detector' && !reason.includes('Author uscito')) {
    addAuditLog({
      type: 'delete',
      title: `Partnership #${partner.number} Eliminata`,
      details: `Eliminata da ${deletedBy}: ${reason}`,
      collaboratorTag: partner.collaboratorTag,
      collaboratorId: partner.collaboratorId,
      collaboratorAvatar: partner.collaboratorAvatar,
      hostTag: deletedBy,
      hostId: '',
      originGuildName: partner.originGuildName,
      originGuildId: partner.originGuildId,
      partnerNumbers: [partner.number],
      reason: reason
    });
  }

  return partner;
}

function recordExitLog({ collaboratorId, collaboratorTag, collaboratorAvatar, guildId, guildName, partnerNumbers }) {
  const data = loadPartners();
  const exitLog = {
    id: 'exit_' + Date.now(),
    collaboratorId,
    collaboratorTag,
    collaboratorAvatar: collaboratorAvatar || '',
    guildId,
    guildName,
    partnerNumbers: partnerNumbers || [],
    timestamp: new Date().toISOString()
  };
  data.exitLogs.unshift(exitLog);
  if (data.exitLogs.length > 200) data.exitLogs = data.exitLogs.slice(0, 200);
  savePartners(data);

  // Record unified audit log
  addAuditLog({
    type: 'auto_leave',
    title: `Collaboratore Uscito da ${guildName}`,
    details: `Revocate automaticamente ${partnerNumbers?.length || 0} partnership: #${(partnerNumbers || []).join(', #')}`,
    collaboratorTag,
    collaboratorId,
    collaboratorAvatar,
    hostTag: 'Auto-Leave System',
    hostId: '',
    originGuildName: guildName,
    originGuildId: guildId,
    partnerNumbers: partnerNumbers || [],
    reason: `Uscito dal server ${guildName}`
  });

  return exitLog;
}

function getLeaderboard() {
  const data = loadPartners();
  const staffMap = {};

  data.partners.forEach(p => {
    if (!staffMap[p.hostId]) {
      staffMap[p.hostId] = {
        hostId: p.hostId,
        hostTag: p.hostTag,
        hostAvatar: p.hostAvatar,
        totalCreated: 0,
        activeCount: 0,
        deletedCount: 0
      };
    }
    staffMap[p.hostId].totalCreated++;
    if (p.active) {
      staffMap[p.hostId].activeCount++;
    } else {
      staffMap[p.hostId].deletedCount++;
    }
  });

  return Object.values(staffMap).sort((a, b) => b.totalCreated - a.totalCreated);
}

function getStats() {
  const data = loadPartners();
  const activeCount = data.partners.filter(p => p.active).length;
  const deletedCount = data.partners.filter(p => !p.active).length;
  const exitsCount = data.exitLogs.length;

  return {
    counter: data.counter || 0,
    totalPartners: data.partners.length,
    activeCount,
    deletedCount,
    exitsCount
  };
}

module.exports = {
  loadConfig,
  saveConfig,
  getMessage,
  getServerConfig,
  setServerConfig,
  loadPartners,
  savePartners,
  addPartner,
  findPartnerByMessageId,
  findActivePartnersByCollaborator,
  deletePartner,
  recordExitLog,
  addAuditLog,
  getAuditLogs,
  clearAuditLogs,
  purgePartner,
  resetAllPartners,
  getLeaderboard,
  getStats,
  DEFAULT_MESSAGES,
  FIXED_AUTH
};
