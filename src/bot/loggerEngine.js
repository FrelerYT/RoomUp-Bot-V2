const {
  EmbedBuilder,
  AuditLogEvent,
  ChannelType,
  PermissionFlagsBits,
  Events
} = require("discord.js");

const EVENT_CATEGORIES = {
  // Canali (#🏠・canali)
  channelCreate: "channels",
  channelDelete: "channels",
  channelUpdate: "channels",
  channelPinsUpdate: "channels",
  channelOverwriteCreate: "channels",
  channelOverwriteUpdate: "channels",
  channelOverwriteDelete: "channels",
  
  // Membri & Utenti (#🧑‍🤝‍🧑・membri & #〽️・uscite-entrate)
  memberJoin: "members",
  memberLeave: "members",
  memberKick: "moderation",
  memberTimeout: "members",
  memberTimeoutRemove: "members",
  memberNickUpdate: "members",
  memberVerify: "members",
  memberPrune: "moderation",
  userUpdate: "members",
  botAdd: "members",
  
  // Ruoli (#🧢・ruoli)
  roleCreate: "roles",
  roleDelete: "roles",
  roleUpdate: "roles",
  memberRoleAdd: "roles",
  memberRoleRemove: "roles",
  
  // Messaggi (#💬・messaggi)
  messageCreate: "messages",
  messageDelete: "messages",
  messageDeleteBulk: "messages",
  messageUpdate: "messages",
  messagePin: "messages",
  messageUnpin: "messages",
  messageReactionRemoveAll: "messages",
  
  // Vocali (#🔊・vocali)
  voiceJoin: "voice",
  voiceLeave: "voice",
  voiceSwitch: "voice",
  voiceMuteDeaf: "voice",
  voiceStream: "voice",
  voiceVideo: "voice",
  voiceMove: "voice",
  voiceDisconnect: "voice",
  voiceChannelStatusCreate: "voice",
  voiceChannelStatusDelete: "voice",

  // Moderazione & Disciplinare (#🛅・moderazione)
  banAdd: "moderation",
  banRemove: "moderation",

  // AutoMod (#🎭・automod)
  autoModAction: "automod",
  autoModActionExecution: "automod",
  autoModRuleCreate: "automod",
  autoModRuleDelete: "automod",
  autoModRuleUpdate: "automod",

  // Server & Altro (#🗄️・altro)
  serverUpdate: "server",
  inviteCreate: "server",
  inviteUpdate: "server",
  inviteDelete: "server",
  emojiCreate: "server",
  emojiDelete: "server",
  emojiUpdate: "server",
  stickerCreate: "server",
  stickerDelete: "server",
  stickerUpdate: "server",
  threadCreate: "server",
  threadDelete: "server",
  threadUpdate: "server",
  stageInstanceCreate: "server",
  stageInstanceDelete: "server",
  stageInstanceUpdate: "server",
  scheduledEventCreate: "server",
  scheduledEventDelete: "server",
  scheduledEventUpdate: "server",
  scheduledEventUserAdd: "server",
  scheduledEventUserRemove: "server",
  webhookCreate: "server",
  webhookUpdate: "server",
  webhookDelete: "server",
  webhooksUpdate: "server",
  integrationCreate: "server",
  integrationUpdate: "server",
  integrationDelete: "server",
  integrationsUpdate: "server",
  soundboardSoundCreate: "server",
  soundboardSoundUpdate: "server",
  soundboardSoundDelete: "server",
  onboardingCreate: "server",
  onboardingUpdate: "server",
  onboardingPromptCreate: "server",
  onboardingPromptUpdate: "server",
  onboardingPromptDelete: "server",
  homeSettingsCreate: "server",
  homeSettingsUpdate: "server"
};

const guildInvites = new Map();
const dispatchedAuditKeys = new Map();

function markDispatched(type, targetId) {
  const key = `${type}:${targetId || ""}`;
  dispatchedAuditKeys.set(key, Date.now());
}

function wasRecentlyDispatched(type, targetId) {
  const key = `${type}:${targetId || ""}`;
  const ts = dispatchedAuditKeys.get(key);
  if (!ts) return false;
  if (Date.now() - ts < 15000) return true;
  dispatchedAuditKeys.delete(key);
  return false;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of dispatchedAuditKeys.entries()) {
    if (now - v > 30000) dispatchedAuditKeys.delete(k);
  }
}, 30000).unref?.();

const AUDIT_ACTION_LABELS = {
  GuildUpdate: "Impostazioni Server Modificate",
  ChannelCreate: "Canale Creato",
  ChannelUpdate: "Canale Modificato",
  ChannelDelete: "Canale Eliminato",
  ChannelOverwriteCreate: "Permessi Canale Aggiunti",
  ChannelOverwriteUpdate: "Permessi Canale Modificati",
  ChannelOverwriteDelete: "Permessi Canale Rimossi",
  MemberKick: "Membro Espulso",
  MemberPrune: "Pulizia Membri Inattivi (Prune)",
  MemberBanAdd: "Membro Bannato",
  MemberBanRemove: "Membro Sbannato",
  MemberUpdate: "Membro Aggiornato",
  MemberRoleUpdate: "Ruoli Membro Aggiornati",
  MemberMove: "Membro Spostato di Stanza",
  MemberDisconnect: "Membro Disconnesso da Vocale",
  BotAdd: "Bot Aggiunto al Server",
  RoleCreate: "Ruolo Creato",
  RoleUpdate: "Ruolo Modificato",
  RoleDelete: "Ruolo Eliminato",
  InviteCreate: "Invito Creato",
  InviteUpdate: "Invito Modificato",
  InviteDelete: "Invito Rimosso",
  WebhookCreate: "Webhook Creato",
  WebhookUpdate: "Webhook Modificato",
  WebhookDelete: "Webhook Eliminato",
  EmojiCreate: "Emoji Creata",
  EmojiUpdate: "Emoji Modificata",
  EmojiDelete: "Emoji Eliminata",
  MessageDelete: "Messaggio Eliminato",
  MessageBulkDelete: "Eliminazione Massiva Messaggi",
  MessagePin: "Messaggio Fissato in Alto",
  MessageUnpin: "Messaggio Rimosso dai Fissati",
  IntegrationCreate: "Integrazione Creata",
  IntegrationUpdate: "Integrazione Modificata",
  IntegrationDelete: "Integrazione Eliminata",
  StageInstanceCreate: "Palco Avviato",
  StageInstanceUpdate: "Palco Modificato",
  StageInstanceDelete: "Palco Terminato",
  StickerCreate: "Adesivo Creato",
  StickerUpdate: "Adesivo Modificato",
  StickerDelete: "Adesivo Eliminato",
  GuildScheduledEventCreate: "Evento Programmato Creato",
  GuildScheduledEventUpdate: "Evento Programmato Modificato",
  GuildScheduledEventDelete: "Evento Programmato Cancellato",
  ThreadCreate: "Thread Creato",
  ThreadUpdate: "Thread Modificato",
  ThreadDelete: "Thread Eliminato",
  ApplicationCommandPermissionUpdate: "Permessi Comandi Applicazione Modificati",
  SoundboardSoundCreate: "Suono Soundboard Aggiunto",
  SoundboardSoundUpdate: "Suono Soundboard Modificato",
  SoundboardSoundDelete: "Suono Soundboard Rimosso",
  AutoModerationRuleCreate: "Regola AutoMod Creata",
  AutoModerationRuleUpdate: "Regola AutoMod Modificata",
  AutoModerationRuleDelete: "Regola AutoMod Eliminata",
  AutoModerationBlockMessage: "Messaggio Bloccato da AutoMod",
  AutoModerationFlagToChannel: "Segnalazione Inviata da AutoMod",
  AutoModerationUserCommunicationDisabled: "Timeout Applicato da AutoMod",
  AutoModerationQuarantineUser: "Utente Messo in Quarantena da AutoMod",
  CreatorMonetizationRequestCreated: "Richiesta Monetizzazione Inviata",
  CreatorMonetizationTermsAccepted: "Termini Monetizzazione Accettati",
  OnboardingPromptCreate: "Domanda Benvenuto (Onboarding) Creata",
  OnboardingPromptUpdate: "Domanda Benvenuto (Onboarding) Modificata",
  OnboardingPromptDelete: "Domanda Benvenuto (Onboarding) Eliminata",
  OnboardingCreate: "Configurazione Onboarding Creata",
  OnboardingUpdate: "Configurazione Onboarding Aggiornata",
  GuildHomeFeatureItem: "Elemento Guida Server in Evidenza Aggiunto",
  GuildHomeRemoveItem: "Elemento Guida Server Rimosso da Evidenza",
  HomeSettingsCreate: "Guida del Server Creata",
  HomeSettingsUpdate: "Guida del Server / Home Aggiornata",
  VoiceChannelStatusCreate: "Stato Canale Vocale Impostato",
  VoiceChannelStatusDelete: "Stato Canale Vocale Rimosso",
  GuildScheduledEventExceptionCreate: "Eccezione Evento Programmato Creata",
  GuildScheduledEventExceptionUpdate: "Eccezione Evento Programmato Modificata",
  GuildScheduledEventExceptionDelete: "Eccezione Evento Programmato Rimossa",
  GuildMemberVerificationUpdate: "Modulo Verifica Membri Aggiornato",
  GuildProfileUpdate: "Profilo Server (Caratteristiche / Tag) Aggiornato",
  GuildMigratePinPermission: "Permessi Messaggi Fissati Aggiornati",
  GuildMigrateBypassSlowmodePermission: "Permessi Bypass Slowmode Aggiornati"
};

const AUDIT_ACTION_CATEGORY = {
  GuildUpdate: "server",
  ChannelCreate: "channels",
  ChannelUpdate: "channels",
  ChannelDelete: "channels",
  ChannelOverwriteCreate: "channels",
  ChannelOverwriteUpdate: "channels",
  ChannelOverwriteDelete: "channels",
  MemberKick: "moderation",
  MemberPrune: "moderation",
  MemberBanAdd: "moderation",
  MemberBanRemove: "moderation",
  MemberUpdate: "members",
  MemberRoleUpdate: "roles",
  MemberMove: "voice",
  MemberDisconnect: "voice",
  BotAdd: "members",
  RoleCreate: "roles",
  RoleUpdate: "roles",
  RoleDelete: "roles",
  InviteCreate: "server",
  InviteUpdate: "server",
  InviteDelete: "server",
  WebhookCreate: "server",
  WebhookUpdate: "server",
  WebhookDelete: "server",
  EmojiCreate: "server",
  EmojiUpdate: "server",
  EmojiDelete: "server",
  MessageDelete: "messages",
  MessageBulkDelete: "messages",
  MessagePin: "messages",
  MessageUnpin: "messages",
  IntegrationCreate: "server",
  IntegrationUpdate: "server",
  IntegrationDelete: "server",
  StageInstanceCreate: "server",
  StageInstanceUpdate: "server",
  StageInstanceDelete: "server",
  StickerCreate: "server",
  StickerUpdate: "server",
  StickerDelete: "server",
  GuildScheduledEventCreate: "server",
  GuildScheduledEventUpdate: "server",
  GuildScheduledEventDelete: "server",
  ThreadCreate: "server",
  ThreadUpdate: "server",
  ThreadDelete: "server",
  ApplicationCommandPermissionUpdate: "server",
  SoundboardSoundCreate: "server",
  SoundboardSoundUpdate: "server",
  SoundboardSoundDelete: "server",
  AutoModerationRuleCreate: "automod",
  AutoModerationRuleUpdate: "automod",
  AutoModerationRuleDelete: "automod",
  AutoModerationBlockMessage: "automod",
  AutoModerationFlagToChannel: "automod",
  AutoModerationUserCommunicationDisabled: "automod",
  AutoModerationQuarantineUser: "automod",
  CreatorMonetizationRequestCreated: "server",
  CreatorMonetizationTermsAccepted: "server",
  OnboardingPromptCreate: "server",
  OnboardingPromptUpdate: "server",
  OnboardingPromptDelete: "server",
  OnboardingCreate: "server",
  OnboardingUpdate: "server",
  GuildHomeFeatureItem: "server",
  GuildHomeRemoveItem: "server",
  HomeSettingsCreate: "server",
  HomeSettingsUpdate: "server",
  VoiceChannelStatusCreate: "voice",
  VoiceChannelStatusDelete: "voice",
  GuildScheduledEventExceptionCreate: "server",
  GuildScheduledEventExceptionUpdate: "server",
  GuildScheduledEventExceptionDelete: "server",
  GuildMemberVerificationUpdate: "server",
  GuildProfileUpdate: "server",
  GuildMigratePinPermission: "server",
  GuildMigrateBypassSlowmodePermission: "server"
};

function formatTimeAgo(timestamp) {
  if (!timestamp) return "Sconosciuto";
  const ts = typeof timestamp === "number" ? timestamp : new Date(timestamp).getTime();
  if (isNaN(ts) || ts <= 0) return "Sconosciuto";

  const diffMs = Math.max(0, Date.now() - ts);
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years >= 1) {
    return years === 1 ? "1 anno fa" : `${years} anni fa`;
  }
  if (months >= 1) {
    return months === 1 ? "1 mese fa" : `${months} mesi fa`;
  }
  if (days >= 1) {
    return days === 1 ? "1 giorno fa" : `${days} giorni fa`;
  }
  if (hours >= 1) {
    return hours === 1 ? "1 ora fa" : `${hours} ore fa`;
  }
  if (minutes >= 1) {
    return minutes === 1 ? "1 minuto fa" : `${minutes} minuti fa`;
  }
  return "Pochi secondi fa";
}

function formatFooterDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const d = pad(date.getDate());
  const m = pad(date.getMonth() + 1);
  const y = date.getFullYear();
  const hr = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${d}/${m}/${y} ${hr}:${min}`;
}

function buildMemberJoinPayload(member, usedInvite = null, date = new Date()) {
  const inviterText = usedInvite && usedInvite.inviter
    ? `<@${usedInvite.inviter.id}> ( \`${usedInvite.code}\` )`
    : (usedInvite?.code ? `( \`${usedInvite.code}\` )` : "*Sconosciuto / Invito Diretto*");

  const createdTime = member.user?.createdTimestamp || member.user?.createdAt?.getTime?.();
  const accountCreated = formatTimeAgo(createdTime);
  const memberCount = member.guild?.memberCount || 1;

  const description = [
    `> **Utente:** <@${member.id}>`,
    `> **ID Utente:** \`${member.id}\``,
    `> **Invitato da:** ${inviterText}`,
    `> **Account Creato:** \`${accountCreated}\``,
    `> **Membri Totali:** ${memberCount}`
  ].join("\n");

  const avatarUrl = member.user?.displayAvatarURL?.({ dynamic: true, size: 256 })
    || member.displayAvatarURL?.({ dynamic: true, size: 256 });

  const embed = new EmbedBuilder()
    .setTitle("📥 Utente Entrato")
    .setColor("#57F287")
    .setDescription(description);

  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  const tagOrName = member.user?.discriminator && member.user.discriminator !== "0"
    ? member.user.tag
    : (member.user?.username || member.displayName || "Utente");

  embed.setFooter({
    text: `@${tagOrName} • ${formatFooterDate(date)}`,
    iconURL: avatarUrl || undefined
  });

  return {
    content: `<@${member.id}>`,
    embeds: [embed]
  };
}

function buildMemberLeavePayload(member, modAction = null, date = new Date()) {
  const joinedTime = member.joinedTimestamp || member.joinedAt?.getTime?.();
  const stayText = joinedTime ? formatTimeAgo(joinedTime) : "Sconosciuto";
  const memberCount = member.guild?.memberCount || 1;

  let reasonText = "Uscito Spontaneamente";
  if (modAction?.type === "ban") {
    reasonText = modAction.executor ? `**Bannato da:** <@${modAction.executor.id}>` : "**Bannato dal Server**";
  } else if (modAction?.type === "kick") {
    reasonText = modAction.executor ? `**Espulso da:** <@${modAction.executor.id}>` : "**Espulso dal Server**";
  }

  const description = [
    `> **Utente:** <@${member.id}>`,
    `> **ID Utente:** \`${member.id}\``,
    `> **Entrato nel Server:** \`${stayText}\``,
    `> **Membri Totali:** ${memberCount}`,
    `> ${reasonText}`
  ].join("\n");

  const avatarUrl = member.user?.displayAvatarURL?.({ dynamic: true, size: 256 })
    || member.displayAvatarURL?.({ dynamic: true, size: 256 });

  const embed = new EmbedBuilder()
    .setTitle("📤 Utente Uscito")
    .setColor("#ED4245")
    .setDescription(description);

  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  const tagOrName = member.user?.discriminator && member.user.discriminator !== "0"
    ? member.user.tag
    : (member.user?.username || member.displayName || "Utente");

  embed.setFooter({
    text: `@${tagOrName} • ${formatFooterDate(date)}`,
    iconURL: avatarUrl || undefined
  });

  return {
    embeds: [embed]
  };
}

async function dispatchMemberJoinLog(guild, member, usedInvite = null, targetChannel = null, settings = null) {
  const channel = targetChannel || getLogChannel(guild, "memberJoin", settings);
  if (!channel || !channel.isTextBased()) return null;

  const payload = buildMemberJoinPayload(member, usedInvite);
  return await channel.send(payload);
}

async function dispatchMemberLeaveLog(guild, member, modAction = null, targetChannel = null, settings = null) {
  const channel = targetChannel || getLogChannel(guild, "memberLeave", settings);
  if (!channel || !channel.isTextBased()) return null;

  const payload = buildMemberLeavePayload(member, modAction);
  return await channel.send(payload);
}

