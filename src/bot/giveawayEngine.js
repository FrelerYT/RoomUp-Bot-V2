const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  Events
} = require("discord.js");
const fs = require("fs");
const path = require("path");

const GIVEAWAYS_FILE = path.join(__dirname, "../../data/giveaways.json");

function ensureDataDir() {
  const dir = path.dirname(GIVEAWAYS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadGiveaways() {
  ensureDataDir();
  try {
    if (!fs.existsSync(GIVEAWAYS_FILE)) {
      const initial = [];
      fs.writeFileSync(GIVEAWAYS_FILE, JSON.stringify(initial, null, 2), "utf8");
      return initial;
    }
    return JSON.parse(fs.readFileSync(GIVEAWAYS_FILE, "utf8"));
  } catch (e) {
    return [];
  }
}

function saveGiveaways(data) {
  ensureDataDir();
  try {
    fs.writeFileSync(GIVEAWAYS_FILE, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (e) {
    return false;
  }
}

async function endGiveaway(client, giveaway, loadSettingsFn = null) {
  try {
    const list = loadGiveaways();
    const gData = list.find(g => g.id === giveaway.id);
    if (!gData || gData.ended) return;

    gData.ended = true;
    saveGiveaways(list);

    const guild = client.guilds.cache.get(gData.guildId);
    if (!guild) return;
    const channel = guild.channels.cache.get(gData.channelId);
    if (!channel || !channel.isTextBased()) return;

    const settings = typeof loadSettingsFn === 'function' ? loadSettingsFn() : {};
    const config = settings[gData.guildId]?.giveaways || {};

    const message = await channel.messages.fetch(gData.messageId).catch(() => null);
    const participants = gData.participants || [];

    // Roll winners
    const winners = [];
    const pool = [...participants];
    const targetCount = Math.min(gData.winnersCount, pool.length);

    for (let i = 0; i < targetCount; i++) {
      const randIdx = Math.floor(Math.random() * pool.length);
      winners.push(pool.splice(randIdx, 1)[0]);
    }

    gData.winners = winners;
    saveGiveaways(list);

    const endTitle = config.endEmbedTitle || "🎉 GIVEAWAY TERMINATO 🎉";
    const winCol = config.winEmbedColor || "#23a55a";
    const loseCol = config.loseEmbedColor || "#f23f43";

    const endEmbed = new EmbedBuilder()
      .setTitle(endTitle)
      .setColor(winners.length > 0 ? winCol : loseCol)
      .setDescription(
        `> **Premio:** 🎁 **${gData.prize}**\n` +
        `> **Organizzato da:** <@${gData.hostId}>\n` +
        `> **Partecipanti Totali:** **${participants.length}**\n\n` +
        (winners.length > 0
          ? `🏆 **Vincitore/i:** ${winners.map(w => `<@${w}>`).join(", ")}!`
          : "❌ Nessun partecipante valido per l'estrazione.")
      )
      .setFooter({ text: "RoomUp! V2 Giveaway System" })
      .setTimestamp();

    if (message) {
      await message.edit({
        embeds: [endEmbed],
        components: [] // disable participate button
      }).catch(() => null);
    }

    if (winners.length > 0) {
      const winTemplate = config.winMessage || "🎊 Congratulazioni {winners}! Hai vinto **{prize}**!";
      const announce = winTemplate
        .replace(/{winners}/g, winners.map(w => `<@${w}>`).join(" "))
        .replace(/{prize}/g, gData.prize)
        .replace(/{guild}/g, guild.name);

      await channel.send({ content: announce }).catch(() => null);

      if (config.sendDmToWinners !== false) {
        const dmTemplate = config.dmWinnerMessage || "🎉 Complimenti! Hai vinto il giveaway per **{prize}** su **{guild}**!";
        const dmText = dmTemplate.replace(/{prize}/g, gData.prize).replace(/{guild}/g, guild.name);
        for (const wId of winners) {
          const user = await client.users.fetch(wId).catch(() => null);
          if (user) user.send({ content: dmText }).catch(() => null);
        }
      }
    }

  } catch (e) {
    console.error("[GiveawayEngine] Errore conclusione giveaway:", e.message);
  }
}

function initGiveawayEngine(client, loadSettingsFn) {

  // Check expired giveaways every 15 seconds
  setInterval(() => {
    const list = loadGiveaways();
    const now = Date.now();
    for (const g of list) {
      if (!g.ended && now >= g.endsAt) {
        endGiveaway(client, g, loadSettingsFn);
      }
    }
  }, 15000);

  // Button Interaction: Join / Leave Giveaway
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("giveaway_join_")) return;

    const giveawayId = interaction.customId.replace("giveaway_join_", "");
    const list = loadGiveaways();
    const gData = list.find(g => g.id === giveawayId);

    if (!gData || gData.ended) {
      return interaction.reply({ content: "⚠️ Questo giveaway è già terminato!", ephemeral: true });
    }

    if (!Array.isArray(gData.participants)) gData.participants = [];
    const userId = interaction.user.id;
    const hasJoined = gData.participants.includes(userId);

    if (hasJoined) {
      gData.participants = gData.participants.filter(id => id !== userId);
      saveGiveaways(list);
      await interaction.reply({ content: "❌ Ti sei ritirato dal giveaway.", ephemeral: true });
    } else {
      gData.participants.push(userId);
      saveGiveaways(list);
      await interaction.reply({ content: `🎉 Ti sei iscritto al giveaway per **${gData.prize}**! Buona fortuna!`, ephemeral: true });
    }

    // Update button label with participant count
    try {
      const updatedRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`giveaway_join_${gData.id}`)
          .setLabel(`Partecipa (${gData.participants.length})`)
          .setStyle(ButtonStyle.Success)
          .setEmoji("🎉")
      );
      await interaction.message.edit({ components: [updatedRow] }).catch(() => null);
    } catch (e) {}
  });

  // Slash command /giveaway-start
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "giveaway-start") return;

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: "❌ Solo gli amministratori possono creare giveaway.", ephemeral: true });
    }

    const durationMins = interaction.options.getInteger("durata") || 60;
    const winnersCount = interaction.options.getInteger("vincitori") || 1;
    const prize = interaction.options.getString("premio");

    await interaction.deferReply({ ephemeral: true });

    const settings = typeof loadSettingsFn === 'function' ? loadSettingsFn() : {};
    const config = settings[interaction.guild.id]?.giveaways || {};

    const endsAt = Date.now() + (durationMins * 60 * 1000);
    const endTimestamp = Math.floor(endsAt / 1000);

    const embed = new EmbedBuilder()
      .setTitle(config.startEmbedTitle || "🎉 GIVEAWAY DELLA COMMUNITY 🎉")
      .setColor(config.startEmbedColor || "#5865F2")
      .setDescription(
        `> **Premio:** 🎁 **${prize}**\n` +
        `> **Vincitori:** **${winnersCount}**\n` +
        `> **Organizzato da:** <@${interaction.user.id}>\n` +
        `> **Termina:** <t:${endTimestamp}:R> (<t:${endTimestamp}:f>)\n\n` +
        `Clicca sul pulsante sottostante per partecipare all'estrazione!`
      )
      .setFooter({ text: "RoomUp! V2 Giveaway System" })
      .setTimestamp();

    const gId = `g_${Date.now()}`;
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`giveaway_join_${gId}`)
        .setLabel("Partecipa (0)")
        .setStyle(ButtonStyle.Success)
        .setEmoji("🎉")
    );

    const pingContent = config.pingRoleEnabled !== false ? (config.pingRole ? `||${config.pingRole}||` : "||@everyone||") : undefined;

    const sentMsg = await interaction.channel.send({
      content: pingContent,
      embeds: [embed],
      components: [row]
    }).catch(() => null);

    if (!sentMsg) {
      return interaction.editReply({ content: "❌ Impossibile inviare il messaggio del giveaway nel canale." });
    }

    const list = loadGiveaways();
    list.push({
      id: gId,
      guildId: interaction.guild.id,
      channelId: interaction.channel.id,
      messageId: sentMsg.id,
      prize,
      winnersCount,
      hostId: interaction.user.id,
      createdAt: Date.now(),
      endsAt,
      ended: false,
      participants: []
    });
    saveGiveaways(list);

    return interaction.editReply({ content: `✅ Giveaway per **${prize}** avviato con successo in questo canale!` });
  });

  console.log("[GiveawayEngine] Sistema Giveaway attivo!");
}

module.exports = {
  initGiveawayEngine,
  loadGiveaways,
  saveGiveaways,
  endGiveaway
};
