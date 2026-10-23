require("dotenv").config();
const { REST, Routes } = require("discord.js");

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function postWithRetry(rest, hookId, hookToken, payload, maxRetries = 5) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await rest.post(Routes.webhook(hookId, hookToken), {
        query: new URLSearchParams({ wait: "true" }),
        body: payload
      });
    } catch (err) {
      if (err.status === 429 || err.code === 429 || (err.message && err.message.includes("429"))) {
        const retryAfter = err.rawError?.retry_after || err.retry_after || 2;
        console.warn(`    ⚠️ Rate limit hit. Waiting ${retryAfter}s...`);
        await sleep(Math.ceil(retryAfter * 1000) + 200);
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded for message send");
}

async function fetchAllMessages(rest, channelId) {
  let all = [];
  let before = undefined;

  while (true) {
    const query = new URLSearchParams({ limit: "100" });
    if (before) query.set("before", before);

    let batch = [];
    try {
      batch = await rest.get(Routes.channelMessages(channelId), { query });
    } catch (e) {
      console.error(`  Error fetching messages for ${channelId}:`, e.message);
      break;
    }

    if (!batch || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < 100) break;
    before = batch[batch.length - 1].id;
  }

  return all.reverse();
}

async function main() {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);
  const sourceGuildId = "1429445691452948524";
  const destGuildId = "965378975675322438";

  console.log("=== SYNCING SALOTTO (MAIN CHAT) ===");

  const [sChannels, dChannels] = await Promise.all([
    rest.get(Routes.guildChannels(sourceGuildId)),
    rest.get(Routes.guildChannels(destGuildId))
  ]);

  const sSalotto = sChannels.find(c => c.name === "🛋️・salotto");
  const dSalotto = dChannels.find(c => c.name === "🛋️・salotto");

  if (!sSalotto || !dSalotto) throw new Error("Salotto channel not found in one of the guilds!");

  // 1. Fetch current messages in dest salotto
  const dExistingMsgs = await rest.get(Routes.channelMessages(dSalotto.id), { query: new URLSearchParams({ limit: 50 }) });
  console.log(`Found ${dExistingMsgs.length} existing message(s) in dest salotto.`);

  // If already cloned (more than 10 messages), skip
  if (dExistingMsgs.length > 10) {
    console.log("Dest salotto already has full message history. Skipping.");
    return;
  }

  // Preserve any local user message like "ciaooo" from valen.strange_
  const localMsgsToReplay = [];
  for (const dm of dExistingMsgs) {
    localMsgsToReplay.push(dm);
    try {
      await rest.delete(Routes.channelMessage(dSalotto.id, dm.id));
      console.log(`Deleted temporary existing message: ${dm.content} (${dm.id})`);
    } catch (e) {
      console.warn(`Could not delete message ${dm.id}:`, e.message);
    }
  }

  // 2. Fetch all messages from source salotto
  const sMsgs = await fetchAllMessages(rest, sSalotto.id);
  console.log(`Fetched ${sMsgs.length} messages from source salotto.`);

  // 3. Create webhook
  const hook = await rest.post(Routes.channelWebhooks(dSalotto.id), {
    body: { name: "RoomUp Salotto Cloner" }
  });

  // 4. Clone source messages
  let count = 0;
  for (const msg of sMsgs) {
    const author = msg.author || {};
    const username = (author.global_name || author.username || "Utente").slice(0, 80);
    let avatar_url = undefined;
    if (author.avatar) {
      avatar_url = `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.png`;
    } else if (author.id) {
      try {
        const idx = (BigInt(author.id) >> 22n) % 6n;
        avatar_url = `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
      } catch {
        avatar_url = "https://cdn.discordapp.com/embed/avatars/0.png";
      }
    }

    let content = msg.content || "";
    if (msg.attachments && msg.attachments.length > 0) {
      const attUrls = msg.attachments.map(a => a.url).join("\n");
      content = content ? `${content}\n${attUrls}` : attUrls;
    }

    let embeds = [];
    if (msg.embeds && msg.embeds.length > 0) {
      embeds = msg.embeds.slice(0, 10).map(e => {
        const copy = { ...e };
        delete copy.id;
        return copy;
      });
    }

    const ts = Math.floor(new Date(msg.timestamp).getTime() / 1000);

    if (!content && embeds.length === 0) {
      if (msg.stickers && msg.stickers.length > 0) {
        content = msg.stickers.map(s => `[Sticker: ${s.name}]`).join(" ");
      } else {
        content = "*(messaggio vuoto)*";
      }
    }

    if (content && !content.includes("<t:")) {
      if (content.length + 35 <= 2000) {
        content += `\n*(Inviato: <t:${ts}:f>)*`;
      }
    }

    const payload = {
      username,
      content: content.slice(0, 2000),
      allowed_mentions: { parse: [] }
    };
    if (avatar_url) payload.avatar_url = avatar_url;
    if (embeds.length > 0) payload.embeds = embeds;

    await postWithRetry(rest, hook.id, hook.token, payload);
    count++;
    await sleep(600);
  }

  // 5. Replay local message(s) at the end
  for (const lm of localMsgsToReplay) {
    const author = lm.author || {};
    const username = (author.global_name || author.username || "Utente").slice(0, 80);
    let avatar_url = undefined;
    if (author.avatar) {
      avatar_url = `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.png`;
    }
    const ts = Math.floor(new Date(lm.timestamp).getTime() / 1000);
    let content = lm.content || "";
    if (content && !content.includes("<t:")) {
      if (content.length + 35 <= 2000) {
        content += `\n*(Inviato: <t:${ts}:f>)*`;
      }
    }

    await postWithRetry(rest, hook.id, hook.token, {
      username,
      content: content.slice(0, 2000),
      avatar_url,
      allowed_mentions: { parse: [] }
    });
    count++;
    await sleep(600);
  }

  console.log(`✅ Finished salotto! Total messages posted: ${count}`);

  // Delete webhook
  try {
    await rest.delete(Routes.webhook(hook.id));
  } catch {}
}

main().catch(console.error);
