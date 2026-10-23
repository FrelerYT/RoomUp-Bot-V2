---
description: Standard di Personalizzazione Totale 100% e Switch Granulari per RoomUp! Bot V2
always_on: true
---

# Standard di Personalizzazione Totale 100% e Switch Granulari per RoomUp! Bot V2

## 1. Principio Fondamentale: Zero Stringhe Cablate (Zero Hardcoding)
- **100% dei Messaggi ed Embed Modificabili**: Nessun messaggio o embed inviato dal bot deve contenere testi, titoli, descrizioni, footer o colori fissi nel codice.
- **Parametri Esposti su Dashboard**:
  - `enabled`: Toggle on/off dedicato per ogni singolo modulo, sotto-modulo ed evento.
  - `useEmbed`: Scelta tra messaggio testuale semplice o embed ricco.
  - `embedTitle`: Titolo personalizzabile con supporto a variabili.
  - `message` / `embedDescription`: Corpo del testo/descrizione formattabile.
  - `embedColor`: Selettore colore HEX + palette preset.
  - `embedFooterText`: Testo personalizzato per il footer.
  - `showThumbnail`: Toggle per includere o escludere avatar o immagini.
- **Sistema di Variabili e Placeholder Standard**:
  - `{user}`: Menzione utente <@id>
  - `{username}`: Nome utente Discord
  - `{tag}`: Tag utente completo
  - `{guild}`: Nome del server
  - `{memberCount}`: Numero totale di membri
  - `{level}`, `{xp}`, `{rank}`: Dati del sistema livelli
  - `{reason}`, `{moderator}`: Dati per sanzioni e moderazione
  - `{channel}`: Menzione o nome canale

## 2. Granularità Totale degli Interruttori (Toggles)
- **Ogni Azione deve essere Indipendente**:
  - In **AutoMod**: Switch separati per Delete Messaggio, Avviso Chat, Avviso DM privato, Timeout automatico e Invio Log.
  - In **Minigiochi**: Switch on/off individuale per ognuno dei 14 giochi (Trivia, Math, RPS, Slots, Blackjack, Più Alto, Mystery Box, Gratta e Vinci, Ruota, Indovina, Dadi, Tris, Coinflip, Meme).
  - In **Ticket**: Switch separati per Claim, Close, Conferma Chiusura, Generazione Transcript HTML, Invio Transcript in DM, Sondaggio Valutazione a stelle (Rating).
  - In **Verifica**: Switch separati per Ruolo Non Verificato, Notifica DM, Nascondi Canale, Invio Log.
  - In **Livelli**: Switch separati per Guadagno XP Chat, Guadagno XP Vocale, Annuncio Canale vs DM vs Corrente, Ruoli Ricompensa.
  - In **Anti-Raid / Anti-Nuke**: Switch separati per ogni filtro di screening, lockdown automatico, revoca ruoli e notifiche DM.
  - In **Suggerimenti / Giveaway / Starboard / Counting**: Switch individuali per voti, thread automatici, reazioni e DM ai vincitori.

## 3. Coerenza tra Backend e Frontend
- Qualsiasi nuovo campo aggiunto a `settingsManager.js` DEVE avere il rispettivo input/switch nel template `dashboard.ejs` e deve essere inviato nella chiamata POST `/api/dashboard/:guildId/save`.
- Il metodo `getGuildConfig` in `settingsManager.js` deve applicare un deep-merge automatico con i valori predefiniti per garantire retrocompatibilità istantanea senza rompere configurazioni server esistenti.
