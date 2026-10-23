require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

async function main() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const rest = new REST({ version: "10" }).setToken(token);

  const dump = JSON.parse(fs.readFileSync(path.join(__dirname, "guild_dump.json"), "utf8"));
  const source = dump.source;

  const keyChannels = [
    "☑️・verifica",
    "📃・regole",
    "🔍・informazioni",
    "🛜・social",
    "🎫・ticket",
    "🧧・unban",
    "🤖・comandi",
    "💎・boosts"
  ];

  const channelMessages = {};

  for (const name of keyChannels) {
    const ch = source.channels.find(c => c.name === name);
    if (!ch) continue;

    try {
      const msgs = await rest.get(Routes.channelMessages(ch.id), { query: new URLSearchParams({ limit: 10 }) });
      channelMessages[name] = msgs.map(m => ({
        id: m.id,
        author: m.author.username,
        authorId: m.author.id,
        isBot: m.author.bot,
        content: m.content,
        embeds: m.embeds,
        components: m.components
      }));
      console.log(`Fetched ${msgs.length} messages for "${name}"`);
    } catch (e) {
      console.error(`Error fetching "${name}":`, e.message);
    }
  }

  fs.writeFileSync(path.join(__dirname, "source_messages.json"), JSON.stringify(channelMessages, null, 2), "utf8");
  console.log("Source messages written to scripts/source_messages.json");
}

main();
