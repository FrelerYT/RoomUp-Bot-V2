---
description: Standard di Coesistenza Audio tra Bot Musica e Voice TTS per RoomUp Discord
always_on: true
---

# Standard di Coesistenza Audio: Bot Musica & Voice TTS (RoomUp Architecture)

## 1. Principio di Non-Interferenza Vocale
Quando molteplici entità bot o servizi audio operano all'interno dello stesso ecosistema o dello stesso canale vocale Discord (es. Bot Musica RoomUp V2 e Voice TTS RoomUp V1):
- **Coesistenza Trasparente**: I bot devono poter operare sia simultaneamente che in maniera isolata, senza conflitti di Gateway o collisioni di VoiceConnection.
- **Supporto Multi-Client**: Discord consente a più bot distinti di risiedere nello stesso canale vocale contemporaneamente. Ogni client gestisce la propria sessione UDP/Websocket indipendentemente.

## 2. Modalità di Coesistenza TTS Configurabili
La gestione audio musicale deve esporre tre modalità selezionabili dal server admin nella dashboard:
1. **Audio Ducking (`duck`) [Predefinita]**:
   - All'attivazione del parlato TTS (`notifyTtsEvent(guildId, 'start')`), il volume della musica in riproduzione viene automaticamente abbassato al valore `ttsDuckingVolume` (es. dal default 80% al 20%).
   - Al termine della sintesi TTS (`notifyTtsEvent(guildId, 'end')`), il volume musicale viene ripristinato istantaneamente e senza salti al livello predefinito configurato dall'utente.
2. **Pausa Automatica (`pause`)**:
   - All'inizio del parlato TTS, il player musicale viene posto in pausa (`player.pause()`).
   - Al termine del TTS, la riproduzione riprende automaticamente dal punto in cui era stata interrotta (`player.unpause()`).
3. **Indipendente (`independent`)**:
   - La musica continua a essere riprodotta a volume invariato anche se sono attive comunicazioni TTS vocali.

## 3. Gestione Resiliente di VoiceConnection & Coda Brani
- **Riuso della Connessione**: Verificare sempre `getVoiceConnection(guildId)` prima di istanziare una nuova connessione vocale per evitare stati orfani.
- **Riconnessione & Timeout**:
  - Quando il canale vocale si svuota di utenti umani, avviare un timer di inattività configurabile (`autoLeaveTimeout`, default 180s).
  - Se gli utenti ritornano prima della scadenza, cancellare il timer e continuare la sessione.
  - In caso di espulsione o disconnessione forzata da parte di Discord, liberare la memoria della coda (`queue.destroy()`) ed evitare crash non gestiti.
- **Gerarchia Permessi DJ**:
  - Se configurato un `djRoleId`, comandi distruttivi o privilegiati (`/skip`, `/stop`, `/volume`) devono essere riservati ai membri con tale ruolo o con permessi di Amministrazione / Gestione Server.
