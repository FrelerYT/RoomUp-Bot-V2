const fs = require("fs");
const path = require("path");
const { respondToTicket, learnFromTranscript, notifyTicketClaimed } = require("./aiTicketEngine");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder,
  MessageFlags
} = require("discord.js");

const DEFAULT_TICKET_CATEGORIES = [
  {
    key: "general",
    label: "Supporto generale",
    icon: "🛠️",
    desc: "Domande, bug, shop e segnalazioni.",
    questions: [
      { label: "Descrivi il problema o la tua richiesta", style: "Paragraph", required: true, placeholder: "Spiega nel dettaglio cosa è successo o di cosa hai bisogno..." }
    ]
  },
  {
    key: "partnership",
    label: "Partnership",
    icon: "🤝",
    desc: "Richiedi una partnership con il server.",
    questions: [
      { label: "Quanti membri ha il tuo server?", style: "Short", required: true, placeholder: "Es: 500, 1200, 3k..." }
    ]
  },
  {
    key: "staff_app",
    label: "Candidature Staff",
    icon: "📄",
    desc: "Candidati come Staff su Discord, Minecraft o entrambi.",
    questions: [
      { label: "Quanti anni hai?", style: "Short", required: true, placeholder: "Devi avere almeno 14 anni" },
      { label: "Per quale piattaforma ti candidi?", style: "Short", required: true, placeholder: "Discord / Minecraft / Partnership / Tutti" },
      { label: "Esperienza precedente da Staff", style: "Paragraph", required: true, placeholder: "Descrivi server o progetti in cui hai già ricoperto un ruolo Staff..." },
      { label: "Perché vuoi entrare nello Staff di RoomUp?", style: "Paragraph", required: false, placeholder: "Motivati, cosa ti spinge a candidarti?" },
      { label: "Disponibilita settimanale (ore/giorni)", style: "Short", required: false, placeholder: "Es: lunedi-venerdi, 2-3 ore al giorno..." }
    ]
  },
  {
    key: "media_app",
    label: "Candidatura Content Creator o Media",
    icon: "🎥",
    desc: "Candidati come Media o Content Creator.",
    questions: [
      { label: "Link al tuo canale o profilo social principale", style: "Short", required: true, placeholder: "Es: youtube.com/..., twitch.tv/..., tiktok.com/..." },
      { label: "Numero di iscritti o follower", style: "Short", required: true, placeholder: "Es: 500 iscritti YouTube, 1k follower TikTok..." },
      { label: "Tipo di contenuto che produci", style: "Short", required: true, placeholder: "Es: gaming, vlog, tutorial Minecraft, clip Discord..." },
      { label: "Perche vuoi collaborare con RoomUp?", style: "Paragraph", required: false, placeholder: "Spiegaci la tua proposta e cosa puoi portare alla community..." }
    ]
  }
];

/**
 * Send or update a Ticket Panel in a Discord channel
 */
