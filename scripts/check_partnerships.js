const fs = require("fs");
const path = require("path");

const data = JSON.parse(fs.readFileSync(path.join(__dirname, "guild_dump.json"), "utf8"));
const { source, dest } = data;

const sPartnerships = source.channels.filter(c => c.name === "🤝・partnership");
const dPartnerships = dest.channels.filter(c => c.name === "🤝・partnership");

console.log("Source partnerships:");
sPartnerships.forEach(c => {
  const p = source.channels.find(parent => parent.id === c.parent_id);
  console.log(`  id: ${c.id}, parent: "${p?.name}" (${c.parent_id})`);
});

console.log("Dest partnerships:");
dPartnerships.forEach(c => {
  const p = dest.channels.find(parent => parent.id === c.parent_id);
  console.log(`  id: ${c.id}, parent: "${p?.name}" (${c.parent_id})`);
});
