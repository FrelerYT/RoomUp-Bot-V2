const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags
} = require("discord.js");
const { isUserBanned, applyBanIsolation, getBannedUserInfo } = require("./unbanAppealEngine");

// In-memory state tracking
const activePuzzles = new Map(); // `${guildId}:${userId}` -> { type, answer, expiresAt, startedAt }
const unverifiedTimers = new Map(); // `${guildId}:${userId}` -> timeoutHandle
const failedAttempts = new Map(); // `${guildId}:${userId}` -> count

const EMOJI_OPTIONS = [
  { name: "Mela", symbol: "🍎" },
  { name: "Pizza", symbol: "🍕" },
  { name: "Gatto", symbol: "🐱" },
  { name: "Auto", symbol: "🚗" },
  { name: "Stella", symbol: "⭐" },
  { name: "Cuore", symbol: "❤️" },
  { name: "Pallone", symbol: "⚽" },
  { name: "Chitarra", symbol: "🎸" },
  { name: "Cane", symbol: "🐶" },
  { name: "Sole", symbol: "☀️" }
];

function generateRandomCode(length = 5) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Log verification event to settings & stats
function recordVerificationEvent(guildId, user, mode, status, reason = "", loadSettingsFn, saveSettingsFn) {
  try {
    if (typeof loadSettingsFn !== 'function' || typeof saveSettingsFn !== 'function') return;
    const settings = loadSettingsFn();
    if (!settings[guildId]) settings[guildId] = {};
    if (!settings[guildId].verification) settings[guildId].verification = {};

    const v = settings[guildId].verification;
    if (!v.stats) {
      v.stats = { totalVerified: 0, totalFailed: 0, recentLogs: [] };
    }

    if (status === "success") {
      v.stats.totalVerified = (v.stats.totalVerified || 0) + 1;
    } else {
      v.stats.totalFailed = (v.stats.totalFailed || 0) + 1;
    }

    if (!Array.isArray(v.stats.recentLogs)) v.stats.recentLogs = [];
    v.stats.recentLogs.unshift({
      userId: user.id,
      userTag: user.tag || user.username,
      userAvatar: user.displayAvatarURL ? user.displayAvatarURL({ dynamic: true }) : null,
      timestamp: new Date().toISOString(),
      mode: mode || "code",
      status: status,
      reason: reason || (status === "success" ? "Verifica completata" : "Tentativo fallito")
    });

    if (v.stats.recentLogs.length > 30) {
      v.stats.recentLogs = v.stats.recentLogs.slice(0, 30);
    }

    saveSettingsFn(settings);
  } catch (err) {
    console.error("[Verification] Errore salvataggio statistiche:", err.message);
  }
}

// Create a single role on demand
async function createSingleRole(guild, roleType) {
  if (!guild) throw new Error("Server Discord non trovato.");

  const isVerified = roleType === "verified";
  const roleName = isVerified ? "Verificato" : "Non Verificato";
  const roleColor = isVerified ? "#10B981" : "#6B7280";

  await guild.roles.fetch().catch(() => null);

  let role = guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
  if (!role) {
    role = await guild.roles.create({
      name: roleName,
      color: roleColor,
      reason: `RoomUp Verification: Creazione ruolo ${roleName}`
    });
    console.log(`[Verification] Ruolo @${role.name} creato su Discord (ID: ${role.id}).`);
  }

  return { id: role.id, name: role.name };
}

