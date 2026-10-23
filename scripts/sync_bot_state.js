const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "../data");
const sourceGuildId = "1429445691452948524";
const destGuildId = "965378975675322438";

console.log("=== SYNCHRONIZING BOT STATE FILES ===");

// 1. settings.json
const settingsPath = path.join(dataDir, "settings.json");
const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
if (settings[destGuildId]) {
  settings[destGuildId].counting.currentCount = settings[sourceGuildId].counting.currentCount;
  settings[destGuildId].counting.lastUserId = settings[sourceGuildId].counting.lastUserId;
  settings[destGuildId].counting.highestScore = settings[sourceGuildId].counting.highestScore;
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf8");
  console.log("✅ Updated settings.json for counting state.");
}

// 2. cases.json
const casesPath = path.join(dataDir, "cases.json");
const cases = JSON.parse(fs.readFileSync(casesPath, "utf8"));
if (!cases.counters) cases.counters = {};
cases.counters[destGuildId] = cases.counters[sourceGuildId] || 4;
fs.writeFileSync(casesPath, JSON.stringify(cases, null, 2), "utf8");
console.log("✅ Updated cases.json counter for dest guild.");

// 3. roles.json
const rolesPath = path.join(dataDir, "roles.json");
const roles = JSON.parse(fs.readFileSync(rolesPath, "utf8"));
if (!roles.stickyRoles) roles.stickyRoles = {};
if (!roles.stickyRoles[destGuildId]) roles.stickyRoles[destGuildId] = {};
fs.writeFileSync(rolesPath, JSON.stringify(roles, null, 2), "utf8");
console.log("✅ Initialized roles.json for dest guild.");

// 4. welcome_tracker.json
const welcomePath = path.join(dataDir, "welcome_tracker.json");
const welcome = JSON.parse(fs.readFileSync(welcomePath, "utf8"));
if (!welcome[destGuildId]) welcome[destGuildId] = {};
fs.writeFileSync(welcomePath, JSON.stringify(welcome, null, 2), "utf8");
console.log("✅ Initialized welcome_tracker.json for dest guild.");

console.log("🎉 All bot data files synchronized!");
