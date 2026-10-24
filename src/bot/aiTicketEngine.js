/**
 * SENTINEL AI — TICKET ASSISTANT & REAL-TIME LEARNING ENGINE
 * 
 * - Risponde come "RoomUp!" in italiano naturale, zero emoji.
 * - Riconosce la gerarchia dello staff (Owner, Head Staff, Admin, Supervisor, Mod).
 * - Subentro Staff: se lo staff scrive "faccio io" / "ci penso io", il bot dice "Va bene" e cede il passo.
 * - Apprendimento Live: mentre lo staff scrive nel ticket, il bot osserva e registra le risposte nella memoria per-guild.
 * - Delega al Bot: se lo staff dice "@roomup puoi fare te" / "continua tu", il bot riprende il controllo autonomo.
 * - Direttive Staff: se lo staff dice "chiedigli X", il bot lo richiede all'utente in modo naturale.
 * - Multi-Guild: memoria isolata per-guild (RoomUp mantiene la sua memoria, i nuovi server partono da zero).
 */

require("dotenv").config();
const fs    = require("fs");
const path  = require("path");
const https = require("https");
const { ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags, EmbedBuilder } = require("discord.js");
const {
  defaultMemoryEngine,
  defaultLearningEngine,
  defaultKnowledgeEngine,
  LEARNING_TYPES
} = require("../sentinel");

const MEMORY_FILE   = path.join(__dirname, "../../data/ai_ticket_memory.json");
const SESSIONS_FILE = path.join(__dirname, "../../data/ai_ticket_sessions.json");

// ─── SESSIONI STATEFUL (per-canale) ─────────────────────────
function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) return JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf8"));
  } catch (e) {}
  return {};
}
function saveSessions(s) {
  try {
    fs.mkdirSync(path.dirname(SESSIONS_FILE), { recursive: true });
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(s, null, 2), "utf8");
  } catch (e) {}
}
function getSession(channelId) { return loadSessions()[channelId] || null; }
function setSession(channelId, data) {
  const s = loadSessions();
  s[channelId] = { ...s[channelId], ...data };
  saveSessions(s);
}
function deleteSession(channelId) {
  const s = loadSessions();
  delete s[channelId];
  saveSessions(s);
}

// ─── GEMINI MULTI-KEY ROTATION & VISION ─────────────────────
let geminiKeys    = [];
let currentKeyIdx = 0;
let geminiModels  = [];
let geminiVision  = null;

function initGeminiKeys() {
  if (geminiKeys.length > 0) return;
  try {
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const keys = [];
    for (let i = 1; i <= 20; i++) {
      const k = process.env[`GEMINI_KEY_${i}`];
      if (k) keys.push(k.trim());
    }
    if (keys.length === 0 && process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY.trim());
    if (keys.length === 0) {
      console.warn("[SentinelAI-Ticket] Nessuna GEMINI_KEY trovata nel .env");
      return;
    }

    geminiKeys   = keys;
    geminiModels = keys.map(k => new GoogleGenerativeAI(k).getGenerativeModel({ model: "gemini-3.6-flash" }));
    geminiVision = new GoogleGenerativeAI(keys[0]).getGenerativeModel({ model: "gemini-3.6-flash" });

    console.log(`[SentinelAI-Ticket] ${keys.length} key Gemini caricate — modello gemini-3.6-flash e vision attivi.`);
  } catch (e) {
    console.error("[SentinelAI-Ticket] Errore init Gemini:", e.message);
  }
}

async function callGeminiWithRotation(prompt) {
  if (geminiModels.length === 0) return null;
  let attempts = 0;
  while (attempts < geminiModels.length) {
    try {
      const result = await geminiModels[currentKeyIdx].generateContent(prompt);
      return result.response.text().trim();
    } catch (e) {
      const isQuota = (e?.status === 429) || (e.message || "").includes("quota") || (e.message || "").includes("RESOURCE_EXHAUSTED");
      if (isQuota) {
        console.warn(`[SentinelAI-Ticket] Key ${currentKeyIdx + 1} in quota — rotazione automatica.`);
        currentKeyIdx = (currentKeyIdx + 1) % geminiModels.length;
        attempts++;
      } else {
        console.error(`[SentinelAI-Ticket] Errore chiamata Gemini:`, e.message);
        return null;
      }
    }
  }
  return null;
}

function downloadImage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

// ─── PERSISTENZA MEMORIA ISOLATA MULTI-GUILD ────────────────
function loadMemory() {
  try {
    if (fs.existsSync(MEMORY_FILE)) return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
  } catch (e) {}
  return {};
}
function saveMemory(mem) {
  try {
    fs.mkdirSync(path.dirname(MEMORY_FILE), { recursive: true });
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(mem, null, 2), "utf8");
  } catch (e) {}
}

function getGuildMemory(guildId) {
  const mem = loadMemory();
  if (!mem[guildId]) {
    mem[guildId] = {
      general:     { precedents: [], learnedResponses: [], totalHandled: 0 },
      partnership: { precedents: [], learnedResponses: [], totalHandled: 0 },
      staff_app:   { precedents: [], learnedResponses: [], totalHandled: 0 },
      media_app:   { precedents: [], learnedResponses: [], totalHandled: 0 }
    };
    saveMemory(mem);
  }
  return mem[guildId];
}
function saveGuildMemory(guildId, guildMem) {
  const mem = loadMemory();
  mem[guildId] = guildMem;
  saveMemory(mem);
}

// ─── DOCUMENTAZIONE STAFF ROOMUP ─────────────────────────────
const STAFF_IDS = {
  owners:     ["frelerr", "zeyrox003", "samuelecosso"],
  moderators: ["kimo05868", "the_nogitsune", "davidowskii"]
};

const STAFF_ORG = `
ORGANIGRAMMA ROOMUP! (riferimento interno del bot):
- Owner (comando assoluto): frelerr, zeyrox003, samuelecosso
- Head Staff: posizione vacante
- Administration: posizione vacante
- Supervisor: posizione vacante
- Moderation (esecutori, cuore operativo): kimo05868, the_nogitsune, davidowskii
- Trial Staff: posizione vacante

Gerarchia: Owner > Head Staff > Administration > Supervisor > Moderation > Trial Staff.
Gli Owner sono i massimi superiori di RoomUp!. Quando un Owner o uno Staffer parla, il bot esegue con rispetto e massima priorità.
`;

function isStaffMember(member, author = null) {
  const username = (member?.user?.username || member?.username || author?.username || "").toLowerCase();
  const allStaff = [...STAFF_IDS.owners, ...STAFF_IDS.moderators];
  if (allStaff.some(s => username.includes(s.toLowerCase()))) return true;
  if (member?.guild?.ownerId && (member.id === member.guild.ownerId || member.user?.id === member.guild.ownerId)) return true;
  if (member?.roles?.cache?.has?.("1550846887085740125") || member?.roles?.cache?.has?.("1554969549076566117")) return true;
  return Boolean(member?.permissions?.has?.("ManageMessages") || member?.permissions?.has?.("ManageGuild") || member?.permissions?.has?.("Administrator"));
}

function isOwner(member, author = null) {
  const username = (member?.user?.username || member?.username || author?.username || "").toLowerCase();
  const rootOwners = ["frelerr", "zeyrox003", "samuelecosso"];
  if (rootOwners.some(o => username.includes(o.toLowerCase()))) return true;
  if (member?.guild?.ownerId && (member.id === member.guild.ownerId || member.user?.id === member.guild.ownerId)) return true;
  return Boolean(member?.permissions?.has?.("Administrator"));
}

