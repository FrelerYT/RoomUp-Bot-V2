function resolveVariables(text, context = {}) {
  if (typeof text !== "string") return text;
  
  const {
    user,
    member,
    guild,
    channel,
    moderation,
    ticket,
    xp,
    giveaway,
    suggestion,
    counting,
    minecraft,
    custom = {}
  } = context;

  const now = new Date();

  const replacements = {
    // User / Member
    "{user}": user ? `<@${user.id}>` : (member ? `<@${member.id}>` : ""),
    "{username}": user?.username || member?.user?.username || "Utente",
    "{displayName}": member?.displayName || user?.globalName || user?.username || "Utente",
    "{userId}": user?.id || member?.id || "",
    "{userAvatar}": user?.displayAvatarURL?.({ dynamic: true }) || member?.user?.displayAvatarURL?.({ dynamic: true }) || "",
    "{joinedAt}": member?.joinedAt ? member.joinedAt.toLocaleDateString("it-IT") : "",
    "{createdAt}": user?.createdAt ? user.createdAt.toLocaleDateString("it-IT") : "",

    // Guild
    "{guild}": guild?.name || "Server",
    "{guildName}": guild?.name || "Server",
    "{guildId}": guild?.id || "",
    "{memberCount}": guild?.memberCount ? String(guild.memberCount) : "0",
    "{owner}": guild?.ownerId ? `<@${guild.ownerId}>` : "",
    "{guildIcon}": guild?.iconURL?.({ dynamic: true }) || "",

    // Channel
    "{channel}": channel ? (channel.id ? `<#${channel.id}>` : (channel.name ? `#${channel.name}` : "")) : "",
    "{channelName}": channel?.name || "",
    "{channelId}": channel?.id || "",

    // Moderation
    "{reason}": moderation?.reason || "Nessun motivo specificato",
    "{moderator}": moderation?.moderatorTag || (moderation?.moderatorId ? `<@${moderation.moderatorId}>` : "Sistema"),
    "{caseId}": moderation?.caseId ? String(moderation.caseId) : "0",
    "{action}": moderation?.action || "Azione",
    "{duration}": moderation?.duration || "Permanente",
    "{warnCount}": moderation?.warnCount ? String(moderation.warnCount) : "1",

    // Ticket
    "{ticketId}": ticket?.id || "0",
    "{ticketAuthor}": ticket?.authorId ? `<@${ticket.authorId}>` : "",
    "{ticketStaff}": ticket?.staffId ? `<@${ticket.staffId}>` : "In attesa",

    // XP
    "{level}": xp?.level ? String(xp.level) : "1",
    "{xp}": xp?.xp ? String(xp.xp) : "0",
    "{rank}": xp?.rank ? String(xp.rank) : "1",

    // Giveaway
    "{prize}": giveaway?.prize || "Premio",
    "{winners}": giveaway?.winners || "Vincitori",
    "{jumpUrl}": giveaway?.jumpUrl || "",

    // Counting
    "{lastNumber}": counting?.lastNumber ? String(counting.lastNumber) : "0",
    "{correctNumber}": counting?.correctNumber ? String(counting.correctNumber) : "1",
    "{number}": counting?.number ? String(counting.number) : "0",

    // Time
    "{date}": now.toLocaleDateString("it-IT"),
    "{time}": now.toLocaleTimeString("it-IT"),
    "{timestamp}": String(Math.floor(now.getTime() / 1000)),

    // Custom overrides
    ...custom
  };

  let resolved = text;
  for (const [placeholder, val] of Object.entries(replacements)) {
    if (val !== undefined && val !== null) {
      resolved = resolved.split(placeholder).join(String(val));
    }
  }

  return resolved;
}

const AVAILABLE_VARIABLES = [
  { key: "{user}", desc: "Menzione utente (<@ID>)" },
  { key: "{username}", desc: "Nome utente Discord" },
  { key: "{displayName}", desc: "Nome visualizzato o nickname" },
  { key: "{userId}", desc: "ID univoco dell'utente" },
  { key: "{guild}", desc: "Nome del server" },
  { key: "{memberCount}", desc: "Numero totale membri del server" },
  { key: "{channel}", desc: "Menzione del canale (<#ID>)" },
  { key: "{reason}", desc: "Motivazione sanzione o azione" },
  { key: "{moderator}", desc: "Moderatore o sistema responsabile" },
  { key: "{caseId}", desc: "Numero univoco del caso disciplinare" },
  { key: "{warnCount}", desc: "Totale avvertimenti accumulati" },
  { key: "{level}", desc: "Livello XP attuale" },
  { key: "{ticketId}", desc: "Numero del ticket di supporto" },
  { key: "{prize}", desc: "Premio del giveaway" },
  { key: "{winners}", desc: "Vincitori estratti" },
  { key: "{date}", desc: "Data corrente (GG/MM/AAAA)" },
  { key: "{time}", desc: "Ora corrente (HH:MM)" }
];

module.exports = { resolveVariables, AVAILABLE_VARIABLES };
