---
description: Standard estetici e copertura per il sistema di Audit Logging Discord (157+ eventi)
globs: ["src/bot/loggerEngine.js", "src/bot/**/*.js", "src/web/**/*.js"]
---

# Standard Estetico e Copertura Audit Logs Discord

## 1. Invarianti Estetiche dei Log Discord (Fedeltà 1:1)
Ogni payload di log generato dal bot deve rispettare rigorosamente le seguenti linee guida visive:
1. **Citazione Continua (`> ` Blockquote)**:
   - Tutte le righe del blocco descrittivo principale devono iniziare con `> ` per generare la linea verticale continua grigia sul fianco sinistro.
2. **Campi ed Etichette in Grassetto**:
   - La label di ogni attributo deve essere in grassetto (es. `> **Utente:**`, `> **Canale:**`, `> **Scadenza Invito:**`).
3. **Riquadri di Codice Inline (Backticks `) per Dati Tecnici e Temporali**:
   - ID Discord: `${id}`
   - Codici invito: `${code}`
   - Tempi relativi calcolati: `${stayText}`, `${accountCreated}`
   - Valori esadecimali e nomi tecnici: `${hexColor}`, `${channelName}`
4. **Blocchi Diff Markdown per Modifiche e Valori Aggiunti/Rimossi**:
   - Variazioni (es. canali, ruoli, server, messaggi):
     ```diff
     - Prima: ...
     + Dopo: ...
     ```
   - Creazioni: `+ ...`
   - Eliminazioni: `- ...`
5. **Colori Semantici Discord**:
   - Aggiunta / Creazione / Ingresso: Verde `#57F287`
   - Rimozione / Eliminazione / Uscita: Rosso `#ED4245`
   - Modifica / Cambio Stato: Ambra `#F0B232` o Giallo `#FEE75C`
   - Informazioni / Server / Sistema: Blurple `#5865F2`
   - Colore Ruoli: Colore esadecimale dinamico del ruolo (`role.hexColor`)
6. **Piè di Pagina (Footer)**:
   - Formato obbligatorio: `@username • DD/MM/YYYY HH:MM`
   - Icona avatar dell'autore/esecutore sempre inclusa.
7. **Miniatura (Thumbnail)**:
   - Avatar dell'utente interessato, avatar del moderatore, icona del server o immagine emoji in alto a destra.

## 2. Copertura Completa Multi-Canale Logistica
Tutti gli eventi Discord.js e gli audit log devono essere mappati e instradati verso i canali dedicati:
- `#〽️・uscite-entrate`: `memberJoin`, `memberLeave`
- `#💬・messaggi`: `messageCreate`, `messageDelete`, `messageUpdate`, `messageDeleteBulk`
- `#🏠・canali`: `channelCreate`, `channelDelete`, `channelUpdate`, `channelPinsUpdate`
- `#🔊・vocali`: `voiceJoin`, `voiceLeave`, `voiceSwitch`, `voiceMuteDeaf`, `voiceStream`, `voiceVideo`
- `#🧑‍🤝‍🧑・membri`: `memberNickUpdate`, `memberTimeout`, `memberVerify`, `userUpdate`
- `#🧢・ruoli`: `roleCreate`, `roleDelete`, `roleUpdate`, `memberRoleAdd`, `memberRoleRemove`
- `#🎭・automod`: `autoModAction`, `autoModRuleCreate`, `autoModRuleDelete`, `autoModRuleUpdate`
- `#🛅・moderazione`: `banAdd`, `banRemove`, `memberKick`, `memberTimeout`
- `#🗄️・altro`: `serverUpdate`, `inviteCreate`, `inviteDelete`, `emojiCreate`, `emojiDelete`, `emojiUpdate`, `stickerCreate`, `stickerDelete`, `stickerUpdate`, `threadCreate`, `threadDelete`, `threadUpdate`, `stageCreate`, `stageDelete`, `stageUpdate`, `eventCreate`, `eventDelete`, `eventUpdate`, `webhookUpdate`, `integrationUpdate`
- Fallback universale: cattura di tutti gli ulteriori eventi via `GuildAuditLogEntryCreate`.
