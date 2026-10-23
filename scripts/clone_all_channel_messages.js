require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

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

  // Reverse so it's chronological (oldest to newest)
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

  console.log("=== STARTING COMPLETE MESSAGE CLONING SYSTEM ===");

  const [sChannels, dChannels] = await Promise.all([
    rest.get(Routes.guildChannels(sourceGuildId)),
    rest.get(Routes.guildChannels(destGuildId))
  ]);

  const excludeChannels = new Set([
    "☑️・verifica",
    "📃・regole",
    "🎫・ticket",
    "🧧・unban"
  ]);

  // Specific message limits per channel type
  function getMaxMessages(channelName) {
    if (["💬・messaggi", "🏠・canali", "🔊・vocali", "🧑‍🤝‍🧑・membri", "🧢・ruoli", "🛅・moderazione"].includes(channelName)) {
      return 50; // Latest 50 audit logs
    }
    if (channelName === "🧮・counting") {
      return 50; // Latest 50 counting streak messages
    }
    if (channelName === "🌠・livello") {
      return 50; // Latest 50 level up announcements
    }
    return 1000; // Full history for all community, chat, media, staff, partnership, and cmd channels
  }

  // Filter text channels
  const channelsToSync = sChannels.filter(sc => {
    if (sc.type !== 0 && sc.type !== 5) return false;
    if (excludeChannels.has(sc.name)) return false;
    if (sc.name.startsWith("ticket-") || sc.name.startsWith("partnership-")) return false;
    return true;
  });

  console.log(`Found ${channelsToSync.length} candidate text channels to evaluate.`);

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
    const existingDestMsgs = await rest.get(Routes.channelMessages(dc.id), {
      query: new URLSearchParams({ limit: 10 })
    }).catch(() => []);

    if (existingDestMsgs.length > 0) {
      console.log(`[SKIP] Dest channel "${dc.name}" already has ${existingDestMsgs.length} messages.`);
      continue;
    }

    const maxCount = getMaxMessages(sc.name);
    const msgs = await fetchAllMessages(rest, sc.id, maxCount);

    if (msgs.length === 0) {
      console.log(`[EMPTY] Source channel "${sc.name}" has 0 messages.`);
      continue;
    }

    console.log(`\n>>> Syncing "${sc.name}" (${msgs.length} messages) to dest channel (${dc.id})...`);

    // Create webhook in dest channel
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

      // Add timestamp note if text content is present
      if (content && !content.includes("<t:")) {
        if (content.length + 35 <= 2000) {
          content += `\n*(Inviato: <t:${ts}:f>)*`;
        }
      } else if (!content && embeds.length > 0) {
        if (!embeds[0].timestamp) {
          embeds[0].timestamp = msg.timestamp;
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
        // Respect rate limit: 600ms pause between posts
        await sleep(600);
      } catch (postErr) {
        console.error(`    ❌ Failed to post message:`, postErr.message);
      }
    }

    console.log(`  ✅ Successfully cloned ${channelSuccess} / ${msgs.length} messages in "${dc.name}".`);

    // Clean up webhook
    try {
      await rest.delete(Routes.webhook(hook.id));
    } catch {}

    // 1s pause between channels
    await sleep(1000);
  }

  console.log(`\n🎉 COMPLETE! Total messages cloned across all channels: ${totalCloned}`);
}

main().catch(console.error);
