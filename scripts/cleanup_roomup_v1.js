require("dotenv").config();
const { REST, Routes, PermissionsBitField } = require("discord.js");
const fs = require("fs");
const path = require("path");

const SOURCE_GUILD_ID = "1429445691452948524";
const DEST_GUILD_ID = "965378975675322438";
const PERMANENT_INVITE = "https://discord.gg/Hb6eTSefRh";
const SETTINGS_PATH = path.join(__dirname, "../data/settings.json");

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

async function main() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    throw new Error("DISCORD_BOT_TOKEN is missing in .env");
  }
  const rest = new REST({ version: "10" }).setToken(token);

  console.log("=================================================");
  console.log("STARTING CLEANUP ON ROOMUP V1 (1429445691452948524)");
  console.log("=================================================");

  // --- STEP 1: Update data/settings.json to disable engines ---
  console.log("\n[Step 1] Disabling active engines in data/settings.json...");
  if (fs.existsSync(SETTINGS_PATH)) {
    const raw = fs.readFileSync(SETTINGS_PATH, "utf8");
    const settings = JSON.parse(raw);
    if (settings[SOURCE_GUILD_ID]) {
      const g = settings[SOURCE_GUILD_ID];
      // Disable all active engines
      if (g.logs) g.logs.enabled = false;
      if (g.partnerships) g.partnerships.enabled = false;
      if (g.tickets) g.tickets.enabled = false;
      if (g.verification) g.verification.enabled = false;
      if (g.welcome) g.welcome.enabled = false;
      if (g.leave) g.leave.enabled = false;
      if (g.automod) g.automod.enabled = false;
      if (g.voice) g.voice.enabled = false;
      if (g.aiModerator) g.aiModerator.enabled = false;
      if (g.giveaways) g.giveaways.enabled = false;
      if (g.suggestions) g.suggestions.enabled = false;
      if (g.levels) g.levels.enabled = false;
      if (g.counting) g.counting.enabled = false;
      if (g.starboard) g.starboard.enabled = false;
      if (g.serverStats) g.serverStats.enabled = false;
      if (g.antiNuke) g.antiNuke.enabled = false;
      if (g.antiRaid) g.antiRaid.enabled = false;
      if (g.warns) g.warns.enabled = false;
      if (g.aiAgent) g.aiAgent.enabled = false;
      if (g.music) g.music.enabled = false;
      if (g.ai) g.ai.enabled = false;

      fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf8");
      console.log("✅ Successfully disabled engines for 1429445691452948524 in settings.json");
    } else {
      console.log("⚠️ Guild not found in settings.json, skipping.");
    }
  }

  // --- STEP 2: Create the replacement channel ---
  console.log("\n[Step 2] Creating replacement channel '📢・ci-trasferiamo'...");
  // Overwrites: allow ViewChannel and ReadMessageHistory for @everyone, deny SendMessages, Threads, etc.
  const everyoneOverwrites = {
    id: SOURCE_GUILD_ID,
    type: 0, // role
    allow: (
      BigInt(PermissionsBitField.Flags.ViewChannel) |
      BigInt(PermissionsBitField.Flags.ReadMessageHistory)
    ).toString(),
    deny: (
      BigInt(PermissionsBitField.Flags.SendMessages) |
      BigInt(PermissionsBitField.Flags.CreatePublicThreads) |
      BigInt(PermissionsBitField.Flags.CreatePrivateThreads) |
      BigInt(PermissionsBitField.Flags.SendMessagesInThreads)
    ).toString()
  };

  const newChannel = await rest.post(Routes.guildChannels(SOURCE_GUILD_ID), {
    body: {
      name: "📢・ci-trasferiamo",
      type: 0, // GuildText
      topic: "📢 CI TRASFERIAMO! Unisciti al nuovo server ufficiale RoomUp: " + PERMANENT_INVITE,
      permission_overwrites: [everyoneOverwrites]
    }
  });
  console.log(`✅ Created replacement channel: #${newChannel.name} (${newChannel.id})`);

  // --- STEP 3: Handle Community and Guild channel constraints ---
  console.log("\n[Step 3] Updating guild community settings (PATCH /guilds)...");
  try {
    await rest.patch(Routes.guild(SOURCE_GUILD_ID), {
      body: {
        rules_channel_id: newChannel.id,
        public_updates_channel_id: newChannel.id,
        system_channel_id: null,
        afk_channel_id: null,
        safety_alerts_channel_id: null
      }
    });
    console.log("✅ Successfully pointed rules_channel_id and public_updates_channel_id to new channel");
  } catch (e) {
    console.error("⚠️ Failed to patch guild channels:", e.message);
  }

  // --- STEP 3b: Update Onboarding if present ---
  console.log("\n[Step 3b] Updating Onboarding to use new channel / clear prompts...");
  try {
    await rest.put(Routes.guildOnboarding(SOURCE_GUILD_ID), {
      body: {
        prompts: [],
        default_channel_ids: [newChannel.id],
        enabled: false,
        mode: 0
      }
    });
    console.log("✅ Successfully updated onboarding");
  } catch (e) {
    console.log("ℹ️ Onboarding update note:", e.message);
    // If enabled: false requires prompts or something, try keeping enabled: false with newChannel.id
    try {
      await rest.put(Routes.guildOnboarding(SOURCE_GUILD_ID), {
        body: {
          prompts: [],
          default_channel_ids: [newChannel.id],
          enabled: false
        }
      });
    } catch (err2) {
      console.log("ℹ️ Secondary onboarding note:", err2.message);
    }
  }

  // --- STEP 4: Delete all other channels and categories ---
  console.log("\n[Step 4] Deleting all other channels and categories...");
  const channels = await rest.get(Routes.guildChannels(SOURCE_GUILD_ID));
  const toDelete = channels.filter(c => c.id !== newChannel.id);
  console.log(`Total channels to delete: ${toDelete.length}`);

  // Separate non-category and category channels
  const leafChannels = toDelete.filter(c => c.type !== 4);
  const categories = toDelete.filter(c => c.type === 4);

  console.log(`Deleting ${leafChannels.length} leaf channels...`);
  for (const ch of leafChannels) {
    try {
      await rest.delete(Routes.channel(ch.id));
      console.log(`- Deleted channel: ${ch.name} (${ch.id})`);
      await sleep(250);
    } catch (e) {
      console.error(`❌ Failed to delete channel ${ch.name} (${ch.id}):`, e.message);
    }
  }

  console.log(`Deleting ${categories.length} category channels...`);
  for (const cat of categories) {
    try {
      await rest.delete(Routes.channel(cat.id));
      console.log(`- Deleted category: ${cat.name} (${cat.id})`);
      await sleep(250);
    } catch (e) {
      console.error(`❌ Failed to delete category ${cat.name} (${cat.id}):`, e.message);
    }
  }

  // --- STEP 5: Delete all custom roles ---
  console.log("\n[Step 5] Deleting custom roles...");
  const me = await rest.get(Routes.user());
  const botMember = await rest.get(Routes.guildMember(SOURCE_GUILD_ID, me.id));
  const allRoles = await rest.get(Routes.guildRoles(SOURCE_GUILD_ID));

  // Determine bot's highest role position
  let botHighestPos = 0;
  for (const rId of botMember.roles) {
    const r = allRoles.find(x => x.id === rId);
    if (r && r.position > botHighestPos) {
      botHighestPos = r.position;
    }
  }
  console.log(`Bot highest role position: ${botHighestPos}`);

  const rolesToDelete = allRoles.filter(r => {
    if (r.id === SOURCE_GUILD_ID) return false; // @everyone
    if (r.managed) return false; // Bot managed or booster
    if (r.position >= botHighestPos) return false; // Above or equal to bot
    return true;
  });

  // Sort lowest position first for clean removal
  rolesToDelete.sort((a, b) => a.position - b.position);
  console.log(`Custom roles eligible for deletion: ${rolesToDelete.length}`);

  for (const role of rolesToDelete) {
    try {
      await rest.delete(Routes.guildRole(SOURCE_GUILD_ID, role.id));
      console.log(`- Deleted role: ${role.name} (${role.id}) pos ${role.position}`);
      await sleep(250);
    } catch (e) {
      console.error(`❌ Failed to delete role ${role.name} (${role.id}):`, e.message);
    }
  }

  // --- STEP 6: Post official announcement embed ---
  console.log("\n[Step 6] Posting official announcement embed in remaining channel...");
  const announcementEmbed = {
    title: "🚀 SIAMO TRASFERITI SU ROOMUP 2.0!",
    description: 
      "# 📢 CI TRASFERIAMO!\n\n" +
      "Tutti i servizi, le stanze vocali, i canali tematici, i bot e la community di **RoomUp!** " +
      "si sono trasferiti ufficialmente nella **nuova sede 2.0**!\n\n" +
      "Questo vecchio server è stato dismesso e non è più attivo.\n" +
      "Tutto il nostro staff, i ticket di supporto, gli eventi e i minigiochi ti aspettano già dall'altra parte.\n\n" +
      "👉 **Unisciti subito cliccando sul pulsante qui sotto oppure tramite il link ufficiale:**\n" +
      `🔗 **${PERMANENT_INVITE}**`,
    color: 0x731FC3, // #731fc3 RoomUp signature violet
    fields: [
      {
        name: "🌐 Nuovo Server",
        value: "**RoomUp! 2.0**",
        inline: true
      },
      {
        name: "👥 Community & Staff",
        value: "Tutto attivo e operativo",
        inline: true
      },
      {
        name: "🎫 Assistenza & Ticket",
        value: "Disponibili nel nuovo server",
        inline: true
      }
    ],
    footer: {
      text: "RoomUp! Network • Migrazione Ufficiale Completata"
    },
    timestamp: new Date().toISOString()
  };

  const actionRow = {
    type: 1, // ACTION_ROW
    components: [
      {
        type: 2, // BUTTON
        style: 5, // LINK
        label: "Entra in RoomUp 2.0",
        url: PERMANENT_INVITE,
        emoji: {
          name: "🚀"
        }
      }
    ]
  };

  await rest.post(Routes.channelMessages(newChannel.id), {
    body: {
      content: "@everyone",
      embeds: [announcementEmbed],
      components: [actionRow]
    }
  });
  console.log("✅ Announcement posted successfully!");

  // --- STEP 7: Final Verification ---
  console.log("\n[Step 7] Final Verification via Discord REST API...");
  const finalChannels = await rest.get(Routes.guildChannels(SOURCE_GUILD_ID));
  console.log(`Remaining channels count: ${finalChannels.length}`);
  finalChannels.forEach(c => {
    console.log(`- [${c.id}] (type ${c.type}) #${c.name}`);
  });

  const finalRoles = await rest.get(Routes.guildRoles(SOURCE_GUILD_ID));
  console.log(`Remaining roles count: ${finalRoles.length}`);
  finalRoles.sort((a, b) => b.position - a.position);
  finalRoles.forEach(r => {
    console.log(`- [${r.id}] pos: ${r.position}, name: "${r.name}", managed: ${r.managed}`);
  });

  console.log("\n=================================================");
  console.log("CLEANUP COMPLETED SUCCESSFULLY!");
  console.log("=================================================");
}

main().catch(err => {
  console.error("FATAL ERROR IN CLEANUP:", err);
  process.exit(1);
});