// 1-Click Auto-Setup Member Channel Isolation (ZERO touch on @everyone!)
// Applies ViewChannel: false directly to unverified MEMBER IDs on categories/channels!
async function isolateMember(member, config = {}) {
  if (!member || !member.guild || member.user.bot) return;
  const guild = member.guild;
  const verifyChannelId = config.channelId;
  if (!verifyChannelId) return;

  const channels = await guild.channels.fetch();
  const verifyChannel = channels.get(verifyChannelId);
  const verifyCategoryId = verifyChannel?.parentId || null;

  const overwritePromises = [];

  // 1. Categories: Hide from member, except verification category
  const categories = channels.filter(c => c && c.type === ChannelType.GuildCategory);
  for (const [catId, cat] of categories) {
    if (catId === verifyCategoryId) {
      overwritePromises.push(
        cat.permissionOverwrites.edit(member.id, {
          ViewChannel: true,
          SendMessages: false,
          ReadMessageHistory: true
        }, { reason: "Isolamento Membro: Categoria verifica visibile" }).catch(() => null)
      );
    } else {
      overwritePromises.push(
        cat.permissionOverwrites.edit(member.id, {
          ViewChannel: false
        }, { reason: "Isolamento Membro: Categoria nascosta" }).catch(() => null)
      );
    }
  }

  // 2. Verification Channel: explicitly allow View for member
  if (verifyChannel) {
    overwritePromises.push(
      verifyChannel.permissionOverwrites.edit(member.id, {
        ViewChannel: true,
        SendMessages: false,
        ReadMessageHistory: true
      }, { reason: "Isolamento Membro: Canale verifica visibile" }).catch(() => null)
    );
  }

  // 3. Standalone channels: hide from member
  const standalone = channels.filter(c => c && c.type !== ChannelType.GuildCategory && !c.parentId && !c.isThread() && c.id !== verifyChannelId);
  for (const [chId, ch] of standalone) {
    overwritePromises.push(
      ch.permissionOverwrites.edit(member.id, {
        ViewChannel: false
      }, { reason: "Isolamento Membro: Canale nascosto" }).catch(() => null)
    );
  }

  // 4. Unsynced channels in categories: hide explicitly from member to override channel-level role/@everyone permits
  const unsyncedInCat = channels.filter(c => c && c.type !== ChannelType.GuildCategory && c.parentId && !c.isThread() && c.id !== verifyChannelId && !c.permissionsLocked);
  for (const [chId, ch] of unsyncedInCat) {
    overwritePromises.push(
      ch.permissionOverwrites.edit(member.id, {
        ViewChannel: false
      }, { reason: "Isolamento Membro: Canale non sincronizzato nascosto" }).catch(() => null)
    );
  }

  for (let i = 0; i < overwritePromises.length; i += 10) {
    await Promise.all(overwritePromises.slice(i, i + 10));
  }
}

// Unisolate member on successful verification: removes member overwrites and hides verify channel
async function unisolateMember(member, config = {}) {
  if (!member || !member.guild) return;
  const guild = member.guild;
  const verifyChannelId = config.channelId;
  const channels = await guild.channels.fetch();
  const verifyChannel = verifyChannelId ? channels.get(verifyChannelId) : null;
  const verifyCategoryId = verifyChannel?.parentId || null;

  const promises = [];

  for (const [chId, ch] of channels) {
    if (!ch || !ch.permissionOverwrites || ch.isThread()) continue;

    if (chId === verifyChannelId || (verifyCategoryId && chId === verifyCategoryId)) {
      if (config.hideChannelAfterVerify !== false) {
        promises.push(
          ch.permissionOverwrites.edit(member.id, {
            ViewChannel: false
          }, { reason: "Verifica completata: Canale verifica nascosto al membro" }).catch(() => null)
        );
      }
      continue;
    }

    const userOw = ch.permissionOverwrites.cache.get(member.id);
    if (userOw) {
      promises.push(userOw.delete().catch(() => null));
    }
  }

  for (let i = 0; i < promises.length; i += 10) {
    await Promise.all(promises.slice(i, i + 10));
  }
}

// Isolate all unverified members in the server (ZERO TOUCH on @everyone!)
async function applyChannelIsolation(guild, config = {}) {
  if (!guild) throw new Error("Server Discord non trovato.");
  const verifyChannelId = config.channelId;
  if (!verifyChannelId) throw new Error("Canale di verifica non configurato.");

  const members = await guild.members.fetch();
  const verifiedRoleId = config.verifiedRoleId || config.roleToAddId;

  let isolatedCount = 0;
  for (const [memberId, member] of members) {
    if (member.user.bot) continue;
    if (member.id === guild.ownerId) continue;
    if (member.permissions.has(PermissionFlagsBits.Administrator)) continue;
    if (verifiedRoleId && member.roles.cache.has(verifiedRoleId)) continue;

    await isolateMember(member, config);
    isolatedCount++;
  }

  return { success: true, updated: isolatedCount, errors: 0 };
}

// Reset member isolation: removes individual member overwrites
async function resetChannelIsolation(guild, config = {}) {
  if (!guild) throw new Error("Server Discord non trovato.");
  const channels = await guild.channels.fetch();
  let clearedCount = 0;

  for (const [chId, ch] of channels) {
    if (!ch || !ch.permissionOverwrites || ch.isThread()) continue;
    for (const [targetId, ow] of ch.permissionOverwrites.cache) {
      // ow.type 1 is Member overwrite
      if (ow.type === 1) {
        await ow.delete().catch(() => null);
        clearedCount++;
      }
    }
  }

  return { success: true, updated: clearedCount, errors: 0 };
}

