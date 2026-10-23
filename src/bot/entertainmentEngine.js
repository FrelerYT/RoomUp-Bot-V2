const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require("discord.js");

// 12 Domande Trivia
const TRIVIA_QUESTIONS = [
  {
    question: "Qual è il pianeta più vicino al Sole?",
    options: ["Mercurio", "Venere", "Marte", "Terra"],
    correct: 0,
    explanation: "Mercurio è il pianeta più interno del sistema solare e il più vicino al Sole."
  },
  {
    question: "In che anno è stato rilasciato Minecraft ufficialmente (versione 1.0)?",
    options: ["2009", "2011", "2013", "2015"],
    correct: 1,
    explanation: "Sebbene le versioni alpha siano uscite nel 2009, Minecraft 1.0 è stato rilasciato il 18 novembre 2011."
  },
  {
    question: "Qual è il linguaggio di programmazione principale con cui è scritto Discord?",
    options: ["Elixir / Rust / Python", "PHP", "Java puro", "Ruby"],
    correct: 0,
    explanation: "I servizi backend di Discord utilizzano intensamente Elixir, Rust e Python."
  },
  {
    question: "Qual è la capitale dell'Australia?",
    options: ["Sydney", "Melbourne", "Canberra", "Brisbane"],
    correct: 2,
    explanation: "Canberra è stata scelta come capitale federale come compromesso tra Sydney e Melbourne."
  },
  {
    question: "Quanti tasti ha un pianoforte standard da concerto?",
    options: ["76", "84", "88", "92"],
    correct: 2,
    explanation: "Un pianoforte standard ha 88 tasti (52 bianchi e 36 neri)."
  },
  {
    question: "Quale tra questi Pokémon è il primo nel Pokédex Nazionale (#001)?",
    options: ["Pikachu", "Charmander", "Bulbasaur", "Squirtle"],
    correct: 2,
    explanation: "Bulbasaur è il numero #001 del Pokédex di Kanto e Nazionale."
  },
  {
    question: "Chi ha diretto il film capolavoro 'Interstellar' (2014)?",
    options: ["Steven Spielberg", "Christopher Nolan", "Quentin Tarantino", "James Cameron"],
    correct: 1,
    explanation: "Interstellar è stato diretto da Christopher Nolan."
  },
  {
    question: "Qual è l'elemento chimico con il simbolo 'Au'?",
    options: ["Argento", "Oro", "Alluminio", "Rame"],
    correct: 1,
    explanation: "Au deriva dal latino 'Aurum', che significa Oro."
  },
  {
    question: "In che anno è caduto il Muro di Berlino?",
    options: ["1987", "1989", "1991", "1993"],
    correct: 1,
    explanation: "Il Muro di Berlino è caduto la notte del 9 novembre 1989."
  },
  {
    question: "Qual è il videogioco più venduto di tutti i tempi?",
    options: ["Grand Theft Auto V", "Minecraft", "Tetris", "Wii Sports"],
    correct: 1,
    explanation: "Minecraft ha superato le 300 milioni di copie vendute in tutto il mondo."
  },
  {
    question: "Quale gas compone la maggior parte dell'atmosfera terrestre?",
    options: ["Ossigeno", "Azoto", "Anidride Carbonica", "Idrogeno"],
    correct: 1,
    explanation: "L'azoto compone circa il 78% dell'atmosfera terrestre."
  },
  {
    question: "Quale azienda ha creato la celebre console PlayStation?",
    options: ["Nintendo", "Microsoft", "Sega", "Sony"],
    correct: 3,
    explanation: "Sony ha lanciato la prima PlayStation in Giappone nel dicembre 1994."
  }
];

// Helper Blackjack
function drawCard() {
  const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  const rank = ranks[Math.floor(Math.random() * ranks.length)];
  let value = parseInt(rank, 10);
  if (["J", "Q", "K"].includes(rank)) value = 10;
  if (rank === "A") value = 11;
  return { rank, value };
}

function calculateHand(hand) {
  let score = hand.reduce((acc, c) => acc + c.value, 0);
  let aces = hand.filter(c => c.rank === "A").length;
  while (score > 21 && aces > 0) {
    score -= 10;
    aces -= 1;
  }
  return score;
}

// Helper Tris Win Check
function checkTrisWinner(board) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  if (board.every(cell => cell !== null)) return "draw";
  return null;
}

