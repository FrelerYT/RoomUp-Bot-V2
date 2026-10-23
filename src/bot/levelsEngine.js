const {
  EmbedBuilder,
  AttachmentBuilder,
  Events
} = require("discord.js");
const fs = require("fs");
const path = require("path");
const { renderLevelUpCard } = require("./levelCardRenderer");

const LEVELS_FILE = path.join(__dirname, "../../data/levels.json");

function ensureDataDir() {
  const dir = path.dirname(LEVELS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadLevels() {
  ensureDataDir();
  try {
    if (!fs.existsSync(LEVELS_FILE)) {
      const initial = {};
      fs.writeFileSync(LEVELS_FILE, JSON.stringify(initial, null, 2), "utf8");
      return initial;
    }
    return JSON.parse(fs.readFileSync(LEVELS_FILE, "utf8"));
  } catch (e) {
    return {};
  }
}

function saveLevels(data) {
  ensureDataDir();
  try {
    fs.writeFileSync(LEVELS_FILE, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (e) {
    return false;
  }
}

// XP needed to reach next level
function getXpForNextLevel(level) {
  return 5 * (level * level) + (50 * level) + 100;
}

function initLevelsEngine(client, loadSettingsFn) {

  // Message XP Gain
  client.on(Events.MessageCreate, async (message) => {
    try {
      if (!message.guild || message.author.bot) return;

      const settings = typeof loadSettingsFn === 'function' ? loadSettingsFn() : {};
      const config = settings[message.guild.id]?.levels;
      if (!config || !config.enabled) return;
      if (config.gainXpText === false) return;

      const allLevels = loadLevels();
      const gId = message.guild.id;
      const uId = message.author.id;

      if (!allLevels[gId]) allLevels[gId] = {};
      if (!allLevels[gId][uId]) {
        allLevels[gId][uId] = { xp: 0, level: 0, lastXpTime: 0 };
      }

      const userData = allLevels[gId][uId];
      const now = Date.now();

      // 60-second cooldown per user
      if (now - userData.lastXpTime < 60000) return;

      const minXp = config.xpPerMessageMin || 15;
      const maxXp = config.xpPerMessageMax || 25;
      const gained = Math.floor(Math.random() * (maxXp - minXp + 1)) + minXp;

      userData.xp += gained;
      userData.lastXpTime = now;

      // Check level up
      const oldLevel = userData.level || 0;
      let curLevel = oldLevel;
      let needed = getXpForNextLevel(curLevel);

      let leveledUp = false;
      while (userData.xp >= needed) {
        userData.xp -= needed;
        curLevel++;
        leveledUp = true;
        needed = getXpForNextLevel(curLevel);
      }

      if (leveledUp) {
        userData.level = curLevel;
        saveLevels(allLevels);

        // Announce Level Up
        if (config.announceLevelUp !== false) {
          await dispatchLevelUpAnnouncement(
            message.guild,
            message.channel,
            message.member || { id: message.author.id, user: message.author },
            oldLevel,
            curLevel,
            config,
            userData
          );
        }

        // Role Rewards for level
        if (config.roleRewardsEnabled !== false) {
          const rewards = config.roleRewards || {};
          if (rewards[String(curLevel)]) {
            const roleId = rewards[String(curLevel)];
            const rewardRole = message.guild.roles.cache.get(roleId);
            if (rewardRole && message.member) {
              await message.member.roles.add(rewardRole).catch(() => null);
            }
          }
        }
      } else {
        saveLevels(allLevels);
      }
    } catch (e) {
      console.error("[LevelsEngine] Errore aggiornamento XP:", e.message);
    }
  });

  // ─── Voice XP Gain ────────────────────────────────────────────────────────
  // Ogni 60 secondi scansiona tutti i canali vocali di ogni guild attiva
  // e assegna XP a chi è connesso (non bot, non self-deaf, canale con ≥2 persone reali)
  setInterval(async () => {
    try {
      const settings = typeof loadSettingsFn === 'function' ? loadSettingsFn() : {};
      const allLevels = loadLevels();
      let dirty = false;

      for (const guild of client.guilds.cache.values()) {
        const config = settings[guild.id]?.levels;
        if (!config || !config.enabled) continue;
        if (config.gainXpVoice === false) continue; // opt-out esplicito

        const minXp = config.xpPerVoiceMin || 10;
        const maxXp = config.xpPerVoiceMax || 20;
        const allowMuted = config.gainXpMuted !== false; // Default: true (assegna XP anche da mutato / deafened)
        const minMembers = config.voiceMinMembers !== undefined ? Number(config.voiceMinMembers) : 1; // Default: 1 (anche da solo)

        for (const channel of guild.channels.cache.values()) {
          // Solo canali vocali (type 2 = GUILD_VOICE, type 13 = STAGE_VOICE)
          if (channel.type !== 2 && channel.type !== 13) continue;

          // Escludi il canale AFK del server se presente
          if (guild.afkChannelId && channel.id === guild.afkChannelId) continue;

          // Filtra membri umani (esclusi bot)
          // Se allowMuted è true (default), assegna XP anche se l'utente è mutato o deafened
          const realMembers = channel.members.filter(m => {
            if (m.user.bot) return false;
            if (!allowMuted) {
              if (m.voice.selfMute || m.voice.serverMute || m.voice.selfDeaf || m.voice.serverDeaf) {
                return false;
              }
            }
            return true;
          });

          // Serve almeno il numero minimo di membri richiesto nel canale (default 1)
          if (realMembers.size < minMembers) continue;

          for (const [, member] of realMembers) {
            const gId = guild.id;
            const uId = member.id;

            if (!allLevels[gId]) allLevels[gId] = {};
            if (!allLevels[gId][uId]) {
              allLevels[gId][uId] = { xp: 0, level: 0, lastXpTime: 0 };
            }

            const userData = allLevels[gId][uId];
            const gained = Math.floor(Math.random() * (maxXp - minXp + 1)) + minXp;

            userData.xp += gained;
            dirty = true;

            // Check level up
            const oldLevel = userData.level || 0;
            let curLevel = oldLevel;
            let needed = getXpForNextLevel(curLevel);
            let leveledUp = false;

            while (userData.xp >= needed) {
              userData.xp -= needed;
              curLevel++;
              leveledUp = true;
              needed = getXpForNextLevel(curLevel);
            }

            if (leveledUp) {
              userData.level = curLevel;

              if (config.announceLevelUp !== false) {
                const announceChannelId = config.levelUpChannelId;
                const announceChannel = announceChannelId
                  ? guild.channels.cache.get(announceChannelId)
                  : null;

                await dispatchLevelUpAnnouncement(
                  guild,
                  announceChannel || channel,
                  member,
                  oldLevel,
                  curLevel,
                  config,
                  userData
                );
              }

              // Role Rewards
              if (config.roleRewardsEnabled !== false) {
                const rewards = config.roleRewards || {};
                if (rewards[String(curLevel)]) {
                  const role = guild.roles.cache.get(rewards[String(curLevel)]);
                  if (role) await member.roles.add(role).catch(() => null);
                }
              }
            }
          }
        }
      }

      if (dirty) saveLevels(allLevels);
    } catch (e) {
      console.error("[LevelsEngine] Errore XP vocale:", e.message);
    }
  }, 60_000); // ogni 60 secondi
  // ──────────────────────────────────────────────────────────────────────────

  // Slash command /rank
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "rank") return;

    const targetUser = interaction.options.getUser("utente") || interaction.user;
    const gId = interaction.guild.id;

    const allLevels = loadLevels();
    const guildData = allLevels[gId] || {};

    const userData = guildData[targetUser.id] || { xp: 0, level: 0 };
    const needed = getXpForNextLevel(userData.level || 0);

    // Compute rank position
    const sorted = Object.entries(guildData)
      .map(([id, d]) => ({ id, level: d.level || 0, xp: d.xp || 0 }))
      .sort((a, b) => b.level !== a.level ? b.level - a.level : b.xp - a.xp);

    const rankPos = sorted.findIndex(u => u.id === targetUser.id) + 1;

    // Visual progress bar
    const percent = Math.min(100, Math.floor((userData.xp / needed) * 100));
    const fullBars = Math.floor(percent / 10);
    const bar = "█".repeat(fullBars) + "░".repeat(10 - fullBars);

    const embed = new EmbedBuilder()
      .setTitle(`📈 Profilo Livello di ${targetUser.username}`)
      .setColor("#5865F2")
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: "Livello", value: `**${userData.level || 0}** 🎖️`, inline: true },
        { name: "Posizione", value: `#**${rankPos || sorted.length + 1}** 🏆`, inline: true },
        { name: "Progresso XP", value: `\`${userData.xp}\` / \`${needed}\` XP (**${percent}%**)\n[${bar}]` }
      )
      .setFooter({ text: `${interaction.guild.name} • Sistema Livelli` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  });

  // Slash command /scoreboard-lvl
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "scoreboard-lvl") return;

    const gId = interaction.guild?.id;
    if (!gId) return;

    const allLevels = loadLevels();
    const guildData = allLevels[gId] || {};

    // Sort users by level (descending), then by current XP (descending)
    const sorted = Object.entries(guildData)
      .map(([id, d]) => ({ id, level: d.level || 0, xp: d.xp || 0 }))
      .sort((a, b) => b.level !== a.level ? b.level - a.level : b.xp - a.xp);

    if (sorted.length === 0) {
      return interaction.reply({
        content: "📊 Non ci sono ancora dati di livello registrati per questo server. Inizia a chattare o a partecipare nei canali vocali per scalare la classifica!",
        ephemeral: true
      });
    }

    const pageSize = 10;
    const totalPages = Math.ceil(sorted.length / pageSize) || 1;
    const requestedPage = interaction.options.getInteger("pagina") || 1;
    const page = Math.max(1, Math.min(requestedPage, totalPages));

    const startIdx = (page - 1) * pageSize;
    const currentSlice = sorted.slice(startIdx, startIdx + pageSize);

    const medals = ["🥇", "🥈", "🥉"];
    const lines = [];

    for (let i = 0; i < currentSlice.length; i++) {
      const entry = currentSlice[i];
      const rankNum = startIdx + i + 1;
      const rankPrefix = rankNum <= 3 ? medals[rankNum - 1] : `\`#${rankNum.toString().padStart(2, " ")}\``;

      const member = interaction.guild.members.cache.get(entry.id);
      const name = member ? (member.displayName || member.user.username) : `<@${entry.id}>`;

      lines.push(`${rankPrefix} **${name}** — Livello **${entry.level}** • \`${entry.xp.toLocaleString("it-IT")} XP\``);
    }

    const callerPos = sorted.findIndex(u => u.id === interaction.user.id) + 1;
    const callerData = guildData[interaction.user.id] || { level: 0, xp: 0 };
    const callerLine = callerPos > 0
      ? `\n──────────────────────────────\n📌 **La tua posizione:** \`#${callerPos}\` • Livello **${callerData.level || 0}** (\`${(callerData.xp || 0).toLocaleString("it-IT")} XP\`)`
      : `\n──────────────────────────────\n📌 **La tua posizione:** Non ancora in classifica`;

    const embed = new EmbedBuilder()
      .setTitle(`🏆 Scoreboard Livelli & XP • ${interaction.guild.name}`)
      .setDescription(lines.join("\n") + callerLine)
      .setColor(0xf1c40f)
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .setFooter({ text: `Pagina ${page}/${totalPages} • Totale utenti con XP: ${sorted.length}` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  });

  console.log("[LevelsEngine] Sistema Livelli & XP attivo! (testo + vocale)");
}

