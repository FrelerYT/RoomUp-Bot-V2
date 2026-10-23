const fs = require("fs");
const path = require("path");

const data = JSON.parse(fs.readFileSync(path.join(__dirname, "guild_dump.json"), "utf8"));
const { source, dest } = data;

const s = source.guild;
const d = dest.guild;

console.log("=== SERVER LEVEL SETTINGS COMPARISON ===");
const fields = [
  "name",
  "icon",
  "splash",
  "discovery_splash",
  "afk_channel_id",
  "afk_timeout",
  "system_channel_id",
  "system_channel_flags",
  "rules_channel_id",
  "public_updates_channel_id",
  "safety_alerts_channel_id",
  "verification_level",
  "default_message_notifications",
  "explicit_content_filter",
  "premium_progress_bar_enabled",
  "preferred_locale",
  "features",
  "description"
];

for (const f of fields) {
  console.log(`${f}:`);
  console.log(`  Source: ${JSON.stringify(s[f])}`);
  console.log(`  Dest:   ${JSON.stringify(d[f])}`);
}