// ─── PARSER INTENTI STAFF ────────────────────────────────────
function analyzeStaffIntent(content, message = null) {
  const norm = (content || "").toLowerCase().trim();

  // 1. Riapertura ticket
  const reopenPatterns = [
    /\b(riapri|riapri ticket|riapri il ticket|riaprite|reopen|!reopen|\/reopen)\b/i
  ];
  if (reopenPatterns.some(p => p.test(norm))) {
    return { type: "reopen_ticket", content };
  }

  // 2. Subentro Staff: "faccio io", "ci penso io", "lascia a me", "io sto gestendo il ticket", ecc.
  const takeoverPatterns = [
    /\bio sto gestendo il ticket\b/i,
    /\bsto gestendo il ticket\b/i,
    /\bio gestisco il ticket\b/i,
    /\bgestisco il ticket\b/i,
    /\b(?:io\s+)?sto gestendo\b/i,
    /\blo sto gestendo\b/i,
    /\blo gestisco io\b/i,
    /\bgestisco io\b/i,
    /\bquesto ticket lo gestisco io\b/i,
    /\bquesto lo gestisco io\b/i,
    /\bme lo gestisco io\b/i,
    /\bme ne sto occupando io\b/i,
    /\bsto seguendo io\b/i,
    /\blo seguo io\b/i,
    /\bci sono io\b/i,
    /\b(?:no\s+)?faccio io\b/i,
    /\b(?:no\s+)?ci penso io\b/i,
    /\bci penso me\b/i,
    /\blascia a me\b/i,
    /\blascia fare a me\b/i,
    /\blascia stare\b/i,
    /\bprendo io questo ticket\b/i,
    /\bprendo io il ticket\b/i,
    /\bprendo io questo\b/i,
    /\bprendo io\b/i,
    /\bprendo ticket\b/i,
    /\bprendo il ticket\b/i,
    /\bme ne occupo io\b/i,
    /\bfermati\b/i,
    /\bnon intervenire\b/i,
    /\bnon rispondere\b/i,
    /\bstai muto\b/i,
    /\bnon parlare\b/i,
    /\bsilenzio\b/i,
    /\bfaccio da solo\b/i,
    /\bfaccio da me\b/i,
    /\blascio stare\b/i,
    /\blascio io\b/i
  ];
  if (takeoverPatterns.some(p => p.test(norm))) {
    return { type: "takeover" };
  }

  // 3. Delega al Bot: "puoi fare te", "fai tu", "continua tu", ecc.
  const handoverPatterns = [
    /\bpuoi fare te\b/i,
    /\bpuoi fare tu\b/i,
    /\bfai tu\b/i,
    /\bfai te\b/i,
    /\bpensaci tu\b/i,
    /\bcontinua tu\b/i,
    /\bprocedi tu\b/i,
    /\bvai avanti tu\b/i,
    /\bprendi tu\b/i,
    /\brispondi tu\b/i,
    /\baiutalo tu\b/i
  ];
  if (handoverPatterns.some(p => p.test(norm))) {
    return { type: "handover" };
  }

  // 4. Annullamento / Revoca / Rifiuto dello staff
  const revokePatterns = [
    /\bno elimina\b/i,
    /\belimina partnership\b/i,
    /\bnon [eè] idoneo\b/i,
    /\bnon va bene\b/i,
    /\bnon va\b/i,
    /\bannulla\b/i,
    /\brevoca\b/i,
    /\bcancella\b/i,
    /\brifiuta\b/i
  ];
  if (revokePatterns.some(p => p.test(norm))) {
    return { type: "revoke", reason: content };
  }

  // 5. Istruzione diretta (es. "chiedigli se...", "digli di...", "mica devi...", "devi chiedere a...")
  const directivePatterns = [
    /^chiedigli\b/i,
    /^chiedi a\b/i,
    /^digli\b/i,
    /^dici a\b/i,
    /^fagli\b/i,
    /^spiegagli\b/i,
    /\bdevi chiedere a\b/i,
    /\bchiedi tu a\b/i,
    /\bmica devi\b/i
  ];
  if (directivePatterns.some(p => p.test(norm))) {
    return { type: "directive", instruction: content };
  }

  // 6. Explicit Bot Mentions (ONLY bot itself)
  const botId = message?.client?.user?.id;
  const isBotMentioned = Boolean(
    (botId && message?.mentions?.users?.has?.(botId) && !message?.mentions?.everyone) ||
    (botId && new RegExp(`<@!?${botId}>`).test(content)) ||
    norm.includes("@roomup") ||
    norm.includes("@sentinel") ||
    /\broomup\b/i.test(norm)
  );

  const addressesBot = isBotMentioned ||
    /(?:hey\s+)?(?:roomup|sentinel|bot)[,\s:!]?/i.test(norm) ||
    norm.startsWith("!") || norm.startsWith("/");

  const isCommand = [
    /\b(chiudi|chiudi ticket|risolvi ticket|archivia ticket|!close|\/close)\b/i,
    /\b(mostra regole|quali regole ricordi|cosa ricordi|lista regole|regole memorizzate|!learn lista|\/learn lista)\b/i,
    /\b(per questo tipo di problema chiediamo sempre|quando succede questo problema chiediamo sempre|quando succede questo problema|regola per questo problema|ricorda che|ricordati che|ricordati vedere sempre|ricorda di vedere sempre|ricordati di|ricorda di|ricordati sempre|ricorda sempre|ricordati|ricorda|impara che|impara|tieni a mente che|tieni a mente|non dimenticare di|non dimenticare che|non dimenticare|controlla sempre che|controlla sempre|verifica sempre che|verifica sempre|assicurati che|assicurati di|fai attenzione a|fai attenzione che|attento a|non sia nsfw|contenuti brutti|salva la regola|nuova regola|!learn|\/learn)\b/i,
    /\b(mostra obiettivi|quali sono gli obiettivi|lista obiettivi|obiettivi attivi|!goal lista|\/goal lista)\b/i,
    /\b(completa obiettivo|segna come completato|!goal completa|\/goal completa)\b/i,
    /\b(rimuovi obiettivo|elimina obiettivo|cancella obiettivo|!goal rimuovi|\/goal rimuovi)\b/i,
    /\b(imposta obiettivo|nuovo obiettivo|aggiungi obiettivo|obiettivo:|\/goal imposta|!goal imposta|!goal|\/goal)\b/i,
    /\b(stato boost|boost status|!boost status|boost|attiva boost|\/boost|!boost)\b/i,
    /\b(grill-me|grill me|!grill-me|\/grill-me)\b/i,
    /\b(questa [eè] la nostra descrizione|ecco la nostra descrizione|descrizione nostra|nostro annuncio)\b/i
  ].some(p => p.test(norm));

  const isStatusInquiry = [
    /\bche succede\b/i,
    /\bcosa succede\b/i,
    /\bcosa sta succedendo\b/i,
    /\bche sta succedendo\b/i,
    /\ba che punto siamo\b/i,
    /\bqual [eè] la situazione\b/i,
    /\bqual [eè] lo stato\b/i,
    /\bstatus\b/i,
    /\bstato ticket\b/i,
    /\briassunto\b/i,
    /\briassumi\b/i,
    /\bcosa manca\b/i,
    /\baggiornami\b/i,
    /\bspiegami\b/i
  ].some(p => p.test(norm));

  if (isCommand || addressesBot) {
    return {
      type: "staff_command_or_inquiry",
      content,
      addressesBot,
      isCommand,
      isStatusInquiry,
      isMention: Boolean(isBotMentioned)
    };
  }

  return { type: "general_staff", content };
}

// ─── APPRENDIMENTO ATTIVO LIVE ───────────────────────────────
function recordStaffActionLive(guildId, categoryKey, userLastMessage, staffMessage) {
  if (!guildId || !staffMessage || staffMessage.length < 5) return;
  const mem = loadMemory();
  if (!mem[guildId]) mem[guildId] = getGuildMemory(guildId);
  if (!mem[guildId][categoryKey]) {
    mem[guildId][categoryKey] = { precedents: [], learnedResponses: [], totalHandled: 0 };
  }

  const catMem = mem[guildId][categoryKey];
  const words = (userLastMessage || "").toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/)
    .filter(w => w.length > 3 && !["della","dello","degli","nelle","sono","siamo","avere","questo","quella","ciao","grazie"].includes(w));
  const keywords = [...new Set(words)].slice(0, 8);

  const exists = catMem.learnedResponses.find(lr => lr.response === staffMessage.slice(0, 400));
  if (!exists) {
    catMem.learnedResponses.push({
      id: `live_${Date.now()}`,
      keywords: keywords.length > 0 ? keywords : ["generale", "staff"],
      response: staffMessage.slice(0, 400),
      usageCount: 0,
      learnedFrom: "live_staff_action",
      learnedAt: new Date().toISOString()
    });
    if (catMem.learnedResponses.length > 50) {
      catMem.learnedResponses = catMem.learnedResponses.slice(-50);
    }
    mem[guildId][categoryKey] = catMem;
    saveMemory(mem);
    console.log(`[SentinelAI-Ticket] Appreso in tempo reale [guild ${guildId} / ${categoryKey}]: "${staffMessage.slice(0, 60)}"`);
  }
}

// ─── CONTESTI CATEGORIE ─────────────────────────────────────
const CATEGORY_CONTEXT = {
  general:     `Ticket di supporto generale. L'utente ha bisogno di assistenza tecnica, chiarimenti o aiuto su RoomUp o Discord. Rispondi in modo naturale, diretto e amichevole.`,
  smp:         `Ticket di assistenza generale per il server Minecraft RoomUp! x YouTuberMC (SMP 1.21.x su Paper a 20 TPS, in pieno stile DonutSMP). Il server è hardcore in stile DonutSMP: griefing, furti tra basi e raiding fanno parte del normale gameplay di sopravvivenza consentito dal regolamento. Lo staff NON interviene e non rimborsa per basi raidate o item rubati nel gioco. Il supporto SMP è dedicato esclusivamente ad assistenza generale, problemi tecnici, bug di sistema, comandi (/menu, /shop, /ah, /sell, /worth), Spawners o Casse Crate. Rispondi in modo naturale, diretto e amichevole.`,
  account:     `Ticket di supporto account, recupero nick, donazioni Patreon, VIP o store. L'utente ha problemi con il cambio nickname, il recupero credenziali o pacchetti VIP/Crate keys acquistati. Rispondi con massima serietà e riservatezza.`,
  partnership: `Richiesta di partnership con RoomUp. Requisiti: server attivo da almeno un mese, comunità solida, link invito permanente. Invito ufficiale RoomUp: discord.gg/roomup`,
  staff_app:   `Sei l'esaminatore ufficiale e supervisore dello staff per RoomUp! x YouTuberMC (Minecraft SMP 1.21.x e Discord).
Conosci alla perfezione tutte le procedure di ScreenShare (SS) forensi:
- Freeze in-game (/ss, /freeze), timer 3 min per entrare in vocale, divieto assoluto di disconnessione (slog = ban), canale vocale di supporto, connessione remota con AnyDesk o TeamViewer nel pieno rispetto della privacy (vietato aprire chat private, foto o documenti personali).
- Verifiche in-game: tasti GUI (Right Shift, LShift, Insert), comandi chat nascosti (.unload, .bind, .destruct tramite 'T' + Freccia Su), resource pack, mods folder (%appdata%\\.minecraft\\mods).
- Forensics Windows: C:\\Windows\\Prefetch (file .pf ordinati per LastModified per loader o cheat recenti), Registro BAM (SYSTEM\\CurrentControlSet\\Services\\bam\\State\\UserSettings per tracciare qualsiasi eseguibile avviato anche se cancellato), UserAssist (decodifica ROT13 da Explorer), USN Journal (fsutil usn queryjournal per file cancellati di recente).
- Analisi memoria javaw.exe con Process Hacker: ricerca stringhe per ghost client noti (Vape V4, Vape Lite, Drip Lite, Raven B+, Whiteout, Slinky, Entropy, Kura, Doomsday, Insertion, Lithium, Yukio) e moduli (reach, autoclicker, velocity, hitbox, aimassist).
- Tool automatici: Echo, Paladin, Bamboo, Everything.
- Autoclicker e software mouse: OP Autoclicker, SpeedAutoClicker, Razer Synapse, Logitech G Hub, Glorious Core, software Bloody, consistenza anomala CPS.
- Falsi positivi: distinzione tra librerie lecite (lwjgl.dll, mod legit Optifine/Sodium/Iris/VoiceChat) e cheat veri.
- Ecosistema RoomUp! SMP: Paper 1.21.x a 20 TPS stabili, navigazione centrale /menu, /shop e /ah (0% inserzione, 2% vendita), Spawners con Registro Raccolte, Casse a 6 Tier (Crate Leggendaria Netherite Max Enchant, Mitica con Magic Bucket e Razzo Stellare Infinito 14gg), Gang/Team e claim chunk anti-griefing, Combat Tag e Simple Voice Chat / Oraxen.
Se il candidato o lo staff ti chiedono dettagli su queste procedure, rispondi con padronanza tecnica assoluta, spiegando i passaggi esatti con professionalità.`,
  media_app:   `Candidatura content creator per RoomUp. Nessuna soglia minima di iscritti, valutiamo qualità e affinità. Risposta entro 2-5 giorni.`
};