async function cacheGuildInvites(guild) {
  try {
    if (!guild?.invites?.fetch) return;
    const invites = await guild.invites.fetch().catch(() => null);
    if (!invites) return;
    const codeMap = new Map();
    invites.forEach((inv) => {
      codeMap.set(inv.code, {
        code: inv.code,
        uses: inv.uses || 0,
        inviter: inv.inviter || null
      });
    });
    guildInvites.set(guild.id, codeMap);
  } catch (e) {}
}

async function findUsedInvite(member) {
  try {
    if (!member?.guild?.invites?.fetch) return null;
    const cachedMap = guildInvites.get(member.guild.id);
    const freshInvites = await member.guild.invites.fetch().catch(() => null);
    if (!freshInvites) return null;

    let found = null;
    if (cachedMap) {
      for (const [code, freshInv] of freshInvites) {
        const cached = cachedMap.get(code);
        if (cached && (freshInv.uses || 0) > (cached.uses || 0)) {
          found = freshInv;
          break;
        }
      }
    }

    const updatedMap = new Map();
    freshInvites.forEach((inv) => {
      updatedMap.set(inv.code, {
        code: inv.code,
        uses: inv.uses || 0,
        inviter: inv.inviter || null
      });
    });
    guildInvites.set(member.guild.id, updatedMap);

    return found;
  } catch (err) {
    return null;
  }
}

function formatChannelType(type) {
  switch (type) {
    case ChannelType.GuildText:
      return "Canale Testuale";
    case ChannelType.GuildVoice:
      return "Stanza Vocale";
    case ChannelType.GuildCategory:
      return "Categoria";
    case ChannelType.GuildAnnouncement:
      return "Canale Annunci";
    case ChannelType.GuildStageVoice:
      return "Palco Vocale (Stage)";
    case ChannelType.GuildForum:
      return "Forum";
    case ChannelType.PublicThread:
    case ChannelType.PrivateThread:
    case ChannelType.AnnouncementThread:
      return "Thread";
    default:
      return "Canale Testuale";
  }
}

function buildChannelCreatePayload(channel, executor = null) {
  const channelMention = `<#${channel.id}>`;
  const typeText = formatChannelType(channel.type);
  const modText = executor ? `<@${executor.id}>` : "Non disponibile";

  const prefix = channel.type === ChannelType.GuildVoice ? "🔊 " : (channel.type === ChannelType.GuildCategory ? "📁 " : "#");

  const description = [
    `> **Canale:** ${channelMention}`,
    `> **Tipo:** ${typeText}`,
    `> **Moderatore:** ${modText}`,
    "",
    "**Nuovo Canale**",
    "```diff",
    `+ ${prefix}${channel.name}`,
    "```"
  ].join("\n");

  const avatarUrl = executor?.displayAvatarURL?.({ dynamic: true, size: 256 })
    || channel.guild?.iconURL?.({ dynamic: true, size: 256 });

  const embed = new EmbedBuilder()
    .setTitle("➕ Canale Creato")
    .setColor("#57F287")
    .setDescription(description);

  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  const modName = executor?.discriminator && executor.discriminator !== "0"
    ? executor.tag
    : (executor?.username || channel.guild?.name || "RoomUp!");

  embed.setFooter({
    text: `@${modName} • ${formatFooterDate(channel.createdAt || new Date())}`,
    iconURL: avatarUrl || undefined
  });

  return {
    embeds: [embed]
  };
}

function buildChannelDeletePayload(channel, executor = null) {
  const typeText = formatChannelType(channel.type);
  const modText = executor ? `<@${executor.id}>` : "Non disponibile";

  const prefix = channel.type === ChannelType.GuildVoice ? "🔊 " : (channel.type === ChannelType.GuildCategory ? "📁 " : "#");

  const description = [
    `> **Tipo:** ${typeText}`,
    `> **Moderatore:** ${modText}`,
    "",
    "**Canale Rimosso**",
    "```diff",
    `- ${prefix}${channel.name}`,
    "```"
  ].join("\n");

  const avatarUrl = executor?.displayAvatarURL?.({ dynamic: true, size: 256 })
    || channel.guild?.iconURL?.({ dynamic: true, size: 256 });

  const embed = new EmbedBuilder()
    .setTitle("➖ Canale Eliminato")
    .setColor("#ED4245")
    .setDescription(description);

  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  const modName = executor?.discriminator && executor.discriminator !== "0"
    ? executor.tag
    : (executor?.username || channel.guild?.name || "RoomUp!");

  embed.setFooter({
    text: `@${modName} • ${formatFooterDate()}`,
    iconURL: avatarUrl || undefined
  });

  return {
    embeds: [embed]
  };
}

function buildChannelUpdatePayload(oldChannel, newChannel, executor = null) {
  const oldLines = [];
  const newLines = [];

  if (oldChannel.name !== newChannel.name) {
    oldLines.push(`- Nome: ${oldChannel.name}`);
    newLines.push(`+ Nome: ${newChannel.name}`);
  }
  if (oldChannel.topic !== newChannel.topic) {
    oldLines.push(`- Topic: ${oldChannel.topic || "Nessuno"}`);
    newLines.push(`+ Topic: ${newChannel.topic || "Nessuno"}`);
  }
  if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) {
    oldLines.push(`- Slowmode: ${oldChannel.rateLimitPerUser || 0}s`);
    newLines.push(`+ Slowmode: ${newChannel.rateLimitPerUser || 0}s`);
  }
  if (oldChannel.parentId !== newChannel.parentId) {
    oldLines.push(`- Categoria: ${oldChannel.parent?.name || "Nessuna"}`);
    newLines.push(`+ Categoria: ${newChannel.parent?.name || "Nessuna"}`);
  }
  if (oldChannel.bitrate !== newChannel.bitrate && (oldChannel.bitrate || newChannel.bitrate)) {
    oldLines.push(`- Bitrate: ${(oldChannel.bitrate || 0) / 1000}kbps`);
    newLines.push(`+ Bitrate: ${(newChannel.bitrate || 0) / 1000}kbps`);
  }
  if (oldChannel.userLimit !== newChannel.userLimit && (oldChannel.userLimit || newChannel.userLimit)) {
    oldLines.push(`- Limite: ${oldChannel.userLimit || "Illimitato"}`);
    newLines.push(`+ Limite: ${newChannel.userLimit || "Illimitato"}`);
  }

  if (oldLines.length === 0) {
    oldLines.push("- Nessuna modifica testuale");
    newLines.push("+ Permessi o impostazioni aggiornate");
  }

  const channelMention = `<#${newChannel.id}>`;
  const typeText = formatChannelType(newChannel.type);
  const modText = executor ? `<@${executor.id}>` : "Non disponibile";

  const description = [
    `> **Canale:** ${channelMention}`,
    `> **Tipo:** ${typeText}`,
    `> **Moderatore:** ${modText}`,
    "",
    "**Prima**",
    "```diff",
    oldLines.join("\n"),
    "```",
    "**Dopo**",
    "```diff",
    newLines.join("\n"),
    "```"
  ].join("\n");

  const avatarUrl = executor?.displayAvatarURL?.({ dynamic: true, size: 256 })
    || newChannel.guild?.iconURL?.({ dynamic: true, size: 256 });

  const embed = new EmbedBuilder()
    .setTitle("✏️ Canale Modificato")
    .setColor("#F0B232")
    .setDescription(description);

  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  const modName = executor?.discriminator && executor.discriminator !== "0"
    ? executor.tag
    : (executor?.username || newChannel.guild?.name || "RoomUp!");

  embed.setFooter({
    text: `@${modName} • ${formatFooterDate()}`,
    iconURL: avatarUrl || undefined
  });

  return {
    embeds: [embed]
  };
}

async function dispatchChannelCreateLog(guild, channel, executor = null, targetChannel = null, settings = null) {
  const ch = targetChannel || getLogChannel(guild, "channelCreate", settings);
  if (!ch || !ch.isTextBased()) return null;

  const payload = buildChannelCreatePayload(channel, executor);
  return await ch.send(payload);
}

async function dispatchChannelDeleteLog(guild, channel, executor = null, targetChannel = null, settings = null) {
  const ch = targetChannel || getLogChannel(guild, "channelDelete", settings);
  if (!ch || !ch.isTextBased()) return null;

  const payload = buildChannelDeletePayload(channel, executor);
  return await ch.send(payload);
}

async function dispatchChannelUpdateLog(guild, oldChannel, newChannel, executor = null, targetChannel = null, settings = null) {
  const ch = targetChannel || getLogChannel(guild, "channelUpdate", settings);
  if (!ch || !ch.isTextBased()) return null;

  const payload = buildChannelUpdatePayload(oldChannel, newChannel, executor);
  return await ch.send(payload);
}

function formatVoiceChannelName(channel) {
  if (!channel) return "canale-vocale";
  const raw = channel.name || "canale-vocale";
  const clean = raw.startsWith("#") ? raw.slice(1).trim() : raw;
  return clean;
}

function buildVoiceJoinPayload(member, channel, date = new Date()) {
  const user = member?.user || member;
  const username = user?.discriminator && user.discriminator !== "0"
    ? user.tag
    : (user?.username || "Utente");
  const memberMention = user?.id ? `<@${user.id}>` : (user?.username ? `@${user.username}` : "*Utente sconosciuto*");
  const avatarUrl = user?.displayAvatarURL?.({ dynamic: true, size: 256 }) || user?.defaultAvatarURL;

  const chName = formatVoiceChannelName(channel);

  const description = [
    `> **Membro:** ${memberMention}`,
    "",
    "**Stanza Vocale**",
    "```diff",
    `+ Entrato in #${chName}`,
    "```"
  ].join("\n");

  const embed = new EmbedBuilder()
    .setTitle("🔊 Utente Entrato in Vocale")
    .setColor("#57F287")
    .setDescription(description);

  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  embed.setFooter({
    text: `@${username} • ${formatFooterDate(date)}`,
    iconURL: avatarUrl || undefined
  });

  return {
    embeds: [embed]
  };
}

function buildVoiceSwitchPayload(member, oldChannel, newChannel, date = new Date()) {
  const user = member?.user || member;
  const username = user?.discriminator && user.discriminator !== "0"
    ? user.tag
    : (user?.username || "Utente");
  const memberMention = user?.id ? `<@${user.id}>` : (user?.username ? `@${user.username}` : "*Utente sconosciuto*");
  const avatarUrl = user?.displayAvatarURL?.({ dynamic: true, size: 256 }) || user?.defaultAvatarURL;

  const oldChName = formatVoiceChannelName(oldChannel);
  const newChName = formatVoiceChannelName(newChannel);

  const description = [
    `> **Membro:** ${memberMention}`,
    "",
    "**Spostamento Vocale**",
    "```diff",
    `- Da: #${oldChName}`,
    `+ A: #${newChName}`,
    "```"
  ].join("\n");

  const embed = new EmbedBuilder()
    .setTitle("🔊 Spostamento Stanza Vocale")
    .setColor("#5865F2")
    .setDescription(description);

  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  embed.setFooter({
    text: `@${username} • ${formatFooterDate(date)}`,
    iconURL: avatarUrl || undefined
  });

  return {
    embeds: [embed]
  };
}

function buildVoiceLeavePayload(member, channel, date = new Date()) {
  const user = member?.user || member;
  const username = user?.discriminator && user.discriminator !== "0"
    ? user.tag
    : (user?.username || "Utente");
  const memberMention = user?.id ? `<@${user.id}>` : (user?.username ? `@${user.username}` : "*Utente sconosciuto*");
  const avatarUrl = user?.displayAvatarURL?.({ dynamic: true, size: 256 }) || user?.defaultAvatarURL;

  const chName = formatVoiceChannelName(channel);

  const description = [
    `> **Membro:** ${memberMention}`,
    "",
    "**Stanza Vocale**",
    "```diff",
    `- Disconnesso da #${chName}`,
    "```"
  ].join("\n");

  const embed = new EmbedBuilder()
    .setTitle("🔊 Utente Uscito dalla Vocale")
    .setColor("#ED4245")
    .setDescription(description);

  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  embed.setFooter({
    text: `@${username} • ${formatFooterDate(date)}`,
    iconURL: avatarUrl || undefined
  });

  return {
    embeds: [embed]
  };
}

async function dispatchVoiceJoinLog(guild, member, channel, targetChannel = null, settings = null) {
  const ch = targetChannel || getLogChannel(guild, "voiceJoin", settings);
  if (!ch || !ch.isTextBased()) return null;

  const payload = buildVoiceJoinPayload(member, channel);
  return await ch.send(payload);
}

async function dispatchVoiceSwitchLog(guild, member, oldChannel, newChannel, targetChannel = null, settings = null) {
  const ch = targetChannel || getLogChannel(guild, "voiceSwitch", settings);
  if (!ch || !ch.isTextBased()) return null;

  const payload = buildVoiceSwitchPayload(member, oldChannel, newChannel);
  return await ch.send(payload);
}

async function dispatchVoiceLeaveLog(guild, member, channel, targetChannel = null, settings = null) {
  const ch = targetChannel || getLogChannel(guild, "voiceLeave", settings);
  if (!ch || !ch.isTextBased()) return null;

  const payload = buildVoiceLeavePayload(member, channel);
  return await ch.send(payload);
}

function buildVerificationCompletePayload(member, rolesAdded = ["@Utenti"], roleRemovedName = null, mode = "MATH", date = new Date()) {
  const user = member?.user || member;
  const username = user?.username || "Utente";
  const userId = user?.id || "0";
  const avatarUrl = user?.displayAvatarURL?.({ dynamic: true, size: 256 }) || user?.defaultAvatarURL;

  let rolesAddedStr = "Nessuno";
  if (Array.isArray(rolesAdded) && rolesAdded.length > 0) {
    rolesAddedStr = rolesAdded.map(r => typeof r === "string" ? (r.startsWith("@") ? r : `@${r}`) : `@${r.name}`).join(", ");
  } else if (typeof rolesAdded === "string" && rolesAdded.trim().length > 0) {
    rolesAddedStr = rolesAdded.startsWith("@") ? rolesAdded : `@${rolesAdded}`;
  }

  const roleRemovedStr = roleRemovedName ? (roleRemovedName.startsWith("@") ? roleRemovedName : `@${roleRemovedName}`) : "Nessuno";
  const modeStr = (mode || "MATH").toUpperCase();

  const embed = new EmbedBuilder()
    .setTitle("Verifica Completata")
    .setColor("#57F287")
    .setDescription(`L'utente **${username}** ( <@${userId}> ) ha completato la verifica.`)
    .addFields(
      { name: "Ruoli Assegnati", value: rolesAddedStr, inline: true },
      { name: "Ruolo Rimosso", value: roleRemovedStr, inline: true },
      { name: "Modalità", value: modeStr, inline: true }
    );

  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  embed.setFooter({
    text: formatFooterDate(date)
  });

  return {
    embeds: [embed]
  };
}

async function dispatchVerificationCompleteLog(guild, member, rolesAdded = ["@Utenti"], roleRemovedName = null, mode = "MATH", targetChannel = null, settings = null) {
  const ch = targetChannel || getLogChannel(guild, "memberVerify", settings);
  if (!ch || !ch.isTextBased()) return null;

  const payload = buildVerificationCompletePayload(member, rolesAdded, roleRemovedName, mode);
  return await ch.send(payload);
}

function buildMemberRoleAddPayload(member, roleOrRoles, executor = null, date = new Date()) {
  const user = member?.user || member;
  const memberMention = user?.id ? `<@${user.id}>` : (user?.username ? `@${user.username}` : "Membro");
  const modMention = executor ? `<@${executor.id}>` : "Sistema / Non specificato";

  const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];
  const roleMentions = roles.map(r => r?.id ? `<@&${r.id}>` : (typeof r === 'string' ? (r.startsWith('@') ? r : `@${r}`) : `@${r?.name || 'Ruolo'}`)).join("\n");

  const description = [
    `> **Membro:** ${memberMention}`,
    `> **Moderatore:** ${modMention}`,
    "",
    "**Ruolo Assegnato**",
    roleMentions
  ].join("\n");

  const avatarUrl = executor?.displayAvatarURL?.({ dynamic: true, size: 256 })
    || user?.displayAvatarURL?.({ dynamic: true, size: 256 })
    || user?.defaultAvatarURL;

  const embed = new EmbedBuilder()
    .setTitle("➕ Ruolo Aggiunto al Membro")
    .setColor("#FAA61A")
    .setDescription(description);

  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  const executorName = executor?.discriminator && executor.discriminator !== "0"
    ? executor.tag
    : (executor?.username || user?.username || "Moderatore");

  embed.setFooter({
    text: `@${executorName} • ${formatFooterDate(date)}`,
    iconURL: avatarUrl || undefined
  });

  return {
    embeds: [embed]
  };
}

