/**
 * SENTINEL AI — STAFF CANDIDATE & SCREENSHARE (SS) FORENSIC INTELLIGENCE ENGINE
 * 
 * Modulo dedicato per la gestione autonoma e ultra-intelligente delle candidature staff:
 * - Conoscenza forense avanzata di ScreenShare (SS) Minecraft (AnyDesk, Prefetch, BAM, UserAssist, Process Hacker javaw strings, USN Journal, Echo, Paladin).
 * - Conoscenza profonda del server SMP RoomUp! × YouTuberMC (Paper 1.21.x, /menu, /shop, /ah, Spawners, Casse Mitiche, Claims, Combat Tag, Simple Voice Chat, Oraxen).
 * - Conoscenza di moderazione Discord (Anti-Raid, Anti-Nuke, gestione conflitti, de-escalation, riservatezza).
 * - Flusso di colloquio e provino tecnico a step progressivi con scoring automatico e report diagnostico per lo Staff.
 */

const { EmbedBuilder } = require("discord.js");

// ============================================================================
// 1. DATABASE CONOSCENZA FORENSE SCREENSHARE (SS) MINECRAFT
// ============================================================================
const SS_FORENSICS_KNOWLEDGE = {
  // Protocollo di Freeze e Contatto
  freezeProtocol: {
    command: "/ss <player> o /freeze <player>",
    countdownSeconds: 180, // 3 minuti per entrare in vocale
    voiceChannelName: "🎧 〢 Supporto (SU RICHIESTA)",
    voiceChannelId: "1563174298305306704",
    rules: [
      "Disconnessione durante il freeze (logout/combat-log) = Ban immediato per Rifiuto Controllo / Slog.",
      "Crash non dimostrato con crash-report o log verificabile = Trattato come disconnessione volontaria.",
      "Modifica, spostamento o cancellazione di file durante il freeze = Ban per Ammissione / Manomissione Prove.",
      "Rifiuto di scaricare AnyDesk o di fornire le credenziali = Ban per Rifiuto Controllo."
    ],
    privacyLimits: [
      "Lo staffer DEVE limitarsi a Minecraft e ai file di sistema attinenti al gioco.",
      "È TASSATIVAMENTE VIETATO aprire gallerie fotografiche, cartelle personali, chat private (WhatsApp, Telegram, Discord DM) o cronologia browser non attinente.",
      "Lo staffer deve spiegare ogni operazione che compie sullo schermo dell'utente."
    ]
  },

  // Controlli In-Game & Client
  inGameChecks: {
    guiKeys: ["Right Shift (RShift)", "Left Shift", "Insert", "RControl", "Tasti Freccia"],
    chatHistoryCheck: "Premere 'T' in chat e scorrere con Freccia Su per visualizzare i comandi precedentemente inviati (es. .unload, .destruct, .bind, .vape, .drip, .c).",
    debugF3: "Controllo schermata F3: verificare versione client, presenza di loader modificati (Fabric/Forge), allocazione memoria RAM, risoluzione.",
    resourcePacks: "Controllo cartella Resource Packs: verificare che non vi siano pack con x-ray nascosto o file zip contenenti script malevoli.",
    modsFolder: "Cartella %appdata%\\.minecraft\\mods: ordinare per Data Ultima Modifica, controllare estensioni e integrità degli archivi .jar con software zip."
  },

  // Forensics del Sistema Operativo Windows
  windowsForensics: {
    prefetch: {
      path: "C:\\Windows\\Prefetch",
      description: "Cartella di Windows che memorizza file .pf per ogni eseguibile avviato nel sistema.",
      technique: "Ordinare i file per 'Ultima modifica'. Se un cheat, un autoclicker o un cleaner (.bat/.exe) è stato aperto anche solo per pochi secondi prima del freeze, comparirà il relativo file .pf."
    },
    bamRegistry: {
      key: "HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\bam\\State\\UserSettings\\<SID>",
      description: "Background Activity Moderator (BAM): registra in modo persistente e protetto da Windows l'esecuzione dei file .exe con percorso completo e timestamp.",
      technique: "È uno dei registri più efficaci per smascherare chi ha cancellato o rinominato il cheat dopo averlo eseguito. Il path originario rimane registrato."
    },
    userAssist: {
      key: "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\UserAssist",
      description: "Memorizza le applicazioni avviate tramite la GUI di Windows Explorer (cifrate con algoritmo ROT13).",
      technique: "Decodificando i valori ROT13, rivela quando e quante volte un eseguibile o loader è stato aperto dal desktop o dalle cartelle."
    },
    tempAndRecent: {
      paths: ["%temp%", "%appdata%\\Microsoft\\Windows\\Recent", "%userprofile%\\Downloads"],
      technique: "Ricerca di file temporanei residui, file .tmp orfani, script di self-destruct (.bat/.ps1) o installer scaricati di recente dal browser."
    },
    usnJournal: {
      toolOrCommand: "fsutil usn queryjournal c: / JournalScan",
      description: "Registro a basso livello del file system NTFS di Windows.",
      technique: "Traccia la cronologia delle modifiche e CANCELLAZIONI dei file sul disco. Permette di dimostrare se l'utente ha eliminato una DLL, un file .jar o un eseguibile negli ultimi minuti prima o durante il controllo."
    }
  },

  // Analisi Processi & Memoria RAM (Process Hacker)
  processMemory: {
    targetProcess: "javaw.exe",
    tools: ["Process Hacker 2", "Process Explorer", "Strings (Sysinternals)"],
    ghostClientsKnown: [
      "Vape V4", "Vape Lite", "Drip Lite", "Raven B+", "Raven B++",
      "Whiteout", "Slinky", "Entropy", "Sloth", "Kura", "Doomsday",
      "Insertion", "Dream", "Lithium", "Yukio", "Juul", "Meteor", "Aristois"
    ],
    searchStrings: [
      "vape", "vapelite", "drip", "driplite", "raven", "whiteout",
      "slinky", "entropy", "autoclicker", "reach", "velocity",
      "aimassist", "hitbox", "fastplace", "silentaim", "bhop", "killaura"
    ],
    dllHandles: "Controllo delle DLL iniettate nel processo javaw.exe alla ricerca di librerie non native o firmate da fonti sconosciute."
  },

  // Scanner Automatici Community SS
  automatedTools: [
    { name: "Echo", desc: "Tool automatizzato di scansione memoria, registri e file system per controlli hack Minecraft." },
    { name: "Paladin", desc: "Software di forensic per individuare cheat in memoria, ghost client e cleaners." },
    { name: "Bamboo", desc: "Tool SS per analisi approfondita di prefeth, registri BAM e recent file." },
    { name: "Everything (Voidtools)", desc: "Software di indicizzazione istantanea per ricercare file .exe, .jar, .dll sul computer." }
  ],

  // Autoclicker, Macro e Periferiche
  clickersAndMacros: {
    standAloneAutoclickers: ["OP AutoClicker", "SpeedAutoClicker", "Mango AutoClicker", "GS AutoClicker"],
    mouseSoftware: [
      "Razer Synapse (profili macro, turbo click)",
      "Logitech G Hub (script LUA o macro ripetute a intervallo fisso)",
      "Glorious Core (modifica debounce time a 0ms per drag click / butterfly click)",
      "Bloody Mouse Software (core 3/4 recoil suppression e macro click)"
    ],
    cpsConsistencyCheck: "Un utente legittimo presenta variazioni naturali nei CPS (es. oscillazione tra 10 e 15 CPS). Valori perfettamente fissi (es. 14.0 CPS spaccati senza deviazione standard) o click attivi mentre si aprono casse/inventario indicano autoclicker."
  },

  // Gestione Falsi Positivi
  falsePositivesGuide: [
    "La libreria lwjgl.dll è un componente legittimo di Minecraft/Java, non è un cheat.",
    "File di cache di Discord, NVIDIA, shader pack o texture pack possono contenere stringhe complesse che assomigliano a hook: non bannare senza prove concrete di moduli hack.",
    "Mod legali (OptiFine, Sodium, Iris, Simple Voice Chat, JourneyMap) non devono essere sanzionate."
  ]
};

