const { readJsonSafe, writeJsonSafe } = require("../../core/storage");
const eventBus = require("../../core/eventBus");

function getRepStorage() {
  return readJsonSafe("reputation", {
    scores: {},  // { `${guildId}_${userId}`: 5 }
    history: []  // [ { guildId, fromUserId, toUserId, reason, timestamp } ]
  });
}

function saveRepStorage(data) {
  return writeJsonSafe("reputation", data);
}

function giveReputation(guildId, fromUserId, toUserId, reason = "+rep per disponibilità") {
  if (fromUserId === toUserId) {
    return { success: false, error: "Non puoi dare punti reputazione a te stesso!" };
  }

  const storage = getRepStorage();
  const COOLDOWN = 24 * 60 * 60 * 1000;
  const now = Date.now();

  const lastGiven = storage.history.find(h => h.guildId === guildId && h.fromUserId === fromUserId);
  if (lastGiven && (now - new Date(lastGiven.timestamp).getTime()) < COOLDOWN) {
    const rem = COOLDOWN - (now - new Date(lastGiven.timestamp).getTime());
    return { success: false, error: "Devi attendere prima di dare un altro punto reputazione.", remainingMs: rem };
  }

  const targetKey = `${guildId}_${toUserId}`;
  storage.scores[targetKey] = (storage.scores[targetKey] || 0) + 1;

  storage.history.unshift({
    guildId,
    fromUserId,
    toUserId,
    reason,
    timestamp: new Date().toISOString()
  });

  saveRepStorage(storage);

  eventBus.emit("reputation.given", { guildId, fromUserId, toUserId, newScore: storage.scores[targetKey] });
  return { success: true, newScore: storage.scores[targetKey] };
}

function getUserReputation(guildId, userId) {
  const storage = getRepStorage();
  return storage.scores[`${guildId}_${userId}`] || 0;
}

function getLeaderboard(guildId, limit = 10) {
  const storage = getRepStorage();
  const prefix = `${guildId}_`;
  const list = [];

  for (const key of Object.keys(storage.scores)) {
    if (key.startsWith(prefix)) {
      list.push({ userId: key.replace(prefix, ""), rep: storage.scores[key] });
    }
  }

  return list.sort((a, b) => b.rep - a.rep).slice(0, limit);
}

module.exports = {
  giveReputation,
  getUserReputation,
  getLeaderboard,
  getRepStorage
};