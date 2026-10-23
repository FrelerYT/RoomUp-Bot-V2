const { readJsonSafe, writeJsonSafe } = require("../../core/storage");
const { getGuildConfig } = require("../../config/settingsManager");
const eventBus = require("../../core/eventBus");

function getEconomyStorage() {
  return readJsonSafe("economy", {
    users: {}, // { `${guildId}_${userId}`: { wallet: 100, bank: 0, lastDaily: 0, lastWork: 0, streak: 0 } }
    shop: {}   // { guildId: [ { id, name, price, roleId, description } ] }
  });
}

function saveEconomyStorage(data) {
  return writeJsonSafe("economy", data);
}

function getUserAccount(guildId, userId) {
  const storage = getEconomyStorage();
  const key = `${guildId}_${userId}`;
  if (!storage.users[key]) {
    const cfg = getGuildConfig(guildId);
    storage.users[key] = {
      wallet: cfg.economy?.startingBalance || 100,
      bank: 0,
      lastDaily: 0,
      lastWork: 0,
      streak: 0
    };
    saveEconomyStorage(storage);
  }
  return storage.users[key];
}

function addBalance(guildId, userId, amount, type = "wallet") {
  const storage = getEconomyStorage();
  const key = `${guildId}_${userId}`;
  const acc = getUserAccount(guildId, userId);
  acc[type] = Math.max(0, (acc[type] || 0) + amount);
  storage.users[key] = acc;
  saveEconomyStorage(storage);
  return acc[type];
}

function removeBalance(guildId, userId, amount, type = "wallet") {
  const storage = getEconomyStorage();
  const key = `${guildId}_${userId}`;
  const acc = getUserAccount(guildId, userId);
  if (acc[type] < amount) return false;
  acc[type] -= amount;
  storage.users[key] = acc;
  saveEconomyStorage(storage);
  return true;
}

function claimDaily(guildId, userId) {
  const acc = getUserAccount(guildId, userId);
  const now = Date.now();
  const COOLDOWN = 24 * 60 * 60 * 1000;

  if (now - acc.lastDaily < COOLDOWN) {
    const remaining = COOLDOWN - (now - acc.lastDaily);
    return { success: false, remainingMs: remaining };
  }

  // Check streak
  const ONE_DAY_AND_HALF = 36 * 60 * 60 * 1000;
  if (now - acc.lastDaily < ONE_DAY_AND_HALF) {
    acc.streak = (acc.streak || 0) + 1;
  } else {
    acc.streak = 1;
  }

  const cfg = getGuildConfig(guildId);
  const baseReward = cfg.economy?.dailyAmount || 50;
  const streakBonus = Math.min(100, (acc.streak - 1) * 10);
  const total = baseReward + streakBonus;

  acc.wallet += total;
  acc.lastDaily = now;

  const storage = getEconomyStorage();
  storage.users[`${guildId}_${userId}`] = acc;
  saveEconomyStorage(storage);

  eventBus.emit("economy.daily_claimed", { guildId, userId, reward: total, streak: acc.streak });
  return { success: true, reward: total, streak: acc.streak, balance: acc.wallet };
}

function doWork(guildId, userId) {
  const acc = getUserAccount(guildId, userId);
  const now = Date.now();
  const COOLDOWN = 30 * 60 * 1000; // 30 minutes

  if (now - acc.lastWork < COOLDOWN) {
    const remaining = COOLDOWN - (now - acc.lastWork);
    return { success: false, remainingMs: remaining };
  }

  const jobs = [
    { title: "Programmatore Discord Bot", min: 40, max: 90 },
    { title: "Moderatore della Chat", min: 30, max: 70 },
    { title: "Grafico per la Community", min: 35, max: 80 },
    { title: "Streamer su Twitch", min: 20, max: 100 }
  ];

  const job = jobs[Math.floor(Math.random() * jobs.length)];
  const earned = Math.floor(Math.random() * (job.max - job.min + 1)) + job.min;

  acc.wallet += earned;
  acc.lastWork = now;

  const storage = getEconomyStorage();
  storage.users[`${guildId}_${userId}`] = acc;
  saveEconomyStorage(storage);

  eventBus.emit("economy.work_completed", { guildId, userId, earned, job: job.title });
  return { success: true, earned, job: job.title, balance: acc.wallet };
}

function getLeaderboard(guildId, limit = 10) {
  const storage = getEconomyStorage();
  const prefix = `${guildId}_`;
  const list = [];

  for (const key of Object.keys(storage.users)) {
    if (key.startsWith(prefix)) {
      const userId = key.replace(prefix, "");
      const acc = storage.users[key];
      list.push({ userId, wallet: acc.wallet, bank: acc.bank, total: acc.wallet + acc.bank });
    }
  }

  return list.sort((a, b) => b.total - a.total).slice(0, limit);
}

module.exports = {
  getUserAccount,
  addBalance,
  removeBalance,
  claimDaily,
  doWork,
  getLeaderboard,
  getEconomyStorage,
  saveEconomyStorage
};