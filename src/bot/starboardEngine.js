const { EmbedBuilder, Events } = require("discord.js");

const starredMessages = new Map(); // originalMsgId -> starboardMsgId

function initStarboardEngine(client, loadSettingsFn) {
  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    try {
      if (reaction.partial) await reaction.fetch().catch(() => null);
      if (reaction.message.partial) await reaction.message.fetch().catch(() => null);

      const settings = typeof loadSettingsFn === "function" ? loadSettingsFn() : {};
      const config = settings[message.guild.id]?.starboard;
      if (!config || !config.enabled || !config.channelId) return;

      const starEmoji = config.starEmoji || "⭐";
      if (reaction.emoji.name !== starEmoji) return;

      // Self-star check
      if (config.allowSelfStar === false && user.id === message.author.id) return;

      const starCount = reaction.count;
      const minStars = config.threshold || 3;
      if (starCount < minStars) return;

      const starboardChannel = message.guild.channels.cache.get(config.channelId);
      if (!starboardChannel || !starboardChannel.isTextBased()) return;

      const content = message.content || "";
      const attachment = message.attachments.first()?.url;

      const footerTpl = config.embedFooterText || "ID: {messageId} • {emoji} {count}";
      const footerText = footerTpl
        .replace(/{messageId}/g, message.id)
        .replace(/{emoji}/g, starEmoji)
        .replace(/{count}/g, String(starCount));

      const embed = new EmbedBuilder()
        .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
        .setDescription(content ? content.slice(0, 2000) : "*(Nessun testo)*")
        .setColor(config.embedColor || "#f0b232")
        .setFooter({ text: footerText })
        .setTimestamp(message.createdAt);

      if (config.showJumpUrl !== false) {
        embed.addFields({ name: "Messaggio Originale", value: `[Vai al messaggio](${message.url}) in <#${message.channelId}>` });
      }

      if (config.includeAttachments !== false && attachment) {
        embed.setImage(attachment);
      }

      const existingStarboardMsgId = starredMessages.get(message.id);
      if (existingStarboardMsgId) {
        const existingMsg = await starboardChannel.messages.fetch(existingStarboardMsgId).catch(() => null);
        if (existingMsg) {
          await existingMsg.edit({
            content: `${starEmoji} **${starCount}** <#${message.channelId}>`,
            embeds: [embed]
          }).catch(() => null);
          return;
        }
      }

      const sent = await starboardChannel.send({
        content: `${starEmoji} **${starCount}** <#${message.channelId}>`,
        embeds: [embed]
      }).catch(() => null);

      if (sent) {
        starredMessages.set(message.id, sent.id);
      }

    } catch (e) {
      console.error("[StarboardEngine] Errore starboard:", e.message);
    }
  });

  console.log("[StarboardEngine] Sistema Starboard ⭐ attivo!");
}

module.exports = { initStarboardEngine };
