const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection
} = require("@discordjs/voice");
const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const play = require("play-dl");

// Map of Guild Queues: guildId -> GuildMusicQueue
const queues = new Map();

/**
 * GuildMusicQueue represents the state and queue for a specific guild
 */
class GuildMusicQueue {
  constructor(guildId, voiceChannel, textChannel, config = {}) {
    this.guildId = guildId;
    this.voiceChannel = voiceChannel;
    this.textChannel = textChannel;
    this.songs = [];
    this.player = createAudioPlayer();
    this.connection = null;
    this.isPlaying = false;
    this.isPaused = false;
    this.volume = config.defaultVolume || 80;
    this.currentResource = null;
    this.currentSong = null;
    this.loopMode = "off"; // "off" | "track" | "queue"
    this.idleTimer = null;
    this.ttsActive = false;
    this.preTtsVolume = this.volume;
    this.config = config;

    this.setupPlayerListeners();
  }

  setupPlayerListeners() {
    this.player.on(AudioPlayerStatus.Idle, () => {
      this.handleTrackEnd();
    });

    this.player.on("error", (err) => {
      console.error(`[MusicEngine] Errore AudioPlayer (Guild: ${this.guildId}):`, err.message);
      if (this.textChannel) {
        this.textChannel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("⚠️ Errore Riproduzione Audio")
              .setDescription(`Si è verificato un errore durante la riproduzione di **${this.currentSong?.title || "Brano"}**.\nPassaggio al prossimo brano in coda...`)
              .setColor(0xf23f43)
          ]
        }).catch(() => {});
      }
      this.handleTrackEnd();
    });
  }

  handleTrackEnd() {
    if (this.loopMode === "track" && this.currentSong) {
      // Replay same song
      this.playSong(this.currentSong);
      return;
    }

    if (this.loopMode === "queue" && this.currentSong) {
      // Re-add to back of queue
      this.songs.push(this.currentSong);
    }

    if (this.songs.length > 0) {
      const nextSong = this.songs.shift();
      this.playSong(nextSong);
    } else {
      this.isPlaying = false;
      this.currentSong = null;
      this.currentResource = null;
      this.resetIdleTimer();
    }
  }

  resetIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    const timeoutSec = this.config.autoLeaveTimeout ?? 180;
    if (timeoutSec > 0) {
      this.idleTimer = setTimeout(() => {
        if (!this.isPlaying && this.songs.length === 0) {
          this.destroy("Inattività - coda vuota");
        }
      }, timeoutSec * 1000);
    }
  }

  clearIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  async playSong(song) {
    this.clearIdleTimer();
    this.currentSong = song;

    try {
      let stream;
      let streamType;

      if (song.url.startsWith("http://") || song.url.startsWith("https://")) {
        if (play.yt_validate(song.url) === "video" || song.url.includes("youtube.com") || song.url.includes("youtu.be")) {
          const streamInfo = await play.stream(song.url);
          stream = streamInfo.stream;
          streamType = streamInfo.type;
        } else if (song.url.includes("soundcloud.com")) {
          const streamInfo = await play.stream(song.url);
          stream = streamInfo.stream;
          streamType = streamInfo.type;
        } else {
          // Direct audio webstream / MP3 link
          const streamInfo = await play.stream(song.url).catch(() => null);
          if (streamInfo) {
            stream = streamInfo.stream;
            streamType = streamInfo.type;
          } else {
            // Raw stream
            stream = song.url;
          }
        }
      } else {
        // Search term
        const searchResults = await play.search(song.url, { limit: 1 });
        if (searchResults && searchResults.length > 0) {
          const streamInfo = await play.stream(searchResults[0].url);
          stream = streamInfo.stream;
          streamType = streamInfo.type;
          song.title = searchResults[0].title || song.title;
          song.duration = searchResults[0].durationRaw || song.duration;
          song.thumbnail = searchResults[0].thumbnails?.[0]?.url || song.thumbnail;
        } else {
          throw new Error("Nessun risultato trovato per la ricerca.");
        }
      }

      this.currentResource = createAudioResource(stream, {
        inputType: streamType,
        inlineVolume: true
      });

      // Apply current volume
      const currentVol = (this.ttsActive ? this.config.ttsDuckingVolume || 20 : this.volume) / 100;
      this.currentResource.volume?.setVolume(currentVol);

      this.player.play(this.currentResource);
      this.isPlaying = true;
      this.isPaused = false;

      // Ensure connection is subscribed
      if (this.connection && this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
        this.connection.subscribe(this.player);
      }

      // Send now playing announcement
      if (this.textChannel) {
        const color = this.config.embedColor ? parseInt(this.config.embedColor.replace("#", ""), 16) : 0x5865F2;
        const nowPlayingTitle = this.config.nowPlayingTemplate || "🎵 In Riproduzione";
        const embed = new EmbedBuilder()
          .setTitle(nowPlayingTitle)
          .setDescription(`[**${song.title}**](${song.url || "https://roomup.it"})\n\n⏱️ **Durata:** \`${song.duration || "Sconosciuta"}\`\n👤 **Richiesto da:** <@${song.requesterId}>`)
          .setColor(color)
          .setFooter({ text: `Volume: ${this.volume}% • Modalità TTS: ${this.config.ttsCoexistenceMode || "duck"}` });

        if (song.thumbnail) embed.setThumbnail(song.thumbnail);

        this.textChannel.send({ embeds: [embed] }).catch(() => {});
      }
    } catch (err) {
      console.error(`[MusicEngine] Errore avvio brano:`, err.message);
      if (this.textChannel) {
        this.textChannel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("❌ Errore Caricamento Brano")
              .setDescription(`Impossibile riprodurre **${song.title}**: ${err.message}`)
              .setColor(0xf23f43)
          ]
        }).catch(() => {});
      }
      this.handleTrackEnd();
    }
  }

  setVolume(newVolume) {
    this.volume = Math.max(1, Math.min(100, newVolume));
    if (!this.ttsActive && this.currentResource?.volume) {
      this.currentResource.volume.setVolume(this.volume / 100);
    }
    return this.volume;
  }

  pause() {
    if (this.isPlaying && !this.isPaused) {
      this.player.pause();
      this.isPaused = true;
      return true;
    }
    return false;
  }

  resume() {
    if (this.isPlaying && this.isPaused) {
      this.player.unpause();
      this.isPaused = false;
      return true;
    }
    return false;
  }

  skip() {
    if (this.isPlaying) {
      this.player.stop();
      return true;
    }
    return false;
  }

  stop() {
    this.songs = [];
    this.isPlaying = false;
    this.isPaused = false;
    this.currentSong = null;
    this.currentResource = null;
    this.player.stop();
    this.destroy("Riproduzione interrotta dall'utente");
  }

  /**
   * TTS Coexistence Event Handler
   * Adapts music playback dynamically when TTS bot speaks or stops speaking.
   */
  handleTtsEvent(eventType) {
    const mode = this.config.ttsCoexistenceMode || "duck";

    if (eventType === "start") {
      this.ttsActive = true;
      if (mode === "pause") {
        this.pause();
      } else if (mode === "duck") {
        this.preTtsVolume = this.volume;
        const duckVol = (this.config.ttsDuckingVolume ?? 20) / 100;
        if (this.currentResource?.volume) {
          this.currentResource.volume.setVolume(duckVol);
        }
      }
      // "independent" mode does nothing
    } else if (eventType === "end") {
      this.ttsActive = false;
      if (this.connection && this.isPlaying && this.player && this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
        try {
          this.connection.subscribe(this.player);
        } catch (e) {}
      }
      if (mode === "pause") {
        this.resume();
      } else if (mode === "duck") {
        const restoredVol = this.volume / 100;
        if (this.currentResource?.volume) {
          this.currentResource.volume.setVolume(restoredVol);
        }
      }
    }
  }

  destroy(reason = "Chiusura sessione audio") {
    this.clearIdleTimer();
    if (this.player) {
      this.player.stop();
    }
    let ttsActive = false;
    try {
      const { activeTtsSessions } = require("./ttsEngine");
      const ttsSession = activeTtsSessions ? activeTtsSessions.get(this.guildId) : null;
      ttsActive = Boolean(ttsSession && (ttsSession.isSpeaking || ttsSession.queue.length > 0));
    } catch (e) {}

    if (this.connection && !ttsActive) {
      try {
        if (this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
          this.connection.destroy();
        }
      } catch (e) {
        // Ignore connection destruction errors
      }
      this.connection = null;
    }
    this.isPlaying = false;
    this.currentSong = null;
    this.currentResource = null;
    this.songs = [];
    queues.delete(this.guildId);
  }
}