// ============================================================================
// 2. DATABASE CONOSCENZA ROOMUP! × YOUTUBERMC SMP
// ============================================================================
const ROOMUP_SMP_KNOWLEDGE = {
  serverCore: "Paper / Leaf 1.21.x (Java 21) ottimizzato per 20.0 TPS stabili.",
  branding: "Fusione tra l'eleganza di RoomUp! (rosa e viola) e la dinamicità dei creator di YouTuberMC (rosso e bianco).",
  navigationHub: "Comando centrale unificato /menu per accedere a tutte le funzioni con pulsanti Home e Indietro (zero inventari caotici).",
  economy: {
    shop: "/shop diviso in Blocchi, Agricoltura, Minerali, Equipaggiamento, Spawner con prezzi calibrati anti-inflazione.",
    auctionHouse: "/ah (Auction House) con 0% tassa di inserzione e solo il 2% di tassa sul venduto.",
    smartMarket: "Order Book con escrow per ordini automatici di acquisto.",
    quickSell: "/sell rapido e valutazione valore con /worth."
  },
  spawners: "Spawner per Pig, Zombie, Skeleton, Blaze, Iron Golem con upgrade di livello, velocità di spawn, Registro Raccolte e Chiavi Spawner.",
  crates: {
    tiers: ["Comune", "Non Comune", "Rara", "Epica", "Leggendaria", "Mitica"],
    legendaryHighlights: "Equipaggiamenti Netherite con enchant massimi (Sharpness V, Looting III, Sweeping Edge III, Protection IV, ecc.).",
    mythicHighlights: "Secchio Magico (Magic Bucket con acqua infinita) e Razzo Stellare Infinito (14 giorni di boost elitre con particelle stellari e suoni custom)."
  },
  teamsAndClaims: "Gang/Team con banca comune e fuoco amico; Claim chunk anti-griefing e anti-furto; viaggi con /home, /rtp sicuro e /tpa.",
  pvpMechanics: "Combattimento 1.9+ bilanciato con Combat Tag: blocco totale dei comandi durante il fight e morte istantanea in caso di combat-log.",
  technicalAddons: "Simple Voice Chat (prossimità vocale), Oraxen (texture, modelli e glifi custom), FancyNpcs e DecentHolograms allo spawn."
};