// ─── GENERATORE RISPOSTA GEMINI CON MEMORIA DI QUEL SERVER ───
async function generateAutonomousReply(guildId, categoryKey, conversationHistory, extraContext = "") {
  const guildMem = getGuildMemory(guildId);
  const catMem   = guildMem?.[categoryKey];

  let learnedExamples = "";
  if (catMem?.learnedResponses?.length > 0) {
    const examples = catMem.learnedResponses.slice(-5).map(lr => `- "${lr.response}"`).join("\n");
    learnedExamples = `\nEsempi di risposte che lo staff ha dato in passato in situazioni simili su questo server (ispirati a questo stile senza copiarle verbatim):\n${examples}\n`;
  }

  const historyText = conversationHistory.map(h => `${h.role === "user" ? "Utente" : (h.role === "staff" ? "Staff" : "RoomUp!")}: ${h.text}`).join("\n");

  const prompt = `Sei RoomUp!, lo staff assistente virtuale del server Discord.
${STAFF_ORG}

REGOLE ASSOLUTE:
- Parla in italiano fluido, colloquiale e naturale, come una persona vera dello staff.
- ZERO emoji. Non usarne MAI nessuna.
- Niente elenchi puntati o elenchi numerati formali.
- Niente grassetti decorativi o titoli robotici.
- Max 3-4 righe, dritto al punto.
- Se l'utente ha fatto una domanda specifica, rispondi con chiarezza.
- Firma sempre con una riga vuota e "RoomUp!" alla fine solo se stai concludendo una risposta di supporto formale.

CONTESTO TICKET:
${CATEGORY_CONTEXT[categoryKey] || CATEGORY_CONTEXT.general}
${extraContext}
${learnedExamples}

CRONOLOGIA TICKET:
${historyText || "(Nessun messaggio pregresso)"}

Scrivi la tua prossima risposta all'utente:`;

  return await callGeminiWithRotation(prompt);
}

