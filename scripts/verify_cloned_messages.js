require("dotenv").config();
const { REST, Routes } = require("discord.js");

async function main() {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);
  const destGuildId = "965378975675322438";

  console.log("=== COMPREHENSIVE VERIFICATION OF CLONED MESSAGES IN ROOMUP 2 ===");

  const dChannels = await rest.get(Routes.guildChannels(destGuildId));

  const expectedChannels = [
    ["📢・annunci", 4],
    ["🤝・partnership", 5],
    ["📸・media", 4],
    ["🌠・livello", 50],
    ["🧮・counting", 50],
    ["🤖・comandi", 92],
    ["🛋️・salotto", 94],
    ["🔰・staff", 100],
    ["〽️・uscite-entrate", 30],
    ["📁・transcript", 16],
    ["🎭・automod", 8],
    ["🛅・moderazione", 45],
    ["💬・messaggi", 45],
    ["🔊・vocali", 45],
    ["🧑‍🤝‍🧑・membri", 45],
    ["🧢・ruoli", 45],
    ["strangeplace", 1]
  ];

  let pass = true;
  for (const [name, minCount] of expectedChannels) {
    const ch = dChannels.find(c => c.name === name);
    if (!ch) {
      console.error(`❌ Channel "${name}" not found!`);
      pass = false;
      continue;
    }
    const msgs = await rest.get(Routes.channelMessages(ch.id), { query: new URLSearchParams({ limit: 100 }) });
    if (msgs.length >= minCount) {
      console.log(`✅ [${name}] Has ${msgs.length} messages (expected >= ${minCount})`);
    } else {
      console.warn(`⏳ [${name}] Has ${msgs.length} messages (target: ${minCount})`);
      pass = false;
    }
  }

  // Check counting channel latest value
  const countingCh = dChannels.find(c => c.name === "🧮・counting");
  if (countingCh) {
    const msgs = await rest.get(Routes.channelMessages(countingCh.id), { query: new URLSearchParams({ limit: 1 }) });
    const lastContent = msgs[0]?.content || "";
    console.log(`Counting latest message in dest: "${lastContent.split("\n")[0]}"`);
    if (lastContent.startsWith("15")) {
      console.log(`✅ Counting streak in dest accurately ends at 15!`);
    } else {
      console.warn(`⚠️ Counting streak ended at: ${lastContent}`);
      pass = false;
    }
  }

  // Verify Zero Timestamps in all channels
  console.log("\nVerifying Zero Timestamps across all channels...");
  let tsFound = 0;
  for (const [name] of expectedChannels) {
    const ch = dChannels.find(c => c.name === name);
    if (!ch) continue;
    const msgs = await rest.get(Routes.channelMessages(ch.id), { query: new URLSearchParams({ limit: 100 }) });
    for (const m of msgs) {
      if (m.content && (m.content.includes("*(Inviato") || m.content.includes("[Inviato"))) {
        tsFound++;
        console.error(`❌ Found timestamp header in "${name}": ${m.content}`);
      }
    }
  }

  if (tsFound === 0) {
    console.log("✅ Zero timestamp headers found across all checked channels! 100% clean.");
  } else {
    pass = false;
  }

  if (!pass) {
    process.exit(1);
  }
  console.log("\n🎉 ALL MESSAGE CLONING CHECKS PASSED 100%!");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
