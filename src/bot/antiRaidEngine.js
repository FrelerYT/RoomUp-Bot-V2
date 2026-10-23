const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");

// In-memory velocity tracker: guildId -> Array of timestamps
const joinTimestamps = new Map();
// Locked down guilds memory: guildId -> Set of channelIds modified
const activeLockdowns = new Map();

function initAntiRaidEngine(client, loadSettingsFn) {
  // 1. Join Velocity Monitoring & Profile Screening
  client.on("guildMemberAdd", async (member) => {
    const { guild } = member;
    const settings = typeof loadSettingsFn === "function" ? loadSettingsFn() : {};
    const config = settings[guild.id]?.antiRaid || {
      enabled: true,
      maxJoinsPer10s: 5,
      minAccountAgeDays: 3,
      kickNoAvatar: false,
      autoLockdownOnSpike: true,
      logChannelId: ""
    };

    if (!config.enabled) return;

    const now = Date.now();

    // --- A. Mandatory Profile Screening ---
    const createdTimestamp = member.user.createdTimestamp;
    const accountAgeDays = Math.floor((now - createdTimestamp) / (1000 * 60 * 60 * 24));
    const hasDefaultAvatar = !member.user.avatar;

    if (config.accountAgeScreening !== false && config.minAccountAgeDays && accountAgeDays < config.minAccountAgeDays) {
      const reason = `Anti-Raid Screening: Account troppo recente (${accountAgeDays} giorni, minimo richiesto: ${config.minAccountAgeDays} giorni)`;
      if (config.sendKickDm !== false) {
        const rawDm = config.customAgeKickDm || "⚠️ Sei stato espulso da **{guild}**: il tuo account Discord è troppo recente ({age} giorni). Riprova tra qualche giorno!";
        const dmMsg = rawDm.replace(/{guild}/g, guild.name).replace(/{age}/g, String(accountAgeDays));
        await member.send(dmMsg).catch(() => null);
      }
      await member.kick(reason).catch(() => null);

      sendRaidLog(guild, config.logChannelId, {
        title: "🛡️ Anti-Raid: Utente Sospetto Espulso (Screening Età)",
        description: `L'utente <@${member.id}> (${member.user.tag}) è stato espulso per età account inferiore a ${config.minAccountAgeDays} giorni.`,
        color: config.logEmbedColor || "#f23f43"
      });
      return;
    }

    if (config.avatarScreening !== false && config.kickNoAvatar && hasDefaultAvatar) {
      const reason = "Anti-Raid Screening: Profilo sprovvisto di immagine avatar (possibile bot raid)";
      if (config.sendKickDm !== false) {
        const rawDm = config.customAvatarKickDm || "⚠️ Sei stato espulso da **{guild}**: è richiesta un'immagine profilo personalizzata per accedere.";
        const dmMsg = rawDm.replace(/{guild}/g, guild.name);
        await member.send(dmMsg).catch(() => null);
      }
      await member.kick(reason).catch(() => null);

      sendRaidLog(guild, config.logChannelId, {
        title: "🛡️ Anti-Raid: Profilo Senza Avatar Espulso",
        description: `L'utente <@${member.id}> (${member.user.tag}) è stato espulso per assenza di avatar.`,
        color: "#f0b232"
      });
      return;
    }

    // --- B. Join Velocity Spikes ---
    if (config.joinSpikeProtection !== false) {
      if (!joinTimestamps.has(guild.id)) joinTimestamps.set(guild.id, []);
      const list = joinTimestamps.get(guild.id);
      list.push(now);

      // Keep only timestamps within last 10 seconds
      const tenSecondsAgo = now - 10000;
      while (list.length > 0 && list[0] < tenSecondsAgo) {
        list.shift();
      }

      if (list.length >= (config.maxJoinsPer10s || 5)) {
        console.warn(`[AntiRaid] 🚨 Spike di ingressi anomalo su ${guild.name}: ${list.length} join in 10 secondi!`);

        sendRaidLog(guild, config.logChannelId, {
          title: "🚨 ALLARME RAID: Spike di Ingressi Rilevato!",
          description: `Rilevati **${list.length} nuovi membri in meno di 10 secondi**!\n${config.autoLockdownOnSpike ? "🔒 **Lockdown d'emergenza attivato automaticamente** per proteggere il server!" : "⚠️ Monitorare attentamente la situazione."}`,
          color: config.logEmbedColor || "#f23f43"
        });

        if (config.autoLockdownOnSpike && !activeLockdowns.has(guild.id)) {
          await executeServerLockdown(guild, true, "Spike raid di ingressi improvviso rilevato da Anti-Raid Watchdog");
        }
      }
    }
  });

  // 2. Anti-Mass Mention / Raid Ping Control
  client.on("messageCreate", async (message) => {
    if (!message.guild || message.author.bot) return;
    if (message.member?.permissions.has(PermissionFlagsBits.ManageMessages) || message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
      return;
    }

    const settings = typeof loadSettingsFn === "function" ? loadSettingsFn() : {};
    const config = settings[message.guild.id]?.antiRaid;
    if (!config || !config.enabled) return;

    const content = message.content;
    const hasEveryone = (config.antiEveryonePing !== false) && (content.includes("@everyone") || content.includes("@here"));
    const roleMentionsCount = message.mentions.roles.size;
    const userMentionsCount = message.mentions.users.size;
    const isMassMention = (config.antiMassMention !== false) && (roleMentionsCount >= 3 || userMentionsCount >= 6);

    if (hasEveryone || isMassMention) {
      await message.delete().catch(() => null);

      if (message.member?.moderatable) {
        await message.member.timeout(30 * 60 * 1000, "Anti-Raid: Tentativo di menzione massiva o raid ping").catch(() => null);
      }

      const warningMsg = await message.channel.send({
        content: `🛡️ <@${message.author.id}>, i tuoi messaggi con menzioni massive sono stati rimossi ed è stato applicato un timeout di sicurezza.`
      }).catch(() => null);

      if (warningMsg) setTimeout(() => warningMsg.delete().catch(() => null), 8000);

      sendRaidLog(message.guild, config.logChannelId, {
        title: "🛡️ Anti-Raid: Raid Ping Neutralizzato",
        description: `Autore: <@${message.author.id}> (${message.author.tag})\nCanale: <#${message.channelId}>\nContenuto bloccato: \`${content.slice(0, 150)}\``,
        color: "#f23f43"
      });
    }
  });

  // 3. Slash Command: /lockdown
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "lockdown") return;

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: "❌ Solo gli amministratori possono gestire il lockdown.", ephemeral: true });
    }

    const state = interaction.options.getString("stato", true);
    const reason = interaction.options.getString("motivo") || "Manutenzione o sicurezza del server";

    await interaction.deferReply();

    if (state === "on") {
      const affected = await executeServerLockdown(interaction.guild, true, reason);
      return interaction.editReply({
        content: `🔒 **Server in Lockdown!** Permessi di scrittura revocati a @everyone su **${affected} canali testuali**.\n**Motivo:** ${reason}`
      });
    } else {
      const restored = await executeServerLockdown(interaction.guild, false, reason);
      return interaction.editReply({
        content: `🔓 **Lockdown Revocato!** Permessi di scrittura ripristinati su **${restored} canali testuali**.`
      });
    }
  });

  console.log("[AntiRaidEngine] Suite Anti-Raid & Server Defense Attiva!");
}