// ─── GESTIONE TICKETS NON-PARTNERSHIP (Supporto, Staff, Media)
async function handleGeneralTicketMessage(message, session) {
  const channel = message.channel;
  if (message.author.bot) return;

  const member = message.member || message.guild?.members?.cache?.get?.(message.author.id);
  const senderIsStaff   = isStaffMember(member, message.author);
  const senderIsOwner   = isOwner(member, message.author);
  const senderIsCreator = message.author.id === session.userId;
  const isAuthorizedStaff = (senderIsStaff || senderIsOwner) && (!senderIsCreator || senderIsOwner);

  const history = session.conversationHistory || [];

  // 1. MESSAGGIO DELLO STAFF
  if (isAuthorizedStaff) {
    const intent = analyzeStaffIntent(message.content, message);

    // A. Lo staff subentra: "faccio io" / "io sto gestendo il ticket"
    if (intent.type === "takeover") {
      setSession(channel.id, { ...session, status: "staff_handling" });
      const staffPrefix = senderIsOwner ? "Ciao Frè" : `Ciao ${message.author.username}`;
      const reply = `Perfetto ${staffPrefix}, ti lascio la gestione del ticket. Rimango in ascolto silenzioso.`;
      await channel.send(reply).catch(() => null);
      history.push({ role: "staff", text: message.content });
      history.push({ role: "bot", text: reply });
      setSession(channel.id, { ...session, conversationHistory: history, status: "staff_handling" });
      return;
    }

    // A2. Reopen Ticket
    if (intent.type === "reopen_ticket") {
      setSession(channel.id, { ...session, status: "autonomous", state: "in_progress" });
      const staffPrefix = senderIsOwner ? "Ciao Frè" : `Ciao ${message.author.username}`;
      const reply = `${staffPrefix}, procedo subito a riaprire il ticket. È nuovamente attivo e operativo.`;
      await channel.send(reply).catch(() => null);
      history.push({ role: "staff", text: message.content });
      history.push({ role: "bot", text: reply });
      setSession(channel.id, { ...session, conversationHistory: history });
      return;
    }

    // Silence guard: when staff is handling, bot remains silent unless explicit command, directive, handover, reopen or status inquiry
    if (session.status === "staff_handling") {
      if (intent.type === "general_staff" || (!intent.isCommand && !intent.isStatusInquiry && intent.type !== "directive" && intent.type !== "handover" && intent.type !== "reopen_ticket")) {
        history.push({ role: "staff", text: message.content });
        setSession(channel.id, { ...session, conversationHistory: history });
        return;
      }
    }

    // B. Lo staff ridelega: "@roomup puoi fare te"
    if (intent.type === "handover") {
      setSession(channel.id, { ...session, status: "autonomous" });
      await channel.sendTyping().catch(() => null);
      await new Promise(r => setTimeout(r, 800));
      
      const confirmReply = "Ricevuto, me ne occupo io da qui.";
      await channel.send(confirmReply);
      history.push({ role: "staff", text: message.content });
      history.push({ role: "bot", text: confirmReply });

      // Genera subito la risposta utile per l'utente
      await channel.sendTyping().catch(() => null);
      const nextStep = await generateAutonomousReply(session.guildId, session.categoryKey, history, "Lo staff ti ha appena passato la gestione.");
      if (nextStep) {
        await new Promise(r => setTimeout(r, 1200));
        await channel.send(nextStep);
        history.push({ role: "bot", text: nextStep });
      }
      setSession(channel.id, { ...session, conversationHistory: history, status: "autonomous" });
      return;
    }

    // C. Direttiva dello staff: "chiedigli se ha riavviato"
    if (intent.type === "directive") {
      await channel.sendTyping().catch(() => null);
      const prompt = `Sei RoomUp!, staff del server Discord. Un membro superiore dello staff (${message.author.username}) ti ha dato questa istruzione: "${intent.instruction}".

Il tuo compito è rivolgerti DIRETTAMENTE in seconda persona ("tu") all'utente che ha aperto il ticket per chiedergli quanto richiesto dallo staff.
REGOLE TASSATIVE:
- NON iniziare MAI con "chiedigli", "chiedi a", "digli", "fagli". Devi parlare direttamente all'utente dicendo ad esempio: "Puoi dirci...", "Riusciresti a...", "Potresti fornirci...".
- Zero emoji.
- Naturale, educato, max 2 righe.
- NON menzionare che è un ordine dello staff.

Scrivi ESCLUSIVAMENTE il messaggio da inviare all'utente:`;
      let text = await callGeminiWithRotation(prompt);
      if (!text) {
        let cleaned = intent.instruction.replace(/^(chiedigli di|chiedigli|digli di|digli|chiedi a|fagli|spiegagli di|spiegagli)\s+/i, "");
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
        text = `Puoi ${cleaned}?`;
      }
      await channel.send(text);
      history.push({ role: "staff", text: message.content });
      history.push({ role: "bot", text: text });
      setSession(channel.id, { ...session, conversationHistory: history });
      return;
    }

    // D. Staff Command, Inquiry or Direct Address (e.g. "@RoomUp! che succede", "chiudi", "ricorda", "status")
    if (intent.type === "staff_command_or_inquiry") {
      await channel.sendTyping().catch(() => null);
      const normContent = (message.content || "").toLowerCase().trim();
      const staffPrefix = senderIsOwner ? "Ciao Frè" : `Ciao ${message.author.username}`;

      // D1. Close ticket
      if (/\b(chiudi|chiudi ticket|risolvi ticket|archivia ticket|!close|\/close)\b/i.test(normContent)) {
        const reply = `${staffPrefix}, procedo subito a segnare il ticket come risolto e ad archiviarlo.`;
        await channel.send(reply).catch(() => null);
        try {
          const { defaultToolEngine } = require("../sentinel");
          await defaultToolEngine.executeTool("close_ticket", {
            channelId: channel.id,
            guildId: session.guildId,
            reason: "Chiusura su richiesta staff",
            closedBy: message.author.username
          }, { guildId: session.guildId, channelId: channel.id, userId: message.author.id });
        } catch (e) {}
        history.push({ role: "staff", text: message.content });
        history.push({ role: "bot", text: reply });
        setSession(channel.id, { ...session, conversationHistory: history, state: "closed" });
        return;
      }

      // D2. Rule commands
      if (/\b(mostra regole|quali regole ricordi|cosa ricordi|lista regole|regole memorizzate|!learn lista|\/learn lista)\b/i.test(normContent)) {
        const rules = defaultMemoryEngine.getLearnedRules(session.guildId);
        const reply = rules.length === 0
          ? `${staffPrefix}, al momento non ci sono regole personalizzate memorizzate per questo server.`
          : `${staffPrefix}, ecco le regole memorizzate nel sistema:\n` + rules.slice(-8).map((r, idx) => `${idx + 1}. [${r.category}] "${r.rule}"`).join("\n");
        await channel.send(reply).catch(() => null);
        return;
      }

      if (/\b(per questo tipo di problema chiediamo sempre|quando succede questo problema chiediamo sempre|quando succede questo problema|regola per questo problema|ricorda che|ricordati che|ricordati vedere sempre|ricorda di vedere sempre|ricordati di|ricorda di|ricordati sempre|ricorda sempre|ricordati|ricorda|impara che|impara|tieni a mente che|tieni a mente|non dimenticare di|non dimenticare che|non dimenticare|controlla sempre che|controlla sempre|verifica sempre che|verifica sempre|assicurati che|assicurati di|fai attenzione a|fai attenzione che|attento a|non sia nsfw|contenuti brutti|salva la regola|nuova regola|!learn|\/learn)\b/i.test(normContent)) {
        let cleaned = message.content
          .replace(/<@!?\d+>/g, "")
          .replace(/@roomup!?/gi, "")
          .replace(/@sentinel/gi, "")
          .replace(/^[!/]?learn(?:\s+imposta)?\s*/i, "")
          .replace(/^.*?\b(per questo tipo di problema chiediamo sempre|quando succede questo problema chiediamo sempre|quando succede questo problema|regola per questo problema|ricorda che|ricordati che|ricordati vedere sempre|ricorda di vedere sempre|ricordati di|ricorda di|ricordati sempre|ricorda sempre|ricordati|ricorda|impara che|impara|tieni a mente che|tieni a mente|non dimenticare di|non dimenticare che|non dimenticare|controlla sempre che|controlla sempre|verifica sempre che|verifica sempre|assicurati che|assicurati di|fai attenzione a|fai attenzione che|attento a|salva la regola|nuova regola)\s*/i, "")
          .replace(/\b(?:se capisci|capito\??|ok\??|grazie|per favore|mi raccomando)\b[.!?\s]*$/i, "")
          .trim();
        if (/^che\s+/i.test(cleaned)) cleaned = cleaned.replace(/^che\s+/i, "").trim();

        if (cleaned.length > 3) {
          const ruleCat = (session.categoryKey && session.categoryKey.toLowerCase().includes("partner")) || /partner|server|invito|sponsor|nsfw|contenut/i.test(message.content)
            ? "PARTNERSHIP"
            : (session.categoryKey ? session.categoryKey.toUpperCase() : "GENERAL");

          defaultMemoryEngine.addLearnedRule(session.guildId, {
            rule: cleaned,
            category: ruleCat,
            author: message.author.username,
            source: `ticket_${channel.name}`
          });
          defaultKnowledgeEngine.addKnowledgeItem(session.guildId, {
            category: ruleCat,
            title: `Regola appresa da ${message.author.username}`,
            content: cleaned,
            author: message.author.username,
            source: `ticket_${channel.name}`
          });

          const isNsfwRule = /nsfw|brutt|inappropriat/i.test(message.content);
          const reply = isNsfwRule
            ? `Ricevuto ${staffPrefix}! Ho memorizzato la direttiva: verificherò sempre che i server partner non abbiano contenuti NSFW o inappropriati prima di procedere con la partnership.`
            : `Ricevuto ${staffPrefix}! Ho registrato e memorizzato questa regola nel sistema:\n"${cleaned}"\nLa applicherò per i prossimi interventi.`;

          await channel.send(reply).catch(() => null);
          history.push({ role: "staff", text: message.content });
          history.push({ role: "bot", text: reply });
          setSession(channel.id, { ...session, conversationHistory: history });
          return;
        }
      }

      // D3. Goal commands
      if (/\b(mostra obiettivi|quali sono gli obiettivi|lista obiettivi|obiettivi attivi|!goal lista|\/goal lista)\b/i.test(normContent)) {
        const goals = defaultMemoryEngine.getGoals(session.guildId, "all");
        const reply = goals.length === 0
          ? `${staffPrefix}, non ci sono obiettivi registrati al momento.`
          : `${staffPrefix}, ecco gli obiettivi attivi del server:\n` + goals.map((g, idx) => `${idx + 1}. [${g.status}] **${g.title}**`).join("\n");
        await channel.send(reply).catch(() => null);
        return;
      }

      if (/\b(completa obiettivo|segna come completato|!goal completa|\/goal completa)\b/i.test(normContent)) {
        const cleaned = message.content.replace(/^.*?\b(completa obiettivo|segna come completato|!goal completa|\/goal completa)\s*/i, "").trim();
        if (cleaned.length > 0) {
          const comp = defaultMemoryEngine.completeGoal(session.guildId, cleaned);
          const reply = comp ? `🎉 Obiettivo **"${comp.title}"** segnato come completato!` : `❌ Nessun obiettivo corrispondente a "${cleaned}".`;
          await channel.send(reply).catch(() => null);
          return;
        }
      }

      if (/\b(rimuovi obiettivo|elimina obiettivo|cancella obiettivo|!goal rimuovi|\/goal rimuovi)\b/i.test(normContent)) {
        const cleaned = message.content.replace(/^.*?\b(rimuovi obiettivo|elimina obiettivo|cancella obiettivo|!goal rimuovi|\/goal rimuovi)\s*/i, "").trim();
        if (cleaned.length > 0) {
          const rem = defaultMemoryEngine.removeGoal(session.guildId, cleaned);
          const reply = rem ? `🗑️ Obiettivo **"${rem.title}"** rimosso dalla memoria.` : `❌ Nessun obiettivo corrispondente a "${cleaned}".`;
          await channel.send(reply).catch(() => null);
          return;
        }
      }

      if (/\b(imposta obiettivo|nuovo obiettivo|aggiungi obiettivo|obiettivo:|\/goal imposta|!goal imposta|!goal|\/goal)\b/i.test(normContent)) {
        const cleaned = message.content.replace(/^.*?\b(imposta obiettivo|nuovo obiettivo|aggiungi obiettivo|obiettivo:|\/goal imposta|!goal imposta|!goal|\/goal)\s*/i, "").trim();
        if (cleaned.length > 3) {
          const g = defaultMemoryEngine.addGoal(session.guildId, {
            title: cleaned,
            details: `Impostato da ${message.author.username} in #${channel.name}`,
            createdBy: message.author.username
          });
          const reply = `Obiettivo registrato con successo: **${g.title}** (ID: \`${g.id}\`). È ora attivo e monitorato.`;
          await channel.send(reply).catch(() => null);
          history.push({ role: "staff", text: message.content });
          history.push({ role: "bot", text: reply });
          setSession(channel.id, { ...session, conversationHistory: history });
          return;
        }
      }

      // D4. Boost commands
      if (/\b(stato boost|boost status|!boost status)\b/i.test(normContent)) {
        const b = defaultMemoryEngine.getBoostMode(session.guildId);
        const reply = b.enabled
          ? `Modalità Boost attiva: **${b.mode}** (impostata da ${b.setBy || "Staff"}).`
          : "La modalità Boost è attualmente disattivata.";
        await channel.send(reply).catch(() => null);
        return;
      }

      if (/\b(boost|attiva boost|\/boost|!boost)\b/i.test(normContent)) {
        let mode = "deep_reasoning";
        if (normContent.includes("max_autonomy") || normContent.includes("autonomia")) mode = "max_autonomy";
        else if (normContent.includes("speed") || normContent.includes("velocit")) mode = "speed";
        else if (normContent.includes("strict") || normContent.includes("audit")) mode = "strict_audit";

        defaultMemoryEngine.setBoostMode(session.guildId, {
          mode,
          setBy: message.author.username,
          durationMinutes: 120
        });
        const reply = `Modalità **${mode} Boost** attivata per 120 minuti da ${message.author.username}.`;
        await channel.send(reply).catch(() => null);
        return;
      }

      // D5. Grill-Me command
      if (/\b(grill-me|grill me|!grill-me|\/grill-me)\b/i.test(normContent)) {
        const topic = message.content.replace(/^.*?\b(grill-me|grill me|!grill-me|\/grill-me)\s*/i, "").trim() || "Strategia e Gestione Server";
        const firstQ = `Iniziamo la sessione Grill-Me su "${topic}". Qual è il presupposto fondamentale su cui si basa questo piano e quale punto debole potrebbe farlo fallire se il server raddoppiasse i membri domani?`;
        defaultMemoryEngine.startGrillSession(session.guildId, channel.id, message.author.id, { topic, initialQuestion: firstQ });
        const reply = `🔥 **Sessione Socratic Grill-Me Avviata (Round 1/5)**\n**Tema:** ${topic}\n\n${firstQ}\n\n*Rispondi qui in chat per proseguire o scrivi 'stop' per interrompere.*`;
        await channel.send(reply).catch(() => null);
        return;
      }

      // D6. Status briefing inquiry or direct address / mention (@roomup, "che succede", "status", etc.)
      if (!intent.isStatusInquiry && !intent.addressesBot && !intent.isMention) {
        history.push({ role: "staff", text: message.content });
        setSession(channel.id, { ...session, conversationHistory: history });
        return;
      }

      const userMention = session.userId ? `<@${session.userId}>` : "l'utente";
      let reply = "";
      if (intent.isStatusInquiry) {
        reply = `${staffPrefix}, ecco la situazione: stiamo gestendo il ticket di ${session.categoryKey || "supporto"} per ${userMention}. Stato: ${session.status || "in corso"}. Sto monitorando la conversazione e rimango pronto a eseguire le tue direttive.`;
      } else {
        reply = `${staffPrefix}! Sono qui e operativo al 100%. Sto monitorando il ticket di ${userMention}. Dimmi pure se hai indicazioni o verifiche da eseguire per questo ticket.`;
      }
      await channel.send(reply).catch(() => null);
      history.push({ role: "staff", text: message.content });
      history.push({ role: "bot", text: reply });
      setSession(channel.id, { ...session, conversationHistory: history });
      return;
    }

    // E. Lo staff sta parlando direttamente con l'utente -> Apprendimento Live!
    const lastUserMsg = history.filter(h => h.role === "user").slice(-1)[0]?.text || "";
    recordStaffActionLive(session.guildId, session.categoryKey, lastUserMsg, message.content);
    history.push({ role: "staff", text: message.content });
    setSession(channel.id, { ...session, conversationHistory: history });
    return;
  }

  // 2. MESSAGGIO DELL'UTENTE
  if (senderIsCreator || !senderIsStaff) {
    history.push({ role: "user", text: message.content });

    // Se lo staff ha detto "faccio io", il bot non disturba e lascia fare allo staff
    if (session.status === "staff_handling") {
      setSession(channel.id, { ...session, conversationHistory: history });
      return;
    }

    // Se è in modalità autonoma, risponde con intelligenza naturale
    await channel.sendTyping().catch(() => null);
    await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));
    const botReply = await generateAutonomousReply(session.guildId, session.categoryKey, history);
    if (botReply) {
      await channel.send(botReply);
      history.push({ role: "bot", text: botReply });
    }
    setSession(channel.id, { ...session, conversationHistory: history });
  }
}

// ─── FLUSSO PARTNERSHIP STATEFUL ────────────────────────────
const ROOMUP_INVITE = "discord.gg/roomup";

function extractMemberFigures(text) {
  if (!text) return [];
  const str = String(text);
  const figures = [];
  const kMatches = str.matchAll(/\b(\d+(?:[.,]\d+)?)\s*k\+?\b/gi);
  for (const m of kMatches) {
    const rawVal = parseFloat(m[1].replace(",", "."));
    const val = Math.round(rawVal * 1000);
    if (val >= 10 && val <= 10000000 && !figures.includes(String(val))) {
      figures.push(String(val));
    }
  }
  const regex = /\b\d{1,3}(?:[.,]\d{3})+\b|\b\d+\b/g;
  const matches = str.match(regex) || [];
  for (const n of matches) {
    const clean = n.replace(/[.,]/g, "");
    const val = parseInt(clean, 10);
    if (val >= 10 && val <= 10000000 && !figures.includes(clean)) {
      figures.push(clean);
    }
  }
  return figures;
}

