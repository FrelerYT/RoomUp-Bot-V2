const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  Routes,
  REST,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ActivityType
} = require('discord.js');

const {
  loadConfig,
  saveConfig,
  getMessage,
  getServerConfig,
  setServerConfig,
  loadPartners,
  addPartner,
  findPartnerByMessageId,
  findActivePartnersByCollaborator,
  deletePartner,
  recordExitLog
} = require('./dataManager');

const { initWelcomeReactions } = require('./welcomeReactions');

let clientInstance = null;

function hasStaffPermission(interaction) {
  if (!interaction.guild || !interaction.member) return true;
  if (interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return true;

  const serverConf = getServerConfig(interaction.guild.id);
  const staffRoleIds = serverConf.staffRoleIds || (serverConf.staffRoleId ? [serverConf.staffRoleId] : []);

  if (!staffRoleIds || staffRoleIds.length === 0) {
    return interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);
  }

  return staffRoleIds.some(roleId => interaction.member.roles.cache.has(roleId));
}

function formatBlockquote(lines) {
  return lines.map(line => `> ${line}`).join('\n');
}

function formatPartnershipDate(d = new Date()) {
  const pad = n => String(n).padStart(2, "0");
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = String(d.getFullYear()).slice(-2);
  const hours = pad(d.getHours());
  const mins = pad(d.getMinutes());
  return `${day}.${month}.${year}, ${hours}:${mins}`;
}

