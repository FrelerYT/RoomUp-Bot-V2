const fs = require("fs");
const path = require("path");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder,
  PermissionFlagsBits,
  MessageFlags
} = require("discord.js");

const UNBAN_ROLE_ID = "1554969593104175144";
const VERIFIED_ROLE_ID = "1554969591086846073";
const UNBAN_CHANNEL_ID = "1554969785165414551";
const DEFAULT_LOG_CHANNEL_ID = "1554969794225246318";

const BANNED_USERS_FILE = path.join(__dirname, "../../data/banned_users.json");

function ensureBannedDataDir() {
  const dir = path.dirname(BANNED_USERS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadBannedUsers() {
  ensureBannedDataDir();
  try {
    if (!fs.existsSync(BANNED_USERS_FILE)) {
      fs.writeFileSync(BANNED_USERS_FILE, JSON.stringify({}, null, 2), "utf8");
      return {};
    }
    return JSON.parse(fs.readFileSync(BANNED_USERS_FILE, "utf8"));
  } catch (e) {
    console.error("[UnbanAppealEngine] Errore lettura banned_users.json:", e.message);
    return {};
  }
}

function saveBannedUsers(data) {
  ensureBannedDataDir();
  try {
    fs.writeFileSync(BANNED_USERS_FILE, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (e) {
    console.error("[UnbanAppealEngine] Errore salvataggio banned_users.json:", e.message);
    return false;
  }
}

function isUserBanned(guildId, userId) {
  const data = loadBannedUsers();
  return Boolean(data[guildId] && data[guildId][userId]);
}

function getBannedUserInfo(guildId, userId) {
  const data = loadBannedUsers();
  return (data[guildId] && data[guildId][userId]) || null;
}

function setBannedUser(guildId, userId, info) {
  const data = loadBannedUsers();
  if (!data[guildId]) data[guildId] = {};
  data[guildId][userId] = {
    ...info,
    bannedAt: new Date().toISOString()
  };
  saveBannedUsers(data);
}

function removeBannedUser(guildId, userId) {
  const data = loadBannedUsers();
  if (data[guildId] && data[guildId][userId]) {
    delete data[guildId][userId];
    saveBannedUsers(data);
    return true;
  }
  return false;
}

/**
 * Applica l'isolamento da ban a un membro:
 * Rimuove tutti i ruoli normali, assegna il ruolo @bannat* (che vede solo #🧧・unban).
 */
async function applyBanIsolation(member, reason = "Nessun motivo specificato", executor = null) {
  if (!member || !member.guild) return false;
  const guild = member.guild;
  const unbanRoleId = getUnbanRoleId(guild.id);
  const unbanRole = guild.roles.cache.get(unbanRoleId) || await guild.roles.fetch(unbanRoleId).catch(() => null);

  // Salva i ruoli attuali per eventuale storico prima di rimuoverli
  const currentRoleIds = member.roles.cache.filter(r => r.id !== guild.id && r.id !== unbanRoleId).map(r => r.id);

  setBannedUser(guild.id, member.id, {
    username: member.user.username,
    discriminator: member.user.discriminator,
    reason,
    moderatorId: executor?.id || null,
    moderatorTag: executor?.tag || null,
    previousRoles: currentRoleIds
  });

  // Rimuovi tutti i ruoli rimovibili
  for (const roleId of currentRoleIds) {
    await member.roles.remove(roleId, `Isolamento Ban: ${reason}`).catch(() => null);
  }

  // Assegna ruolo @bannat*
  if (unbanRole && !member.roles.cache.has(unbanRole.id)) {
    await member.roles.add(unbanRole, `Isolamento Ban: ${reason}`).catch((e) => {
      console.error("[UnbanAppealEngine] Errore aggiunta ruolo bannat*:", e.message);
    });
  }

  return true;
}

function getUnbanRoleId(guildId, settings = {}) {
  return settings[guildId]?.warns?.levels?.["4"]?.roleId || (guildId === "965378975675322438" ? "1554969593104175144" : "1550846909818867775");
}
function getVerifiedRoleId(guildId, settings = {}) {
  return settings[guildId]?.verification?.verifiedRoleId || (guildId === "965378975675322438" ? "1554969591086846073" : "1550846908011122688");
}
function getUnbanChannelId(guildId) {
  return guildId === "965378975675322438" ? "1554969785165414551" : "1550847057802043392";
}
function getLogChannelId(guildId, settings = {}) {
  return settings[guildId]?.warns?.logChannelId || (guildId === "965378975675322438" ? "1554969794225246318" : "1550847062235418647");
}

const DEFAULT_TITLE = "RICORSO RIAMMISSIONE";
const DEFAULT_DESC = `Benvenuto nel canale riservato alle richieste di unban del server.

Tutti i canali del server ti sono stati temporaneamente bloccati a seguito del ban.

**COME RICHIEDERE LO SBAN:**
Se desideri spiegare la tua situazione allo Staff per farti riammettere, clicca sul pulsante qui sotto per compilare il **Modulo di Ricorso**.`;
const DEFAULT_COLOR = "#731FC3";
const DEFAULT_FOOTER = "RoomUp! Support System";

/**
 * Invia o aggiorna il pannello di ricorso unban nel canale specificato
 */
async function sendUnbanAppealPanel(channel, options = {}) {
  if (!channel || !channel.isTextBased()) {
    throw new Error("Canale non valido o non testuale.");
  }

  const title = options.title || DEFAULT_TITLE;
  const desc = options.description || DEFAULT_DESC;
  const color = options.color || DEFAULT_COLOR;
  const footer = options.footer || DEFAULT_FOOTER;

  const files = [];

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .setColor(color)
    .setFooter({ text: footer });

  // Thumbnail Scudo
  const thumbPath = path.join(__dirname, "../../assets/unban_thumb.png");
  if (options.showThumbnail !== false && fs.existsSync(thumbPath)) {
    files.push(new AttachmentBuilder(thumbPath, { name: "unban_thumb.png" }));
    embed.setThumbnail("attachment://unban_thumb.png");
  } else if (options.thumbnail && typeof options.thumbnail === "string" && options.thumbnail.startsWith("http")) {
    embed.setThumbnail(options.thumbnail);
  }

  // Barra Sfumata
  const barPath = path.join(__dirname, "../../assets/welcome_bar.png");
  if (options.useDividerBar !== false && fs.existsSync(barPath)) {
    files.push(new AttachmentBuilder(barPath, { name: "welcome_bar.png" }));
    embed.setImage("attachment://welcome_bar.png");
  } else if (options.image && typeof options.image === "string" && options.image.startsWith("http")) {
    embed.setImage(options.image);
  }

  // Pulsante Invia Richiesta di Riammissione
  const button = new ButtonBuilder()
    .setCustomId("unban_appeal_start")
    .setLabel(options.buttonLabel || "Invia Richiesta di riammissione")
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder().addComponents(button);

  return await channel.send({ embeds: [embed], components: [row], files });
}

/**
 * Assicura che i permessi di canale su #🧧・unban consentano la visualizzazione SOLO a chi ha il ruolo bannat*
 */
async function applyUnbanChannelPermissions(channel, guild) {
  if (!channel || !guild) return;

  const overwrites = [
    {
      id: guild.id, // @everyone
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: VERIFIED_ROLE_ID, // @Utenti
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: UNBAN_ROLE_ID, // @bannat*
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
      deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions]
    },
    {
      id: guild.members.me.id, // Bot
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ManageChannels
      ]
    }
  ];

  // Ruoli Staff con visualizzazione
  const staffRoleIds = ["1550846875328848004", "1550846876624887868", "1550846888708804759", "1550846890017300480"];
  staffRoleIds.forEach(roleId => {
    if (guild.roles.cache.has(roleId)) {
      overwrites.push({
        id: roleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory
        ]
      });
    }
  });

  await channel.permissionOverwrites.set(overwrites, "Configurazione permessi esclusivi per ruolo bannat*");
}

/**
 * Inizializzazione Listener ed Eventi Discord per l'Unban Appeal Engine
 */
function initUnbanAppealEngine(client, loadSettingsFn) {
  if (!client) return;

  client.on("interactionCreate", async (interaction) => {
    try {
      const guild = interaction.guild;
      if (!guild) return;

      const settings = typeof loadSettingsFn === "function" ? loadSettingsFn() : {};
      const guildConfig = settings[guild.id] || {};

      // 1. CLIC SUL PULSANTE "Invia Richiesta di riammissione"
      if (interaction.isButton() && interaction.customId === "unban_appeal_start") {
        const modal = new ModalBuilder()
          .setCustomId(`unban_appeal_modal_${interaction.user.id}`)
          .setTitle("Modulo di Ricorso Riammissione");

        const qPunishment = new TextInputBuilder()
          .setCustomId("t_punishment")
          .setLabel("Motivo per cui sei stato sanzionato:")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000);

        const qReason = new TextInputBuilder()
          .setCustomId("t_reason")
          .setLabel("Perché dovresti essere riammesso?")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000);

        const qPledge = new TextInputBuilder()
          .setCustomId("t_pledge")
          .setLabel("Promessa di rispetto del regolamento:")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(250);

        modal.addComponents(
          new ActionRowBuilder().addComponents(qPunishment),
          new ActionRowBuilder().addComponents(qReason),
          new ActionRowBuilder().addComponents(qPledge)
        );

        return await interaction.showModal(modal).catch(() => {});
      }

      // 2. SUBMIT DEL MODAL DI RICORSO
      if (interaction.isModalSubmit() && interaction.customId.startsWith("unban_appeal_modal_")) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const punishment = interaction.fields.getTextInputValue("t_punishment") || "Non specificato";
        const reason = interaction.fields.getTextInputValue("t_reason") || "Non specificato";
        const pledge = interaction.fields.getTextInputValue("t_pledge") || "Confermo rispetto regolamento";

        // Invia notifica allo staff
        const staffChannelId = guildConfig.warns?.logChannelId || DEFAULT_LOG_CHANNEL_ID;
        const staffChannel = guild.channels.cache.get(staffChannelId);

        if (staffChannel && staffChannel.isTextBased()) {
          const staffEmbed = new EmbedBuilder()
            .setTitle("⚖️ Nuovo Ricorso di Riammissione (Sban)")
            .setColor(0x731FC3)
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
            .addFields(
              { name: "👤 Utente Sanzionato", value: `<@${interaction.user.id}> (\`${interaction.user.tag}\` - \`${interaction.user.id}\`)`, inline: false },
              { name: "🛑 Motivo Sanzione Riferito", value: `>>> ${punishment.slice(0, 1000)}`, inline: false },
              { name: "📝 Motivazione per lo Sban", value: `>>> ${reason.slice(0, 1000)}`, inline: false },
              { name: "🤝 Impegno Regolamento", value: `>>> ${pledge.slice(0, 250)}`, inline: false }
            )
            .setFooter({ text: `Richiesta inviata da ${interaction.user.tag}` })
            .setTimestamp();

          const staffButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`appeal_act_approve_${interaction.user.id}`)
              .setLabel("Approva Sban")
              .setStyle(ButtonStyle.Success)
              .setEmoji("✅"),
            new ButtonBuilder()
              .setCustomId(`appeal_act_reject_${interaction.user.id}`)
              .setLabel("Rifiuta Sban")
              .setStyle(ButtonStyle.Danger)
              .setEmoji("❌")
          );

          await staffChannel.send({ embeds: [staffEmbed], components: [staffButtons] }).catch(() => {});
        }

        return await interaction.editReply({
          content: "✅ **La tua richiesta di ricorso è stata inoltrata con successo allo Staff!** Verrà esaminata il prima possibile."
        });
      }

      // 3. AZIONI STAFF: APPROVA / RIFIUTA SBAN
      if (interaction.isButton() && (interaction.customId.startsWith("appeal_act_approve_") || interaction.customId.startsWith("appeal_act_reject_"))) {
        // Controllo permessi Staff
        const isStaff = interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
          interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers) ||
          interaction.member.roles.cache.some(r => ["1550846875328848004", "1550846876624887868", "1550846888708804759"].includes(r.id));

        if (!isStaff) {
          return await interaction.reply({ content: "❌ Solo i membri dello Staff autorizzati possono gestire i ricorsi.", flags: MessageFlags.Ephemeral });
        }

        const isApprove = interaction.customId.startsWith("appeal_act_approve_");
        const targetUserId = interaction.customId.replace(isApprove ? "appeal_act_approve_" : "appeal_act_reject_", "");

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const targetMember = await guild.members.fetch(targetUserId).catch(() => null);

        if (isApprove) {
          if (targetMember) {
            // Rimuovi dallo storage persistente dei bannati
            removeBannedUser(guild.id, targetUserId);

            // Rimuovi ruolo bannat*
            if (targetMember.roles.cache.has(UNBAN_ROLE_ID)) {
              await targetMember.roles.remove(UNBAN_ROLE_ID, `Sban approvato da ${interaction.user.tag}`).catch(() => {});
            }
            // Assegna ruolo @Utenti
            if (!targetMember.roles.cache.has(VERIFIED_ROLE_ID)) {
              await targetMember.roles.add(VERIFIED_ROLE_ID, `Sban approvato da ${interaction.user.tag}`).catch(() => {});
            }
            // Rimuovi eventuale timeout Discord
            if (targetMember.communicationDisabledUntilTimestamp && targetMember.communicationDisabledUntilTimestamp > Date.now()) {
              await targetMember.timeout(null, `Sban approvato da ${interaction.user.tag}`).catch(() => {});
            }

            // Notifica DM
            await targetMember.send({
              content: `🎉 **Congratulazioni!** Il tuo ricorso di riammissione per **${guild.name}** è stato **APPROVATO** dallo Staff (<@${interaction.user.id}>)! Sei stato riammesso nella community.`
            }).catch(() => {});
          } else {
            removeBannedUser(guild.id, targetUserId);
          }

          // Aggiorna messaggio dello staff
          const originalEmbed = interaction.message.embeds[0];
          const updatedEmbed = EmbedBuilder.from(originalEmbed)
            .setColor(0x2ECC71)
            .setTitle("✅ Ricorso Riammissione APPROVATO")
            .addFields({ name: "⚖️ Esito", value: `Approvato da <@${interaction.user.id}> in data ${new Date().toLocaleString("it-IT")}` });

          await interaction.message.edit({ embeds: [updatedEmbed], components: [] }).catch(() => {});
          return await interaction.editReply({ content: `✅ **Ricorso approvato con successo!** L'utente <@${targetUserId}> è stato riammesso con il ruolo @Utenti.` });

        } else {
          // Rifiuto
          if (targetMember) {
            await targetMember.send({
              content: `❌ Il tuo ricorso di riammissione per **${guild.name}** è stato **RESPINTO** dallo Staff (<@${interaction.user.id}>).`
            }).catch(() => {});
          }

          const originalEmbed = interaction.message.embeds[0];
          const updatedEmbed = EmbedBuilder.from(originalEmbed)
            .setColor(0xE74C3C)
            .setTitle("❌ Ricorso Riammissione RESPINTO")
            .addFields({ name: "⚖️ Esito", value: `Respinto da <@${interaction.user.id}> in data ${new Date().toLocaleString("it-IT")}` });

          await interaction.message.edit({ embeds: [updatedEmbed], components: [] }).catch(() => {});
          return await interaction.editReply({ content: `❌ **Ricorso respinto.** L'utente <@${targetUserId}> rimane sanzionato.` });
        }
      }
    } catch (err) {
      console.error("[UnbanAppealEngine] Errore gestione interazione:", err.message);
    }
  });

  console.log("[UnbanAppealEngine] Motore Ricorsi Riammissione & Sban attivo!");
}

module.exports = {
  initUnbanAppealEngine,
  sendUnbanAppealPanel,
  applyUnbanChannelPermissions,
  applyBanIsolation,
  isUserBanned,
  getBannedUserInfo,
  setBannedUser,
  removeBannedUser,
  loadBannedUsers,
  UNBAN_ROLE_ID,
  VERIFIED_ROLE_ID,
  UNBAN_CHANNEL_ID
};
