const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { readJsonSafe, writeJsonSafe } = require("../../core/storage");
const { getGuildConfig } = require("../../config/settingsManager");
const eventBus = require("../../core/eventBus");

function getReportsStorage() {
  return readJsonSafe("reports", { reports: [], appeals: [] });
}

function saveReportsStorage(data) {
  return writeJsonSafe("reports", data, true, "ReportAppealManager");
}

async function submitReport(guild, reporterUser, targetUser, reason, evidence = "") {
  const storage = getReportsStorage();
  const reportId = "rep_" + Date.now();

  const report = {
    id: reportId,
    guildId: guild.id,
    reporterId: reporterUser.id,
    reporterTag: reporterUser.tag || reporterUser.username,
    targetId: targetUser.id,
    targetTag: targetUser.tag || targetUser.username,
    reason,
    evidence,
    status: "PENDING", // "PENDING", "APPROVED", "DISMISSED"
    createdAt: new Date().toISOString()
  };

  storage.reports.unshift(report);
  saveReportsStorage(storage);

  eventBus.emit("moderation.report_created", { guildId: guild.id, report });

  // Post to staff channel
  const cfg = getGuildConfig(guild.id);
  const chId = cfg.tickets?.logChannelId || cfg.logs?.categories?.moderation?.channelId;
  if (chId) {
    const ch = guild.channels.cache.get(chId);
    if (ch && ch.isTextBased()) {
      const embed = new EmbedBuilder()
        .setTitle("🚨 Nuova Segnalazione Utente")
        .setColor(0xe74c3c)
        .addFields(
          { name: "Segnalatore", value: `${report.reporterTag} (<@${report.reporterId}>)`, inline: true },
          { name: "Segnalato", value: `${report.targetTag} (<@${report.targetId}>)`, inline: true },
          { name: "Motivo", value: reason, inline: false }
        )
        .setFooter({ text: `ID: ${reportId}` })
        .setTimestamp();

      if (evidence) embed.addFields({ name: "Prove", value: evidence });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`report_dismiss_${reportId}`).setLabel("Archivia").setStyle(ButtonStyle.Secondary)
      );

      await ch.send({ embeds: [embed], components: [row] }).catch(() => {});
    }
  }

  return report;
}

async function submitAppeal(guildId, userId, userTag, actionType, reason) {
  const storage = getReportsStorage();
  const appealId = "app_" + Date.now();

  const appeal = {
    id: appealId,
    guildId,
    userId,
    userTag,
    actionType, // "BAN", "WARN", "MUTE"
    reason,
    status: "PENDING", // "PENDING", "ACCEPTED", "REJECTED"
    submittedAt: new Date().toISOString()
  };

  storage.appeals.unshift(appeal);
  saveReportsStorage(storage);

  eventBus.emit("moderation.appeal_submitted", { guildId, appeal });
  return appeal;
}

function dismissReport(reportId) {
  const storage = getReportsStorage();
  const report = (storage.reports || []).find(r => r.id === reportId);
  if (!report) return null;
  report.status = "DISMISSED";
  report.closedAt = new Date().toISOString();
  saveReportsStorage(storage);
  return report;
}

function resolveAppeal(appealId, status = "ACCEPTED") {
  const storage = getReportsStorage();
  const appeal = (storage.appeals || []).find(a => a.id === appealId);
  if (!appeal) return null;
  appeal.status = status;
  appeal.resolvedAt = new Date().toISOString();
  saveReportsStorage(storage);
  return appeal;
}

module.exports = {
  submitReport,
  submitAppeal,
  dismissReport,
  resolveAppeal,
  getReportsStorage,
  saveReportsStorage
};