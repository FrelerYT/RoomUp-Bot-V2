const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require("discord.js");
const https = require("https");
const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../../data/social_notified.json");
const ROOMUP_YT_CHANNEL_ID = "UCAqodbP7r99oLwNAO4g57WA";
const ROOMUP_TIKTOK_URL = "https://www.tiktok.com/@roomup.ita";
const ROOMUP_INSTAGRAM_URL = "https://www.instagram.com/roomup.ita";
const DEFAULT_SOCIAL_CHANNEL_ID = "1554969750927446026";
const DEFAULT_SOCIAL_ROLE_ID = "1554969615518531658";

function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadSocialData() {
  ensureDataDir();
  try {
    if (!fs.existsSync(DATA_FILE)) {
      const initial = { notifiedIds: [], lastTiktokVideoCount: null, lastCheck: null };
      fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), "utf8");
      return initial;
    }
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    if (!data.notifiedIds) data.notifiedIds = [];
    return data;
  } catch (e) {
    console.error("[SocialNotifier] Errore lettura social_notified.json:", e.message);
    return { notifiedIds: [], lastTiktokVideoCount: null, lastCheck: null };
  }
}

function saveSocialData(data) {
  ensureDataDir();
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (e) {
    console.error("[SocialNotifier] Errore salvataggio social_notified.json:", e.message);
    return false;
  }
}

// Fetch YouTube RSS feed
function fetchYouTubeFeed(channelId = ROOMUP_YT_CHANNEL_ID) {
  return new Promise((resolve, reject) => {
    https.get(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`YouTube RSS returned HTTP ${res.statusCode}`));
      }
      let xml = "";
      res.on("data", chunk => xml += chunk);
      res.on("end", () => resolve(xml));
    }).on("error", reject);
  });
}

// Fetch TikTok Profile Stats & universal data
function fetchTikTokProfile() {
  return new Promise((resolve) => {
    const options = {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7"
      }
    };
    https.get(ROOMUP_TIKTOK_URL, options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const m = data.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
          if (!m) return resolve(null);
          const parsed = JSON.parse(m[1]);
          const stats = parsed["__DEFAULT_SCOPE__"]?.["webapp.user-detail"]?.userInfo?.stats;
          resolve({ stats: stats || null });
        } catch (e) {
          resolve(null);
        }
      });
    }).on("error", () => resolve(null));
  });
}