async function autoSetupChannelPermissions(guild, verifyChannelId, verifiedRoleId, unverifiedRoleId) {
  return applyChannelIsolation(guild, { channelId: verifyChannelId, verifiedRoleId, unverifiedRoleId });
}

// Deploy verification panel to Discord channel
async function deployVerificationPanel(guildOrChannel, channelIdOrConfig, maybeConfig) {
  let channel;
  let config;

  if (guildOrChannel && typeof guildOrChannel.send === "function") {
    channel = guildOrChannel;
    config = channelIdOrConfig || {};
  } else if (guildOrChannel && guildOrChannel.channels) {
    channel = guildOrChannel.channels.cache.get(channelIdOrConfig);
    config = maybeConfig || {};
  }

  if (!channel || !channel.isTextBased()) {
    throw new Error("Canale di verifica non valido o non testuale.");
  }

  const desc = (config.embedDescription || config.description || "Clicca sul pulsante qui sotto per completare la verifica e sbloccare tutti i canali del server.").replace(/\\n/g, "\n");
  const embed = new EmbedBuilder()
    .setTitle(config.embedTitle || config.title || "Verifica del Server")
    .setDescription(desc)
    .setColor(config.embedColor || config.color || "#5865F2");

  const imageSrc = config.image || config.bannerImage;
  if (imageSrc && typeof imageSrc === "string" && imageSrc.startsWith("http")) {
    embed.setImage(imageSrc);
  }

  if (config.thumbnail && typeof config.thumbnail === "string" && config.thumbnail.startsWith("http")) {
    embed.setThumbnail(config.thumbnail);
  }

  const footerText = config.embedFooter || config.footer;
  if (footerText && typeof footerText === "string") {
    embed.setFooter({ text: footerText });
  }

  const btnStyle = config.buttonColor === "success" ? ButtonStyle.Success
    : config.buttonColor === "secondary" ? ButtonStyle.Secondary
    : config.buttonColor === "danger" ? ButtonStyle.Danger
    : ButtonStyle.Primary;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("roomup_verify_start")
      .setLabel(config.buttonLabel || "Verificati")
      .setStyle(btnStyle)
  );

  await channel.send({ embeds: [embed], components: [row] });
  return true;
}

