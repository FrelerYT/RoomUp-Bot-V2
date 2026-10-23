const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  AuditLogEvent,
  Events
} = require("discord.js");
const fs = require("fs");
const path = require("path");

const AI_MEMORY_FILE = path.join(__dirname, "../../data/aiModMemory.json");

// Recent messages buffer for contextual correlation (guildId -> channelId -> Array)
const messageBuffer = new Map();
const activeConsultations = new Map(); // caseId -> caseData

function ensureDataDir() {
  const dir = path.dirname(AI_MEMORY_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadAiMemory() {
  ensureDataDir();
  try {
    if (!fs.existsSync(AI_MEMORY_FILE)) {
      const initial = {};
      fs.writeFileSync(AI_MEMORY_FILE, JSON.stringify(initial, null, 2), "utf8");
      return initial;
    }
    return JSON.parse(fs.readFileSync(AI_MEMORY_FILE, "utf8"));
  } catch (e) {
    console.error("[AiModerator] Errore lettura aiModMemory.json:", e.message);
    return {};
  }
}

function saveAiMemory(data) {
  ensureDataDir();
  try {
    fs.writeFileSync(AI_MEMORY_FILE, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (e) {
    console.error("[AiModerator] Errore salvataggio aiModMemory.json:", e.message);
    return false;
  }
}

function getGuildMemory(guildId) {
  const memory = loadAiMemory();
  if (!memory[guildId]) {
    memory[guildId] = {
      precedents: [],
      learnedRules: [
        { id: "rule_1", rule: "Nessun insulto diretto o denigrazione verso altri membri", category: "toxic", weight: 90 },
        { id: "rule_2", rule: "Nessuna bestemmia o volgarità pesante in canali pubblici", category: "profanity", weight: 85 },
        { id: "rule_3", rule: "Evita provocazioni continue, flame e incitamento al conflitto", category: "flame", weight: 80 },
        { id: "rule_4", rule: "Vietato condividere link server Discord esterni senza partnership", category: "invite", weight: 95 }
      ],
      consultationHistory: [],
      stats: { autonomousActions: 0, humanEscalations: 0, learnedDecisions: 0 }
    };
    saveAiMemory(memory);
  }
  return memory[guildId];
}

// Normalize text: resolves leetspeak, repeated chars, spaces
function normalizeText(text) {
  if (!text) return "";
  let norm = text.toLowerCase();
  norm = norm.replace(/[0]/g, "o")
             .replace(/[1!|]/g, "i")
             .replace(/[3]/g, "e")
             .replace(/[4@]/g, "a")
             .replace(/[5$]/g, "s")
             .replace(/[7]/g, "t")
             .replace(/[8]/g, "b");
  // Collapses 3+ identical consecutive letters (e.g. czzzzz -> cz)
  norm = norm.replace(/(.)\1{2,}/g, "$1$1");
  return norm;
}

// Stores message in short-term buffer (last 50 per channel)
function pushMessageToBuffer(message) {
  if (!message.guild || message.author.bot) return;
  const gId = message.guild.id;
  const cId = message.channelId;

  if (!messageBuffer.has(gId)) messageBuffer.set(gId, new Map());
  const gMap = messageBuffer.get(gId);
  if (!gMap.has(cId)) gMap.set(cId, []);

  const list = gMap.get(cId);
  list.push({
    id: message.id,
    authorId: message.author.id,
    authorTag: message.author.tag,
    authorName: message.author.username,
    content: message.content,
    timestamp: message.createdTimestamp
  });

  if (list.length > 50) list.shift();
}

function findRecentUserMessages(guildId, userId, limit = 3) {
  const gMap = messageBuffer.get(guildId);
  if (!gMap) return [];
  const found = [];
  for (const [_, msgs] of gMap) {
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].authorId === userId) {
        found.push(msgs[i]);
        if (found.length >= limit) return found;
      }
    }
  }
  return found;
}

// Evaluates a message against heuristics and learned precedents
function evaluateMessage(message, guildConfig, guildMemory) {
  const content = message.content;
  const norm = normalizeText(content);
  let suspicion = 0;
  let detectedIssues = [];
  let suggestedAction = "warn";
  let ambiguityReason = "";

  // 1. Check against learned precedents from human mods
  const precedents = guildMemory.precedents || [];
  for (const prec of precedents) {
    if (prec.pattern && norm.includes(prec.pattern)) {
      suspicion += (prec.severity === "high" ? 45 : 30);
      detectedIssues.push(`Pattern appreso dallo Staff ("${prec.pattern}")`);
      if (prec.severity === "high") suggestedAction = "timeout";
    }
  }

  // 2. Severe threats and toxic keywords heuristics
  const severeThreats = ["muori", "sparati", "ammazzati", "impiccati"];
  for (const st of severeThreats) {
    if (norm.includes(st)) {
      suspicion += 60;
      detectedIssues.push(`Minaccia grave di morte o autolesionismo ("${st}")`);
      suggestedAction = "timeout";
      break;
    }
  }

  const toxicKeywords = [
    "coglione", "deficiente", "troia", "puttana", "ritardato", "handicappato", "frocio", "negro",
    "down", "ebete", "bastardo", "stronzo", "scemo"
  ];
  let toxicCount = 0;
  for (const kw of toxicKeywords) {
    if (norm.includes(kw)) {
      toxicCount++;
      suspicion += (toxicCount === 1 ? 50 : 35);
      detectedIssues.push(`Linguaggio tossico / insulto ("${kw}")`);
      if (toxicCount >= 2) suggestedAction = "timeout";
    }
  }

  // 3. Flame provocations
  const flameCues = ["fai schifo", "sei inutile", "stai zitto", "non vali niente", "fatti una vita", "fatti curare"];
  for (const cue of flameCues) {
    if (norm.includes(cue)) {
      suspicion += 35;
      detectedIssues.push(`Provocazione diretta ("${cue}")`);
      ambiguityReason = "Potrebbe essere una battuta informale tra amici o flame ostile.";
      break;
    }
  }

  // 4. Repeated caps (SHOUTING flame)
  if (content.length > 20 && content.replace(/[^A-Z]/g, "").length / content.length > 0.75) {
    suspicion += 25;
    detectedIssues.push("Testo interamente in maiuscolo (urla)");
  }

  // Cap at 100
  suspicion = Math.min(100, suspicion);

  return {
    suspicion,
    detectedIssues,
    suggestedAction: suspicion >= 85 ? (suggestedAction === "timeout" ? "timeout" : "delete") : "warn",
    ambiguityReason: ambiguityReason || "Fraseggio ambiguo che richiede giudizio del moderatore umano."
  };
}

function initAiModeratorEngine(client, loadSettingsFn, saveSettingsFn) {
  
  // 1. Buffer all incoming messages
  client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author.bot) return;
    pushMessageToBuffer(message);

    // Skip admins and moderators from being moderated
    if (message.member?.permissions.has(PermissionFlagsBits.ManageMessages) || message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
      return;
    }

    const settings = typeof loadSettingsFn === 'function' ? loadSettingsFn() : {};
    const guildConfig = settings[message.guild.id]?.aiModerator;
    if (!guildConfig || !guildConfig.enabled) return;

    const allMemory = loadAiMemory();
    const guildMemory = getGuildMemory(message.guild.id);

    const evaluation = evaluateMessage(message, guildConfig, guildMemory);

    // If suspicion is high (>= 85%): AUTONOMOUS ACTION
    if (evaluation.suspicion >= 85) {
      if (guildConfig.mode !== "consult_only") {
        try {
          // Delete message
          await message.delete().catch(() => null);

          // Proportional punishment
          if (evaluation.suggestedAction === "timeout" && message.member?.moderatable) {
            await message.member.timeout(10 * 60 * 1000, "Sentinel AI: Linguaggio altamente tossico o grave infrazione").catch(() => null);
          }

          // Polite authoritative AI notification in chat
          const reply = await message.channel.send({
            content: `🤖 **Sentinel AI Mod:** <@${message.author.id}>, il tuo messaggio è stato rimosso per rispetto delle linee guida della community apprese dal nostro Staff (*${evaluation.detectedIssues.join(", ")}*). Manteniamo un clima sereno!`
          }).catch(() => null);

          if (reply) setTimeout(() => reply.delete().catch(() => null), 7000);

          guildMemory.stats.autonomousActions = (guildMemory.stats.autonomousActions || 0) + 1;
          saveAiMemory(allMemory);
        } catch (e) {
          console.error("[AiModerator] Errore azione autonoma:", e.message);
        }
        return;
      }
    }

    // If suspicion is between 50% and 84%: ESCALATE TO HUMAN MODERATORS ("se non sa le cose scrive ai moderatori")
    if (evaluation.suspicion >= 50 && evaluation.suspicion < 85) {
      const consultChannelId = guildConfig.consultationChannelId || settings[message.guild.id]?.logs?.categories?.moderation?.channelId || settings[message.guild.id]?.logs?.globalChannelId;
      if (!consultChannelId) return;

      const consultChannel = message.guild.channels.cache.get(consultChannelId);
      if (!consultChannel || !consultChannel.isTextBased()) return;

      const caseId = `case_${Date.now()}_${message.author.id}`;
      activeConsultations.set(caseId, {
        guildId: message.guild.id,
        channelId: message.channel.id,
        messageId: message.id,
        authorId: message.author.id,
        authorTag: message.author.tag,
        content: message.content,
        normContent: normalizeText(message.content),
        issues: evaluation.detectedIssues,
        suspicion: evaluation.suspicion,
        timestamp: Date.now()
      });

      const embed = new EmbedBuilder()
        .setTitle("🤖 Sentinel AI Mod — Richiesta di Consultazione")
        .setColor("#f0b232")
        .setDescription(
          `> **Autore:** <@${message.author.id}> (\`${message.author.tag}\`)\n` +
          `> **Canale:** <#${message.channel.id}> • [Vai al Messaggio](${message.url})\n` +
          `> **Indice di Sospetto:** **${evaluation.suspicion}%**\n` +
          `> **Rilevamenti:** ${evaluation.detectedIssues.join(", ")}\n` +
          `> **Dubbio AI:** *"${evaluation.ambiguityReason}"*`
        )
        .addFields({
          name: "💬 Contenuto Messaggio Sospetto",
          value: `\`\`\`${(message.content || "").slice(0, 950)}\`\`\``
        })
        .setFooter({ text: `Caso #${caseId} • In attesa di decisione dello Staff` })
        .setTimestamp();

      const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`aimod_allow:::${caseId}`)
          .setLabel("È Lecito (Ignora)")
          .setStyle(ButtonStyle.Success)
          .setEmoji("✅"),
        new ButtonBuilder()
          .setCustomId(`aimod_warn:::${caseId}`)
          .setLabel("Avviso AI")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("⚠️"),
        new ButtonBuilder()
          .setCustomId(`aimod_delete:::${caseId}`)
          .setLabel("Elimina Messaggio")
          .setStyle(ButtonStyle.Danger)
          .setEmoji("🗑️"),
        new ButtonBuilder()
          .setCustomId(`aimod_timeout:::${caseId}`)
          .setLabel("Timeout 15m")
          .setStyle(ButtonStyle.Danger)
          .setEmoji("⏳")
      );

      guildMemory.stats.humanEscalations = (guildMemory.stats.humanEscalations || 0) + 1;
      saveAiMemory(allMemory);

      consultChannel.send({ embeds: [embed], components: [btnRow] }).catch(() => null);
    }
  });

  // 2. Interaction handling for Human Escalation Buttons
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    const customId = interaction.customId;
    if (!customId.startsWith("aimod_")) return;

    const [actionWithPrefix, caseId] = customId.split(":::");
    const action = actionWithPrefix.replace("aimod_", "");

    const caseData = activeConsultations.get(caseId);
    if (!caseData) {
      return interaction.reply({ content: "⚠️ Questo caso è già stato risolto o la sessione è scaduta.", ephemeral: true });
    }

    // Verify moderator permissions
    const member = interaction.member;
    const isStaff = member.permissions.has(PermissionFlagsBits.ManageMessages) || member.permissions.has(PermissionFlagsBits.ManageGuild);
    if (!isStaff) {
      return interaction.reply({ content: "❌ Solo i membri dello Staff autorizzati possono risolvere le consultazioni AI.", ephemeral: true });
    }

    await interaction.deferUpdate();

    const allMemory = loadAiMemory();
    const guildMemory = getGuildMemory(interaction.guild.id);

    const targetGuild = interaction.guild;
    const targetChannel = targetGuild.channels.cache.get(caseData.channelId);
    const targetMember = targetGuild.members.cache.get(caseData.authorId) || await targetGuild.members.fetch(caseData.authorId).catch(() => null);

    let resolutionText = "";
    let resolutionColor = "#23a55a";

    // 1. ALLOW / IS SAFE
    if (action === "allow") {
      resolutionText = `✅ **Risolto da <@${interaction.user.id}>:** Messaggio ritenuto **Lecito** / Falso Positivo. L'AI ha appreso che frasi simili sono consentite nella community.`;
      resolutionColor = "#23a55a";
      // Record negative learning (allow pattern)
      guildMemory.consultationHistory.push({
        caseId,
        decision: "allowed",
        moderatorId: interaction.user.id,
        content: caseData.content,
        timestamp: new Date().toISOString()
      });
    }

    // 2. WARN
    if (action === "warn") {
      resolutionText = `⚠️ **Risolto da <@${interaction.user.id}>:** Inviato avviso ufficiale all'utente. L'AI ha memorizzato il comportamento come scorretto.`;
      resolutionColor = "#f0b232";
      if (targetChannel && targetChannel.isTextBased()) {
        targetChannel.send({
          content: `⚠️ <@${caseData.authorId}>, lo Staff ti richiama all'ordine: per favore modera i tuoi toni e rispetta le regole della community.`
        }).catch(() => null);
      }
      // Learn precedent
      guildMemory.precedents.push({
        id: `prec_${Date.now()}`,
        pattern: caseData.normContent.slice(0, 100),
        actionTaken: "warn",
        severity: "medium",
        source: "human_mod_feedback",
        moderatorId: interaction.user.id,
        timestamp: new Date().toISOString()
      });
      guildMemory.stats.learnedDecisions = (guildMemory.stats.learnedDecisions || 0) + 1;
    }

    // 3. DELETE
    if (action === "delete") {
      resolutionText = `🗑️ **Risolto da <@${interaction.user.id}>:** Messaggio **Eliminato**. L'AI ha memorizzato il pattern come vietato.`;
      resolutionColor = "#f23f43";
      if (targetChannel && targetChannel.isTextBased()) {
        const msg = await targetChannel.messages.fetch(caseData.messageId).catch(() => null);
        if (msg) await msg.delete().catch(() => null);
      }
      guildMemory.precedents.push({
        id: `prec_${Date.now()}`,
        pattern: caseData.normContent.slice(0, 100),
        actionTaken: "delete",
        severity: "medium",
        source: "human_mod_feedback",
        moderatorId: interaction.user.id,
        timestamp: new Date().toISOString()
      });
      guildMemory.stats.learnedDecisions = (guildMemory.stats.learnedDecisions || 0) + 1;
    }

    // 4. TIMEOUT
    if (action === "timeout") {
      resolutionText = `⏳ **Risolto da <@${interaction.user.id}>:** Messaggio eliminato e utente in **Timeout per 15 minuti**. L'AI ha memorizzato il caso con massima severità.`;
      resolutionColor = "#f23f43";
      if (targetChannel && targetChannel.isTextBased()) {
        const msg = await targetChannel.messages.fetch(caseData.messageId).catch(() => null);
        if (msg) await msg.delete().catch(() => null);
      }
      if (targetMember && targetMember.moderatable) {
        await targetMember.timeout(15 * 60 * 1000, `Sentinel AI su decisione di ${interaction.user.tag}`).catch(() => null);
      }
      guildMemory.precedents.push({
        id: `prec_${Date.now()}`,
        pattern: caseData.normContent.slice(0, 100),
        actionTaken: "timeout",
        severity: "high",
        source: "human_mod_feedback",
        moderatorId: interaction.user.id,
        timestamp: new Date().toISOString()
      });
      guildMemory.stats.learnedDecisions = (guildMemory.stats.learnedDecisions || 0) + 1;
    }

    activeConsultations.delete(caseId);
    saveAiMemory(allMemory);

    // Edit original consultation message
    const origEmbed = interaction.message.embeds[0] ? EmbedBuilder.from(interaction.message.embeds[0]) : new EmbedBuilder();
    origEmbed.setColor(resolutionColor);
    origEmbed.addFields({ name: "⚖️ Verdetto Moderatore & Apprendimento AI", value: resolutionText });

    await interaction.editReply({
      embeds: [origEmbed],
      components: [] // disable buttons
    }).catch(() => null);
  });

  // 3. Continuous Learning Listener: observes timeouts applied by Human Staff in real-time!
  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    try {
      if (!newMember.isCommunicationDisabled()) return;
      if (oldMember.communicationDisabledUntilTimestamp === newMember.communicationDisabledUntilTimestamp) return;

      // Find if executor was a human moderator
      const logs = await newMember.guild.fetchAuditLogs({ type: AuditLogEvent.MemberUpdate, limit: 1 }).catch(() => null);
      const entry = logs?.entries?.first();
      if (!entry || entry.executor.bot) return; // ignore bot self-actions

      // Correlate with recent messages from the timed-out user in the buffer
      const recentMsgs = findRecentUserMessages(newMember.guild.id, newMember.id, 2);
      if (recentMsgs.length === 0) return;

      const offendingText = recentMsgs.map(m => m.content).join(" | ");
      const norm = normalizeText(offendingText);

      const allMemory = loadAiMemory();
      const guildMemory = getGuildMemory(newMember.guild.id);

      guildMemory.precedents.push({
        id: `prec_learn_${Date.now()}`,
        pattern: norm.slice(0, 100),
        rawContent: offendingText.slice(0, 150),
        actionTaken: "timeout",
        severity: "high",
        source: "human_audit_observation",
        moderatorId: entry.executor.id,
        moderatorTag: entry.executor.tag,
        timestamp: new Date().toISOString()
      });

      guildMemory.stats.learnedDecisions = (guildMemory.stats.learnedDecisions || 0) + 1;
      saveAiMemory(allMemory);

      console.log(`[AiModerator] 🧠 L'AI ha appreso un nuovo precedente di sanzione dallo staffer ${entry.executor.tag} su ${newMember.user.tag}: "${offendingText.slice(0, 50)}..."`);
    } catch (e) {
      console.error("[AiModerator] Errore apprendimento continuo timeout:", e.message);
    }
  });

  // 4. Continuous Learning Listener: observes messages deleted by human moderators!
  client.on(Events.MessageDelete, async (message) => {
    try {
      if (!message.guild || message.author?.bot) return;
      if (!message.content || message.content.length < 5) return;

      // Check if deleted by a human moderator
      const logs = await message.guild.fetchAuditLogs({ type: AuditLogEvent.MessageDelete, limit: 1 }).catch(() => null);
      const entry = logs?.entries?.first();
      if (!entry || entry.executor?.bot) return;
      if (Date.now() - entry.createdTimestamp > 3000) return;

      const norm = normalizeText(message.content);
      const allMemory = loadAiMemory();
      const guildMemory = getGuildMemory(message.guild.id);

      guildMemory.precedents.push({
        id: `prec_del_${Date.now()}`,
        pattern: norm.slice(0, 100),
        rawContent: message.content.slice(0, 150),
        actionTaken: "delete",
        severity: "medium",
        source: "human_audit_observation",
        moderatorId: entry.executor.id,
        moderatorTag: entry.executor.tag,
        timestamp: new Date().toISOString()
      });

      guildMemory.stats.learnedDecisions = (guildMemory.stats.learnedDecisions || 0) + 1;
      saveAiMemory(allMemory);

      console.log(`[AiModerator] 🧠 L'AI ha appreso un messaggio vietato cancellato da ${entry.executor.tag}: "${message.content.slice(0, 50)}..."`);
    } catch (e) {}
  });

  console.log("[AiModeratorEngine] Motore AI Moderatore Auto-Apprendente (Sentinel AI) Attivo!");
}

function simulateAiEvaluation(text, guildConfig = {}, guildMemory = {}) {
  const fakeMsg = { content: text };
  const evaluation = evaluateMessage(fakeMsg, guildConfig, guildMemory);
  let decision = "allowed";
  if (evaluation.suspicion >= 85) {
    decision = evaluation.suggestedAction === "timeout" ? "autonomous_timeout" : "autonomous_delete";
  } else if (evaluation.suspicion >= 50) {
    decision = "escalate_to_staff";
  }
  return {
    ...evaluation,
    decision
  };
}

module.exports = {
  initAiModeratorEngine,
  loadAiMemory,
  saveAiMemory,
  getGuildMemory,
  simulateAiEvaluation
};