async function sendTicketPanel(channel, panelData = {}) {
  if (!channel || !channel.isTextBased()) {
    throw new Error("Canale non valido o non testuale.");
  }

  const panelId = panelData.id || "panel_default";
  const title = panelData.title || "SUPPORTO";
  const desc = panelData.description || `Crea un ticket per:

• Problemi con il tuo **account**
• Problemi riguardanti lo **shop**
• **Segnalazioni**
• Candidature **Staff**
• Candidature **Content Creator**
• Altre richieste o necessità

Clicca qui sotto per scegliere una sezione
e creare il tuo ticket.`;
  const color = panelData.color || "#731FC3";
  const placeholder = panelData.placeholder || "Seleziona una categoria di ticket...";
  const footer = panelData.footer || "RoomUp! Support System";

  const files = [];

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .setColor(color)
    .setFooter({ text: footer });

  // Thumbnail (ticket_thumb.png)
  if (panelData.showThumbnail !== false) {
    const thumbPath = path.join(__dirname, "../../assets/ticket_thumb.png");
    if (panelData.thumbnail && typeof panelData.thumbnail === "string" && panelData.thumbnail.trim().startsWith("http")) {
      embed.setThumbnail(panelData.thumbnail.trim());
    } else if (fs.existsSync(thumbPath)) {
      files.push(new AttachmentBuilder(thumbPath, { name: "ticket_thumb.png" }));
      embed.setThumbnail("attachment://ticket_thumb.png");
    }
  }

  // Divider bar (welcome_bar.png)
  if (panelData.useDividerBar !== false) {
    const dividerPath = path.join(__dirname, "../../assets/welcome_bar.png");
    if (fs.existsSync(dividerPath)) {
      files.push(new AttachmentBuilder(dividerPath, { name: "welcome_bar.png" }));
      embed.setImage("attachment://welcome_bar.png");
    } else if (panelData.image && typeof panelData.image === "string" && panelData.image.trim().startsWith("http")) {
      embed.setImage(panelData.image.trim());
    }
  } else if (panelData.image && typeof panelData.image === "string" && panelData.image.trim().startsWith("http")) {
    embed.setImage(panelData.image.trim());
  }

  // Build Options
  const rawCategories = Array.isArray(panelData.categories) ? panelData.categories : [];
  const validCategories = rawCategories.filter(c => c && c.enabled !== false);
  const categoriesList = validCategories.length > 0 ? validCategories : DEFAULT_TICKET_CATEGORIES;

  const options = categoriesList.slice(0, 25).map((cat, idx) => {
    const key = cat.key || cat.id || `cat_${idx}`;
    const label = (cat.label || cat.customTitle || cat.title || key).slice(0, 100);
    let emoji = cat.icon || "🎫";
    if (!emoji || emoji.startsWith("fa-") || emoji.includes("fa-") || emoji.length > 8) {
      if (key.includes("partner")) emoji = "🤝";
      else if (key.includes("staff")) emoji = "📄";
      else if (key.includes("media") || key.includes("creator")) emoji = "🎥";
      else if (key.includes("general") || key.includes("support")) emoji = "🛠️";
      else if (key.includes("unban") || key.includes("appeal") || key.includes("sanzion")) emoji = "⚖️";
      else emoji = "🎫";
    }

    const categoryDesc = (cat.desc || cat.description || "").slice(0, 100);

    const opt = {
      label: label,
      value: key
    };
    if (categoryDesc) opt.description = categoryDesc;
    if (emoji) opt.emoji = emoji;
    return opt;
  });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`ticket_select_${panelId}`)
    .setPlaceholder(placeholder.slice(0, 100))
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(selectMenu);

  return await channel.send({ embeds: [embed], components: [row], files });
}

/**
 * Helper to find panel from settings
 */
function findPanelConfig(settings, guildId, panelId) {
  const g = settings[guildId] || {};
  if (Array.isArray(g.ticketPanels)) {
    const found = g.ticketPanels.find(p => p.id === panelId);
    if (found) return found;
  }
  return g.ticketPanel || { id: "panel_default" };
}

/**
 * Helper to find category config from panel or settings
 */
function findCategoryConfig(panelConfig, guildConfig, typeKey) {
  if (Array.isArray(panelConfig.categories)) {
    const found = panelConfig.categories.find(c => (c.key === typeKey || c.id === typeKey));
    if (found) return found;
  }
  if (guildConfig.tickets && guildConfig.tickets[typeKey]) {
    return guildConfig.tickets[typeKey];
  }
  const defaultCat = DEFAULT_TICKET_CATEGORIES.find(c => c.key === typeKey);
  if (defaultCat) return defaultCat;
  return { key: typeKey, label: typeKey, icon: "🎫" };
}

/**
 * Recupera l'ID del creatore del ticket
 */
function getTicketCreatorId(channel) {
  if (!channel) return null;
  // 1. Dall'overwrite specifico utente (type 1 = Member)
  const userOverwrite = channel.permissionOverwrites?.cache.find(
    ow => ow.type === 1 && ow.id !== channel.client.user.id
  );
  if (userOverwrite) return userOverwrite.id;

  // 2. Dal topic del canale: es. "Ticket #0004 di username (123456789)"
  const topicMatch = (channel.topic || "").match(/\((\d{17,20})\)/);
  if (topicMatch) return topicMatch[1];

  return null;
}

/**
 * Verifica se un membro è Staff abilitato a gestire il ticket
 */
