const { Events } = require("discord.js");

function initCountingEngine(client, loadSettingsFn, saveSettingsFn) {
  client.on(Events.MessageCreate, async (message) => {
    try {
      if (!message.guild || message.author.bot) return;

      const settings = typeof loadSettingsFn === 'function' ? loadSettingsFn() : {};
      const guildSettings = settings[message.guild.id];
      const config = guildSettings?.counting; // usa "config" ovunque

      if (!config || !config.enabled || !config.channelId) return;
      if (message.channel.id !== config.channelId) return;

      const parsed = parseInt(message.content.trim(), 10);
      if (isNaN(parsed)) return; // ignora messaggi non numerici

      const current = Number(config.currentCount) || 0;
      const expected = current + 1;
      const lastUser = config.lastUserId || "";

      // 1. Stesso utente due volte di fila
      if (config.allowConsecutive !== true && message.author.id === lastUser) {
        if (config.reactionsEnabled !== false) await message.react("❌").catch(() => null);

        if (config.resetOnFail !== false) {
          config.currentCount = 0;
          config.lastUserId = "";
        }
        if (typeof saveSettingsFn === 'function') saveSettingsFn(settings);

        const failTpl = config.failMessageSameUser
          || "❌ <@{user}>, non puoi contare due volte di seguito! Il conteggio si azzera a **0**. Record del server: **{highestScore}**.";
        const failText = failTpl
          .replace(/{user}/g, message.author.id)
          .replace(/{username}/g, message.author.username)
          .replace(/{highestScore}/g, String(config.highestScore || current));

        return await message.channel.send({ content: failText }).catch(() => null);
      }

      // 2. Numero sbagliato
      if (parsed !== expected) {
        if (config.reactionsEnabled !== false) await message.react("❌").catch(() => null);

        const record = Math.max(config.highestScore || 0, current);
        if (config.resetOnFail !== false) {
          config.highestScore = record;
          config.currentCount = 0;
          config.lastUserId = "";
        }
        if (typeof saveSettingsFn === 'function') saveSettingsFn(settings);

        const failTpl = config.failMessageWrongNumber
          || "❌ <@{user}> ha sbagliato! Il numero corretto era **{expected}** (hai scritto `{input}`). Il conteggio si azzera a **0**. Record: **{highestScore}**!";
        const failText = failTpl
          .replace(/{user}/g, message.author.id)
          .replace(/{username}/g, message.author.username)
          .replace(/{expected}/g, String(expected))
          .replace(/{input}/g, String(parsed))
          .replace(/{highestScore}/g, String(record));

        return await message.channel.send({ content: failText }).catch(() => null);
      }

      // 3. Numero corretto ✅
      config.currentCount = expected;
      config.lastUserId = message.author.id;
      if (expected > (config.highestScore || 0)) {
        config.highestScore = expected;
      }
      if (typeof saveSettingsFn === 'function') saveSettingsFn(settings);

      if (config.reactionsEnabled !== false) {
        if (expected % 50 === 0) {
          await message.react("🎉").catch(() => null);
        } else {
          await message.react("✅").catch(() => null);
        }
      }

      // Messaggio traguardo ogni 50
      if (config.milestoneCelebration !== false && expected % 50 === 0) {
        const mileTpl = config.milestoneMessage
          || "🎉 Traguardo raggiunto: **{count}** numeri contati consecutivamente! Complimenti <@{user}>!";
        const mileText = mileTpl
          .replace(/{count}/g, String(expected))
          .replace(/{user}/g, message.author.id);
        await message.channel.send({ content: mileText }).catch(() => null);
      }

    } catch (e) {
      console.error("[CountingEngine] Errore conteggio:", e.message, e.stack);
    }
  });

  console.log("[CountingEngine] Minigioco Counting attivo!");
}

module.exports = { initCountingEngine };