/**
 * Dispatches Level Up announcement to Discord channel or DM
 */
async function dispatchLevelUpAnnouncement(guild, fallbackChannel, member, oldLevel, newLevel, config = {}, userData = {}) {
  try {
    const rawMsg = config.message || "Complimenti {user}, sei salito al livello **{level}**!";
    const announceText = rawMsg
      .replace(/{user}/g, `<@${member.id}>`)
      .replace(/{username}/g, member.user?.username || member.username || "Utente")
      .replace(/{tag}/g, member.user?.tag || member.tag || "Utente")
      .replace(/{guild}/g, guild.name)
      .replace(/{level}/g, String(newLevel))
      .replace(/{oldLevel}/g, String(oldLevel))
      .replace(/{xp}/g, String(userData.xp || 0));

    let cardAttachment = null;
    if (config.useCardBanner !== false) {
      try {
        const avatarUrl = member.user?.displayAvatarURL
          ? member.user.displayAvatarURL({ extension: "png", size: 256, forceStatic: true })
          : null;
        const cardBuffer = await renderLevelUpCard({
          oldLevel,
          newLevel,
          avatarUrl
        });
        cardAttachment = new AttachmentBuilder(cardBuffer, { name: "level_up.png" });
      } catch (err) {
        console.error("[LevelsEngine] Errore generazione card grafica level up:", err.message);
      }
    }

    const mode = config.announceMode || "channel"; // "channel", "current", "dm", "disabled"
    if (mode === "disabled") return;

    const payload = {};
    if (cardAttachment) {
      payload.files = [cardAttachment];
    }

    if (config.useEmbed) {
      const embedTitle = (config.embedTitle || "🆙 Level Up!")
        .replace(/{user}/g, `<@${member.id}>`)
        .replace(/{username}/g, member.user?.username || "Utente")
        .replace(/{level}/g, String(newLevel));

      const footerText = config.embedFooterText
        ? config.embedFooterText.replace(/{guild}/g, guild.name).replace(/{level}/g, String(newLevel))
        : `${guild.name} • Classifica XP`;

      const embed = new EmbedBuilder()
        .setTitle(embedTitle)
        .setDescription(announceText)
        .setColor(config.embedColor || "#731fc3")
        .setFooter({ text: footerText })
        .setTimestamp();

      if (cardAttachment) {
        embed.setImage("attachment://level_up.png");
      }
      payload.embeds = [embed];
    } else {
      payload.content = announceText;
    }

    if (mode === "dm") {
      if (member.user && typeof member.user.send === "function") {
        await member.user.send(payload).catch(() => null);
      } else if (typeof member.send === "function") {
        await member.send(payload).catch(() => null);
      }
    } else {
      const targetChannelId = mode === "current" ? fallbackChannel?.id : (config.levelUpChannelId || fallbackChannel?.id);
      const targetChannel = (targetChannelId ? guild.channels.cache.get(targetChannelId) : null) || fallbackChannel;

      if (targetChannel && targetChannel.isTextBased()) {
        await targetChannel.send(payload).catch((e) => console.error("[LevelsEngine] Errore invio messaggio level up:", e.message));
      }
    }
  } catch (err) {
    console.error("[LevelsEngine] Errore dispatchLevelUpAnnouncement:", err);
  }
}

module.exports = {
  initLevelsEngine,
  loadLevels,
  saveLevels,
  dispatchLevelUpAnnouncement,
  renderLevelUpCard
};