/**
 * Gets or creates the GuildMusicQueue
 */
async function getOrCreateQueue(guild, voiceChannel, textChannel, config) {
  let queue = queues.get(guild.id);
  if (!queue) {
    queue = new GuildMusicQueue(guild.id, voiceChannel, textChannel, config);
    queues.set(guild.id, queue);
  }

  // Update channels if changed
  queue.voiceChannel = voiceChannel;
  queue.textChannel = textChannel;
  queue.config = config;

  // Check or establish voice connection
  let connection = getVoiceConnection(guild.id);
  if (!connection || connection.state.status === VoiceConnectionStatus.Destroyed) {
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
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000)
        ]);
      } catch (error) {
        queue.destroy("Disconnesso dal canale vocale");
      }
    });

    connection.on("error", (err) => {
      console.error(`[MusicEngine] Errore VoiceConnection (Guild: ${guild.id}):`, err.message);
    });
  }

  queue.connection = connection;
  connection.subscribe(queue.player);

  return queue;
}

/**
 * Initialize Music Engine and register event listeners
 */
function initMusicEngine(client, loadSettingsFn) {
  // Voice state update listener to handle auto-leave when bot is left alone
  client.on("voiceStateUpdate", (oldState, newState) => {
    const guild = oldState.guild || newState.guild;
    if (!guild) return;

    const queue = queues.get(guild.id);
    if (!queue || !queue.connection) return;

    const botChannelId = queue.voiceChannel?.id;
    if (!botChannelId) return;

    const channel = guild.channels.cache.get(botChannelId);
    if (!channel) return;

    // Count non-bot members in the voice channel
    const humanMembers = channel.members.filter(m => !m.user.bot);
    if (humanMembers.size === 0 && queue.isPlaying) {
      // Nobody is listening, schedule auto-leave
      queue.resetIdleTimer();
    } else if (humanMembers.size > 0 && queue.idleTimer && queue.isPlaying) {
      // Humans returned, clear idle timer
      queue.clearIdleTimer();
    }
  });

  console.log("[MusicEngine] Modulo Bot Musica & Audio Coexistence pronto!");
}

/**
 * Helper to notify TTS events (ducking / pause)
 */
function notifyTtsEvent(guildId, eventType) {
  const queue = queues.get(guildId);
  if (queue) {
    queue.handleTtsEvent(eventType);
    return true;
  }
  return false;
}

/**
 * Helper to check DJ permission
 */
function isDjOrAdmin(member, musicConfig) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator) || member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return true;
  }
  if (!musicConfig.djRoleId) {
    return true; // No DJ role required
  }
  return member.roles.cache.has(musicConfig.djRoleId);
}

module.exports = {
  initMusicEngine,
  getOrCreateQueue,
  notifyTtsEvent,
  isDjOrAdmin,
  queues,
  GuildMusicQueue
};
