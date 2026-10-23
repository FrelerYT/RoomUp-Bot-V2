const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  Events
} = require("discord.js");

async function sendReactionRolePanel(channel, panelData) {
  if (!channel || !channel.isTextBased()) throw new Error("Canale non valido o non testuale.");

  const title = panelData.title || "🎭 Assegnazione Ruoli";
  const desc = panelData.description || "Clicca sui pulsanti sottostanti per ottenere o rimuovere i ruoli desiderati.";
  const color = panelData.color || "#5865F2";
  const rolesList = Array.isArray(panelData.roles) ? panelData.roles : [];

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .setColor(color)
    .setFooter({ text: "RoomUp! V2 Reaction Roles" });

  if (rolesList.length === 0) {
    throw new Error("Nessun ruolo configurato per questo pannello.");
  }

  // Max 5 buttons per row, up to 5 rows (max 25 roles)
  const rows = [];
  let currentRow = new ActionRowBuilder();

  rolesList.slice(0, 25).forEach((item, idx) => {
    if (currentRow.components.length >= 5) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder();
    }

    const btnStyle = item.style === "success" ? ButtonStyle.Success
      : item.style === "danger" ? ButtonStyle.Danger
      : item.style === "secondary" ? ButtonStyle.Secondary
      : ButtonStyle.Primary;

    const btn = new ButtonBuilder()
      .setCustomId(`rr_toggle_${item.roleId}`)
      .setLabel((item.label || "Ruolo").slice(0, 80))
      .setStyle(btnStyle);

    if (item.emoji) btn.setEmoji(item.emoji);
    currentRow.addComponents(btn);
  });

  if (currentRow.components.length > 0) {
    rows.push(currentRow);
  }

  return await channel.send({ embeds: [embed], components: rows });
}

function initReactionRolesEngine(client) {

  // Button toggle listener
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("rr_toggle_")) return;

    const roleId = interaction.customId.replace("rr_toggle_", "");
    const guild = interaction.guild;
    if (!guild) return;

    const role = guild.roles.cache.get(roleId);
    if (!role) {
      return interaction.reply({ content: "❌ Questo ruolo non esiste più nel server.", ephemeral: true });
    }

    const member = interaction.member;
    const hasRole = member.roles.cache.has(roleId);

    try {
      if (hasRole) {
        await member.roles.remove(role, "Reaction Roles: Rimozione autonoma");
        return interaction.reply({ content: `❌ Ti è stato rimosso il ruolo **@${role.name}**.`, ephemeral: true });
      } else {
        await member.roles.add(role, "Reaction Roles: Assegnazione autonoma");
        return interaction.reply({ content: `✅ Ti è stato assegnato il ruolo **@${role.name}**!`, ephemeral: true });
      }
    } catch (err) {
      return interaction.reply({ content: `❌ Impossibile modificare il ruolo (controlla che il ruolo del bot sia posizionato più in alto nella gerarchia dei ruoli).`, ephemeral: true });
    }
  });

  // Slash command /reaction-panel
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "reaction-panel") return;

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: "❌ Solo gli amministratori possono usare questo comando.", ephemeral: true });
    }

    // Interactive helper response
    return interaction.reply({
      content: "💡 Puoi creare e inviare pannelli personalizzati di **Ruoli a Pulsante** direttamente dalla Web Dashboard nella sezione **Ruoli a Pulsante**!",
      ephemeral: true
    });
  });

  console.log("[ReactionRolesEngine] Sistema Reaction Roles a Pulsante attivo!");
}

module.exports = {
  initReactionRolesEngine,
  sendReactionRolePanel
};
