const { Client, GatewayIntentBits } = require("discord.js");
require("dotenv").config();

async function run() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(process.env.DISCORD_BOT_TOKEN);
  const ch = await client.channels.fetch("1550847077083385868"); // #🧢・ruoli
  console.log("Channel found:", ch?.name);
  if (ch && ch.isTextBased()) {
    const msgs = await ch.messages.fetch({ limit: 5 });
    console.log("Found", msgs.size, "messages in ruoli:");
    msgs.forEach(m => {
      console.log(`- [${m.id}] ${m.author.tag}: ${m.content} (embeds: ${m.embeds.length})`);
      if (m.embeds.length > 0) {
        console.log(`  Embed Title: ${m.embeds[0].title}`);
      }
    });
  }
  process.exit(0);
}

run();
