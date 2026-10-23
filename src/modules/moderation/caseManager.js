const { EmbedBuilder } = require("discord.js");
const { readJsonSafe, writeJsonSafe } = require("../../core/storage");
const { getGuildConfig } = require("../../config/settingsManager");
const eventBus = require("../../core/eventBus");

function getCasesStorage() {
  return readJsonSafe("cases", {
    counters: {}, // { guildId: 10 }
    cases: []     // [ { id, caseId, guildId, targetId, targetTag, moderatorId, moderatorTag, action, reason, evidence, status, createdAt } ]
  });
}

function saveCasesStorage(data) {
  return writeJsonSafe("cases", data, true, "CaseManager");
}

function createCase(guildId, data) {
  const storage = getCasesStorage();
  if (!storage.counters[guildId]) storage.counters[guildId] = 0;
  storage.counters[guildId] += 1;
  const caseId = storage.counters[guildId];

  const newCase = {
    id: `case_${guildId}_${caseId}`,
    caseId,
    guildId,
    targetId: data.targetId || "0",
    targetTag: data.targetTag || "Unknown#0000",
    moderatorId: data.moderatorId || "0",
    moderatorTag: data.moderatorTag || "System",
    action: (data.action || "WARN").toUpperCase(),
    reason: data.reason || "Nessun motivo specificato",
    evidence: Array.isArray(data.evidence) ? data.evidence : (data.evidence ? [data.evidence] : []),
    status: "ACTIVE", // "ACTIVE", "EXPIRED", "APPEALED", "OVERTURNED"
    createdAt: new Date().toISOString()
  };

  storage.cases.unshift(newCase);
  saveCasesStorage(storage);

  eventBus.emit("moderation.case_created", { guildId, case: newCase });
  return newCase;
}

function updateCaseReason(guildId, caseId, newReason, moderatorTag = "System") {
  const storage = getCasesStorage();
  const c = storage.cases.find(x => x.guildId === guildId && x.caseId === Number(caseId));
  if (!c) return null;

  c.reason = newReason;
  c.updatedAt = new Date().toISOString();
  c.updatedBy = moderatorTag;
  saveCasesStorage(storage);
  return c;
}

function addEvidence(guildId, caseId, evidenceUrl, note = "") {
  const storage = getCasesStorage();
  const c = storage.cases.find(x => x.guildId === guildId && x.caseId === Number(caseId));
  if (!c) return null;

  if (!Array.isArray(c.evidence)) c.evidence = [];
  c.evidence.push({ url: evidenceUrl, note, addedAt: new Date().toISOString() });
  saveCasesStorage(storage);
  return c;
}

function updateCaseStatus(guildId, caseId, newStatus, note = "") {
  const storage = getCasesStorage();
  const c = storage.cases.find(x => x.guildId === guildId && x.caseId === Number(caseId));
  if (!c) return null;

  c.status = newStatus;
  c.statusNote = note;
  c.statusUpdatedAt = new Date().toISOString();
  saveCasesStorage(storage);
  return c;
}

function getCase(guildId, caseId) {
  const storage = getCasesStorage();
  return storage.cases.find(x => x.guildId === guildId && x.caseId === Number(caseId)) || null;
}

function getGuildCases(guildId, filter = {}) {
  const storage = getCasesStorage();
  let list = storage.cases.filter(x => x.guildId === guildId);

  if (filter.targetId) list = list.filter(x => x.targetId === filter.targetId);
  if (filter.moderatorId) list = list.filter(x => x.moderatorId === filter.moderatorId);
  if (filter.action) list = list.filter(x => x.action.toUpperCase() === filter.action.toUpperCase());
  if (filter.status) list = list.filter(x => x.status === filter.status);

  return list;
}

async function sendCaseToLogChannel(guild, caseItem) {
  if (!guild || !caseItem) return;
  const cfg = getGuildConfig(guild.id);
  const chId = cfg.warns?.logChannelId || cfg.logs?.categories?.moderation?.channelId || cfg.logs?.globalChannelId;
  if (!chId) return;

  const ch = guild.channels.cache.get(chId);
  if (!ch || !ch.isTextBased()) return;

  const colorMap = {
    WARN: 0xf1c40f,
    TIMEOUT: 0xe67e22,
    KICK: 0xe74c3c,
    BAN: 0x992d22,
    UNBAN: 0x2ecc71,
    UNTIMEOUT: 0x2ecc71
  };

  const embed = new EmbedBuilder()
    .setTitle(`⚖️ Caso #${caseItem.caseId} | ${caseItem.action}`)
    .setColor(colorMap[caseItem.action] || 0x5865F2)
    .addFields(
      { name: "👤 Utente", value: `${caseItem.targetTag} (<@${caseItem.targetId}>)`, inline: true },
      { name: "🛡️ Moderatore", value: `${caseItem.moderatorTag}`, inline: true },
      { name: "📄 Motivo", value: caseItem.reason, inline: false },
      { name: "⚡ Stato", value: `\`${caseItem.status}\``, inline: true }
    )
    .setTimestamp(new Date(caseItem.createdAt))
    .setFooter({ text: `ID Caso: ${caseItem.id}` });

  if (caseItem.evidence && caseItem.evidence.length > 0) {
    const evText = caseItem.evidence.map(e => typeof e === "string" ? e : `[${e.note || 'Link'}](${e.url})`).join(", ");
    embed.addFields({ name: "🔗 Prove & Allegati", value: evText.slice(0, 1024), inline: false });
  }

  await ch.send({ embeds: [embed] }).catch(() => {});
}

module.exports = {
  createCase,
  updateCaseReason,
  addEvidence,
  updateCaseStatus,
  getCase,
  getGuildCases,
  sendCaseToLogChannel,
  getCasesStorage
};