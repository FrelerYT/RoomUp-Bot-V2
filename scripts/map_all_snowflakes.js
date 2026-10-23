const fs = require("fs");
const path = require("path");

const dump = JSON.parse(fs.readFileSync(path.join(__dirname, "guild_dump.json"), "utf8"));
const sCfg = JSON.parse(fs.readFileSync(path.join(__dirname, "source_config.json"), "utf8"));

const { source, dest } = dump;

// Map roles: sourceRoleId -> destRoleId
const roleMap = {
  [source.guild.id]: dest.guild.id // @everyone
};
for (const sr of source.roles) {
  if (sr.id === source.guild.id) continue;
  const dr = dest.roles.find(r => r.name === sr.name && (r.name !== "Social" || r.color === sr.color));
  if (dr) roleMap[sr.id] = dr.id;
}

// Map channels: sourceChannelId -> destChannelId
const channelMap = {};
for (const sc of source.channels) {
  const dc = dest.channels.find(c => c.name === sc.name && c.type === sc.type);
  if (dc) channelMap[sc.id] = dc.id;
}

// Find all snowflake IDs in sCfg
const jsonStr = JSON.stringify(sCfg);
const snowflakeRegex = /\b\d{17,20}\b/g;
const allSnowflakes = [...new Set(jsonStr.match(snowflakeRegex) || [])];

console.log(`Found ${allSnowflakes.length} distinct snowflakes in source config.`);

for (const id of allSnowflakes) {
  if (id === source.guild.id) {
    console.log(`[Guild ID] ${id} -> ${dest.guild.id}`);
  } else if (roleMap[id]) {
    const sr = source.roles.find(r => r.id === id);
    const dr = dest.roles.find(r => r.id === roleMap[id]);
    console.log(`[Role] "${sr?.name}" (${id}) -> "${dr?.name}" (${roleMap[id]})`);
  } else if (channelMap[id]) {
    const sc = source.channels.find(c => c.id === id);
    const dc = dest.channels.find(c => c.id === channelMap[id]);
    console.log(`[Channel] "${sc?.name}" (${id}) -> "${dc?.name}" (${channelMap[id]})`);
  } else {
    console.log(`[UNKNOWN SNOWFLAKE] ${id}`);
  }
}
