require("dotenv").config();
const { REST, Routes } = require("discord.js");

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAllMessages(rest, channelId, maxCount = 100) {
  let all = [];
  let before = undefined;

  while (all.length < maxCount) {
    const limit = Math.min(100, maxCount - all.length);
    const query = new URLSearchParams({ limit: String(limit) });
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
    if (batch.length < limit) break;
    before = batch[batch.length - 1].id;
  }

  return all.reverse();
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

async function main() {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);
  const sourceGuildId = "1429445691452948524";
  const destGuildId = "965378975675322438";

  console.log("=== CLONING REMAINING CHANNELS (100% CLEAN, ZERO TIMESTAMPS) ===");

  const targetChannels = [
    { name: "〽️・uscite-entrate", max: 50 },
    { name: "📁・transcript", max: 50 },
    { name: "🎭・automod", max: 50 },
    { name: "🛅・moderazione", max: 50 },
    { name: "💬・messaggi", max: 50 },
    { name: "🔊・vocali", max: 50 },
    { name: "🧑‍🤝‍🧑・membri", max: 50 },
    { name: "🧢・ruoli", max: 50 }
  ];

  const [sChannels, dChannels] = await Promise.all([
    rest.get(Routes.guildChannels(sourceGuildId)),
    rest.get(Routes.guildChannels(destGuildId))
  ]);

  let totalCloned = 0;

  for (const target of targetChannels) {
    const sc = sChannels.find(c => c.name === target.name);
    const dc = dChannels.find(c => c.name === target.name);

    if (!sc || !dc) {
      console.warn(`[SKIP] Missing channel mapping for ${target.name}`);
      continue;
    }

    // Check if dest already has messages
    const destExisting = await rest.get(Routes.channelMessages(dc.id), { query: new URLSearchParams({ limit: 5 }) }).catch(() => []);
    if (destExisting.length > 0) {
      console.log(`[SKIP] "${dc.name}" already has ${destExisting.length} messages.`);
      continue;
    }

    const msgs = await fetchAllMessages(rest, sc.id, target.max);
    if (msgs.length === 0) {
      console.log(`[EMPTY] Source "${sc.name}" has 0 messages.`);
      continue;
    }

    console.log(`\n>>> Syncing "${sc.name}" (${msgs.length} messages) to dest channel (${dc.id})...`);

    let hook;
    try {
      hook = await rest.post(Routes.channelWebhooks(dc.id), {
        body: { name: "RoomUp Cloner" }
      });
    } catch (e) {
      console.error(`  ❌ Failed to create webhook in "${dc.name}":`, e.message);
      continue;
    }

    let count = 0;
    for (const msg of msgs) {
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

      if (!content && embeds.length === 0) {
        if (msg.stickers && msg.stickers.length > 0) {
          content = msg.stickers.map(s => `[Sticker: ${s.name}]`).join(" ");
        } else {
          continue;
        }
      }

      const payload = {
        username,
        content: content.slice(0, 2000),
        allowed_mentions: { parse: [] }
      };
      if (avatar_url) payload.avatar_url = avatar_url;
      if (embeds.length > 0) payload.embeds = embeds;

      try {
        await postWithRetry(rest, hook.id, hook.token, payload);
        count++;
        totalCloned++;
        await sleep(350);
      } catch (err) {
        console.error(`    ❌ Failed to post message in ${dc.name}:`, err.message);
      }
    }

    try {
      await rest.delete(Routes.webhook(hook.id));
    } catch {}

    console.log(`  ✅ Successfully cloned ${count} / ${msgs.length} clean messages in "${dc.name}".`);
    await sleep(500);
  }

  console.log(`\n🎉 All targeted remaining channels cloned! Total messages cloned: ${totalCloned}`);
}

main().catch(console.error);
