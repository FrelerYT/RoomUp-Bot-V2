const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection
} = require("@discordjs/voice");
const {
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
} = require("discord.js");
const https = require("https");
const { notifyTtsEvent, queues } = require("./musicEngine");

// In-memory active sessions per guild: guildId -> GuildTtsSession
const activeTtsSessions = new Map();

// ── VOCABULARY & LANGUAGE DETECTION ENGINE ──────────────────────────────────
const itVocabulary = new Set([
  'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'un\'',
  'di', 'da', 'con', 'su', 'tra', 'fra', 'per', 'in',
  'del', 'dello', 'della', 'dei', 'degli', 'delle',
  'al', 'allo', 'alla', 'ai', 'agli', 'alle',
  'dal', 'dallo', 'dalla', 'dai', 'dagli', 'dalle',
  'nel', 'nello', 'nella', 'nei', 'negli', 'nelle',
  'sul', 'sullo', 'sulla', 'sui', 'sugli', 'sulle',
  'io', 'tu', 'lui', 'lei', 'noi', 'voi', 'loro',
  'mi', 'ti', 'si', 'ci', 'vi', 'ne', 'te', 'se', 'ce', 've',
  'chi', 'che', 'cui', 'quale', 'quali', 'quanto', 'quanti', 'quanta', 'quante',
  'dove', 'come', 'quando', 'perché', 'perche', 'ma', 'però', 'pero', 'oppure',
  'anche', 'neanche', 'nemmeno', 'neppure', 'non', 'sì', 'si', 'già', 'gia', 'ancora', 'poi', 'dopo', 'prima', 'sempre', 'mai', 'presto', 'tardi', 'qui', 'qua', 'lì', 'la', 'là',
  'sopra', 'sotto', 'dentro', 'fuori', 'vicino', 'lontano', 'molto', 'poco', 'troppo', 'tanto', 'niente', 'nulla', 'tutto', 'tutti', 'tutta', 'tutte', 'qualche', 'nessuno', 'nessuna',
  'essere', 'sono', 'sei', 'è', 'e\'', 'siamo', 'siete', 'ero', 'eri', 'era', 'eravamo', 'eravate', 'erano', 'sarà', 'sara', 'saranno', 'stato', 'stata', 'stati', 'state',
  'avere', 'ho', 'hai', 'ha', 'abbiamo', 'avete', 'hanno', 'avevo', 'avevi', 'aveva', 'avevamo', 'avevate', 'avevano', 'avrò', 'avrà', 'avuto', 'avuta', 'avuti', 'avute',
  'fare', 'fatto', 'fatta', 'fatti', 'fatte', 'fare', 'faccio', 'fai', 'fa', 'facciamo', 'fate', 'fanno', 'facevo', 'faceva',
  'dire', 'detto', 'dire', 'dico', 'dici', 'dice', 'diciamo', 'dite', 'dicono',
  'andare', 'andato', 'andata', 'andare', 'vado', 'vai', 'va', 'andiamo', 'andate', 'vanno', 'andavo',
  'venire', 'vengo', 'vieni', 'viene', 'veniamo', 'venite', 'vengono', 'venuto', 'venuta', 'venuti', 'venute',
  'potere', 'posso', 'puoi', 'può', 'puo', 'possiamo', 'potete', 'possono', 'potrei', 'potevo',
  'volere', 'voglio', 'vuoi', 'vuole', 'vogliamo', 'volete', 'vogliono', 'vorrei', 'volevo',
  'dovere', 'devo', 'devi', 'deve', 'dobbiamo', 'dovete', 'devono', 'dovrei', 'dovevo',
  'sapere', 'so', 'sai', 'sa', 'sappiamo', 'sapete', 'sanno',
  'vedere', 'vedo', 'vedi', 'vede', 'vediamo', 'vedete', 'vedono', 'vedere', 'visto', 'vista', 'visti', 'viste',
  'sentire', 'sento', 'senti', 'sente', 'sentiamo', 'sentite', 'sentono', 'sentire', 'sentito',
  'parlare', 'parlo', 'parli', 'parla', 'parliamo', 'parlate', 'parlano', 'parlato',
  'capire', 'capisco', 'capisci', 'capisce', 'capiamo', 'capite', 'capiscono', 'capito',
  'stare', 'sto', 'stai', 'sta', 'stiamo', 'state', 'stanno', 'stare',
  'ciao', 'salve', 'buongiorno', 'buonasera', 'buonanotte', 'grazie', 'prego', 'scusa', 'scusate', 'scusami',
  'raga', 'ragazzi', 'ragazzo', 'ragazza', 'bella', 'bello', 'amico', 'amici', 'chiamata', 'canale', 'server', 'stasera', 'oggi', 'domani', 'ieri', 'subito', 'bene', 'male', 'vero', 'falso', 'forse', 'sicuro',
  'c\'è', 'c\'era', 'l\'ho', 'd\'accordo', 'allora', 'infatti', 'invece', 'quindi', 'comunque', 'pure', 'davvero', 'veramente', 'proprio', 'senza', 'adesso', 'ora', 'tempo', 'cosa', 'cose', 'posto', 'casa', 'gioco', 'partita', 'problema', 'domanda', 'risposta'
]);

