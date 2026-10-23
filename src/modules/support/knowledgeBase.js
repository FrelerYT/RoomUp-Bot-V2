const { EmbedBuilder } = require("discord.js");
const { readJsonSafe, writeJsonSafe } = require("../../core/storage");

function getKnowledgeStorage() {
  return readJsonSafe("knowledge_base", {
    articles: [
      {
        id: "kb_rules",
        category: "Generale",
        title: "Regolamento del Server",
        keywords: ["regole", "regolamento", "rules", "linee guida"],
        content: "Il regolamento completo vieta bestemmie, spam, insulti e autopromozione non autorizzata. Consulta il canale regole."
      },
      {
        id: "kb_tickets",
        category: "Assistenza",
        title: "Come aprire un Ticket di Supporto",
        keywords: ["ticket", "supporto", "staff", "aiuto", "aprire ticket"],
        content: "Per richiedere supporto vai nel canale #ticket e seleziona la categoria desiderata dal menu a tendina."
      },
      {
        id: "kb_minecraft",
        category: "Minecraft",
        title: "Indirizzo e Connessione Minecraft",
        keywords: ["ip", "minecraft", "server minecraft", "versione", "bedrock"],
        content: "L'indirizzo Java & Bedrock è: **play.roomup.it** (Porta Bedrock: 19132)."
      }
    ]
  });
}

function searchKnowledgeBase(query) {
  const storage = getKnowledgeStorage();
  const q = (query || "").toLowerCase();

  return storage.articles.filter(a => {
    if (a.title.toLowerCase().includes(q)) return true;
    if (a.content.toLowerCase().includes(q)) return true;
    if (Array.isArray(a.keywords) && a.keywords.some(k => q.includes(k) || k.includes(q))) return true;
    return false;
  });
}

function addArticle(category, title, content, keywords = []) {
  const storage = getKnowledgeStorage();
  const newArticle = {
    id: "kb_" + Date.now(),
    category,
    title,
    content,
    keywords: Array.isArray(keywords) ? keywords : [keywords]
  };
  storage.articles.push(newArticle);
  writeJsonSafe("knowledge_base", storage);
  return newArticle;
}

module.exports = {
  getKnowledgeStorage,
  searchKnowledgeBase,
  addArticle
};