function isTicketStaff(member, channel, guildConfig = {}) {
  if (!member) return false;

  // Ruolo Staff Globale Tassativo
  if (member.roles?.cache) {
    if (typeof member.roles.cache.has === "function" && (member.roles.cache.has("1550846887085740125") || member.roles.cache.has("1554969549076566117"))) return true;
    if (Array.isArray(member.roles.cache) && member.roles.cache.some(r => ["1550846887085740125", "1554969549076566117"].includes(typeof r === "string" ? r : r.id))) return true;
  }

  // 1. Permessi Administrator, ManageChannels, ManageGuild
  if (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageChannels) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild)
  ) {
    return true;
  }

  // 2. Ruoli con permesso ViewChannel esplicito sul canale del ticket
  if (channel && channel.permissionOverwrites) {
    const hasChannelStaffRole = channel.permissionOverwrites.cache.some(ow => {
      if (ow.type === 0 && ow.id !== channel.guild.id) {
        if (ow.allow.has(PermissionFlagsBits.ViewChannel)) {
          return member.roles.cache.has(ow.id);
        }
      }
      return false;
    });
    if (hasChannelStaffRole) return true;
  }

  // 3. Ruoli Staff configurati nel bot
  const staffRoleIds = new Set([
    ...(guildConfig.tickets?.staffRoleIds || []),
    ...(guildConfig.ticketPanel?.viewRoles || []),
    ...(guildConfig.ticketPanel?.allowedRoles || [])
  ]);

  if (Array.isArray(guildConfig.ticketPanels)) {
    guildConfig.ticketPanels.forEach(p => {
      (p.viewRoles || []).forEach(r => staffRoleIds.add(r));
      (p.allowedRoles || []).forEach(r => staffRoleIds.add(r));
      (p.categories || []).forEach(c => (c.viewRoles || []).forEach(r => staffRoleIds.add(r)));
    });
  }

  return member.roles.cache.some(r => staffRoleIds.has(r.id));
}

/**
 * Create a new Ticket Channel in Discord
 */