function buildMemberRoleRemovePayload(member, roleOrRoles, executor = null, date = new Date()) {
  const user = member?.user || member;
  const memberMention = user?.id ? `<@${user.id}>` : (user?.username ? `@${user.username}` : "Membro");
  const modMention = executor ? `<@${executor.id}>` : "Sistema / Non specificato";

  const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];
  const roleMentions = roles.map(r => r?.id ? `<@&${r.id}>` : (typeof r === 'string' ? (r.startsWith('@') ? r : `@${r}`) : `@${r?.name || 'Ruolo'}`)).join("\n");

  const description = [
    `> **Membro:** ${memberMention}`,
    `> **Moderatore:** ${modMention}`,
    "",
    "**Ruolo Rimosso**",
    roleMentions
  ].join("\n");

  const avatarUrl = executor?.displayAvatarURL?.({ dynamic: true, size: 256 })
    || user?.displayAvatarURL?.({ dynamic: true, size: 256 })
    || user?.defaultAvatarURL;

  const embed = new EmbedBuilder()
    .setTitle("➖ Ruolo Rimosso dal Membro")
    .setColor("#ED4245")
    .setDescription(description);

  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  const executorName = executor?.discriminator && executor.discriminator !== "0"
    ? executor.tag
    : (executor?.username || user?.username || "Moderatore");

  embed.setFooter({
    text: `@${executorName} • ${formatFooterDate(date)}`,
    iconURL: avatarUrl || undefined
  });

  return {
    embeds: [embed]
  };
}

function buildRoleUpdatePayload(oldRole, newRole, executor = null, date = new Date()) {
  const modMention = executor ? `<@${executor.id}>` : "Sistema / Non specificato";

  let title = "🎨 Colore Ruolo Aggiornato";
  const colorChanged = oldRole?.hexColor !== newRole?.hexColor;
  const nameChanged = oldRole?.name !== newRole?.name;

  if (colorChanged && !nameChanged) {
    title = "🎨 Colore Ruolo Aggiornato";
  } else if (nameChanged && !colorChanged) {
    title = "✏️ Nome Ruolo Aggiornato";
  } else if (colorChanged && nameChanged) {
    title = "🎨 Colore Ruolo Aggiornato";
  } else {
    title = "⚙️ Ruolo Modificato";
  }

  const descriptionLines = [
    `> **Ruolo:** <@&${newRole.id}> (${newRole.name})`,
    `> **ID Ruolo:** ${newRole.id}`,
    `> **Moderatore:** ${modMention}`
  ];

  if (colorChanged) {
    descriptionLines.push(
      "",
      "**Colore Modificato**",
      "```diff",
      `- Prima: ${oldRole.hexColor}`,
      `+ Dopo: ${newRole.hexColor}`,
      "```"
    );
  }

  if (nameChanged) {
    descriptionLines.push(
      "",
      "**Nome Modificato**",
      "```diff",
      `- Prima: ${oldRole.name}`,
      `+ Dopo: ${newRole.name}`,
      "```"
    );
  }

  const embedColor = (newRole.hexColor && newRole.hexColor !== "#000000")
    ? newRole.hexColor
    : (oldRole.hexColor && oldRole.hexColor !== "#000000" ? oldRole.hexColor : "#5865F2");

  const avatarUrl = executor?.displayAvatarURL?.({ dynamic: true, size: 256 })
    || newRole.guild?.iconURL?.({ dynamic: true, size: 256 });

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(embedColor)
    .setDescription(descriptionLines.join("\n"));

  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  const executorName = executor?.discriminator && executor.discriminator !== "0"
    ? executor.tag
    : (executor?.username || "Moderatore");

  embed.setFooter({
    text: `@${executorName} • ${formatFooterDate(date)}`,
    iconURL: avatarUrl || undefined
  });

  return {
    embeds: [embed]
  };
}

function buildRoleCreatePayload(role, executor = null, date = new Date()) {
  const modMention = executor ? `<@${executor.id}>` : "Sistema / Non specificato";

  const description = [
    `> **Ruolo:** <@&${role.id}> (${role.name})`,
    `> **ID Ruolo:** ${role.id}`,
    `> **Moderatore:** ${modMention}`,
    "",
    "**Nuovo Ruolo**",
    "```diff",
    `+ ${role.name}`,
    "```"
  ].join("\n");

  const embedColor = role.hexColor && role.hexColor !== "#000000" ? role.hexColor : "#57F287";
  const avatarUrl = executor?.displayAvatarURL?.({ dynamic: true, size: 256 })
    || role.guild?.iconURL?.({ dynamic: true, size: 256 });

  const embed = new EmbedBuilder()
    .setTitle("➕ Ruolo Creato")
    .setColor(embedColor)
    .setDescription(description);

  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  const executorName = executor?.discriminator && executor.discriminator !== "0"
    ? executor.tag
    : (executor?.username || "Moderatore");

  embed.setFooter({
    text: `@${executorName} • ${formatFooterDate(date)}`,
    iconURL: avatarUrl || undefined
  });

  return {
    embeds: [embed]
  };
}

function buildRoleDeletePayload(role, executor = null, date = new Date()) {
  const modMention = executor ? `<@${executor.id}>` : "Sistema / Non specificato";

  const description = [
    `> **Nome Ruolo:** ${role.name}`,
    `> **ID Ruolo:** ${role.id}`,
    `> **Moderatore:** ${modMention}`,
    "",
    "**Ruolo Rimosso**",
    "```diff",
    `- ${role.name}`,
    "```"
  ].join("\n");

  const avatarUrl = executor?.displayAvatarURL?.({ dynamic: true, size: 256 })
    || role.guild?.iconURL?.({ dynamic: true, size: 256 });

  const embed = new EmbedBuilder()
    .setTitle("➖ Ruolo Eliminato")
    .setColor("#ED4245")
    .setDescription(description);

  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  const executorName = executor?.discriminator && executor.discriminator !== "0"
    ? executor.tag
    : (executor?.username || "Moderatore");

  embed.setFooter({
    text: `@${executorName} • ${formatFooterDate(date)}`,
    iconURL: avatarUrl || undefined
  });

  return {
    embeds: [embed]
  };
}

async function dispatchMemberRoleAddLog(guild, member, role, executor = null, targetChannel = null, settings = null) {
  const ch = targetChannel || getLogChannel(guild, "memberRoleAdd", settings) || getLogChannel(guild, "roleUpdate", settings);
  if (!ch || !ch.isTextBased()) return null;

  const payload = buildMemberRoleAddPayload(member, role, executor);
  return await ch.send(payload);
}

async function dispatchMemberRoleRemoveLog(guild, member, role, executor = null, targetChannel = null, settings = null) {
  const ch = targetChannel || getLogChannel(guild, "memberRoleRemove", settings) || getLogChannel(guild, "roleUpdate", settings);
  if (!ch || !ch.isTextBased()) return null;

  const payload = buildMemberRoleRemovePayload(member, role, executor);
  return await ch.send(payload);
}

async function dispatchRoleUpdateLog(guild, oldRole, newRole, executor = null, targetChannel = null, settings = null) {
  const ch = targetChannel || getLogChannel(guild, "roleUpdate", settings);
  if (!ch || !ch.isTextBased()) return null;

  const payload = buildRoleUpdatePayload(oldRole, newRole, executor);
  return await ch.send(payload);
}

async function dispatchRoleCreateLog(guild, role, executor = null, targetChannel = null, settings = null) {
  const ch = targetChannel || getLogChannel(guild, "roleCreate", settings);
  if (!ch || !ch.isTextBased()) return null;

  const payload = buildRoleCreatePayload(role, executor);
  return await ch.send(payload);
}

async function dispatchRoleDeleteLog(guild, role, executor = null, targetChannel = null, settings = null) {
  const ch = targetChannel || getLogChannel(guild, "roleDelete", settings);
  if (!ch || !ch.isTextBased()) return null;

  const payload = buildRoleDeletePayload(role, executor);
  return await ch.send(payload);
}

function buildInviteCreatePayload(invite, date = new Date()) {
  const channelMention = invite.channelId || invite.channel?.id
    ? `<#${invite.channelId || invite.channel.id}>`
    : (invite.channel?.name ? `#${invite.channel.name}` : "Sconosciuto");

  let expiresText = "Mai";
  if (invite.expiresTimestamp) {
    expiresText = `<t:${Math.floor(invite.expiresTimestamp / 1000)}:R>`;
  } else if (invite.maxAge && invite.maxAge > 0) {
    const unix = Math.floor((Date.now() + (invite.maxAge * 1000)) / 1000);
    expiresText = `<t:${unix}:R>`;
  }

  const maxUsesText = (!invite.maxUses || invite.maxUses === 0) ? "∞" : `${invite.maxUses}`;

  const description = [
    `> **Codice Invito:** ${invite.code}`,
    `> **Canale:** ${channelMention}`,
    `> **Scadenza Invito:** ${expiresText}`,
    `> **Usi Massimi:** ${maxUsesText}`
  ].join("\n");

  const inviter = invite.inviter;
  const avatarUrl = inviter?.displayAvatarURL?.({ dynamic: true, size: 256 })
    || inviter?.defaultAvatarURL
    || invite.guild?.iconURL?.({ dynamic: true, size: 256 });

  const embed = new EmbedBuilder()
    .setTitle("📨 Invito Creato")
    .setColor("#57F287")
    .setDescription(description);

  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  const inviterName = inviter?.discriminator && inviter.discriminator !== "0"
    ? inviter.tag
    : (inviter?.username || "Utente");

  embed.setFooter({
    text: `@${inviterName} • ${formatFooterDate(date)}`,
    iconURL: avatarUrl || undefined
  });

  return {
    embeds: [embed]
  };
}

function buildInviteDeletePayload(invite, date = new Date()) {
  const channelMention = invite.channelId || invite.channel?.id
    ? `<#${invite.channelId || invite.channel.id}>`
    : (invite.channel?.name ? `#${invite.channel.name}` : "Sconosciuto");

  const usesText = (invite.uses !== undefined && invite.uses !== null) ? `${invite.uses}` : "0";

  const description = [
    `> **Codice Invito:** ${invite.code}`,
    `> **Canale:** ${channelMention}`,
    `> **Usi Effettuati:** ${usesText}`
  ].join("\n");

  const inviter = invite.inviter;
  const avatarUrl = inviter?.displayAvatarURL?.({ dynamic: true, size: 256 })
    || inviter?.defaultAvatarURL
    || invite.guild?.iconURL?.({ dynamic: true, size: 256 });

  const embed = new EmbedBuilder()
    .setTitle("🗑️ Invito Rimosso")
    .setColor("#ED4245")
    .setDescription(description);

  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  const inviterName = inviter?.discriminator && inviter.discriminator !== "0"
    ? inviter.tag
    : (inviter?.username || "Utente");

  embed.setFooter({
    text: `@${inviterName} • ${formatFooterDate(date)}`,
    iconURL: avatarUrl || undefined
  });

  return {
    embeds: [embed]
  };
}

