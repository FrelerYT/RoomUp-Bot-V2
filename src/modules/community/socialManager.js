const { EmbedBuilder } = require("discord.js");
const { readJsonSafe, writeJsonSafe } = require("../../core/storage");
const { getGuildConfig } = require("../../config/settingsManager");
const eventBus = require("../../core/eventBus");

function getSocialStorage() {
  return readJsonSafe("social", {
    birthdays: {}, // { `${guildId}_${userId}`: { day: 15, month: 8 } }
    confessionsCounter: {}, // { guildId: 1 }
    confessions: []
  });
}

function saveSocialStorage(data) {
  return writeJsonSafe("social", data);
}

function setBirthday(guildId, userId, day, month) {
  const storage = getSocialStorage();
  storage.birthdays[`${guildId}_${userId}`] = { day: Number(day), month: Number(month) };
  saveSocialStorage(storage);
  return true;
}

async function submitConfession(guild, content) {
  const storage = getSocialStorage();
  if (!storage.confessionsCounter[guild.id]) storage.confessionsCounter[guild.id] = 0;
  storage.confessionsCounter[guild.id] += 1;
  const num = storage.confessionsCounter[guild.id];

  const cfg = getGuildConfig(guild.id);
  const chId = cfg.social?.confessionChannelId;

  if (chId) {
    const ch = guild.channels.cache.get(chId);
    if (ch && ch.isTextBased()) {
      const embed = new EmbedBuilder()
        .setTitle(`🤫 Confessione Anonima #${num}`)
        .setDescription(content)
        .setColor(0x9b59b6)
        .setFooter({ text: "Invia la tua confessione con /confess" })
        .setTimestamp();

      await ch.send({ embeds: [embed] }).catch(() => {});
    }
  }

  const confEntry = {
    id: `conf_${guild.id}_${num}`,
    guildId: guild.id,
    number: num,
    content,
    createdAt: new Date().toISOString()
  };

  storage.confessions.unshift(confEntry);
  saveSocialStorage(storage);

  eventBus.emit("social.confession_created", { guildId: guild.id, confession: confEntry });
  return confEntry;
}

module.exports = {
  getSocialStorage,
  setBirthday,
  submitConfession
};