const enVocabulary = new Set([
  'the', 'a', 'an',
  'of', 'to', 'for', 'on', 'with', 'at', 'by', 'from', 'up', 'about', 'into', 'over', 'after', 'under', 'between', 'out',
  'you', 'he', 'she', 'it', 'we', 'they', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'mine', 'yours', 'hers', 'ours', 'theirs',
  'this', 'that', 'these', 'those', 'who', 'whom', 'whose', 'which', 'what', 'where', 'when', 'why', 'how',
  'and', 'but', 'or', 'nor', 'so', 'yet', 'because', 'since', 'unless', 'while', 'if', 'then',
  'not', 'very', 'too', 'also', 'really', 'just', 'quite', 'almost', 'always', 'never', 'sometimes', 'often', 'usually', 'already', 'still', 'even', 'now', 'then', 'there', 'here',
  'is', 'am', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'done', 'doing',
  'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must', 'need',
  'say', 'says', 'said', 'go', 'goes', 'went', 'gone', 'going', 'get', 'gets', 'got', 'getting', 'make', 'makes', 'made', 'know', 'knows', 'knew', 'think', 'thinks', 'thought', 'take', 'takes', 'took', 'see', 'sees', 'saw', 'come', 'comes', 'came', 'look', 'looks', 'looked', 'want', 'wants', 'wanted', 'give', 'gives', 'gave', 'use', 'uses', 'used', 'tell', 'tells', 'told', 'ask', 'asks', 'asked', 'work', 'works', 'worked',
  'love', 'like', 'help', 'join', 'leave', 'feel', 'hear', 'listen', 'talk', 'speak', 'play', 'start', 'stop', 'try', 'find', 'keep', 'put', 'let', 'call', 'wait', 'mean', 'show', 'move', 'hold', 'run', 'bring',
  'hello', 'hey', 'hi', 'welcome', 'thanks', 'thank', 'please', 'pls', 'plz', 'sorry', 'sry', 'yeah', 'yep', 'nope', 'nah', 'dude', 'bro', 'awesome', 'cool', 'tonight', 'today', 'tomorrow', 'yesterday', 'guys', 'guy', 'friend', 'friends', 'channel', 'voice', 'call', 'good', 'bad', 'sure', 'true', 'false', 'maybe', 'game', 'play', 'wow', 'yes', 'no', 'way', 'fine', 'great', 'nice', 'right', 'wrong', 'bye', 'goodbye', 'brb', 'afk', 'gg', 'wp', 'idk', 'omg', 'back', 'later'
]);

const enFollowersAfterI = new Set([
  'am', 'have', 'had', 'do', 'did', 'will', 'would', 'can', 'could', 'should', 'might', 'must',
  'want', 'need', 'like', 'love', 'think', 'know', 'see', 'feel', 'hope', 'wish', 'mean', 'just',
  'really', 'also', 'never', 'always', 'got', 'get', 'said', 'say', 'went', 'go', 'came', 'come', 'was'
]);

/**
 * Automatically detects whether text is Italian or English with high precision.
 * @param {string} text 
 * @returns {"it" | "en"}
 */
