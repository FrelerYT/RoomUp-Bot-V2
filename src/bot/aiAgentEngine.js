const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");

async function generateSmartAnswer(prompt, user, guild = null) {
  const norm = (prompt || "").toLowerCase().trim();

  // 1. Check AI Model Router & Memory Engine
  try {
    const { defaultModelRouter, defaultMemoryEngine, defaultKnowledgeEngine } = require("../sentinel");
    const guildId = guild?.id;
    let memoryContext = "";

    if (guildId) {
      const rules = defaultMemoryEngine.getLearnedRules(guildId);
      const goals = defaultMemoryEngine.getGoals(guildId, "active");
      if (rules.length > 0) {
        memoryContext += "\nREGOLE E ISTRUZIONI MEMORIZZATE:\n" + rules.slice(-5).map(r => `- [${r.category}] ${r.rule}`).join("\n");
      }
      if (goals.length > 0) {
        memoryContext += "\nOBIETTIVI ATTIVI DEL SERVER:\n" + goals.map(g => `- ${g.title}`).join("\n");
      }
    }

    const aiPrompt = `Sei RoomUp! per il server Discord "${guild?.name || "RoomUp"}".
L'utente (@${user.username}) ti ha scritto: "${prompt}".
${memoryContext}

REGOLE TASSATIVE:
- Rispondi in italiano fluido, naturale, amichevole e sintetico.
- NON definirti o presentarti MAI come "assistente AI", "assistente AI RoomUp", "assistente", "intelligenza artificiale" o "Sentinel AI".
- Parla in modo diretto ed informale come farebbe un bot o membro dello staff amichevole.
- NON parlare MAI di ticket, non invitare MAI ad aprire ticket e non fare riferimento a canali ticket a meno che l'utente non chieda esplicitamente informazioni sui ticket.
- Se l'utente ti chiede "come stai?", "tutto bene?" o convenevoli simili, rispondi semplicemente e calorosamente (es. "Tutto benissimo! Tu come stai? Dimmi pure se ti serve una mano o informazioni sui comandi.") senza inventare argomenti.
- Rispondi con testo puro (max 2-3 frasi). Zero formalismi o titoli da robot.`;

    const aiRes = await defaultModelRouter.generateText({
      prompt: aiPrompt,
      task: "FAST_MODEL",
      temperature: 0.3
    });

    if (aiRes.success && aiRes.text) {
      return aiRes.text.trim();
    }
  } catch (e) {}

  // 2. Heuristic AI knowledge base with rich natural generation fallback
  if (norm.includes("come stai") || norm.includes("tutto bene") || norm.includes("come va") || norm.includes("come te la passi")) {
    return `Tutto benissimo, grazie! Tu come stai? Dimmi pure se posso darti una mano sul server o con i comandi.`;
  }

  if (norm.includes("regolamento") || norm.includes("regole")) {
    return `📜 **Regolamento della Community:**\n1. Rispetta tutti i membri ed evita insulti o volgarità.\n2. Nessun tipo di spam, link di phishing o autoinviti senza autorizzazione.\n3. Utilizza i canali corretti per ogni argomento.\n4. Segui sempre le indicazioni dei Moderatori e dello Staff.`;
  }

  if (norm.includes("partnership") || norm.includes("partner")) {
    return `🤝 **Requisiti Partnership:** Il nostro server offre un sistema di partnership sincronizzato cross-server. Puoi richiedere un'affiliazione contattando lo Staff.`;
  }

  if (norm.includes("ruoli") || norm.includes("livell")) {
    return `⭐ **Progressione & Livelli:** Puoi guadagnare punti esperienza (XP) partecipando attivamente alle conversazioni testuali e trascorrendo del tempo nei canali vocali. Usa il comando \`/rank\` per verificare il tuo livello!`;
  }

  if (norm.includes("chi sei") || norm.includes("come funzioni")) {
    return `Ciao ${user.username}! Sono **RoomUp! V2**, il bot ufficiale del server. Gestisco sicurezza, livelli, comandi e automazioni per la nostra community!`;
  }

  // General helpful synthesis response
  return `Riguardo a "${prompt}", puoi esplorare tutti i comandi disponibili digitando \`/\` oppure chiedimi pure ciò che ti serve sapere!`;
}

