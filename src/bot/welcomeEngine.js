const fs = require("fs");
const path = require("path");
const { EmbedBuilder, Events, AttachmentBuilder } = require("discord.js");
const { createWelcomeAttachment } = require("./welcomeBannerEngine");

const TRACKER_FILE = path.join(__dirname, "../../data/welcome_tracker.json");

const DEFAULT_WELCOME_CHAT = "Benvenuto {user} nella nostra community {guild}!";
const DEFAULT_WELCOME_TITLE = "Benvenuto su {guild}!";
const DEFAULT_WELCOME_DESC = `**Siamo felicissimi di averti qui con noi!**

Ti invitiamo a leggere il regolamento e a presentarti nella chat generale.

*Divertiti e buona permanenza!*`;
const DEFAULT_WELCOME_COLOR = "#731FC3";
const DEFAULT_WELCOME_FOOTER = "Membro #{memberCount}";

function formatText(text, member) {
  if (!text) return "";
  const guildName = member.guild?.name || "RoomUp!";
  const memberCount = member.guild?.memberCount || "1";
  const userId = member.id || member.user?.id || "";
  const username = member.user?.username || member.displayName || "Utente";
  const tag = member.user?.tag || username;

  return text
    .replace(/{user}/g, `<@${userId}>`)
    .replace(/{username}/g, username)
    .replace(/{tag}/g, tag)
    .replace(/{guild}/g, guildName)
    .replace(/{memberCount}/g, String(memberCount));
}

// -------------------------------------------------------------
// Tracker per Auto-Eliminazione Messaggio all'Uscita del Membro
// -------------------------------------------------------------
function loadTracker() {
  try {
    if (fs.existsSync(TRACKER_FILE)) {
      return JSON.parse(fs.readFileSync(TRACKER_FILE, "utf8"));
    }
  } catch (err) {}
  return {};
}

function saveTracker(tracker) {
  try {
    fs.mkdirSync(path.dirname(TRACKER_FILE), { recursive: true });
    fs.writeFileSync(TRACKER_FILE, JSON.stringify(tracker, null, 2), "utf8");
  } catch (err) {}
}

function trackWelcomeMessage(guildId, userId, channelId, messageId) {
  const tracker = loadTracker();
  if (!tracker[guildId]) tracker[guildId] = {};
  tracker[guildId][userId] = { channelId, messageId, timestamp: Date.now() };
  saveTracker(tracker);
}

function getTrackedWelcomeMessage(guildId, userId) {
  const tracker = loadTracker();
  return tracker[guildId]?.[userId];
}

function removeTrackedWelcomeMessage(guildId, userId) {
  const tracker = loadTracker();
  if (tracker[guildId]?.[userId]) {
    delete tracker[guildId][userId];
    saveTracker(tracker);
  }
}

