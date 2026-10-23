require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

async function run() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const rest = new REST({ version: "10" }).setToken(token);

  const sourceId = "1429445691452948524";
  const destId = "965378975675322438";

  console.log("Fetching guilds...");
  const sGuild = await rest.get(Routes.guild(sourceId));
  const dGuild = await rest.get(Routes.guild(destId));
  console.log("Guilds fetched:", sGuild.name, "vs", dGuild.name);

  console.log("Fetching roles...");
  const sRoles = await rest.get(Routes.guildRoles(sourceId));
  const dRoles = await rest.get(Routes.guildRoles(destId));
  console.log(`Roles count: Source=${sRoles.length}, Dest=${dRoles.length}`);

  console.log("Fetching channels...");
  const sChannels = await rest.get(Routes.guildChannels(sourceId));
  const dChannels = await rest.get(Routes.guildChannels(destId));
  console.log(`Channels count: Source=${sChannels.length}, Dest=${dChannels.length}`);

  let sEmojis = [], dEmojis = [];
  try {
    sEmojis = await rest.get(Routes.guildEmojis(sourceId));
    dEmojis = await rest.get(Routes.guildEmojis(destId));
    console.log(`Emojis count: Source=${sEmojis.length}, Dest=${dEmojis.length}`);
  } catch (e) {
    console.log("Emojis error:", e.message);
  }

  let sStickers = [], dStickers = [];
  try {
    sStickers = await rest.get(Routes.guildStickers(sourceId));
    dStickers = await rest.get(Routes.guildStickers(destId));
    console.log(`Stickers count: Source=${sStickers.length}, Dest=${dStickers.length}`);
  } catch (e) {
    console.log("Stickers error:", e.message);
  }

  console.log("\n--- Guild Settings Comparison ---");
  const guildProps = [
    "name", "afk_timeout", "afk_channel_id", "system_channel_flags",
    "verification_level", "default_message_notifications", "explicit_content_filter",
    "premium_progress_bar_enabled", "preferred_locale"
  ];
  for (const prop of guildProps) {
    console.log(`${prop}: Source='${sGuild[prop]}' | Dest='${dGuild[prop]}' | Match=${sGuild[prop] === dGuild[prop]}`);
  }

  console.log("\n--- Role Position / Hierarchy Comparison ---");
  const sRolesSorted = [...sRoles].filter(r => !r.managed).sort((a,b) => b.position - a.position);
  const dRolesSorted = [...dRoles].filter(r => !r.managed).sort((a,b) => b.position - a.position);

  let orderMismatches = 0;
  for (let i = 0; i < sRolesSorted.length; i++) {
    const sr = sRolesSorted[i];
    const drIndex = dRolesSorted.findIndex(r => r.name === sr.name && (r.name !== "Social" || r.color === sr.color));
    if (drIndex !== -1 && drIndex !== i) {
      console.log(`Role order mismatch: "${sr.name}" is #${i} (pos ${sr.position}) in source, but #${drIndex} (pos ${dRolesSorted[drIndex].position}) in dest`);
      orderMismatches++;
    }
  }
  console.log(`Total role order relative position mismatches: ${orderMismatches}`);

  console.log("\n--- Channel Position Comparison ---");
  // Check category order and channel order within categories
  const sCats = sChannels.filter(c => c.type === 4).sort((a,b) => a.position - b.position);
  const dCats = dChannels.filter(c => c.type === 4).sort((a,b) => a.position - b.position);

  console.log(`Source Categories order:`, sCats.map(c => c.name).join(" > "));
  console.log(`Dest Categories order:`, dCats.map(c => c.name).join(" > "));

  let catOrderMismatches = 0;
  for (let i = 0; i < sCats.length; i++) {
    if (dCats[i]?.name !== sCats[i].name) {
      console.log(`Category #${i} mismatch: Source="${sCats[i].name}" vs Dest="${dCats[i]?.name}"`);
      catOrderMismatches++;
    }
  }
  console.log(`Category order mismatches: ${catOrderMismatches}`);

  console.log("\n--- Checking Bot Data Files ---");
  const dataDir = path.join(__dirname, "../data");
  const dataFiles = fs.readdirSync(dataDir).filter(f => f.endsWith(".json"));
  for (const f of dataFiles) {
    if (f === "settings.json") continue;
    const content = fs.readFileSync(path.join(dataDir, f), "utf8");
    if (content.includes(sourceId)) {
      console.log(`Found sourceId ${sourceId} in data/${f}!`);
    }
  }

  // Let's check emojis in detail
  if (sEmojis.length > 0) {
    console.log("Source emojis:", sEmojis.map(e => e.name));
    console.log("Dest emojis:", dEmojis.map(e => e.name));
  }
}

run().catch(console.error);
