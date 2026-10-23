const { EmbedBuilder, Events, PermissionFlagsBits } = require("discord.js");

function initAutomodEngine(client, loadSettingsFn) {
  client.on(Events.MessageCreate, async (message) => {
    try {
      if (!message.guild || message.author.bot) return;

      // Skip admins & staff with ManageMessages
      if (message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) return;

      const settings = loadSettingsFn();
      const config = settings[message.guild.id]?.automod;
      if (!config || !config.enabled) return;

      const content = message.content.toLowerCase();
      let violation = null;

      // 1. Anti-Invite
      if (config.antiInvite) {
        const inviteRegex = /(discord\.(gg|io|me|li)\/.+|discordapp\.com\/invite\/.+|discord\.com\/invite\/.+)/i;
        if (inviteRegex.test(message.content)) {
          violation = "Invito Discord non autorizzato";
        }
      }

      // 2. Anti-Links
      if (!violation && config.antiLinks) {
        const linkRegex = /(https?:\/\/[^\s]+)/g;
        if (linkRegex.test(message.content)) {
          violation = "Link esterno non consentito";
        }
      }

      // 3. Bad Words
      if (!violation && config.badWordsEnabled && Array.isArray(config.badWordsList)) {
        for (const badWord of config.badWordsList) {
          if (badWord.trim() && content.includes(badWord.trim().toLowerCase())) {
            violation = `Parola vietata rilevata ("${badWord.trim()}")`;
            break;
          }
        }
      }

      // 4. Mention Limit
      if (!violation && config.maxMentionsEnabled !== false && config.maxMentions > 0 && message.mentions.users.size > config.maxMentions) {
        violation = `Spam menzioni (${message.mentions.users.size} > ${config.maxMentions})`;
      }

      // 5. Anti-Caps
      if (!violation && config.antiCapsEnabled && message.content.length >= 8) {
        const lettersOnly = message.content.replace(/[^a-zA-Z]/g, "");
        if (lettersOnly.length >= 6) {
          const upperCount = (message.content.match(/[A-Z]/g) || []).length;
          if (upperCount / lettersOnly.length >= 0.7) {
            violation = "Uso eccessivo di lettere MAIUSCOLE (Caps Lock)";
          }
        }
      }

      if (violation) {
        // 1. Action: Delete message
        if (config.actionDeleteMessage !== false) {
          await message.delete().catch(() => null);
        }

        // 2. Action: Notify in chat
        if (config.actionSendChatWarning !== false) {
          const rawWarn = config.chatWarningMessage || "⚠️ <@{user}>, il tuo messaggio è stato rimosso da **AutoMod** ({reason}).";
          const warnText = rawWarn
            .replace(/{user}/g, message.author.id)
            .replace(/{username}/g, message.author.username)
            .replace(/{tag}/g, message.author.tag)
            .replace(/{guild}/g, message.guild.name)
            .replace(/{reason}/g, violation);

          const warnMsg = await message.channel.send({ content: warnText }).catch(() => null);
          if (warnMsg) {
            setTimeout(() => warnMsg.delete().catch(() => null), 5000);
          }
        }

        // 3. Action: Send DM Warning
        if (config.actionSendDmWarning) {
          const rawDm = config.dmWarningMessage || "⚠️ Attenzione: un tuo messaggio su **{guild}** è stato rimosso per: **{reason}**.";
          const dmText = rawDm
            .replace(/{user}/g, `<@${message.author.id}>`)
            .replace(/{username}/g, message.author.username)
            .replace(/{tag}/g, message.author.tag)
            .replace(/{guild}/g, message.guild.name)
            .replace(/{reason}/g, violation);

          await message.author.send({ content: dmText }).catch(() => null);
        }

        // 4. Action: Timeout User
        if (config.actionTimeoutUser && message.member?.moderatable) {
          const timeoutMins = config.timeoutDurationMinutes || 10;
          await message.member.timeout(timeoutMins * 60 * 1000, `AutoMod: ${violation}`).catch(() => null);
        }

        // 5. Action: Send Log
        if (config.actionSendLog !== false) {
          const logChannelId = config.logChannelId || settings[message.guild.id]?.logs?.categories?.moderation?.channelId || settings[message.guild.id]?.logs?.globalChannelId;
          if (logChannelId) {
            const logChannel = message.guild.channels.cache.get(logChannelId);
            if (logChannel && logChannel.isTextBased()) {
              const embed = new EmbedBuilder()
                .setTitle(config.logEmbedTitle || "🛡️ Intervento AutoMod")
                .setColor(config.logEmbedColor || "#f23f43")
                .addFields([
                  { name: "Utente", value: `<@${message.author.id}> (\`${message.author.tag}\`)`, inline: true },
                  { name: "Canale", value: `<#${message.channelId}>`, inline: true },
                  { name: "Infrazione", value: violation, inline: true },
                  { name: "Contenuto Rimosso", value: `\`\`\`${message.content.slice(0, 950)}\`\`\`` }
                ])
                .setTimestamp();
              logChannel.send({ embeds: [embed] }).catch(() => null);
            }
          }
        }
      }
    } catch (e) {
      console.error("[AutomodEngine] Errore automod:", e.message);
    }
  });

  console.log("[AutomodEngine] Sistema AutoMod attivo!");
}

module.exports = { initAutomodEngine };