async function executeServerLockdown(guild, lock = true, reason = "") {
  const everyoneRole = guild.roles.everyone;
  const channels = guild.channels.cache.filter(c => c.isTextBased() && !c.isThread());
  let count = 0;

  if (lock) {
    const lockedSet = new Set();
    for (const [_, ch] of channels) {
      try {
        await ch.permissionOverwrites.edit(everyoneRole, {
          SendMessages: false,
          AddReactions: false
        }, { reason: `Lockdown Emergenza: ${reason}` });
        lockedSet.add(ch.id);
        count++;
      } catch (e) {}
    }
    activeLockdowns.set(guild.id, lockedSet);
  } else {
    const lockedSet = activeLockdowns.get(guild.id) || new Set(channels.keys());
    for (const chId of lockedSet) {
      const ch = guild.channels.cache.get(chId);
      if (ch) {
        try {
          await ch.permissionOverwrites.edit(everyoneRole, {
            SendMessages: null,
            AddReactions: null
          }, { reason: "Sblocco Lockdown" });
          count++;
        } catch (e) {}
      }
    }
    activeLockdowns.delete(guild.id);
  }

  return count;
}

function sendRaidLog(guild, logChannelId, data) {
  if (!logChannelId) return;
  const channel = guild.channels.cache.get(logChannelId);
  if (!channel || !channel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setTitle(data.title)
    .setDescription(data.description)
    .setColor(data.color || "#f23f43")
    .setTimestamp();

  channel.send({ embeds: [embed] }).catch(() => null);
}

module.exports = {
  initAntiRaidEngine,
  executeServerLockdown
};