function initEntertainmentEngine(client, loadSettingsFn) {
  const GAME_KEY_MAP = {
    "trivia": "trivia",
    "math-challenge": "math",
    "rps": "rps",
    "slots": "slots",
    "blackjack": "blackjack",
    "piualto": "piualto",
    "mysterybox": "mysterybox",
    "grattaevinci": "grattaevinci",
    "ruotafortuna": "ruotafortuna",
    "indovina": "indovina",
    "dadi": "dadi",
    "tris": "tris",
    "coinflip": "coinflip",
    "meme": "meme"
  };

  client.on("interactionCreate", async (interaction) => {
    try {
      if (!interaction.isChatInputCommand()) return;
      const { commandName, guild, user } = interaction;
      if (!guild) return;

      const gameKey = GAME_KEY_MAP[commandName];
      if (!gameKey) return;

      const settings = typeof loadSettingsFn === 'function' ? loadSettingsFn() : {};
      const config = settings[guild.id]?.entertainment || { enabled: true, games: {} };

      if (config.enabled === false) {
        return interaction.reply({
          content: "❌ Il modulo **Minigiochi & Intrattenimento** è disabilitato su questo server.",
          ephemeral: true
        });
      }

      const gameConfig = config.games?.[gameKey] || config.games?.[commandName];
      if (gameConfig && gameConfig.enabled === false) {
        return interaction.reply({
          content: `❌ Il minigioco **/${commandName}** è stato disattivato singolarmente su questo server.`,
          ephemeral: true
        });
      }

      const gameEmbedColor = gameConfig?.embedColor || "#5865F2";

      // ================= 1. /trivia =================
      if (commandName === "trivia") {
        const q = TRIVIA_QUESTIONS[Math.floor(Math.random() * TRIVIA_QUESTIONS.length)];
        const row = new ActionRowBuilder();

        q.options.forEach((opt, idx) => {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`trivia_${idx}`)
              .setLabel(opt)
              .setStyle(ButtonStyle.Primary)
          );
        });

        const embed = new EmbedBuilder()
          .setTitle("🧠 RoomUp Trivia Challenge")
          .setDescription(`**${q.question}**\n\n*Hai 15 secondi per selezionare la risposta corretta!*`)
          .setColor("#5865F2")
          .setFooter({ text: "Quiz interattivo RoomUp! V2" })
          .setTimestamp();

        const response = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        const collector = response.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 15000
        });

        let answered = false;

        collector.on("collect", async (btnInt) => {
          if (btnInt.user.id !== user.id) {
            return btnInt.reply({ content: "❌ Questa domanda è riservata a chi ha avviato il quiz!", ephemeral: true });
          }

          answered = true;
          const selectedIdx = parseInt(btnInt.customId.replace("trivia_", ""), 10);
          const isCorrect = selectedIdx === q.correct;

          const resultEmbed = new EmbedBuilder()
            .setTitle(isCorrect ? "🎉 Risposta Esatta!" : "❌ Risposta Sbagliata!")
            .setDescription(`**${q.question}**\n\n` +
              `La tua risposta: **${q.options[selectedIdx]}**\n` +
              `Risposta corretta: **${q.options[q.correct]}**\n\n` +
              `💡 *${q.explanation}*`)
            .setColor(isCorrect ? "#23a55a" : "#f23f43");

          const disabledRow = new ActionRowBuilder();
          q.options.forEach((opt, idx) => {
            disabledRow.addComponents(
              new ButtonBuilder()
                .setCustomId(`trivia_done_${idx}`)
                .setLabel(opt)
                .setStyle(idx === q.correct ? ButtonStyle.Success : (idx === selectedIdx ? ButtonStyle.Danger : ButtonStyle.Secondary))
                .setDisabled(true)
            );
          });

          await btnInt.update({ embeds: [resultEmbed], components: [disabledRow] });
          collector.stop();
        });

        collector.on("end", async () => {
          if (!answered) {
            const timeoutEmbed = new EmbedBuilder()
              .setTitle("⏰ Tempo Scaduto!")
              .setDescription(`Non hai risposto entro 15 secondi.\nLa risposta corretta era: **${q.options[q.correct]}**`)
              .setColor("#f0b232");

            await interaction.editReply({ embeds: [timeoutEmbed], components: [] }).catch(() => null);
          }
        });
      }

      // ================= 2. /math-challenge & /matematica =================
      if (commandName === "math-challenge" || commandName === "matematica") {
        const a = Math.floor(Math.random() * 40) + 10;
        const b = Math.floor(Math.random() * 40) + 10;
        const op = Math.random() > 0.5 ? "+" : "*";
        const correctAns = op === "+" ? a + b : a * Math.floor(Math.random() * 8 + 2);
        const secondNum = op === "+" ? b : Math.floor(correctAns / a);
        const fake1 = correctAns + (Math.floor(Math.random() * 5) + 1);
        const fake2 = Math.max(1, correctAns - (Math.floor(Math.random() * 5) + 1));
        const fake3 = correctAns + 10;

        const opts = [correctAns, fake1, fake2, fake3].sort(() => Math.random() - 0.5);
        const correctIndex = opts.indexOf(correctAns);

        const row = new ActionRowBuilder();
        opts.forEach((optVal, idx) => {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`math_${idx}`)
              .setLabel(String(optVal))
              .setStyle(ButtonStyle.Primary)
          );
        });

        const embed = new EmbedBuilder()
          .setTitle("🧮 Sfida di Calcolo Rapido")
          .setDescription(`Risolvi al volo l'operazione:\n\n# \`${a} ${op === "+" ? "+" : "x"} ${secondNum}\`\n\n*Hai 12 secondi per cliccare la risposta esatta!*`)
          .setColor("#00b0f4");

        const reply = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        const collector = reply.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 12000
        });

        collector.on("collect", async (btn) => {
          if (btn.user.id !== user.id) return btn.reply({ content: "Sfida riservata a chi l'ha lanciata!", ephemeral: true });

          const picked = parseInt(btn.customId.replace("math_", ""), 10);
          const win = picked === correctIndex;

          await btn.update({
            embeds: [
              new EmbedBuilder()
                .setTitle(win ? "⚡ Riflessi da Campione!" : "💥 Calcolo Errato!")
                .setDescription(`Operazione: \`${a} ${op === "+" ? "+" : "x"} ${secondNum} = ${correctAns}\`\n\n` +
                  (win ? "🎉 **Hai risposto in tempo record!** Ottima velocità mentale." : `❌ Hai selezionato **${opts[picked]}**. La risposta corretta era **${correctAns}**.`))
                .setColor(win ? "#23a55a" : "#f23f43")
            ],
            components: []
          });
          collector.stop();
        });
      }

      // ================= 3. /rps (Sasso, Carta, Forbice) =================
      if (commandName === "rps") {
        const argMossa = interaction.options.getString("mossa");
        const choices = ["sasso", "carta", "forbice"];
        const icons = { sasso: "🪨 Sasso", carta: "📄 Carta", forbice: "✂️ Forbice" };

        const resolveRps = (userChoice) => {
          const botChoice = choices[Math.floor(Math.random() * choices.length)];
          let outcome = "🤝 Pareggio!";
          let color = "#f0b232";

          if (userChoice === botChoice) {
            outcome = "🤝 Pareggio!";
          } else if (
            (userChoice === "sasso" && botChoice === "forbice") ||
            (userChoice === "carta" && botChoice === "sasso") ||
            (userChoice === "forbice" && botChoice === "carta")
          ) {
            outcome = "🎉 Hai Vinto tu!";
            color = "#23a55a";
          } else {
            outcome = "🤖 Ha vinto il Bot!";
            color = "#f23f43";
          }

          return new EmbedBuilder()
            .setTitle("🎮 Sasso, Carta, Forbice")
            .addFields(
              { name: "La tua mossa", value: icons[userChoice] || userChoice, inline: true },
              { name: "Mossa del Bot", value: icons[botChoice] || botChoice, inline: true },
              { name: "Verdetto", value: `**${outcome}**`, inline: false }
            )
            .setColor(color)
            .setTimestamp();
        };

        if (argMossa) {
          return interaction.reply({ embeds: [resolveRps(argMossa.toLowerCase())] });
        }

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("rps_sasso").setLabel("🪨 Sasso").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("rps_carta").setLabel("📄 Carta").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("rps_forbice").setLabel("✂️ Forbice").setStyle(ButtonStyle.Primary)
        );

        const embed = new EmbedBuilder()
          .setTitle("🎮 Sasso, Carta, Forbice")
          .setDescription("Scegli la tua mossa premendo uno dei pulsanti qui sotto!")
          .setColor("#5865F2");

        const reply = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        const collector = reply.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 30000
        });

        collector.on("collect", async (btn) => {
          if (btn.user.id !== user.id) return btn.reply({ content: "Non è la tua partita!", ephemeral: true });
          const userChoice = btn.customId.replace("rps_", "");
          await btn.update({ embeds: [resolveRps(userChoice)], components: [] });
          collector.stop();
        });
      }

      // ================= 4. /slots (Slot Machine) =================
      if (commandName === "slots") {
        const emojis = ["🍒", "🍋", "🍇", "🔔", "💎", "7️⃣"];

        const spinSlots = () => {
          const r1 = emojis[Math.floor(Math.random() * emojis.length)];
          const r2 = emojis[Math.floor(Math.random() * emojis.length)];
          const r3 = emojis[Math.floor(Math.random() * emojis.length)];
          let title = "🎰 SLOT MACHINE";
          let resultMsg = "❌ Nessuna combinazione vincente. Ritenta!";
          let color = "#e74c3c";

          if (r1 === r2 && r2 === r3) {
            if (r1 === "7️⃣") {
              resultMsg = "💥 **JACKPOT SUPREMO 777!** Vittoria Leggendaria!";
              color = "#f1c40f";
            } else if (r1 === "💎") {
              resultMsg = "💎 **TRIPLO DIAMANTE!** Super Fortuna!";
              color = "#00b0f4";
            } else if (r1 === "🔔") {
              resultMsg = "🔔 **TRIPLA CAMPANA D'ORO!** Grande colpo!";
              color = "#f39c12";
            } else {
              resultMsg = `🎉 **TRIS PERFETTO DI ${r1}!** Ottima combinazione!`;
              color = "#2ecc71";
            }
          } else if (r1 === r2 || r2 === r3 || r1 === r3) {
            const pairEmoji = (r1 === r2 || r1 === r3) ? r1 : r2;
            resultMsg = `✨ **DOPPIA COMBO (${pairEmoji})!** Buona vincita!`;
            color = "#3498db";
          }

          return new EmbedBuilder()
            .setTitle(title)
            .setDescription(`\n# [  ${r1}  |  ${r2}  |  ${r3}  ]\n\n${resultMsg}`)
            .setColor(color)
            .setFooter({ text: "RoomUp Slot Machine • Premi 'Rigioca' per tentare di nuovo" })
            .setTimestamp();
        };

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("slots_respin").setLabel("🔄 Rigioca").setStyle(ButtonStyle.Success)
        );

        const reply = await interaction.reply({ embeds: [spinSlots()], components: [row], fetchReply: true });

        const collector = reply.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 60000
        });

        collector.on("collect", async (btn) => {
          if (btn.user.id !== user.id) return btn.reply({ content: "Avvia la tua slot machine con /slots!", ephemeral: true });
          await btn.update({ embeds: [spinSlots()], components: [row] });
        });

        collector.on("end", async () => {
          await interaction.editReply({ components: [] }).catch(() => null);
        });
      }

      // ================= 5. /blackjack =================
      if (commandName === "blackjack") {
        const playerHand = [drawCard(), drawCard()];
        const dealerHand = [drawCard(), drawCard()];

        const buildBjEmbed = (isFinal = false, outcomeText = "") => {
          const pScore = calculateHand(playerHand);
          const dScore = calculateHand(dealerHand);
          const dCardStr = isFinal ? dealerHand.map(c => c.rank).join(" ") + ` (Punti: **${dScore}**)` : `${dealerHand[0].rank} ❓`;

          let col = "#3498db";
          if (isFinal) {
            if (outcomeText.includes("Vittoria") || outcomeText.includes("sballato") || outcomeText.includes("21")) col = "#2ecc71";
            else if (outcomeText.includes("banco") || outcomeText.includes("Sballato") || outcomeText.includes("Batte")) col = "#e74c3c";
            else col = "#f39c12";
          }

          const eb = new EmbedBuilder()
            .setTitle("🃏 Tavolo Blackjack 21")
            .addFields(
              { name: "La tua mano", value: `${playerHand.map(c => c.rank).join(" ")} (Punti: **${pScore}**)`, inline: true },
              { name: "Mano del Banco", value: dCardStr, inline: true }
            )
            .setColor(col);

          if (isFinal) {
            eb.setDescription(`### ${outcomeText}`);
          } else {
            eb.setDescription("Vuoi un'altra carta o decidi di stare?");
          }

          return eb;
        };

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("bj_hit").setLabel("🃏 Chiedi Carta").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("bj_stand").setLabel("🛑 Stai").setStyle(ButtonStyle.Secondary)
        );

        if (calculateHand(playerHand) === 21) {
          return interaction.reply({ embeds: [buildBjEmbed(true, "🎉 BLACKJACK NATURALE (21)! Hai vinto alla grande!")] });
        }

        const reply = await interaction.reply({ embeds: [buildBjEmbed()], components: [row], fetchReply: true });

        const collector = reply.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 60000
        });

        collector.on("collect", async (btn) => {
          if (btn.user.id !== user.id) return btn.reply({ content: "Non è la tua mano di Blackjack!", ephemeral: true });

          if (btn.customId === "bj_hit") {
            playerHand.push(drawCard());
            const score = calculateHand(playerHand);

            if (score > 21) {
              await btn.update({ embeds: [buildBjEmbed(true, "💥 Hai Sballato! Il punteggio supera 21. Il Banco vince.")], components: [] });
              collector.stop();
            } else if (score === 21) {
              while (calculateHand(dealerHand) < 17) {
                dealerHand.push(drawCard());
              }
              const dScore = calculateHand(dealerHand);
              let verdict = "🏆 Punti 21 esatti! Hai vinto!";
              if (dScore === 21) verdict = "🤝 Pareggio (Push) a 21 punti!";
              await btn.update({ embeds: [buildBjEmbed(true, verdict)], components: [] });
              collector.stop();
            } else {
              await btn.update({ embeds: [buildBjEmbed()] });
            }
          } else if (btn.customId === "bj_stand") {
            while (calculateHand(dealerHand) < 17) {
              dealerHand.push(drawCard());
            }
            const pScore = calculateHand(playerHand);
            const dScore = calculateHand(dealerHand);

            let verdict = "";
            if (dScore > 21) {
              verdict = "🎉 Il Banco ha sballato! Vittoria tua!";
            } else if (pScore > dScore) {
              verdict = `🏆 Vittoria! Tu (${pScore}) batti il Banco (${dScore})!`;
            } else if (dScore > pScore) {
              verdict = `❌ Il Banco (${dScore}) batte il tuo punteggio (${pScore})!`;
            } else {
              verdict = `🤝 Pareggio (Push) a quota ${pScore}!`;
            }

            await btn.update({ embeds: [buildBjEmbed(true, verdict)], components: [] });
            collector.stop();
          }
        });

        collector.on("end", async () => {
          await interaction.editReply({ components: [] }).catch(() => null);
        });
      }

      // ================= 6. /piualto =================
      if (commandName === "piualto") {
        const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
        const currentIdx = Math.floor(Math.random() * ranks.length);
        const currentCard = ranks[currentIdx];

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("piualto_high").setLabel("⬆️ Più Alta").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("piualto_low").setLabel("⬇️ Più Bassa").setStyle(ButtonStyle.Danger)
        );

        const embed = new EmbedBuilder()
          .setTitle("🃏 Più Alto o Più Basso")
          .setDescription(`Carta attuale: **${currentCard}**\n\nLa prossima carta estratta sarà **più alta** o **più bassa**?`)
          .setColor("#3498db")
          .setFooter({ text: "Scala valori: 2 (minima) ... A (massima)" });

        const reply = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        const collector = reply.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 30000
        });

        collector.on("collect", async (btn) => {
          if (btn.user.id !== user.id) return btn.reply({ content: "Non è la tua partita!", ephemeral: true });

          let nextIdx;
          do {
            nextIdx = Math.floor(Math.random() * ranks.length);
          } while (nextIdx === currentIdx && Math.random() > 0.1);

          const nextCard = ranks[nextIdx];
          const guessedHigh = btn.customId === "piualto_high";
          const isHigher = nextIdx > currentIdx;
          const isLower = nextIdx < currentIdx;
          const isTie = nextIdx === currentIdx;

          let won = (guessedHigh && isHigher) || (!guessedHigh && isLower);
          let title = won ? "🎉 Hai Indovinato!" : (isTie ? "🤝 Stesso Valore!" : "💥 Previsione Errata!");
          let color = won ? "#2ecc71" : (isTie ? "#f39c12" : "#e74c3c");

          const resEmbed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(`Carta di partenza: **${currentCard}**\nNuova carta estratta: **${nextCard}**\n\n` +
              (won ? "Ottima intuizione! Hai vinto la sfida." : (isTie ? "Pareggio! Le due carte hanno lo stesso valore." : "Peccato, la fortuna non era dalla tua parte!")))
            .setColor(color);

          await btn.update({ embeds: [resEmbed], components: [] });
          collector.stop();
        });
      }

      // ================= 7. /mysterybox =================
      if (commandName === "mysterybox") {
        const outcomes = [
          { label: "🌟 Jackpot Dorato!", desc: "Hai scovato il tesoro leggendario!", color: "#f1c40f" },
          { label: "🎁 Premio Sorpresa!", desc: "Un fantastico regalo inaspettato!", color: "#2ecc71" },
          { label: "💥 Scatola Trappola!", desc: "È saltato fuori un simpatico gremlin dispettoso!", color: "#e74c3c" }
        ].sort(() => Math.random() - 0.5);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("mbox_0").setLabel("📦 Scatola 1").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("mbox_1").setLabel("📦 Scatola 2").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("mbox_2").setLabel("📦 Scatola 3").setStyle(ButtonStyle.Primary)
        );

        const embed = new EmbedBuilder()
          .setTitle("📦 Scatole Misteriose")
          .setDescription("Davanti a te ci sono 3 scatole sigillate.\nUna contiene un **Jackpot Dorato**, una una **Sorpresa** e una una **Trappola**!\n\nQuale decidi di aprire?")
          .setColor("#9b59b6");

        const reply = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        const collector = reply.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 30000
        });

        collector.on("collect", async (btn) => {
          if (btn.user.id !== user.id) return btn.reply({ content: "Non toccare le scatole degli altri!", ephemeral: true });

          const pickedIdx = parseInt(btn.customId.replace("mbox_", ""), 10);
          const chosen = outcomes[pickedIdx];

          const resEmbed = new EmbedBuilder()
            .setTitle(`📦 Hai aperto la Scatola ${pickedIdx + 1}!`)
            .setDescription(`## ${chosen.label}\n${chosen.desc}\n\n**Contenuto di tutte le scatole:**\n` +
              `📦 Scatola 1: ${outcomes[0].label}\n` +
              `📦 Scatola 2: ${outcomes[1].label}\n` +
              `📦 Scatola 3: ${outcomes[2].label}`)
            .setColor(chosen.color);

          await btn.update({ embeds: [resEmbed], components: [] });
          collector.stop();
        });
      }

      // ================= 8. /grattaevinci =================
      if (commandName === "grattaevinci") {
        const pool = ["💎", "👑", "⭐", "🍀", "💰", "❌"];
        const symbols = [];
        const winType = Math.random();
        if (winType > 0.6) {
          const lucky = pool[Math.floor(Math.random() * 3)];
          symbols.push(lucky, lucky, lucky);
          while (symbols.length < 9) symbols.push(pool[Math.floor(Math.random() * pool.length)]);
        } else if (winType > 0.3) {
          const lucky = pool[Math.floor(Math.random() * 3)];
          symbols.push(lucky, lucky);
          while (symbols.length < 9) symbols.push(pool[Math.floor(Math.random() * pool.length)]);
        } else {
          while (symbols.length < 9) symbols.push(pool[Math.floor(Math.random() * pool.length)]);
        }
        symbols.sort(() => Math.random() - 0.5);

        const revealed = Array(9).fill(false);
        const pickedSymbols = [];

        const buildGrid = (finished = false) => {
          const rows = [];
          for (let r = 0; r < 3; r++) {
            const row = new ActionRowBuilder();
            for (let c = 0; c < 3; c++) {
              const idx = r * 3 + c;
              row.addComponents(
                new ButtonBuilder()
                  .setCustomId(`gratta_${idx}`)
                  .setLabel(revealed[idx] ? symbols[idx] : "❓")
                  .setStyle(revealed[idx] ? ButtonStyle.Success : ButtonStyle.Secondary)
                  .setDisabled(finished || revealed[idx])
              );
            }
            rows.push(row);
          }
          return rows;
        };

        const embed = new EmbedBuilder()
          .setTitle("🎫 GRATTA E VINCI")
          .setDescription("Clicca su **3 caselle** della schedina per grattare e scoprire i simboli nascosti!\n\n> 💎 x3 = **Tris Diamanti**\n> 👑 x3 = **Tris Corone**\n> ⭐ x3 = **Tris Stelle**\n> 2 simboli uguali = **Coppia Vincente**")
          .setColor("#f1c40f");

        const reply = await interaction.reply({ embeds: [embed], components: buildGrid(), fetchReply: true });

        const collector = reply.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 60000
        });

        collector.on("collect", async (btn) => {
          if (btn.user.id !== user.id) return btn.reply({ content: "Questa schedina non è tua!", ephemeral: true });

          const idx = parseInt(btn.customId.replace("gratta_", ""), 10);
          revealed[idx] = true;
          pickedSymbols.push(symbols[idx]);

          if (pickedSymbols.length < 3) {
            await btn.update({
              embeds: [
                new EmbedBuilder()
                  .setTitle("🎫 GRATTA E VINCI")
                  .setDescription(`Hai grattato **${pickedSymbols.length}/3** caselle: ${pickedSymbols.join(" ")}\n\nScegli la prossima casella!`)
                  .setColor("#f1c40f")
              ],
              components: buildGrid()
            });
          } else {
            const [s1, s2, s3] = pickedSymbols;
            let resTitle = "❌ Nessuna combinazione!";
            let resColor = "#e74c3c";

            if (s1 === s2 && s2 === s3 && s1 !== "❌") {
              resTitle = `🏆 TRIS VINCENTE (${s1} ${s2} ${s3})! Grande Vittoria!`;
              resColor = "#2ecc71";
            } else if ((s1 === s2 && s1 !== "❌") || (s2 === s3 && s2 !== "❌") || (s1 === s3 && s1 !== "❌")) {
              const pairSym = (s1 === s2 || s1 === s3) ? s1 : s2;
              resTitle = `✨ COPPIA TROVATA (${pairSym} ${pairSym})! Bel colpo!`;
              resColor = "#3498db";
            }

            for (let i = 0; i < 9; i++) revealed[i] = true;

            await btn.update({
              embeds: [
                new EmbedBuilder()
                  .setTitle(resTitle)
                  .setDescription(`Hai scoperto: **${pickedSymbols.join(" ")}**\n\nEcco l'intera schedina svelata!`)
                  .setColor(resColor)
              ],
              components: buildGrid(true)
            });
            collector.stop();
          }
        });
      }

      // ================= 9. /ruotafortuna =================
      if (commandName === "ruotafortuna") {
        const segments = [
          { name: "🌟 SUPER JACKPOT x10", color: "#f1c40f" },
          { name: "💎 DIAMANTE x5", color: "#00b0f4" },
          { name: "💰 SACCO D'ORO x3", color: "#2ecc71" },
          { name: "🎁 PACCO REGALO x2", color: "#3498db" },
          { name: "🍀 QUADRIFOGLIO x1.5", color: "#27ae60" },
          { name: "💀 BANCAROTTA", color: "#e74c3c" }
        ];

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("ruota_spin").setLabel("🎡 GIRA LA RUOTA!").setStyle(ButtonStyle.Success)
        );

        const embed = new EmbedBuilder()
          .setTitle("🎡 Ruota della Fortuna")
          .setDescription("Premi il pulsante per far girare la grande ruota a premi!\n\n**Spicchi in palio:**\n" +
            segments.map(s => `> ${s.name}`).join("\n"))
          .setColor("#9b59b6");

        const reply = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        const collector = reply.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 30000
        });

        collector.on("collect", async (btn) => {
          if (btn.user.id !== user.id) return btn.reply({ content: "Gira la tua ruota con /ruotafortuna!", ephemeral: true });

          const chosen = segments[Math.floor(Math.random() * segments.length)];
          const win = !chosen.name.includes("BANCAROTTA");

          const resEmbed = new EmbedBuilder()
            .setTitle("🎡 La Ruota ha finito di girare!")
            .setDescription(`Lo spicchio vincente è:\n\n# ${chosen.name}\n\n` +
              (win ? "🎉 Complimenti per il premio conquistato!" : "Ouch! La ruota si è fermata sulla Bancarotta. Ritenta!"))
            .setColor(chosen.color)
            .setTimestamp();

          await btn.update({ embeds: [resEmbed], components: [] });
          collector.stop();
        });
      }

      // ================= 10. /indovina =================
      if (commandName === "indovina") {
        const secret = Math.floor(Math.random() * 5) + 1;
        const row = new ActionRowBuilder();

        for (let i = 1; i <= 5; i++) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`indovina_${i}`)
              .setLabel(String(i))
              .setStyle(ButtonStyle.Primary)
          );
        }

        const embed = new EmbedBuilder()
          .setTitle("🔢 Indovina il Numero Segreto")
          .setDescription("Ho pensato a un numero segreto da **1 a 5**.\nRiuscirai a indovinarlo al primo colpo? Clicca il tuo numero!")
          .setColor("#5865F2");

        const reply = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        const collector = reply.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 30000
        });

        collector.on("collect", async (btn) => {
          if (btn.user.id !== user.id) return btn.reply({ content: "Indovinello riservato a chi lo ha avviato!", ephemeral: true });

          const guess = parseInt(btn.customId.replace("indovina_", ""), 10);
          const win = guess === secret;

          const disabledRow = new ActionRowBuilder();
          for (let i = 1; i <= 5; i++) {
            disabledRow.addComponents(
              new ButtonBuilder()
                .setCustomId(`indovina_res_${i}`)
                .setLabel(String(i))
                .setStyle(i === secret ? ButtonStyle.Success : (i === guess ? ButtonStyle.Danger : ButtonStyle.Secondary))
                .setDisabled(true)
            );
          }

          const resEmbed = new EmbedBuilder()
            .setTitle(win ? "🎉 Intuizione Perfetta!" : "❌ Peccato, non era quello!")
            .setDescription(`Hai scelto: **${guess}**\nNumero segreto: **${secret}**\n\n` +
              (win ? "Hai un sesto senso incredibile!" : "Il numero segreto era un altro. Riprova con un altro tentativo!"))
            .setColor(win ? "#2ecc71" : "#e74c3c");

          await btn.update({ embeds: [resEmbed], components: [disabledRow] });
          collector.stop();
        });
      }

      // ================= 11. /dadi =================
      if (commandName === "dadi") {
        const diceIcons = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

        const rollDice = () => {
          const u1 = Math.floor(Math.random() * 6) + 1;
          const u2 = Math.floor(Math.random() * 6) + 1;
          const b1 = Math.floor(Math.random() * 6) + 1;
          const b2 = Math.floor(Math.random() * 6) + 1;

          const userTot = u1 + u2;
          const botTot = b1 + b2;

          let verdict = "🤝 Pareggio perfetto!";
          let col = "#f1c40f";

          if (userTot > botTot) {
            verdict = "🏆 Hai Vinto tu il Duello!";
            col = "#2ecc71";
          } else if (botTot > userTot) {
            verdict = "🤖 Ha vinto il Bot!";
            col = "#e74c3c";
          }

          return new EmbedBuilder()
            .setTitle("🎲 Duello a Dadi")
            .addFields(
              { name: `I tuoi dadi (${user.username})`, value: `${diceIcons[u1]} ${diceIcons[u2]} (Totale: **${userTot}**)`, inline: true },
              { name: "I dadi del Bot", value: `${diceIcons[b1]} ${diceIcons[b2]} (Totale: **${botTot}**)`, inline: true },
              { name: "Verdetto", value: `### ${verdict}`, inline: false }
            )
            .setColor(col)
            .setTimestamp();
        };

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("dadi_reroll").setLabel("🎲 Rilancia").setStyle(ButtonStyle.Success)
        );

        const reply = await interaction.reply({ embeds: [rollDice()], components: [row], fetchReply: true });

        const collector = reply.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 45000
        });

        collector.on("collect", async (btn) => {
          if (btn.user.id !== user.id) return btn.reply({ content: "Lancia i tuoi dadi con /dadi!", ephemeral: true });
          await btn.update({ embeds: [rollDice()], components: [row] });
        });

        collector.on("end", async () => {
          await interaction.editReply({ components: [] }).catch(() => null);
        });
      }

      // ================= 12. /tris =================
      if (commandName === "tris") {
        const board = Array(9).fill(null);

        const buildTrisRows = (isGameOver = false) => {
          const rows = [];
          for (let r = 0; r < 3; r++) {
            const row = new ActionRowBuilder();
            for (let c = 0; c < 3; c++) {
              const idx = r * 3 + c;
              const val = board[idx];
              row.addComponents(
                new ButtonBuilder()
                  .setCustomId(`tris_${idx}`)
                  .setLabel(val ? val : "➖")
                  .setStyle(val === "❌" ? ButtonStyle.Danger : (val === "⭕" ? ButtonStyle.Primary : ButtonStyle.Secondary))
                  .setDisabled(isGameOver || val !== null)
              );
            }
            rows.push(row);
          }
          return rows;
        };

        const embed = new EmbedBuilder()
          .setTitle("❌⭕ Tris (Tic-Tac-Toe) contro il Bot")
          .setDescription("Tocca a te! Sei le **❌** e il bot è le **⭕**.\nClicca sulla casella dove desideri piazzare la tua mossa.")
          .setColor("#5865F2");

        const reply = await interaction.reply({ embeds: [embed], components: buildTrisRows(), fetchReply: true });

        const collector = reply.createMessageComponentCollector({
          componentType: ComponentType.Button,
          time: 60000
        });

        collector.on("collect", async (btn) => {
          if (btn.user.id !== user.id) return btn.reply({ content: "Non è la tua partita di Tris!", ephemeral: true });

          const idx = parseInt(btn.customId.replace("tris_", ""), 10);
          if (board[idx] !== null) return btn.deferUpdate();

          board[idx] = "❌";

          let winner = checkTrisWinner(board);
          if (winner) {
            let desc = winner === "❌" ? "🏆 Complimenti, hai vinto contro il bot!" : "🤝 La partita si è conclusa in parità!";
            let col = winner === "❌" ? "#2ecc71" : "#f1c40f";
            await btn.update({
              embeds: [new EmbedBuilder().setTitle("❌⭕ Partita Conclusa!").setDescription(desc).setColor(col)],
              components: buildTrisRows(true)
            });
            collector.stop();
            return;
          }

          const emptyIndices = board.map((v, i) => v === null ? i : null).filter(v => v !== null);
          if (emptyIndices.length > 0) {
            let botMove = null;

            for (const i of emptyIndices) {
              board[i] = "⭕";
              if (checkTrisWinner(board) === "⭕") { botMove = i; break; }
              board[i] = null;
            }

            if (botMove === null) {
              for (const i of emptyIndices) {
                board[i] = "❌";
                if (checkTrisWinner(board) === "❌") { botMove = i; board[i] = null; break; }
                board[i] = null;
              }
            }

            if (botMove === null) {
              botMove = emptyIndices.includes(4) ? 4 : emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
            }

            board[botMove] = "⭕";
          }

          winner = checkTrisWinner(board);
          if (winner) {
            let desc = winner === "⭕" ? "🤖 Il Bot ha vinto la partita!" : "🤝 La partita si è conclusa in parità!";
            let col = winner === "⭕" ? "#e74c3c" : "#f1c40f";
            await btn.update({
              embeds: [new EmbedBuilder().setTitle("❌⭕ Partita Conclusa!").setDescription(desc).setColor(col)],
              components: buildTrisRows(true)
            });
            collector.stop();
          } else {
            await btn.update({
              embeds: [new EmbedBuilder().setTitle("❌⭕ Tris (Tic-Tac-Toe)").setDescription("Mossa effettuata dal Bot! Tocca di nuovo a te.").setColor("#5865F2")],
              components: buildTrisRows(false)
            });
          }
        });
      }

      // ================= 13. /coinflip =================
      if (commandName === "coinflip") {
        const isHeads = Math.random() > 0.5;
        const result = isHeads ? "Testa 🪙" : "Croce 🦅";

        const embed = new EmbedBuilder()
          .setTitle("🪙 Lancio della Moneta")
          .setDescription(`La moneta volteggia in aria...\n\nÈ uscito: **${result}**!`)
          .setColor(isHeads ? "#f0b232" : "#7983f5")
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      // ================= 14. /meme =================
      if (commandName === "meme") {
        const template = interaction.options.getString("template", true);
        const topText = interaction.options.getString("testo_superiore") || "";
        const bottomText = interaction.options.getString("testo_inferiore") || "";

        const templates = {
          drake: {
            title: "Drake Hotline Bling",
            url: "https://i.imgflip.com/30b1gx.jpg",
            desc: `❌ NO: ${topText}\n✅ SÌ: ${bottomText}`
          },
          distracted: {
            title: "Distracted Boyfriend",
            url: "https://i.imgflip.com/1ur9b0.jpg",
            desc: `Nuovo Server: **${topText}**\nVecchio Server: **${bottomText}**`
          },
          buffdoge: {
            title: "Buff Doge vs Cheems",
            url: "https://i.imgflip.com/43a45p.jpg",
            desc: `💪 RoomUp V2: **${topText}**\n🐕 Altri Bot: **${bottomText}**`
          },
          galaxy: {
            title: "Galaxy Brain",
            url: "https://i.imgflip.com/1h7in3.jpg",
            desc: `Livello 1: ${topText}\nAscensione cosmica: ${bottomText}`
          }
        };

        const selected = templates[template] || templates.drake;

        const embed = new EmbedBuilder()
          .setTitle(`🎭 Meme: ${selected.title}`)
          .setDescription(selected.desc)
          .setImage(selected.url)
          .setColor("#5865F2")
          .setFooter({ text: `Creato da ${user.username}` })
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

    } catch (err) {
      console.error("[EntertainmentEngine] Errore esecuzione comando:", err.message);
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "❌ Si è verificato un errore durante l'esecuzione del comando.", ephemeral: true }).catch(() => null);
      }
    }
  });

  console.log("[EntertainmentEngine] Suite Giochi & Intrattenimento Attiva con tutti i minigiochi V1!");
}

module.exports = { initEntertainmentEngine };