// ============================================================================
// 3. DATABASE MODERAZIONE DISCORD & STAFF ETIQUETTE
// ============================================================================
const DISCORD_MOD_KNOWLEDGE = {
  hierarchy: [
    "Founder (Comando supremo)",
    "Owner (Amministrazione generale)",
    "Sr. Admin / Admin (Gestione server e staff)",
    "Sr. Mod / Mod+ / Mod (Moderazione in-game e Discord)",
    "Pluginner (Sviluppo e configurazioni tecniche)",
    "Helper / Trainee (Supporto utenti, assistenza ticket e controlli base)"
  ],
  antiRaidAndSecurity: "In caso di raid massivo o spam di link: attivare il Lockdown di emergenza, isolare i profili spammer, non cliccare MAI link sconosciuti o token grabber, avvisare tempestivamente gli Admin in chat-mc.",
  ticketEtiquette: [
    "Tono sempre educato, professionale e accogliente.",
    "Mai litigare con un utente provocatorio: mantenere la calma e applicare le sanzioni del regolamento se necessario.",
    "Riservatezza assoluta: le decisioni interne, i log e i dati dei provini non devono mai uscire dai canali staff privati."
  ]
};

// ============================================================================
// 4. BANCA DOMANDE D'ESAME & COLLOQUIO CANDIDATI
// ============================================================================
const EXAM_QUESTIONS = [
  // Categoria ScreenShare (SS)
  {
    id: "ss_freeze_protocol",
    category: "SS_PROTOCOL",
    question: "Un giocatore è sospettato di usare reach o autoclicker in PvP. Descrivi la procedura corretta dal comando di freeze fino all'accesso con AnyDesk.",
    expectedKeywords: ["/ss", "/freeze", "vocale", "anydesk", "tempo", "3 minuti", "slog", "disconness", "ban", "privacy"]
  },
  {
    id: "ss_windows_registry",
    category: "SS_FORENSICS",
    question: "Cos'è il registro BAM di Windows e per quale motivo è fondamentale durante uno ScreenShare rispetto alla semplice cartella dei download?",
    expectedKeywords: ["bam", "background activity moderator", "registro", "percorso", "eseguibile", "timestamp", "cancellato", "eliminato", "chiave"]
  },
  {
    id: "ss_process_hacker",
    category: "SS_FORENSICS",
    question: "Come analizzi il processo javaw.exe con Process Hacker e quali stringhe cercheresti se sospetti un ghost client come Vape Lite o Drip Lite?",
    expectedKeywords: ["javaw", "process hacker", "stringhe", "memoria", "vape", "drip", "dll", "handle", "iniez"]
  },
  {
    id: "ss_usn_prefetch",
    category: "SS_FORENSICS",
    question: "A cosa serve controllare la cartella Prefetch e come puoi verificare se un player ha eliminato file sospetti pochi secondi prima del controllo tramite USN Journal?",
    expectedKeywords: ["prefetch", ".pf", "data", "ultima modifica", "usn journal", "journalscan", "cancellat", "fsutil", "ntfs"]
  },
  // Categoria Gameplay RoomUp! × YouTuberMC
  {
    id: "roomup_gameplay_menu",
    category: "ROOMUP_GAMEPLAY",
    question: "Un nuovo giocatore entra per la prima volta su RoomUp! × YouTuberMC e non sa come muoversi. Quali comandi e meccaniche gli illustri per iniziare?",
    expectedKeywords: ["/menu", "hub", "/shop", "/ah", "/rtp", "claim", "regolamento", "spawner"]
  },
  {
    id: "roomup_crates_spawners",
    category: "ROOMUP_GAMEPLAY",
    question: "Quali sono le caratteristiche principali dei sistemi Spawner e Casse Crate di RoomUp! × YouTuberMC?",
    expectedKeywords: ["spawner", "registro raccolte", "chiavi", "upgrade", "livello", "crate", "leggendaria", "mitica", "magic bucket", "secchio magico", "razzo stellare"]
  },
  // Categoria Moderazione & Situazionale
  {
    id: "situational_toxic_user",
    category: "MODERATION",
    question: "Un utente apre un ticket insultando pesantemente lo staff accusandovi di favoritismo verso un'altra Gang. Come gestisci la situazione?",
    expectedKeywords: ["calma", "tono professionale", "prove", "regolamento", "non litigare", "sanzione", "warn", "ticket"]
  }
];