// -------------------------------------------------------------
// Costruzione Payload Welcome (Identico allo Screenshot)
// -------------------------------------------------------------
function buildWelcomePayload(member, config = {}) {
  const files = [];

  // 1. Testo chat esterno all'embed (Benvenuto @User nella nostra community Server!)
  const rawChatMessage = config.chatMessage !== undefined 
    ? config.chatMessage 
    : (config.message || DEFAULT_WELCOME_CHAT);
  const chatContent = formatText(rawChatMessage, member);

  // Se l'embed è esplicitamente disattivato
  if (config.useEmbed === false) {
    return { content: chatContent, files: [] };
  }

  // 2. Embed
  const embed = new EmbedBuilder();

  // Titolo (Benvenuto su {guild}!)
  const title = formatText(config.embedTitle || DEFAULT_WELCOME_TITLE, member);
  if (title) embed.setTitle(title);

  // Descrizione
  const rawDesc = config.embedDescription || DEFAULT_WELCOME_DESC;
  const desc = formatText(rawDesc, member);
  if (desc) embed.setDescription(desc);

  // Colore Bordo Viola / Gradient
  embed.setColor(config.embedColor || DEFAULT_WELCOME_COLOR);

  // Miniatura (Thumbnail in alto a destra: Avatar della persona che entra)
  if (config.showThumbnail !== false) {
    let thumbUrl = "";
    if (config.thumbnailMode === "guild") {
      // Solo se esplicitamente impostato su "guild" mostra l'icona del server
      thumbUrl = member.guild?.iconURL?.({ dynamic: true, extension: "png" }) || member.user?.displayAvatarURL?.({ dynamic: true, extension: "png" });
    } else {
      // Default: avatar del membro che entra (thumbnailMode "user" o non impostato)
      thumbUrl = member.user?.displayAvatarURL?.({ dynamic: true, extension: "png" }) || member.guild?.iconURL?.({ dynamic: true, extension: "png" });
    }
    if (thumbUrl) embed.setThumbnail(thumbUrl);
  }

  // Barra Sfumata / Divisorio (dallo screenshot media_1789826733634.png)
  if (config.useDividerBar !== false) {
    const dividerPath = path.join(__dirname, "../../assets/welcome_bar.png");
    if (fs.existsSync(dividerPath)) {
      files.push(new AttachmentBuilder(dividerPath, { name: "welcome_bar.png" }));
      embed.setImage("attachment://welcome_bar.png");
    } else if (config.embedImage) {
      embed.setImage(config.embedImage);
    }
  } else if (config.embedImage) {
    embed.setImage(config.embedImage);
  }

  // Supporto legacy per banner SVG opzionale (se richiesto)
  if (config.sendBanner) {
    try {
      files.push(createWelcomeAttachment(member.user?.username || "Utente", member.guild?.name || "Server", member.guild?.memberCount || 1, member.user?.displayAvatarURL?.()));
    } catch (err) {}
  }

  // Footer & Timestamp (Membro #{memberCount} • DD/MM/YYYY HH:MM)
  const footerText = config.embedFooterText
    ? formatText(config.embedFooterText, member)
    : `Membro #${member.guild?.memberCount || 1}`;
  embed.setFooter({ text: footerText }).setTimestamp();

  return { content: chatContent, embeds: [embed], files };
}

// -------------------------------------------------------------
// Invio Effettivo del Messaggio di Benvenuto
// -------------------------------------------------------------
async function dispatchWelcomeMessage(guild, member, fallbackChannel = null, config = null) {
  const targetChannelId = config?.channelId || fallbackChannel?.id;
  if (!targetChannelId) {
    throw new Error("Nessun canale di benvenuto configurato.");
  }
  const channel = guild.channels.cache.get(targetChannelId) || fallbackChannel;
  if (!channel || !channel.isTextBased()) {
    throw new Error("Canale di benvenuto non valido o non testuale.");
  }

  const payload = buildWelcomePayload(member, config);
  const sentMsg = await channel.send(payload);

  if (sentMsg && config?.autoDeleteOnLeave !== false) {
    trackWelcomeMessage(guild.id, member.id, channel.id, sentMsg.id);
  }

  return { success: true, messageId: sentMsg.id, channelId: channel.id };
}