async function startPartnershipFlow(ticketChannel, memberCount, userId, guildId) {
  const figures = extractMemberFigures(memberCount);

  let initialReply = "";
  let step = "AWAITING_MEMBERS";
  let extractedCount = null;
  let extractedFigures = null;

  if (figures.length >= 2) {
    step = "AWAITING_CHAIN_CONFIRM";
    extractedFigures = figures.join(", ");
    const countText = figures.length === 3 ? "tre" : `${figures.length}`;
    initialReply = `Ciao! Grazie per averci contattato. Prima di passare la tua richiesta al reparto relazioni estere, dobbiamo verificare che rispetti i nostri requisiti per le partnership.\n\nHai indicato ${countText} cifre di membri (${figures.join(", ")}): si tratta di server distinti collegati tra loro (cioè una chain)?`;
  } else if (figures.length === 1) {
    step = "AWAITING_COOLDOWN";
    extractedCount = figures[0];
    const displayCount = Number(figures[0]).toLocaleString("it-IT");
    initialReply = `Ciao! Grazie per averci contattato. Prima di passare la tua richiesta al reparto relazioni estere, dobbiamo verificare che rispetti i nostri requisiti per le partnership.\n\nAbbiamo registrato che il tuo server ha circa ${displayCount} membri. Un'ulteriore verifica sui requisiti: hai già effettuato in passato una partnership con RoomUp? Se sì, quando è avvenuta l'ultima volta? (Ricorda che la partnership con lo stesso server può essere ripetuta solo dopo 10 giorni.)`;
  } else {
    step = "AWAITING_MEMBERS";
    initialReply = `Ciao! Grazie per averci contattato. Prima di passare la tua richiesta al reparto relazioni estere, dobbiamo verificare che rispetti i nostri requisiti per le partnership.\n\nUna prima domanda: quanti membri ha attualmente il tuo server?`;
  }

  setSession(ticketChannel.id, {
    status: "autonomous",
    state: "questioning",
    guildId,
    userId,
    categoryKey: "partnership",
    memberCount: extractedCount || memberCount,
    memberFigures: extractedFigures,
    screeningStep: step,
    greetingSent: true,
    conversationHistory: [
      { role: "bot", text: initialReply }
    ]
  });

  try {
    const { defaultMemoryEngine } = require("../sentinel/memory-engine/MemoryEngine");
    defaultMemoryEngine.updateTicketMemory(guildId, ticketChannel.id, {
      screeningStep: step,
      memberCount: extractedCount || memberCount,
      memberFigures: extractedFigures,
      greetingSent: true,
      category: "PARTNERSHIP",
      conversationHistory: [
        { role: "bot", text: initialReply }
      ]
    });
  } catch (e) {}

  await ticketChannel.sendTyping().catch(() => null);
  await new Promise(r => setTimeout(r, 600));
  await ticketChannel.send(initialReply);
}

