const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  PermissionFlagsBits
} = require("discord.js");

// In-memory active polls: pollId -> { question, options: [{ label, votes: Set(userIds) }], authorId }
const activePolls = new Map();

function generateProgressBar(percentage, length = 10) {
  const filled = Math.round((percentage / 100) * length);
  const empty = length - filled;
  return "█".repeat(filled) + "░".repeat(Math.max(0, empty));
}

function initUtilitiesEngine(client) {
  client.on("interactionCreate", async (interaction) => {
    try {
      // 1. Button interactions for active polls
      if (interaction.isButton() && interaction.customId.startsWith("poll_vote_")) {
      const parts = interaction.customId.split("_");
      const pollId = parts[2];
      const optIdx = parseInt(parts[3], 10);

      const poll = activePolls.get(pollId);
      if (!poll) {
        return interaction.reply({ content: "❌ Questo sondaggio è scaduto o archiviato.", ephemeral: true });
      }

      const userId = interaction.user.id;

      // Remove user vote from all options
      poll.options.forEach(opt => opt.votes.delete(userId));

      // Add vote to chosen option
      poll.options[optIdx].votes.add(userId);

      // Re-calculate percentages
      const totalVotes = poll.options.reduce((sum, o) => sum + o.votes.size, 0);

      let desc = `### ${poll.question}\n\n`;
      poll.options.forEach((opt, idx) => {
        const pct = totalVotes > 0 ? Math.round((opt.votes.size / totalVotes) * 100) : 0;
        const bar = generateProgressBar(pct, 12);
        desc += `**${idx + 1}. ${opt.label}**\n\`[${bar}]\` **${pct}%** (${opt.votes.size} voti)\n\n`;
      });
      desc += `*Totale voti registrati: **${totalVotes}*** • Clicca un pulsante per cambiare il tuo voto.`;

      const updatedEmbed = new EmbedBuilder()
        .setTitle("📊 Sondaggio della Community")
        .setDescription(desc)
        .setColor("#5865F2")
        .setFooter({ text: "Sondaggio Interattivo Live • RoomUp! V2" })
        .setTimestamp();

      await interaction.update({ embeds: [updatedEmbed] });
      return;
    }

    if (!interaction.isChatInputCommand()) return;
    const { commandName, guild, user } = interaction;
    if (!guild) return;

    // 2. /poll
    if (commandName === "poll") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({ content: "❌ Devi avere il permesso di gestire i messaggi per avviare un sondaggio.", ephemeral: true });
      }
      const question = interaction.options.getString("domanda", true);
      const opt1 = interaction.options.getString("opzione1", true);
      const opt2 = interaction.options.getString("opzione2", true);
      const opt3 = interaction.options.getString("opzione3");
      const opt4 = interaction.options.getString("opzione4");

      const rawOptions = [opt1, opt2, opt3, opt4].filter(Boolean);
      const pollId = `poll_${Date.now()}`;

      const pollData = {
        question,
        options: rawOptions.map(label => ({ label, votes: new Set() })),
        authorId: user.id
      };
      activePolls.set(pollId, pollData);

      const row = new ActionRowBuilder();
      rawOptions.forEach((label, idx) => {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`poll_vote_${pollId}_${idx}`)
            .setLabel(`${idx + 1}. ${label.length > 20 ? label.slice(0, 18) + '..' : label}`)
            .setStyle(ButtonStyle.Primary)
        );
      });

      let initialDesc = `### ${question}\n\n`;
      rawOptions.forEach((label, idx) => {
        initialDesc += `**${idx + 1}. ${label}**\n\`[░░░░░░░░░░░░]\` **0%** (0 voti)\n\n`;
      });
      initialDesc += "*Totale voti: **0*** • Clicca su uno dei pulsanti sottostanti per esprimere la tua preferenza!";

      const embed = new EmbedBuilder()
        .setTitle("📊 Sondaggio della Community")
        .setDescription(initialDesc)
        .setColor("#5865F2")
        .setFooter({ text: `Avviato da ${user.username}` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], components: [row] });
    }

    // 3. /remind
    if (commandName === "remind") {
      const minutes = interaction.options.getInteger("minuti", true);
      const message = interaction.options.getString("promemoria", true);

      const targetTime = new Date(Date.now() + minutes * 60 * 1000);
      const timeStr = targetTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

      await interaction.reply({
        content: `⏰ Ricevuto! Ti ricorderò: **"${message}"** tra **${minutes} minuti** (alle ore ${timeStr}).`,
        ephemeral: true
      });

      setTimeout(async () => {
        const reminderEmbed = new EmbedBuilder()
          .setTitle("⏰ Promemoria RoomUp!")
          .setDescription(`Ciao <@${user.id}>, avevi chiesto di ricordarti:\n\n> **${message}**`)
          .setColor("#f0b232")
          .setTimestamp();

        // Send in DM or channel fallback
        const dm = await user.send({ embeds: [reminderEmbed] }).catch(() => null);
        if (!dm && interaction.channel) {
          interaction.channel.send({ content: `<@${user.id}>`, embeds: [reminderEmbed] }).catch(() => null);
        }
      }, minutes * 60 * 1000);
    }

    // 4. /translate
    if (commandName === "translate") {
      const text = interaction.options.getString("testo", true);
      const targetLang = interaction.options.getString("lingua", true).toLowerCase();

      // Dictionary of common phrases for key languages
      const dict = {
        en: { "ciao": "hello", "buongiorno": "good morning", "grazie": "thank you", "benvenuto": "welcome", "come stai": "how are you", "server": "server", "regole": "rules" },
        es: { "ciao": "hola", "buongiorno": "buenos días", "grazie": "gracias", "benvenuto": "bienvenido", "come stai": "cómo estás", "server": "servidor", "regole": "reglas" },
        fr: { "ciao": "salut", "buongiorno": "bonjour", "grazie": "merci", "benvenuto": "bienvenue", "come stai": "comment ça va", "server": "serveur", "regole": "règles" },
        de: { "ciao": "hallo", "buongiorno": "guten morgen", "grazie": "danke", "benvenuto": "willkommen", "come stai": "wie geht's", "server": "server", "regole": "regeln" }
      };

      const langNames = { en: "Inglese 🇬🇧", es: "Spagnolo 🇪🇸", fr: "Francese 🇫🇷", de: "Tedesco 🇩🇪" };

      let translated = text;
      const targetDict = dict[targetLang];
      if (targetDict) {
        for (const [itWord, foreignWord] of Object.entries(targetDict)) {
          const reg = new RegExp(`\\b${itWord}\\b`, "gi");
          translated = translated.replace(reg, foreignWord);
        }
      } else {
        translated = `[Traduzione in ${targetLang.toUpperCase()}]: ${text}`;
      }

      const embed = new EmbedBuilder()
        .setTitle("🌐 Traduzione Istantanea")
        .addFields(
          { name: "Testo Originale", value: `\`\`\`${text}\`\`\``, inline: false },
          { name: `Tradotto in ${langNames[targetLang] || targetLang}`, value: `\`\`\`${translated}\`\`\``, inline: false }
        )
        .setColor("#00b0f4")
        .setFooter({ text: "Strumento Traduzione RoomUp! V2" })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // 5. /embed-builder
    if (commandName === "embed-builder") {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: "❌ Solo gli amministratori possono utilizzare l'embed builder.", ephemeral: true });
      }

      const title = interaction.options.getString("titolo", true);
      const description = interaction.options.getString("descrizione", true);
      const color = interaction.options.getString("colore") || "#5865F2";

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description.replace(/\\n/g, "\n"))
        .setColor(color)
        .setFooter({ text: `Annuncio ufficiale • ${guild.name}` })
        .setTimestamp();

      await interaction.reply({ content: "✅ Embed pubblicato con successo!", ephemeral: true });
      return interaction.channel.send({ embeds: [embed] });
    }
    } catch (err) {
      console.error("[UtilitiesEngine] Errore esecuzione comando/interazione:", err.message);
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "❌ Si è verificato un errore durante l'interazione.", ephemeral: true }).catch(() => null);
      }
    }
  });

  console.log("[UtilitiesEngine] Suite Utility Operative & Sondaggi Attiva!");
}

module.exports = { initUtilitiesEngine };