// -------------------------------------------------------------
// Inizializzazione Motore & Event Listener Discord
// -------------------------------------------------------------
function initWelcomeEngine(client, loadSettingsFn) {
  
  // 1. GuildMemberAdd (Ingresso Membro)
  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      const { isUserBanned } = require("./unbanAppealEngine");
      if (isUserBanned(member.guild.id, member.id)) {
        // Utente bannato: non inviare benvenuto pubblico né DM
        return;
      }

      const settings = typeof loadSettingsFn === "function" ? loadSettingsFn() : {};
      const config = settings[member.guild.id]?.welcome;
      if (!config || !config.enabled) return;

      // Invio messaggio nel canale (es. #🛋️・salotto)
      if (config.sendChannelMessage !== false && config.channelId) {
        await dispatchWelcomeMessage(member.guild, member, null, config).catch((err) => {
          console.error("[WelcomeEngine] Errore invio messaggio benvenuto:", err.message);
        });
      }

      // DM Message se abilitato
      if (config.dmMessageEnabled && config.dmMessage) {
        const dmText = formatText(config.dmMessage, member);
        if (config.dmUseEmbed !== false) {
          const dmEmbed = new EmbedBuilder()
            .setTitle(formatText(config.dmEmbedTitle || "Benvenuto nella nostra Community!", member))
            .setDescription(dmText)
            .setColor(config.dmEmbedColor || "#731FC3")
            .setTimestamp();
          await member.send({ embeds: [dmEmbed] }).catch(() => null);
        } else {
          await member.send({ content: dmText }).catch(() => null);
        }
      }
    } catch (e) {
      console.error("[WelcomeEngine] Errore evento GuildMemberAdd:", e.message);
    }
  });

  // 2. GuildMemberRemove (Uscita Membro & Auto-Eliminazione Benvenuto)
  client.on(Events.GuildMemberRemove, async (member) => {
    try {
      const settings = typeof loadSettingsFn === "function" ? loadSettingsFn() : {};
      const welConfig = settings[member.guild.id]?.welcome;

      // A. AUTO-ELIMINA IL MESSAGGIO DI BENVENUTO SE L'UTENTE ESCE
      if (welConfig?.autoDeleteOnLeave !== false) {
        const tracked = getTrackedWelcomeMessage(member.guild.id, member.id);
        if (tracked) {
          try {
            const ch = member.guild.channels.cache.get(tracked.channelId);
            if (ch && ch.isTextBased()) {
              const msg = await ch.messages.fetch(tracked.messageId).catch(() => null);
              if (msg) {
                await msg.delete().catch(() => null);
                console.log(`[WelcomeEngine] 🗑️ Messaggio di benvenuto di ${member.user?.tag || member.id} eliminato automaticamente da #${ch.name}!`);
              }
            }
          } catch (delErr) {
            console.error("[WelcomeEngine] Errore auto-delete messaggio benvenuto:", delErr.message);
          } finally {
            removeTrackedWelcomeMessage(member.guild.id, member.id);
          }
        }
      }

      // B. ANNUNCIO DI USCITA / ADDIO (se abilitato e non gestito dal log uscite)
      const leaveConfig = settings[member.guild.id]?.leave;
      if (!leaveConfig || !leaveConfig.enabled) return;
      if (leaveConfig.sendChannelMessage === false || !leaveConfig.channelId) return;

      const logChannelId = settings[member.guild.id]?.logs?.events?.memberLeave?.channelId
        || settings[member.guild.id]?.logs?.categories?.members?.channelId;
      if (leaveConfig.channelId === logChannelId) {
        return;
      }

      const channel = member.guild.channels.cache.get(leaveConfig.channelId);
      if (!channel || !channel.isTextBased()) return;

      const messageContent = formatText(leaveConfig.message || "🚪 **{username}** ha lasciato il server.", member);

      if (leaveConfig.useEmbed !== false) {
        const embed = new EmbedBuilder()
          .setTitle(formatText(leaveConfig.embedTitle || "Membro Uscito", member))
          .setDescription(messageContent)
          .setColor(leaveConfig.embedColor || "#f23f43")
          .setTimestamp();

        if (leaveConfig.showThumbnail !== false && member.user?.displayAvatarURL) {
          embed.setThumbnail(member.user.displayAvatarURL({ dynamic: true }));
        }

        if (leaveConfig.embedFooterText) {
          embed.setFooter({ text: formatText(leaveConfig.embedFooterText, member) });
        }

        await channel.send({ embeds: [embed] }).catch(() => null);
      } else {
        await channel.send({ content: messageContent }).catch(() => null);
      }
    } catch (e) {
      console.error("[WelcomeEngine] Errore evento GuildMemberRemove:", e.message);
    }
  });

  console.log("[WelcomeEngine] Sistema Benvenuto & Addio attivo!");
}

module.exports = {
  initWelcomeEngine,
  dispatchWelcomeMessage,
  buildWelcomePayload,
  trackWelcomeMessage,
  getTrackedWelcomeMessage,
  removeTrackedWelcomeMessage,
  formatText
};