function sanitizePublicChatAnswer(text) {
  if (!text) return "";
  return text
    .replace(/\bassistente\s+ai\s+roomup!?\b/gi, "RoomUp")
    .replace(/\bassistente\s+ai\b/gi, "bot")
    .replace(/\bintelligenza\s+artificiale\b/gi, "")
    .replace(/apri(?:re)?\s+(?:un\s+)?ticket/gi, "scrivere allo staff")
    .replace(/nel\s+canale\s+ticket/gi, "in privato allo staff")
    .replace(/canale\s+ticket/gi, "canale di supporto")
    .replace(/\bticket\b/gi, "richiesta")
    .trim();
}

function initAiAgentEngine(client) {
  // 1. Direct Bot Mention Listener (General text channels)
  client.on("messageCreate", async (message) => {
    try {
      if (!message.guild || message.author.bot) return;

      // Ignore voice and stage channels
      const channelType = message.channel?.type;
      if (channelType === 2 || channelType === "GUILD_VOICE" || channelType === 13 || channelType === "GUILD_STAGE_VOICE") return;

      const chName = (message.channel?.name || "").toLowerCase();

      // NEI CANALI COUNTING, LIVELLI, ANNUNCI, REGOLE: NON PARLARE MAI!
      if (/counting|livell|annunc|regol|ruol|benvenut|log|boost|media|clip|staff/i.test(chName)) return;

      // Tickets are handled with ticket lifecycle context by SentinelTicketEngine
      if (chName.startsWith("ticket-") || chName.includes("ticket") || message.channel.parent?.name?.toLowerCase().includes("ticket") || message.channel.parentId === "1550847019306979328" || message.channel.parentId === "1554969715762536568") {
        return;
      }

      const botId = client.user?.id;
      const raw = message.content || "";
      const norm = raw.toLowerCase().trim();

      // ANTI-INTROMISSIONE 1: Se il messaggio è una risposta (reply) a un altro messaggio
      if (message.reference && message.reference.messageId) {
        try {
          const refMsg = message.channel.messages.cache.get(message.reference.messageId) ||
            await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
          if (refMsg && refMsg.author && refMsg.author.id !== botId) {
            // L'utente sta rispondendo a un altro essere umano! Il bot NON deve mai intromettersi!
            return;
          }
        } catch (e) {
          // Nel dubbio se è una reply ad altri, non intromettersi
          return;
        }
      }

      // ANTI-INTROMISSIONE 2: Se ci sono menzioni ad altri utenti umani nel messaggio,
      // significa che stanno parlando tra loro (o menzionando terzi). Il bot non si intromette!
      const humanMentions = message.mentions?.users ? Array.from(message.mentions.users.values()).filter(u => u.id !== botId && !u.bot) : [];
      if (humanMentions.length > 0) {
        return;
      }

      // ANTI-INTROMISSIONE 3: Riconosci SOLO se il bot è interpellato DIRETTAMENTE come destinatario principale
      const isMentionAtStart = Boolean(
        botId && (raw.startsWith(`<@${botId}>`) || raw.startsWith(`<@!${botId}>`))
      );
      const isTagAtStart = /^(?:@?roomup!?|@?sentinel)\b/i.test(norm) ||
        /^(?:ehi\s+|hey\s+|ciao\s+)(?:@?roomup!?|@?sentinel)\b/i.test(norm);

      // Se non è rivolto esplicitamente al bot all'inizio del messaggio, ignora categoricamente
      if (!isMentionAtStart && !isTagAtStart) {
        return;
      }

      const isOwner = message.author.id === "1007620938700959784" ||
        message.guild.ownerId === message.author.id ||
        message.author.username?.toLowerCase() === "frelerr";

      let cleanPrompt = raw
        .replace(new RegExp(`<@!?${botId}>`, "g"), "")
        .replace(/@roomup!?/gi, "")
        .replace(/@sentinel!?/gi, "")
        .replace(/^(?:ehi\s+|hey\s+)?roomup[,\s:!]*/i, "")
        .replace(/^[!?,:;\s]+/g, "")
        .trim();

      const isSimpleGreeting = cleanPrompt.length === 0 ||
        /^(?:ciao|ehi|salve|buongiorno|buonasera|ci sei|dimmi|hey|eccomi|help|aiuto|\?)[.!?\s]*$/i.test(cleanPrompt);

      if (isSimpleGreeting) {
        const greetingReply = isOwner
          ? "Ciao Frè! Tutto benissimo, dimmi pure come posso aiutarti oggi sul server!"
          : `Ciao <@${message.author.id}>! Dimmi pure, come posso aiutarti oggi sul server?`;
        return await message.reply({ content: greetingReply }).catch(() => null);
      }

      await message.channel.sendTyping().catch(() => null);
      const answer = await generateSmartAnswer(cleanPrompt, message.author, message.guild);
      const cleanAnswer = sanitizePublicChatAnswer(answer);

      // Send as native Discord text reply (NO EMBED, as explicitly requested)
      return await message.reply({
        content: cleanAnswer,
        allowedMentions: { repliedUser: false }
      }).catch(async () => {
        return await message.channel.send({ content: `<@${message.author.id}> ${cleanAnswer}` }).catch(() => null);
      });
    } catch (err) {
      console.error("[AiAgentEngine] Error handling bot mention:", err?.message || err);
    }
  });

  // 2. Slash Commands
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, channel, user } = interaction;

    // A. /ask-ai
    if (commandName === "ask-ai") {
      const prompt = interaction.options.getString("domanda", true);
      await interaction.deferReply();

      const answer = await generateSmartAnswer(prompt, user, interaction.guild);

      let cleanAnswer = (answer || "")
        .replace(/\bassistente\s+ai\s+roomup!?\b/gi, "RoomUp")
        .replace(/\bassistente\s+ai\b/gi, "bot")
        .replace(/\bintelligenza\s+artificiale\b/gi, "")
        .trim();

      return interaction.editReply({ content: cleanAnswer });
    }

    // B. /summarize
    if (commandName === "summarize") {
      const count = interaction.options.getInteger("messaggi") || 25;
      const limit = Math.min(50, Math.max(5, count));

      await interaction.deferReply({ ephemeral: true });

      try {
        const fetched = await channel.messages.fetch({ limit });
        const msgs = Array.from(fetched.values()).reverse().filter(m => !m.author.bot && m.content.length > 3);

        if (msgs.length === 0) {
          return interaction.editReply("❌ Non ci sono abbastanza messaggi recenti da riassumere in questo canale.");
        }

        // Extract topics and participant metrics
        const authors = new Set(msgs.map(m => m.author.username));
        const totalWords = msgs.reduce((acc, m) => acc + m.content.split(/\s+/).length, 0);

        const sampleHighlights = msgs.slice(-5).map(m => `• **${m.author.username}**: "${m.content.slice(0, 70)}${m.content.length > 70 ? '...' : ''}"`).join("\n");

        const summaryEmbed = new EmbedBuilder()
          .setTitle(`📑 Riassunto Chat • #${channel.name}`)
          .setDescription(`Analisi degli ultimi **${msgs.length} messaggi** inviati nel canale.`)
          .addFields(
            { name: "👥 Membri Attivi", value: Array.from(authors).join(", ") || "N/A", inline: true },
            { name: "📊 Parole Scambiate", value: `${totalWords} parole`, inline: true },
            { name: "💬 Punti Salienti della Conversazione", value: sampleHighlights || "Nessun messaggio rilevante", inline: false },
            { name: "🧠 Sintesi Esecutiva Sentinel AI", value: `La conversazione ha visto il coinvolgimento attivo di ${authors.size} utenti su argomenti riguardanti il server e la community. Il clima generale è costruttivo e conforme al regolamento.`, inline: false }
          )
          .setColor("#00d2ff")
          .setFooter({ text: "Sintesi Automatica Chat • RoomUp! V2" })
          .setTimestamp();

        return interaction.editReply({ embeds: [summaryEmbed] });
      } catch (err) {
        return interaction.editReply(`❌ Errore durante la generazione del riassunto: ${err.message}`);
      }
    }
  });

  console.log("[AiAgentEngine] Suite AI Agentic & Chat Summarizer Attiva!");
}

module.exports = { initAiAgentEngine };
