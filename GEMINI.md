# RoomUp V2 & Sentinel Autonomous Staff System Rules

## 1. Staff Hierarchy & Subentro Deterministico (Takeover)
- **Rilevamento Prioritario**: Intercettare determinatamente comandi e takeover prima di qualsiasi inferenza LLM.
- **Silenzio al 100% in Takeover**: Quando uno staffer prende il controllo ("ci penso io", "faccio io", "lascia a me"), Sentinel passa istantaneamente in `AI_PASSIVE` / `STAFF_TAKEOVER` inviando ZERO messaggi. Non inviare mai conferme verbali robotiche.
- **Cancellazione In-Flight**: Su takeover o chiusura staff, abortire immediatamente qualsiasi token o risposta AI in corso di generazione per il ticket.
- **Ripresa Naturale**: Riprendere il controllo esclusivamente su handover esplicito dello staff ("continua tu", "riprendi il ticket").

## 2. Esecuzione Reale dei Tool (Niente Risposte Fittizie)
- **Pipeline Controllata**: Comandi come chiusura e riapertura ticket devono eseguire i tool reali (`close_ticket`, `reopen_ticket`) passando attraverso `ActionGuard` (pre-flight), `ToolEngine` (API Discord) e `ActionVerifier` (post-flight).
- **Protezione Canali**: Non eseguire mai `close_ticket` su canali generici non-ticket.
- **Isolamento Ticket Chiusi**: Canali con stato `CLOSED` rifiutano mutazioni e rimangono isolati finché lo staff non ordina la riapertura.

## 3. Formato Pubblicazione Partnership (Grafica Moderna Senza Rank)
- **Nessun Rank**: Non includere contatori di rank, livelli o statistiche.
- **Messaggio 1 (Descrizione)**: Inviare in formato testo normale (plain text nativo) per consentire l'espansione automatica dell'invito con il widget "Unisciti". Disabilitare il parse delle menzioni globali.
- **Messaggio 2 (Info Box)**: Embed color viola (#8A5CF6) con notifica del ruolo configurato nel campo content e struttura ad albero:
  ├ Autore: <@id>
  ├ Server: Nome Server
  ├ Staff: <@id>
  ├ Ping: <@&id>
  └ Partner: #numero

## 4. Comunicazione, Zero Jargon & Prevenzione Loop
- **Zero Jargon**: Non pronunciare mai costanti di codice o stati interni (es. STAFF_TAKEOVER, RESOLVED, problema 600, AI_ACTIVE) nelle conversazioni con utenti o staff.
- **Risposta a Frè & Staff**: Quando il Founder o lo staff interpellano il bot ("@RoomUp!", "che succede"), fornire subito un briefing umano, chiaro e contestuale.
- **Anti-Duplicazione**: Una volta approvata o pubblicata una partnership, le domande di follow-up (anche con refusi come "hna domanda" o "dkamnda") ricevono risposta esplicativa senza mai re-innescare pubblicazioni o messaggi ciclici a catena.

## 5. Memoria, Regole e Multi-Tenancy
- **Regole vs Memoria Volatile**: Salvare le direttive permanenti dello staff in `learnedRules` del `MemoryEngine`, recuperandole nei ticket successivi.
- **Isolamento Rigoroso**: Memorie, regole, audit e configurazioni devono essere rigorosamente isolate per `guildId`.

## 6. Regole di Logging & Audit Log Discord (Instradamento & Zero Jargon)
- **Instradamento Rigoroso per Categoria**:
  - `messages` -> `#💬・messaggi` (Messaggi eliminati, modificati, fissati). Mai in moderazione.
  - `moderation` -> `#🛅・moderazione` (Esclusivamente Sanzioni: Ban, Sbannati, Espulsioni, Timeout, Prune).
  - `server` -> `#🗄️・altro` (Guida del server, Onboarding, Profilo server, Inviti, Emoji, Webhook, Integrazioni).
  - `voice` -> `#🔊・vocali` (Ingressi, uscite, spostamenti tra stanze, stato vocale).
  - `channels` -> `#🏠・canali` (Creazione, modifica ed eliminazione canali e permessi).
  - `roles` -> `#🧢・ruoli` (Creazione, modifica ed eliminazione ruoli, ruoli aggiunti/rimossi).
- **Divieto Assoluto di Numeri o Codici Grezzi**:
  - Mai mostrare nei titoli o nelle descrizioni diciture come `Azione 191`, `Azione 211`, `Azione <numero>` o id grezzi.
  - Indicare sempre direttamente e in italiano naturale cosa è successo: es. *"Guida del Server / Home Aggiornata"*, *"Profilo Server (Caratteristiche / Tag) Aggiornato"*.
- **Nessun Errore di Ignoranza o Incertezza**:
  - Vietato scrivere "Non lo so", "Errore" o "Azione Sconosciuta". Analizzare target e modifiche per generare una descrizione coerente e professionale.
- **Formattazione Modifiche Pulita**:
  - Estrarre etichette leggibili (`title`, `label`, `name`) per array e oggetti (es. `new_member_actions`, `traits`), evitando di scaricare JSON troncati nel blocco diff.

