const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  Events
} = require("discord.js");
const fs = require("fs");
const path = require("path");

const SUGGESTIONS_FILE = path.join(__dirname, "../../data/suggestions.json");

function ensureDataDir() {
  const dir = path.dirname(SUGGESTIONS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadSuggestions() {
  ensureDataDir();
  try {
    if (!fs.existsSync(SUGGESTIONS_FILE)) {
      const initial = [];
      fs.writeFileSync(SUGGESTIONS_FILE, JSON.stringify(initial, null, 2), "utf8");
      return initial;
    }
    return JSON.parse(fs.readFileSync(SUGGESTIONS_FILE, "utf8"));
  } catch (e) {
    return [];
  }
}

function saveSuggestions(data) {
  ensureDataDir();
  try {
    fs.writeFileSync(SUGGESTIONS_FILE, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (e) {
    return false;
  }
}

function initSuggestionEngine(client, loadSettingsFn) {

  // 1. Slash command /suggest
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "suggest") return;

    const guild = interaction.guild;
    if (!guild) return;

    const settings = typeof loadSettingsFn === 'function' ? loadSettingsFn() : {};
    const config = settings[guild.id]?.suggestions || {};

    const targetChannelId = config.channelId || interaction.channelId;
    const targetChannel = guild.channels.cache.get(targetChannelId);
    if (!targetChannel || !targetChannel.isTextBased()) {
      return interaction.reply({ content: "❌ Canale suggerimenti non configurato o non valido.", ephemeral: true });
    }

    const suggestionText = interaction.options.getString("proposta");
    await interaction.deferReply({ ephemeral: true });

    const sugId = `sug_${Date.now()}`;

    const embed = new EmbedBuilder()
      .setTitle(config.embedTitle || "💡 Nuovo Suggerimento della Community")
      .setDescription(`>>> ${suggestionText}`)
      .setColor(config.embedColor || "#5865F2")
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: "Proposto Da", value: `<@${interaction.user.id}> (\`${interaction.user.tag}\`)`, inline: true },
        { name: "Stato", value: "🟡 **In Valutazione**", inline: true }
      )
      .setFooter({ text: `ID: ${sugId} • RoomUp! Suggestions` })
      .setTimestamp();

    // Voter buttons + Staff action buttons
    const components = [];
    if (config.allowUpvoteDownvote !== false) {
      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`sug_vote_up:::${sugId}`).setLabel("Favorevole (0)").setStyle(ButtonStyle.Success).setEmoji("👍"),
        new ButtonBuilder().setCustomId(`sug_vote_down:::${sugId}`).setLabel("Contrario (0)").setStyle(ButtonStyle.Danger).setEmoji("👎")
      );
      components.push(row1);
    }

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`sug_action_approve:::${sugId}`).setLabel("Approva").setStyle(ButtonStyle.Success).setEmoji("✅"),
      new ButtonBuilder().setCustomId(`sug_action_reject:::${sugId}`).setLabel("Rifiuta").setStyle(ButtonStyle.Danger).setEmoji("❌"),
      new ButtonBuilder().setCustomId(`sug_action_consider:::${sugId}`).setLabel("In Corso").setStyle(ButtonStyle.Primary).setEmoji("⏳")
    );
    components.push(row2);

    const sentMsg = await targetChannel.send({ embeds: [embed], components }).catch(() => null);
    if (!sentMsg) {
      return interaction.editReply({ content: "❌ Impossibile inviare il suggerimento nel canale." });
    }

    // Auto-create Thread
    if (config.autoCreateThread !== false && typeof sentMsg.startThread === "function") {
      await sentMsg.startThread({
        name: `Discussione: ${suggestionText.slice(0, 50)}`,
        autoArchiveDuration: 1440
      }).catch(() => null);
    }

    const all = loadSuggestions();
    all.push({
      id: sugId,
      guildId: guild.id,
      channelId: targetChannel.id,
      messageId: sentMsg.id,
      authorId: interaction.user.id,
      text: suggestionText,
      status: "pending",
      upvotes: [],
      downvotes: [],
      createdAt: new Date().toISOString()
    });
    saveSuggestions(all);

    return interaction.editReply({ content: `✅ La tua proposta è stata pubblicata con successo in <#${targetChannel.id}>!` });
  });

  // 2. Button Interactions: Voting & Staff Moderation
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    const customId = interaction.customId;
    if (!customId.startsWith("sug_")) return;

    const [action, sugId] = customId.split(":::");
    const all = loadSuggestions();
    const sug = all.find(s => s.id === sugId);

    if (!sug) {
      return interaction.reply({ content: "⚠️ Suggerimento non trovato.", ephemeral: true });
    }

    const userId = interaction.user.id;

    // A. Voting Logic
    if (action === "sug_vote_up" || action === "sug_vote_down") {
      if (!Array.isArray(sug.upvotes)) sug.upvotes = [];
      if (!Array.isArray(sug.downvotes)) sug.downvotes = [];

      if (action === "sug_vote_up") {
        if (sug.upvotes.includes(userId)) {
          sug.upvotes = sug.upvotes.filter(id => id !== userId);
        } else {
          sug.upvotes.push(userId);
          sug.downvotes = sug.downvotes.filter(id => id !== userId);
        }
      } else {
        if (sug.downvotes.includes(userId)) {
          sug.downvotes = sug.downvotes.filter(id => id !== userId);
        } else {
          sug.downvotes.push(userId);
          sug.upvotes = sug.upvotes.filter(id => id !== userId);
        }
      }

      saveSuggestions(all);

      // Update buttons
      const updatedRow1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`sug_vote_up:::${sug.id}`).setLabel(`Favorevole (${sug.upvotes.length})`).setStyle(ButtonStyle.Success).setEmoji("👍"),
        new ButtonBuilder().setCustomId(`sug_vote_down:::${sug.id}`).setLabel(`Contrario (${sug.downvotes.length})`).setStyle(ButtonStyle.Danger).setEmoji("👎")
      );

      await interaction.update({ components: [updatedRow1, interaction.message.components[1]] }).catch(() => null);
      return;
    }

    // B. Staff Resolution
    if (action.startsWith("sug_action_")) {
      const member = interaction.member;
      const isStaff = member.permissions.has(PermissionFlagsBits.ManageGuild) || member.permissions.has(PermissionFlagsBits.ManageMessages);
      if (!isStaff) {
        return interaction.reply({ content: "❌ Solo lo Staff può modificare lo stato dei suggerimenti.", ephemeral: true });
      }

      let newStatus = "pending";
      let statusLabel = "🟡 **In Valutazione**";
      let embedColor = config.embedColor || "#5865F2";

      if (action === "sug_action_approve") {
        newStatus = "approved";
        statusLabel = `🟢 **APPROVATO** da <@${interaction.user.id}>`;
        embedColor = config.approvedColor || "#23a55a";
      } else if (action === "sug_action_reject") {
        newStatus = "rejected";
        statusLabel = `🔴 **RIFIUTATO** da <@${interaction.user.id}>`;
        embedColor = config.rejectedColor || "#f23f43";
      } else if (action === "sug_action_consider") {
        newStatus = "in_progress";
        statusLabel = `🔵 **IN SVILUPPO** (Preso in carico da <@${interaction.user.id}>)`;
        embedColor = config.inProgressColor || "#f0b232";
      }

      sug.status = newStatus;
      saveSuggestions(all);

      const oldEmbed = interaction.message.embeds[0];
      const newEmbed = EmbedBuilder.from(oldEmbed)
        .setColor(embedColor)
        .setFields([
          { name: "Proposto Da", value: `<@${sug.authorId}>`, inline: true },
          { name: "Stato", value: statusLabel, inline: true }
        ]);

      await interaction.update({ embeds: [newEmbed] }).catch(() => null);

      if (config.sendDmOnStatusChange !== false && sug.authorId) {
        const authorUser = await interaction.client.users.fetch(sug.authorId).catch(() => null);
        if (authorUser) {
          authorUser.send({
            content: `📢 Il tuo suggerimento su **${interaction.guild.name}** è stato aggiornato dallo Staff: ${statusLabel}`
          }).catch(() => null);
        }
      }
    }
  });

  console.log("[SuggestionEngine] Sistema Suggerimenti & Sondaggi attivo!");
}

module.exports = {
  initSuggestionEngine,
  loadSuggestions,
  saveSuggestions
};