async function handlePartnershipMessage(message, session) {
  const channel = message.channel;
  if (message.author.bot) return;

  const member = message.member || message.guild?.members?.cache?.get?.(message.author.id);
  const senderIsStaff   = isStaffMember(member, message.author);
  const senderIsOwner   = isOwner(member, message.author);
  const senderIsCreator = message.author.id === session.userId;
  const isAuthorizedStaff = (senderIsStaff || senderIsOwner) && (!senderIsCreator || senderIsOwner);

  const history = session.conversationHistory || [];

  // 1. GESTIONE INTERVENTO STAFF
  if (isAuthorizedStaff) {
    const intent = analyzeStaffIntent(message.content, message);

    if (intent.type === "takeover") {
      setSession(channel.id, { ...session, status: "staff_handling" });
      const staffPrefix = senderIsOwner ? "Ciao Frè" : `Ciao ${message.author.username}`;
      const reply = `Perfetto ${staffPrefix}, ti lascio la gestione del ticket. Rimango in ascolto silenzioso.`;
      await channel.send(reply).catch(() => null);
      history.push({ role: "staff", text: message.content });
      history.push({ role: "bot", text: reply });
      setSession(channel.id, { ...session, conversationHistory: history, status: "staff_handling" });
      return;
    }

    // Reopen ticket
    if (intent.type === "reopen_ticket") {
      setSession(channel.id, { ...session, status: "autonomous", state: session.partnerDescription ? "awaiting_screenshot" : "questioning" });
      const staffPrefix = senderIsOwner ? "Ciao Frè" : `Ciao ${message.author.username}`;
      const reply = `${staffPrefix}, procedo subito a riaprire il ticket. È nuovamente attivo e operativo.`;
      await channel.send(reply).catch(() => null);
      history.push({ role: "staff", text: message.content });
      history.push({ role: "bot", text: reply });
      setSession(channel.id, { ...session, conversationHistory: history });
      return;
    }

    // Silence guard: when staff is handling, bot remains silent unless explicit command, directive, handover, reopen, or status inquiry
    if (session.status === "staff_handling") {
      if (intent.type === "general_staff" || (!intent.isCommand && !intent.isStatusInquiry && intent.type !== "directive" && intent.type !== "handover" && intent.type !== "reopen_ticket" && intent.type !== "revoke")) {
        history.push({ role: "staff", text: message.content });
        setSession(channel.id, { ...session, conversationHistory: history });
        return;
      }
    }

    if (intent.type === "handover") {
      setSession(channel.id, { ...session, status: "autonomous" });
      await channel.sendTyping().catch(() => null);
      await new Promise(r => setTimeout(r, 600));
      await channel.send("Ricevuto, continuo io.");
      history.push({ role: "staff", text: message.content });
      history.push({ role: "bot", text: "Ricevuto, continuo io." });

      // Se non è stato ancora richiesto lo screenshot, richiedilo
      if (session.state === "questioning") {
        await channel.send(`Per procedere con la verifica, inserisci il link ${ROOMUP_INVITE} nel tuo server in un canale visibile e mandami uno screenshot qui.`);
        setSession(channel.id, { ...session, state: "awaiting_screenshot", conversationHistory: history, status: "autonomous" });
      } else {
        setSession(channel.id, { ...session, conversationHistory: history, status: "autonomous" });
      }
      return;
    }

    if (intent.type === "revoke") {
      await channel.sendTyping().catch(() => null);
      await new Promise(r => setTimeout(r, 600));

      // Se era stata approvata e postata, revoca la partnership dai dati e dai canali
      const { loadPartners, savePartners } = require("./partnershipEngine");
      const partnersData = loadPartners();
      const activePartner = (partnersData.partners || []).find(p => p.originGuildId === message.guild.id && p.collaboratorId === session.userId && !p.deleted);
      if (activePartner) {
        activePartner.deleted = true;
        activePartner.deletedAt = new Date().toISOString();
        activePartner.deletedBy = message.author.tag;
        activePartner.deleteReason = intent.reason;
        for (const m of (activePartner.messages || [])) {
          try {
            const g = message.client.guilds.cache.get(m.guildId);
            const ch = g?.channels?.cache.get(m.channelId);
            if (ch) ch.messages.delete(m.messageId).catch(() => {});
          } catch(e) {}
        }
        savePartners(partnersData);
      }

      await channel.send("Ricevuto, revoco l'approvazione immediata.");
      await channel.send(`<@${session.userId}>, lo screenshot inviato non è idoneo perché non mostra l'intera schermata con data e interfaccia completa di Discord. Per favore mandane uno a schermo intero dove sia visibile tutto il contesto.`);

      setSession(channel.id, {
        ...session,
        state: "awaiting_screenshot",
        status: "autonomous",
        conversationHistory: history
      });
      return;
    }

    if (intent.type === "directive") {
      await channel.sendTyping().catch(() => null);
      const prompt = `Sei RoomUp!, staff del server Discord. Un membro superiore dello staff (${message.author.username}) ti ha dato questa istruzione: "${intent.instruction}".

Il tuo compito è rivolgerti DIRETTAMENTE in seconda persona ("tu") all'utente che ha aperto il ticket per chiedergli quanto richiesto dallo staff.
REGOLE TASSATIVE:
- NON iniziare MAI con "chiedigli", "chiedi a", "digli", "fagli". Devi parlare direttamente all'utente dicendo ad esempio: "Puoi mandare...", "Riusciresti a...", "Potresti fornirci...".
- Zero emoji.
- Naturale, educato, max 2 righe.
- NON menzionare che è un ordine dello staff.

Scrivi ESCLUSIVAMENTE il messaggio da inviare all'utente:`;
      let text = await callGeminiWithRotation(prompt);
      if (!text) {
        // Fallback pulito: rimuove il verbo imperativo iniziale dello staff
        let cleaned = intent.instruction.replace(/^(chiedigli di|chiedigli|digli di|digli|chiedi a|fagli|spiegagli di|spiegagli)\s+/i, "");
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
        text = `Puoi ${cleaned}?`;
      }
      await channel.send(text);
      history.push({ role: "staff", text: message.content });
      history.push({ role: "bot", text: text });
      setSession(channel.id, { ...session, conversationHistory: history });
      return;
    }

    // Staff Command, Inquiry or Direct Address (e.g. "@RoomUp! che succede", "chiudi", "ricorda", "status")
    if (intent.type === "staff_command_or_inquiry") {
      await channel.sendTyping().catch(() => null);
      const normContent = (message.content || "").toLowerCase().trim();
      const staffPrefix = senderIsOwner ? "Ciao Frè" : `Ciao ${message.author.username}`;

      // Close ticket
      if (/\b(chiudi|chiudi ticket|risolvi ticket|archivia ticket|!close|\/close)\b/i.test(normContent)) {
        const reply = `${staffPrefix}, procedo subito a segnare il ticket come risolto e ad archiviarlo.`;
        await channel.send(reply).catch(() => null);
        try {
          const { defaultToolEngine } = require("../sentinel");
          await defaultToolEngine.executeTool("close_ticket", {
            channelId: channel.id,
            guildId: session.guildId,
            reason: "Chiusura su richiesta staff",
            closedBy: message.author.username
          }, { guildId: session.guildId, channelId: channel.id, userId: message.author.id });
        } catch (e) {}
        history.push({ role: "staff", text: message.content });
        history.push({ role: "bot", text: reply });
        setSession(channel.id, { ...session, conversationHistory: history, state: "completed" });
        return;
      }

      // Rule commands
      if (/\b(mostra regole|quali regole ricordi|cosa ricordi|lista regole|regole memorizzate|!learn lista|\/learn lista)\b/i.test(normContent)) {
        const rules = defaultMemoryEngine.getLearnedRules(session.guildId);
        const reply = rules.length === 0
          ? `${staffPrefix}, al momento non ci sono regole personalizzate memorizzate per questo server.`
          : `${staffPrefix}, ecco le regole memorizzate nel sistema:\n` + rules.slice(-8).map((r, idx) => `${idx + 1}. [${r.category}] "${r.rule}"`).join("\n");
        await channel.send(reply).catch(() => null);
        return;
      }

      if (/\b(per questo tipo di problema chiediamo sempre|quando succede questo problema chiediamo sempre|quando succede questo problema|regola per questo problema|ricorda che|ricordati che|ricordati vedere sempre|ricorda di vedere sempre|ricordati di|ricorda di|ricordati sempre|ricorda sempre|ricordati|ricorda|impara che|impara|tieni a mente che|tieni a mente|non dimenticare di|non dimenticare che|non dimenticare|controlla sempre che|controlla sempre|verifica sempre che|verifica sempre|assicurati che|assicurati di|fai attenzione a|fai attenzione che|attento a|non sia nsfw|contenuti brutti|salva la regola|nuova regola|!learn|\/learn)\b/i.test(normContent)) {
        let cleaned = message.content
          .replace(/<@!?\d+>/g, "")
          .replace(/@roomup!?/gi, "")
          .replace(/@sentinel/gi, "")
          .replace(/^[!/]?learn(?:\s+imposta)?\s*/i, "")
          .replace(/^.*?\b(per questo tipo di problema chiediamo sempre|quando succede questo problema chiediamo sempre|quando succede questo problema|regola per questo problema|ricorda che|ricordati che|ricordati vedere sempre|ricorda di vedere sempre|ricordati di|ricorda di|ricordati sempre|ricorda sempre|ricordati|ricorda|impara che|impara|tieni a mente che|tieni a mente|non dimenticare di|non dimenticare che|non dimenticare|controlla sempre che|controlla sempre|verifica sempre che|verifica sempre|assicurati che|assicurati di|fai attenzione a|fai attenzione che|attento a|salva la regola|nuova regola)\s*/i, "")
          .replace(/\b(?:se capisci|capito\??|ok\??|grazie|per favore|mi raccomando)\b[.!?\s]*$/i, "")
          .trim();
        if (/^che\s+/i.test(cleaned)) cleaned = cleaned.replace(/^che\s+/i, "").trim();

        if (cleaned.length > 3) {
          defaultMemoryEngine.addLearnedRule(session.guildId, {
            rule: cleaned,
            category: "PARTNERSHIP",
            author: message.author.username,
            source: `ticket_${channel.name}`
          });
          defaultKnowledgeEngine.addKnowledgeItem(session.guildId, {
            category: "PARTNERSHIP",
            title: `Regola partnership da ${message.author.username}`,
            content: cleaned,
            author: message.author.username,
            source: `ticket_${channel.name}`
          });

          const isNsfwRule = /nsfw|brutt|inappropriat/i.test(message.content);
          const reply = isNsfwRule
            ? `Ricevuto ${staffPrefix}! Ho memorizzato la direttiva: verificherò sempre che i server partner non abbiano contenuti NSFW o inappropriati prima di procedere con la partnership.`
            : `Ricevuto ${staffPrefix}! Ho registrato e memorizzato questa regola per le partnership:\n"${cleaned}"\nLa applicherò per i prossimi controlli.`;

          await channel.send(reply).catch(() => null);
          history.push({ role: "staff", text: message.content });
          history.push({ role: "bot", text: reply });
          setSession(channel.id, { ...session, conversationHistory: history });
          return;
        }
      }

      // Goal commands
      if (/\b(mostra obiettivi|quali sono gli obiettivi|lista obiettivi|obiettivi attivi|!goal lista|\/goal lista)\b/i.test(normContent)) {
        const goals = defaultMemoryEngine.getGoals(session.guildId, "all");
        const reply = goals.length === 0
          ? `${staffPrefix}, non ci sono obiettivi registrati al momento.`
          : `${staffPrefix}, ecco gli obiettivi attivi del server:\n` + goals.map((g, idx) => `${idx + 1}. [${g.status}] **${g.title}**`).join("\n");
        await channel.send(reply).catch(() => null);
        return;
      }

      if (/\b(completa obiettivo|segna come completato|!goal completa|\/goal completa)\b/i.test(normContent)) {
        const cleaned = message.content.replace(/^.*?\b(completa obiettivo|segna come completato|!goal completa|\/goal completa)\s*/i, "").trim();
        if (cleaned.length > 0) {
          const comp = defaultMemoryEngine.completeGoal(session.guildId, cleaned);
          const reply = comp ? `🎉 Obiettivo **"${comp.title}"** segnato come completato!` : `❌ Nessun obiettivo corrispondente a "${cleaned}".`;
          await channel.send(reply).catch(() => null);
          return;
        }
      }

      if (/\b(rimuovi obiettivo|elimina obiettivo|cancella obiettivo|!goal rimuovi|\/goal rimuovi)\b/i.test(normContent)) {
        const cleaned = message.content.replace(/^.*?\b(rimuovi obiettivo|elimina obiettivo|cancella obiettivo|!goal rimuovi|\/goal rimuovi)\s*/i, "").trim();
        if (cleaned.length > 0) {
          const rem = defaultMemoryEngine.removeGoal(session.guildId, cleaned);
          const reply = rem ? `🗑️ Obiettivo **"${rem.title}"** rimosso dalla memoria.` : `❌ Nessun obiettivo corrispondente a "${cleaned}".`;
          await channel.send(reply).catch(() => null);
          return;
        }
      }

      if (/\b(imposta obiettivo|nuovo obiettivo|aggiungi obiettivo|obiettivo:|\/goal imposta|!goal imposta|!goal|\/goal)\b/i.test(normContent)) {
        const cleaned = message.content.replace(/^.*?\b(imposta obiettivo|nuovo obiettivo|aggiungi obiettivo|obiettivo:|\/goal imposta|!goal imposta|!goal|\/goal)\s*/i, "").trim();
        if (cleaned.length > 3) {
          const g = defaultMemoryEngine.addGoal(session.guildId, {
            title: cleaned,
            details: `Impostato da ${message.author.username} in #${channel.name}`,
            createdBy: message.author.username
          });
          const reply = `Obiettivo registrato con successo: **${g.title}** (ID: \`${g.id}\`). È ora attivo e monitorato.`;
          await channel.send(reply).catch(() => null);
          history.push({ role: "staff", text: message.content });
          history.push({ role: "bot", text: reply });
          setSession(channel.id, { ...session, conversationHistory: history });
          return;
        }
      }

      // Boost commands
      if (/\b(stato boost|boost status|!boost status)\b/i.test(normContent)) {
        const b = defaultMemoryEngine.getBoostMode(session.guildId);
        const reply = b.enabled
          ? `Modalità Boost attiva: **${b.mode}** (impostata da ${b.setBy || "Staff"}).`
          : "La modalità Boost è attualmente disattivata.";
        await channel.send(reply).catch(() => null);
        return;
      }

      if (/\b(boost|attiva boost|\/boost|!boost)\b/i.test(normContent)) {
        let mode = "deep_reasoning";
        if (normContent.includes("max_autonomy") || normContent.includes("autonomia")) mode = "max_autonomy";
        else if (normContent.includes("speed") || normContent.includes("velocit")) mode = "speed";
        else if (normContent.includes("strict") || normContent.includes("audit")) mode = "strict_audit";

        defaultMemoryEngine.setBoostMode(session.guildId, {
          mode,
          setBy: message.author.username,
          durationMinutes: 120
        });
        const reply = `Modalità **${mode} Boost** attivata per 120 minuti da ${message.author.username}.`;
        await channel.send(reply).catch(() => null);
        return;
      }

      // Grill-Me command
      if (/\b(grill-me|grill me|!grill-me|\/grill-me)\b/i.test(normContent)) {
        const topic = message.content.replace(/^.*?\b(grill-me|grill me|!grill-me|\/grill-me)\s*/i, "").trim() || "Partnership & Crescita Community";
        const firstQ = `Iniziamo la sessione Grill-Me su "${topic}". Qual è il presupposto fondamentale su cui si basa questa partnership e come verificheresti se il traffico generato è autentico o bot?`;
        defaultMemoryEngine.startGrillSession(session.guildId, channel.id, message.author.id, { topic, initialQuestion: firstQ });
        const reply = `🔥 **Sessione Socratic Grill-Me Avviata (Round 1/5)**\n**Tema:** ${topic}\n\n${firstQ}\n\n*Rispondi qui in chat per proseguire o scrivi 'stop' per interrompere.*`;
        await channel.send(reply).catch(() => null);
        return;
      }

      // Official partnership description saving
      if (/\b(questa [eè] la nostra descrizione|ecco la nostra descrizione|descrizione nostra|nostro annuncio|salva descrizione)\b/i.test(normContent)) {
        let descText = message.content.replace(/^.*?\b(questa [eè] la nostra descrizione|ecco la nostra descrizione|descrizione nostra|nostro annuncio|salva descrizione)\s*[:\n-]?\s*/i, "").trim();
        if (!descText || descText.length < 15) {
          const staffHistory = history.filter(h => h.role === "staff");
          const prevMsg = staffHistory[staffHistory.length - 1]?.text;
          if (prevMsg && prevMsg.length > 20) {
            descText = prevMsg;
          }
        }
        if (descText && descText.length > 15) {
          defaultMemoryEngine.setOfficialPartnershipDescription(session.guildId, descText);
          const reply = `${staffPrefix}, ho salvato e memorizzato la nostra descrizione ufficiale per le partnership nel sistema.`;
          await channel.send(reply).catch(() => null);
          history.push({ role: "staff", text: message.content });
          history.push({ role: "bot", text: reply });
          setSession(channel.id, { ...session, conversationHistory: history });
          return;
        }
      }

      // Status briefing inquiry
      if (!intent.isStatusInquiry) {
        history.push({ role: "staff", text: message.content });
        setSession(channel.id, { ...session, conversationHistory: history });
        return;
      }

      const isPub = session.state === "completed" || Boolean(session.approvedPartnerNumber) || Boolean(session.published);
      const userMention = session.userId ? `<@${session.userId}>` : "l'utente";
      let statusText = "";
      if (isPub) {
        statusText = `la procedura di partnership con ${userMention} è completata e la partnership è già stata registrata e pubblicata ufficialmente${session.approvedPartnerNumber ? ` (Partnership #${session.approvedPartnerNumber})` : ""}`;
      } else if (session.partnerDescription) {
        statusText = `abbiamo la descrizione per la partnership con ${userMention}; siamo in attesa dello screenshot verificato a schermo intero`;
      } else {
        statusText = `siamo all'inizio della procedura con ${userMention}; stiamo attendendo lo screenshot a schermo intero dell'invito RoomUp pubblicato nel loro canale partnership`;
      }
      const reply = `${staffPrefix}, ecco la situazione: ${statusText}. Sto monitorando la conversazione e rimango pronto a eseguire le tue direttive.`;
      await channel.send(reply).catch(() => null);
      history.push({ role: "staff", text: message.content });
      history.push({ role: "bot", text: reply });
      setSession(channel.id, { ...session, conversationHistory: history });
      return;
    }

    // Staff che parla normalmente -> Apprendimento live
    const lastUserMsg = history.filter(h => h.role === "user").slice(-1)[0]?.text || "";
    recordStaffActionLive(session.guildId, "partnership", lastUserMsg, message.content);
    history.push({ role: "staff", text: message.content });
    setSession(channel.id, { ...session, conversationHistory: history });
    return;
  }

  // 2. GESTIONE UTENTE / SEGUITO
  history.push({ role: "user", text: message.content });

  // Se lo staff ha preso in mano, il bot non interviene
  if (session.status === "staff_handling") {
    setSession(channel.id, { ...session, conversationHistory: history });
    return;
  }

  // A. Verifica se la partnership è già completata o pubblicata
  const isAlreadyPublished = session.state === "completed" || Boolean(session.approvedPartnerNumber) || Boolean(session.published);
  if (isAlreadyPublished) {
    const pNum = session.approvedPartnerNumber ? ` #${session.approvedPartnerNumber}` : "";
    const content = (message.content || "").trim();

    const isAnnouncingQuestion = /\b(domand[ae]|dkamnd[ae]|chiedere|chiarimento|dubbio|posso|ascolta|dimmi|help|aiuto|info|informazion[ie])\b/i.test(content) &&
      !/\b(non (?:si )?vede|non (?:hai|ha) inviato|canale|link)\b/i.test(content);

    const asksAboutPublication = /\b(canale|dove|dov['eè]|non (?:si )?vede|non (?:hai|ha) inviato|perch[eéè]|quando|pubblicat[ao]|link|inviat[ao])\b/i.test(content) &&
      /\b(canale|partnership|pubblicat|inviat|postat|link|vedere|vede|chat)\b/i.test(content);

    const isClosing = /^(grazie|ok|va bene|perfetto|tutto a posto|a posto|ottimo|gentilissimo|buona giornata|buonasera|buon proseguimento|grazie mille)[.!]?$/i.test(content);

    let reply;
    if (isAnnouncingQuestion) {
      reply = "Certo, dimmi pure! Qual è la tua domanda?";
    } else if (asksAboutPublication) {
      reply = `La tua richiesta di partnership${pNum} è stata verificata ed è già stata pubblicata nel canale partnership. Se non la visualizzi nel canale, potrebbe essere dovuto ai permessi di visualizzazione o a un ritardo di aggiornamento di Discord. Ti confermo che è registrata correttamente nei nostri sistemi.`;
    } else if (isClosing) {
      reply = "Di nulla! Se non hai altre domande possiamo procedere alla chiusura del ticket, oppure rimaniamo a disposizione se ti serve altro.";
    } else {
      reply = `La tua partnership${pNum} è già stata approvata e pubblicata. Se hai bisogno di altro o hai una domanda, dimmi pure!`;
    }

    // Anti-repetition check
    const lastBotMsg = history.filter(h => h.role === "bot").slice(-1)[0]?.text || "";
    const normProposed = reply.toLowerCase().replace(/[^\w\s]/g, "").trim();
    const normLast = lastBotMsg.toLowerCase().replace(/[^\w\s]/g, "").trim();
    if (normLast && normProposed === normLast) {
      reply = "Ti ascolto, dimmi pure: qual è il tuo dubbio o cosa vorresti sapere? Sono qui per aiutarti.";
    }

    await channel.send(reply).catch(() => null);
    history.push({ role: "bot", text: reply });
    setSession(channel.id, { ...session, conversationHistory: history, state: "completed" });
    return;
  }

  // Se lo staff ha preso in mano, il bot non interviene
  if (session.status === "staff_handling") {
    setSession(channel.id, { ...session, conversationHistory: history });
    return;
  }

  // Stato: questioning
  if (session.state === "questioning") {
    await channel.sendTyping().catch(() => null);
    await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));

    const userMessages = history.filter(h => h.role === "user").length;
    let reply;

    if (userMessages >= 2) {
      reply = `Perfetto. Per procedere, pubblica il nostro link di invito ${ROOMUP_INVITE} nel canale partnership del tuo server. Quando lo hai inviato, mandami qui uno screenshot a schermo intero del client Discord (in cui si vedano chiaramente il canale partnership e la barra orario) e scrivimi il testo o la descrizione del tuo server con il link da pubblicare.`;
      setSession(channel.id, { ...session, state: "awaiting_screenshot", conversationHistory: history });
    } else {
      const historyText = history.map(h => `${h.role === "user" ? "Utente" : "RoomUp!"}: ${h.text}`).join("\n");
      const prompt = `Sei RoomUp!, staff Discord. Richiesta partnership per server da ${session.memberCount} membri.
Cronologia:
${historyText}
Fai UNA sola domanda naturale e breve di follow-up sulla community o attività del server. Zero emoji, max 2 righe.`;
      reply = await callGeminiWithRotation(prompt);
      if (!reply) reply = `Interessante, e quanto è attiva la community durante la giornata?`;
      history.push({ role: "bot", text: reply });
      setSession(channel.id, { ...session, conversationHistory: history });
    }
    await channel.send(reply);
    return;
  }

  // Stato: awaiting_screenshot
  if (session.state === "awaiting_screenshot") {
    const attachments = [...message.attachments.values()];
    const image = attachments.find(a => a.contentType?.startsWith("image/"));

    // Se l'utente scrive testo (es. descrizione o link) lo salviamo
    if (message.content && message.content.trim().length > 5) {
      session.partnerDescription = (session.partnerDescription ? session.partnerDescription + "\n" : "") + message.content.trim();
    }

    if (!image) {
      if (!session.partnerDescription) {
        await channel.sendTyping().catch(() => null);
        await new Promise(r => setTimeout(r, 800));
        await channel.send(`Per procedere manda lo screenshot a schermo intero del link ${ROOMUP_INVITE} pubblicato nel canale partnership del tuo server, e scrivi la descrizione che vuoi far pubblicare da noi.`);
      } else {
        await channel.sendTyping().catch(() => null);
        await new Promise(r => setTimeout(r, 800));
        await channel.send(`Ho salvato la tua descrizione. Ora mandami lo screenshot a schermo intero del messaggio con ${ROOMUP_INVITE} pubblicato nel canale partnership del tuo server.`);
      }
      setSession(channel.id, { ...session, conversationHistory: history });
      return;
    }

    setSession(channel.id, { ...session, state: "verifying", conversationHistory: history });
    await channel.sendTyping().catch(() => null);
    await channel.send("Ho ricevuto lo screenshot, sto verificando...");

    try {
      const imgBuffer = await downloadImage(image.url);
      const base64    = imgBuffer.toString("base64");
      const mimeType  = image.contentType || "image/png";

      if (!geminiVision) throw new Error("Vision non disponibile");

      const visionResult = await geminiVision.generateContent([
        { inlineData: { mimeType, data: base64 } },
        { text: `Sei un verificatore rigoroso di screenshot Discord per partnership.
Esamina l'immagine e valuta tassativamente:
1. È visibile il link "${ROOMUP_INVITE}" o la parola "roomup" in un messaggio Discord?
2. Lo screenshot è a SCHERMO INTERO (desktop o mobile completo con barra orario, finestra client, lista canali o barra superiore/inferiore) e NON un semplice ritaglio ravvicinato del messaggio?
3. Il canale in cui è stato inviato il link sembra essere un canale dedicato alle partnership/affiliazioni (e NON il canale chat generale)?

Rispondi rigorosamente in questo formato JSON (senza markdown):
{"linkVisible": boolean, "isFullScreen": boolean, "isPartnerChannel": boolean, "reason": "breve spiegazione in italiano"}` }
      ]);

      const rawText = visionResult.response.text().trim();
      let analysis = { linkVisible: false, isFullScreen: false, isPartnerChannel: false };
      try {
        const cleanJson = rawText.replace(/```json|```/g, "").trim();
        analysis = JSON.parse(cleanJson);
      } catch(je) {
        const lower = rawText.toLowerCase();
        analysis.linkVisible = lower.includes('"linkvisible": true') || lower.includes("linkvisible: true");
        analysis.isFullScreen = lower.includes('"isfullscreen": true') || lower.includes("isfullscreen: true");
        analysis.isPartnerChannel = lower.includes('"ispartnerchannel": true') || lower.includes("ispartnerchannel: true");
      }

      const isValid = analysis.linkVisible && analysis.isFullScreen && analysis.isPartnerChannel;

      if (isValid) {
        // Se non abbiamo ancora la descrizione, chiediamola prima di pubblicare
        if (!session.partnerDescription) {
          await channel.sendTyping().catch(() => null);
          await channel.send(`Screenshot verificato con successo a schermo intero. Ora inviami la descrizione o il link del tuo server che vuoi che RoomUp pubblichi nel canale partnership.`);
          setSession(channel.id, { ...session, state: "awaiting_description", conversationHistory: history });
          return;
        }

        await approvePartnership(channel, session, message.guild, session.partnerDescription);
      } else {
        await channel.sendTyping().catch(() => null);
        let feedback = "Lo screenshot non è idoneo:";
        if (!analysis.linkVisible) {
          feedback += " non vedo il link di invito a RoomUp nel messaggio.";
        } else if (!analysis.isFullScreen) {
          feedback += " serve uno screenshot a schermo intero dell'intera applicazione Discord con orario e interfaccia completa, non un ritaglio.";
        } else if (!analysis.isPartnerChannel) {
          feedback += " il link deve essere pubblicato nel canale partnership del tuo server, non nel canale generale.";
        } else {
          feedback += " " + (analysis.reason || "assicurati che mostri l'intero schermo e il canale partnership corretto.");
        }
        await channel.send(feedback);
        setSession(channel.id, { ...session, state: "awaiting_screenshot", conversationHistory: history });
      }
    } catch (e) {
      console.error("[SentinelAI-Ticket] Errore analisi immagine:", e.message);
      // Notifica e pinga il ruolo staff/partnership configurato
      let staffPing = "";
      try {
        const settings = JSON.parse(fs.readFileSync(path.join(__dirname, "../../data/settings.json"), "utf8"));
        const partnerStaffRole = settings[message.guild.id]?.partnerships?.staffRoleIds?.[0] || "1550846898850631730";
        if (partnerStaffRole) staffPing = ` <@&${partnerStaffRole}>`;
      } catch(se) {}
      await channel.send(`Non sono riuscito a verificare l'immagine in automatico.${staffPing} Uno staff le darà un'occhiata manuale a breve.`);
      setSession(channel.id, { ...session, state: "awaiting_manual", conversationHistory: history });
    }
    return;
  }

  // Stato: awaiting_description
  if (session.state === "awaiting_description") {
    const hasInvite = /discord\.gg\/|discord\.com\/invite\/|https?:\/\//i.test(message.content || "");
    const isQuestion = (message.content || "").includes("?") || /^(perch[eè]|come|dove|quando|cosa|chi|perche|perchè|non hai|ma|scusa|perche non)\b/i.test(message.content || "");
    if (isQuestion && !hasInvite) {
      await channel.sendTyping().catch(() => null);
      await channel.send("Lo screenshot è già stato verificato con successo. Per procedere alla pubblicazione finale nel nostro canale partnership, inviaci la descrizione del tuo server con il link di invito permanente.");
      return;
    }
    if (message.content && (hasInvite || message.content.trim().length > 25)) {
      session.partnerDescription = message.content.trim();
      await approvePartnership(channel, session, message.guild, session.partnerDescription);
      return;
    } else {
      await channel.sendTyping().catch(() => null);
      await channel.send("Inserisci una descrizione valida o il messaggio promozionale con il link del tuo server da pubblicare.");
      return;
    }
  }
}

async function approvePartnership(channel, session, guild, partnerDescription) {
  if (session.state === "completed" || session.approvedPartnerNumber || session.published) {
    await channel.send(`La partnership #${session.approvedPartnerNumber || ""} è già stata registrata e pubblicata ufficialmente.`);
    return;
  }
  const { executePublishPartnership } = require("./partnershipEngine");

  await channel.sendTyping().catch(() => null);
  await new Promise(r => setTimeout(r, 1000));

  let publishedInfo = null;
  try {
    const member = await guild.members.fetch(session.userId).catch(() => null);
    const tag = member?.user?.tag || session.userId;

    const descToPublish = partnerDescription || session.partnerDescription || `Partnership con la community di <@${session.userId}> (${session.memberCount} membri).`;

    publishedInfo = await executePublishPartnership(
      guild.client,
      () => {
        try {
          return JSON.parse(fs.readFileSync(path.join(__dirname, "../../data/settings.json"), "utf8"));
        } catch(e) { return {}; }
      },
      {
        originGuildId: guild.id,
        originGuildName: guild.name,
        collaboratorId: session.userId,
        collaboratorTag: tag,
        authorId: "SentinelAI",
        description: descToPublish
      }
    );
  } catch (e) {
    console.error("[SentinelAI-Ticket] Errore pubblicazione partnership:", e.message);
  }

  setSession(channel.id, {
    ...session,
    state: "completed",
    status: "autonomous",
    approvedPartnerNumber: publishedInfo ? publishedInfo.partnerNum : null
  });

  const successMsg = publishedInfo && publishedInfo.sentMessages.length > 0
    ? `Tutto a posto! La partnership #${publishedInfo.partnerNum} è stata pubblicata ufficialmente nel canale partnership con la tua descrizione. Benvenuti nel network di RoomUp!\n\nRoomUp!`
    : `Lo screenshot è verificato. La partnership verrà pubblicata a breve da uno staff. Benvenuti!\n\nRoomUp!`;

  await channel.send(successMsg);
}

// ─── RISPOSTA INIZIALE TICKET ────────────────────────────────
async function respondToTicket(ticketChannel, categoryKey, categoryLabel, modalAnswers = {}, guildId, userId) {
  try {
    const guildMem = getGuildMemory(guildId);
    const catMem   = guildMem?.[categoryKey];

    // Partnership -> flusso stateful dedicato
    if (categoryKey === "partnership") {
      const memberCount = Object.values(modalAnswers)[0] || "non specificato";
      await startPartnershipFlow(ticketChannel, memberCount, userId, guildId);
      return;
    }

    // Altre categorie -> Registra sessione attiva e invia risposta iniziale
    setSession(ticketChannel.id, {
      status: "autonomous",
      guildId,
      userId,
      categoryKey,
      conversationHistory: [
        { role: "user", text: `Richiesta iniziale (${categoryLabel}): ` + Object.entries(modalAnswers).map(([k,v]) => `${k}: ${v}`).join(" | ") }
      ]
    });

    await ticketChannel.sendTyping().catch(() => null);
    
    // Genera risposta usando la memoria specifica di questa guild
    const initialReply = await generateAutonomousReply(
      guildId,
      categoryKey,
      getSession(ticketChannel.id)?.conversationHistory || [],
      `L'utente ha appena aperto il ticket fornendo questi dati iniziali: ${JSON.stringify(modalAnswers)}`
    );

    const finalText = initialReply || "Ciao, ho preso in carico la tua richiesta. Di cosa hai bisogno esattamente?\n\nRoomUp!";

    await new Promise(r => setTimeout(r, 1200));

    if (catMem) {
      catMem.totalHandled = (catMem.totalHandled || 0) + 1;
      saveGuildMemory(guildId, guildMem);
    }

    const dismissBtn = new ButtonBuilder()
      .setCustomId(`ai_ticket_dismiss_${ticketChannel.id}`)
      .setLabel("Nascondi")
      .setStyle(ButtonStyle.Secondary);

    await ticketChannel.send({
      content: finalText,
      components: [new ActionRowBuilder().addComponents(dismissBtn)]
    });

    // Registra risposta bot nella history
    const s = getSession(ticketChannel.id);
    if (s) {
      s.conversationHistory.push({ role: "bot", text: finalText });
      setSession(ticketChannel.id, s);
    }

  } catch (e) {
    console.error("[SentinelAI-Ticket] Errore risposta automatica:", e.message);
  }
}

// ─── APPRENDIMENTO A CHIUSURA TICKET ─────────────────────────
function learnFromTranscript(guildId, categoryKey, transcript, staffMessages = []) {
  if (!categoryKey || !guildId) return;
  const mem = loadMemory();
  if (!mem[guildId]) mem[guildId] = getGuildMemory(guildId);
  if (!mem[guildId][categoryKey]) mem[guildId][categoryKey] = { precedents: [], learnedResponses: [], totalHandled: 0 };

  const catMem = mem[guildId][categoryKey];
  staffMessages.forEach(msg => {
    if (!msg || msg.length < 15) return;
    const words = transcript.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/)
      .filter(w => w.length > 4 && !["della","dello","degli","nelle","sono","siamo","avere","questo","quella"].includes(w));
    const keywords = [...new Set(words)].slice(0, 8);
    if (!catMem.learnedResponses.find(lr => lr.response === msg.slice(0, 400))) {
      catMem.learnedResponses.push({
        id: `lr_${Date.now()}`,
        keywords,
        response: msg.slice(0, 400),
        usageCount: 0,
        learnedAt: new Date().toISOString()
      });
      if (catMem.learnedResponses.length > 50) {
        catMem.learnedResponses.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
        catMem.learnedResponses = catMem.learnedResponses.slice(0, 50);
      }
    }
  });

  catMem.precedents.push({ id: `prec_${Date.now()}`, categoryKey, closedAt: new Date().toISOString() });
  if (catMem.precedents.length > 100) catMem.precedents = catMem.precedents.slice(-100);
  mem[guildId][categoryKey] = catMem;
  saveMemory(mem);
  console.log(`[SentinelAI-Ticket] Appreso a chiusura transcript per guild ${guildId} [${categoryKey}]`);
}

