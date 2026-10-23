require("dotenv").config();
const { REST } = require("discord.js");

async function main() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const rest = new REST({ version: "10" }).setToken(token);

  const sourceId = "1429445691452948524";
  const destId = "965378975675322438";

  console.log("Fetching AutoMod rules...");
  const sRules = await rest.get(`/guilds/${sourceId}/auto-moderation/rules`);
  const dRules = await rest.get(`/guilds/${destId}/auto-moderation/rules`);

  console.log(`Source has ${sRules.length} rules, Dest has ${dRules.length} rules.`);

  for (const sr of sRules) {
    // Check if dest has rule with same trigger_type
    const match = dRules.find(dr => dr.trigger_type === sr.trigger_type && dr.name === sr.name) ||
                  dRules.find(dr => dr.trigger_type === sr.trigger_type);

    const body = {
      name: sr.name,
      event_type: sr.event_type,
      trigger_type: sr.trigger_type,
      trigger_metadata: sr.trigger_metadata,
      actions: sr.actions,
      enabled: sr.enabled,
      exempt_roles: [],
      exempt_channels: []
    };

    if (match) {
      console.log(`Updating existing rule in Dest: "${match.name}" -> "${sr.name}"...`);
      // When updating, trigger_type cannot be changed
      delete body.trigger_type;
      try {
        await rest.patch(`/guilds/${destId}/auto-moderation/rules/${match.id}`, { body });
        console.log(`✅ Updated rule "${sr.name}"`);
      } catch (e) {
        console.error(`Error updating rule "${sr.name}":`, e.message);
      }
    } else {
      console.log(`Creating new rule in Dest: "${sr.name}"...`);
      try {
        await rest.post(`/guilds/${destId}/auto-moderation/rules`, { body });
        console.log(`✅ Created rule "${sr.name}"`);
      } catch (e) {
        console.error(`Error creating rule "${sr.name}":`, e.message);
      }
    }
  }

  // Delete other unused custom rules in Dest if any that don't match
  const updatedDRules = await rest.get(`/guilds/${destId}/auto-moderation/rules`);
  console.log("Current Dest AutoMod rules:");
  updatedDRules.forEach(r => console.log(`  - "${r.name}" (trigger: ${r.trigger_type})`));
}

main().catch(console.error);
