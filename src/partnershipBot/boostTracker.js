const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const BOOSTS_FILE = path.join(DATA_DIR, 'user_boosts.json');

// Assicura che la directory data esista
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper lettura store boost
function loadUserBoosts() {
  try {
    if (!fs.existsSync(BOOSTS_FILE)) {
      fs.writeFileSync(BOOSTS_FILE, JSON.stringify({}, null, 2), 'utf8');
      return {};
    }
    const raw = fs.readFileSync(BOOSTS_FILE, 'utf8');
    return JSON.parse(raw) || {};
  } catch (err) {
    console.error('[BoostTracker] Errore lettura user_boosts.json:', err.message);
    return {};
  }
}

// Helper salvataggio store boost
function saveUserBoosts(data) {
  try {
    fs.writeFileSync(BOOSTS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[BoostTracker] Errore salvataggio user_boosts.json:', err.message);
  }
}

// Ottiene il numero di boost salvati per un utente in un server
function getUserBoostCount(userId, guildId) {
  const allBoosts = loadUserBoosts();
  if (allBoosts[userId] && typeof allBoosts[userId][guildId] === 'number') {
    return allBoosts[userId][guildId];
  }
  return 0;
}

// Imposta il numero di boost per un utente in un server
function setUserBoostCount(userId, guildId, count) {
  const allBoosts = loadUserBoosts();
  if (!allBoosts[userId]) {
    allBoosts[userId] = {};
  }
  allBoosts[userId][guildId] = Math.max(0, parseInt(count, 10) || 0);
  saveUserBoosts(allBoosts);
  return allBoosts[userId][guildId];
}

// Rileva e aggiorna automaticamente il conteggio boost di un membro (NESSUN LIMITE MASSIMO)
async function detectUserBoostCount(guild, member) {
  if (!guild || !member) return 0;
  const userId = member.id;
  const guildId = guild.id;

  // Verifica se è effettivamente un booster
  const isBooster = Boolean(
    member.premiumSince ||
    (guild.roles.premiumSubscriberRole && member.roles.cache.has(guild.roles.premiumSubscriberRole.id)) ||
    member.roles.cache.some(r => r.name.toLowerCase().includes('booster'))
  );

  if (!isBooster) {
    setUserBoostCount(userId, guildId, 0);
    return 0;
  }

  // Base: chiunque ha il badge/ruolo booster di Discord Nitro ha di default almeno 2 boost
  let boostCount = Math.max(2, getUserBoostCount(userId, guildId));

  // Cerca nella cronologia dei messaggi di sistema se ci sono boost superiori o multipli
  try {
    if (guild.systemChannel) {
      const msgs = await guild.systemChannel.messages.fetch({ limit: 100 }).catch(() => null);
      if (msgs) {
        let detected = 0;
        const userBoostMsgs = msgs.filter(m => [8, 9, 10, 11].includes(m.type) && m.author && m.author.id === userId);
        userBoostMsgs.forEach(m => {
          const parsed = parseInt(m.content, 10);
          if (!isNaN(parsed) && parsed > 0) {
            detected += parsed;
          } else {
            detected += 1;
          }
        });
        if (detected > boostCount) {
          boostCount = detected;
        }
      }
    }
  } catch (e) {
    // Ignora errori di fetch e mantieni boostCount
  }

  // Memorizza il valore calcolato in user_boosts.json per persistenza
  setUserBoostCount(userId, guildId, boostCount);
  return boostCount;
}

// Registra i listener del client Discord per catturare in TEMPO REALE qualsiasi boost o variazione
function registerBoostEventListeners(client, onBoostUpdate) {
  if (!client) return;

  // 1. Nuovo messaggio di boost (singolo o multiplo: tipo 8, 9, 10, 11)
  client.on('messageCreate', async (message) => {
    try {
      if (!message.guild || !message.author) return;
      if (![8, 9, 10, 11].includes(message.type)) return;

      const guildId = message.guild.id;
      const userId = message.author.id;
      const parsed = parseInt(message.content, 10);
      let current = getUserBoostCount(userId, guildId);

      let newCount;
      if (parsed && parsed >= 2) {
        // Boost multiplo simultaneo (es. pacchetto da 3 boost)
        newCount = Math.max(current, parsed);
      } else {
        // Boost incrementale (aggiunta di un ulteriore boost)
        newCount = current > 0 ? (current + (parsed || 1)) : Math.max(2, (parsed || 1));
      }

      setUserBoostCount(userId, guildId, newCount);
      console.log(`[BoostTracker] Auto-rilevato nuovo boost per ${message.author.tag} (${userId}) su ${message.guild.name}: totale ${newCount} boost!`);

      if (typeof onBoostUpdate === 'function') {
        await onBoostUpdate(userId, guildId, newCount);
      }
    } catch (err) {
      console.error('[BoostTracker] Errore listener messageCreate boost:', err);
    }
  });

  // 2. Aggiornamento membro (es. ha iniziato o terminato di potenziare)
  client.on('guildMemberUpdate', async (oldMember, newMember) => {
    try {
      const guildId = newMember.guild.id;
      const userId = newMember.id;

      const wasBooster = Boolean(
        oldMember.premiumSince ||
        (oldMember.guild.roles.premiumSubscriberRole && oldMember.roles.cache.has(oldMember.guild.roles.premiumSubscriberRole.id)) ||
        oldMember.roles.cache.some(r => r.name.toLowerCase().includes('booster'))
      );

      const isBooster = Boolean(
        newMember.premiumSince ||
        (newMember.guild.roles.premiumSubscriberRole && newMember.roles.cache.has(newMember.guild.roles.premiumSubscriberRole.id)) ||
        newMember.roles.cache.some(r => r.name.toLowerCase().includes('booster'))
      );

      if (wasBooster && !isBooster) {
        // Ha tolto il boost
        setUserBoostCount(userId, guildId, 0);
        console.log(`[BoostTracker] Utente ${newMember.user.tag} (${userId}) non è più booster su ${newMember.guild.name}. Boost azzerati.`);
        if (typeof onBoostUpdate === 'function') {
          await onBoostUpdate(userId, guildId, 0);
        }
      } else if (!wasBooster && isBooster) {
        // È appena diventato booster: garantiti almeno 2 boost
        let count = getUserBoostCount(userId, guildId);
        if (count < 2) count = 2;
        setUserBoostCount(userId, guildId, count);
        console.log(`[BoostTracker] Utente ${newMember.user.tag} (${userId}) è ora booster su ${newMember.guild.name}: ${count} boost registrati.`);
        if (typeof onBoostUpdate === 'function') {
          await onBoostUpdate(userId, guildId, count);
        }
      }
    } catch (err) {
      console.error('[BoostTracker] Errore listener guildMemberUpdate boost:', err);
    }
  });

  // 3. Membro rimosso o uscito dal server
  client.on('guildMemberRemove', async (member) => {
    try {
      const guildId = member.guild.id;
      const userId = member.id;
      if (getUserBoostCount(userId, guildId) > 0) {
        setUserBoostCount(userId, guildId, 0);
        console.log(`[BoostTracker] Membro ${member.user.tag} uscito da ${member.guild.name}. Boost azzerati.`);
        if (typeof onBoostUpdate === 'function') {
          await onBoostUpdate(userId, guildId, 0);
        }
      }
    } catch (err) {
      console.error('[BoostTracker] Errore listener guildMemberRemove boost:', err);
    }
  });

  console.log('[BoostTracker] Listener automatici di monitoraggio boost Discord registrati con successo.');
}

module.exports = {
  loadUserBoosts,
  saveUserBoosts,
  getUserBoostCount,
  setUserBoostCount,
  detectUserBoostCount,
  registerBoostEventListeners
};