function buildServerUpdatePayload(oldGuild, newGuild, executor = null, date = new Date()) {
  const modMention = executor ? `<@${executor.id}>` : "Sistema / Non specificato";
  const changes = [];

  if (oldGuild.name !== newGuild.name) {
    changes.push(`- Nome: ${oldGuild.name}`, `+ Nome: ${newGuild.name}`);
  }
  if (oldGuild.description !== newGuild.description) {
    changes.push(`- Descrizione: ${oldGuild.description || "Nessuna"}`, `+ Descrizione: ${newGuild.description || "Nessuna"}`);
  }
  if (oldGuild.verificationLevel !== newGuild.verificationLevel) {
    changes.push(`- Livello Verifica: ${oldGuild.verificationLevel}`, `+ Livello Verifica: ${newGuild.verificationLevel}`);
  }
  if (oldGuild.icon !== newGuild.icon) {
    changes.push(`- Icona Server Modificata`, `+ Nuova Icona Server Impostata`);
  }
  if (oldGuild.banner !== newGuild.banner) {
    changes.push(`- Banner Server Modificato`, `+ Nuovo Banner Server Impostato`);
  }
  if (oldGuild.afkChannelId !== newGuild.afkChannelId) {
    changes.push(`- Canale AFK: ${oldGuild.afkChannelId ? `<#${oldGuild.afkChannelId}>` : "Nessuno"}`, `+ Canale AFK: ${newGuild.afkChannelId ? `<#${newGuild.afkChannelId}>` : "Nessuno"}`);
  }
  if (changes.length === 0) {
    changes.push(`+ Impostazioni server aggiornate`);
  }

  const description = [
    `> **Server:** **${newGuild.name}**`,
    `> **ID Server:** \`${newGuild.id}\``,
    `> **Moderatore:** ${modMention}`,
    "",
    "**Modifiche Server**",
    "```diff",
    changes.join("\n"),
    "```"
  ].join("\n");

  const avatarUrl = executor?.displayAvatarURL?.({ dynamic: true, size: 256 })
    || newGuild.iconURL?.({ dynamic: true, size: 256 });

  const embed = new EmbedBuilder()
    .setTitle("⚙️ Server Aggiornato")
    .setColor("#5865F2")
    .setDescription(description);

  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  const executorName = executor?.discriminator && executor.discriminator !== "0"
    ? executor.tag
    : (executor?.username || newGuild.name || "Moderatore");

  embed.setFooter({
    text: `@${executorName} • ${formatFooterDate(date)}`,
    iconURL: avatarUrl || undefined
  });

  return {
    embeds: [embed]
  };
}

function buildEmojiCreatePayload(emoji, executor = null, date = new Date()) {
  const modMention = executor ? `<@${executor.id}>` : "Sistema / Non specificato";
  const emojiMention = emoji.id ? `<:${emoji.name}:${emoji.id}>` : emoji.name;

  const description = [
    `> **Emoji:** ${emojiMention} (\`${emoji.name}\`)`,
    `> **ID Emoji:** \`${emoji.id}\``,
    `> **Moderatore:** ${modMention}`,
    "",
    "**Nuova Emoji Aggiunta**",
    "```diff",
    `+ :${emoji.name}:`,
    "```"
  ].join("\n");

  const avatarUrl = emoji.url
    || emoji.imageURL?.()
    || executor?.displayAvatarURL?.({ dynamic: true, size: 256 })
    || emoji.guild?.iconURL?.({ dynamic: true, size: 256 });

  const embed = new EmbedBuilder()
    .setTitle("😀 Emoji Creata")
    .setColor("#57F287")
    .setDescription(description);

  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  const executorName = executor?.discriminator && executor.discriminator !== "0"
    ? executor.tag
    : (executor?.username || "Moderatore");

  embed.setFooter({
    text: `@${executorName} • ${formatFooterDate(date)}`,
    iconURL: executor?.displayAvatarURL?.({ dynamic: true, size: 256 }) || avatarUrl || undefined
  });

  return {
    embeds: [embed]
  };
}

function buildEmojiDeletePayload(emoji, executor = null, date = new Date()) {
  const modMention = executor ? `<@${executor.id}>` : "Sistema / Non specificato";

  const description = [
    `> **Nome Emoji:** \`${emoji.name}\``,
    `> **ID Emoji:** \`${emoji.id}\``,
    `> **Moderatore:** ${modMention}`,
    "",
    "**Emoji Rimossa**",
    "```diff",
    `- :${emoji.name}:`,
    "```"
  ].join("\n");

  const avatarUrl = executor?.displayAvatarURL?.({ dynamic: true, size: 256 })
    || emoji.guild?.iconURL?.({ dynamic: true, size: 256 });

  const embed = new EmbedBuilder()
    .setTitle("🗑️ Emoji Eliminata")
    .setColor("#ED4245")
    .setDescription(description);

  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  const executorName = executor?.discriminator && executor.discriminator !== "0"
    ? executor.tag
    : (executor?.username || "Moderatore");

  embed.setFooter({
    text: `@${executorName} • ${formatFooterDate(date)}`,
    iconURL: avatarUrl || undefined
  });

  return {
    embeds: [embed]
  };
}

async function dispatchInviteCreateLog(guild, invite, targetChannel = null, settings = null) {
  const ch = targetChannel || getLogChannel(guild, "inviteCreate", settings);
  if (!ch || !ch.isTextBased()) return null;

  const payload = buildInviteCreatePayload(invite);
  return await ch.send(payload);
}

async function dispatchInviteDeleteLog(guild, invite, targetChannel = null, settings = null) {
  const ch = targetChannel || getLogChannel(guild, "inviteDelete", settings);
  if (!ch || !ch.isTextBased()) return null;

  const payload = buildInviteDeletePayload(invite);
  return await ch.send(payload);
}

async function dispatchServerUpdateLog(guild, oldGuild, newGuild, executor = null, targetChannel = null, settings = null) {
  const ch = targetChannel || getLogChannel(guild, "serverUpdate", settings);
  if (!ch || !ch.isTextBased()) return null;

  const payload = buildServerUpdatePayload(oldGuild, newGuild, executor);
  return await ch.send(payload);
}

async function dispatchEmojiCreateLog(guild, emoji, executor = null, targetChannel = null, settings = null) {
  const ch = targetChannel || getLogChannel(guild, "emojiCreate", settings);
  if (!ch || !ch.isTextBased()) return null;

  const payload = buildEmojiCreatePayload(emoji, executor);
  return await ch.send(payload);
}

async function dispatchEmojiDeleteLog(guild, emoji, executor = null, targetChannel = null, settings = null) {
  const ch = targetChannel || getLogChannel(guild, "emojiDelete", settings);
  if (!ch || !ch.isTextBased()) return null;

  const payload = buildEmojiDeletePayload(emoji, executor);
  return await ch.send(payload);
}

function buildMemberNickUpdatePayload(oldMember, newMember, executor = null, date = new Date()) {
  const modMention = executor ? `<@${executor.id}>` : "Sistema / Utente Stesso";
  const oldNick = oldMember.nickname || oldMember.displayName || "Nessuno";
  const newNick = newMember.nickname || newMember.displayName || "Nessuno";

  const description = [
    `> **Membro:** <@${newMember.id}>`,
    `> **ID Utente:** \`${newMember.id}\``,
    `> **Moderatore:** ${modMention}`,
    "",
    "**Modifica Nickname**",
    "```diff",
    `- Prima: ${oldNick}`,
    `+ Dopo: ${newNick}`,
    "```"
  ].join("\n");

  const avatarUrl = newMember.user?.displayAvatarURL?.({ dynamic: true, size: 256 })
    || newMember.displayAvatarURL?.({ dynamic: true, size: 256 });

  const embed = new EmbedBuilder()
    .setTitle("✏️ Nickname Membro Modificato")
    .setColor("#F0B232")
    .setDescription(description);

  if (avatarUrl) embed.setThumbnail(avatarUrl);

  const executorName = executor?.discriminator && executor.discriminator !== "0"
    ? executor.tag
    : (executor?.username || newMember.user?.username || "Utente");

  embed.setFooter({
    text: `@${executorName} • ${formatFooterDate(date)}`,
    iconURL: executor?.displayAvatarURL?.({ dynamic: true, size: 256 }) || avatarUrl || undefined
  });

  return { embeds: [embed] };
}

function buildMemberTimeoutPayload(member, timeoutUntil, reason = null, executor = null, isRemove = false, date = new Date()) {
  const modMention = executor ? `<@${executor.id}>` : "Moderatore / AutoMod";
  const timeoutText = isRemove
    ? "`Nessuno (Rimosso)`"
    : (timeoutUntil ? `<t:${Math.floor(new Date(timeoutUntil).getTime() / 1000)}:R>` : "`Permanente`");

  const description = [
    `> **Membro:** <@${member.id}>`,
    `> **ID Utente:** \`${member.id}\``,
    `> **Moderatore:** ${modMention}`,
    `> **Scadenza Timeout:** ${timeoutText}`,
    `> **Motivo:** ${reason || "Nessun motivo fornito"}`
  ].join("\n");

  const avatarUrl = member.user?.displayAvatarURL?.({ dynamic: true, size: 256 })
    || member.displayAvatarURL?.({ dynamic: true, size: 256 });

  const embed = new EmbedBuilder()
    .setTitle(isRemove ? "🔊 Timeout Membro Rimosso" : "⏳ Timeout Membro Applicato")
    .setColor(isRemove ? "#57F287" : "#ED4245")
    .setDescription(description);

  if (avatarUrl) embed.setThumbnail(avatarUrl);

  const executorName = executor?.discriminator && executor.discriminator !== "0"
    ? executor.tag
    : (executor?.username || "Moderatore");

  embed.setFooter({
    text: `@${executorName} • ${formatFooterDate(date)}`,
    iconURL: executor?.displayAvatarURL?.({ dynamic: true, size: 256 }) || avatarUrl || undefined
  });

  return { embeds: [embed] };
}

function buildUserUpdatePayload(oldUser, newUser, date = new Date()) {
  const changes = [];
  if (oldUser.username !== newUser.username) {
    changes.push(`- Username: ${oldUser.username}`, `+ Username: ${newUser.username}`);
  }
  if (oldUser.globalName !== newUser.globalName) {
    changes.push(`- Nome Globale: ${oldUser.globalName || "Nessuno"}`, `+ Nome Globale: ${newUser.globalName || "Nessuno"}`);
  }
  if (oldUser.avatar !== newUser.avatar) {
    changes.push(`- Avatar Profilo Modificato`, `+ Nuovo Avatar Profilo Impostato`);
  }
  if (changes.length === 0) {
    changes.push(`+ Profilo utente aggiornato`);
  }

  const description = [
    `> **Utente:** <@${newUser.id}>`,
    `> **ID Utente:** \`${newUser.id}\``,
    "",
    "**Modifiche Profilo Globale**",
    "```diff",
    changes.join("\n"),
    "```"
  ].join("\n");

  const avatarUrl = newUser.displayAvatarURL?.({ dynamic: true, size: 256 });

  const embed = new EmbedBuilder()
    .setTitle("👤 Profilo Utente Modificato")
    .setColor("#5865F2")
    .setDescription(description);

  if (avatarUrl) embed.setThumbnail(avatarUrl);

  const tagName = newUser.discriminator && newUser.discriminator !== "0" ? newUser.tag : newUser.username;
  embed.setFooter({
    text: `@${tagName} • ${formatFooterDate(date)}`,
    iconURL: avatarUrl || undefined
  });

  return { embeds: [embed] };
}

function buildMessageBulkDeletePayload(channel, count, executor = null, date = new Date()) {
  const modMention = executor ? `<@${executor.id}>` : "Sistema / Non specificato";
  const channelMention = `<#${channel.id}> ( \`${channel.name}\` )`;

  const description = [
    `> **Canale:** ${channelMention}`,
    `> **Messaggi Eliminati:** \`${count}\``,
    `> **Moderatore:** ${modMention}`,
    "",
    "**Eliminazione Massiva (Purge)**",
    "```diff",
    `- ${count} messaggi eliminati contemporaneamente`,
    "```"
  ].join("\n");

  const avatarUrl = executor?.displayAvatarURL?.({ dynamic: true, size: 256 })
    || channel.guild?.iconURL?.({ dynamic: true, size: 256 });

  const embed = new EmbedBuilder()
    .setTitle("🗑️ Eliminazione Massiva Messaggi")
    .setColor("#ED4245")
    .setDescription(description);

  if (avatarUrl) embed.setThumbnail(avatarUrl);

  const executorName = executor?.discriminator && executor.discriminator !== "0"
    ? executor.tag
    : (executor?.username || "Moderatore");

  embed.setFooter({
    text: `@${executorName} • ${formatFooterDate(date)}`,
    iconURL: avatarUrl || undefined
  });

  return { embeds: [embed] };
}

function buildChannelPinsUpdatePayload(channel, executor = null, date = new Date()) {
  const modMention = executor ? `<@${executor.id}>` : "Sistema / Non specificato";
  const channelMention = `<#${channel.id}> ( \`${channel.name}\` )`;

  const description = [
    `> **Canale:** ${channelMention}`,
    `> **ID Canale:** \`${channel.id}\``,
    `> **Moderatore:** ${modMention}`
  ].join("\n");

  const avatarUrl = executor?.displayAvatarURL?.({ dynamic: true, size: 256 })
    || channel.guild?.iconURL?.({ dynamic: true, size: 256 });

  const embed = new EmbedBuilder()
    .setTitle("📌 Messaggi Fissati Aggiornati")
    .setColor("#5865F2")
    .setDescription(description);

  if (avatarUrl) embed.setThumbnail(avatarUrl);

  const executorName = executor?.discriminator && executor.discriminator !== "0"
    ? executor.tag
    : (executor?.username || "Moderatore");

  embed.setFooter({
    text: `@${executorName} • ${formatFooterDate(date)}`,
    iconURL: avatarUrl || undefined
  });

  return { embeds: [embed] };
}

function buildVoiceMuteDeafPayload(member, type, state, executor = null, date = new Date()) {
  const modMention = executor ? `<@${executor.id}>` : "Sistema / Moderatore";
  const channelMention = member.voice?.channelId ? `<#${member.voice.channelId}>` : "`Nessuna Stanza`";

  const description = [
    `> **Membro:** <@${member.id}>`,
    `> **ID Utente:** \`${member.id}\``,
    `> **Stanza Vocale:** ${channelMention}`,
    `> **Stato Vocale:** \`${type} ${state ? "Attivato" : "Disattivato"}\``,
    `> **Eseguito da:** ${modMention}`
  ].join("\n");

  const avatarUrl = member.user?.displayAvatarURL?.({ dynamic: true, size: 256 })
    || member.displayAvatarURL?.({ dynamic: true, size: 256 });

  const embed = new EmbedBuilder()
    .setTitle(state ? `🔇 ${type} Attivato` : `🔊 ${type} Disattivato`)
    .setColor(state ? "#ED4245" : "#57F287")
    .setDescription(description);

  if (avatarUrl) embed.setThumbnail(avatarUrl);

  const executorName = executor?.discriminator && executor.discriminator !== "0"
    ? executor.tag
    : (executor?.username || member.user?.username || "Moderatore");

  embed.setFooter({
    text: `@${executorName} • ${formatFooterDate(date)}`,
    iconURL: executor?.displayAvatarURL?.({ dynamic: true, size: 256 }) || avatarUrl || undefined
  });

  return { embeds: [embed] };
}

function buildVoiceActivityPayload(member, channel, activityName, state, date = new Date()) {
  const channelMention = `<#${channel.id}> ( \`${channel.name}\` )`;

  const description = [
    `> **Membro:** <@${member.id}>`,
    `> **ID Utente:** \`${member.id}\``,
    `> **Stanza Vocale:** ${channelMention}`,
    `> **Attività:** \`${activityName}\``,
    `> **Stato:** \`${state ? "Avviato" : "Terminato"}\``
  ].join("\n");

  const avatarUrl = member.user?.displayAvatarURL?.({ dynamic: true, size: 256 })
    || member.displayAvatarURL?.({ dynamic: true, size: 256 });

  const embed = new EmbedBuilder()
    .setTitle(state ? `📹 ${activityName} Avviato` : `📹 ${activityName} Terminato`)
    .setColor(state ? "#57F287" : "#ED4245")
    .setDescription(description);

  if (avatarUrl) embed.setThumbnail(avatarUrl);

  const tagOrName = member.user?.username || member.displayName || "Utente";
  embed.setFooter({
    text: `@${tagOrName} • ${formatFooterDate(date)}`,
    iconURL: avatarUrl || undefined
  });

  return { embeds: [embed] };
}

function buildBanPayload(guild, user, reason = null, executor = null, isUnban = false, date = new Date()) {
  const modMention = executor ? `<@${executor.id}>` : "Moderatore / Non specificato";
  const userTag = user.discriminator && user.discriminator !== "0" ? user.tag : user.username;

  const description = [
    `> **Utente:** <@${user.id}> (\`${userTag}\`)`,
    `> **ID Utente:** \`${user.id}\``,
    `> **Moderatore:** ${modMention}`,
    `> **Motivo:** ${reason || "Nessun motivo fornito"}`
  ].join("\n");

  const avatarUrl = user.displayAvatarURL?.({ dynamic: true, size: 256 })
    || guild.iconURL?.({ dynamic: true, size: 256 });

  const embed = new EmbedBuilder()
    .setTitle(isUnban ? "🕊️ Utente Sbannato" : "🔨 Utente Bannato")
    .setColor(isUnban ? "#57F287" : "#ED4245")
    .setDescription(description);

  if (avatarUrl) embed.setThumbnail(avatarUrl);

  const executorName = executor?.discriminator && executor.discriminator !== "0"
    ? executor.tag
    : (executor?.username || "Moderatore");

  embed.setFooter({
    text: `@${executorName} • ${formatFooterDate(date)}`,
    iconURL: executor?.displayAvatarURL?.({ dynamic: true, size: 256 }) || avatarUrl || undefined
  });

  return { embeds: [embed] };
}

function buildAutoModActionPayload(execution, date = new Date()) {
  const channelMention = execution.channelId ? `<#${execution.channelId}>` : "`Canale Sconosciuto`";
  const ruleName = execution.ruleTriggerType || "Filtro AutoMod";
  const actionType = execution.action?.type === 1 ? "Messaggio Bloccato" : (execution.action?.type === 2 ? "Messaggio Segnalato" : "Timeout Applicato");

  const description = [
    `> **Utente:** <@${execution.userId}>`,
    `> **ID Utente:** \`${execution.userId}\``,
    `> **Canale:** ${channelMention}`,
    `> **Regola Violata:** \`${ruleName}\``,
    `> **Azione Eseguita:** \`${actionType}\``,
    "",
    "**Contenuto Rilevato**",
    "```diff",
    `- ${String(execution.content || execution.matchedContent || "(Nessun testo)").slice(0, 500)}`,
    "```"
  ].join("\n");

  const avatarUrl = execution.guild?.iconURL?.({ dynamic: true, size: 256 });

  const embed = new EmbedBuilder()
    .setTitle("🛡️ AutoMod: Violazione Rilevata")
    .setColor("#ED4245")
    .setDescription(description);

  if (avatarUrl) embed.setThumbnail(avatarUrl);

  embed.setFooter({
    text: `AutoMod • ${formatFooterDate(date)}`,
    iconURL: avatarUrl || undefined
  });

  return { embeds: [embed] };
}

function buildAutoModRulePayload(rule, actionType = "Create", executor = null, date = new Date()) {
  const modMention = executor ? `<@${executor.id}>` : "Sistema / Moderatore";
  const titleMap = {
    Create: "➕ Regola AutoMod Creata",
    Delete: "➖ Regola AutoMod Eliminata",
    Update: "✏️ Regola AutoMod Modificata"
  };
  const colorMap = {
    Create: "#57F287",
    Delete: "#ED4245",
    Update: "#F0B232"
  };

  const description = [
    `> **Nome Regola:** \`${rule.name}\``,
    `> **ID Regola:** \`${rule.id}\``,
    `> **Moderatore:** ${modMention}`,
    `> **Stato:** \`${rule.enabled ? "Attiva" : "Disattivata"}\``
  ].join("\n");

  const avatarUrl = executor?.displayAvatarURL?.({ dynamic: true, size: 256 })
    || rule.guild?.iconURL?.({ dynamic: true, size: 256 });

  const embed = new EmbedBuilder()
    .setTitle(titleMap[actionType] || "🛡️ Regola AutoMod")
    .setColor(colorMap[actionType] || "#5865F2")
    .setDescription(description);

  if (avatarUrl) embed.setThumbnail(avatarUrl);

  const executorName = executor?.discriminator && executor.discriminator !== "0"
    ? executor.tag
    : (executor?.username || "Moderatore");

  embed.setFooter({
    text: `@${executorName} • ${formatFooterDate(date)}`,
    iconURL: avatarUrl || undefined
  });

  return { embeds: [embed] };
}

function buildStickerPayload(sticker, actionType = "Create", executor = null, date = new Date()) {
  const modMention = executor ? `<@${executor.id}>` : "Sistema / Moderatore";
  const titleMap = {
    Create: "🏷️ Sticker Creato",
    Delete: "🗑️ Sticker Eliminato",
    Update: "✏️ Sticker Modificato"
  };
  const colorMap = {
    Create: "#57F287",
    Delete: "#ED4245",
    Update: "#F0B232"
  };

  const description = [
    `> **Nome Sticker:** \`${sticker.name}\``,
    `> **ID Sticker:** \`${sticker.id}\``,
    `> **Moderatore:** ${modMention}`
  ].join("\n");

  const avatarUrl = sticker.url || executor?.displayAvatarURL?.({ dynamic: true, size: 256 });

  const embed = new EmbedBuilder()
    .setTitle(titleMap[actionType] || "🏷️ Sticker")
    .setColor(colorMap[actionType] || "#5865F2")
    .setDescription(description);

  if (avatarUrl) embed.setThumbnail(avatarUrl);

  const executorName = executor?.discriminator && executor.discriminator !== "0"
    ? executor.tag
    : (executor?.username || "Moderatore");

  embed.setFooter({
    text: `@${executorName} • ${formatFooterDate(date)}`,
    iconURL: executor?.displayAvatarURL?.({ dynamic: true, size: 256 }) || undefined
  });

  return { embeds: [embed] };
}

function buildThreadPayload(thread, actionType = "Create", executor = null, date = new Date()) {
  const modMention = executor ? `<@${executor.id}>` : "Sistema / Moderatore";
  const titleMap = {
    Create: "🧵 Thread Creato",
    Delete: "🗑️ Thread Eliminato",
    Update: "✏️ Thread Modificato"
  };
  const colorMap = {
    Create: "#57F287",
    Delete: "#ED4245",
    Update: "#F0B232"
  };

  const channelMention = thread.parentId ? `<#${thread.parentId}>` : "`Canale Principale`";

  const description = [
    `> **Thread:** <#${thread.id}> (\`${thread.name}\`)`,
    `> **ID Thread:** \`${thread.id}\``,
    `> **Canale Padre:** ${channelMention}`,
    `> **Creatore / Mod:** ${modMention}`
  ].join("\n");

  const avatarUrl = executor?.displayAvatarURL?.({ dynamic: true, size: 256 })
    || thread.guild?.iconURL?.({ dynamic: true, size: 256 });

  const embed = new EmbedBuilder()
    .setTitle(titleMap[actionType] || "🧵 Thread")
    .setColor(colorMap[actionType] || "#5865F2")
    .setDescription(description);

  if (avatarUrl) embed.setThumbnail(avatarUrl);

  const executorName = executor?.discriminator && executor.discriminator !== "0"
    ? executor.tag
    : (executor?.username || "Moderatore");

  embed.setFooter({
    text: `@${executorName} • ${formatFooterDate(date)}`,
    iconURL: avatarUrl || undefined
  });

  return { embeds: [embed] };
}

function buildStageInstancePayload(stage, actionType = "Create", executor = null, date = new Date()) {
  const modMention = executor ? `<@${executor.id}>` : "Sistema / Moderatore";
  const titleMap = {
    Create: "🎭 Palco Avviato",
    Delete: "🎭 Palco Terminato",
    Update: "✏️ Palco Modificato"
  };
  const colorMap = {
    Create: "#57F287",
    Delete: "#ED4245",
    Update: "#F0B232"
  };

  const channelMention = `<#${stage.channelId}>`;

  const description = [
    `> **Canale Palco:** ${channelMention}`,
    `> **Argomento:** \`${stage.topic || "Nessun argomento"}\``,
    `> **Moderatore:** ${modMention}`
  ].join("\n");

  const avatarUrl = executor?.displayAvatarURL?.({ dynamic: true, size: 256 })
    || stage.guild?.iconURL?.({ dynamic: true, size: 256 });

  const embed = new EmbedBuilder()
    .setTitle(titleMap[actionType] || "🎭 Palco Vocale")
    .setColor(colorMap[actionType] || "#5865F2")
    .setDescription(description);

  if (avatarUrl) embed.setThumbnail(avatarUrl);

  const executorName = executor?.discriminator && executor.discriminator !== "0"
    ? executor.tag
    : (executor?.username || "Moderatore");

  embed.setFooter({
    text: `@${executorName} • ${formatFooterDate(date)}`,
    iconURL: avatarUrl || undefined
  });

  return { embeds: [embed] };
}

function buildScheduledEventPayload(event, actionType = "Create", executor = null, date = new Date()) {
  const modMention = executor ? `<@${executor.id}>` : "Sistema / Organizzatore";
  const titleMap = {
    Create: "📅 Evento Programmato Creato",
    Delete: "🗑️ Evento Programmato Cancellato",
    Update: "✏️ Evento Programmato Modificato"
  };
  const colorMap = {
    Create: "#57F287",
    Delete: "#ED4245",
    Update: "#F0B232"
  };

  const startText = event.scheduledStartTimestamp
    ? `<t:${Math.floor(event.scheduledStartTimestamp / 1000)}:F>`
    : "`Orario non specificato`";

  const description = [
    `> **Evento:** **${event.name}**`,
    `> **ID Evento:** \`${event.id}\``,
    `> **Inizio Previsto:** ${startText}`,
    `> **Organizzatore / Mod:** ${modMention}`
  ].join("\n");

  const avatarUrl = event.coverImageURL?.({ size: 256 })
    || executor?.displayAvatarURL?.({ dynamic: true, size: 256 })
    || event.guild?.iconURL?.({ dynamic: true, size: 256 });

  const embed = new EmbedBuilder()
    .setTitle(titleMap[actionType] || "📅 Evento")
    .setColor(colorMap[actionType] || "#5865F2")
    .setDescription(description);

  if (avatarUrl) embed.setThumbnail(avatarUrl);

  const executorName = executor?.discriminator && executor.discriminator !== "0"
    ? executor.tag
    : (executor?.username || "Organizzatore");

  embed.setFooter({
    text: `@${executorName} • ${formatFooterDate(date)}`,
    iconURL: executor?.displayAvatarURL?.({ dynamic: true, size: 256 }) || undefined
  });

  return { embeds: [embed] };
}

function buildWebhookUpdatePayload(channel, executor = null, date = new Date()) {
  const modMention = executor ? `<@${executor.id}>` : "Sistema / Moderatore";
  const channelMention = `<#${channel.id}> ( \`${channel.name}\` )`;

  const description = [
    `> **Canale:** ${channelMention}`,
    `> **ID Canale:** \`${channel.id}\``,
    `> **Moderatore:** ${modMention}`,
    "",
    "**Integrazione Webhook**",
    "```diff",
    `+ Configurazione webhook aggiornata per #${channel.name}`,
    "```"
  ].join("\n");

  const avatarUrl = executor?.displayAvatarURL?.({ dynamic: true, size: 256 })
    || channel.guild?.iconURL?.({ dynamic: true, size: 256 });

  const embed = new EmbedBuilder()
    .setTitle("🔗 Webhook Modificato")
    .setColor("#5865F2")
    .setDescription(description);

  if (avatarUrl) embed.setThumbnail(avatarUrl);

  const executorName = executor?.discriminator && executor.discriminator !== "0"
    ? executor.tag
    : (executor?.username || "Moderatore");

  embed.setFooter({
    text: `@${executorName} • ${formatFooterDate(date)}`,
    iconURL: avatarUrl || undefined
  });

  return { embeds: [embed] };
}

// Mappa numerica completa Discord AuditLogEvent (tutti i 78 tipi ufficiali Discord)
const AUDIT_ACTION_NUMERIC = {
  1: "GuildUpdate",
  10: "ChannelCreate", 11: "ChannelUpdate", 12: "ChannelDelete",
  13: "ChannelOverwriteCreate", 14: "ChannelOverwriteUpdate", 15: "ChannelOverwriteDelete",
  20: "MemberKick", 21: "MemberPrune", 22: "MemberBanAdd", 23: "MemberBanRemove",
  24: "MemberUpdate", 25: "MemberRoleUpdate", 26: "MemberMove", 27: "MemberDisconnect",
  28: "BotAdd",
  30: "RoleCreate", 31: "RoleUpdate", 32: "RoleDelete",
  40: "InviteCreate", 41: "InviteUpdate", 42: "InviteDelete",
  50: "WebhookCreate", 51: "WebhookUpdate", 52: "WebhookDelete",
  60: "EmojiCreate", 61: "EmojiUpdate", 62: "EmojiDelete",
  72: "MessageDelete", 73: "MessageBulkDelete", 74: "MessagePin", 75: "MessageUnpin",
  80: "IntegrationCreate", 81: "IntegrationUpdate", 82: "IntegrationDelete",
  83: "StageInstanceCreate", 84: "StageInstanceUpdate", 85: "StageInstanceDelete",
  90: "StickerCreate", 91: "StickerUpdate", 92: "StickerDelete",
  100: "GuildScheduledEventCreate", 101: "GuildScheduledEventUpdate", 102: "GuildScheduledEventDelete",
  110: "ThreadCreate", 111: "ThreadUpdate", 112: "ThreadDelete",
  121: "ApplicationCommandPermissionUpdate",
  130: "SoundboardSoundCreate", 131: "SoundboardSoundUpdate", 132: "SoundboardSoundDelete",
  140: "AutoModerationRuleCreate", 141: "AutoModerationRuleUpdate", 142: "AutoModerationRuleDelete",
  143: "AutoModerationBlockMessage", 144: "AutoModerationFlagToChannel",
  145: "AutoModerationUserCommunicationDisabled", 146: "AutoModerationQuarantineUser",
  150: "CreatorMonetizationRequestCreated", 151: "CreatorMonetizationTermsAccepted",
  163: "OnboardingPromptCreate", 164: "OnboardingPromptUpdate", 165: "OnboardingPromptDelete",
  166: "OnboardingCreate", 167: "OnboardingUpdate",
  171: "GuildHomeFeatureItem", 172: "GuildHomeRemoveItem",
  190: "HomeSettingsCreate", 191: "HomeSettingsUpdate",
  192: "VoiceChannelStatusCreate", 193: "VoiceChannelStatusDelete",
  200: "GuildScheduledEventExceptionCreate", 201: "GuildScheduledEventExceptionUpdate", 202: "GuildScheduledEventExceptionDelete",
  210: "GuildMemberVerificationUpdate", 211: "GuildProfileUpdate",
  212: "GuildMigratePinPermission", 213: "GuildMigrateBypassSlowmodePermission"
};

function resolveAuditActionKey(action) {
  if (action === null || action === undefined) return "GuildUpdate";

  // Se è un numero o stringa numerica (es. 191, "191", 72, "72")
  if (typeof action === "number" || (!isNaN(action) && typeof action !== "object" && String(action).trim() !== "")) {
    const num = Number(action);
    if (AuditLogEvent && AuditLogEvent[num]) return AuditLogEvent[num];
    if (AUDIT_ACTION_NUMERIC[num]) return AUDIT_ACTION_NUMERIC[num];
  }

  const str = String(action).trim();
  if (AUDIT_ACTION_LABELS[str]) return str;

  // Cerca in AuditLogEvent di discord.js
  if (AuditLogEvent && AuditLogEvent[str]) {
    const val = AuditLogEvent[str];
    if (typeof val === "number" && AuditLogEvent[val]) return AuditLogEvent[val];
  }

  // Converte da UPPER_SNAKE_CASE a PascalCase (es. HOME_SETTINGS_UPDATE -> HomeSettingsUpdate)
  if (str.includes("_")) {
    const pascal = str.toLowerCase().split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("");
    if (AUDIT_ACTION_LABELS[pascal]) return pascal;
    return pascal;
  }

  return str;
}

function getHumanActionLabel(actionKey, entry) {
  const resolved = resolveAuditActionKey(actionKey);
  if (AUDIT_ACTION_LABELS[resolved]) {
    return AUDIT_ACTION_LABELS[resolved];
  }

  // Se è una stringa PascalCase nota
  if (typeof resolved === "string" && !/^\d+$/.test(resolved) && !resolved.toLowerCase().startsWith("azione")) {
    const words = resolved.replace(/([A-Z])/g, " $1").trim();
    if (resolved.includes("Guild") || resolved.includes("Server")) return `Modifica ${words}`;
    if (resolved.includes("Channel")) return `Modifica ${words}`;
    if (resolved.includes("Role")) return `Modifica ${words}`;
    if (resolved.includes("Member")) return `Azione Membro: ${words}`;
    return words;
  }

  // Fallback infallibile: analizza le modifiche e il target
  // MAI restituire "Azione <numero>", "non lo so", o "sconosciuto"
  if (entry) {
    if (entry.changes && entry.changes.length > 0) {
      const keys = entry.changes.map(c => c.key).filter(Boolean);
      if (keys.some(k => k.includes("onboarding") || k.includes("welcome") || k.includes("trait") || k.includes("action") || k.includes("home"))) {
        return "Modifica Guida del Server / Profilo";
      }
      if (keys.some(k => k.includes("name") || k.includes("icon") || k.includes("banner") || k.includes("description"))) {
        return "Aggiornamento Informazioni Server";
      }
    }
    if (entry.targetType === "GUILD" || entry.targetType === 1 || entry.target?.id === entry.guild?.id) {
      return "Impostazioni del Server Modificate";
    }
    if (entry.targetType === "CHANNEL" || entry.targetType === 10 || entry.target?.type !== undefined) {
      return "Configurazione Canale Modificata";
    }
    if (entry.targetType === "ROLE" || entry.targetType === 30 || entry.target?.permissions !== undefined) {
      return "Configurazione Ruolo Modificata";
    }
    if (entry.targetType === "USER" || entry.targetType === 20 || entry.target?.bot !== undefined) {
      return "Azione Amministrativa Utente";
    }
  }

  return "Modifica Impostazioni del Server";
}

function buildGenericAuditLogPayload(entry, guild, date = new Date()) {
  const actionKey = resolveAuditActionKey(entry.action);
  const humanLabel = getHumanActionLabel(actionKey, entry);

  const executor = entry.executor;
  const modMention = executor ? `<@${executor.id}>` : "Sistema / Non specificato";
  const executorTag = executor?.username || "Moderatore";

  let targetText = "Server / Nessuno";
  if (entry.target) {
    if (entry.target.tag || entry.target.username) {
      targetText = `<@${entry.target.id}> (\`${entry.target.username || entry.target.tag}\`)`;
    } else if (entry.target.name && entry.target.id) {
      targetText = `\`${entry.target.name}\` (\`${entry.target.id}\`)`;
    } else if (entry.target.name) {
      targetText = `\`${entry.target.name}\``;
    } else if (entry.target.id) {
      targetText = `\`${entry.target.id}\``;
    }
  }

  const reasonLine = entry.reason ? `> **Motivo:** ${entry.reason}` : "";

  // Funzione per serializzare valori in modo pulito ed elegante (evita [object Object] e stringhe JSON tronche)
  function serializeAuditValue(val) {
    if (val === null || val === undefined) return "—";
    if (typeof val === "boolean") return val ? "✅ Sì" : "❌ No";
    if (typeof val === "number" || typeof val === "bigint") return String(val);
    if (typeof val === "string") return val.slice(0, 150) || "—";
    if (Array.isArray(val)) {
      if (val.length === 0) return "(vuoto)";
      const items = val.slice(0, 6).map(item => {
        if (typeof item === "object" && item !== null) {
          if (item.title) return item.title;
          if (item.label) return item.label;
          if (item.name) return item.name;
          if (item.id) return item.id;
          return JSON.stringify(item).slice(0, 60);
        }
        return String(item);
      });
      return items.join(", ") + (val.length > 6 ? ` (+${val.length - 6} altri)` : "");
    }
    if (typeof val === "object") {
      if (val.title) return String(val.title);
      if (val.label) return String(val.label);
      if (val.name) return String(val.name);
      const keys = Object.keys(val).slice(0, 4);
      if (keys.length === 0) return "(vuoto)";
      return keys.map(k => {
        const sub = val[k];
        const subText = typeof sub === "object" && sub !== null ? (sub.title || sub.label || sub.name || JSON.stringify(sub).slice(0, 30)) : String(sub);
        return `${k}: ${subText.slice(0, 40)}`;
      }).join(", ");
    }
    return String(val).slice(0, 150);
  }

  const changesList = [];
  if (Array.isArray(entry.changes)) {
    for (const ch of entry.changes) {
      const k = ch.key || "valore";
      if (ch.old !== undefined && ch.new !== undefined) {
        changesList.push(`- ${k}: ${serializeAuditValue(ch.old)}`, `+ ${k}: ${serializeAuditValue(ch.new)}`);
      } else if (ch.new !== undefined) {
        changesList.push(`+ ${k}: ${serializeAuditValue(ch.new)}`);
      } else if (ch.old !== undefined) {
        changesList.push(`- ${k}: ${serializeAuditValue(ch.old)}`);
      }
    }
  }

  let diffBlock = "";
  if (changesList.length > 0) {
    diffBlock = ["", "**Modifiche Rilevate**", "```diff", changesList.join("\n"), "```"].join("\n");
  }

  const descriptionLines = [
    `> **Azione:** \`${humanLabel}\``,
    `> **Bersaglio:** ${targetText}`,
    `> **Moderatore:** ${modMention}`,
    `> **ID Azione:** \`${entry.id || "N/D"}\``
  ];
  if (reasonLine) descriptionLines.push(reasonLine);
  if (diffBlock) descriptionLines.push(diffBlock);

  // Colore e emoji basati sull'azione
  let embedColor = "#5865F2";
  let titleEmoji = "⚙️";
  const actLower = String(humanLabel).toLowerCase();
  if (actLower.includes("eliminat") || actLower.includes("espuls") || actLower.includes("bannat") || actLower.includes("rimoss") || actLower.includes("disconnect") || actLower.includes("cancellato")) {
    embedColor = "#ED4245"; titleEmoji = "🗑️";
  } else if (actLower.includes("creat") || actLower.includes("aggiunt") || actLower.includes("avviat")) {
    embedColor = "#57F287"; titleEmoji = "➕";
  } else if (actLower.includes("modific") || actLower.includes("aggiornat") || actLower.includes("spostato") || actLower.includes("impostat")) {
    embedColor = "#F0B232"; titleEmoji = "✏️";
  } else if (actLower.includes("bannat")) {
    embedColor = "#ED4245"; titleEmoji = "🔨";
  } else if (actLower.includes("sbann")) {
    embedColor = "#57F287"; titleEmoji = "✅";
  } else if (actLower.includes("timeout") || actLower.includes("silenziato") || actLower.includes("quarantena")) {
    embedColor = "#F0B232"; titleEmoji = "⏱️";
  } else if (actLower.includes("guida") || actLower.includes("onboarding") || actLower.includes("benvenuto") || actLower.includes("profilo")) {
    embedColor = "#8525E5"; titleEmoji = "✨";
  }

  const avatarUrl = executor?.displayAvatarURL?.({ dynamic: true, size: 256 })
    || guild?.iconURL?.({ dynamic: true, size: 256 });

  const embed = new EmbedBuilder()
    .setTitle(`${titleEmoji} ${humanLabel}`)
    .setColor(embedColor)
    .setDescription(descriptionLines.join("\n"));

  if (avatarUrl) embed.setThumbnail(avatarUrl);

  embed.setFooter({
    text: `@${executorTag} • ${formatFooterDate(date)}`,
    iconURL: avatarUrl || undefined
  });

  return { embeds: [embed] };
}


async function dispatchMemberNickUpdateLog(guild, oldMember, newMember, executor = null, targetChannel = null, settings = null) {
  const ch = targetChannel || getLogChannel(guild, "memberNickUpdate", settings);
  if (!ch || !ch.isTextBased()) return null;
  const payload = buildMemberNickUpdatePayload(oldMember, newMember, executor);
  return await ch.send(payload);
}

async function dispatchMemberTimeoutLog(guild, member, timeoutUntil, reason = null, executor = null, isRemove = false, targetChannel = null, settings = null) {
  const evKey = isRemove ? "memberTimeoutRemove" : "memberTimeout";
  const ch = targetChannel || getLogChannel(guild, evKey, settings) || getLogChannel(guild, "memberTimeout", settings);
  if (!ch || !ch.isTextBased()) return null;
  const payload = buildMemberTimeoutPayload(member, timeoutUntil, reason, executor, isRemove);
  return await ch.send(payload);
}

async function dispatchUserUpdateLog(guild, oldUser, newUser, targetChannel = null, settings = null) {
  const ch = targetChannel || getLogChannel(guild, "userUpdate", settings);
  if (!ch || !ch.isTextBased()) return null;
  const payload = buildUserUpdatePayload(oldUser, newUser);
  return await ch.send(payload);
}

async function dispatchMessageBulkDeleteLog(guild, channel, count, executor = null, targetChannel = null, settings = null) {
  const ch = targetChannel || getLogChannel(guild, "messageDeleteBulk", settings);
  if (!ch || !ch.isTextBased()) return null;
  const payload = buildMessageBulkDeletePayload(channel, count, executor);
  return await ch.send(payload);
}

async function dispatchChannelPinsUpdateLog(guild, channel, executor = null, targetChannel = null, settings = null) {
  const ch = targetChannel || getLogChannel(guild, "channelPinsUpdate", settings);
  if (!ch || !ch.isTextBased()) return null;
  const payload = buildChannelPinsUpdatePayload(channel, executor);
  return await ch.send(payload);
}

async function dispatchVoiceMuteDeafLog(guild, member, type, state, executor = null, targetChannel = null, settings = null) {
  const ch = targetChannel || getLogChannel(guild, "voiceMuteDeaf", settings);
  if (!ch || !ch.isTextBased()) return null;
  const payload = buildVoiceMuteDeafPayload(member, type, state, executor);
  return await ch.send(payload);
}

async function dispatchVoiceActivityLog(guild, member, channel, activityName, state, targetChannel = null, settings = null) {
  const evKey = activityName === "Video" ? "voiceVideo" : "voiceStream";
  const ch = targetChannel || getLogChannel(guild, evKey, settings) || getLogChannel(guild, "voiceStream", settings);
  if (!ch || !ch.isTextBased()) return null;
  const payload = buildVoiceActivityPayload(member, channel, activityName, state);
  return await ch.send(payload);
}

async function dispatchBanLog(guild, user, reason = null, executor = null, isUnban = false, targetChannel = null, settings = null) {
  const evKey = isUnban ? "banRemove" : "banAdd";
  const ch = targetChannel || getLogChannel(guild, evKey, settings);
  if (!ch || !ch.isTextBased()) return null;
  const payload = buildBanPayload(guild, user, reason, executor, isUnban);
  return await ch.send(payload);
}

async function dispatchAutoModActionLog(guild, execution, targetChannel = null, settings = null) {
  const ch = targetChannel || getLogChannel(guild, "autoModActionExecution", settings) || getLogChannel(guild, "autoModAction", settings);
  if (!ch || !ch.isTextBased()) return null;
  const payload = buildAutoModActionPayload(execution);
  return await ch.send(payload);
}

async function dispatchAutoModRuleLog(guild, rule, actionType = "Create", executor = null, targetChannel = null, settings = null) {
  const evKey = `autoModRule${actionType}`;
  const ch = targetChannel || getLogChannel(guild, evKey, settings) || getLogChannel(guild, "autoModRuleCreate", settings);
  if (!ch || !ch.isTextBased()) return null;
  const payload = buildAutoModRulePayload(rule, actionType, executor);
  return await ch.send(payload);
}

async function dispatchStickerLog(guild, sticker, actionType = "Create", executor = null, targetChannel = null, settings = null) {
  const evKey = `sticker${actionType}`;
  const ch = targetChannel || getLogChannel(guild, evKey, settings);
  if (!ch || !ch.isTextBased()) return null;
  const payload = buildStickerPayload(sticker, actionType, executor);
  return await ch.send(payload);
}

async function dispatchThreadLog(guild, thread, actionType = "Create", executor = null, targetChannel = null, settings = null) {
  const evKey = `thread${actionType}`;
  const ch = targetChannel || getLogChannel(guild, evKey, settings);
  if (!ch || !ch.isTextBased()) return null;
  const payload = buildThreadPayload(thread, actionType, executor);
  return await ch.send(payload);
}

async function dispatchStageInstanceLog(guild, stage, actionType = "Create", executor = null, targetChannel = null, settings = null) {
  const evKey = `stageInstance${actionType}`;
  const ch = targetChannel || getLogChannel(guild, evKey, settings);
  if (!ch || !ch.isTextBased()) return null;
  const payload = buildStageInstancePayload(stage, actionType, executor);
  return await ch.send(payload);
}

async function dispatchScheduledEventLog(guild, event, actionType = "Create", executor = null, targetChannel = null, settings = null) {
  const evKey = `scheduledEvent${actionType}`;
  const ch = targetChannel || getLogChannel(guild, evKey, settings);
  if (!ch || !ch.isTextBased()) return null;
  const payload = buildScheduledEventPayload(event, actionType, executor);
  return await ch.send(payload);
}

async function dispatchWebhookUpdateLog(guild, channel, executor = null, targetChannel = null, settings = null) {
  const ch = targetChannel || getLogChannel(guild, "webhooksUpdate", settings) || getLogChannel(guild, "webhookUpdate", settings);
  if (!ch || !ch.isTextBased()) return null;
  const payload = buildWebhookUpdatePayload(channel, executor);
  return await ch.send(payload);
}

async function dispatchGenericAuditLog(guild, entry, targetChannel = null, settings = null) {
  const resolvedKey = resolveAuditActionKey(entry.action);
  const catKey = AUDIT_ACTION_CATEGORY[resolvedKey] || "server";

  let eventKey = null;
  if (resolvedKey === "MessageDelete") eventKey = "messageDelete";
  else if (resolvedKey === "MessageBulkDelete") eventKey = "messageDeleteBulk";
  else if (resolvedKey === "MessagePin") eventKey = "messagePin";
  else if (resolvedKey === "MessageUnpin") eventKey = "messageUnpin";
  else if (resolvedKey === "ChannelCreate") eventKey = "channelCreate";
  else if (resolvedKey === "ChannelDelete") eventKey = "channelDelete";
  else if (resolvedKey === "ChannelUpdate") eventKey = "channelUpdate";
  else if (resolvedKey === "RoleCreate") eventKey = "roleCreate";
  else if (resolvedKey === "RoleDelete") eventKey = "roleDelete";
  else if (resolvedKey === "RoleUpdate") eventKey = "roleUpdate";
  else if (resolvedKey === "MemberBanAdd") eventKey = "banAdd";
  else if (resolvedKey === "MemberBanRemove") eventKey = "banRemove";
  else if (resolvedKey === "MemberKick") eventKey = "memberKick";
  else if (resolvedKey === "ServerUpdate" || resolvedKey === "GuildUpdate") eventKey = "serverUpdate";
  else if (resolvedKey === "EmojiCreate") eventKey = "emojiCreate";
  else if (resolvedKey === "EmojiDelete") eventKey = "emojiDelete";
  else if (resolvedKey === "MemberMove" || resolvedKey === "MemberDisconnect" || resolvedKey === "VoiceChannelStatusCreate" || resolvedKey === "VoiceChannelStatusDelete") eventKey = "voiceJoin";

  const ch = targetChannel || (settings ? ((eventKey ? getLogChannel(guild, eventKey, settings) : null) || getLogChannel(guild, catKey, settings)) : null);
  if (!ch || !ch.isTextBased()) return null;
  const payload = buildGenericAuditLogPayload(entry, guild);
  return await ch.send(payload);
}

function isLogChannel(channelId, settings, guildId) {
  if (!settings || !guildId || !settings[guildId]?.logs) return false;
  const logs = settings[guildId].logs;
  if (logs.globalChannelId && logs.globalChannelId === channelId) return true;
  if (logs.categories) {
    for (const cat of Object.values(logs.categories)) {
      if (cat && cat.channelId === channelId) return true;
    }
  }
  if (logs.events) {
    for (const ev of Object.values(logs.events)) {
      if (ev && ev.channelId === channelId) return true;
    }
  }
  return false;
}

function formatDiffLines(text, prefix = "+ ") {
  if (!text) return `${prefix}(Nessun contenuto testuale)`;
  const safeText = String(text).slice(0, 1800);
  return safeText
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

function buildMessageCreatePayload(message) {
  const channel = message.channel || { id: message.channelId, name: "canale" };
  const author = message.author;
  const authorName = author?.discriminator && author.discriminator !== "0"
    ? author.tag
    : (author?.username || "Utente");

  const channelMention = `<#${channel.id}>`;
  const channelName = channel.name || "canale";
  const channelText = `${channelMention} ( \`${channelName}\` )`;

  const authorMention = author ? `<@${author.id}>` : "Autore";
  const authorText = `${authorMention} ( \`${authorName}\` )`;

  const messageUrl = message.url || `https://discord.com/channels/${message.guild?.id || "@me"}/${channel.id}/${message.id}`;
  const idText = `\`${message.id}\` • [Vai al Messaggio](${messageUrl})`;

  const rawContent = message.cleanContent || message.content;
  const diffContent = formatDiffLines(rawContent, "+ ");

  let attachmentText = "";
  if (message.attachments && message.attachments.size > 0) {
    const list = message.attachments.map((a) => `• [${a.name || "allegato"}](${a.url})`).join("\n");
    attachmentText = `\n\n**Allegati (${message.attachments.size}):**\n${list}`;
  }

  const description = [
    `> **Canale:** ${channelText}`,
    `> **Autore:** ${authorText}`,
    `> **ID Messaggio:** ${idText}`,
    "",
    "**Contenuto Inviato**",
    "```diff",
    diffContent,
    "```" + attachmentText
  ].join("\n");

  const avatarUrl = author?.displayAvatarURL?.({ dynamic: true, size: 256 })
    || author?.defaultAvatarURL;

  const embed = new EmbedBuilder()
    .setTitle("💬 Messaggio Inviato")
    .setColor("#5865F2")
    .setDescription(description);

  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  embed.setFooter({
    text: `@${authorName} • ${formatFooterDate(message.createdAt || new Date())}`,
    iconURL: avatarUrl || undefined
  });

  return {
    embeds: [embed]
  };
}

function buildMessageDeletePayload(message, executor = null) {
  const channel = message.channel || { id: message.channelId, name: "canale" };
  const author = message.author;
  const authorName = author?.discriminator && author.discriminator !== "0"
    ? author.tag
    : (author?.username || "Utente");

  const channelMention = `<#${channel.id}>`;
  const channelName = channel.name || "canale";
  const channelText = `${channelMention} ( \`${channelName}\` )`;

  const authorText = author
    ? `<@${author.id}> ( \`${authorName}\` )`
    : "*Autore sconosciuto*";

  const executorLine = executor
    ? `**Eliminato da:** <@${executor.id}> (\`${executor.tag || executor.username}\`)`
    : "";

  const rawContent = message.cleanContent || message.content;
  const diffContent = formatDiffLines(rawContent, "- ");

  let attachmentText = "";
  if (message.attachments && message.attachments.size > 0) {
    const list = message.attachments.map((a) => `• ${a.name || "allegato"}`).join("\n");
    attachmentText = `\n\n**Allegati Rimossi (${message.attachments.size}):**\n${list}`;
  }

  const descriptionLines = [
    `> **Canale:** ${channelText}`,
    `> **Autore:** ${authorText}`,
    `> **ID Messaggio:** \`${message.id}\``
  ];
  if (executorLine) descriptionLines.push(`> ${executorLine}`);
  descriptionLines.push("", "**Contenuto Rimosso**", "```diff", diffContent, "```" + attachmentText);

  const avatarUrl = author?.displayAvatarURL?.({ dynamic: true, size: 256 })
    || author?.defaultAvatarURL;

  const embed = new EmbedBuilder()
    .setTitle("🗑️ Messaggio Eliminato")
    .setColor("#ED4245")
    .setDescription(descriptionLines.join("\n"));

  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  embed.setFooter({
    text: `@${authorName} • ${formatFooterDate()}`,
    iconURL: avatarUrl || undefined
  });

  return {
    embeds: [embed]
  };
}

function buildMessageUpdatePayload(oldMessage, newMessage) {
  const channel = newMessage.channel || { id: newMessage.channelId, name: "canale" };
  const author = newMessage.author;
  const authorName = author?.discriminator && author.discriminator !== "0"
    ? author.tag
    : (author?.username || "Utente");

  const channelMention = `<#${channel.id}>`;
  const channelName = channel.name || "canale";
  const channelText = `${channelMention} ( \`${channelName}\` )`;

  const authorText = author
    ? `<@${author.id}> ( \`${authorName}\` )`
    : "*Autore sconosciuto*";

  const messageUrl = newMessage.url || `https://discord.com/channels/${newMessage.guild?.id || "@me"}/${channel.id}/${newMessage.id}`;
  const idText = `\`${newMessage.id}\` • [Vai al Messaggio](${messageUrl})`;

  const oldDiff = formatDiffLines(oldMessage.cleanContent || oldMessage.content, "- ");
  const newDiff = formatDiffLines(newMessage.cleanContent || newMessage.content, "+ ");

  const description = [
    `> **Canale:** ${channelText}`,
    `> **Autore:** ${authorText}`,
    `> **ID Messaggio:** ${idText}`,
    "",
    "**Prima:**",
    "```diff",
    oldDiff,
    "```",
    "**Dopo:**",
    "```diff",
    newDiff,
    "```"
  ].join("\n");

  const avatarUrl = author?.displayAvatarURL?.({ dynamic: true, size: 256 })
    || author?.defaultAvatarURL;

  const embed = new EmbedBuilder()
    .setTitle("✏️ Messaggio Modificato")
    .setColor("#FEE75C")
    .setDescription(description);

  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  embed.setFooter({
    text: `@${authorName} • ${formatFooterDate(newMessage.editedAt || new Date())}`,
    iconURL: avatarUrl || undefined
  });

  return {
    embeds: [embed]
  };
}

async function dispatchMessageCreateLog(guild, message, targetChannel = null, settings = null) {
  const channel = targetChannel || getLogChannel(guild, "messageCreate", settings);
  if (!channel || !channel.isTextBased()) return null;

  const payload = buildMessageCreatePayload(message);
  return await channel.send(payload);
}

async function dispatchMessageDeleteLog(guild, message, executor = null, targetChannel = null, settings = null) {
  const channel = targetChannel || getLogChannel(guild, "messageDelete", settings);
  if (!channel || !channel.isTextBased()) return null;

  const payload = buildMessageDeletePayload(message, executor);
  return await channel.send(payload);
}

async function dispatchMessageUpdateLog(guild, oldMessage, newMessage, targetChannel = null, settings = null) {
  const channel = targetChannel || getLogChannel(guild, "messageUpdate", settings);
  if (!channel || !channel.isTextBased()) return null;

  const payload = buildMessageUpdatePayload(oldMessage, newMessage);
  return await channel.send(payload);
}

async function getKickOrBanExecutor(guild, userId) {
  try {
    if (!guild?.members?.me?.permissions?.has?.(PermissionFlagsBits.ViewAuditLog)) return null;

    const banLogs = await guild.fetchAuditLogs?.({ type: AuditLogEvent.MemberBanAdd, limit: 1 })?.catch(() => null);
    if (banLogs?.entries) {
      const entry = banLogs.entries.first();
      if (entry && entry.target?.id === userId && Date.now() - entry.createdTimestamp < 6000) {
        return { type: "ban", executor: entry.executor, reason: entry.reason };
      }
    }

    const kickLogs = await guild.fetchAuditLogs?.({ type: AuditLogEvent.MemberKick, limit: 1 })?.catch(() => null);
    if (kickLogs?.entries) {
      const entry = kickLogs.entries.first();
      if (entry && entry.target?.id === userId && Date.now() - entry.createdTimestamp < 6000) {
        return { type: "kick", executor: entry.executor, reason: entry.reason };
      }
    }
  } catch (e) {}
  return null;
}

async function getExecutor(guild, auditLogType) {
  try {
    if (!guild.members.me?.permissions.has(PermissionFlagsBits.ViewAuditLog)) return null;
    const logs = await guild.fetchAuditLogs({ type: auditLogType, limit: 1 }).catch(() => null);
    if (!logs) return null;
    const entry = logs.entries.first();
    if (!entry) return null;
    if (Date.now() - entry.createdTimestamp < 5000) {
      return entry.executor;
    }
  } catch (e) {
    return null;
  }
  return null;
}

function getLogChannel(guild, eventKey, settings) {
  if (!guild || !settings) return null;
  const guildSettings = settings[guild.id];
  const logsConfig = guildSettings?.logs;
  if (!logsConfig || !logsConfig.enabled) return null;

  // Check if specific event is explicitly disabled
  if (logsConfig.events && logsConfig.events[eventKey] === false) return null;

  // 1. Check event-specific channel override (se abilitato specificamente)
  if (logsConfig.events?.[eventKey]?.channelId && logsConfig.events[eventKey]?.enabled === true) {
    const ch = guild.channels.cache.get(logsConfig.events[eventKey].channelId);
    if (ch && ch.isTextBased()) return ch;
  }

  // Fallback for memberJoin / memberLeave to uscite-entrate channel
  if (eventKey === "memberJoin" || eventKey === "memberLeave") {
    const leaveChId = guildSettings?.leave?.channelId;
    if (leaveChId) {
      const ch = guild.channels.cache.get(leaveChId);
      if (ch && ch.isTextBased()) return ch;
    }
  }

  // 2. Check category default channel:
  // Se è mappato in EVENT_CATEGORIES usa la categoria corrispondente,
  // altrimenti se eventKey è già esso stesso il nome di una categoria (es. 'messages', 'server', 'channels')
  let categoryKey = EVENT_CATEGORIES[eventKey];
  if (!categoryKey && logsConfig.categories && Object.prototype.hasOwnProperty.call(logsConfig.categories, eventKey)) {
    categoryKey = eventKey;
  }

  if (categoryKey && logsConfig.categories?.[categoryKey]?.enabled !== false) {
    const catChannelId = logsConfig.categories[categoryKey]?.channelId;
    if (catChannelId) {
      const ch = guild.channels.cache.get(catChannelId);
      if (ch && ch.isTextBased()) return ch;
    }
  }

  // 3. Se appartiene a server o generico, prova il canale della categoria server (#🗄️・altro)
  if (categoryKey === "server" && logsConfig.categories?.server?.channelId) {
    const ch = guild.channels.cache.get(logsConfig.categories.server.channelId);
    if (ch && ch.isTextBased()) return ch;
  }

  // 4. Fallback al canale globale configurato
  if (logsConfig.globalChannelId) {
    const ch = guild.channels.cache.get(logsConfig.globalChannelId);
    if (ch && ch.isTextBased()) return ch;
  }

  return null;
}

function createLogEmbed(guild, title, fields, color = "#5865F2") {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setTimestamp()
    .setFooter({ text: `${guild.name} • Audit Log`, iconURL: guild.iconURL({ dynamic: true }) || undefined });

  fields.forEach(f => {
    if (f.value) embed.addFields({ name: f.name, value: String(f.value).slice(0, 1024), inline: f.inline || false });
  });

  return embed;
}

function initLoggerEngine(client, loadSettingsFn) {
  // Inizializza tracciatore inviti per attribuire chi invita chi
  try {
    if (client.isReady?.() && client.guilds?.cache) {
      client.guilds.cache.forEach((g) => cacheGuildInvites(g));
    }
    client.on?.(Events.ClientReady, () => {
      if (client.guilds?.cache) {
        client.guilds.cache.forEach((g) => cacheGuildInvites(g));
      }
    });
    client.on?.(Events.GuildCreate, (g) => cacheGuildInvites(g));
    client.on?.(Events.InviteCreate, async (invite) => {
      try {
        if (!invite?.guild?.id) return;
        const cache = guildInvites.get(invite.guild.id) || new Map();
        cache.set(invite.code, {
          code: invite.code,
          uses: invite.uses || 0,
          inviter: invite.inviter || null
        });
        guildInvites.set(invite.guild.id, cache);

        const settings = typeof loadSettingsFn === "function" ? loadSettingsFn() : {};
        const targetChannel = getLogChannel(invite.guild, "inviteCreate", settings);
        if (!targetChannel) return;

        const payload = buildInviteCreatePayload(invite);
        await targetChannel.send(payload).catch(() => null);
      } catch (e) {
        console.error("[LoggerEngine] Errore evento InviteCreate:", e.message);
      }
    });
    client.on?.(Events.InviteDelete, async (invite) => {
      try {
        if (!invite?.guild?.id) return;
        const cache = guildInvites.get(invite.guild.id);
        const cachedInv = cache?.get(invite.code);
        if (cache) {
          cache.delete(invite.code);
        }

        const settings = typeof loadSettingsFn === "function" ? loadSettingsFn() : {};
        const targetChannel = getLogChannel(invite.guild, "inviteDelete", settings);
        if (!targetChannel) return;

        const payload = buildInviteDeletePayload(cachedInv || invite);
        await targetChannel.send(payload).catch(() => null);
      } catch (e) {
        console.error("[LoggerEngine] Errore evento InviteDelete:", e.message);
      }
    });
  } catch (e) {}

  // 1. Canali
  // 1. Canali (Fedeli agli Screenshot media_1789827056319, media_1789827048634, media_1789827068237)
  client.on(Events.ChannelCreate, async (channel) => {
    try {
      if (!channel.guild) return;
      const targetChannel = getLogChannel(channel.guild, "channelCreate", loadSettingsFn());
      if (!targetChannel) return;

      const executor = await getExecutor(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
      const payload = buildChannelCreatePayload(channel, executor);
      await targetChannel.send(payload).catch(() => null);
    } catch (e) {
      console.error("[LoggerEngine] Errore evento ChannelCreate:", e.message);
    }
  });

  client.on(Events.ChannelDelete, async (channel) => {
    try {
      if (!channel.guild) return;
      const targetChannel = getLogChannel(channel.guild, "channelDelete", loadSettingsFn());
      if (!targetChannel) return;

      const executor = await getExecutor(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
      const payload = buildChannelDeletePayload(channel, executor);
      await targetChannel.send(payload).catch(() => null);
    } catch (e) {
      console.error("[LoggerEngine] Errore evento ChannelDelete:", e.message);
    }
  });

  client.on(Events.ChannelUpdate, async (oldChannel, newChannel) => {
    try {
      if (!newChannel.guild) return;
      const targetChannel = getLogChannel(newChannel.guild, "channelUpdate", loadSettingsFn());
      if (!targetChannel) return;

      const executor = await getExecutor(newChannel.guild, AuditLogEvent.ChannelUpdate, newChannel.id);
      const payload = buildChannelUpdatePayload(oldChannel, newChannel, executor);
      await targetChannel.send(payload).catch(() => null);
    } catch (e) {
      console.error("[LoggerEngine] Errore evento ChannelUpdate:", e.message);
    }
  });

  // 2. Membri & Utenti (Log Entrate e Uscite Fedeli allo Screenshot)
  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      const targetChannel = getLogChannel(member.guild, "memberJoin", loadSettingsFn());
      if (!targetChannel) return;

      const usedInvite = await findUsedInvite(member);
      const payload = buildMemberJoinPayload(member, usedInvite);
      await targetChannel.send(payload).catch(() => null);
    } catch (e) {
      console.error("[LoggerEngine] Errore evento GuildMemberAdd:", e.message);
    }
  });

  client.on(Events.GuildMemberRemove, async (member) => {
    try {
      const targetChannel = getLogChannel(member.guild, "memberLeave", loadSettingsFn());
      if (!targetChannel) return;

      const modAction = await getKickOrBanExecutor(member.guild, member.id);
      const payload = buildMemberLeavePayload(member, modAction);
      await targetChannel.send(payload).catch(() => null);
    } catch (e) {
      console.error("[LoggerEngine] Errore evento GuildMemberRemove:", e.message);
    }
  });

  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    try {
      const settings = typeof loadSettingsFn === "function" ? loadSettingsFn() : {};

      // Ruoli aggiunti
      const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
      if (addedRoles.size > 0) {
        const executor = await getExecutor(newMember.guild, AuditLogEvent.MemberRoleUpdate, newMember.id);
        markDispatched(AuditLogEvent.MemberRoleUpdate, newMember.id);
        markDispatched("MemberRoleUpdate", newMember.id);
        for (const [roleId, role] of addedRoles) {
          await dispatchMemberRoleAddLog(newMember.guild, newMember, role, executor, null, settings).catch(() => null);
        }
      }

      // Ruoli rimossi
      const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));
      if (removedRoles.size > 0) {
        const executor = await getExecutor(newMember.guild, AuditLogEvent.MemberRoleUpdate, newMember.id);
        markDispatched(AuditLogEvent.MemberRoleUpdate, newMember.id);
        markDispatched("MemberRoleUpdate", newMember.id);
        for (const [roleId, role] of removedRoles) {
          await dispatchMemberRoleRemoveLog(newMember.guild, newMember, role, executor, null, settings).catch(() => null);
        }
      }

      // Timeout / Mute
      if (oldMember.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp) {
        const isTimeout = newMember.isCommunicationDisabled();
        const executor = await getExecutor(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);
        markDispatched(AuditLogEvent.MemberUpdate, newMember.id);
        markDispatched("MemberUpdate", newMember.id);
        await dispatchMemberTimeoutLog(
          newMember.guild,
          newMember,
          isTimeout ? newMember.communicationDisabledUntilTimestamp : null,
          null,
          executor,
          !isTimeout,
          null,
          settings
        ).catch(() => null);
      }

      // Modifica Nickname
      if (oldMember.nickname !== newMember.nickname) {
        const executor = await getExecutor(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);
        markDispatched(AuditLogEvent.MemberUpdate, newMember.id);
        markDispatched("MemberUpdate", newMember.id);
        await dispatchMemberNickUpdateLog(
          newMember.guild,
          oldMember,
          newMember,
          executor,
          null,
          settings
        ).catch(() => null);
      }
    } catch (e) {
      console.error("[LoggerEngine] Errore evento GuildMemberUpdate:", e.message);
    }
  });

  // Aggiornamento Profilo Globale Utente
  client.on(Events.UserUpdate, async (oldUser, newUser) => {
    try {
      if (oldUser.username === newUser.username && oldUser.globalName === newUser.globalName && oldUser.avatar === newUser.avatar) return;
      const settings = typeof loadSettingsFn === "function" ? loadSettingsFn() : {};
      if (client.guilds?.cache) {
        for (const guild of client.guilds.cache.values()) {
          if (guild.members?.cache?.has(newUser.id)) {
            await dispatchUserUpdateLog(guild, oldUser, newUser, null, settings).catch(() => null);
          }
        }
      }
    } catch (e) {
      console.error("[LoggerEngine] Errore evento UserUpdate:", e.message);
    }
  });

  // 3. Messaggi (Fedeli allo Screenshot media_1789827027277.png)
  client.on(Events.MessageCreate, async (message) => {
    try {
      if (!message.guild || message.author?.bot) return;

      const settings = typeof loadSettingsFn === "function" ? loadSettingsFn() : {};
      const targetChannel = getLogChannel(message.guild, "messageCreate", settings);
      if (!targetChannel) return;

      // Anti-loop di sicurezza: non loggare messaggi inviati nei canali di log
      if (message.channelId === targetChannel.id || isLogChannel(message.channelId, settings, message.guild.id)) return;

      // Ignora messaggi vuoti senza allegati
      if (!message.content && (!message.attachments || message.attachments.size === 0)) return;

      const payload = buildMessageCreatePayload(message);
      await targetChannel.send(payload).catch(() => null);
    } catch (e) {
      console.error("[LoggerEngine] Errore evento MessageCreate:", e.message);
    }
  });

  client.on(Events.MessageDelete, async (message) => {
    try {
      if (!message.guild || message.author?.bot) return;

      const settings = typeof loadSettingsFn === "function" ? loadSettingsFn() : {};
      const targetChannel = getLogChannel(message.guild, "messageDelete", settings);
      if (!targetChannel) return;

      if (message.channelId === targetChannel.id || isLogChannel(message.channelId, settings, message.guild.id)) return;

      const executor = await getExecutor(message.guild, AuditLogEvent.MessageDelete);
      markDispatched(AuditLogEvent.MessageDelete, message.id);
      markDispatched("MessageDelete", message.id);
      if (message.author?.id) {
        markDispatched(AuditLogEvent.MessageDelete, message.author.id);
        markDispatched("MessageDelete", message.author.id);
      }
      const payload = buildMessageDeletePayload(message, executor);
      await targetChannel.send(payload).catch(() => null);
    } catch (e) {
      console.error("[LoggerEngine] Errore evento MessageDelete:", e.message);
    }
  });

  client.on(Events.MessageBulkDelete, async (messages, channel) => {
    try {
      if (!channel?.guild) return;
      const settings = typeof loadSettingsFn === "function" ? loadSettingsFn() : {};
      const executor = await getExecutor(channel.guild, AuditLogEvent.MessageBulkDelete);
      markDispatched(AuditLogEvent.MessageBulkDelete, channel.id);
      markDispatched("MessageBulkDelete", channel.id);
      await dispatchMessageBulkDeleteLog(channel.guild, channel, messages.size, executor, null, settings).catch(() => null);
    } catch (e) {
      console.error("[LoggerEngine] Errore evento MessageBulkDelete:", e.message);
    }
  });

  client.on(Events.ChannelPinsUpdate, async (channel) => {
    try {
      if (!channel?.guild) return;
      const settings = typeof loadSettingsFn === "function" ? loadSettingsFn() : {};
      const executor = await getExecutor(channel.guild, AuditLogEvent.MessagePin) || await getExecutor(channel.guild, AuditLogEvent.MessageUnpin);
      markDispatched(AuditLogEvent.MessagePin, channel.id);
      markDispatched("MessagePin", channel.id);
      markDispatched("MessageUnpin", channel.id);
      await dispatchChannelPinsUpdateLog(channel.guild, channel, executor, null, settings).catch(() => null);
    } catch (e) {
      console.error("[LoggerEngine] Errore evento ChannelPinsUpdate:", e.message);
    }
  });

  client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    try {
      if (!newMessage.guild || newMessage.author?.bot) return;
      if (oldMessage.content === newMessage.content) return;

      const settings = typeof loadSettingsFn === "function" ? loadSettingsFn() : {};
      const targetChannel = getLogChannel(newMessage.guild, "messageUpdate", settings);
      if (!targetChannel) return;

      if (newMessage.channelId === targetChannel.id || isLogChannel(newMessage.channelId, settings, newMessage.guild.id)) return;

      const payload = buildMessageUpdatePayload(oldMessage, newMessage);
      await targetChannel.send(payload).catch(() => null);
    } catch (e) {
      console.error("[LoggerEngine] Errore evento MessageUpdate:", e.message);
    }
  });

  // 4. Canali Vocali (Fedeli allo Screenshot media_1789827088593.png)
  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    try {
      const guild = newState.guild || oldState.guild;
      const member = newState.member || oldState.member;
      if (!guild || !member || member.user?.bot) return;

      const settings = typeof loadSettingsFn === "function" ? loadSettingsFn() : {};

      // 1. Join Vocale
      if (!oldState.channelId && newState.channelId) {
        const channel = newState.channel || guild.channels.cache.get(newState.channelId);
        if (!channel) return;
        const targetChannel = getLogChannel(guild, "voiceJoin", settings);
        if (!targetChannel) return;
        const payload = buildVoiceJoinPayload(member, channel);
        await targetChannel.send(payload).catch(() => null);
      }
      // 2. Leave Vocale
      else if (oldState.channelId && !newState.channelId) {
        const channel = oldState.channel || guild.channels.cache.get(oldState.channelId);
        if (!channel) return;
        const targetChannel = getLogChannel(guild, "voiceLeave", settings);
        if (!targetChannel) return;
        const payload = buildVoiceLeavePayload(member, channel);
        await targetChannel.send(payload).catch(() => null);
      }
      // 3. Switch Vocale
      else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        const oldChannel = oldState.channel || guild.channels.cache.get(oldState.channelId);
        const newChannel = newState.channel || guild.channels.cache.get(newState.channelId);
        if (!oldChannel || !newChannel) return;
        const targetChannel = getLogChannel(guild, "voiceSwitch", settings);
        if (!targetChannel) return;
        const payload = buildVoiceSwitchPayload(member, oldChannel, newChannel);
        await targetChannel.send(payload).catch(() => null);
      }

      // 4. Mute e Deafen (Server & Self)
      if (oldState.serverMute !== newState.serverMute) {
        const executor = await getExecutor(guild, AuditLogEvent.MemberUpdate, member.id);
        markDispatched("MemberUpdate", member.id);
        await dispatchVoiceMuteDeafLog(guild, member, "Server Mute", newState.serverMute, executor, null, settings).catch(() => null);
      } else if (oldState.serverDeaf !== newState.serverDeaf) {
        const executor = await getExecutor(guild, AuditLogEvent.MemberUpdate, member.id);
        markDispatched("MemberUpdate", member.id);
        await dispatchVoiceMuteDeafLog(guild, member, "Server Deafen", newState.serverDeaf, executor, null, settings).catch(() => null);
      } else if (oldState.selfMute !== newState.selfMute) {
        await dispatchVoiceMuteDeafLog(guild, member, "Microfono", newState.selfMute, null, null, settings).catch(() => null);
      } else if (oldState.selfDeaf !== newState.selfDeaf) {
        await dispatchVoiceMuteDeafLog(guild, member, "Cuffie", newState.selfDeaf, null, null, settings).catch(() => null);
      }

      // 5. Streaming & Video Activity
      if (oldState.streaming !== newState.streaming) {
        const ch = newState.channel || oldState.channel || guild.channels.cache.get(newState.channelId || oldState.channelId);
        if (ch) await dispatchVoiceActivityLog(guild, member, ch, "Condivisione Schermo", newState.streaming, null, settings).catch(() => null);
      }
      if (oldState.selfVideo !== newState.selfVideo) {
        const ch = newState.channel || oldState.channel || guild.channels.cache.get(newState.channelId || oldState.channelId);
        if (ch) await dispatchVoiceActivityLog(guild, member, ch, "Video / Camera", newState.selfVideo, null, settings).catch(() => null);
      }
    } catch (e) {
      console.error("[LoggerEngine] Errore evento VoiceStateUpdate:", e.message);
    }
  });

  // 5. Moderazione (Ban & Unban)
  client.on(Events.GuildBanAdd, async (ban) => {
    try {
      markDispatched(AuditLogEvent.MemberBanAdd, ban.user.id);
      markDispatched("MemberBanAdd", ban.user.id);
      markDispatched(22, ban.user.id);
      const executor = await getExecutor(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
      await dispatchBanLog(ban.guild, ban.user, ban.reason, executor, false, null, loadSettingsFn()).catch(() => null);
    } catch (e) {
      console.error("[LoggerEngine] Errore evento GuildBanAdd:", e.message);
    }
  });

  client.on(Events.GuildBanRemove, async (ban) => {
    try {
      markDispatched(AuditLogEvent.MemberBanRemove, ban.user.id);
      markDispatched("MemberBanRemove", ban.user.id);
      markDispatched(23, ban.user.id);
      const executor = await getExecutor(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);
      await dispatchBanLog(ban.guild, ban.user, null, executor, true, null, loadSettingsFn()).catch(() => null);
    } catch (e) {
      console.error("[LoggerEngine] Errore evento GuildBanRemove:", e.message);
    }
  });

  // 6. Ruoli (Fedeli allo Screenshot media_1789827133317.png)
  client.on(Events.GuildRoleCreate, async (role) => {
    try {
      const targetChannel = getLogChannel(role.guild, "roleCreate", loadSettingsFn());
      if (!targetChannel) return;

      const executor = await getExecutor(role.guild, AuditLogEvent.RoleCreate, role.id);
      markDispatched(AuditLogEvent.RoleCreate, role.id);
      markDispatched("RoleCreate", role.id);
      const payload = buildRoleCreatePayload(role, executor);
      await targetChannel.send(payload).catch(() => null);
    } catch (e) {
      console.error("[LoggerEngine] Errore evento GuildRoleCreate:", e.message);
    }
  });

  client.on(Events.GuildRoleDelete, async (role) => {
    try {
      const targetChannel = getLogChannel(role.guild, "roleDelete", loadSettingsFn());
      if (!targetChannel) return;

      const executor = await getExecutor(role.guild, AuditLogEvent.RoleDelete, role.id);
      markDispatched(AuditLogEvent.RoleDelete, role.id);
      markDispatched("RoleDelete", role.id);
      const payload = buildRoleDeletePayload(role, executor);
      await targetChannel.send(payload).catch(() => null);
    } catch (e) {
      console.error("[LoggerEngine] Errore evento GuildRoleDelete:", e.message);
    }
  });

  client.on(Events.GuildRoleUpdate, async (oldRole, newRole) => {
    try {
      if (oldRole.name === newRole.name && oldRole.hexColor === newRole.hexColor && oldRole.permissions?.bitfield === newRole.permissions?.bitfield) {
        return;
      }
      const targetChannel = getLogChannel(newRole.guild, "roleUpdate", loadSettingsFn());
      if (!targetChannel) return;

      const executor = await getExecutor(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);
      markDispatched(AuditLogEvent.RoleUpdate, newRole.id);
      markDispatched("RoleUpdate", newRole.id);
      const payload = buildRoleUpdatePayload(oldRole, newRole, executor);
      await targetChannel.send(payload).catch(() => null);
    } catch (e) {
      console.error("[LoggerEngine] Errore evento GuildRoleUpdate:", e.message);
    }
  });

  // 7. Server & Altro (Fedeli allo Screenshot media_1789827150538.png)
  client.on(Events.GuildUpdate, async (oldGuild, newGuild) => {
    try {
      const targetChannel = getLogChannel(newGuild, "serverUpdate", loadSettingsFn());
      if (!targetChannel) return;

      const executor = await getExecutor(newGuild, AuditLogEvent.GuildUpdate);
      markDispatched(AuditLogEvent.GuildUpdate, newGuild.id);
      markDispatched("GuildUpdate", newGuild.id);
      const payload = buildServerUpdatePayload(oldGuild, newGuild, executor);
      await targetChannel.send(payload).catch(() => null);
    } catch (e) {
      console.error("[LoggerEngine] Errore evento GuildUpdate:", e.message);
    }
  });

  client.on(Events.GuildEmojiCreate, async (emoji) => {
    try {
      const targetChannel = getLogChannel(emoji.guild, "emojiCreate", loadSettingsFn());
      if (!targetChannel) return;

      const executor = await getExecutor(emoji.guild, AuditLogEvent.EmojiCreate, emoji.id);
      markDispatched(AuditLogEvent.EmojiCreate, emoji.id);
      markDispatched("EmojiCreate", emoji.id);
      const payload = buildEmojiCreatePayload(emoji, executor);
      await targetChannel.send(payload).catch(() => null);
    } catch (e) {
      console.error("[LoggerEngine] Errore evento GuildEmojiCreate:", e.message);
    }
  });

  client.on(Events.GuildEmojiDelete, async (emoji) => {
    try {
      const targetChannel = getLogChannel(emoji.guild, "emojiDelete", loadSettingsFn());
      if (!targetChannel) return;

      const executor = await getExecutor(emoji.guild, AuditLogEvent.EmojiDelete, emoji.id);
      markDispatched(AuditLogEvent.EmojiDelete, emoji.id);
      markDispatched("EmojiDelete", emoji.id);
      const payload = buildEmojiDeletePayload(emoji, executor);
      await targetChannel.send(payload).catch(() => null);
    } catch (e) {
      console.error("[LoggerEngine] Errore evento GuildEmojiDelete:", e.message);
    }
  });

  // 8. AutoMod Execution & Regole
  if (Events.AutoModerationActionExecution) {
    client.on(Events.AutoModerationActionExecution, async (execution) => {
      try {
        if (!execution?.guild) return;
        markDispatched("AutoModerationBlockMessage", execution.userId);
        markDispatched("AutoModerationFlagToChannel", execution.userId);
        await dispatchAutoModActionLog(execution.guild, execution, null, loadSettingsFn()).catch(() => null);
      } catch (e) {
        console.error("[LoggerEngine] Errore evento AutoModerationActionExecution:", e.message);
      }
    });
  }

  if (Events.AutoModerationRuleCreate) {
    client.on(Events.AutoModerationRuleCreate, async (rule) => {
      try {
        const executor = await getExecutor(rule.guild, AuditLogEvent.AutoModerationRuleCreate, rule.id);
        markDispatched(AuditLogEvent.AutoModerationRuleCreate, rule.id);
        markDispatched("AutoModerationRuleCreate", rule.id);
        await dispatchAutoModRuleLog(rule.guild, rule, "Create", executor, null, loadSettingsFn()).catch(() => null);
      } catch (e) {}
    });
    client.on(Events.AutoModerationRuleDelete, async (rule) => {
      try {
        const executor = await getExecutor(rule.guild, AuditLogEvent.AutoModerationRuleDelete, rule.id);
        markDispatched(AuditLogEvent.AutoModerationRuleDelete, rule.id);
        markDispatched("AutoModerationRuleDelete", rule.id);
        await dispatchAutoModRuleLog(rule.guild, rule, "Delete", executor, null, loadSettingsFn()).catch(() => null);
      } catch (e) {}
    });
    client.on(Events.AutoModerationRuleUpdate, async (oldRule, newRule) => {
      try {
        const executor = await getExecutor(newRule.guild, AuditLogEvent.AutoModerationRuleUpdate, newRule.id);
        markDispatched(AuditLogEvent.AutoModerationRuleUpdate, newRule.id);
        markDispatched("AutoModerationRuleUpdate", newRule.id);
        await dispatchAutoModRuleLog(newRule.guild, newRule, "Update", executor, null, loadSettingsFn()).catch(() => null);
      } catch (e) {}
    });
  }

  // 9. Sticker
  if (Events.GuildStickerCreate) {
    client.on(Events.GuildStickerCreate, async (sticker) => {
      try {
        const executor = await getExecutor(sticker.guild, AuditLogEvent.StickerCreate, sticker.id);
        markDispatched(AuditLogEvent.StickerCreate, sticker.id);
        markDispatched("StickerCreate", sticker.id);
        await dispatchStickerLog(sticker.guild, sticker, "Create", executor, null, loadSettingsFn()).catch(() => null);
      } catch (e) {}
    });
    client.on(Events.GuildStickerDelete, async (sticker) => {
      try {
        const executor = await getExecutor(sticker.guild, AuditLogEvent.StickerDelete, sticker.id);
        markDispatched(AuditLogEvent.StickerDelete, sticker.id);
        markDispatched("StickerDelete", sticker.id);
        await dispatchStickerLog(sticker.guild, sticker, "Delete", executor, null, loadSettingsFn()).catch(() => null);
      } catch (e) {}
    });
    client.on(Events.GuildStickerUpdate, async (oldSticker, newSticker) => {
      try {
        const executor = await getExecutor(newSticker.guild, AuditLogEvent.StickerUpdate, newSticker.id);
        markDispatched(AuditLogEvent.StickerUpdate, newSticker.id);
        markDispatched("StickerUpdate", newSticker.id);
        await dispatchStickerLog(newSticker.guild, newSticker, "Update", executor, null, loadSettingsFn()).catch(() => null);
      } catch (e) {}
    });
  }

  // 10. Thread
  if (Events.ThreadCreate) {
    client.on(Events.ThreadCreate, async (thread) => {
      try {
        if (!thread?.guild) return;
        const executor = await getExecutor(thread.guild, AuditLogEvent.ThreadCreate, thread.id);
        markDispatched(AuditLogEvent.ThreadCreate, thread.id);
        markDispatched("ThreadCreate", thread.id);
        await dispatchThreadLog(thread.guild, thread, "Create", executor, null, loadSettingsFn()).catch(() => null);
      } catch (e) {}
    });
    client.on(Events.ThreadDelete, async (thread) => {
      try {
        if (!thread?.guild) return;
        const executor = await getExecutor(thread.guild, AuditLogEvent.ThreadDelete, thread.id);
        markDispatched(AuditLogEvent.ThreadDelete, thread.id);
        markDispatched("ThreadDelete", thread.id);
        await dispatchThreadLog(thread.guild, thread, "Delete", executor, null, loadSettingsFn()).catch(() => null);
      } catch (e) {}
    });
    client.on(Events.ThreadUpdate, async (oldThread, newThread) => {
      try {
        if (!newThread?.guild) return;
        const executor = await getExecutor(newThread.guild, AuditLogEvent.ThreadUpdate, newThread.id);
        markDispatched(AuditLogEvent.ThreadUpdate, newThread.id);
        markDispatched("ThreadUpdate", newThread.id);
        await dispatchThreadLog(newThread.guild, newThread, "Update", executor, null, loadSettingsFn()).catch(() => null);
      } catch (e) {}
    });
  }

  // 11. Palchi (Stage Instances)
  if (Events.StageInstanceCreate) {
    client.on(Events.StageInstanceCreate, async (stage) => {
      try {
        const executor = await getExecutor(stage.guild, AuditLogEvent.StageInstanceCreate, stage.id);
        markDispatched(AuditLogEvent.StageInstanceCreate, stage.id);
        markDispatched("StageInstanceCreate", stage.id);
        await dispatchStageInstanceLog(stage.guild, stage, "Create", executor, null, loadSettingsFn()).catch(() => null);
      } catch (e) {}
    });
    client.on(Events.StageInstanceDelete, async (stage) => {
      try {
        const executor = await getExecutor(stage.guild, AuditLogEvent.StageInstanceDelete, stage.id);
        markDispatched(AuditLogEvent.StageInstanceDelete, stage.id);
        markDispatched("StageInstanceDelete", stage.id);
        await dispatchStageInstanceLog(stage.guild, stage, "Delete", executor, null, loadSettingsFn()).catch(() => null);
      } catch (e) {}
    });
    client.on(Events.StageInstanceUpdate, async (oldStage, newStage) => {
      try {
        const executor = await getExecutor(newStage.guild, AuditLogEvent.StageInstanceUpdate, newStage.id);
        markDispatched(AuditLogEvent.StageInstanceUpdate, newStage.id);
        markDispatched("StageInstanceUpdate", newStage.id);
        await dispatchStageInstanceLog(newStage.guild, newStage, "Update", executor, null, loadSettingsFn()).catch(() => null);
      } catch (e) {}
    });
  }

  // 12. Eventi Programmati (Scheduled Events)
  if (Events.GuildScheduledEventCreate) {
    client.on(Events.GuildScheduledEventCreate, async (event) => {
      try {
        const executor = await getExecutor(event.guild, AuditLogEvent.GuildScheduledEventCreate, event.id);
        markDispatched(AuditLogEvent.GuildScheduledEventCreate, event.id);
        markDispatched("GuildScheduledEventCreate", event.id);
        await dispatchScheduledEventLog(event.guild, event, "Create", executor, null, loadSettingsFn()).catch(() => null);
      } catch (e) {}
    });
    client.on(Events.GuildScheduledEventDelete, async (event) => {
      try {
        const executor = await getExecutor(event.guild, AuditLogEvent.GuildScheduledEventDelete, event.id);
        markDispatched(AuditLogEvent.GuildScheduledEventDelete, event.id);
        markDispatched("GuildScheduledEventDelete", event.id);
        await dispatchScheduledEventLog(event.guild, event, "Delete", executor, null, loadSettingsFn()).catch(() => null);
      } catch (e) {}
    });
    client.on(Events.GuildScheduledEventUpdate, async (oldEvent, newEvent) => {
      try {
        const executor = await getExecutor(newEvent.guild, AuditLogEvent.GuildScheduledEventUpdate, newEvent.id);
        markDispatched(AuditLogEvent.GuildScheduledEventUpdate, newEvent.id);
        markDispatched("GuildScheduledEventUpdate", newEvent.id);
        await dispatchScheduledEventLog(newEvent.guild, newEvent, "Update", executor, null, loadSettingsFn()).catch(() => null);
      } catch (e) {}
    });
  }

  // 13. Webhook Updates
  if (Events.WebhooksUpdate) {
    client.on(Events.WebhooksUpdate, async (channel) => {
      try {
        if (!channel?.guild) return;
        const executor = await getExecutor(channel.guild, AuditLogEvent.WebhookUpdate, channel.id);
        markDispatched(AuditLogEvent.WebhookUpdate, channel.id);
        markDispatched("WebhookUpdate", channel.id);
        await dispatchWebhookUpdateLog(channel.guild, channel, executor, null, loadSettingsFn()).catch(() => null);
      } catch (e) {}
    });
  }

  // 14. Fallback Universale per TUTTI i 157+ Eventi di Audit Log
  if (Events.GuildAuditLogEntryCreate) {
    client.on(Events.GuildAuditLogEntryCreate, async (entry, guild) => {
      try {
        if (!guild) return;
        const targetId = entry.targetId || entry.target?.id;
        
        // Se già gestito dal gateway dedicato, non duplicare
        if (wasRecentlyDispatched(entry.action, targetId) || wasRecentlyDispatched(String(entry.action), targetId)) {
          return;
        }

        const settings = typeof loadSettingsFn === "function" ? loadSettingsFn() : {};
        await dispatchGenericAuditLog(guild, entry, null, settings).catch(() => null);
      } catch (e) {
        console.error("[LoggerEngine] Errore fallback universale GuildAuditLogEntryCreate:", e.message);
      }
    });
  }

  console.log("[LoggerEngine] Motore di Logging Multi-Guild a 157+ eventi attivo!");
}