function detectLanguage(text) {
  if (!text || typeof text !== "string") return "it";

  const clean = text.toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-zàèéìòù\'\s]/g, " ")
    .trim();

  if (!clean) return "it";

  const tokens = clean.split(/\s+/).filter(Boolean);
  let itScore = 0;
  let enScore = 0;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const prev = i > 0 ? tokens[i - 1] : "";
    const next = i < tokens.length - 1 ? tokens[i + 1] : "";

    // Disambiguate single letter 'i' / 'I'
    if (t === "i") {
      if (enFollowersAfterI.has(next) || prev === "can" || prev === "should" || prev === "could" || prev === "may" || prev === "will" || prev === "did" || prev === "do") {
        enScore += 5;
        continue;
      } else if (next && (itVocabulary.has(next) || next.endsWith("i") || next.endsWith("e"))) {
        itScore += 3;
        continue;
      }
    }

    if (itVocabulary.has(t)) itScore += 3;
    if (enVocabulary.has(t)) enScore += 3;

    // English contractions and suffixes
    if (t.includes("'s") || t.includes("'t") || t.includes("'re") || t.includes("'ve") || t.includes("'ll") || t.includes("'d") || t.includes("'m") || t.includes("n't")) enScore += 4;
    if (t.length > 4 && t.endsWith("ing")) enScore += 2;
    if (t.length > 3 && t.endsWith("ed")) enScore += 1;
    if (t.length > 4 && t.endsWith("ly")) enScore += 1;
    if (t.length > 5 && (t.endsWith("tion") || t.endsWith("sion") || t.endsWith("ness") || t.endsWith("ment"))) enScore += 2;

    // Distinctive English letters (w, k, y, j, x rarely appear in native Italian)
    if (/[wky]/.test(t) && !itVocabulary.has(t)) enScore += 2;
    if (/^(wh|th)/.test(t)) enScore += 2;
    if (/th|sh|ck|ight|ould|ee|oo|ea|ough/.test(t)) enScore += 1;

    // Italian accents, suffixes and clitics
    if (/[àèéìòù]/.test(t) || t === "e'") itScore += 4;
    if (t.startsWith("c'") || t.startsWith("l'") || t.startsWith("d'") || t.startsWith("dell'") || t.startsWith("all'") || t.startsWith("nell'") || t.startsWith("sull'") || t.startsWith("un'")) itScore += 4;
    if (t.length > 5 && (t.endsWith("zione") || t.endsWith("zioni") || t.endsWith("mente") || t.endsWith("ando") || t.endsWith("endo") || t.endsWith("issimo") || t.endsWith("issima") || t.endsWith("issimi") || t.endsWith("issime"))) itScore += 3;
    if (t.length > 4 && (t.endsWith("are") || t.endsWith("ere") || t.endsWith("ire") || t.endsWith("ato") || t.endsWith("uto") || t.endsWith("ito") || t.endsWith("iamo") || t.endsWith("anno") || t.endsWith("ranno"))) itScore += 2;
    if (/gli|gno|gna|gne|gni|sc[ie]|ch[ie]|gh[ie]/.test(t)) itScore += 2;
    if (/(tt|zz|ll|ss|cc|gg|mm|nn|pp|rr|bb|dd|ff)/.test(t)) itScore += 1;
  }

  // Default fallback is Italian for RoomUp server unless English is strongly detected
  return enScore > itScore ? "en" : "it";
}

/**
 * Cleans text for pleasant TTS speech (replaces mentions, URLs, emojis, spoilers).
 */