async function createTicketChannel(guild, user, typeKey, panelId, modalAnswers = null, settings = {}, saveSettingsFn = null, loadSettingsFn = null) {
  const freshSettings = typeof loadSettingsFn === 'function' ? loadSettingsFn() : settings;
  const guildConfig = freshSettings[guild.id] || {};
  const panelConfig = findPanelConfig(freshSettings, guild.id, panelId);
  const catConfig = findCategoryConfig(panelConfig, guildConfig, typeKey);

  // Ruoli Staff con accesso a questo ticket
  const staffRoleSet = new Set();
  if (guild.id === "965378975675322438") staffRoleSet.add("1554969549076566117");
  else staffRoleSet.add("1550846887085740125");

  if (Array.isArray(catConfig.viewRoles)) catConfig.viewRoles.forEach(r => staffRoleSet.add(r));
  if (Array.isArray(catConfig.staffRoleIds)) catConfig.staffRoleIds.forEach(r => staffRoleSet.add(r));
  if (Array.isArray(panelConfig.viewRoles)) panelConfig.viewRoles.forEach(r => staffRoleSet.add(r));
  if (Array.isArray(panelConfig.staffRoleIds)) panelConfig.staffRoleIds.forEach(r => staffRoleSet.add(r));
  if (Array.isArray(guildConfig.tickets?.staffRoleIds)) guildConfig.tickets.staffRoleIds.forEach(r => staffRoleSet.add(r));
  if (Array.isArray(guildConfig.staffRoles)) guildConfig.staffRoles.forEach(r => staffRoleSet.add(r));

  const effectiveRoles = Array.from(staffRoleSet);

  const catTitle = catConfig.label || catConfig.customTitle || catConfig.title || typeKey;

  // Categoria genitore Discord: dedicata per categoria, o di sezione, o fallback
  let targetParentId = catConfig.categoryId || panelConfig.categoryId || null;
  if (!targetParentId) {
    const fallbackCategory = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes("ticket"));
    if (fallbackCategory) targetParentId = fallbackCategory.id;
  }

  // Increment Counter
  const currentCount = Number(guildConfig.ticketCounter) || 0;
  const newCount = currentCount + 1;
  guildConfig.ticketCounter = newCount;
  if (typeof saveSettingsFn === 'function') {
    saveSettingsFn(freshSettings);
  }

  const formattedNum = String(newCount).padStart(4, '0');
  const channelName = `ticket-${formattedNum}`;

  // Permission Overwrites
  const overwrites = [
    {
      id: guild.id, // @everyone
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: user.id, // Creator
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    },
    {
      id: guild.members.me.id, // Bot
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    }
  ];

  // Add Effective Staff Roles (Ruolo 1550846887085740125 + ruoli di categoria/pannello)
  effectiveRoles.forEach(roleId => {
    overwrites.push({
      id: roleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    });
  });

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: targetParentId || undefined,
    topic: `Ticket #${formattedNum} di ${user.tag} (${user.id}) | ${catTitle}`,
    permissionOverwrites: overwrites
  });

  const descLines = [
    `> **Creato da:** <@${user.id}> (\`@${user.username}\`)`,
    `> **Sezione / Pannello:** **${panelConfig.name || panelConfig.title || "Supporto"}**`,
    `> **Categoria:** **${catTitle}**`,
    `> **Stato:** 🟢 **Aperto**`
  ];
  if (effectiveRoles.length > 0) {
    descLines.push(`> **Staff Notificato:** ${effectiveRoles.map(r => `<@&${r}>`).join(" ")}`);
  }
  descLines.push("", catConfig.desc || catConfig.customDescription || "Uno staffer prenderà in carico la tua richiesta il prima possibile.");

  // Welcome Embed
  const titleTpl = guildConfig.tickets?.welcomeEmbedTitle || "{icon} Ticket #{ticketNumber} • {category}";
  const welcomeTitle = titleTpl
    .replace(/{icon}/g, catConfig.icon || "🎫")
    .replace(/{ticketNumber}/g, formattedNum)
    .replace(/{category}/g, catTitle);

  const footerTpl = guildConfig.tickets?.welcomeEmbedFooter || "ID Canale: {channel} • RoomUp! V2 Ticket System";
  const footerText = footerTpl.replace(/{channel}/g, channel.id);

  const welcomeEmbed = new EmbedBuilder()
    .setTitle(welcomeTitle)
    .setColor(guildConfig.tickets?.welcomeEmbedColor || panelConfig.color || 0x5865F2)
    .setDescription(descLines.join("\n"))
    .setFooter({ text: footerText })
    .setTimestamp();

  if (guildConfig.tickets?.showThumbnail !== false) {
    welcomeEmbed.setThumbnail(user.displayAvatarURL({ dynamic: true }));
  }

  if (modalAnswers && Object.keys(modalAnswers).length > 0) {
    Object.entries(modalAnswers).forEach(([q, a]) => {
      welcomeEmbed.addFields({
        name: `📋 ${q}`,
        value: `>>> ${(a || "Nessuna risposta").slice(0, 1020)}`
      });
    });
  }

  // Buttons inside Ticket (Granular toggles)
  const buttons = [];
  if (guildConfig.tickets?.allowClaim !== false) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`ticket_claim_${channel.id}`)
        .setLabel("Prendi in Carico")
        .setStyle(ButtonStyle.Success)
        .setEmoji("👑")
    );
  }
  if (guildConfig.tickets?.allowClose !== false) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`ticket_close_${channel.id}`)
        .setLabel("Chiudi Ticket")
        .setStyle(ButtonStyle.Danger)
        .setEmoji("🔒")
    );
  }
  const btnRow = new ActionRowBuilder().addComponents(buttons);

  const staffPings = effectiveRoles.length > 0 ? effectiveRoles.map(r => `<@&${r}>`).join(" ") : "";
  const welcomeContent = [
    `👋 Ciao <@${user.id}>, benvenuto nel tuo ticket!`,
    `> Lo staff è stato notificato e ti risponderà al più presto.`,
    staffPings ? `\n||${staffPings}||` : ""
  ].filter(Boolean).join("\n");

  await channel.send({
    content: welcomeContent,
    embeds: [welcomeEmbed],
    components: [btnRow]
  });

  // 🤖 SENTINEL AI — Risposta automatica al ticket (se abilitata)
  if (guildConfig.tickets?.aiAssistEnabled !== false) {
    // Non blocca la creazione del ticket — risponde in background
    setImmediate(async () => {
      try {
        const { defaultMemoryEngine } = require("../sentinel/memory-engine/MemoryEngine");
        defaultMemoryEngine.createTicketMemory(guild.id, channel.id, {
          ticketId: channel.id,
          channelId: channel.id,
          category: typeKey === "partnership" ? "PARTNERSHIP" : typeKey,
          userId: user.id,
          username: user.username,
          problem: Object.values(modalAnswers || {}).join(" ") || catTitle || "Assistenza richiesta",
          userGoal: catTitle,
          knownFacts: Object.entries(modalAnswers || {}).map(([k, v]) => `${k}: ${v}`),
          currentState: "IN_PROGRESS",
          mode: "AI_ACTIVE"
        });

        await respondToTicket(channel, typeKey, catTitle, modalAnswers || {}, guild.id, user.id);
      } catch (e) {
        console.error("[TicketEngine] Errore AI auto-risposta:", e.message);
      }
    });
  }

  return channel;
}

/**
 * Sincronizza permessi su tutti i canali ticket attivi per garantire la visualizzazione
 * a tutti gli utenti con il ruolo staff 1550846887085740125
 */
