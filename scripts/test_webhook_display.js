require("dotenv").config();
const { REST, Routes } = require("discord.js");

async function main() {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);
  const destGuildId = "965378975675322438";

  const dChannels = await rest.get(Routes.guildChannels(destGuildId));
  const testCh = dChannels.find(c => c.name === "🤖・comandi");
  if (!testCh) throw new Error("Channel not found");

  const hook = await rest.post(Routes.channelWebhooks(testCh.id), {
    body: { name: "RoomUp Cloner" }
  });

  const sent = await rest.post(Routes.webhook(hook.id, hook.token), {
    query: new URLSearchParams({ wait: "true" }),
    body: {
      username: "frelerr",
      avatar_url: "https://cdn.discordapp.com/avatars/1020343046539325480/c55ed8ee40db2034f1f245c1c9b8d1b7.png",
      content: "Test messaggio clonato\n*(Inviato: <t:1790803769:f>)*",
      allowed_mentions: { parse: [] }
    }
  });

  console.log("Sent successfully! Message ID:", sent.id);
  // delete webhook
  await rest.delete(Routes.webhook(hook.id));
  // delete message
  await rest.delete(Routes.channelMessage(testCh.id, sent.id));
  console.log("Deleted test message and webhook.");
}

main().catch(console.error);