// Complete verification & grant roles (INSTANT <50ms)
async function completeVerification(member, config, guild, reason = "Verifica completata con successo", loadSettingsFn, saveSettingsFn) {
  const rolesAdded = [];
  let roleRemovedName = null;

  // 1. Give Primary Verified Role
  const targetVerifiedRoleId = config.roleToAddId || config.verifiedRoleId;
  if (targetVerifiedRoleId) {
    const roleToAdd = guild.roles.cache.get(targetVerifiedRoleId) || await guild.roles.fetch(targetVerifiedRoleId).catch(() => null);
    if (roleToAdd) {
      await member.roles.add(roleToAdd).catch((e) => console.error("[Verification] Impossibile aggiungere ruolo primario:", e.message));
      rolesAdded.push(`@${roleToAdd.name}`);
    }
  }

  // 2. Give Additional Roles (if configured)
  if (Array.isArray(config.extraRoleIds)) {
    for (const extraId of config.extraRoleIds) {
      const extraRole = guild.roles.cache.get(extraId) || await guild.roles.fetch(extraId).catch(() => null);
      if (extraRole && !rolesAdded.includes(`@${extraRole.name}`)) {
        await member.roles.add(extraRole).catch(() => null);
        rolesAdded.push(`@${extraRole.name}`);
      }
    }
  }

  // 3. Remove Unverified Role
  const targetUnverifiedRoleId = config.roleToRemoveId || config.unverifiedRoleId;
  if (targetUnverifiedRoleId) {
    const roleToRemove = guild.roles.cache.get(targetUnverifiedRoleId) || await guild.roles.fetch(targetUnverifiedRoleId).catch(() => null);
    if (roleToRemove) {
      await member.roles.remove(roleToRemove).catch((e) => console.error("[Verification] Impossibile rimuovere ruolo:", e.message));
      roleRemovedName = roleToRemove.name;
    }
  }

  // 4. Remove individual user channel isolation in background & hide verification channel
  setImmediate(async () => {
    try {
      await unisolateMember(member, config);
      console.log(`[Verification] Sblocco permessi completato per ${member.user.tag}. Canale verifica nascosto.`);
    } catch (err) {
      console.error("[Verification] Errore sblocco permessi individuali:", err.message);
    }
  });

  // Clear unverified timer & failed attempts
  const timerKey = `${guild.id}:${member.id}`;
  if (unverifiedTimers.has(timerKey)) {
    clearTimeout(unverifiedTimers.get(timerKey));
    unverifiedTimers.delete(timerKey);
  }
  failedAttempts.delete(timerKey);

  // Record stats
  recordVerificationEvent(guild.id, member.user, config.mode, "success", reason, loadSettingsFn, saveSettingsFn);

  // Log in channel (Fedele allo Screenshot media_1789827101674.png)
  const targetLogChannelId = config.logChannelId
    || (typeof loadSettingsFn === 'function' ? loadSettingsFn()[guild.id]?.logs?.events?.memberVerify?.channelId : null)
    || (typeof loadSettingsFn === 'function' ? loadSettingsFn()[guild.id]?.logs?.categories?.members?.channelId : null)
    || "1550847075434893463";

  if (targetLogChannelId) {
    const logChannel = guild.channels.cache.get(targetLogChannelId);
    if (logChannel && logChannel.isTextBased()) {
      const { buildVerificationCompletePayload } = require("./loggerEngine");
      const payload = buildVerificationCompletePayload(member, rolesAdded, roleRemovedName, config.mode || "MATH");
      await logChannel.send(payload).catch(() => null);
    }
  }

  // 5. Send DM Notification (if enabled)
  if (config.dmNotification) {
    const defaultDm = "Ciao {username}! Hai completato con successo la verifica in **{guild}**.{roles}\nBuona permanenza!";
    const dmTpl = config.dmMessage || defaultDm;
    const rolesStr = rolesAdded.length > 0 ? ` Ruoli assegnati: **${rolesAdded.join(", ")}**.` : "";
    const dmText = formatPlaceholders(dmTpl, {
      user: `<@${member.id}>`,
      username: member.user.username,
      guild: guild.name,
      memberCount: guild.memberCount,
      roles: rolesStr
    });
    member.send(dmText).catch(() => console.log(`[Verification] Impossibile inviare DM a ${member.user.tag} (DM chiusi o disabilitati)`));
  }

  return { rolesAdded, roleRemovedName };
}

// Format Generic Placeholders helper
function formatPlaceholders(template, data = {}) {
  if (!template) return "";
  let text = String(template);
  for (const [k, v] of Object.entries(data)) {
    text = text.replaceAll(`{${k}}`, v !== undefined && v !== null ? String(v) : "");
  }
  return text;
}

// Format Custom Success Message
function formatSuccessMessage(template, member, guild, rolesAdded = []) {
  const defaultMsg = "Hai completato la verifica con successo! Benvenuto in **{guild}**.{roles}";
  const tpl = template || defaultMsg;
  const rolesStr = rolesAdded.length > 0 ? ` Ruoli assegnati: **${rolesAdded.join(", ")}**.` : "";
  return formatPlaceholders(tpl, {
    user: `<@${member.id}>`,
    username: member.user.username,
    guild: guild.name,
    memberCount: guild.memberCount,
    roles: rolesStr
  });
}

// Handle Verification Failures & Security Lockout
async function handleVerificationFailure(member, config, guild, mode, reason, loadSettingsFn, saveSettingsFn) {
  const key = `${guild.id}:${member.id}`;
  const currentFails = (failedAttempts.get(key) || 0) + 1;
  failedAttempts.set(key, currentFails);

  recordVerificationEvent(guild.id, member.user, mode, "failed", reason, loadSettingsFn, saveSettingsFn);

  const maxFails = parseInt(config.maxFailedAttempts) || 3;
  if (currentFails >= maxFails) {
    const action = config.failedAction || "kick";
    let actionDesc = "espulso dal server";

    if (action === "timeout" && member.moderatable) {
      await member.timeout(3600000, `Falliti ${currentFails} tentativi di verifica Captcha`).catch(() => null);
      actionDesc = "messo in timeout per 1 ora";
    } else if (action === "ban" && member.bannable) {
      await member.ban({ reason: `Falliti ${currentFails} tentativi di verifica Captcha (Possibile Bot)` }).catch(() => null);
      actionDesc = "espulso/bannato per sicurezza";
    } else if (action === "kick" && member.kickable) {
      await member.kick(`Falliti ${currentFails} tentativi di verifica Captcha`).catch(() => null);
      actionDesc = "espulso dal server";
    }

    const defaultPunish = "Hai superato il limite di tentativi consentiti ({maxAttempts}). Sei stato {action}.";
    const punishTpl = config.punishmentMessage || defaultPunish;
    return formatPlaceholders(punishTpl, {
      maxAttempts: maxFails,
      action: actionDesc,
      user: `<@${member.id}>`,
      username: member.user.username,
      guild: guild.name
    });
  }

  const defaultFail = "Risposta non corretta! (Tentativo {attempt}/{maxAttempts}). Riprova cliccando nuovamente sul pulsante.";
  const failTpl = config.failMessage || defaultFail;
  return formatPlaceholders(failTpl, {
    attempt: currentFails,
    maxAttempts: maxFails,
    user: `<@${member.id}>`,
    username: member.user.username,
    guild: guild.name,
    reason: reason
  });
}

