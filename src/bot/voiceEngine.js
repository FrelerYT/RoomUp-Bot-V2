const {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  Events
} = require("discord.js");

const activeRooms = new Map(); // channelId -> { ownerId, guildId, createdAt, locked, hidden }
const recentVoiceEvents = global.recentVoiceEvents || [];
global.recentVoiceEvents = recentVoiceEvents;

function logVoiceEvent(entry) {
  recentVoiceEvents.unshift({ timestamp: new Date().toISOString(), ...entry });
  if (recentVoiceEvents.length > 50) recentVoiceEvents.pop();
}

function initVoiceEngine(client, loadSettingsFn) {
  console.log("[VoiceEngine] 🎙️ Inizializzazione modulo VoiceEngine & listener VoiceStateUpdate...");
  
  // Voice State Listener for temporary channels and Auto-Mute Event channels
  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    try {
      const guildId = newState.guild?.id || oldState.guild?.id || newState.guildId || oldState.guildId;
      const guild = newState.guild || oldState.guild || (guildId ? client.guilds.cache.get(guildId) : null);
      if (!guild) {
        console.warn(`[VoiceEngine] VoiceStateUpdate ricevuto ma server non trovato in cache (guildId: ${guildId})`);
        return;
      }

      const userId = newState.id || oldState.id;
      const oldChName = oldState.channel?.name || null;
      const newChName = newState.channel?.name || null;

      // Log immediato visibile in console su Render
      console.log(`[VoiceStateUpdate] 🔊 Utente ${userId} in "${guild.name}": ${oldState.channelId || 'none'} (${oldChName}) ➔ ${newState.channelId || 'none'} (${newChName})`);

      logVoiceEvent({
        userId,
        guild: guild.name,
        guildId: guild.id,
        oldChannelId: oldState.channelId,
        oldChannelName: oldChName,
        newChannelId: newState.channelId,
        newChannelName: newChName
      });

      let member = newState.member || oldState.member;
      if (!member && userId && guild.members?.cache?.has(userId)) {
        member = guild.members.cache.get(userId);
      }
      if (!member && userId && guild.members?.fetch) {
        member = await guild.members.fetch(userId).catch(() => null);
      }
      if (member?.user?.bot) {
        return;
      }

      // ─── Auto-Mute Canali Evento / Palco Vocale (Solo Ascolto) ───────────────
      // Quando un utente entra in un canale evento, viene mutato sul server ("muta con la bocca").
      // Lo Staff potrà poi smutare manualmente chi desidera far parlare.
      const isEventVoiceChannel = (channel) => {
        if (!channel || channel.type !== ChannelType.GuildVoice) return false;
        const name = channel.name.toLowerCase();
        return name.includes("evento") || name.includes("compleanno") || name.includes("palco") || name.includes("event");
      };

      // 1. Utente entra o si sposta in un canale evento
      if (newState.channelId && newState.channelId !== oldState.channelId) {
        const targetChannel = newState.channel || (guild.channels?.cache?.get ? guild.channels.cache.get(newState.channelId) : null);
        if (isEventVoiceChannel(targetChannel) && member) {
          // Verifica se è Staff / Moderatore / Founder (non devono essere auto-mutati)
          const isStaff =
            guild.ownerId === member.id ||
            member.permissions?.has(PermissionFlagsBits.Administrator) ||
            member.permissions?.has(PermissionFlagsBits.ManageChannels) ||
            member.permissions?.has(PermissionFlagsBits.MuteMembers) ||
            member.permissions?.has(PermissionFlagsBits.MoveMembers);

          if (!isStaff) {
            await newState.setMute(true, "Auto-mute ingresso evento: solo ascolto").catch((err) => {
              console.error("[VoiceEngine] Impossibile applicare auto-mute evento:", err.message);
            });
          }
        }
      }

      // 2. Utente esce dal canale evento per andare in una stanza vocale normale:
      // Se era mutato sul server e si sposta in un canale ordinario, lo smutiamo automaticamente
      if (oldState.channelId && oldState.channelId !== newState.channelId) {
        const oldChannel = oldState.channel || (guild.channels?.cache?.get ? guild.channels.cache.get(oldState.channelId) : null);
        if (isEventVoiceChannel(oldChannel) && newState.channelId) {
          const newChannel = newState.channel || (guild.channels?.cache?.get ? guild.channels.cache.get(newState.channelId) : null);
          if (!isEventVoiceChannel(newChannel) && newState.serverMute) {
            await newState.setMute(false, "Unmute uscita canale evento").catch(() => null);
          }
        }
      }
      // ──────────────────────────────────────────────────────────────────────────

      const settings = typeof loadSettingsFn === "function" ? loadSettingsFn() : {};
      let voiceConfig = settings[guild.id]?.voice;
      
      const isGeneratorChannel = (channelId, channel, config) => {
        if (!channelId) return false;
        if (config?.hubChannelId && channelId === config.hubChannelId) return true;
        if (config?.generatorChannelId && channelId === config.generatorChannelId) return true;
        if (Array.isArray(config?.generatorChannelIds) && config.generatorChannelIds.includes(channelId)) return true;
        const norm = (channel?.name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (norm.includes("stanza di") || (channel?.name && channel.name.includes("🔒・Stanza"))) {
          return false;
        }
        if (
          norm.includes("crea") ||
          norm.includes("join to create") ||
          norm.includes("privat") ||
          (channel?.name && channel.name.includes("🏗️")) ||
          (channel?.name && channel.name.includes("➕"))
        ) {
          return true;
        }
        return false;
      };

      // 1. User enters or switches to the generator / hub channel
      if (newState.channelId) {
        let targetChannel = newState.channel || (guild.channels?.cache?.get ? guild.channels.cache.get(newState.channelId) : null);
        if (!targetChannel && guild.channels?.fetch) {
          targetChannel = await guild.channels.fetch(newState.channelId).catch(() => null);
        }

        const matchesGenerator = isGeneratorChannel(newState.channelId, targetChannel, voiceConfig);

        // If channel explicitly matches a generator, ensure voice is treated as enabled
        if (matchesGenerator && (!voiceConfig || voiceConfig.enabled === false)) {
          voiceConfig = {
            ...(voiceConfig || {}),
            enabled: true,
            hubChannelId: newState.channelId,
            generatorChannelId: newState.channelId,
            categoryId: targetChannel?.parentId || voiceConfig?.categoryId || ""
          };
        }

        const isTransition = newState.channelId !== oldState.channelId;
        const isStayingInHub = newState.channelId === oldState.channelId && !activeRooms.has(newState.channelId);

        console.log(`[VoiceEngine:Check] User ${userId} Channel: "${targetChannel?.name}" (${newState.channelId}) | MatchesGen: ${matchesGenerator} | isTransition: ${isTransition} | isStayingInHub: ${isStayingInHub} | Enabled: ${voiceConfig?.enabled}`);

        if (matchesGenerator && voiceConfig && voiceConfig.enabled !== false && (isTransition || isStayingInHub)) {
          console.log(`[VoiceEngine] 🚀 Ingresso confermato in canale generatore "${targetChannel?.name || newState.channelId}" da ${userId} in ${guild.name}`);

          // Resolve parent category safely
          let targetCategory = null;
          if (voiceConfig?.categoryId && guild.channels?.cache?.has?.(voiceConfig.categoryId)) {
            const cat = guild.channels.cache.get(voiceConfig.categoryId);
            if (cat && cat.type === ChannelType.GuildCategory) targetCategory = cat;
          }
          if (!targetCategory && targetChannel?.parentId && guild.channels?.cache?.has?.(targetChannel.parentId)) {
            const cat = guild.channels.cache.get(targetChannel.parentId);
            if (cat && cat.type === ChannelType.GuildCategory) targetCategory = cat;
          }
          if (!targetCategory && guild.channels?.cache?.find) {
            targetCategory = guild.channels.cache.find(c =>
              c && c.type === ChannelType.GuildCategory &&
              (c.name.toLowerCase().includes("privat") || c.name.toLowerCase().includes("voc"))
            ) || null;
          }

          const categoryId = targetCategory ? targetCategory.id : (voiceConfig?.categoryId || targetChannel?.parentId || undefined);
          const template = voiceConfig?.channelNameTemplate || "🔒・Stanza di {username}";
          const username = member?.user?.username || member?.displayName || "Utente";
          const roomName = template.replace("{username}", username);

          // Build permission overwrites for everyone, the room owner, and the bot
          const everyoneRoleId = guild.roles?.everyone?.id || guild.id;
          const permissionOverwrites = [
            {
              id: everyoneRoleId,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.Speak,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.SendMessages
              ]
            }
          ];

          const targetMemberId = member?.id || userId;
          if (targetMemberId) {
            permissionOverwrites.push({
              id: targetMemberId,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.Speak,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.MuteMembers,
                PermissionFlagsBits.DeafenMembers,
                PermissionFlagsBits.MoveMembers,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.SendMessages
              ]
            });
          }

          if (client.user?.id) {
            permissionOverwrites.push({
              id: client.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.Speak,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.MuteMembers,
                PermissionFlagsBits.DeafenMembers,
                PermissionFlagsBits.MoveMembers,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.SendMessages
              ]
            });
          }

          // Create the private voice channel with automatic fallback if category fails
          let roomChannel = null;
          try {
            roomChannel = await guild.channels.create({
              name: roomName,
              type: ChannelType.GuildVoice,
              parent: categoryId,
              userLimit: voiceConfig?.userLimit || voiceConfig?.defaultLimit || 0,
              permissionOverwrites
            });
            console.log(`[VoiceEngine] Creata stanza: "${roomChannel.name}" (${roomChannel.id}) in ${guild.name}`);
          } catch (createErr) {
            console.error(`[VoiceEngine] Errore creazione stanza con categoria (${createErr.message}). Tentativo fallback senza parent...`);
            try {
              roomChannel = await guild.channels.create({
                name: roomName,
                type: ChannelType.GuildVoice,
                userLimit: voiceConfig?.userLimit || voiceConfig?.defaultLimit || 0,
                permissionOverwrites
              });
              console.log(`[VoiceEngine] Creata stanza (fallback senza parent): "${roomChannel.name}" (${roomChannel.id})`);
            } catch (fallbackErr) {
              console.error(`[VoiceEngine] Fallimento critico creazione stanza vocale:`, fallbackErr.message);
              return;
            }
          }

          activeRooms.set(roomChannel.id, {
            ownerId: member?.id || userId,
            guildId: guild.id,
            createdAt: Date.now(),
            locked: false,
            hidden: false
          });

          // Move member to the newly created room
          try {
            console.log(`[VoiceEngine] 🚚 Sposto utente ${userId} nella stanza "${roomChannel.name}" (${roomChannel.id})...`);
            if (typeof newState.setChannel === "function") {
              await newState.setChannel(roomChannel);
              console.log(`[VoiceEngine] ✅ Utente spostato con successo via newState.setChannel!`);
            } else {
              await guild.members.edit(userId, { channel: roomChannel.id });
              console.log(`[VoiceEngine] ✅ Utente spostato con successo via guild.members.edit!`);
            }
          } catch (moveErr) {
            console.warn(`[VoiceEngine] setChannel fallito (${moveErr.message}), provo fallback via guild.members.edit...`);
            try {
              await guild.members.edit(userId, { channel: roomChannel.id });
              console.log(`[VoiceEngine] ✅ Utente spostato con successo via fallback guild.members.edit!`);
            } catch (fallbackMoveErr) {
              console.error(`[VoiceEngine] ❌ Fallimento spostamento utente:`, fallbackMoveErr.message);
            }
          }

          // Send customization control panel in the voice channel's chat
          try {
            const targetMemberId = member?.id || userId;
            const controlEmbed = new EmbedBuilder()
              .setTitle("🎙️ Pannello di Controllo Vocale Privata")
              .setColor("#8A5CF6")
              .setDescription(
                `Benvenuto <@${targetMemberId}> nella tua stanza privata!\n\n` +
                `Questa stanza è sotto il tuo controllo. Usa i pulsanti sottostanti per personalizzarla in qualsiasi momento.`
              )
              .addFields(
                { name: "👑 Proprietario", value: `<@${targetMemberId}>`, inline: true },
                { name: "👥 Limite", value: voiceConfig?.userLimit ? `${voiceConfig.userLimit} Utenti` : "Illimitato", inline: true },
                { name: "🔒 Stato", value: "🔓 Aperta a tutti", inline: true }
              )
              .setFooter({ text: "La stanza verrà eliminata automaticamente quando tutti usciranno." });

            const row1 = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("v2room_name")
                .setLabel("Rinomina")
                .setEmoji("✏️")
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId("v2room_limit")
                .setLabel("Limite")
                .setEmoji("👥")
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId("v2room_lock")
                .setLabel("Blocca")
                .setEmoji("🔒")
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId("v2room_unlock")
                .setLabel("Sblocca")
                .setEmoji("🔓")
                .setStyle(ButtonStyle.Success)
            );

            const row2 = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("v2room_hide")
                .setLabel("Nascondi")
                .setEmoji("👁️")
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId("v2room_show")
                .setLabel("Mostra")
                .setEmoji("🌐")
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId("v2room_kick")
                .setLabel("Espelli")
                .setEmoji("🚫")
                .setStyle(ButtonStyle.Danger),
              new ButtonBuilder()
                .setCustomId("v2room_claim")
                .setLabel("Reclama")
                .setEmoji("👑")
                .setStyle(ButtonStyle.Success)
            );

            await roomChannel.send({
              content: `👋 <@${targetMemberId}> ecco il pannello di gestione della tua stanza:`,
              embeds: [controlEmbed],
              components: [row1, row2]
            }).catch(() => null);
          } catch (msgErr) {
            console.error("[VoiceEngine] Errore invio pannello controlli nella stanza:", msgErr.message);
          }
        }
      }

      // 2. User leaves or changes channel -> cleanup temporary rooms when empty
      if (oldState.channelId && oldState.channelId !== newState.channelId) {
        const oldChannel = oldState.channel || (guild.channels?.cache?.get ? guild.channels.cache.get(oldState.channelId) : null);
        const isManagedRoom = oldChannel && (activeRooms.has(oldChannel.id) || (oldChannel.name && oldChannel.name.includes("Stanza di")));
        if (isManagedRoom) {
          if (oldChannel.members.size === 0) {
            activeRooms.delete(oldChannel.id);
            await oldChannel.delete("Stanza temporanea vuota").catch(() => null);
            console.log(`[VoiceEngine] Eliminata stanza temporanea vuota: ${oldChannel.name} (${oldChannel.id})`);
          } else {
            const roomData = activeRooms.get(oldChannel.id);
            if (roomData && roomData.ownerId === oldState.id) {
              const nextOwner = oldChannel.members.filter(m => !m.user.bot).first();
              if (nextOwner) {
                roomData.ownerId = nextOwner.id;
                await oldChannel.send(`👑 <@${oldState.id}> è uscito. Il nuovo proprietario della stanza è <@${nextOwner.id}>!`).catch(() => null);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error("[VoiceEngine] Errore gestione vocale:", err.message);
    }
  });

  // Interaction Listener for Room Controls
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) return;
      const customId = interaction.customId;
      if (!customId.startsWith("v2room_")) return;

      const member = interaction.member;
      const voiceChannel = member?.voice?.channel;

      // Auto-recover room after bot restart/redeploy if user is inside a managed room
      if (voiceChannel && !activeRooms.has(voiceChannel.id)) {
        const isDynamicRoom = voiceChannel.name.includes("Stanza di") || voiceChannel.name.includes("🔒");
        if (isDynamicRoom) {
          const firstNonBot = voiceChannel.members?.filter ? voiceChannel.members.filter(m => !m.user?.bot).first() : null;
          activeRooms.set(voiceChannel.id, {
            ownerId: firstNonBot ? firstNonBot.id : interaction.user.id,
            guildId: interaction.guild?.id,
            createdAt: Date.now(),
            locked: false,
            hidden: false
          });
          console.log(`[VoiceEngine] Auto-ripristinata stanza "${voiceChannel.name}" in memoria dopo riavvio`);
        }
      }

      if (!voiceChannel || !activeRooms.has(voiceChannel.id)) {
        return interaction.reply({
          content: "❌ Devi trovarti nella stanza vocale per usare questi comandi!",
          ephemeral: true
        }).catch(() => null);
      }

      const roomData = activeRooms.get(voiceChannel.id);
      const isOwner = roomData && roomData.ownerId === interaction.user.id;

      // Claim Ownership
      if (customId === "v2room_claim") {
        if (isOwner) {
          return interaction.reply({ content: "👑 Sei già il proprietario di questa stanza!", ephemeral: true });
        }
        const currentOwner = voiceChannel.members.get(roomData.ownerId);
        if (!currentOwner) {
          roomData.ownerId = interaction.user.id;
          return interaction.reply({ content: `👑 <@${interaction.user.id}> ha reclamato con successo la proprietà di questa stanza!`, ephemeral: false });
        } else {
          return interaction.reply({ content: "❌ Il proprietario attuale è ancora connesso alla stanza.", ephemeral: true });
        }
      }

      // Rest of commands require ownership
      if (!isOwner) {
        return interaction.reply({ content: "❌ Solo il proprietario della stanza può utilizzare questi controlli!", ephemeral: true });
      }

      // Rename Modal
      if (customId === "v2room_name") {
        const modal = new ModalBuilder()
          .setCustomId("v2room_name_modal")
          .setTitle("Rinomina Stanza Vocale")
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("name_val")
                .setLabel("Nuovo nome per la tua stanza")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(32)
                .setValue(voiceChannel.name)
            )
          );
        return interaction.showModal(modal);
      }

      // Handle Rename Modal Submit
      if (customId === "v2room_name_modal") {
        const newName = interaction.fields.getTextInputValue("name_val").trim();
        if (!newName) {
          return interaction.reply({ content: "❌ Inserisci un nome valido.", ephemeral: true });
        }
        await voiceChannel.setName(newName).catch(() => null);
        return interaction.reply({ content: `✏️ Stanza rinominata con successo in **${newName}**!`, ephemeral: true });
      }

      // Lock Room
      if (customId === "v2room_lock") {
        await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: false });
        roomData.locked = true;
        return interaction.reply({ content: "🔒 Stanza bloccata! Gli altri utenti non possono più entrare.", ephemeral: true });
      }

      // Unlock Room
      if (customId === "v2room_unlock") {
        await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: true });
        roomData.locked = false;
        return interaction.reply({ content: "🔓 Stanza sbloccata! Tutti gli utenti possono entrare.", ephemeral: true });
      }

      // Hide Room
      if (customId === "v2room_hide") {
        await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: false });
        roomData.hidden = true;
        return interaction.reply({ content: "👁️ Stanza nascosta! Non è più visibile agli altri membri del server.", ephemeral: true });
      }

      // Show Room
      if (customId === "v2room_show") {
        await voiceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: true });
        roomData.hidden = false;
        return interaction.reply({ content: "🌐 Stanza resa visibile a tutti!", ephemeral: true });
      }

      // User Limit Modal
      if (customId === "v2room_limit") {
        const modal = new ModalBuilder()
          .setCustomId("v2room_limit_modal")
          .setTitle("Imposta Limite Utenti")
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("limit_val")
                .setLabel("Numero max utenti (0 = illimitato, max 99)")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(2)
                .setValue(String(voiceChannel.userLimit || 0))
            )
          );
        return interaction.showModal(modal);
      }

      // Handle Limit Modal Submit
      if (customId === "v2room_limit_modal") {
        const val = parseInt(interaction.fields.getTextInputValue("limit_val"), 10);
        if (isNaN(val) || val < 0 || val > 99) {
          return interaction.reply({ content: "❌ Inserisci un numero valido compreso tra 0 e 99.", ephemeral: true });
        }
        await voiceChannel.setUserLimit(val).catch(() => null);
        return interaction.reply({ content: `👥 Limite utenti impostato a **${val === 0 ? "Illimitato" : val}**!`, ephemeral: true });
      }

      // Kick Menu
      if (customId === "v2room_kick") {
        const options = voiceChannel.members
          .filter(m => m.id !== interaction.user.id && !m.user.bot)
          .map(m => ({
            label: m.displayName || m.user.username,
            description: `@${m.user.tag}`,
            value: m.id
          }))
          .slice(0, 25);

        if (options.length === 0) {
          return interaction.reply({ content: "ℹ️ Non ci sono altri utenti nella tua stanza da espellere.", ephemeral: true });
        }

        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("v2room_kick_select")
            .setPlaceholder("Seleziona l'utente da espellere...")
            .addOptions(options)
        );

        return interaction.reply({
          content: "🚫 Seleziona l'utente da espellere dalla tua stanza:",
          components: [row],
          ephemeral: true
        });
      }

      // Handle Kick Select
      if (customId === "v2room_kick_select") {
        const targetId = interaction.values[0];
        const targetMember = voiceChannel.members.get(targetId);
        if (targetMember) {
          await targetMember.voice.disconnect("Espulso dal proprietario della stanza").catch(() => null);
          await voiceChannel.permissionOverwrites.edit(targetMember.id, { Connect: false }).catch(() => null);
          return interaction.update({ content: `🚫 <@${targetId}> è stato espulso dalla stanza!`, components: [] });
        } else {
          return interaction.update({ content: `❌ L'utente selezionato non è più nella stanza.`, components: [] });
        }
      }
    } catch (err) {
      console.error("[VoiceEngine] Errore gestione interaction:", err.message);
    }
  });



  // ═══════════════════════════════════════════════════════════════════════════
  // FRELERR GUARDIAN — Listener completamente autonomo
  // Protegge Frelerr (1020343046539325480) da:
  //   • Kick vocale    → disconnette il colpevole o gli dà timeout 60s
  //   • Server Mute    → annulla il mute su Frelerr + muta il colpevole 15s
  //   • Server Deaf    → annulla il deaf su Frelerr + deafena il colpevole 15s
  // ═══════════════════════════════════════════════════════════════════════════
  const { AuditLogEvent } = require('discord.js');
  const FRELERR_ID = '1020343046539325480';

  async function guardianFetchDisconnect(guild) {
    // Attende che Discord scriva sul log
    await new Promise(r => setTimeout(r, 1500));
    const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberDisconnect, limit: 5 }).catch(() => null);
    if (!logs) return null;
    // MemberDisconnect NON ha targetId — prende il più recente entro 15s che non sia Frelerr stesso
    const entry = logs.entries.find(e =>
      (Date.now() - e.createdTimestamp) < 15000 &&
      e.executorId !== FRELERR_ID
    );
    console.log(`[Guardian] MemberDisconnect log entries:`);
    logs.entries.forEach(e => console.log(`  executor=${e.executorId} age=${Date.now()-e.createdTimestamp}ms`));
    return entry?.executorId ?? null;
  }

  async function guardianFetchMemberUpdate(guild, changeKey) {
    await new Promise(r => setTimeout(r, 1200));
    const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberUpdate, limit: 5 }).catch(() => null);
    if (!logs) return null;
    const entry = logs.entries.find(e =>
      (Date.now() - e.createdTimestamp) < 12000 &&
      e.targetId === FRELERR_ID &&
      e.executorId !== FRELERR_ID &&
      e.changes?.some(c => c.key === changeKey)
    );
    console.log(`[Guardian] MemberUpdate (${changeKey}) log entries:`);
    logs.entries.forEach(e => console.log(`  executor=${e.executorId} target=${e.targetId} age=${Date.now()-e.createdTimestamp}ms changes=${JSON.stringify(e.changes)}`));
    return entry?.executorId ?? null;
  }

  async function guardianPunish(guild, executorId, action) {
    const executor = await guild.members.fetch(executorId).catch(() => null);
    if (!executor) { console.log(`[Guardian] executor ${executorId} non trovato`); return; }

    if (action === 'disconnect') {
      if (executor.voice?.channelId) {
        await executor.voice.disconnect('Hai kickato Frelerr dalla call.').catch(e => console.log('[Guardian] disconnect err:', e.message));
        console.log(`[Guardian] ✅ ${executorId} disconnesso dal vocale`);
      } else {
        // Non è in voce — dagli timeout 60 secondi
        await executor.timeout(60 * 1000, 'Hai kickato Frelerr dalla call vocale.').catch(e => console.log('[Guardian] timeout err:', e.message));
        console.log(`[Guardian] ✅ ${executorId} messo in timeout 60s (non era in voce)`);
      }
    } else if (action === 'mute') {
      if (executor.voice?.channelId) {
        await executor.voice.setMute(true, 'Hai server-mutato Frelerr.').catch(() => null);
        setTimeout(() => executor.voice.setMute(false).catch(() => null), 15_000);
        console.log(`[Guardian] ✅ ${executorId} server-mutato per 15s`);
      }
    } else if (action === 'deaf') {
      if (executor.voice?.channelId) {
        await executor.voice.setDeaf(true, 'Hai server-deafenato Frelerr.').catch(() => null);
        setTimeout(() => executor.voice.setDeaf(false).catch(() => null), 15_000);
        console.log(`[Guardian] ✅ ${executorId} server-deafenato per 15s`);
      }
    }
  }

  // Listener Guardian — separato, non dipende da voiceConfig
  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    try {
      // Identifica chi è l'utente dell'evento
      const userId = oldState.id || newState.id || oldState.member?.id || newState.member?.id;
      if (userId !== FRELERR_ID) return;

      const guild = oldState.guild || newState.guild;
      if (!guild) return;

      console.log(`[Guardian] VoiceStateUpdate per Frelerr: oldChannel=${oldState.channelId} newChannel=${newState.channelId} serverMute=${oldState.serverMute}→${newState.serverMute} serverDeaf=${oldState.serverDeaf}→${newState.serverDeaf}`);

      // ── CASO 1: KICK DAL VOCALE ──────────────────────────────────────────
      if (oldState.channelId && !newState.channelId) {
        console.log('[Guardian] Rilevato disconnect. Cerco responsabile...');
        const executorId = await guardianFetchDisconnect(guild);
        if (!executorId) { console.log('[Guardian] Nessun responsabile trovato (si è disconnesso da solo)'); return; }
        console.log(`[Guardian] Responsabile kick: ${executorId}`);
        await guardianPunish(guild, executorId, 'disconnect');
        const frelerr = await guild.members.fetch(FRELERR_ID).catch(() => null);
        await frelerr?.send(`⚡ **Guardian attivato**\n<@${executorId}> ti ha kickato dalla call — ricevuto la stessa sorte.`).catch(() => null);
        return;
      }

      // ── CASO 2: SERVER MUTE ──────────────────────────────────────────────
      if (oldState.channelId && !oldState.serverMute && newState.serverMute) {
        console.log('[Guardian] Rilevato server-mute su Frelerr. Cerco responsabile...');
        // Prima rimuovi subito il mute
        const frelerrMember = newState.member || await guild.members.fetch(FRELERR_ID).catch(() => null);
        await frelerrMember?.voice?.setMute(false, 'Guardian: rimosso server-mute').catch(e => console.log('[Guardian] unmute err:', e.message));
        const executorId = await guardianFetchMemberUpdate(guild, 'mute');
        if (!executorId) { console.log('[Guardian] Nessun responsabile trovato per mute'); return; }
        console.log(`[Guardian] Responsabile mute: ${executorId}`);
        await guardianPunish(guild, executorId, 'mute');
        await frelerrMember?.send(`⚡ **Guardian attivato**\n<@${executorId}> ti ha mutato — annullato e applicato a lui per 15s.`).catch(() => null);
        return;
      }

      // ── CASO 3: SERVER DEAF ───────────────────────────────────────────────
      if (oldState.channelId && !oldState.serverDeaf && newState.serverDeaf) {
        console.log('[Guardian] Rilevato server-deaf su Frelerr. Cerco responsabile...');
        const frelerrMember = newState.member || await guild.members.fetch(FRELERR_ID).catch(() => null);
        await frelerrMember?.voice?.setDeaf(false, 'Guardian: rimosso server-deaf').catch(e => console.log('[Guardian] undeaf err:', e.message));
        const executorId = await guardianFetchMemberUpdate(guild, 'deaf');
        if (!executorId) { console.log('[Guardian] Nessun responsabile trovato per deaf'); return; }
        console.log(`[Guardian] Responsabile deaf: ${executorId}`);
        await guardianPunish(guild, executorId, 'deaf');
        await frelerrMember?.send(`⚡ **Guardian attivato**\n<@${executorId}> ti ha messo le cuffie — annullato e applicato a lui per 15s.`).catch(() => null);
        return;
      }

    } catch (err) {
      console.error('[Guardian] Errore critico:', err.message, err.stack);
    }
  });
  // ═══════════════════════════════════════════════════════════════════════════

  console.log("[VoiceEngine] Sistema Stanze Vocali Temporanee attivo!");
}

module.exports = { initVoiceEngine, activeRooms, recentVoiceEvents };