// ─── INIT LISTENER GLOBALE PER TUTTI I TICKET ────────────────
function initAiTicketEngine(client) {
  initGeminiKeys();

  client.on("messageCreate", async (message) => {
    if (client._sentinelActive) return;
    if (message.author.bot || !message.guild) return;
    // CRITICAL GUARD: never execute ticket logic on voice or stage channels
    const chType = message.channel?.type;
    if (chType === 2 || chType === "GUILD_VOICE" || chType === 13 || chType === "GUILD_STAGE_VOICE") return;

    // Gestione solo all'interno di canali ticket attivi
    let session = getSession(message.channel.id);
    if (!session && (message.channel.name?.startsWith("ticket-") || message.channel.parent?.name?.toLowerCase().includes("ticket"))) {
      // Ricostruisci sessione base dal topic del canale
      const topic = message.channel.topic || "";
      const userMatch = topic.match(/\((\d{17,20})\)/);
      const isPart = topic.toLowerCase().includes("partnership");
      session = {
        status: "autonomous",
        state: isPart ? "awaiting_screenshot" : "active",
        guildId: message.guild.id,
        userId: userMatch ? userMatch[1] : "",
        categoryKey: isPart ? "partnership" : "general",
        memberCount: "N/D",
        conversationHistory: []
      };
      setSession(message.channel.id, session);
    }
    if (!session) return;

    if (session.categoryKey === "partnership") {
      await handlePartnershipMessage(message, session);
    } else {
      await handleGeneralTicketMessage(message, session);
    }
  });

  // Listener eliminazione canali per pulire le sessioni
  client.on("channelDelete", (channel) => {
    deleteSession(channel.id);
  });

  // Bottone "Nascondi"
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("ai_ticket_dismiss_")) return;
    try {
      await interaction.message.delete().catch(() => null);
      await interaction.reply({ content: "Messaggio nascosto.", flags: MessageFlags.Ephemeral }).catch(() => null);
    } catch (e) {}
  });

  console.log("[SentinelAI-Ticket] Assistente AI Ticket attivo con supporto gerarchico, subentro e apprendimento live!");
}

function notifyTicketClaimed(channelId, staffUser) {
  const session = getSession(channelId);
  if (session) {
    session.status = "staff_handling";
    session.conversationHistory = session.conversationHistory || [];
    session.conversationHistory.push({
      role: "staff",
      text: `[Staff @${staffUser.username} ha preso in carico il ticket con il pulsante claim]`
    });
    setSession(channelId, session);
    console.log(`[SentinelAI-Ticket] Ticket ${channelId} preso in carico da @${staffUser.username}`);
  }
}

module.exports = {
  initAiTicketEngine,
  respondToTicket,
  learnFromTranscript,
  notifyTicketClaimed,
  getGuildMemory,
  handlePartnershipMessage,
  handleGeneralTicketMessage,
  analyzeStaffIntent,
  isStaffMember,
  isOwner
};