// Check Anti-Alt & Account Restrictions
function checkAccountEligibility(member, config, guild) {
  const minDays = parseInt(config.minAccountAgeDays) || 0;
  if (minDays > 0) {
    const ageMs = Date.now() - member.user.createdTimestamp;
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    if (ageDays < minDays) {
      const defaultMinAge = "Accesso negato: Il tuo account è troppo recente ({age} giorni). Il server richiede almeno {minDays} giorni di anzianità.";
      const reason = formatPlaceholders(config.minAgeMessage || defaultMinAge, {
        age: ageDays,
        minDays: minDays,
        user: `<@${member.id}>`,
        username: member.user.username,
        guild: guild?.name || ""
      });
      return { eligible: false, reason };
    }
  }

  if (config.requireAvatar && !member.user.avatar) {
    const defaultAvatarMsg = "Accesso negato: Il server richiede un account con un'immagine del profilo personalizzata.";
    const reason = formatPlaceholders(config.requireAvatarMessage || defaultAvatarMsg, {
      user: `<@${member.id}>`,
      username: member.user.username,
      guild: guild?.name || ""
    });
    return { eligible: false, reason };
  }

  return { eligible: true };
}

// Handle Verification Interactions (Buttons & Modals)
async function handleVerificationInteraction(interaction, client, loadSettingsFn, saveSettingsFn) {
  if (!interaction.isButton() && !interaction.isModalSubmit()) return;

  const customId = interaction.customId;
  const guild = interaction.guild;
  if (!guild) return;

  const settings = typeof loadSettingsFn === 'function' ? loadSettingsFn() : {};
  const config = settings[guild.id]?.verification || {};

  // 1. CLICK START VERIFICATION
  if (customId === "roomup_verify_start") {
    if (config.enabled === false) {
      const defaultDisabled = "⚠️ Il sistema di verifica è temporaneamente disattivato dall'amministratore.";
      const disabledMsg = formatPlaceholders(config.disabledMessage || defaultDisabled, {
        user: `<@${interaction.member.id}>`,
        username: interaction.user.username,
        guild: guild.name
      });
      return interaction.reply({ content: disabledMsg, flags: MessageFlags.Ephemeral }).catch(() => {});
    }

    const targetVerifiedRoleId = config.roleToAddId || config.verifiedRoleId;
    const member = await guild.members.fetch(interaction.member.id).catch(() => interaction.member);
    if (targetVerifiedRoleId && member.roles.cache.has(targetVerifiedRoleId)) {
      const defaultAlready = "✅ Sei già verificato in questo server!";
      const alreadyMsg = formatPlaceholders(config.alreadyVerifiedMessage || defaultAlready, {
        user: `<@${member.id}>`,
        username: interaction.user.username,
        guild: guild.name
      });
      return interaction.reply({ content: alreadyMsg, flags: MessageFlags.Ephemeral }).catch(() => {});
    }

    // Check Anti-Alt Security
    const eligibility = checkAccountEligibility(interaction.member, config, guild);
    if (!eligibility.eligible) {
      recordVerificationEvent(guild.id, interaction.user, config.mode, "failed", eligibility.reason, loadSettingsFn, saveSettingsFn);
      return interaction.reply({ content: eligibility.reason, flags: MessageFlags.Ephemeral }).catch(() => {});
    }

    const mode = config.mode || "code";

    // Mode: 1-Click
    if (mode === "button") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});
      const res = await completeVerification(interaction.member, config, guild, "Verifica 1-Click", loadSettingsFn, saveSettingsFn);
      const msg = formatSuccessMessage(config.successMessage, interaction.member, guild, res.rolesAdded);
      return interaction.editReply({ content: msg }).catch(() => {});
    }

    // Mode: Code Modal
    if (mode === "code") {
      const code = generateRandomCode(5);
      activePuzzles.set(`${guild.id}:${interaction.user.id}`, {
        type: "code",
        answer: code.toUpperCase(),
        expiresAt: Date.now() + 300000,
        startedAt: Date.now()
      });

      const modalTitleTpl = config.modalCodeTitle || "Codice di Verifica: [ {code} ]";
      const modalLabelTpl = config.modalCodeLabel || "Riscrivi esattamente il codice: {code}";
      const modalTitle = formatPlaceholders(modalTitleTpl, { code }).slice(0, 45);
      const modalLabel = formatPlaceholders(modalLabelTpl, { code }).slice(0, 45);

      const modal = new ModalBuilder()
        .setCustomId("roomup_verify_modal_code")
        .setTitle(modalTitle);

      const input = new TextInputBuilder()
        .setCustomId("verify_input_code")
        .setLabel(modalLabel)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(`Es. ${code}`)
        .setMinLength(5)
        .setMaxLength(5)
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);
      return interaction.showModal(modal).catch(() => {});
    }

    // Mode: Math Puzzle Modal
    if (mode === "math") {
      const num1 = Math.floor(Math.random() * 15) + 1;
      const num2 = Math.floor(Math.random() * 15) + 1;
      const answer = (num1 + num2).toString();

      activePuzzles.set(`${guild.id}:${interaction.user.id}`, {
        type: "math",
        answer: answer,
        expiresAt: Date.now() + 300000,
        startedAt: Date.now()
      });

      const mathTitleTpl = config.modalMathTitle || "Risolvi: {num1} + {num2} = ?";
      const mathLabelTpl = config.modalMathLabel || "Quanto fa {num1} + {num2}?";
      const modalTitle = formatPlaceholders(mathTitleTpl, { num1, num2 }).slice(0, 45);
      const modalLabel = formatPlaceholders(mathLabelTpl, { num1, num2 }).slice(0, 45);

      const modal = new ModalBuilder()
        .setCustomId("roomup_verify_modal_math")
        .setTitle(modalTitle);

      const input = new TextInputBuilder()
        .setCustomId("verify_input_math")
        .setLabel(modalLabel)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Inserisci il numero")
        .setMinLength(1)
        .setMaxLength(3)
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);
      return interaction.showModal(modal).catch(() => {});
    }

    // Mode: Emoji Puzzle
    if (mode === "emoji") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});

      const shuffled = [...EMOJI_OPTIONS].sort(() => 0.5 - Math.random());
      const selectedFive = shuffled.slice(0, 5);
      const target = selectedFive[Math.floor(Math.random() * selectedFive.length)];

      activePuzzles.set(`${guild.id}:${interaction.user.id}`, {
        type: "emoji",
        answer: target.symbol,
        expiresAt: Date.now() + 300000,
        startedAt: Date.now()
      });

      const btnRow = new ActionRowBuilder();
      selectedFive.forEach((e, idx) => {
        btnRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`roomup_verify_emoji_${idx}_${e.symbol}`)
            .setLabel(e.name)
            .setEmoji(e.symbol)
            .setStyle(ButtonStyle.Secondary)
        );
      });

      const emojiPromptTpl = config.emojiPromptMessage || "Seleziona l'icona corretta tra i pulsanti:\n\nTrova: **{symbol} ({name})**";
      const promptContent = formatPlaceholders(emojiPromptTpl, {
        symbol: target.symbol,
        name: target.name,
        user: `<@${interaction.user.id}>`
      });

      return interaction.editReply({
        content: promptContent,
        components: [btnRow]
      }).catch(() => {});
    }
  }

  // 2. MODAL SUBMIT (CODE OR MATH)
  if (customId === "roomup_verify_modal_code" || customId === "roomup_verify_modal_math") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});

    const key = `${guild.id}:${interaction.user.id}`;
    const puzzle = activePuzzles.get(key);

    const userInput = (interaction.fields.getTextInputValue(customId === "roomup_verify_modal_code" ? "verify_input_code" : "verify_input_math") || "").trim();

    if (puzzle && userInput.toUpperCase() !== puzzle.answer.toUpperCase()) {
      const failMsg = await handleVerificationFailure(interaction.member, config, guild, puzzle.type, "Codice o calcolo errato", loadSettingsFn, saveSettingsFn);
      return interaction.editReply({ content: failMsg }).catch(() => {});
    }

    activePuzzles.delete(key);
    const res = await completeVerification(interaction.member, config, guild, puzzle ? `Superato Captcha ${puzzle.type}` : "Verifica completata", loadSettingsFn, saveSettingsFn);
    const msg = formatSuccessMessage(config.successMessage, interaction.member, guild, res.rolesAdded);
    return interaction.editReply({ content: msg }).catch(() => {});
  }

  // 3. EMOJI BUTTON CLICK
  if (customId.startsWith("roomup_verify_emoji_")) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});

    const key = `${guild.id}:${interaction.user.id}`;
    const puzzle = activePuzzles.get(key);

    if (!puzzle || Date.now() > puzzle.expiresAt) {
      const defaultExpired = "La sessione di verifica è scaduta. Riprova cliccando nuovamente sul pulsante.";
      const expiredMsg = formatPlaceholders(config.sessionExpiredMessage || defaultExpired, {
        user: `<@${interaction.user.id}>`,
        guild: guild.name
      });
      return interaction.editReply({ content: expiredMsg }).catch(() => {});
    }

    const clickedEmoji = customId.split("_").pop();

    if (clickedEmoji !== puzzle.answer) {
      activePuzzles.delete(key);
      const failMsg = await handleVerificationFailure(interaction.member, config, guild, "emoji", "Emoji errata", loadSettingsFn, saveSettingsFn);
      return interaction.editReply({ content: failMsg }).catch(() => {});
    }

    activePuzzles.delete(key);
    const res = await completeVerification(interaction.member, config, guild, "Superato Captcha Emoji", loadSettingsFn, saveSettingsFn);
    const msg = formatSuccessMessage(config.successMessage, interaction.member, guild, res.rolesAdded);
    return interaction.editReply({ content: msg }).catch(() => {});
  }
}