module.exports = {
  initLoggerEngine,
  EVENT_CATEGORIES,
  AUDIT_ACTION_LABELS,
  AUDIT_ACTION_CATEGORY,
  markDispatched,
  wasRecentlyDispatched,
  buildMemberJoinPayload,
  buildMemberLeavePayload,
  dispatchMemberJoinLog,
  dispatchMemberLeaveLog,
  buildMessageCreatePayload,
  buildMessageDeletePayload,
  buildMessageUpdatePayload,
  dispatchMessageCreateLog,
  dispatchMessageDeleteLog,
  dispatchMessageUpdateLog,
  buildChannelCreatePayload,
  buildChannelDeletePayload,
  buildChannelUpdatePayload,
  dispatchChannelCreateLog,
  dispatchChannelDeleteLog,
  dispatchChannelUpdateLog,
  formatVoiceChannelName,
  buildVoiceJoinPayload,
  buildVoiceSwitchPayload,
  buildVoiceLeavePayload,
  dispatchVoiceJoinLog,
  dispatchVoiceSwitchLog,
  dispatchVoiceLeaveLog,
  buildVerificationCompletePayload,
  dispatchVerificationCompleteLog,
  buildMemberRoleAddPayload,
  buildMemberRoleRemovePayload,
  buildRoleUpdatePayload,
  buildRoleCreatePayload,
  buildRoleDeletePayload,
  dispatchMemberRoleAddLog,
  dispatchMemberRoleRemoveLog,
  dispatchRoleUpdateLog,
  dispatchRoleCreateLog,
  dispatchRoleDeleteLog,
  buildInviteCreatePayload,
  buildInviteDeletePayload,
  buildServerUpdatePayload,
  buildEmojiCreatePayload,
  buildEmojiDeletePayload,
  dispatchInviteCreateLog,
  dispatchInviteDeleteLog,
  dispatchServerUpdateLog,
  dispatchEmojiCreateLog,
  dispatchEmojiDeleteLog,
  buildMemberNickUpdatePayload,
  dispatchMemberNickUpdateLog,
  buildMemberTimeoutPayload,
  dispatchMemberTimeoutLog,
  buildUserUpdatePayload,
  dispatchUserUpdateLog,
  buildMessageBulkDeletePayload,
  dispatchMessageBulkDeleteLog,
  buildChannelPinsUpdatePayload,
  dispatchChannelPinsUpdateLog,
  buildVoiceMuteDeafPayload,
  dispatchVoiceMuteDeafLog,
  buildVoiceActivityPayload,
  dispatchVoiceActivityLog,
  buildBanPayload,
  dispatchBanLog,
  buildAutoModActionPayload,
  dispatchAutoModActionLog,
  buildAutoModRulePayload,
  dispatchAutoModRuleLog,
  buildStickerPayload,
  dispatchStickerLog,
  buildThreadPayload,
  dispatchThreadLog,
  buildStageInstancePayload,
  dispatchStageInstanceLog,
  buildScheduledEventPayload,
  dispatchScheduledEventLog,
  buildWebhookUpdatePayload,
  dispatchWebhookUpdateLog,
  buildGenericAuditLogPayload,
  dispatchGenericAuditLog,
  formatChannelType,
  formatTimeAgo,
  formatFooterDate,
  formatDiffLines,
  isLogChannel,
  cacheGuildInvites,
  guildInvites
};
