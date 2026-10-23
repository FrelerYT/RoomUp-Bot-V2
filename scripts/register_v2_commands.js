require("dotenv").config();
const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

async function main() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const rest = new REST({ version: "10" }).setToken(token);
  const me = await rest.get(Routes.user());
  const destId = "965378975675322438";

  console.log(`Deploying slash commands to Guild ${destId}...`);

  const commands = [
    // 1. Levels / XP - Community Commands
    new SlashCommandBuilder()
      .setName("rank")
      .setDescription("Mostra il tuo livello XP e la posizione in classifica")
      .addUserOption(opt => opt.setName("utente").setDescription("Utente da controllare").setRequired(false)),

    new SlashCommandBuilder()
      .setName("scoreboard-lvl")
      .setDescription("Mostra la classifica generale (scoreboard) dei livelli ed XP del server")
      .addIntegerOption(opt => opt.setName("pagina").setDescription("Numero di pagina della classifica (default 1)").setRequired(false)),

    // 2. Disciplinary / Moderation - Staff Privileged
    new SlashCommandBuilder()
      .setName("warn")
      .setDescription("Assegna un avvertimento disciplinare a un utente")
      .addUserOption(opt => opt.setName("utente").setDescription("Utente da sanzionare").setRequired(true))
      .addStringOption(opt => opt.setName("motivo").setDescription("Motivo dell'infrazione").setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
      .setName("warnings")
      .setDescription("Mostra lo storico delle sanzioni di un utente")
      .addUserOption(opt => opt.setName("utente").setDescription("Utente da controllare").setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
      .setName("clearwarns")
      .setDescription("Azzera la fedina disciplinare e rimuove i warn di un utente")
      .addUserOption(opt => opt.setName("utente").setDescription("Utente da azzerare").setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
      .setName("timeout")
      .setDescription("Isola un utente in timeout per un determinato tempo")
      .addUserOption(opt => opt.setName("utente").setDescription("Utente da isolare").setRequired(true))
      .addIntegerOption(opt => opt.setName("minuti").setDescription("Durata del timeout in minuti").setRequired(true))
      .addStringOption(opt => opt.setName("motivo").setDescription("Motivo del timeout").setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    new SlashCommandBuilder()
      .setName("kick")
      .setDescription("Espelle un utente dal server")
      .addUserOption(opt => opt.setName("utente").setDescription("Utente da espellere").setRequired(true))
      .addStringOption(opt => opt.setName("motivo").setDescription("Motivo dell'espulsione").setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    new SlashCommandBuilder()
      .setName("ban")
      .setDescription("Banna permanentemente un utente dal server")
      .addUserOption(opt => opt.setName("utente").setDescription("Utente da bannare").setRequired(true))
      .addStringOption(opt => opt.setName("motivo").setDescription("Motivo del ban").setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    // 3. Admin Panels - Admin Privileged
    new SlashCommandBuilder()
      .setName("ticket-panel")
      .setDescription("Invia il pannello dei ticket in questo canale")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
      .setName("verify-panel")
      .setDescription("Invia il pannello di verifica in questo canale")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    // 4. TTS BOT - Text To Speech & Auto Language Detection
    new SlashCommandBuilder()
      .setName("tts")
      .setDescription("Sistema Text-To-Speech con rilevamento automatico Italiano/Inglese")
      .addSubcommand(sub =>
        sub.setName("join")
          .setDescription("Connette il bot al tuo canale vocale e attiva la lettura dei messaggi")
          .addChannelOption(opt => opt.setName("canale").setDescription("Canale vocale a cui connettersi (opzionale)").setRequired(false))
      )
      .addSubcommand(sub =>
        sub.setName("leave")
          .setDescription("Disconnette il bot dal canale vocale corrente e ferma la lettura")
      )
      .addSubcommand(sub =>
        sub.setName("say")
          .setDescription("Pronuncia un messaggio vocale nel canale vocale con rilevamento lingua")
          .addStringOption(opt => opt.setName("testo").setDescription("Il testo da pronunciare").setRequired(true))
          .addStringOption(opt =>
            opt.setName("lingua")
              .setDescription("Lingua della pronuncia (default: rilevamento automatico)")
              .setRequired(false)
              .addChoices(
                { name: "🤖 Rilevamento Automatico (Italiano / Inglese)", value: "auto" },
                { name: "🇮🇹 Italiano", value: "it" },
                { name: "🇬🇧 English", value: "en" }
              )
          )
      )
      .addSubcommand(sub =>
        sub.setName("auto")
          .setDescription("Attiva o disattiva la lettura automatica dei messaggi in questo canale")
          .addBooleanOption(opt => opt.setName("attivo").setDescription("Attiva o disattiva la lettura automatica").setRequired(true))
          .addChannelOption(opt => opt.setName("canale").setDescription("Canale testuale da associare (default: canale corrente)").setRequired(false))
      )
      .addSubcommand(sub =>
        sub.setName("stop")
          .setDescription("Ferma la riproduzione vocale corrente e svuota la coda TTS")
      )
      .addSubcommand(sub =>
        sub.setName("queue")
          .setDescription("Mostra lo stato della coda messaggi TTS e le impostazioni correnti")
      )
      .addSubcommand(sub =>
        sub.setName("help")
          .setDescription("Guida all'uso di TTS BOT (comandi, rilevamento lingua e trucchi)")
      )
  ].map(c => c.toJSON());

  const res = await rest.put(Routes.applicationGuildCommands(me.id, destId), {
    body: commands
  });

  console.log(`✅ Successfully deployed ${res.length} guild slash commands to ${destId}!`);
}

main().catch(console.error);