// Handle New Member Join (Individual User Isolation & Timers)
async function handleMemberJoinVerification(member, client, loadSettingsFn) {
  if (!member || !member.guild || member.user.bot) return;

  const guild = member.guild;
  const settings = typeof loadSettingsFn === 'function' ? loadSettingsFn() : {};

  // Controllo prioritario: Se l'utente è registrato come BANNATO, ripristina all'istante l'isolamento da ban
  if (isUserBanned(guild.id, member.id)) {
    console.log(`[Verification] ⚠️ Utente BANNATO rientrato nel server: ${member.user.tag} (${member.id}). Ripristino isolamento ban.`);
    const bannedInfo = getBannedUserInfo(guild.id, member.id);
    await applyBanIsolation(member, bannedInfo?.reason || "Rientro utente bannato", null);
    return;
  }

  const config = settings[guild.id]?.verification || {};

  if (config.enabled === false) return;

  console.log(`[Verification] guildMemberAdd per ${member.user.tag} (${member.id}) nel server ${guild.name}. isolateMemberOnJoin=${config.isolateMemberOnJoin}`);

  // 1. Auto-assign Unverified Role (if configured)
  const targetJoinUnverifiedRoleId = config.unverifiedRoleId || config.roleToRemoveId;
  if (targetJoinUnverifiedRoleId) {
    const unverifiedRole = guild.roles.cache.get(targetJoinUnverifiedRoleId) || await guild.roles.fetch(targetJoinUnverifiedRoleId).catch(() => null);
    if (unverifiedRole) {
      await member.roles.add(unverifiedRole).catch((e) => console.error("[Verification] Errore aggiunta ruolo non verificato on join:", e.message));
    }
  }

  // 2. Individual User Channel Isolation (ZERO touch on @everyone!)
  const shouldIsolate = config.isolateMemberOnJoin !== false && Boolean(config.channelId);
  if (shouldIsolate) {
    try {
      await isolateMember(member, config);
      console.log(`[Verification] ISOLAMENTO MEMBRO COMPLETATO per ${member.user.tag}.`);
    } catch (err) {
      console.error("[Verification] Errore isolamento on join:", err.message);
    }
  }

  // 3. Kick Unverified After Timeout
  const timeoutMins = parseInt(config.unverifiedTimeoutMinutes) || 0;
  if (timeoutMins > 0) {
    const timeoutMs = timeoutMins * 60 * 1000;
    const timerKey = `${guild.id}:${member.id}`;

    const handle = setTimeout(async () => {
      try {
        const freshMember = await guild.members.fetch(member.id).catch(() => null);
        if (freshMember) {
          const targetVerId = config.roleToAddId || config.verifiedRoleId;
          const isVerified = targetVerId && freshMember.roles.cache.has(targetVerId);
          if (!isVerified && freshMember.kickable) {
            console.log(`[Verification] Auto-kick per timeout (${timeoutMins}m): ${freshMember.user.tag}`);
            await freshMember.kick(`Timeout verifica scaduto (${timeoutMins} minuti)`).catch(() => null);
          }
        }
      } catch (err) {}
    }, timeoutMs);

    unverifiedTimers.set(timerKey, handle);
  }
}

