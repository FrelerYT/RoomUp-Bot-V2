const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require("discord.js");
const { readJsonSafe, writeJsonSafe } = require("../../core/storage");
const { getGuildConfig } = require("../../config/settingsManager");
const eventBus = require("../../core/eventBus");

function getModmailStorage() {
  return readJsonSafe("modmail", {
    sessions: {}, // { userId: { threadId, guildId, openedAt, lastActivity } }
    archives: []
  });
}

function saveModmailStorage(data) {
  return writeJsonSafe("modmail", data);
}

async function handleDirectMessage(client, message) {
  if (message.author.bot || message.guild) return;

  const storage = getModmailStorage();
  const userId = message.author.id;

  // Find guild for modmail (either user's active session or first mutual guild with modmail enabled)
  let targetGuild = null;
  let activeSession = storage.sessions[userId];

  if (activeSession) {
    targetGuild = client.guilds.cache.get(activeSession.guildId);
  } else {
    for (const [, g] of client.guilds.cache) {
      const cfg = getGuildConfig(g.id);
      if (cfg.modmail?.enabled && g.members.cache.has(userId)) {
        targetGuild = g;
        break;
      }
    }
  }

  if (!targetGuild) return; // No guild or modmail not configured

  const cfg = getGuildConfig(targetGuild.id);
  const categoryId = cfg.modmail?.categoryId;
  const logChannelId = cfg.modmail?.logChannelId || cfg.tickets?.logChannelId;

  // Create or get modmail thread/channel
  let channelOrThread = null;
  if (activeSession && activeSession.threadId) {
    channelOrThread = targetGuild.channels.cache.get(activeSession.threadId);
  }

  if (!channelOrThread) {
    const parentChannel = targetGuild.channels.cache.get(categoryId) ||
      targetGuild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name.includes("modmail"));

    if (!parentChannel) return;

    if (parentChannel.type === ChannelType.GuildText) {
      channelOrThread = await parentChannel.threads.create({
        name: `mail-${message.author.username}`.slice(0, 32),
        autoArchiveDuration: 1440,
        reason: "Nuova sessione Modmail"
      });
    }

    if (channelOrThread) {
      storage.sessions[userId] = {
        threadId: channelOrThread.id,
        guildId: targetGuild.id,
        openedAt: new Date().toISOString(),
        lastActivity: Date.now()
      };
      saveModmailStorage(storage);

      const welcomeEmbed = new EmbedBuilder()
        .setTitle("📬 Nuova Sessione Modmail Iniziata")
        .setColor(0x5865F2)
        .setDescription(`Utente: **${message.author.tag}** (<@${message.author.id}>)`)
        .setFooter({ text: "Scrivi direttamente in questo thread per rispondere all'utente." })
        .setTimestamp();

      await channelOrThread.send({ embeds: [welcomeEmbed] }).catch(() => {});
    }
  }

  if (channelOrThread) {
    const userEmbed = new EmbedBuilder()
      .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
      .setDescription(message.content || "*Nessun testo (solo allegato)*")
      .setColor(0x2ecc71)
      .setTimestamp();

    if (message.attachments.size > 0) {
      userEmbed.setImage(message.attachments.first().url);
    }

    await channelOrThread.send({ embeds: [userEmbed] }).catch(() => {});
    await message.react("📨").catch(() => {});
  }
}

async function handleStaffReply(message) {
  if (message.author.bot || !message.guild || !message.channel.isThread()) return;
  const storage = getModmailStorage();

  const userId = Object.keys(storage.sessions).find(u => storage.sessions[u].threadId === message.channel.id);
  if (!userId) return; // Not a modmail thread

  const client = message.client;
  const user = await client.users.fetch(userId).catch(() => null);
  if (!user) return;

  const replyEmbed = new EmbedBuilder()
    .setAuthor({ name: `Staff (${message.guild.name})`, iconURL: message.guild.iconURL() })
    .setDescription(message.content || "")
    .setColor(0x5865F2)
    .setFooter({ text: "Rispondi a questo messaggio per continuare la conversazione." })
    .setTimestamp();

  if (message.attachments.size > 0) {
    replyEmbed.setImage(message.attachments.first().url);
  }

  await user.send({ embeds: [replyEmbed] }).then(async () => {
    await message.react("✅").catch(() => {});
  }).catch(async () => {
    await message.reply("❌ Impossibile inviare il messaggio nei DM dell'utente (DM chiusi).");
  });
}

async function closeModmailSession(identifier, closedBy = "Staff", reason = "Risolto") {
  const storage = getModmailStorage();
  const userId = Object.keys(storage.sessions).find(u => u === identifier || storage.sessions[u].threadId === identifier);
  if (!userId) return false;

  const session = storage.sessions[userId];
  delete storage.sessions[userId];

  storage.archives.push({
    ...session,
    userId,
    closedBy,
    reason,
    closedAt: new Date().toISOString()
  });

  saveModmailStorage(storage);
  return true;
}

module.exports = {
  handleDirectMessage,
  handleStaffReply,
  closeModmailSession,
  getModmailStorage
};