function cleanTextForTts(text, memberLookupFn = null) {
  if (!text) return "";
  return text
    .replace(/<@!?(\d+)>/g, (m, id) => {
      const name = typeof memberLookupFn === "function" ? memberLookupFn(id) : null;
      return name ? `@${name}` : "utente";
    })
    .replace(/<#(\d+)>/g, "canale")
    .replace(/<@&(\d+)>/g, "ruolo")
    .replace(/<a?:(\w+):\d+>/g, " $1 ")
    .replace(/https?:\/\/\S+/gi, " link ")
    .replace(/```[\s\S]*?```/g, " blocco di codice ")
    .replace(/`([^`]+)`/g, " $1 ")
    .replace(/\|\|.*?\|\|/g, " spoiler ")
    .replace(/[*_~>#]/g, " ")
    .replace(/[\p{Extended_Pictographic}\uFE0E\uFE0F\u200D\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Chunks text intelligently so that NO piece ever exceeds Google TTS character limits (~180 chars)
 * without splitting words unless a single word exceeds the limit.
 */
function chunkText(text, maxChunkLen = 180) {
  if (!text || typeof text !== "string") return [];
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxChunkLen) return [trimmed];

  const chunks = [];
  const sentences = trimmed.match(/[^.!?;\n]+[.!?;\n]+|[^.!?;\n]+$/g) || [trimmed];

  let currentChunk = "";

  const pushWord = (w) => {
    while (w.length > maxChunkLen) {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = "";
      }
      chunks.push(w.slice(0, maxChunkLen));
      w = w.slice(maxChunkLen);
    }
    if (!w) return;
    if (!currentChunk) {
      currentChunk = w;
    } else if ((currentChunk + " " + w).length <= maxChunkLen) {
      currentChunk += " " + w;
    } else {
      chunks.push(currentChunk);
      currentChunk = w;
    }
  };

  for (const sentence of sentences) {
    const s = sentence.trim();
    if (!s) continue;

    if (!currentChunk && s.length <= maxChunkLen) {
      currentChunk = s;
    } else if (currentChunk && (currentChunk + " " + s).length <= maxChunkLen) {
      currentChunk += " " + s;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = "";
      }
      if (s.length <= maxChunkLen) {
        currentChunk = s;
      } else {
        const words = s.split(/\s+/).filter(Boolean);
        for (const w of words) {
          pushWord(w);
        }
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Helper to fetch TTS stream from a URL, following redirects.
 */
function fetchStreamFromUrl(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 3) {
      return reject(new Error("Too many redirects for TTS stream"));
    }

    const req = https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://translate.google.com/",
        "Accept": "audio/mpeg, audio/*;q=0.9, */*;q=0.8"
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const redirectUrl = res.headers.location.startsWith("http")
          ? res.headers.location
          : new URL(res.headers.location, "https://translate.google.com").toString();
        return fetchStreamFromUrl(redirectUrl, redirectCount + 1).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`TTS stream HTTP error status ${res.statusCode}`));
      }
      resolve(res);
    });

    req.on("error", (err) => reject(err));
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error("TTS stream request timed out"));
    });
  });
}

/**
 * Fetches TTS audio stream from Google Translate TTS API with fallback support.
 */
async function fetchTtsAudioStream(text, lang = "it") {
  const encoded = encodeURIComponent(text);
  const targetLang = lang === "en" ? "en" : "it";

  // Primary attempt with tw-ob client
  const primaryUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${targetLang}&client=tw-ob`;
  try {
    return await fetchStreamFromUrl(primaryUrl);
  } catch (primaryErr) {
    // Secondary attempt with gtx client
    const fallbackUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${targetLang}&client=gtx`;
    return await fetchStreamFromUrl(fallbackUrl);
  }
}

// ── GUILD TTS SESSION CLASS ────────────────────────────────────────────────
class GuildTtsSession {
  constructor(guildId, voiceChannel, textChannel, config = {}) {
    this.guildId = guildId;
    this.voiceChannel = voiceChannel;
    this.textChannel = textChannel;
    this.config = config;
    this.queue = []; // Array of { id, text, chunks, currentChunkIdx, lang, author, channelId }
    this.player = createAudioPlayer();
    this.connection = null;
    this.isSpeaking = false;
    this.autoTts = true;
    this.idleTimer = null;
    this.emptyVcTimer = null;

    this.setupListeners();
  }

  setupListeners() {
    this.player.on(AudioPlayerStatus.Idle, () => {
      this.isSpeaking = false;
      this.playNext();
    });

    this.player.on("error", (err) => {
      console.error(`[TTSEngine] Errore AudioPlayer (Guild: ${this.guildId}):`, err.message);
      this.isSpeaking = false;
      // Skip current chunk/item to keep queue moving
      if (this.queue.length > 0) {
        this.queue[0].currentChunkIdx++;
      }
      this.playNext();
    });
  }

  resetIdleTimer() {
    this.clearIdleTimer();
    const timeoutSec = this.config.autoLeaveTimeout ?? 180;
    if (timeoutSec > 0) {
      this.idleTimer = setTimeout(() => {
        if (!this.isSpeaking && this.queue.length === 0) {
          this.disconnect("Inattività prolungata (nessun messaggio vocale da pronunciare)");
        }
      }, timeoutSec * 1000);
      if (this.idleTimer.unref) this.idleTimer.unref();
    }
  }

  clearIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  enqueue(text, langChoice = "auto", author = null, channelId = null) {
    if (!text || typeof text !== "string") return null;

    const maxLen = this.config.maxMessageLength || 350;
    let truncatedText = text.trim();
    if (truncatedText.length > maxLen) {
      truncatedText = truncatedText.slice(0, maxLen) + "...";
    }

    const detectedLang = detectLanguage(truncatedText);
    const chosenLang = (langChoice === "it" || langChoice === "en") ? langChoice : detectedLang;
    const chunks = chunkText(truncatedText, 180);

    if (chunks.length === 0) return null;

    // Limit maximum queue size to avoid memory overflow (max 25 items)
    if (this.queue.length >= 25) {
      this.queue.splice(24);
    }

    const item = {
      id: `tts_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      rawText: text,
      text: truncatedText,
      chunks,
      currentChunkIdx: 0,
      lang: chosenLang,
      detectedLang,
      author: author ? { id: author.id, username: author.displayName || author.username } : null,
      channelId,
      createdAt: Date.now()
    };

    this.queue.push(item);

    if (!this.isSpeaking) {
      this.playNext();
    }

    return item;
  }

  async playNext() {
    if (this.isSpeaking) return;

    if (this.queue.length === 0) {
      // Nothing more to speak: notify coexistence engine that TTS finished
      try {
        notifyTtsEvent(this.guildId, "end");
      } catch (e) {}

      this.resetIdleTimer();
      return;
    }

    this.clearIdleTimer();

    const currentItem = this.queue[0];
    if (currentItem.currentChunkIdx >= currentItem.chunks.length) {
      // Current message finished all its chunks
      this.queue.shift();
      return this.playNext();
    }

    const chunk = currentItem.chunks[currentItem.currentChunkIdx];
    currentItem.currentChunkIdx++;

    try {
      this.isSpeaking = true;

      // Notify music bot to duck or pause
      try {
        notifyTtsEvent(this.guildId, "start");
      } catch (e) {}

      // Ensure voice connection is healthy and subscribed to TTS player
      if (this.connection && this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
        this.connection.subscribe(this.player);
      }

      const stream = await fetchTtsAudioStream(chunk, currentItem.lang);

      // Check if session was stopped or item was dequeued while awaiting audio stream
      if (!this.isSpeaking || this.queue.length === 0 || this.queue[0]?.id !== currentItem.id) {
        return;
      }

      const resource = createAudioResource(stream, { inlineVolume: true });
      resource.volume?.setVolume(1.0);

      this.player.play(resource);
    } catch (err) {
      console.error(`[TTSEngine] Errore riproduzione stream TTS (Guild: ${this.guildId}):`, err.message);
      this.isSpeaking = false;
      this.playNext();
    }
  }

  stop() {
    this.queue = [];
    this.isSpeaking = false;
    if (this.player) {
      this.player.stop(true);
    }
    try {
      notifyTtsEvent(this.guildId, "end");
    } catch (e) {}
    this.resetIdleTimer();
  }

  disconnect(reason = "Disconnessione richiesta") {
    this.stop();
    this.clearIdleTimer();
    if (this.emptyVcTimer) {
      clearTimeout(this.emptyVcTimer);
      this.emptyVcTimer = null;
    }

    // Check if music is playing in this guild before destroying voice connection
    const musicQueue = queues ? queues.get(this.guildId) : null;
    const musicActive = Boolean(musicQueue && musicQueue.isPlaying && musicQueue.connection);

    if (this.connection) {
      if (!musicActive) {
        try {
          if (this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
            this.connection.destroy();
          }
        } catch (e) {}
      } else {
        // Music is still playing: preserve connection and re-subscribe music player
        try {
          if (musicQueue.connection && musicQueue.player) {
            musicQueue.connection.subscribe(musicQueue.player);
          }
        } catch (e) {}
      }
      this.connection = null;
    }

    activeTtsSessions.delete(this.guildId);
    console.log(`[TTSEngine] Sessione TTS terminata nel server ${this.guildId} (${reason}).`);
  }
}