async function ensureVerificationChannelHidden(guild, config) {
  try {
    if (!guild || !config || !config.channelId) return;
    const targetRoleId = config.roleToAddId || config.verifiedRoleId;
    if (!targetRoleId) return;

    const channel = await guild.channels.fetch(config.channelId).catch(() => null);
    if (!channel || channel.isThread()) return;

    const role = guild.roles.cache.get(targetRoleId) || await guild.roles.fetch(targetRoleId).catch(() => null);
    if (!role) return;

    const currentOw = channel.permissionOverwrites.cache.get(role.id);
    const isAlreadyDenied = currentOw && currentOw.deny.has(PermissionFlagsBits.ViewChannel);

    if (!isAlreadyDenied) {
      await channel.permissionOverwrites.edit(role.id, {
        ViewChannel: false
      }, { reason: "Canale verifica nascosto per il ruolo verificato" });
      console.log(`[Verification] Canale #${channel.name} (${channel.id}) nascosto con successo per il ruolo @${role.name}`);
    }

    if (channel.parentId) {
      const category = await guild.channels.fetch(channel.parentId).catch(() => null);
      if (category && category.type === ChannelType.GuildCategory) {
        const catOw = category.permissionOverwrites.cache.get(role.id);
        const catDenied = catOw && catOw.deny.has(PermissionFlagsBits.ViewChannel);
        if (!catDenied) {
          await category.permissionOverwrites.edit(role.id, {
            ViewChannel: false
          }, { reason: "Categoria verifica nascosta per il ruolo verificato" }).catch(() => null);
        }
      }
    }
  } catch (err) {
    console.error("[Verification] Errore configurazione nascondi canale verifica:", err.message);
  }
}

