const { readJsonSafe, writeJsonSafe } = require("../../core/storage");
const eventBus = require("../../core/eventBus");

function getQuestStorage() {
  return readJsonSafe("quests", {
    quests: [
      { id: "msg_50", name: "Chiacchierone del Giorno", targetType: "messages", targetCount: 50, rewardXp: 150, rewardCoins: 50 },
      { id: "win_game", name: "Campione dei Minigiochi", targetType: "game_wins", targetCount: 3, rewardXp: 200, rewardCoins: 80 },
      { id: "give_rep", name: "Generosità", targetType: "rep_given", targetCount: 1, rewardXp: 100, rewardCoins: 30 }
    ],
    progress: {} // { `${guildId}_${userId}`: { [questId]: { count: 12, claimed: false } } }
  });
}

function saveQuestStorage(data) {
  return writeJsonSafe("quests", data);
}

function recordProgress(guildId, userId, targetType, increment = 1) {
  const storage = getQuestStorage();
  const key = `${guildId}_${userId}`;
  if (!storage.progress[key]) storage.progress[key] = {};

  const userProg = storage.progress[key];
  const relevantQuests = storage.quests.filter(q => q.targetType === targetType);

  for (const q of relevantQuests) {
    if (!userProg[q.id]) userProg[q.id] = { count: 0, claimed: false };
    if (!userProg[q.id].claimed) {
      userProg[q.id].count = (userProg[q.id].count || 0) + increment;
      if (userProg[q.id].count >= q.targetCount) {
        eventBus.emit("quest.completed", { guildId, userId, quest: q });
      }
    }
  }

  saveQuestStorage(storage);
}

function claimReward(guildId, userId, questId) {
  const storage = getQuestStorage();
  const key = `${guildId}_${userId}`;
  const q = storage.quests.find(x => x.id === questId);
  if (!q) return { success: false, error: "Missione non trovata" };

  const prog = storage.progress[key]?.[questId];
  if (!prog || prog.count < q.targetCount) {
    return { success: false, error: "Missione non ancora completata" };
  }
  if (prog.claimed) {
    return { success: false, error: "Ricompensa già riscossa per oggi" };
  }

  prog.claimed = true;
  saveQuestStorage(storage);

  eventBus.emit("quest.claimed", { guildId, userId, quest: q });
  return { success: true, rewardXp: q.rewardXp, rewardCoins: q.rewardCoins };
}

module.exports = {
  getQuestStorage,
  recordProgress,
  claimReward
};