/**
 * Gets or establishes a GuildTtsSession connected to the given voice channel.
 */
async function getOrCreateTtsSession(guild, voiceChannel, textChannel, config = {}) {
  let session = activeTtsSessions.get(guild.id);
  if (!session) {
    session = new GuildTtsSession(guild.id, voiceChannel, textChannel, config);
    activeTtsSessions.set(guild.id, session);
  }

  session.voiceChannel = voiceChannel;
  session.textChannel = textChannel;
  session.config = config;

  let connection = getVoiceConnection(guild.id);
  const needsNewConnection = !connection ||
    connection.state.status === VoiceConnectionStatus.Destroyed ||
    (connection.joinConfig && connection.joinConfig.channelId !== voiceChannel.id);

  if (needsNewConnection) {
    connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5000)
        ]);
      } catch (err) {
        session.disconnect("Disconnesso dal canale vocale");
      }
    });

    connection.on("error", (err) => {
      console.error(`[TTSEngine] Errore connessione vocale (Guild: ${guild.id}):`, err.message);
    });
  }

  session.connection = connection;
  connection.subscribe(session.player);

  return session;
}

/**
 * Initialize TTS Engine with message listeners, voice state updates, and interactions.
 */
function initTtsEngine(client, loadSettingsFn) {
  // 1. Message Create Listener (Auto-TTS Reading)
  client.on("messageCreate", async (message) => {
    try {
      if (!message.guild || message.author.bot) return;

      const session = activeTtsSessions.get(message.guild.id);
      if (!session || !session.autoTts) return;

      const settings = typeof loadSettingsFn === "function" ? loadSettingsFn() : {};
      const guildConfig = settings[message.guild.id] || {};
      const ttsSettings = guildConfig.tts || {};
      if (ttsSettings.enabled === false) return;

      // Check if message is in the bound text channel or designated auto-read channels
      const isBoundChannel = session.textChannel?.id === message.channel.id;
      const isConfiguredChannel = Array.isArray(ttsSettings.autoReadChannels) && ttsSettings.autoReadChannels.includes(message.channel.id);
      if (!isBoundChannel && !isConfiguredChannel) return;

      // Author must be in the same voice channel as the TTS bot (TTS BOT standard behavior)
      const member = message.member || await message.guild.members.fetch(message.author.id).catch(() => null);
      if (!member) return;

      const authorVoiceChannelId = member.voice?.channelId;
      const botVoiceChannelId = session.connection?.joinConfig?.channelId || session.voiceChannel?.id;
      if (!authorVoiceChannelId || authorVoiceChannelId !== botVoiceChannelId) return;

      // Update session voiceChannel if changed
      if (session.voiceChannel?.id !== botVoiceChannelId) {
        session.voiceChannel = message.guild.channels.cache.get(botVoiceChannelId) || session.voiceChannel;
      }

      // Ignore actual bot command invocations (e.g. !play, /tts, .help, ?info)
      const trimmed = message.content.trim();
      if (!trimmed || /^([/!$#+~^]|(\.[a-zA-Z])|(\?[a-zA-Z]))/.test(trimmed)) return;

      // Lookup function for mentions
      const memberLookup = (id) => {
        const m = message.guild.members.cache.get(id);
        return m ? (m.displayName || m.user.username) : null;
      };

      const cleaned = cleanTextForTts(trimmed, memberLookup);
      if (!cleaned) return;

      // Detect language on user's actual text first
      const detectedLang = detectLanguage(cleaned);
      const chosenLang = (ttsSettings.defaultLanguage && ttsSettings.defaultLanguage !== "auto")
        ? ttsSettings.defaultLanguage
        : detectedLang;

      // Prefix with username if announceUser is true
      const announce = ttsSettings.announceUser === true;
      const authorName = member.displayName || member.user?.username || "Utente";
      const prefix = announce
        ? (chosenLang === "en" ? `${authorName} says: ` : `${authorName} dice: `)
        : "";
      const textToSpeak = prefix + cleaned;

      session.enqueue(textToSpeak, chosenLang, member, message.channel.id);

      // React subtly with 🗣️ to acknowledge TTS reading (non-intrusive)
      await message.react("🗣️").catch(() => null);
    } catch (err) {
      console.error("[TTSEngine] Errore elaborazione auto-TTS:", err.message);
    }
  });

  // 2. Voice State Update Listener (Auto-leave when empty)
  client.on("voiceStateUpdate", (oldState, newState) => {
    try {
      const guild = oldState.guild || newState.guild;
      if (!guild) return;

      const session = activeTtsSessions.get(guild.id);
      if (!session || !session.voiceChannel) return;

      const botChannelId = session.connection?.joinConfig?.channelId || session.voiceChannel?.id;
      const botChannel = guild.channels.cache.get(botChannelId);
      if (!botChannel) return;

      const humanMembers = botChannel.members.filter(m => !m.user.bot);

      if (humanMembers.size === 0) {
        // Voice channel is empty, start 30s countdown to leave
        if (!session.emptyVcTimer) {
          session.emptyVcTimer = setTimeout(() => {
            session.disconnect("Canale vocale vuoto (tutti gli utenti sono usciti)");
          }, 30000);
          if (session.emptyVcTimer.unref) session.emptyVcTimer.unref();
        }
      } else {
        // Humans are present, cancel empty timer
        if (session.emptyVcTimer) {
          clearTimeout(session.emptyVcTimer);
          session.emptyVcTimer = null;
        }
      }
    } catch (err) {
      console.error("[TTSEngine] Errore aggiornamento voice state:", err.message);
    }
  });

  // 3. Interaction Listener for /tts Slash Commands
  client.on("interactionCreate", async (interaction) => {
    try {
      if (!interaction.isChatInputCommand()) return;
      if (interaction.commandName !== "tts") return;

      const { guild, member, channel, options } = interaction;
      if (!guild) return;

      const subcommand = options.getSubcommand();
      const settings = typeof loadSettingsFn === "function" ? loadSettingsFn() : {};
      const guildConfig = settings[guild.id] || {};
      const ttsConfig = guildConfig.tts || {};

      // ── SUBCOMMAND: /tts join ─────────────────────────────────────────────
      if (subcommand === "join") {
        const targetVoiceChannel = options.getChannel("canale") || member?.voice?.channel;
        if (!targetVoiceChannel) {
          return interaction.reply({
            content: "❌ Devi essere connesso a un canale vocale oppure specificarne uno!",
            ephemeral: true
          });
        }

        if (targetVoiceChannel.type !== ChannelType.GuildVoice && targetVoiceChannel.type !== ChannelType.GuildStageVoice) {
          return interaction.reply({
            content: "❌ Il canale specificato non è un canale vocale valido.",
            ephemeral: true
          });
        }

        // Verify bot voice permissions
        const botMember = guild.members.me || (client.user ? guild.members.cache.get(client.user.id) : null);
        if (botMember) {
          const perms = targetVoiceChannel.permissionsFor(botMember);
          if (perms && !perms.has(PermissionFlagsBits.Connect)) {
            return interaction.reply({
              content: "❌ Non ho il permesso di connettermi a questo canale vocale (Connect mancante).",
              ephemeral: true
            });
          }
          if (perms && !perms.has(PermissionFlagsBits.Speak)) {
            return interaction.reply({
              content: "❌ Non ho il permesso di parlare in questo canale vocale (Speak mancante).",
              ephemeral: true
            });
          }
        }

        await interaction.deferReply();
        const session = await getOrCreateTtsSession(guild, targetVoiceChannel, channel, ttsConfig);
        session.autoTts = true;

        const joinEmbed = new EmbedBuilder()
          .setTitle("🎙️ TTS BOT Connesso")
          .setDescription(
            `Mi sono connesso al canale vocale <#${targetVoiceChannel.id}>!\n` +
            `I messaggi inviati in <#${channel.id}> dai membri in chiamata verranno letti ad alta voce con **rilevamento automatico della lingua** (Italiano 🇮🇹 / Inglese 🇬🇧).`
          )
          .setColor("#5865F2")
          .addFields(
            { name: "🔊 Canale Vocale", value: `<#${targetVoiceChannel.id}>`, inline: true },
            { name: "💬 Canale Testuale Associato", value: `<#${channel.id}>`, inline: true },
            { name: "🌐 Rilevamento Lingua", value: "Automatico (IT / EN)", inline: true }
          )
          .setFooter({ text: "Usa /tts say per parlare subito • /tts leave per disconnettere" })
          .setTimestamp();

        return interaction.editReply({ embeds: [joinEmbed] });
      }

      // ── SUBCOMMAND: /tts leave ────────────────────────────────────────────
      if (subcommand === "leave") {
        const session = activeTtsSessions.get(guild.id);
        if (!session) {
          return interaction.reply({
            content: "❌ Il bot TTS non è attualmente connesso a nessun canale vocale in questo server.",
            ephemeral: true
          });
        }

        session.disconnect("Disconnesso via /tts leave");
        return interaction.reply({
          content: "👋 Mi sono disconnesso dal canale vocale e ho resettato la coda TTS!",
          ephemeral: false
        });
      }

      // ── SUBCOMMAND: /tts say ──────────────────────────────────────────────
      if (subcommand === "say") {
        const rawText = options.getString("testo", true);
        const langChoice = options.getString("lingua") || "auto";

        const userVoiceChannel = member?.voice?.channel;
        let session = activeTtsSessions.get(guild.id);

        if (!session || !session.connection) {
          if (!userVoiceChannel) {
            return interaction.reply({
              content: "❌ Devi essere connesso a un canale vocale per usare questo comando!",
              ephemeral: true
            });
          }

          // Verify bot voice permissions
          const botMember = guild.members.me || (client.user ? guild.members.cache.get(client.user.id) : null);
          if (botMember) {
            const perms = userVoiceChannel.permissionsFor(botMember);
            if (perms && !perms.has(PermissionFlagsBits.Connect)) {
              return interaction.reply({
                content: "❌ Non ho il permesso di connettermi al tuo canale vocale (Connect mancante).",
                ephemeral: true
              });
            }
            if (perms && !perms.has(PermissionFlagsBits.Speak)) {
              return interaction.reply({
                content: "❌ Non ho il permesso di parlare nel tuo canale vocale (Speak mancante).",
                ephemeral: true
              });
            }
          }

          await interaction.deferReply();
          session = await getOrCreateTtsSession(guild, userVoiceChannel, channel, ttsConfig);
        } else {
          await interaction.deferReply();
        }

        const memberLookup = (id) => {
          const m = guild.members.cache.get(id);
          return m ? (m.displayName || m.user.username) : null;
        };

        const cleaned = cleanTextForTts(rawText, memberLookup);
        if (!cleaned) {
          return interaction.editReply({
            content: "❌ Il testo inserito non contiene caratteri validi da pronunciare."
          });
        }

        const item = session.enqueue(cleaned, langChoice, member, channel.id);
        const langFlag = item.lang === "en" ? "🇬🇧 English" : "🇮🇹 Italiano";
        const langNotice = langChoice === "auto" ? `Rilevata automaticamente: **${langFlag}**` : `Impostata: **${langFlag}**`;

        const sayEmbed = new EmbedBuilder()
          .setTitle("🗣️ Messaggio TTS Inserito")
          .setDescription(`> "${item.text}"`)
          .setColor("#57F287")
          .addFields(
            { name: "🌐 Lingua", value: langNotice, inline: true },
            { name: "👤 Richiesto da", value: `<@${member.id}>`, inline: true },
            { name: "📜 Posizione Coda", value: `${session.queue.length}`, inline: true }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [sayEmbed] });
      }

      // ── SUBCOMMAND: /tts auto ─────────────────────────────────────────────
      if (subcommand === "auto") {
        const attivo = options.getBoolean("attivo", true);
        const targetChannel = options.getChannel("canale") || channel;

        let session = activeTtsSessions.get(guild.id);
        if (session) {
          session.autoTts = attivo;
          session.textChannel = targetChannel;
        }

        const autoEmbed = new EmbedBuilder()
          .setTitle("⚙️ Modalità Auto-TTS")
          .setDescription(
            attivo
              ? `✅ Lettura automatica **attivata** per il canale <#${targetChannel.id}>!\nI messaggi degli utenti connessi in vocale verranno letti automaticamente.`
              : `⏸️ Lettura automatica **disattivata**. I messaggi scritti non verranno più letti automaticamente.`
          )
          .setColor(attivo ? "#57F287" : "#ED4245")
          .setTimestamp();

        return interaction.reply({ embeds: [autoEmbed] });
      }

      // ── SUBCOMMAND: /tts stop ─────────────────────────────────────────────
      if (subcommand === "stop") {
        const session = activeTtsSessions.get(guild.id);
        if (!session) {
          return interaction.reply({
            content: "❌ Nessuna sessione TTS attiva al momento.",
            ephemeral: true
          });
        }

        session.stop();
        return interaction.reply({
          content: "🛑 Riproduzione TTS interrotta e coda svuotata con successo!",
          ephemeral: false
        });
      }

      // ── SUBCOMMAND: /tts queue ────────────────────────────────────────────
      if (subcommand === "queue") {
        const session = activeTtsSessions.get(guild.id);
        if (!session || (!session.isSpeaking && session.queue.length === 0)) {
          return interaction.reply({
            content: "📭 La coda TTS è attualmente vuota.",
            ephemeral: true
          });
        }

        let desc = session.isSpeaking
          ? `🔊 **In riproduzione:** "${session.queue[0]?.text || "Audio in corso..."}"\n\n`
          : "⏸️ Nessun messaggio in riproduzione.\n\n";

        if (session.queue.length > 1) {
          desc += "**Messaggi in coda:**\n";
          session.queue.slice(1, 10).forEach((item, idx) => {
            const flag = item.lang === "en" ? "🇬🇧" : "🇮🇹";
            desc += `\`${idx + 1}.\` ${flag} <@${item.author?.id || "N/A"}>: "${item.text.slice(0, 50)}${item.text.length > 50 ? '...' : ''}"\n`;
          });
          if (session.queue.length > 10) {
            desc += `\n*...altri ${session.queue.length - 10} messaggi in attesa.*`;
          }
        }

        const queueEmbed = new EmbedBuilder()
          .setTitle("📜 Coda di Riproduzione TTS")
          .setDescription(desc)
          .setColor("#5865F2")
          .addFields(
            { name: "👥 Canale Vocale", value: `<#${session.voiceChannel?.id}>`, inline: true },
            { name: "💬 Canale Testo", value: `<#${session.textChannel?.id}>`, inline: true },
            { name: "📊 Totale Coda", value: `${session.queue.length} messaggi`, inline: true }
          )
          .setTimestamp();

        return interaction.reply({ embeds: [queueEmbed] });
      }

      // ── SUBCOMMAND: /tts help ─────────────────────────────────────────────
      if (subcommand === "help") {
        const helpEmbed = new EmbedBuilder()
          .setTitle("🎙️ Guida Completa TTS BOT (Text-To-Speech)")
          .setDescription(
            "Il bot TTS converte i tuoi messaggi in voce ad alta fedeltà con **rilevamento automatico intelligente tra Italiano 🇮🇹 e Inglese 🇬🇧**."
          )
          .setColor("#5865F2")
          .addFields(
            {
              name: "🚀 Comandi Principali",
              value:
                "• `/tts join` - Connette il bot al tuo canale vocale e attiva l'auto-lettura dei messaggi.\n" +
                "• `/tts leave` - Disconnette il bot dal canale vocale.\n" +
                "• `/tts say <testo> [lingua]` - Pronuncia un testo subito con pronuncia IT o EN.\n" +
                "• `/tts auto <attivo>` - Attiva o disattiva la lettura automatica dei messaggi.\n" +
                "• `/tts stop` - Ferma la voce corrente e azzera la coda.\n" +
                "• `/tts queue` - Mostra i messaggi in attesa nella coda TTS."
            },
            {
              name: "🧠 Come funziona il Rilevamento Lingua?",
              value:
                "Non serve scegliere la lingua manualmente! Scrivi normalmente in chat:\n" +
                "• Se scrivi in italiano (*es. \"ciao a tutti come va stasera\"*), userà la voce italiana nativa.\n" +
                "• Se scrivi in inglese (*es. \"hey guys see you later tonight\"*), userà la voce inglese perfetta!\n" +
                "• Gestisce senza intoppi numeri, punteggiatura, emoji e menzioni."
            },
            {
              name: "💡 Modalità Auto-TTS",
              value:
                "Quando il bot è in chiamata, basta scrivere nel canale testuale associato e il bot leggerà automaticamente i messaggi di chi è in vocale!"
            }
          )
          .setFooter({ text: "RoomUp! Bot V2 • Voice Engine & TTS Module" })
          .setTimestamp();

        return interaction.reply({ embeds: [helpEmbed], ephemeral: true });
      }

    } catch (err) {
      console.error("[TTSEngine] Errore esecuzione comando /tts:", err.message);
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "❌ Si è verificato un errore durante l'esecuzione del comando TTS.", ephemeral: true }).catch(() => null);
      }
    }
  });

  console.log("[TTSEngine] Modulo TTS BOT (Auto Language Detection IT/EN & Queue) attivo!");
}

module.exports = {
  initTtsEngine,
  detectLanguage,
  cleanTextForTts,
  chunkText,
  fetchTtsAudioStream,
  activeTtsSessions,
  GuildTtsSession
};