function initVerificationEngine(client, loadSettingsFn, saveSettingsFn) {
  client.on("interactionCreate", (interaction) => {
    handleVerificationInteraction(interaction, client, loadSettingsFn, saveSettingsFn);
  });

  client.on("guildMemberAdd", (member) => {
    handleMemberJoinVerification(member, client, loadSettingsFn);
  });

  async function syncAllVerifyChannels() {
    try {
      const settings = typeof loadSettingsFn === "function" ? loadSettingsFn() : {};
      for (const [guildId, gConfig] of Object.entries(settings)) {
        if (gConfig?.verification?.enabled && gConfig.verification.channelId) {
          const guild = client.guilds?.cache?.get(guildId) || (typeof client.guilds?.fetch === 'function' ? await client.guilds.fetch(guildId).catch(() => null) : null);
          if (guild) {
            await ensureVerificationChannelHidden(guild, gConfig.verification);
            if (gConfig.verification.hideAllChannelsUntilVerified && gConfig.verification.verifiedRoleId) {
              await applyChannelIsolation(guild, gConfig.verification).catch(err => {
                console.error(`[Verification] Errore auto-isolamento per ${guild.name}:`, err.message);
              });
            }
          }
        }
      }
    } catch (e) {
      console.error("[Verification] Errore sync canali verifica all'avvio:", e.message);
    }
  }

  if (client.isReady()) {
    syncAllVerifyChannels();
  } else {
    client.once("clientReady", syncAllVerifyChannels);
  }

  console.log("[VerificationEngine] Suite di Verifica Definitiva attiva!");
}

module.exports = {
  initVerificationEngine,
  deployVerificationPanel,
  sendVerificationPanel: deployVerificationPanel,
  isolateMember,
  unisolateMember,
  applyChannelIsolation,
  resetChannelIsolation,
  autoSetupChannelPermissions,
  ensureVerificationChannelHidden,
  createSingleRole,
  handleVerificationInteraction,
  handleMemberJoinVerification,
  completeVerification
};
