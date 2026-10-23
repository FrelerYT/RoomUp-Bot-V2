const fs = require("fs");
const path = require("path");

const data = JSON.parse(fs.readFileSync(path.join(__dirname, "guild_dump.json"), "utf8"));
const { source, dest } = data;

// Build role map from source role ID to dest role ID
const roleMap = {};
// Map @everyone
roleMap[source.guild.id] = dest.guild.id;

// Map roles by name & color
for (const sr of source.roles) {
  if (sr.id === source.guild.id) continue;
  let dr = dest.roles.find(r => r.name === sr.name && (r.name !== "Social" || r.color === sr.color));
  if (dr) {
    roleMap[sr.id] = dr.id;
  }
}

console.log(`Mapped ${Object.keys(roleMap).length} roles.`);

// Check categories
const sCategories = source.channels.filter(c => c.type === 4).sort((a, b) => a.position - b.position);
const dCategories = dest.channels.filter(c => c.type === 4).sort((a, b) => a.position - b.position);

console.log("\n=== CATEGORIES ===");
console.log("Source Categories count:", sCategories.length);
console.log("Dest Categories count:  ", dCategories.length);

sCategories.forEach((sc, idx) => {
  const dc = dCategories.find(c => c.name === sc.name);
  console.log(`[${sc.position}] "${sc.name}" (id: ${sc.id}) -> Dest: ${dc ? `[${dc.position}] "${dc.name}" (${dc.id})` : "MISSING"}`);
});

// Check extra categories in dest
dCategories.forEach(dc => {
  if (!sCategories.some(sc => sc.name === dc.name)) {
    console.log(`Extra Dest category: "${dc.name}" (${dc.id})`);
  }
});

// Check channels per category
console.log("\n=== CHANNELS COMPARISON ===");
for (const sc of sCategories) {
  const dc = dCategories.find(c => c.name === sc.name);
  console.log(`\nCategory: "${sc.name}"`);
  const sChildren = source.channels.filter(c => c.parent_id === sc.id).sort((a, b) => a.position - b.position);
  const dChildren = dc ? dest.channels.filter(c => c.parent_id === dc.id).sort((a, b) => a.position - b.position) : [];

  console.log(`  Source children (${sChildren.length}):`, sChildren.map(c => `${c.name} [pos:${c.position}, type:${c.type}]`));
  console.log(`  Dest children (${dChildren.length}):  `, dChildren.map(c => `${c.name} [pos:${c.position}, type:${c.type}]`));

  // Check differences in children
  for (const child of sChildren) {
    const dChild = dChildren.find(c => c.name === child.name && c.type === child.type);
    if (!dChild) {
      console.log(`    ❌ Missing child in dest: "${child.name}" (type: ${child.type})`);
    } else {
      // compare topic, nsfw, rate_limit_per_user
      const diffs = [];
      if (child.topic !== dChild.topic) diffs.push(`topic: "${child.topic}" vs "${dChild.topic}"`);
      if (child.rate_limit_per_user !== dChild.rate_limit_per_user) diffs.push(`rateLimit: ${child.rate_limit_per_user} vs ${dChild.rate_limit_per_user}`);
      if (child.nsfw !== dChild.nsfw) diffs.push(`nsfw: ${child.nsfw} vs ${dChild.nsfw}`);
      if (child.position !== dChild.position) diffs.push(`pos: ${child.position} vs ${dChild.position}`);
      if (diffs.length > 0) {
        console.log(`    ⚠️ Diff in "${child.name}":`, diffs.join(", "));
      }
    }
  }

  for (const dChild of dChildren) {
    if (!sChildren.some(c => c.name === dChild.name && c.type === dChild.type)) {
      console.log(`    ➕ Extra child in dest: "${dChild.name}" (type: ${dChild.type})`);
    }
  }
}

// Check orphan channels (no parent)
const sOrphans = source.channels.filter(c => !c.parent_id && c.type !== 4);
const dOrphans = dest.channels.filter(c => !c.parent_id && c.type !== 4);
console.log("\nSource Orphans (no parent category):", sOrphans.map(c => `${c.name} (${c.type})`));
console.log("Dest Orphans (no parent category):", dOrphans.map(c => `${c.name} (${c.type})`));
