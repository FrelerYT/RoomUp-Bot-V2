require("dotenv").config();
const { REST, Routes } = require("discord.js");

async function main() {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);
  const destGuildId = "965378975675322438";

  const dChannels = await rest.get(Routes.guildChannels(destGuildId));
  const testCh = dChannels.find(c => c.name === "🤖・comandi");
  if (!testCh) throw new Error("Channel not found");

  console.log(`Found channel: ${testCh.name} (${testCh.id})`);

  // Create webhook
  const hook = await rest.post(Routes.channelWebhooks(testCh.id), {
    body: { name: "RoomUp Archive Sync" }
  });
  console.log(`Webhook created: ${hook.id}`);

  // Test send
  const msg = await rest.post(Routes.webhook(hook.id, hook.token), {
    query: new URLSearchParams({ wait: "true" }),
    body: {
      username: "Test Cloner",
      content: "Verifica webhook per clonazione messaggi con timestamp <t:1790803769:f>",
      allowed_mentions: { parse: [] }
    }
  });
  console.log(`Sent message id: ${msg.id}`);

  // Clean up
  await rest.delete(Routes.channelMessage(testCh.id, msg.id));
  await rest.delete(Routes.webhook(hook.id));
  console.log("Cleanup complete!");
}

main().catch(console.error);