function extractPartnerServerName(description, defaultName = "Server Partner") {
  if (!description) return defaultName;
  const lines = description.split("\n").map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (/https?:\/\/|discord\.gg/i.test(line)) continue;
    if (/^[-=_*~#]{3,}$/.test(line)) continue;
    const cleaned = line
      .replace(/^[#*_\s~`>|✦˖⁺୨ৎ\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+/gu, "")
      .replace(/[#*_\s~`>|✦˖⁺୨ৎ\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+$/gu, "")
      .trim();
    if (cleaned.length >= 2 && cleaned.length <= 40) {
      return cleaned;
    }
  }
  return defaultName;
}

function calculateStaffStats(partnersData, staffId) {
  const staffCounts = {};
  for (const p of (partnersData?.partners || [])) {
    if (p.active === false || p.deleted) continue;
    const sId = p.hostId || p.authorId || "SentinelAI";
    staffCounts[sId] = (staffCounts[sId] || 0) + 1;
  }
  staffCounts[staffId] = (staffCounts[staffId] || 0) + 1;

  const sorted = Object.entries(staffCounts).sort((a, b) => b[1] - a[1]);
  const rankIdx = sorted.findIndex(([id]) => id === staffId);
  const rank = rankIdx !== -1 ? rankIdx + 1 : 1;

  return {
    count: staffCounts[staffId],
    rank
  };
}

async function createPartnershipInfoEmbed({
  client,
  host,
  collaborator,
  serverName,
  partnerServerName,
  partnerNumber,
  pingDisplay = "Nessuno",
  embedColor = "#8A5CF6"
}) {
  const staffId = host?.id;
  const finalServerName = serverName || partnerServerName || (host?.guild?.name) || "Server Partner";

  let staffAvatar = null;
  if (host?.displayAvatarURL) {
    staffAvatar = host.displayAvatarURL({ dynamic: true, size: 256 });
  } else if (client && staffId) {
    try {
      const u = client.users?.cache?.get(staffId) || await client.users?.fetch?.(staffId).catch(() => null);
      staffAvatar = u?.displayAvatarURL?.({ dynamic: true, size: 256 }) || null;
    } catch (e) {}
  }

  const embed = new EmbedBuilder()
    .setTitle("🤝 Nuova Partnership!")
    .setColor(embedColor || "#8A5CF6")
    .setDescription(
      `Grazie <@${staffId}> per aver eseguito **una nuova partnership**!\n\n` +
      `├ **Autore:** <@${collaborator?.id}>\n` +
      `├ **Server:** ${finalServerName}\n` +
      `├ **Staff:** <@${staffId}>\n` +
      `├ **Ping:** ${pingDisplay || "Nessuno"}\n` +
      `└ **Partner:** #${partnerNumber}`
    )
    .setFooter({
      text: `Collaborazione con ${finalServerName} | ${formatPartnershipDate()}`
    });

  if (staffAvatar) {
    embed.setThumbnail(staffAvatar);
  }

  return embed;
}


async function broadcastLogEmbed(client, embed) {
  try {
    const config = loadConfig();
    const logChannels = config.logChannels || [];
    const sentChannelIds = new Set();

    for (const logConf of logChannels) {
      try {
        if (!logConf.channelId || sentChannelIds.has(logConf.channelId)) continue;
        sentChannelIds.add(logConf.channelId);

        const guild = client.guilds.cache.get(logConf.guildId) || await client.guilds.fetch(logConf.guildId).catch(() => null);
        if (!guild) continue;

        const channel = guild.channels.cache.get(logConf.channelId) || await guild.channels.fetch(logConf.channelId).catch(() => null);
        if (channel && channel.isTextBased()) {
          await channel.send({ embeds: [embed] }).catch(err => {
            console.error(`[PartnerBot] Impossibile inviare log a ${guild.name} (#${channel.name}):`, err.message);
          });
        }
      } catch (e) {
        console.error('[PartnerBot] Errore invio log su singolo server:', e.message);
      }
    }
  } catch (err) {
    console.error('[PartnerBot] Errore in broadcastLogEmbed:', err.message);
  }
}

function createDiscordClient(token, clientId) {
  const botToken = token || process.env.PARTNERSHIP_BOT_TOKEN;
  if (!botToken) {
    console.error('[PartnershipBot] Token non specificato (manca PARTNERSHIP_BOT_TOKEN nelle variabili d\'ambiente).');
    return null;
  }
  const botClientId = clientId || process.env.PARTNERSHIP_CLIENT_ID || '1546192386546470963';

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions
    ]
  });

  clientInstance = client;
  initWelcomeReactions(client);

  // Slash commands definitions
  const commands = [
    new SlashCommandBuilder()
      .setName('partner')
      .setDescription('Pubblica una nuova partnership nei server sincronizzati')
      .addUserOption(opt =>
        opt.setName('collaboratore')
          .setDescription('Utente collaboratore con cui si effettua la partnership')
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName('delete-partner')
      .setDescription('Elimina una partnership dai canali sincronizzati tramite ID messaggio o numero')
      .addStringOption(opt =>
        opt.setName('id_messaggio')
          .setDescription('ID del messaggio o numero della partnership da eliminare')
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName('partner-setup')
      .setDescription('Configura canali, ruoli staff e ping per questo server')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addChannelOption(opt =>
        opt.setName('canale_partner')
          .setDescription('Canale dove pubblicare le partnership per questo server')
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setRequired(false)
      )
      .addChannelOption(opt =>
        opt.setName('canale_log')
          .setDescription('Canale dove ricevere notifiche e log rimozioni partnership')
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setRequired(false)
      )
      .addRoleOption(opt =>
        opt.setName('aggiungi_ruolo_staff')
          .setDescription('Aggiunge un ruolo staff autorizzato ad usare /partner')
          .setRequired(false)
      )
      .addRoleOption(opt =>
        opt.setName('ruolo_ping')
          .setDescription('Ruolo da pingare per le partnership di questo server')
          .setRequired(false)
      )
      .addBooleanOption(opt =>
        opt.setName('ping_everyone')
          .setDescription('Imposta il ping a @everyone per questo server')
          .setRequired(false)
      )
      .addBooleanOption(opt =>
        opt.setName('ping_here')
          .setDescription('Imposta il ping a @here per questo server')
          .setRequired(false)
      ),

    new SlashCommandBuilder()
      .setName('partner-list')
      .setDescription('Mostra le ultime partnership attive e statistiche')
  ].map(c => c.toJSON());

  // Ready event
  client.once('ready', async () => {
    console.log(`[PartnerBot] Loggato come ${client.user.tag} (${client.user.id})`);

    // Explicit online presence
    try {
      client.user.setPresence({
        status: 'online',
        activities: []
      });
    } catch (e) {}

    setInterval(() => {
      try {
        if (client.isReady() && client.user) {
          client.user.setPresence({
            status: 'online',
            activities: []
          });
        }
      } catch (e) {}
    }, 60000).unref();

    const sanitizedBotToken = (botToken || "").trim().replace(/^["']|["']$/g, "");
    const rest = new REST({ version: '10' }).setToken(sanitizedBotToken);
    try {
      console.log('[PartnerBot] Registrazione slash commands globali...');
      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commands }
      );
      // Pulizia dei comandi a livello di singolo server per eliminare i doppioni
      for (const [guildId, guild] of client.guilds.cache) {
        await rest.put(
          Routes.applicationGuildCommands(client.user.id, guildId),
          { body: [] }
        ).catch(() => null);
      }
      console.log('[PartnerBot] Comandi globali registrati e duplicati dei server rimossi!');
    } catch (err) {
      console.error('[PartnerBot] Errore registrazione slash commands:', err?.message || err);
    }
  });

  // 180-Second Gateway Disconnect Watchdog: Prevents zombie reconnection loops without killing normal handshakes
  let disconnectTimer = null;
  let hasEverConnected = false;

  function markDisconnected(reason) {
    if (!disconnectTimer && hasEverConnected) {
      disconnectTimer = setTimeout(() => {
        if (!client.isReady() || (client.ws && client.ws.status !== 0)) {
          console.error(`[CRITICAL GATEWAY WATCHDOG - LineaTemporale] Gateway disconnected for > 180s (${reason}). Exiting for clean supervisor restart...`);
          process.exit(1);
        }
      }, 180000);
      if (disconnectTimer.unref) disconnectTimer.unref();
    }
  }

  function markConnected() {
    hasEverConnected = true;
    if (disconnectTimer) {
      clearTimeout(disconnectTimer);
      disconnectTimer = null;
    }
  }

  client.on('shardReady', () => markConnected());

  client.on('shardError', (err, shardId) => {
    markDisconnected(`shardError: ${err?.message}`);
    console.error(`[PartnerBot Shard ${shardId} Error]:`, err?.message || err);
  });

  client.on('shardDisconnect', (event, shardId) => {
    markDisconnected(`shardDisconnect code=${event?.code}`);
    console.warn(`[PartnerBot Shard ${shardId}] Disconnesso (${event?.code}). Il gestore WebSocket di Discord.js ripristinerà la sessione automaticamente.`);
  });

  client.on('shardResume', () => {
    markConnected();
    try {
      if (client.user) {
        client.user.setPresence({
          status: 'online',
          activities: []
        });
      }
    } catch (e) {}
  });

async function executePublishPartner(interaction, client, { collaborator, desc, originGuild, host }) {
  const config = loadConfig();
  const channels = config.partnerChannels || [];

  if (channels.length === 0) {
    return interaction.editReply({
      content: getMessage('noChannels')
    });
  }

  const partnersData = loadPartners();
  const currentNumber = (partnersData.counter || 0) + 1;

  const sentMessages = [];
  const failedGuilds = [];

  for (const chConf of channels) {
    try {
      const guild = client.guilds.cache.get(chConf.guildId) || await client.guilds.fetch(chConf.guildId).catch(() => null);
      if (!guild) {
        failedGuilds.push(chConf.guildName || chConf.guildId);
        continue;
      }
      const channel = guild.channels.cache.get(chConf.channelId) || await guild.channels.fetch(chConf.channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) {
        failedGuilds.push(guild.name);
        continue;
      }

      // Fetch target server ping setting
      const targetServerConf = getServerConfig(chConf.guildId);
      const rawPing = targetServerConf.ping || chConf.ping || '';
      let pingContent = undefined;
      let pingDisplay = 'Nessuno';

      if (rawPing === '@everyone' || rawPing === '@here') {
        pingContent = rawPing;
        pingDisplay = rawPing;
      } else if (rawPing && rawPing !== 'none' && rawPing !== 'nessuno') {
        const roleId = rawPing.replace(/[^0-9]/g, '');
        if (roleId) {
          pingContent = `<@&${roleId}>`;
          pingDisplay = `<@&${roleId}>`;
        } else {
          pingContent = rawPing;
          pingDisplay = rawPing;
        }
      }

      const serverName = originGuild ? originGuild.name : (interaction?.guild ? interaction.guild.name : 'Server Partner');
      const infoEmbed = await createPartnershipInfoEmbed({
        client,
        host,
        collaborator,
        serverName,
        partnerNumber: currentNumber,
        pingDisplay,
        embedColor: targetServerConf.embedColor || "#8A5CF6"
      });

      let descMsg = null;
      let infoMsg = null;

      try {
        // 1. Invia messaggio con la descrizione del server partner (normale, plain text)
        descMsg = await channel.send({
          content: desc,
          allowedMentions: { parse: [] }
        });

        // 2. Invia messaggio a parte con il riepilogo informativo stilizzato e il ping
        infoMsg = await channel.send({
          content: pingContent,
          embeds: [infoEmbed],
          allowedMentions: {
            parse: ['everyone', 'roles', 'users']
          }
        });
      } catch (sendErr) {
        if (descMsg && !infoMsg) {
          await descMsg.delete().catch(() => null);
        }
        throw sendErr;
      }

      sentMessages.push({
        guildId: guild.id,
        guildName: guild.name,
        channelId: channel.id,
        messageId: descMsg.id,
        infoMessageId: infoMsg.id
      });
    } catch (err) {
      console.error(`[PartnerBot] Errore invio partner su guild ${chConf.guildId}:`, err.message);
      failedGuilds.push(chConf.guildName || chConf.guildId);
    }
  }

  if (sentMessages.length === 0) {
    return interaction.editReply({
      content: 'Impossibile inviare la partnership. Canali non raggiungibili o permessi mancanti.'
    });
  }

  const newPartner = addPartner({
    desc,
    collaborator,
    host,
    originGuild,
    messages: sentMessages
  });

  let replyText = getMessage('partnerSuccess', {
    number: String(newPartner.number),
    author: collaborator.id,
    server: originGuild?.name || 'Sconosciuto',
    staff: host.id,
    count: `${sentMessages.length}/${channels.length}`,
    messageId: sentMessages[0]?.messageId || newPartner.id
  });

  if (failedGuilds.length > 0) {
    replyText += `\nNon inviato su: ${failedGuilds.join(', ')}`;
  }

  // Send Discord Log to all configured log channels
  try {
    const unixNow = Math.floor(Date.now() / 1000);
    const partnerLogEmbed = new EmbedBuilder()
      .setTitle('Nuova Partnership Pubblicata')
      .setColor('#5865F2')
      .setDescription(formatBlockquote([
        `**Partnership:** #${newPartner.number}`,
        `**Collaboratore:** <@${collaborator.id}> (\`${collaborator.tag || collaborator.username}\`)`,
        `**Staff:** <@${host.id}>`,
        `**Server:** **${originGuild.name}**`,
        `**Canali inviati:** ${sentMessages.length}`,
        `**Data:** <t:${unixNow}:f>`
      ]))
      .setThumbnail(collaborator.displayAvatarURL ? collaborator.displayAvatarURL({ dynamic: true, size: 512 }) : null)
      .addFields([
        {
          name: `Canali (${sentMessages.length})`,
          value: sentMessages.map(s => `• **${s.guildName}:** <#${s.channelId}> • [Messaggio](https://discord.com/channels/${s.guildId}/${s.channelId}/${s.messageId})`).join('\n') || 'Nessuno'
        },
        {
          name: 'Testo',
          value: `\`\`\`markdown\n${desc.length > 500 ? desc.slice(0, 500) + '...' : desc}\n\`\`\``
        },
        {
          name: 'Gestione',
          value: `• ID Messaggio: \`${sentMessages[0]?.messageId || 'N/A'}\`\n• Revoca: \`/delete-partner id_messaggio:${sentMessages[0]?.messageId || newPartner.number}\``
        }
      ])
      .setFooter({
        text: `Linea Temporale • #${newPartner.number}`,
        iconURL: originGuild.iconURL() || undefined
      })
      .setTimestamp();

    await broadcastLogEmbed(client, partnerLogEmbed);
  } catch (logErr) {
    console.error('[PartnerBot] Errore invio log Discord /partner:', logErr.message);
  }

  return interaction.editReply({ content: replyText });
}

  // Interaction Create (Slash commands and modals)
  client.on('interactionCreate', async interaction => {
    // Gestione Invio Modal (Finestra popup multilinea per /partner)
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('partner_modal_')) {
        await interaction.deferReply({ ephemeral: true });

        const collaboratorId = interaction.customId.replace('partner_modal_', '');
        const collaborator = client.users.cache.get(collaboratorId) || await client.users.fetch(collaboratorId).catch(() => null);

        if (!collaborator) {
          return interaction.editReply({ content: 'Errore: Collaboratore non trovato.' });
        }

        const desc = interaction.fields.getTextInputValue('partner_desc');

        return executePublishPartner(interaction, client, {
          collaborator,
          desc,
          originGuild: interaction.guild,
          host: interaction.user
        });
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    // 1. /partner command
    if (commandName === 'partner') {
      // Permission Check: Supporta messaggi personalizzati
      if (!hasStaffPermission(interaction)) {
        const serverConf = getServerConfig(interaction.guild.id);
        const staffRoleIds = serverConf.staffRoleIds || [];
        const roleMsg = staffRoleIds.length > 0
          ? staffRoleIds.map(id => `<@&${id}>`).join(', ')
          : 'amministratore';
        return interaction.reply({
          content: getMessage('accessDenied', { roles: roleMsg }),
          ephemeral: true
        });
      }

      const collaborator = interaction.options.getUser('collaboratore');

      // Mostra direttamente il Modal popup multilinea per inserire la descrizione
      const modal = new ModalBuilder()
        .setCustomId(`partner_modal_${collaborator.id}`)
        .setTitle(`Partnership: @${collaborator.username}`.slice(0, 45));

      const descInput = new TextInputBuilder()
        .setCustomId('partner_desc')
        .setLabel('Testo della Partnership')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Incolla qui la descrizione del server partner...')
        .setRequired(true)
        .setMaxLength(2000);

      const row = new ActionRowBuilder().addComponents(descInput);
      modal.addComponents(row);

      return interaction.showModal(modal);
    }

    // 2. /delete-partner command
    if (commandName === 'delete-partner') {
      await interaction.deferReply({ ephemeral: true });

      // Permission Check
      if (!hasStaffPermission(interaction)) {
        const serverConf = getServerConfig(interaction.guild.id);
        const staffRoleIds = serverConf.staffRoleIds || [];
        const roleMsg = staffRoleIds.length > 0
          ? staffRoleIds.map(id => `<@&${id}>`).join(', ')
          : 'amministratore';
        return interaction.editReply({
          content: getMessage('accessDenied', { roles: roleMsg })
        });
      }

      const targetId = interaction.options.getString('id_messaggio').trim();
      const partner = findPartnerByMessageId(targetId);

      if (!partner) {
        return interaction.editReply({
          content: getMessage('notFound', { id: targetId })
        });
      }

      if (!partner.active) {
        return interaction.editReply({
          content: getMessage('alreadyDeleted', { number: String(partner.number) })
        });
      }

      let deletedCount = 0;
      for (const m of (partner.messages || [])) {
        try {
          const guild = client.guilds.cache.get(m.guildId) || await client.guilds.fetch(m.guildId).catch(() => null);
          if (guild) {
            const channel = guild.channels.cache.get(m.channelId) || await guild.channels.fetch(m.channelId).catch(() => null);
            if (channel && channel.isTextBased()) {
              if (m.messageId) {
                const msg = await channel.messages.fetch(m.messageId).catch(() => null);
                if (msg) {
                  await msg.delete().catch(() => null);
                  deletedCount++;
                }
              }
              if (m.infoMessageId) {
                const infoMsg = await channel.messages.fetch(m.infoMessageId).catch(() => null);
                if (infoMsg) {
                  await infoMsg.delete().catch(() => null);
                }
              }
            }
          }
        } catch (e) {
          console.error('[PartnerBot] Errore rimozione messaggio:', e.message);
        }
      }

      deletePartner(partner.id, interaction.user.tag, 'Comando /delete-partner');

      // Send Discord Log to all configured log channels
      try {
        const unixNow = Math.floor(Date.now() / 1000);
        const createdUnix = partner.createdAt ? Math.floor(new Date(partner.createdAt).getTime() / 1000) : null;

        const deleteLogEmbed = new EmbedBuilder()
          .setTitle('Partnership Eliminata')
          .setColor('#f0b232')
          .setDescription(formatBlockquote([
            `**Partnership:** #${partner.number}`,
            `**Collaboratore:** <@${partner.collaboratorId}> (\`${partner.collaboratorTag || 'Sconosciuto'}\`)`,
            `**Operatore:** <@${interaction.user.id}>`,
            `**Server:** **${interaction.guild?.name || 'Sconosciuto'}**`,
            `**Messaggi rimossi:** ${deletedCount}`,
            `**Data:** <t:${unixNow}:f>`
          ]))
          .setThumbnail(partner.collaboratorAvatar || interaction.user.displayAvatarURL({ dynamic: true, size: 512 }))
          .addFields([
            {
              name: 'Testo',
              value: `\`\`\`markdown\n${(partner.desc || 'N/A').length > 500 ? (partner.desc || '').slice(0, 500) + '...' : (partner.desc || 'N/A')}\n\`\`\``
            },
            {
              name: 'Dettagli',
              value: `• Motivo: \`Comando /delete-partner\`\n• ID: \`${partner.id}\``
            }
          ])
          .setFooter({
            text: `Linea Temporale • #${partner.number}`,
            iconURL: interaction.guild?.iconURL() || undefined
          })
          .setTimestamp();

        await broadcastLogEmbed(client, deleteLogEmbed);
      } catch (logErr) {
        console.error('[PartnerBot] Errore invio log Discord /delete-partner:', logErr.message);
      }

      return interaction.editReply({
        content: getMessage('deleteSuccess', {
          number: String(partner.number),
          author: partner.collaboratorId,
          staff: interaction.user.id,
          count: String(deletedCount)
        })
      });
    }

    // 3. /partner-setup command
    if (commandName === 'partner-setup') {
      await interaction.deferReply({ ephemeral: true });

      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.editReply({ content: 'Permesso negato. Riservato agli amministratori.' });
      }

      const partnerChannel = interaction.options.getChannel('canale_partner');
      const logChannel = interaction.options.getChannel('canale_log');
      const addStaffRole = interaction.options.getRole('aggiungi_ruolo_staff');
      const pingRole = interaction.options.getRole('ruolo_ping');
      const pingEveryone = interaction.options.getBoolean('ping_everyone');
      const pingHere = interaction.options.getBoolean('ping_here');
      const guild = interaction.guild;

      const currentConf = getServerConfig(guild.id);
      const serverUpdate = {
        guildId: guild.id,
        guildName: guild.name,
        staffRoleIds: [...(currentConf.staffRoleIds || [])]
      };

      const lines = [`Configurazione salvata per **${guild.name}**:`];

      if (partnerChannel) {
        serverUpdate.partnerChannelId = partnerChannel.id;
        serverUpdate.partnerChannelName = partnerChannel.name;
        lines.push(`• Canale: <#${partnerChannel.id}>`);
      }

      if (logChannel) {
        serverUpdate.logChannelId = logChannel.id;
        serverUpdate.logChannelName = logChannel.name;
        lines.push(`• Log: <#${logChannel.id}>`);
      }

      if (addStaffRole) {
        if (!serverUpdate.staffRoleIds.includes(addStaffRole.id)) {
          serverUpdate.staffRoleIds.push(addStaffRole.id);
        }
        lines.push(`• Ruolo Staff aggiunto: <@&${addStaffRole.id}>`);
      }

      if (pingEveryone) {
        serverUpdate.ping = '@everyone';
        lines.push(`• Ping: \`@everyone\``);
      } else if (pingHere) {
        serverUpdate.ping = '@here';
        lines.push(`• Ping: \`@here\``);
      } else if (pingRole) {
        serverUpdate.ping = `<@&${pingRole.id}>`;
        lines.push(`• Ping: <@&${pingRole.id}>`);
      }

      setServerConfig(guild.id, serverUpdate);
      return interaction.editReply({ content: lines.join('\n') });
    }

    // 4. /partner-list command
    if (commandName === 'partner-list') {
      const partnersData = loadPartners();
      const active = partnersData.partners.filter(p => p.active);

      const embed = new EmbedBuilder()
        .setTitle('Riepilogo Partnership')
        .setColor('#5865F2')
        .setDescription(`Totale: ${partnersData.counter} | Attive: ${active.length} | Revocate: ${partnersData.partners.length - active.length}`)
        .setTimestamp();

      const recentActive = active.slice(0, 5);
      if (recentActive.length > 0) {
        embed.addFields(
          recentActive.map(p => ({
            name: `Partner #${p.number}`,
            value: `Autore: <@${p.collaboratorId}> • Server: ${p.originGuildName || 'N/A'} • Staff: <@${p.hostId}>`
          }))
        );
      } else {
        embed.addFields({ name: 'Nessuna partnership attiva', value: 'Nessun annuncio presente.' });
      }

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  });

  // Auto-delete partnership when collaborator leaves ANY of the servers!
  client.on('guildMemberRemove', async member => {
    try {
      const collaboratorId = member.id;
      const activePartners = findActivePartnersByCollaborator(collaboratorId);

      if (!activePartners || activePartners.length === 0) return;

      console.log(`[PartnerBot] Author/Collaboratore ${member.user.tag} (${member.id}) uscito da ${member.guild.name}. Rilevate ${activePartners.length} partnership da eliminare!`);

      const revokedNumbers = [];

      for (const partner of activePartners) {
        revokedNumbers.push(partner.number);

        for (const m of (partner.messages || [])) {
          try {
            const guild = client.guilds.cache.get(m.guildId) || await client.guilds.fetch(m.guildId).catch(() => null);
            if (guild) {
              const channel = guild.channels.cache.get(m.channelId) || await guild.channels.fetch(m.channelId).catch(() => null);
              if (channel && channel.isTextBased()) {
                if (m.messageId) {
                  const msg = await channel.messages.fetch(m.messageId).catch(() => null);
                  if (msg) await msg.delete().catch(() => null);
                }
                if (m.infoMessageId) {
                  const infoMsg = await channel.messages.fetch(m.infoMessageId).catch(() => null);
                  if (infoMsg) await infoMsg.delete().catch(() => null);
                }
              }
            }
          } catch (err) {
            console.error('[PartnerBot] Errore eliminazione messaggio auto-delete:', err.message);
          }
        }

        deletePartner(partner.id, 'Auto-Leave Detector', `Author uscito da ${member.guild.name}`);
      }

      recordExitLog({
        collaboratorId: member.id,
        collaboratorTag: member.user.tag,
        collaboratorAvatar: member.user.displayAvatarURL({ size: 128 }),
        guildId: member.guild.id,
        guildName: member.guild.name,
        partnerNumbers: revokedNumbers
      });

      // Send Discord Log to all configured log channels
      try {
        const unixNow = Math.floor(Date.now() / 1000);
        const joinedUnix = member.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;

        const leaveLogEmbed = new EmbedBuilder()
          .setTitle('Partnership Revocata (Collaboratore Uscito)')
          .setColor('#f23f43')
          .setDescription(formatBlockquote([
            `**Collaboratore:** <@${member.id}> (\`${member.user.tag}\`)`,
            `**Server:** **${member.guild.name}**`,
            `**Partnership revocate:** ${revokedNumbers.map(n => '#' + n).join(', ')}`,
            `**Data:** <t:${unixNow}:f>`
          ]))
          .setThumbnail(member.user.displayAvatarURL ? member.user.displayAvatarURL({ dynamic: true, size: 512 }) : null)
          .addFields([
            {
              name: 'Motivo',
              value: `Collaboratore uscito dal server. Annunci rimossi per reciprocità.`
            }
          ])
          .setFooter({
            text: 'Linea Temporale • Revoca Automatica',
            iconURL: member.guild.iconURL() || undefined
          })
          .setTimestamp();

        await broadcastLogEmbed(client, leaveLogEmbed);
      } catch (e) {
        console.error('[PartnerBot] Errore invio log Discord auto-leave:', e.message);
      }
    } catch (err) {
      console.error('[PartnerBot] Errore listener guildMemberRemove:', err);
    }
  });

  if (botToken) {
    const cleanBotToken = (botToken || "").trim().replace(/^["']|["']$/g, "");
    client.login(cleanBotToken).then(() => {
      console.log(`[PartnerBot] ✅ Bot Discord connesso con successo come ${client.user.tag}`);
    }).catch(err => {
      console.error('[PartnerBot] ❌ Errore login Discord:', err?.message || err);
    });
  }

  return client;
}

function getClient() {
  return clientInstance;
}

module.exports = {
  createDiscordClient,
  getClient,
  broadcastLogEmbed,
  formatBlockquote,
  createPartnershipInfoEmbed
};
