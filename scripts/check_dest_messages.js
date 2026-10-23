require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

async function main() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const rest = new REST({ version: "10" }).setToken(token);

  const dump = JSON.parse(fs.readFileSync(path.join(__dirname, "guild_dump.json"), "utf8"));
  const dest = dump.dest;

  const keyChannels = [
    "☑️・verifica",
    "📃・regole",
    "🎫・ticket",
    "🧧・unban"
  ];

  for (const name of keyChannels) {
    const ch = dest.channels.find(c => c.name === name);
    if (!ch) continue;

    try {
      const msgs = await rest.get(Routes.channelMessages(ch.id), { query: new URLSearchParams({ limit: 5 }) });
      console.log(`Dest "${name}" has ${msgs.length} messages:`, msgs.map(m => `author: ${m.author.username}, content: ${m.content ? m.content.slice(0, 30) : "(embed)"}`));
    } catch (e) {
      console.error(`Error fetching dest "${name}":`, e.message);
    }
  }
}

main();
