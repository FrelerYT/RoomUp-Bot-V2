const { readJsonSafe, writeJsonSafe } = require("./storage");

function loadTemplates() {
  return readJsonSafe("templates", {});
}

function getGuildTemplates(guildId) {
  const all = loadTemplates();
  return all[guildId] || [];
}

function saveGuildTemplate(guildId, template) {
  const all = loadTemplates();
  if (!all[guildId]) all[guildId] = [];
  
  if (!template.id) {
    template.id = "tpl_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
    template.createdAt = new Date().toISOString();
  }
  template.updatedAt = new Date().toISOString();

  const existingIdx = all[guildId].findIndex(t => t.id === template.id);
  if (existingIdx !== -1) {
    all[guildId][existingIdx] = template;
  } else {
    all[guildId].push(template);
  }

  writeJsonSafe("templates", all, true, "templateEngine");
  return template;
}

function deleteGuildTemplate(guildId, templateId) {
  const all = loadTemplates();
  if (!all[guildId]) return false;
  const initialLen = all[guildId].length;
  all[guildId] = all[guildId].filter(t => t.id !== templateId);
  writeJsonSafe("templates", all, true, "templateEngine");
  return all[guildId].length !== initialLen;
}

module.exports = { getGuildTemplates, saveGuildTemplate, deleteGuildTemplate };
