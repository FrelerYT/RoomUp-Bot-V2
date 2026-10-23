require("dotenv").config();
const { REST, Routes } = require("discord.js");

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function purgeChannel(rest, ch) {
  let totalDeleted = 0;
  while (true) {
    const msgs = await rest.get(Routes.channelMessages(ch.id), { query: new URLSearchParams({ limit: 100 }) });
    if (!msgs || msgs.length === 0) break;

    const ids = msgs.map(m => m.id);
    if (ids.length === 1) {
      await rest.delete(Routes.channelMessage(ch.id, ids[0])).catch(() => null);
      totalDeleted += 1;
      break;
    } else {
      try {
        await rest.post(Routes.channelBulkDelete(ch.id), {
          body: { messages: ids }
        });
        totalDeleted += ids.length;
      } catch (err) {
        console.warn(`    Bulk delete fallback for ${ch.name}: ${err.message}`);
        for (const id of ids) {
          await rest.delete(Routes.channelMessage(ch.id, id)).catch(() => null);
          totalDeleted += 1;
          await sleep(200);
        }
      }
    }
    await sleep(500);
  }
  return totalDeleted;
}

async function main() {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);
  const destGuildId = "965378975675322438";

  console.log("=== PURGING ALL CLONED MESSAGES FROM ROOMUP 2 ===");

  const dChannels = await rest.get(Routes.guildChannels(destGuildId));

  // Channels to PROTECT (do NOT purge the bot panels!)
  const protectedChannels = new Set([
    "☑️・verifica",
    "📃・regole",
    "🎫・ticket",
    "🧧・unban"
  ]);

  const textChannels = dChannels.filter(c => (c.type === 0 || c.type === 5) && !protectedChannels.has(c.name));

  for (const ch of textChannels) {
    const msgs = await rest.get(Routes.channelMessages(ch.id), { query: new URLSearchParams({ limit: 5 }) }).catch(() => []);
    if (msgs.length > 0) {
      console.log(`Purging channel "${ch.name}" (${ch.id})...`);
      const deleted = await purgeChannel(rest, ch);
      console.log(`  ✅ Purged ${deleted} messages from "${ch.name}".`);
    }
  }

  console.log("🎉 All cloned messages purged successfully!");
}

main().catch(console.error);