async function syncStaffTicketPermissionsAll(client, loadSettingsFn) {
  if (!client || !client.guilds) return;
  try {
    const settings = typeof loadSettingsFn === 'function' ? loadSettingsFn() : {};
    for (const [guildId, guild] of client.guilds.cache) {
      const guildConfig = settings[guildId] || {};
      const defaultStaffId = guildId === "965378975675322438" ? "1554969549076566117" : "1550846887085740125";
      const staffRoleIds = new Set([
        defaultStaffId,
        ...(guildConfig.tickets?.staffRoleIds || []),
        ...(guildConfig.staffRoles || []),
        ...(guildConfig.partnerships?.staffRoleIds || [])
      ]);

      const ticketChannels = guild.channels.cache.filter(c =>
        c.isTextBased && c.isTextBased() && (c.name.startsWith("ticket-") || c.name.startsWith("partnership-") || c.topic?.includes("Ticket #") || c.parent?.name?.toLowerCase().includes("ticket"))
      );

      for (const [chId, ch] of ticketChannels) {
        for (const roleId of staffRoleIds) {
          try {
            await ch.permissionOverwrites.edit(roleId, {
              ViewChannel: true,
              SendMessages: true,
              ReadMessageHistory: true,
              AttachFiles: true,
              EmbedLinks: true
            }, { reason: "Accesso globale staff ai ticket (Ruolo 1550846887085740125)" });
          } catch (e) {}
        }
      }
    }
  } catch (err) {}
}

/**
 * Initialize Ticket Engine Listeners
 */
