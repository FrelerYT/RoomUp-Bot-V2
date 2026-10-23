require("dotenv").config();
const { REST } = require("discord.js");

async function run() {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);
  const sourceId = "1429445691452948524";
  const destId = "965378975675322438";

  console.log("Fetching soundboard sounds...");
  const sSounds = await rest.get(`/guilds/${sourceId}/soundboard-sounds`);
  const dSounds = await rest.get(`/guilds/${destId}/soundboard-sounds`);

  console.log(`Source sounds: ${sSounds.items.length}, Dest sounds: ${dSounds.items.length}`);
  const destSoundNames = new Set(dSounds.items.map(s => s.name));

  for (const sound of sSounds.items) {
    if (destSoundNames.has(sound.name)) {
      console.log(`Sound "${sound.name}" already in dest, skipping.`);
      continue;
    }
    try {
      console.log(`Cloning "${sound.name}"...`);
      const res = await fetch(`https://cdn.discordapp.com/soundboard-sounds/${sound.sound_id}`);
      if (!res.ok) {
        console.error(`Failed to download sound ${sound.name}: ${res.status}`);
        continue;
      }
      const buf = await res.arrayBuffer();
      const b64 = Buffer.from(buf).toString("base64");
      const dataUri = `data:audio/ogg;base64,${b64}`;

      const body = {
        name: sound.name,
        sound: dataUri,
        volume: sound.volume ?? 1
      };
      if (sound.emoji_name) {
        body.emoji_name = sound.emoji_name;
      }

      const created = await rest.post(`/guilds/${destId}/soundboard-sounds`, { body });
      console.log(`✅ Created sound "${created.name}" in dest (${created.sound_id})`);
      // Small pause to prevent hitting rate limits
      await new Promise(r => setTimeout(r, 600));
    } catch (err) {
      console.error(`❌ Error cloning "${sound.name}":`, err.message);
    }
  }

  const finalDSounds = await rest.get(`/guilds/${destId}/soundboard-sounds`);
  console.log(`\n🎉 Dest soundboard sounds now: ${finalDSounds.items.length} / ${sSounds.items.length}`);
}

run().catch(console.error);
