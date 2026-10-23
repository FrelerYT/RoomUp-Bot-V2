require("dotenv").config();
const { REST, Routes } = require("discord.js");

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAllMessages(rest, channelId, maxCount = 2000) {
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

  console.log("=== STARTING 100% CLEAN MESSAGE CLONING (ZERO TIMESTAMPS) ===");

  const [sChannels, dChannels] = await Promise.all([
    rest.get(Routes.guildChannels(sourceGuildId)),
    rest.get(Routes.guildChannels(destGuildId))
  ]);

  // Protected channels (permanent bot panels, do NOT touch)
  const protectedChannels = new Set([
    "☑️・verifica",
    "📃・regole",
    "🎫・ticket",
    "🧧・unban"
  ]);

  // Channel message limits
  function getMaxMessages(name) {
    if (["💬・messaggi", "🏠・canali", "🔊・vocali", "🧑‍🤝‍🧑・membri", "🧢・ruoli", "🛅・moderazione"].includes(name)) {
      return 50;
    }
    if (name === "🧮・counting") return 50;
    if (name === "🌠・livello") return 50;
    return 1000; // All messages for community & staff channels
  }

  // Text channels to sync
  const channelsToSync = sChannels.filter(sc => {
    if (sc.type !== 0 && sc.type !== 5) return false;
    if (protectedChannels.has(sc.name)) return false;
    if (sc.name.startsWith("ticket-") || sc.name.startsWith("partnership-")) return false;
    return true;
  });

  console.log(`Found ${channelsToSync.length} text channels to clone.`);

  let totalCloned = 0;

  for (const sc of channelsToSync) {
    const sParent = sChannels.find(p => p.id === sc.parent_id);
    const dc = dChannels.find(c => {
      if (c.name !== sc.name || c.type !== sc.type) return false;
      const dParent = dChannels.find(p => p.id === c.parent_id);
      return dParent?.name === sParent?.name;
    });

    if (!dc) {
      console.warn(`[SKIP] No corresponding dest channel for "${sc.name}"`);
      continue;
    }

    // Check if destination channel already has messages
    const existing = await rest.get(Routes.channelMessages(dc.id), { query: new URLSearchParams({ limit: 10 }) }).catch(() => []);
    if (existing.length > 0) {
      console.log(`[SKIP] "${dc.name}" already has ${existing.length} messages.`);
      continue;
    }

    const maxCount = getMaxMessages(sc.name);
    const msgs = await fetchAllMessages(rest, sc.id, maxCount);

    if (msgs.length === 0) {
      console.log(`[EMPTY] "${sc.name}" has 0 messages.`);
      continue;
    }

    console.log(`\n>>> Cloning "${sc.name}" (${msgs.length} messages) to dest channel (${dc.id})...`);

    // Create webhook
    let hook;
    try {
      hook = await rest.post(Routes.channelWebhooks(dc.id), {
        body: { name: "RoomUp Cloner" }
      });
    } catch (e) {
      console.error(`  ❌ Failed to create webhook in "${dc.name}":`, e.message);
      continue;
    }

    let channelSuccess = 0;

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

      // RAW original content ONLY - NO TIMESTAMPS ADDED WHATSOEVER
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
          continue; // Skip empty interaction artifacts
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
        channelSuccess++;
        totalCloned++;
        await sleep(550);
      } catch (postErr) {
        console.error(`    ❌ Failed to post message:`, postErr.message);
      }
    }

    console.log(`  ✅ Successfully cloned ${channelSuccess} / ${msgs.length} clean messages in "${dc.name}".`);

    // Clean up webhook
    try {
      await rest.delete(Routes.webhook(hook.id));
    } catch {}

    await sleep(500);
  }

  console.log(`\n🎉 COMPLETE! Total clean messages cloned: ${totalCloned}`);
}

main().catch(console.error);
