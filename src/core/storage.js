const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "../../data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const cache = new Map();

function getFilePath(filename) {
  return path.join(DATA_DIR, filename.endsWith(".json") ? filename : `${filename}.json`);
}

function readJsonSafe(filename, defaultValue = {}) {
  const fullPath = getFilePath(filename);
  if (cache.has(fullPath)) return cache.get(fullPath);

  try {
    if (!fs.existsSync(fullPath)) {
      writeJsonSafe(filename, defaultValue);
      return defaultValue;
    }
    const content = fs.readFileSync(fullPath, "utf8").trim();
    if (!content) return defaultValue;
    const parsed = JSON.parse(content);
    cache.set(fullPath, parsed);
    return parsed;
  } catch (err) {
    console.error(`[Storage Error] Could not read ${filename}:`, err.message);
    return defaultValue;
  }
}

function writeJsonSafe(filename, data, recordRevision = false, actor = "system") {
  const fullPath = getFilePath(filename);
  const tmpPath = `${fullPath}.${Date.now()}.tmp`;

  try {
    const serialized = JSON.stringify(data, null, 2);
    fs.writeFileSync(tmpPath, serialized, "utf8");
    fs.renameSync(tmpPath, fullPath);
    cache.set(fullPath, data);

    if (recordRevision) {
      appendRevisionRecord(filename, actor, data);
    }
    return true;
  } catch (err) {
    console.error(`[Storage Error] Could not write ${filename}:`, err.message);
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
    return false;
  }
}

function appendRevisionRecord(filename, actor, snapshot) {
  try {
    const revFile = getFilePath("revisions");
    let revisions = [];
    if (fs.existsSync(revFile)) {
      try { revisions = JSON.parse(fs.readFileSync(revFile, "utf8")); } catch {}
    }
    revisions.push({
      id: "rev_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toISOString(),
      file: filename,
      actor,
      summary: `Modifica a ${filename} da parte di ${actor}`
    });
    // Keep max 200 revisions
    if (revisions.length > 200) revisions = revisions.slice(-200);
    fs.writeFileSync(revFile, JSON.stringify(revisions, null, 2), "utf8");
  } catch (e) {}
}

module.exports = { readJsonSafe, writeJsonSafe, getFilePath, DATA_DIR };