// ============================================================================
// 5. MOTORE DI VALUTAZIONE E STATO COLLOQUIO
// ============================================================================
class StaffCandidateEngine {
  constructor() {
    this.candidateSessions = new Map(); // channelId -> sessionState
  }

  getKnowledgeSummary() {
    return {
      ss: SS_FORENSICS_KNOWLEDGE,
      smp: ROOMUP_SMP_KNOWLEDGE,
      discord: DISCORD_MOD_KNOWLEDGE
    };
  }

  getQuestions() {
    return EXAM_QUESTIONS;
  }

  getOrCreateSession(channelId, userId) {
    if (!this.candidateSessions.has(channelId)) {
      this.candidateSessions.set(channelId, {
        channelId,
        userId,
        currentStep: 0, // 0: Start, 1: Question 1, 2: Question 2, 3: Question 3, 4: Done
        roleDesired: "Minecraft Staff / Helper",
        answers: [],
        startedAt: Date.now(),
        scores: {
          ssScore: 0,
          gameplayScore: 0,
          moderationScore: 0,
          totalScore: 0
        },
        completed: false
      });
    }
    return this.candidateSessions.get(channelId);
  }

  /**
   * Valuta semanticamente e analizza la risposta del candidato
   */
  evaluateAnswer(question, answerText) {
    if (!answerText || answerText.trim().length < 5) {
      return { score: 1, feedback: "Risposta troppo breve o evasiva." };
    }

    const textLower = answerText.toLowerCase();
    const keywords = question.expectedKeywords || [];
    let matchedKeywords = 0;

    for (const kw of keywords) {
      if (textLower.includes(kw.toLowerCase())) {
        matchedKeywords++;
      }
    }

    const ratio = keywords.length > 0 ? matchedKeywords / keywords.length : 0.5;
    let score = Math.round(ratio * 8);
    if (textLower.length > 70) score += 1;
    if (textLower.length > 140) score += 1;
    if (matchedKeywords >= 4 && score < 7) score = 7;
    if (matchedKeywords >= 6 && score < 8) score = 8;
    if (matchedKeywords >= 8 && score < 9) score = 9;

    if (score < 1) score = 1;
    if (score > 10) score = 10;

    let feedback = "";
    if (score >= 8) feedback = "Risposta eccellente e tecnicamente molto precisa.";
    else if (score >= 6) feedback = "Buona risposta con elementi corretti, seppur migliorabile.";
    else feedback = "Risposta superficiale o con lacune concettuali.";

    return { score, feedback, matchedKeywords, totalKeywords: keywords.length };
  }

