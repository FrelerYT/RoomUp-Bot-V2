const { EmbedBuilder, Events } = require("discord.js");

function initCustomCommandsEngine(client, loadSettingsFn) {
  client.on(Events.MessageCreate, async (message) => {
    try {
      if (!message.guild || message.author.bot) return;

      const settings = typeof loadSettingsFn === 'function' ? loadSettingsFn() : {};
      const config = settings[message.guild.id]?.customCommands;
      if (!config || !Array.isArray(config.triggers)) return;

      const text = message.content.trim().toLowerCase();

      for (const cmd of config.triggers) {
        if (!cmd.trigger) continue;
        const trigger = cmd.trigger.trim().toLowerCase();

        const match = cmd.exactMatch !== false ? text === trigger : text.includes(trigger);

        if (match) {
          if (cmd.useEmbed) {
            const embed = new EmbedBuilder()
              .setTitle(cmd.title || cmd.trigger)
              .setDescription(cmd.response || "")
              .setColor(cmd.color || "#5865F2")
              .setFooter({ text: `${message.guild.name} • Risposta Automatica` });
            return await message.channel.send({ embeds: [embed] }).catch(() => null);
          } else {
            return await message.channel.send({ content: cmd.response }).catch(() => null);
          }
        }
      }
    } catch (e) {
      console.error("[CustomCommandsEngine] Errore risposta custom:", e.message);
    }
  });

  console.log("[CustomCommandsEngine] Sistema Risposte Rapide & Comandi Custom attivo!");
}

module.exports = { initCustomCommandsEngine };