function parseFeedEntries(xml) {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
  return entries.map(entry => {
    const idMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
    const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
    const pubMatch = entry.match(/<published>([^<]+)<\/published>/);
    return {
      id: idMatch ? idMatch[1] : null,
      title: titleMatch ? titleMatch[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'") : null,
      published: pubMatch ? pubMatch[1] : null
    };
  }).filter(e => Boolean(e.id));
}

function buildSocialAnnouncementMessage({
  title,
  ytUrl,
  tiktokUrl = ROOMUP_TIKTOK_URL,
  instagramUrl = ROOMUP_INSTAGRAM_URL,
  videoId = null,
  customNote = null,
  pingRole = DEFAULT_SOCIAL_ROLE_ID
}) {
  const ytFinalUrl = ytUrl || (videoId ? `https://youtube.com/shorts/${videoId}` : `https://youtube.com/@roomupita`);
  const thumbUrl = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null;

  const embed = new EmbedBuilder()
    .setTitle("🎬 NUOVO SHORT / REEL / TIKTOK ONLINE!")
    .setColor(0x8525E5)
    .setDescription(
      `È appena uscito un nuovo contenuto ufficiale sui nostri social! 🔥\n\n` +
      `📌 **${title}**\n\n` +
      (customNote ? `> ${customNote}\n\n` : "") +
      `Guardalo subito, lascia un like e facci sapere cosa ne pensi nei commenti!`
    )
    .setTimestamp()
    .setFooter({ text: "RoomUp! Social Hub • YouTube • TikTok • Instagram" });

  if (thumbUrl) {
    embed.setImage(thumbUrl);
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Guarda su YouTube")
      .setStyle(ButtonStyle.Link)
      .setURL(ytFinalUrl)
      .setEmoji("📺"),
    new ButtonBuilder()
      .setLabel("Guarda su TikTok")
      .setStyle(ButtonStyle.Link)
      .setURL(tiktokUrl)
      .setEmoji("🎵"),
    new ButtonBuilder()
      .setLabel("Guarda su Instagram")
      .setStyle(ButtonStyle.Link)
      .setURL(instagramUrl)
      .setEmoji("📸")
  );

  let content = null;
  if (pingRole) {
    content = pingRole === "@everyone" ? "@everyone" : `<@&${pingRole}>`;
  }

  return {
    content,
    embeds: [embed],
    components: [row]
  };
}

async function checkAndNotifyNewVideos(client) {
  try {
    const data = loadSocialData();

    // 1. Check YouTube RSS feed
    try {
      const xml = await fetchYouTubeFeed(ROOMUP_YT_CHANNEL_ID);
      const videos = parseFeedEntries(xml);

      if (videos && videos.length > 0) {
        // Inizializzazione video noti se lista vuota
        if (!data.notifiedIds || data.notifiedIds.length === 0) {
          data.notifiedIds = videos.map(v => v.id);
        } else {
          const newVideos = videos.filter(v => !data.notifiedIds.includes(v.id)).reverse();
          if (newVideos.length > 0) {
            let targetChannel = client.channels.cache.get(DEFAULT_SOCIAL_CHANNEL_ID);
            if (!targetChannel) targetChannel = await client.channels.fetch(DEFAULT_SOCIAL_CHANNEL_ID).catch(() => null);

            if (targetChannel && targetChannel.isTextBased()) {
              for (const video of newVideos) {
                const msgData = buildSocialAnnouncementMessage({
                  title: video.title || "Nuovo Short RoomUp!",
                  videoId: video.id,
                  ytUrl: `https://youtube.com/shorts/${video.id}`,
                  tiktokUrl: ROOMUP_TIKTOK_URL,
                  instagramUrl: ROOMUP_INSTAGRAM_URL,
                  pingRole: DEFAULT_SOCIAL_ROLE_ID
                });

                await targetChannel.send({
                  ...msgData,
                  allowedMentions: { roles: [DEFAULT_SOCIAL_ROLE_ID] }
                }).catch(err => {
                  console.error(`[SocialNotifier] Errore invio notifica YT ${video.id}:`, err.message);
                });

                data.notifiedIds.push(video.id);
                console.log(`[SocialNotifier] 🚀 Notifica pubblicata per nuovo video YouTube: ${video.title} (${video.id})`);
              }
            }
          }
        }
      }
    } catch (ytErr) {
      console.error("[SocialNotifier] Errore poller YouTube:", ytErr.message);
    }

    // 2. Check TikTok Profile (videoCount increment)
    try {
      const tiktokProfile = await fetchTikTokProfile();
      if (tiktokProfile && tiktokProfile.stats && typeof tiktokProfile.stats.videoCount === "number") {
        const currentCount = tiktokProfile.stats.videoCount;
        if (typeof data.lastTiktokVideoCount !== "number") {
          data.lastTiktokVideoCount = currentCount;
          console.log(`[SocialNotifier] Inizializzato conteggio video TikTok: ${currentCount}`);
        } else if (currentCount > data.lastTiktokVideoCount) {
          console.log(`[SocialNotifier] 🎵 Rilevato nuovo video TikTok! (Prima: ${data.lastTiktokVideoCount}, Ora: ${currentCount})`);
          data.lastTiktokVideoCount = currentCount;

          let targetChannel = client.channels.cache.get(DEFAULT_SOCIAL_CHANNEL_ID);
          if (!targetChannel) targetChannel = await client.channels.fetch(DEFAULT_SOCIAL_CHANNEL_ID).catch(() => null);

          if (targetChannel && targetChannel.isTextBased()) {
            const msgData = buildSocialAnnouncementMessage({
              title: "Nuovo TikTok / Reel RoomUp Online!",
              tiktokUrl: ROOMUP_TIKTOK_URL,
              ytUrl: `https://youtube.com/@roomupita`,
              instagramUrl: ROOMUP_INSTAGRAM_URL,
              pingRole: DEFAULT_SOCIAL_ROLE_ID
            });

            await targetChannel.send({
              ...msgData,
              allowedMentions: { roles: [DEFAULT_SOCIAL_ROLE_ID] }
            }).catch(err => {
              console.error("[SocialNotifier] Errore invio notifica TikTok:", err.message);
            });
            console.log(`[SocialNotifier] 🚀 Notifica inviata per nuovo TikTok nel canale ${DEFAULT_SOCIAL_CHANNEL_ID}!`);
          }
        }
      }
    } catch (ttErr) {
      console.error("[SocialNotifier] Errore poller TikTok:", ttErr.message);
    }

    data.lastCheck = new Date().toISOString();
    saveSocialData(data);
  } catch (err) {
    console.error("[SocialNotifier] Errore generale ciclo check:", err.message);
  }
}

function initSocialNotifierEngine(client) {
  // 1. Controllo immediato all'avvio
  setTimeout(() => {
    checkAndNotifyNewVideos(client);
  }, 10000).unref();

  // 2. Controllo periodico del feed ogni 90 secondi
  setInterval(() => {
    checkAndNotifyNewVideos(client);
  }, 90000).unref();

  // 3. Gestore comando slash /post-social (per pubblicare annunci manuali istantanei con qualsiasi titolo)
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "post-social") return;

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: "❌ Permessi insufficienti per pubblicare annunci social.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const title = interaction.options.getString("titolo", true);
    const ytUrl = interaction.options.getString("link_youtube") || `https://youtube.com/@roomupita`;
    const tiktokUrl = interaction.options.getString("link_tiktok") || ROOMUP_TIKTOK_URL;
    const instagramUrl = interaction.options.getString("link_instagram") || ROOMUP_INSTAGRAM_URL;
    const nota = interaction.options.getString("nota");
    const ping = interaction.options.getBoolean("ping") ?? true;

    // Estrai eventuale ID video da link YouTube
    let videoId = null;
    const matchYt = ytUrl.match(/(?:shorts\/|v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (matchYt) videoId = matchYt[1];

    let targetChannel = interaction.guild.channels.cache.get(DEFAULT_SOCIAL_CHANNEL_ID) || interaction.channel;

    const targetRoleId = ping ? DEFAULT_SOCIAL_ROLE_ID : null;
    const msgData = buildSocialAnnouncementMessage({
      title,
      ytUrl,
      tiktokUrl,
      instagramUrl,
      videoId,
      customNote: nota,
      pingRole: targetRoleId
    });

    try {
      const sentMsg = await targetChannel.send({
        ...msgData,
        allowedMentions: targetRoleId ? { roles: [targetRoleId] } : { parse: [] }
      });
      return interaction.editReply({
        content: `✅ **Annuncio social pubblicato con successo in <#${targetChannel.id}>!**\n🔗 [Vai al messaggio](${sentMsg.url})`
      });
    } catch (e) {
      return interaction.editReply({ content: `❌ Errore durante l'invio dell'annuncio: ${e.message}` });
    }
  });

  console.log(`[SocialNotifier] Motore Notifiche Social (YouTube RSS + TikTok Profile + Instagram) attivo per canale ${DEFAULT_SOCIAL_CHANNEL_ID}!`);
}

module.exports = {
  initSocialNotifierEngine,
  checkAndNotifyNewVideos,
  buildSocialAnnouncementMessage,
  loadSocialData,
  saveSocialData,
  ROOMUP_YT_CHANNEL_ID,
  ROOMUP_TIKTOK_URL,
  ROOMUP_INSTAGRAM_URL,
  DEFAULT_SOCIAL_CHANNEL_ID
};