  /**
   * Conclude il colloquio e genera lo score complessivo
   */
  calculateFinalScore(session) {
    if (session.answers.length === 0) {
      session.scores.totalScore = 0;
      return session.scores;
    }

    let sum = 0;
    let ssSum = 0, ssCount = 0;
    let smpSum = 0, smpCount = 0;
    let modSum = 0, modCount = 0;

    for (const a of session.answers) {
      sum += a.score;
      if (a.category.startsWith("SS")) {
        ssSum += a.score;
        ssCount++;
      } else if (a.category.includes("ROOMUP")) {
        smpSum += a.score;
        smpCount++;
      } else {
        modSum += a.score;
        modCount++;
      }
    }

    session.scores.totalScore = Math.round((sum / session.answers.length) * 10) / 10;
    session.scores.ssScore = ssCount > 0 ? Math.round((ssSum / ssCount) * 10) / 10 : session.scores.totalScore;
    session.scores.gameplayScore = smpCount > 0 ? Math.round((smpSum / smpCount) * 10) / 10 : session.scores.totalScore;
    session.scores.moderationScore = modCount > 0 ? Math.round((modSum / modCount) * 10) / 10 : session.scores.totalScore;
    session.completed = true;

    return session.scores;
  }

  /**
   * Genera l'Embed Diagnostico da inviare a Founder / Admin
   */
  createStaffDiagnosticEmbed(session, member) {
    const scores = session.scores;
    const finalScore = scores.totalScore;

    let verdict = "🔴 NON IDONEO";
    let color = "#e74c3c";
    let recommendation = "Il candidato mostra lacune tecniche o concettuali rilevanti. Si sconsiglia l'inserimento nello Staff.";

    if (finalScore >= 7.0) {
      verdict = "🟢 IDONEO AL PROVINO VOCALE / HELPER";
      color = "#2ecc71";
      recommendation = "Ottima preparazione tecnica su ScreenShare, eccellente conoscenza dell'SMP e maturità comunicativa. Consigliato per provino orale.";
    } else if (finalScore >= 5.0) {
      verdict = "🟡 IN RISERVA / TRAINEE CON AFFIANCAMENTO";
      color = "#f1c40f";
      recommendation = "Conoscenze di base presenti ma con margini di miglioramento su aspetti forensi avanzati. Idoneo per periodo di prova o affiancamento.";
    }

    const embed = new EmbedBuilder()
      .setTitle("📊 Report Diagnostico Candidatura Staff • Sentinel AI")
      .setDescription(`Valutazione autonoma completata per il candidato **<@${session.userId}>** (${member?.user?.tag || session.userId}).`)
      .setColor(color)
      .addFields(
        { name: "🎯 Ruolo Candidato", value: session.roleDesired || "Staff Minecraft / Helper", inline: true },
        { name: "🏆 Punteggio Complessivo", value: `**${finalScore} / 10**`, inline: true },
        { name: "⚖️ Verdetto Suggerito", value: `**${verdict}**`, inline: true },
        { name: "🔍 Competenze ScreenShare (SS)", value: `Voto: **${scores.ssScore} / 10**`, inline: true },
        { name: "🎮 Conoscenza Gameplay RoomUp! SMP", value: `Voto: **${scores.gameplayScore} / 10**`, inline: true },
        { name: "🛡️ Moderazione & Attitudine", value: `Voto: **${scores.moderationScore} / 10**`, inline: true },
        { name: "📋 Nota per Founder & Amministrazione", value: recommendation }
      )
      .setFooter({ text: "Sentinel AI Autonomous Staff Intelligence • RoomUp! × YouTuberMC" })
      .setTimestamp();

    return embed;
  }
}

const defaultStaffCandidateEngine = new StaffCandidateEngine();

module.exports = {
  StaffCandidateEngine,
  defaultStaffCandidateEngine,
  SS_FORENSICS_KNOWLEDGE,
  ROOMUP_SMP_KNOWLEDGE,
  DISCORD_MOD_KNOWLEDGE,
  EXAM_QUESTIONS
};
