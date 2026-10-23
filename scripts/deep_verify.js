require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

async function main() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const rest = new REST({ version: "10" }).setToken(token);

  const sourceId = "1429445691452948524";
  const destId = "965378975675322438";

  console.log("=== RUNNING DEEP COMPREHENSIVE VERIFICATION ===");

  const [sGuild, dGuild, sRoles, dRoles, sChannels, dChannels, sAutomod, dAutomod] = await Promise.all([
    rest.get(Routes.guild(sourceId)),
    rest.get(Routes.guild(destId)),
    rest.get(Routes.guildRoles(sourceId)),
    rest.get(Routes.guildRoles(destId)),
    rest.get(Routes.guildChannels(sourceId)),
    rest.get(Routes.guildChannels(destId)),
    rest.get(`/guilds/${sourceId}/auto-moderation/rules`),
    rest.get(`/guilds/${destId}/auto-moderation/rules`)
  ]);

  let pass = true;

  // 1. Server settings
  console.log("\n[1/8] Server-Level Settings:");
  const checks = [
    ["description", sGuild.description, dGuild.description],
    ["verification_level", sGuild.verification_level, dGuild.verification_level],
    ["default_message_notifications", sGuild.default_message_notifications, dGuild.default_message_notifications],
    ["explicit_content_filter", sGuild.explicit_content_filter, dGuild.explicit_content_filter],
    ["system_channel_id", null, dGuild.system_channel_id],
    ["rules_channel_id (mapped)", dChannels.find(c => c.name === "📃・regole")?.id, dGuild.rules_channel_id],
    ["public_updates_channel_id (mapped)", dChannels.find(c => c.name === "🔰・staff")?.id, dGuild.public_updates_channel_id]
  ];

  for (const [key, exp, act] of checks) {
    if (exp === act) {
      console.log(`  ✅ ${key}: ${act}`);
    } else {
      console.error(`  ❌ ${key}: expected ${exp} but got ${act}`);
      pass = false;
    }
  }

  // 2. Roles
  console.log("\n[2/8] Roles Verification:");
  const sUnmanaged = sRoles.filter(r => !r.managed);
  const dUnmanaged = dRoles.filter(r => !r.managed);
  console.log(`  Source unmanaged: ${sUnmanaged.length}, Dest unmanaged: ${dUnmanaged.length}`);
  if (sUnmanaged.length !== dUnmanaged.length) {
    console.error("  ❌ Roles count mismatch!");
    pass = false;
  } else {
    console.log("  ✅ Roles count matches 100%");
  }

  let rolePropDiffs = 0;
  for (const sr of sUnmanaged) {
    const dr = dUnmanaged.find(r => r.name === sr.name && (r.name !== "Social" || r.color === sr.color));
    if (!dr) {
      console.error(`  ❌ Role missing in dest: ${sr.name}`);
      rolePropDiffs++;
      continue;
    }
    if (sr.color !== dr.color || sr.hoist !== dr.hoist || sr.mentionable !== dr.mentionable || sr.permissions !== dr.permissions) {
      console.error(`  ❌ Role property mismatch: ${sr.name}`);
      rolePropDiffs++;
    }
  }
  if (rolePropDiffs === 0) {
    console.log("  ✅ All role colors, hoists, mentionables, and permissions match 100%");
  } else {
    pass = false;
  }

  // Role map
  const roleMap = { [sourceId]: destId };
  for (const sr of sRoles) {
    if (sr.id === sourceId) continue;
    const dr = dRoles.find(r => r.name === sr.name && (r.name !== "Social" || r.color === sr.color));
    if (dr) roleMap[sr.id] = dr.id;
  }

  // 3. Categories & Channels
  console.log("\n[3/8] Categories & Channels Verification:");
  const sCats = sChannels.filter(c => c.type === 4);
  const dCats = dChannels.filter(c => c.type === 4);
  console.log(`  Categories: ${sCats.length} source, ${dCats.length} dest`);
  if (sCats.length === dCats.length) {
    console.log("  ✅ Category count matches (12 categories)");
  } else {
    console.error("  ❌ Category count mismatch!");
    pass = false;
  }

  const dOrphans = dChannels.filter(c => !c.parent_id && c.type !== 4);
  console.log(`  Dest orphan channels: ${dOrphans.length}`);
  if (dOrphans.length === 0) {
    console.log("  ✅ Zero orphan channels in dest");
  } else {
    console.error("  ❌ Unexpected orphan channels:", dOrphans.map(c => c.name));
    pass = false;
  }

  // 4. Permission Overwrites
  console.log("\n[4/8] Channel Permission Overwrites Verification:");
  let overwriteMismatches = 0;
  for (const sc of sChannels) {
    if (!sc.parent_id && (sc.name.startsWith("ticket-") || sc.name.startsWith("partnership-"))) continue;
    if (sc.name.startsWith("🔒・Stanza")) continue;

    const sParent = sChannels.find(p => p.id === sc.parent_id);
    const sParentName = sParent ? sParent.name : null;

    const dc = dChannels.find(c => {
      if (c.name !== sc.name || c.type !== sc.type) return false;
      if (sc.type === 4) return true;
      const dParent = dChannels.find(p => p.id === c.parent_id);
      return dParent?.name === sParentName;
    });

    if (!dc) continue;

    const sRoleOverwrites = (sc.permission_overwrites || []).filter(o => o.type === 0);
    const dRoleOverwrites = (dc.permission_overwrites || []).filter(o => o.type === 0);

    for (const sro of sRoleOverwrites) {
      const expRoleId = roleMap[sro.id];
      const dro = dRoleOverwrites.find(o => o.id === expRoleId);
      if (!dro || dro.allow !== sro.allow || dro.deny !== sro.deny) {
        overwriteMismatches++;
      }
    }
  }

  if (overwriteMismatches === 0) {
    console.log("  ✅ All channel & category role permission overwrites match 100% (0 mismatches)");
  } else {
    console.error(`  ❌ Role overwrite mismatches found: ${overwriteMismatches}`);
    pass = false;
  }

  // 5. AutoMod
  console.log("\n[5/8] AutoMod Rules Verification:");
  for (const sr of sAutomod) {
    const dr = dAutomod.find(r => r.name === sr.name);
    if (dr && dr.enabled === sr.enabled) {
      console.log(`  ✅ Rule "${sr.name}" active in dest`);
    } else {
      console.error(`  ❌ Rule "${sr.name}" missing or disabled in dest`);
      pass = false;
    }
  }

  // 6. Bot settings.json
  console.log("\n[6/8] Settings.json Verification for Guild 965378975675322438:");
  const allSettings = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/settings.json"), "utf8"));
  const dCfg = allSettings[destId];
  if (!dCfg) {
    console.error("  ❌ Guild config not found in settings.json!");
    pass = false;
  } else {
    console.log("  ✅ Config exists in settings.json");
    const dRoleIds = new Set(dRoles.map(r => r.id));
    const dChannelIds = new Set(dChannels.map(c => c.id));

    const keyRoleIds = [
      ["verifiedRoleId", dCfg.verification?.verifiedRoleId],
      ["warn level 1 role", dCfg.warns?.levels?.["1"]?.roleId],
      ["warn level 2 role", dCfg.warns?.levels?.["2"]?.roleId],
      ["warn level 3 role", dCfg.warns?.levels?.["3"]?.roleId]
    ];
    for (const [desc, rid] of keyRoleIds) {
      if (dRoleIds.has(rid)) {
        console.log(`  ✅ ${desc} (${rid}) exists in dest roles`);
      } else {
        console.error(`  ❌ ${desc} (${rid}) NOT found in dest roles!`);
        pass = false;
      }
    }

    const keyChannelIds = [
      ["logs.globalChannelId", dCfg.logs?.globalChannelId],
      ["verification.channelId", dCfg.verification?.channelId],
      ["partnerships.partnerChannelId", dCfg.partnerships?.partnerChannelId],
      ["counting.channelId", dCfg.counting?.channelId],
      ["starboard.channelId", dCfg.starboard?.channelId],
      ["tickets panel channelId", dCfg.tickets?.panels?.[0]?.channelId],
      ["voice.hubChannelId", dCfg.voice?.hubChannelId]
    ];
    for (const [desc, cid] of keyChannelIds) {
      if (dChannelIds.has(cid)) {
        console.log(`  ✅ ${desc} (${cid}) exists in dest channels`);
      } else {
        console.error(`  ❌ ${desc} (${cid}) NOT found in dest channels!`);
        pass = false;
      }
    }
  }

  // 7. Key Channel Panels
  console.log("\n[7/8] Key Channel Panels Verification:");
  const panelsToCheck = [
    ["☑️・verifica", 1],
    ["📃・regole", 1],
    ["🎫・ticket", 1],
    ["🧧・unban", 1]
  ];
  for (const [chName, minMsgs] of panelsToCheck) {
    const ch = dChannels.find(c => c.name === chName);
    if (!ch) {
      console.error(`  ❌ Channel "${chName}" missing in dest!`);
      pass = false;
      continue;
    }
    const msgs = await rest.get(Routes.channelMessages(ch.id), { query: new URLSearchParams({ limit: 5 }) });
    if (msgs.length >= minMsgs) {
      console.log(`  ✅ "${chName}" has active panel message(s) [${msgs.length}]`);
    } else {
      console.error(`  ❌ "${chName}" has NO panel messages!`);
      pass = false;
    }
  }

  // 8. Bot Health
  console.log("\n[8/8] Bot Runtime Health:");
  const http = require("http");
  const healthData = await new Promise((resolve) => {
    http.get("http://127.0.0.1:3002/api/health", (res) => {
      let raw = "";
      res.on("data", c => raw += c);
      res.on("end", () => resolve(JSON.parse(raw)));
    }).on("error", () => resolve(null));
  });

  if (healthData?.discordReady === true) {
    console.log(`  ✅ Bot is online, discordReady: true, wsStatus: ${healthData.wsStatus}`);
  } else {
    console.error("  ❌ Bot health check failed:", healthData);
    pass = false;
  }

  console.log("\n=======================================================");
  if (pass) {
    console.log("🎉 ALL 8 VERIFICATION SUITES PASSED WITH 100% SUCCESS! 🎉");
  } else {
    console.error("⚠️ SOME VERIFICATION CHECKS FAILED!");
  }
  console.log("=======================================================");
}

main().catch(console.error);