function initTicketEngine(client, loadSettingsFn, saveSettingsFn) {
  if (!client) return;

  // Sincronizza subito e all'evento ready i permessi per il ruolo 1550846887085740125 su tutti i ticket
  syncStaffTicketPermissionsAll(client, loadSettingsFn);
  client.on("ready", () => {
    syncStaffTicketPermissionsAll(client, loadSettingsFn);
  });

  client.on("interactionCreate", async (interaction) => {
    try {
      const guild = interaction.guild;
      if (!guild) return;

      const settings = typeof loadSettingsFn === 'function' ? loadSettingsFn() : {};
      const guildConfig = settings[guild.id] || {};

      // 1. SELECT MENU SELECTION
      if (interaction.isStringSelectMenu() && (interaction.customId.startsWith("ticket_select_") || interaction.customId === "ticket_select_type")) {
        let panelId = "panel_default";
        if (interaction.customId.startsWith("ticket_select_")) {
          panelId = interaction.customId.replace("ticket_select_", "");
        }

        const selectedType = interaction.values[0];
        const panelConfig = findPanelConfig(settings, guild.id, panelId);
        const catConfig = findCategoryConfig(panelConfig, guildConfig, selectedType);

        // Check if Questions / Modal is configured
        let questions = [];
        if (Array.isArray(catConfig.questions) && catConfig.questions.length > 0) {
          questions = catConfig.questions.filter(q => typeof q === 'string' ? q.trim() !== '' : (q && q.label));
        }

        if (questions.length > 0) {
          const modal = new ModalBuilder()
            .setCustomId(`ticket_modal:::${panelId}:::${selectedType}`)
            .setTitle((catConfig.label || catConfig.customTitle || "Modulo Ticket").slice(0, 45));

          questions.slice(0, 5).forEach((qObj, idx) => {
            const label = typeof qObj === 'string' ? qObj : (qObj.label || `Domanda ${idx + 1}`);
            const isRequired = typeof qObj === 'object' ? (qObj.required !== false) : (idx === 0);
            const usesParagraph = typeof qObj === 'object'
              ? (qObj.style === 'Paragraph' || qObj.style === 'paragraph' || qObj.style === 'long')
              : (idx === 0);
            const placeholder = typeof qObj === 'object' ? (qObj.placeholder || '') : '';

            const input = new TextInputBuilder()
              .setCustomId(`t_q_${idx}`)
              .setLabel(label.slice(0, 45))
              .setStyle(usesParagraph ? TextInputStyle.Paragraph : TextInputStyle.Short)
              .setRequired(isRequired)
              .setMaxLength(usesParagraph ? 1000 : 200);

            if (placeholder) input.setPlaceholder(placeholder.slice(0, 100));

            modal.addComponents(new ActionRowBuilder().addComponents(input));
          });

          return await interaction.showModal(modal).catch(() => {});
        } else {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
          const ch = await createTicketChannel(guild, interaction.user, selectedType, panelId, null, settings, saveSettingsFn, loadSettingsFn);
          return await interaction.editReply({ content: `✅ **Ticket aperto con successo in <#${ch.id}>!**` });
        }
      }

      // 2. MODAL SUBMIT
      if (interaction.isModalSubmit() && (interaction.customId.startsWith("ticket_modal:::") || interaction.customId.startsWith("ticket_modal_"))) {
        let panelId = "panel_default";
        let selectedType = "";

        if (interaction.customId.startsWith("ticket_modal:::")) {
          const parts = interaction.customId.replace("ticket_modal:::", "").split(":::");
          panelId = parts[0] || "panel_default";
          selectedType = parts[1] || "";
        } else {
          const raw = interaction.customId.replace("ticket_modal_", "");
          if (raw.startsWith("panel_default_")) {
            panelId = "panel_default";
            selectedType = raw.replace("panel_default_", "");
          } else {
            const allPanels = Array.isArray(guildConfig.ticketPanels) ? guildConfig.ticketPanels : [];
            const matchedPanel = allPanels.find(p => raw.startsWith(p.id + "_"));
            if (matchedPanel) {
              panelId = matchedPanel.id;
              selectedType = raw.slice(matchedPanel.id.length + 1);
            } else {
              const parts = raw.split("_");
              panelId = parts[0] || "panel_default";
              selectedType = parts.slice(1).join("_");
            }
          }
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const panelConfig = findPanelConfig(settings, guild.id, panelId);
        const catConfig = findCategoryConfig(panelConfig, guildConfig, selectedType);
        const questions = Array.isArray(catConfig.questions) ? catConfig.questions : [];

        const answers = {};
        questions.slice(0, 5).forEach((qObj, idx) => {
          const label = typeof qObj === 'string' ? qObj : (qObj.label || `Domanda ${idx + 1}`);
          try {
            const val = interaction.fields.getTextInputValue(`t_q_${idx}`);
            if (val) answers[label] = val;
          } catch (e) {}
        });

        const ch = await createTicketChannel(guild, interaction.user, selectedType, panelId, answers, settings, saveSettingsFn, loadSettingsFn);
        return await interaction.editReply({ content: `✅ **Ticket aperto con successo in <#${ch.id}>!**` });
      }

      // 3. CLAIM TICKET (STAFF ONLY)
      if (interaction.isButton() && interaction.customId.startsWith("ticket_claim_")) {
        const member = interaction.member;
        const channel = interaction.channel;
        const creatorId = getTicketCreatorId(channel);

        if (creatorId && interaction.user.id === creatorId) {
          return interaction.reply({
            content: "❌ Non puoi prendere in carico il tuo stesso ticket!",
            flags: MessageFlags.Ephemeral
          });
        }

        const isStaff = isTicketStaff(member, channel, guildConfig);
        if (!isStaff) {
          return interaction.reply({
            content: "❌ Solo i membri dello Staff autorizzati possono prendere in carico questo ticket.",
            flags: MessageFlags.Ephemeral
          });
        }

        const chId = interaction.customId.replace("ticket_claim_", "");
        const originalMsg = interaction.message;
        const oldEmbed = originalMsg.embeds && originalMsg.embeds[0] ? EmbedBuilder.from(originalMsg.embeds[0]) : null;

        if (oldEmbed) {
          let oldDesc = oldEmbed.data.description || "";
          if (oldDesc.includes("In gestione da") || oldDesc.includes("Reclamato da")) {
            return interaction.reply({ content: "⚠️ Questo ticket è già stato preso in carico da un membro dello Staff!", flags: MessageFlags.Ephemeral });
          }

          let newDesc = oldDesc;
          if (oldDesc.includes("> **Stato:** 🟢 **Aperto**")) {
            newDesc = oldDesc.replace("> **Stato:** 🟢 **Aperto**", `> **Stato:** 🟡 **In gestione da <@${interaction.user.id}>**`);
          } else {
            newDesc = `${oldDesc}\n\n📌 **In gestione da:** <@${interaction.user.id}>`;
          }
          oldEmbed.setDescription(newDesc);

          const updatedRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`ticket_claimed_${interaction.user.id}`)
              .setLabel(`Reclamato da @${interaction.user.username}`)
              .setStyle(ButtonStyle.Secondary)
              .setEmoji("👑")
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId(`ticket_close_${chId}`)
              .setLabel("Chiudi Ticket")
              .setStyle(ButtonStyle.Danger)
              .setEmoji("🔒")
          );

          await originalMsg.edit({ embeds: [oldEmbed], components: [updatedRow] }).catch(() => {});

          try {
            notifyTicketClaimed(channel.id, interaction.user);
            const { defaultMemoryEngine } = require("../sentinel/memory-engine/MemoryEngine");
            const { OPERATIONAL_MODES, TICKET_STATES } = require("../sentinel/ticket-engine/SentinelTicketEngine");
            defaultMemoryEngine.updateTicketMemory(guild.id, channel.id, {
              mode: OPERATIONAL_MODES.STAFF_ACTIVE,
              currentState: TICKET_STATES.STAFF_TAKEOVER
            });
          } catch (e) {}

          return await interaction.reply({
            content: `👑 <@${interaction.user.id}> ha **reclamato** e preso in carico questo ticket!`
          });
        }
      }

      // 4. CLOSE TICKET (STAFF ONLY)
      if (interaction.isButton() && interaction.customId.startsWith("ticket_close_")) {
        const member = interaction.member;
        const channel = interaction.channel;
        const creatorId = getTicketCreatorId(channel);

        // Gli utenti che aprono i ticket non possono chiuderli
        if (creatorId && interaction.user.id === creatorId) {
          return interaction.reply({
            content: "❌ Non puoi chiudere il ticket. Solo i membri dello Staff autorizzati possono chiuderlo.",
            flags: MessageFlags.Ephemeral
          });
        }

        // Solo chi può vedere il ticket in staff può farlo
        const isStaff = isTicketStaff(member, channel, guildConfig);
        if (!isStaff) {
          return interaction.reply({
            content: "❌ Solo i membri dello Staff autorizzati a gestire questo ticket possono chiuderlo.",
            flags: MessageFlags.Ephemeral
          });
        }

        await interaction.reply({ content: `🔒 <@${interaction.user.id}> ha richiesto la chiusura del ticket. Salvataggio transcript e chiusura in corso...` });

        // Generate Transcript
        try {
          const messages = await interaction.channel.messages.fetch({ limit: 100 }).catch(() => null);

          let transcriptText = `=======================================================\n`;
          transcriptText += `TRANSCRIPT TICKET: #${interaction.channel.name}\n`;
          transcriptText += `Server: ${interaction.guild.name} (${interaction.guild.id})\n`;
          transcriptText += `Chiuso da: ${interaction.user.tag} (${interaction.user.id})\n`;
          transcriptText += `Data Chiusura: ${new Date().toISOString()}\n`;
          transcriptText += `=======================================================\n\n`;

          if (messages && messages.size > 0) {
            const sorted = Array.from(messages.values()).reverse();
            sorted.forEach(m => {
              const time = new Date(m.createdTimestamp).toLocaleString('it-IT');
              transcriptText += `[${time}] ${m.author.tag} (${m.author.id}):\n${m.content || '(Embed / Allegato)'}\n\n`;
            });
          }

          let attachment = null;
          if (guildConfig.tickets?.generateTranscript !== false) {
            const buffer = Buffer.from(transcriptText, 'utf-8');
            attachment = new AttachmentBuilder(buffer, { name: `transcript-${interaction.channel.name}.txt` });
          }

          // 🤖 SENTINEL AI — Apprende dal transcript chiuso
          if (guildConfig.tickets?.aiAssistEnabled !== false && messages && messages.size > 0) {
            try {
              // Determina la categoria dal topic del canale
              const topicMatch = (interaction.channel.topic || "").match(/\|\s*(.+)$/);
              const categoryFromTopic = topicMatch ? topicMatch[1].trim().toLowerCase() : "";
              const categoryKeyMap = {
                "supporto generale": "general", "partnership": "partnership",
                "candidature staff": "staff_app", "candidatura content creator o media": "media_app"
              };
              const learnedCategoryKey = Object.entries(categoryKeyMap)
                .find(([label]) => categoryFromTopic.includes(label))?.[1] || "general";

              // Estrai messaggi dello staff (non del bot, non del creatore ticket)
              const staffMessages = Array.from(messages.values())
                .filter(m =>
                  !m.author.bot &&
                  m.content &&
                  m.content.length > 20 &&
                  m.author.id !== creatorId &&
                  isTicketStaff(interaction.guild.members.cache.get(m.author.id), interaction.channel, guildConfig)
                )
                .map(m => m.content)
                .slice(0, 10); // max 10 messaggi staff

              if (staffMessages.length > 0) {
                learnFromTranscript(interaction.guild.id, learnedCategoryKey, transcriptText, staffMessages);
              }
            } catch (aiErr) {
              console.error("[TicketEngine] Errore apprendimento AI:", aiErr.message);
            }
          }

          // Send to Creator in DM if enabled
          if (guildConfig.tickets?.sendDmTranscript !== false && creatorId) {
            const creatorUser = await client.users.fetch(creatorId).catch(() => null);
            if (creatorUser) {
              const dmTpl = guildConfig.tickets?.closeDmMessage || "Il tuo ticket **#{ticketNumber}** su **{guild}** è stato chiuso da **{moderator}**.";
              const dmText = dmTpl
                .replace(/{ticketNumber}/g, interaction.channel.name)
                .replace(/{guild}/g, interaction.guild.name)
                .replace(/{moderator}/g, interaction.user.tag);
              const dmPayload = { content: dmText };
              if (attachment) dmPayload.files = [attachment];
              await creatorUser.send(dmPayload).catch(() => null);
            }
          }

          // Send to the configured Transcript / Log Channel if enabled
          const panelConfig = guildConfig.ticketPanel || {};
          const transcriptChannelId = panelConfig.transcriptChannelId || (guildConfig.tickets && guildConfig.tickets.transcriptChannelId) || guildConfig.tickets?.logChannelId;
          if (guildConfig.tickets?.sendLog !== false && transcriptChannelId) {
            const transChannel = guild.channels.cache.get(transcriptChannelId) || await guild.channels.fetch(transcriptChannelId).catch(() => null);
            if (transChannel && transChannel.isTextBased()) {

              // Ricava ticket number dal topic o dal nome canale
              const topicNumMatch = interaction.channel.topic?.match(/Ticket #(\d+)/i);
              const ticketNumMatch = interaction.channel.name.match(/(\d+)$/);
              const ticketNum = topicNumMatch ? parseInt(topicNumMatch[1], 10) : (ticketNumMatch ? parseInt(ticketNumMatch[1], 10) : interaction.channel.name);

              // Orario di apertura dal canale
              const openTime = interaction.channel.createdAt
                ? interaction.channel.createdAt.toLocaleString("it-IT", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
                : "Sconosciuto";

              // Claimed by: cerca il messaggio di claim nel canale
              let claimedBy = null;
              if (messages && messages.size > 0) {
                const claimMsg = Array.from(messages.values()).find(m =>
                  m.author.bot && (m.content?.toLowerCase().includes("claim") || m.embeds?.some(e => e.description?.toLowerCase().includes("claim")))
                );
                if (claimMsg) claimedBy = claimMsg.author.id;
              }

              // Reason: cerca il motivo dalla risposta al close (per ora "Non specificato")
              const closeReason = guildConfig.tickets?.defaultCloseReason || "Non specificato";

              const logEmbed = new EmbedBuilder()
                .setTitle("Ticket Closed")
                .setColor(0x2B2D31)
                .addFields(
                  { name: "Ticket ID",   value: `${ticketNum}`,                                          inline: true },
                  { name: "Opened By",   value: creatorId ? `<@${creatorId}>` : "Sconosciuto",           inline: true },
                  { name: "Closed By",   value: `<@${interaction.user.id}>`,                             inline: true },
                  { name: "Open Time",   value: openTime,                                                 inline: true },
                  { name: "Claimed By",  value: claimedBy ? `<@${claimedBy}>` : "Nessuno",               inline: true },
                  { name: "Reason",      value: closeReason,                                              inline: true }
                )
                .setTimestamp();

              const logPayload = { embeds: [logEmbed] };
              if (attachment) logPayload.files = [attachment];
              await transChannel.send(logPayload).catch((err) => console.error("[TicketEngine] Errore invio log canale:", err.message));
            }
          }

        } catch (e) {
          console.error("[TicketEngine] Errore generazione transcript:", e.message);
        }

        // Delete channel after 5 seconds
        setTimeout(async () => {
          await interaction.channel.delete(`Chiusura ticket da parte di ${interaction.user.tag}`).catch(() => {});
        }, 5000);
      }

    } catch (err) {
      console.error("[TicketEngine] Errore interactionCreate:", err);
    }
  });

  console.log("[TicketEngine] Suite Multi-Pannello Ticket Attiva!");
}

module.exports = {
  initTicketEngine,
  sendTicketPanel,
  createTicketChannel,
  DEFAULT_TICKET_CATEGORIES
};
