/**
 * welcomeReactions.js
 * Modulo per il bot Linea Temporale:
 * Aggiunge automaticamente le reazioni (👋 e 🎉) ai messaggi degli utenti
 * che contengono formule di benvenuto ("welcome", "wlc", "benvenuti", ecc.)
 * all'interno dei canali salotto / benvenuto.
 */

const EMOJIS = ['👋', '🎉'];

function matchesWelcome(text) {
  if (!text) return false;
  const clean = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const words = clean.split(/\s+/).filter(Boolean);
  return words.some(w => {
    if (w.startsWith('welcom') || w === 'wlc' || w === 'wlcm') return true;
    if (w.startsWith('benvenut')) return true;
    return false;
  });
}

function isWelcomeChannel(channel) {
  if (!channel) return false;
  
  // ID canali noti
  const knownIds = [
    '1550847044858679326', // RoomUp! #🛋️・salotto
    '1549522276431433799', // Strange Place #：🚪ㆍsalotto
    '1541515219598188644'  // RoomUp! TEST #🛋️・salotto
  ];
  if (knownIds.includes(channel.id)) return true;

  // Controllo basato sul nome canale
  if (channel.name) {
    const name = channel.name.toLowerCase();
    if (name.includes('salotto') || name.includes('welcome') || name.includes('benvenut')) {
      return true;
    }
  }

  return false;
}

function initWelcomeReactions(client) {
  client.on('messageCreate', async (message) => {
    try {
      // Ignora messaggi fuori dai server o generati da bot
      if (!message.guild || message.author.bot) return;

      // Solo canali salotto / benvenuto
      if (!isWelcomeChannel(message.channel)) return;

      // Verifica se il messaggio contiene un benvenuto
      if (!matchesWelcome(message.content)) return;

      // Reagisci sequenzialmente con 👋 e 🎉
      for (const emoji of EMOJIS) {
        await message.react(emoji).catch(err => {
          console.warn(`[WelcomeReactions] Impossibile aggiungere reazione ${emoji}:`, err.message);
        });
      }
    } catch (err) {
      console.error('[WelcomeReactions] Errore:', err.message);
    }
  });

  console.log('[WelcomeReactions] Motore reazioni di benvenuto attivo (👋 🎉 sui canali salotto)!');
}

module.exports = {
  initWelcomeReactions,
  matchesWelcome,
  isWelcomeChannel,
  EMOJIS
};
