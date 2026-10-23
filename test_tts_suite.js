const assert = require("assert");
const { EventEmitter } = require("events");
const {
  initTtsEngine,
  detectLanguage,
  cleanTextForTts,
  chunkText,
  fetchTtsAudioStream,
  activeTtsSessions,
  GuildTtsSession
} = require("./src/bot/ttsEngine");
const { notifyTtsEvent, queues } = require("./src/bot/musicEngine");

async function runTtsTestSuite() {
  console.log("=================================================================");
  console.log("   TEST SUITE COMPLETA: TTS BOT (AUTO LANGUAGE DETECTION IT/EN)  ");
  console.log("=================================================================\n");

  // ──────────────────────────────────────────────────────────────────────────
  // 1. LANGUAGE DETECTION TESTS (EXTENSIVE IT VS EN)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("▶ 1. Verifica Rilevamento Lingua Automatico (Italiano / Inglese)...");

  const languageTests = [
    // Pure Italian
    { text: "Ciao a tutti, come state stasera?", expected: "it" },
    { text: "Non so se sta scrivendo in italiano o in inglese", expected: "it" },
    { text: "Sto pensando di andare a fare una passeggiata più tardi", expected: "it" },
    { text: "Grazie mille per l'aiuto, sei stato davvero gentilissimo", expected: "it" },
    { text: "Ci vediamo dopo in chiamata sul server vocale", expected: "it" },
    { text: "Volevo chiederti se hai tempo per parlare di quel problema", expected: "it" },
    { text: "buongiorno a tutti i membri del gruppo!", expected: "it" },
    { text: "bella raga arrivo tra dieci minuti", expected: "it" },
    { text: "stasera pizza e birra con gli amici", expected: "it" },
    { text: "posso entrare anche io nella stanza?", expected: "it" },
    { text: "c'è nessuno in chiamata?", expected: "it" },
    { text: "l'ho visto ieri con gli amici", expected: "it" },
    { text: "e' tardi andiamo a dormire", expected: "it" },
    { text: "d'accordo andiamo", expected: "it" },
    { text: "i ragazzi sono arrivati", expected: "it" },
    { text: "Nessun problema bro", expected: "it" },
    { text: "vado a fare shopping con mamma", expected: "it" },
    { text: "ho visto il match di calcio ieri sera", expected: "it" },
    { text: "giochiamo a un video game stasera", expected: "it" },

    // Pure English
    { text: "Hey everyone, how are you guys doing tonight?", expected: "en" },
    { text: "I do not know whether this message is written in English or Italian", expected: "en" },
    { text: "I was thinking about going for a walk later this evening", expected: "en" },
    { text: "Thank you so much for your help, you are really awesome", expected: "en" },
    { text: "See you later in the voice channel, guys!", expected: "en" },
    { text: "What's going on here? I can't hear anything at all", expected: "en" },
    { text: "Good morning to all members of the server!", expected: "en" },
    { text: "Wait for me, I will be there in about five minutes", expected: "en" },
    { text: "Let's play another match together", expected: "en" },
    { text: "Can you please send me that link right now?", expected: "en" },
    { text: "I love you", expected: "en" },
    { text: "can I join", expected: "en" },
    { text: "I need some help", expected: "en" },
    { text: "no way", expected: "en" },
    { text: "brb", expected: "en" },
    { text: "bye", expected: "en" },
    { text: "I know", expected: "en" },
    { text: "I want", expected: "en" },
    { text: "I like it", expected: "en" },
    { text: "I love it", expected: "en" },
    { text: "No problem bro", expected: "en" },

    // Mixed & Edge Cases (Slang, Emojis, Numbers, Punctuation)
    { text: "Grazie mille bro, sei un mito! 😎🔥", expected: "it" },
    { text: "Thanks a lot bro, you're the best! 😎🔥", expected: "en" },
    { text: "12345 67890 ???", expected: "it" }, // Default fallback
    { text: "😂😂😂 ciao a tutti", expected: "it" },
    { text: "😂😂😂 hello everybody", expected: "en" },
    { text: "ok va bene per me", expected: "it" },
    { text: "ok sounds good to me", expected: "en" },
    { text: "gg bro nice play", expected: "en" },
    { text: "vado a mangiare a dopo raga", expected: "it" },
    { text: "I'm going to eat see you later guys", expected: "en" }
  ];

  let langSuccessCount = 0;
  for (const tc of languageTests) {
    const detected = detectLanguage(tc.text);
    assert.strictEqual(
      detected,
      tc.expected,
      `Fallimento rilevamento lingua: atteso "${tc.expected}", ottenuto "${detected}" per testo: "${tc.text}"`
    );
    langSuccessCount++;
  }
  console.log(`   ✅ Tutti i ${langSuccessCount}/${languageTests.length} test di lingua hanno superato la verifica con successo!\n`);

  // ──────────────────────────────────────────────────────────────────────────
  // 2. TEXT CLEANING & SANITATION (INCLUDING EXTENDED EMOJIS)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("▶ 2. Verifica Pulizia e Normalizzazione Testo...");

  const mockMemberMap = new Map([
    ["1020343046539325480", "Frelerr"],
    ["999888777", "Alex"]
  ]);
  const memberLookup = (id) => mockMemberMap.get(id) || null;

  const rawSample = "Ciao <@1020343046539325480> guarda su <#1122334455> questo link: https://youtube.com/watch?v=abc <:party:998877> ||spoiler alert|| `console.log()` 😂 🫠🤍🥱";
  const cleanedText = cleanTextForTts(rawSample, memberLookup);

  console.log("   Testo grezzo:   ", rawSample);
  console.log("   Testo ripulito: ", cleanedText);

  assert.ok(cleanedText.includes("@Frelerr"), "La menzione utente deve essere risolta in nome leggibile");
  assert.ok(cleanedText.includes("canale"), "Il tag canale deve essere convertito in parola 'canale'");
  assert.ok(cleanedText.includes("link"), "L'URL HTTP deve essere convertito in 'link'");
  assert.ok(!cleanedText.includes("https://"), "L'URL grezzo non deve essere pronunciato lettera per lettera");
  assert.ok(cleanedText.includes("party"), "L'emoji custom deve mantenere il nome testuale");
  assert.ok(cleanedText.includes("spoiler"), "I tag spoiler devono essere sanitizzati");
  assert.ok(!cleanedText.includes("😂"), "Le emoji Unicode standard non devono corrompere la sintesi vocale");
  assert.ok(!cleanedText.includes("🫠") && !cleanedText.includes("🤍") && !cleanedText.includes("🥱"), "Anche le emoji Unicode estese devono essere ripulite");
  console.log("   ✅ Pulizia e sanitizzazione del testo convalidata!\n");

  // ──────────────────────────────────────────────────────────────────────────
  // 3. CHUNKING & LENGTH BOUNDS (INCLUDING LONG WORDS)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("▶ 3. Verifica Chunking Intelligente e Limiti Lunghezza...");

  const longParagraph =
    "Benvenuti a tutti nel server vocale di RoomUp! Oggi presentiamo il nuovissimo bot di sintesi vocale con rilevamento automatico della lingua. " +
    "Se parlate in italiano il bot userà la voce italiana naturale, mentre se scrivete in inglese commutera istantaneamente alla voce inglese nativa. " +
    "Inoltre il sistema di accodamento gestisce i messaggi sovrapposti senza alcuna interruzione fastidiosa e supporta la coesistenza automatica con il bot musicale!";

  const chunks = chunkText(longParagraph, 160);
  assert.ok(chunks.length >= 2, "Il testo lungo deve essere suddiviso in più parti");
  for (let i = 0; i < chunks.length; i++) {
    assert.ok(chunks[i].length <= 160, `Il chunk ${i + 1} eccede il limite di 160 caratteri (${chunks[i].length})`);
    assert.ok(!chunks[i].startsWith(" "), "I chunk non devono iniziare con spazi inutili");
  }

  // Probe: unbroken long word exceeding maxChunkLen
  const longToken = "w".repeat(300);
  const tokenChunks = chunkText(longToken, 180);
  assert.strictEqual(tokenChunks.length, 2, "Una parola unbroken da 300 caratteri deve essere spezzata");
  assert.ok(tokenChunks[0].length <= 180 && tokenChunks[1].length <= 180, "Tutti i sub-chunk devono rispettare maxChunkLen");
  console.log(`   Suddiviso in ${chunks.length} parti ottimali per Google TTS API senza tagliare parole a metà (e spezzati token > 180 chars).`);
  console.log("   ✅ Algoritmo di chunking convalidato!\n");

  // ──────────────────────────────────────────────────────────────────────────
  // 4. GUILD SESSION & QUEUEING ENGINE LIFECYCLE
  // ──────────────────────────────────────────────────────────────────────────
  console.log("▶ 4. Verifica Sessione TTS, Coda FIFO e Coesistenza Audio...");

  const mockGuild = { id: "guild_test_123" };
  const mockVoiceChannel = { id: "vc_test_456", members: new Map() };
  const mockTextChannel = { id: "tc_test_789" };

  const session = new GuildTtsSession(mockGuild.id, mockVoiceChannel, mockTextChannel, {
    maxMessageLength: 300,
    autoLeaveTimeout: 180
  });

  // Mock player behaviors
  let playedAudios = [];
  session.player = {
    play: (resource) => {
      playedAudios.push(resource);
    },
    stop: () => {},
    on: () => {}
  };

  // Enqueue message 1 (Italian)
  const item1 = session.enqueue("Ciao a tutti amici!", "auto", { id: "u1", displayName: "Mario" }, "tc_test_789");
  assert.ok(item1, "L'elemento 1 deve essere accodato con successo");
  assert.strictEqual(item1.lang, "it", "La lingua dell'elemento 1 deve essere italiana");
  assert.strictEqual(session.queue.length, 1, "La coda deve contenere 1 messaggio");

  // Enqueue message 2 (English) while speaking
  session.isSpeaking = true;
  const item2 = session.enqueue("Hey guys what is up?", "auto", { id: "u2", displayName: "John" }, "tc_test_789");
  assert.ok(item2, "L'elemento 2 deve essere accodato");
  assert.strictEqual(item2.lang, "en", "La lingua dell'elemento 2 deve essere inglese");
  assert.strictEqual(session.queue.length, 2, "La coda deve contenere 2 messaggi senza sovrapposizioni");

  // Enqueue message 3 (Forced Italian override)
  const item3 = session.enqueue("Hello world", "it", { id: "u3", displayName: "Luigi" }, "tc_test_789");
  assert.strictEqual(item3.lang, "it", "L'override manuale della lingua deve essere rispettato");
  assert.strictEqual(session.queue.length, 3, "La coda deve contenere 3 messaggi");

  // Test Queue Stop / Clear
  session.stop();
  assert.strictEqual(session.queue.length, 0, "Il comando stop deve svuotare la coda");
  assert.strictEqual(session.isSpeaking, false, "Il flag isSpeaking deve tornare false");
  console.log("   ✅ Gestione coda FIFO, accodamento messaggi e stop convalidati!\n");

  // ──────────────────────────────────────────────────────────────────────────
  // 4b. AUDIO COEXISTENCE & RE-SUBSCRIPTION VERIFICATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log("▶ 4b. Verifica Coesistenza con Music Engine e Ripristino Subscription...");
  let musicSubscribed = false;
  const mockMusicPlayer = { stop: () => {} };
  const mockVoiceConnection = {
    state: { status: "ready" },
    subscribe: (player) => {
      if (player === mockMusicPlayer) musicSubscribed = true;
    },
    destroy: () => {}
  };

  const mockMusicQueue = {
    guildId: mockGuild.id,
    connection: mockVoiceConnection,
    player: mockMusicPlayer,
    isPlaying: true,
    volume: 80,
    config: { ttsCoexistenceMode: "duck", ttsDuckingVolume: 20 },
    handleTtsEvent: function(eventType) {
      if (eventType === "start") {
        this.ttsActive = true;
      } else if (eventType === "end") {
        this.ttsActive = false;
        if (this.connection && this.isPlaying && this.player) {
          this.connection.subscribe(this.player);
        }
      }
    }
  };
  queues.set(mockGuild.id, mockMusicQueue);

  // Trigger TTS start and end
  notifyTtsEvent(mockGuild.id, "start");
  assert.strictEqual(mockMusicQueue.ttsActive, true, "MusicQueue deve segnare TTS come attivo");

  notifyTtsEvent(mockGuild.id, "end");
  assert.strictEqual(mockMusicQueue.ttsActive, false, "MusicQueue deve tornare a ttsActive false");
  assert.strictEqual(musicSubscribed, true, "MusicQueue deve ri-sottoscrivere il player musicale alla connessione vocale!");
  console.log("   ✅ Coesistenza audio validata: il player musicale viene riagganciato automaticamente!");

  queues.delete(mockGuild.id);

  // ──────────────────────────────────────────────────────────────────────────
  // 5. INTERACTION & SLASH COMMANDS INTEGRATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log("▶ 5. Verifica Listener Comandi Slash (/tts join, /tts say, /tts leave, /tts queue)...");

  const mockClient = new EventEmitter();
  let loadSettings = () => ({
    [mockGuild.id]: {
      tts: {
        enabled: true,
        defaultLanguage: "auto"
      }
    }
  });

  initTtsEngine(mockClient, loadSettings);

  // Test /tts help
  let helpReply = null;
  const mockHelpInteraction = {
    isChatInputCommand: () => true,
    commandName: "tts",
    guild: mockGuild,
    member: { id: "user_owner", voice: { channel: null } },
    channel: mockTextChannel,
    options: {
      getSubcommand: () => "help"
    },
    reply: async (data) => {
      helpReply = data;
    }
  };

  await mockClient.emit("interactionCreate", mockHelpInteraction);
  assert.ok(helpReply?.embeds?.length > 0, "Il comando /tts help deve restituire l'embed della guida");
  assert.ok(helpReply.embeds[0].data.title.includes("TTS BOT"), "L'embed deve presentare la guida TTS BOT");
  console.log("   ✅ Comando /tts help funzionante e completo!");

  // Test /tts queue when empty
  let queueReply = null;
  const mockQueueInteraction = {
    isChatInputCommand: () => true,
    commandName: "tts",
    guild: mockGuild,
    member: { id: "user_owner", voice: { channel: null } },
    channel: mockTextChannel,
    options: {
      getSubcommand: () => "queue"
    },
    reply: async (data) => {
      queueReply = data;
    }
  };

  await mockClient.emit("interactionCreate", mockQueueInteraction);
  assert.ok(queueReply?.content?.includes("vuota"), "La risposta queue a coda vuota deve indicare che la coda è vuota");
  console.log("   ✅ Comando /tts queue gestito correttamente!");

  // Test /tts auto toggle
  let autoReply = null;
  const mockAutoInteraction = {
    isChatInputCommand: () => true,
    commandName: "tts",
    guild: mockGuild,
    member: { id: "user_owner", voice: { channel: null } },
    channel: mockTextChannel,
    options: {
      getSubcommand: () => "auto",
      getBoolean: (key) => key === "attivo" ? true : false,
      getChannel: () => mockTextChannel
    },
    reply: async (data) => {
      autoReply = data;
    }
  };

  await mockClient.emit("interactionCreate", mockAutoInteraction);
  assert.ok(autoReply?.embeds?.length > 0, "Il comando /tts auto deve confermare il cambio di stato");
  console.log("   ✅ Comando /tts auto toggle gestito correttamente!\n");

  // ──────────────────────────────────────────────────────────────────────────
  // 6. AUTO-READING MESSAGES LISTENER (messageCreate)
  // ──────────────────────────────────────────────────────────────────────────
  console.log("▶ 6. Verifica Auto-TTS Reading nei Messaggi di Canale...");

  // Register an active mock session
  const testSession = new GuildTtsSession(mockGuild.id, mockVoiceChannel, mockTextChannel);
  testSession.autoTts = true;
  testSession.player = { play: () => {}, stop: () => {}, on: () => {} };
  activeTtsSessions.set(mockGuild.id, testSession);

  let reactionAdded = null;
  const mockMessageFromVCUser = {
    guild: mockGuild,
    channel: mockTextChannel,
    author: { bot: false, id: "vc_user_1" },
    member: {
      id: "vc_user_1",
      displayName: "GamerPro",
      voice: { channelId: mockVoiceChannel.id } // In the same VC!
    },
    content: "Ragazzi venite in lobby su discord",
    react: async (emoji) => { reactionAdded = emoji; }
  };

  await mockClient.emit("messageCreate", mockMessageFromVCUser);
  await new Promise(r => setTimeout(r, 50));

  assert.strictEqual(testSession.queue.length, 1, "Il messaggio dell'utente in VC deve essere accodato");
  assert.strictEqual(testSession.queue[0].lang, "it", "Il messaggio italiano deve essere rilevato come 'it'");
  assert.strictEqual(reactionAdded, "🗣️", "Il bot deve apporre la reazione 🗣️ al messaggio letto");
  console.log("   ✅ Auto-TTS legge con successo i messaggi degli utenti in vocale!");

  // Ensure conversational punctuation like '- ok arrivo' is NOT dropped as command
  const mockConversationalDash = {
    guild: mockGuild,
    channel: mockTextChannel,
    author: { bot: false, id: "vc_user_1" },
    member: {
      id: "vc_user_1",
      displayName: "GamerPro",
      voice: { channelId: mockVoiceChannel.id }
    },
    content: "- ok arrivo subito",
    react: async () => {}
  };
  await mockClient.emit("messageCreate", mockConversationalDash);
  await new Promise(r => setTimeout(r, 50));
  assert.strictEqual(testSession.queue.length, 2, "I messaggi discorsivi con trattino devono essere letti regolarmente");
  console.log("   ✅ Messaggi discorsivi con punteggiatura gestiti correttamente!");

  // Ensure commands like /help or !play are NOT read by TTS
  const currentQueueLen = testSession.queue.length;
  const mockCommandMessage = {
    guild: mockGuild,
    channel: mockTextChannel,
    author: { bot: false, id: "vc_user_1" },
    member: {
      id: "vc_user_1",
      displayName: "GamerPro",
      voice: { channelId: mockVoiceChannel.id }
    },
    content: "!play song title",
    react: async () => {}
  };

  await mockClient.emit("messageCreate", mockCommandMessage);
  assert.strictEqual(testSession.queue.length, currentQueueLen, "I messaggi con prefisso comando NON devono essere letti da TTS");
  console.log("   ✅ Filtro comandi verificato (i comandi non vengono letti)!");

  // Ensure users outside VC are ignored
  const mockMessageFromNonVC = {
    guild: mockGuild,
    channel: mockTextChannel,
    author: { bot: false, id: "other_user" },
    member: {
      id: "other_user",
      displayName: "Stranger",
      voice: { channelId: "some_other_vc" } // Not in the same VC
    },
    content: "Messaggio da un altro canale",
    react: async () => {}
  };

  await mockClient.emit("messageCreate", mockMessageFromNonVC);
  assert.strictEqual(testSession.queue.length, currentQueueLen, "I messaggi di chi non è nel canale vocale devono essere ignorati");
  console.log("   ✅ Isolamento canale vocale verificato (chi non è in call non spamma la voce)!\n");

  testSession.stop();
  activeTtsSessions.delete(mockGuild.id);

  console.log("=================================================================");
  console.log("   🎉 TUTTI I TEST DEL SISTEMA TTS BOT SUPERATI CON SUCCESSO!    ");
  console.log("=================================================================");
}

runTtsTestSuite().catch(err => {
  console.error("❌ TEST FALLITO:", err);
  process.exit(1);
});
